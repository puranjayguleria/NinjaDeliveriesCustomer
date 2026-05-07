/**
 * servicesPrefetch.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Warms up all Firestore data that ServicesScreen needs before it mounts.
 * Call `prefetchServicesData(storeId)` as early as possible — e.g. right after
 * the user's storeId is known — so the screen reads from the SDK's local cache
 * instead of waiting for fresh network round-trips.
 *
 * KEY OPTIMISATION vs. the screen's current approach
 * ────────────────────────────────────────────────────
 * The screen's 4 section fetches (plumber, auto-wash, home-cleaning, electrician)
 * each independently query `app_categories` — 4 identical reads.
 * This prefetch does that query ONCE and reuses the result for all 4 sections,
 * cutting 3 redundant Firestore reads on every cold start.
 *
 * ZERO FLOW CHANGES
 * ──────────────────
 * The screen's existing useEffect hooks still run exactly as before.
 * The cache is purely additive: the Firestore SDK serves subsequent identical
 * queries from its local cache (warmed by the prefetch), making them near-instant.
 */

import firestore from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ServiceSectionData {
  id: string;
  name: string;
  imageUrl: string | null;
  price?: any;
  packages: any[];
  categoryId: string;
  categoryMasterId: string;
  companyId: string;
  companyName: string;
  description: string;
  isActive: boolean;
}

export interface ServicesPrefetchResult {
  categories: any[];           // app_categories (isActive==true)
  banners: any[];              // service_banners (isActive==true)
  zoneCompanyIdsKey: string;   // pipe-separated company IDs for this zone
  zoneCompanyNamesKey: string; // pipe-separated company names for this zone
  zoneCategoryIdsKey: string;  // pipe-separated category IDs for this zone
  plumberServices: ServiceSectionData[];
  autoWashServices: ServiceSectionData[];
  homeCleanServices: ServiceSectionData[];
  electricianServices: ServiceSectionData[];
  fetchedAt: number;
}

// ─── AsyncStorage key (mirrors ServicesScreen's own key) ─────────────────────

const ZONE_MAPPING_KEY = (zoneId: string) => `services_zone_mapping_v1_${zoneId}`;
const CACHED_CATEGORIES_KEY = 'services_cached_categories_v1';
const ZONE_MAPPING_STORAGE_TTL_MS = 6 * 60 * 60 * 1000; // 6 h

// ─── In-memory cache ──────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const cache = new Map<string, ServicesPrefetchResult>();

export function getServicesCache(storeId: string): ServicesPrefetchResult | null {
  const entry = cache.get(storeId);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    cache.delete(storeId);
    return null;
  }
  return entry;
}

export function clearServicesCache(storeId?: string) {
  if (storeId) {
    cache.delete(storeId);
  } else {
    cache.clear();
  }
}

// ─── Prefetch ─────────────────────────────────────────────────────────────────

const inflight = new Map<string, Promise<ServicesPrefetchResult>>();

export async function prefetchServicesData(
  storeId: string
): Promise<ServicesPrefetchResult> {
  if (!storeId) return emptyResult();

  const cached = getServicesCache(storeId);
  if (cached) return cached;

  const existing = inflight.get(storeId);
  if (existing) return existing;

  const promise = _runPrefetch(storeId).finally(() => {
    inflight.delete(storeId);
  });

  inflight.set(storeId, promise);
  return promise;
}

async function _runPrefetch(storeId: string): Promise<ServicesPrefetchResult> {
  const now = Date.now();

  try {
    // ── Step 1: categories + banners in parallel (no storeId dependency) ─────
    const [categoriesSnap, bannersSnap] = await Promise.all([
      firestore()
        .collection('app_categories')
        .where('isActive', '==', true)
        .get(),
      firestore()
        .collection('service_banners')
        .where('isActive', '==', true)
        .get(),
    ]);

    const categories = categoriesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const banners = bannersSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => (b.priority || 0) - (a.priority || 0));

    // Persist categories for ServicesScreen's own cache key
    try {
      await AsyncStorage.setItem(
        CACHED_CATEGORIES_KEY,
        JSON.stringify({ ts: now, categories })
      );
    } catch { /* non-fatal */ }

    // ── Step 2: zone mapping ──────────────────────────────────────────────────
    let zoneCompanyIdsKey = '';
    let zoneCompanyNamesKey = '';
    let zoneCategoryIdsKey = '';

    // Try persisted mapping first (fast path — avoids Firestore read)
    try {
      const raw = await AsyncStorage.getItem(ZONE_MAPPING_KEY(storeId));
      if (raw) {
        const payload = JSON.parse(raw);
        const ts = Number(payload?.ts || 0);
        const fresh = ts > 0 && (now - ts) < ZONE_MAPPING_STORAGE_TTL_MS;
        const hasAny = !!(payload?.zoneCompanyIdsKey || payload?.zoneCompanyNamesKey);
        if (fresh && hasAny) {
          zoneCompanyIdsKey = String(payload.zoneCompanyIdsKey || '');
          zoneCompanyNamesKey = String(payload.zoneCompanyNamesKey || '');
          zoneCategoryIdsKey = String(payload.zoneCategoryIdsKey || '');
        }
      }
    } catch { /* non-fatal */ }

    // If no persisted mapping, fetch from Firestore
    if (!zoneCompanyIdsKey && !zoneCompanyNamesKey) {
      let companySnap = await firestore()
        .collection('service_company')
        .where('deliveryZoneId', '==', storeId)
        .get();

      // Fallback: match by zone name
      if (companySnap.empty) {
        try {
          const zoneDoc = await firestore()
            .collection('delivery_zones')
            .doc(storeId)
            .get();
          const zoneName = String(zoneDoc.data()?.name || '').trim();
          if (zoneName) {
            companySnap = await firestore()
              .collection('service_company')
              .where('deliveryZoneName', '==', zoneName)
              .get();
          }
        } catch { /* non-fatal */ }
      }

      const ids = new Set<string>();
      const names = new Set<string>();
      const catIds = new Set<string>();

      companySnap.forEach(doc => {
        const data = doc.data() as any;
        if (data?.isActive === false) return;

        const docId = String(doc.id || '').trim();
        const companyId = String(data?.companyId || '').trim();
        if (docId) ids.add(docId);
        if (companyId) ids.add(companyId);

        const nm = String(data?.companyName || data?.name || '').trim();
        if (nm) names.add(nm);

        // Collect category IDs from company doc
        const pushCat = (v: any) => {
          const s = String(v || '').trim();
          if (s) catIds.add(s);
        };
        pushCat(data?.categoryId);
        pushCat(data?.masterCategoryId);
        pushCat(data?.categoryMasterId);
        const catArrays = ['categoryIds', 'categoryMasterIds', 'masterCategoryIds', 'appCategoryIds'];
        catArrays.forEach(f => {
          if (Array.isArray(data?.[f])) data[f].forEach(pushCat);
        });
      });

      zoneCompanyIdsKey = Array.from(ids).filter(Boolean).sort().join('|');
      zoneCompanyNamesKey = Array.from(names).filter(Boolean).sort().join('|');
      zoneCategoryIdsKey = Array.from(catIds).filter(Boolean).sort().join('|');

      // Persist for ServicesScreen's own cache
      try {
        await AsyncStorage.setItem(
          ZONE_MAPPING_KEY(storeId),
          JSON.stringify({
            ts: now,
            zoneCompanyIdsKey,
            zoneCompanyNamesKey,
            zoneCategoryIdsKey,
          })
        );
      } catch { /* non-fatal */ }
    }

    // ── Step 3: build lookup sets ─────────────────────────────────────────────
    const zoneCompanyIdSet = new Set(
      zoneCompanyIdsKey.split('|').map(s => s.trim()).filter(Boolean)
    );
    const zoneCompanyNameSet = new Set(
      zoneCompanyNamesKey.split('|').map(s => s.trim()).filter(Boolean)
    );

    // ── Step 4: find category master IDs from the already-fetched categories ──
    // (ONE query reused for all 4 sections — the key optimisation)
    const findMasterCategoryId = (keywords: string[]): { catId: string; masterId: string } | null => {
      for (const doc of categories) {
        const name = String((doc as any)?.name || '').toLowerCase();
        const matches = keywords.some(kw => name.includes(kw));
        if (matches) {
          return {
            catId: String((doc as any)?.id || ''),
            masterId: String((doc as any)?.masterCategoryId || (doc as any)?.id || ''),
          };
        }
      }
      return null;
    };

    const plumberCat      = findMasterCategoryId(['plumb']);
    const autoWashCat     = findMasterCategoryId(['car wash', 'automobile wash', 'vehicle wash', 'car', 'wash']);
    const homeCleanCat    = findMasterCategoryId(['home clean', 'housekeep', 'maid', 'domestic']);
    const electricianCat  = findMasterCategoryId(['electric', 'wiring', 'voltage']);

    // ── Step 5: fetch all 4 service sections in parallel ─────────────────────
    const fetchSection = async (
      masterCategoryId: string,
      categoryId: string
    ): Promise<ServiceSectionData[]> => {
      if (!masterCategoryId) return [];
      try {
        const snap = await firestore()
          .collection('service_services')
          .where('categoryMasterId', '==', masterCategoryId)
          .get();

        const results: ServiceSectionData[] = [];
        snap.forEach(doc => {
          const data = doc.data() as any;
          const cid = String(data?.companyId || '').trim();
          const cname = String(data?.companyName || '').trim();
          const inZone =
            (cid && zoneCompanyIdSet.has(cid)) ||
            (cname && zoneCompanyNameSet.has(cname));
          if (!inZone) return;

          results.push({
            id: doc.id,
            name: data.name || '',
            imageUrl: data.imageUrl || null,
            price: data.price,
            packages: data.packages || [],
            categoryId,
            categoryMasterId: masterCategoryId,
            companyId: data.companyId || '',
            companyName: data.companyName || '',
            description: data.description || '',
            isActive: data.isActive !== false,
          });
        });

        return results
          .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
          .slice(0, 6);
      } catch {
        return [];
      }
    };

    const [plumberServices, autoWashServices, homeCleanServices, electricianServices] =
      await Promise.all([
        fetchSection(plumberCat?.masterId ?? '', plumberCat?.catId ?? ''),
        fetchSection(autoWashCat?.masterId ?? '', autoWashCat?.catId ?? ''),
        fetchSection(homeCleanCat?.masterId ?? '', homeCleanCat?.catId ?? ''),
        fetchSection(electricianCat?.masterId ?? '', electricianCat?.catId ?? ''),
      ]);

    // ── Store in cache ────────────────────────────────────────────────────────
    const result: ServicesPrefetchResult = {
      categories,
      banners,
      zoneCompanyIdsKey,
      zoneCompanyNamesKey,
      zoneCategoryIdsKey,
      plumberServices,
      autoWashServices,
      homeCleanServices,
      electricianServices,
      fetchedAt: now,
    };

    cache.set(storeId, result);
    return result;
  } catch (err) {
    if (__DEV__) console.warn('[servicesPrefetch] prefetch failed (non-fatal):', err);
    return emptyResult();
  }
}

function emptyResult(): ServicesPrefetchResult {
  return {
    categories: [],
    banners: [],
    zoneCompanyIdsKey: '',
    zoneCompanyNamesKey: '',
    zoneCategoryIdsKey: '',
    plumberServices: [],
    autoWashServices: [],
    homeCleanServices: [],
    electricianServices: [],
    fetchedAt: 0,
  };
}
