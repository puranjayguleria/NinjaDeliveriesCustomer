/**
 * groceryPrefetch.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Warms up all Firestore data that ProductsHomeScreen needs before it mounts.
 * Call `prefetchGroceryData(storeId)` as early as possible — e.g. right after
 * the user's storeId is known (LocationContext update) — so the screen can
 * read from the in-memory cache instead of waiting for fresh network round-trips.
 *
 * HOW IT WORKS
 * ─────────────
 * 1. All queries run in parallel via Promise.all.
 * 2. Results are stored in a module-level Map keyed by storeId.
 * 3. ProductsHomeScreen reads from the cache via the exported `getGroceryCache`
 *    helper — no changes to the screen's existing data-flow are required.
 * 4. Cache entries expire after CACHE_TTL_MS (5 minutes by default).
 *
 * ZERO FLOW CHANGES
 * ──────────────────
 * The screen's existing useEffect hooks still run exactly as before.
 * The cache is purely additive: if a cache hit exists the screen's first
 * Firestore snapshot arrives faster because the SDK serves it from its own
 * local cache (warmed by the prefetch).  If there is no cache hit the screen
 * behaves identically to today.
 */

import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GroceryPrefetchResult {
  categories: any[];
  subcategories: any[];
  homeMessages: any[];
  categoryShortcuts: any[];
  highlights: { best: any[]; fresh: any[] };
  lastOrder: any | null;
  pageBg: any | null;
  quizData: { introGifUrl: string | null; title: string | null };
  fetchedAt: number;
}

// ─── In-memory cache ──────────────────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const cache = new Map<string, GroceryPrefetchResult>();

/** Returns a cached result if it is still fresh, otherwise null. */
export function getGroceryCache(storeId: string): GroceryPrefetchResult | null {
  const entry = cache.get(storeId);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    cache.delete(storeId);
    return null;
  }
  return entry;
}

/** Clears the cache for a specific store (e.g. on location change). */
export function clearGroceryCache(storeId?: string) {
  if (storeId) {
    cache.delete(storeId);
  } else {
    cache.clear();
  }
}

// ─── Prefetch ─────────────────────────────────────────────────────────────────

let inflight: Map<string, Promise<GroceryPrefetchResult>> = new Map();

/**
 * Fires all grocery home-screen queries in parallel and stores the result in
 * the module-level cache.  Safe to call multiple times — concurrent calls for
 * the same storeId share a single in-flight Promise.
 */
export async function prefetchGroceryData(
  storeId: string
): Promise<GroceryPrefetchResult> {
  if (!storeId) return emptyResult();

  // Return cached result if still fresh
  const cached = getGroceryCache(storeId);
  if (cached) return cached;

  // Deduplicate concurrent calls
  const existing = inflight.get(storeId);
  if (existing) return existing;

  const promise = _runPrefetch(storeId).finally(() => {
    inflight.delete(storeId);
  });

  inflight.set(storeId, promise);
  return promise;
}

async function _runPrefetch(storeId: string): Promise<GroceryPrefetchResult> {
  const uid = auth().currentUser?.uid ?? null;
  const now = Date.now();

  try {
    // ── Fire all queries in parallel ─────────────────────────────────────────
    const [
      catSnap,
      subSnap,
      homeMsgSnap,
      shortcutsSnap,
      highlightsSnap,
      pageBgSnap,
      quizSnap,
      lastOrderSnap,
    ] = await Promise.all([
      // 1. Categories (ordered by priority)
      firestore()
        .collection('categories')
        .where('storeId', '==', storeId)
        .orderBy('priority', 'asc')
        .get(),

      // 2. Subcategories
      firestore()
        .collection('subcategories')
        .where('storeId', '==', storeId)
        .get(),

      // 3. Home messages
      firestore()
        .collection('home_messages')
        .where('storeId', '==', storeId)
        .get(),

      // 4. Category shortcuts
      firestore()
        .collection('category_shortcuts')
        .where('storeId', '==', storeId)
        .where('enabled', '==', true)
        .get(),

      // 5. Products for highlights (best-sellers + new arrivals)
      firestore()
        .collection('products')
        .where('storeId', '==', storeId)
        .where('quantity', '>', 0)
        .get(),

      // 6. Page background
      firestore()
        .collection('page_backgrounds')
        .where('storeId', '==', storeId)
        .where('page', '==', 'home')
        .limit(1)
        .get(),

      // 7. Quiz / intro media
      firestore()
        .collection('quizzes')
        .where('storeId', '==', storeId)
        .where('isActive', '==', true)
        .limit(1)
        .get(),

      // 8. Last order (only if user is logged in)
      uid
        ? firestore()
            .collection('orders')
            .where('orderedBy', '==', uid)
            .where('storeId', '==', storeId)
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get()
        : Promise.resolve(null),
    ]);

    // ── Process categories ────────────────────────────────────────────────────
    const categories = catSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const subcategories = subSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // ── Process home messages ─────────────────────────────────────────────────
    const homeMessages = homeMsgSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter((m: any) => m.enabled !== false)
      .sort((a: any, b: any) => {
        const aP = typeof a.priority === 'number' ? a.priority : Number.MAX_SAFE_INTEGER;
        const bP = typeof b.priority === 'number' ? b.priority : Number.MAX_SAFE_INTEGER;
        return aP - bP;
      });

    // ── Process shortcuts ─────────────────────────────────────────────────────
    const categoryShortcuts = shortcutsSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort(
        (a: any, b: any) =>
          Number(a?.priority ?? Number.MAX_SAFE_INTEGER) -
          Number(b?.priority ?? Number.MAX_SAFE_INTEGER)
      );

    // ── Process highlights ────────────────────────────────────────────────────
    const allProducts = highlightsSnap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() ?? null,
      };
    });

    const best = allProducts
      .filter((p: any) => (p.weeklySold ?? 0) > 0)
      .sort((a: any, b: any) => (b.weeklySold ?? 0) - (a.weeklySold ?? 0));

    const fresh = allProducts
      .filter((p: any) => p.isNew)
      .sort((a: any, b: any) => {
        const aT = a.createdAt?.getTime?.() ?? 0;
        const bT = b.createdAt?.getTime?.() ?? 0;
        return bT - aT;
      });

    // ── Process page background ───────────────────────────────────────────────
    let pageBg: any | null = null;
    if (!pageBgSnap.empty) {
      const d = pageBgSnap.docs[0].data() as any;
      if (d?.enabled !== false) {
        const fromOk = !d.activeFrom || new Date(d.activeFrom).getTime() <= now;
        const toOk = !d.activeTo || new Date(d.activeTo).getTime() >= now;
        if (fromOk && toOk) pageBg = d;
      }
    }

    // ── Process quiz ──────────────────────────────────────────────────────────
    const quizDoc = quizSnap.docs[0]?.data();
    const quizData = {
      introGifUrl: quizDoc?.introGifUrl && quizDoc?.isActive ? quizDoc.introGifUrl : null,
      title: quizDoc?.title ?? null,
    };

    // ── Process last order ────────────────────────────────────────────────────
    let lastOrder: any | null = null;
    if (lastOrderSnap && !lastOrderSnap.empty) {
      const completed = lastOrderSnap.docs.find(doc => {
        const status = String(doc.data().status || '').toLowerCase();
        return status === 'tripended';
      });
      if (completed) {
        const data = completed.data();
        lastOrder = {
          id: completed.id,
          items: data.items || [],
          createdAt: data.createdAt,
          status: data.status,
        };
      }
    }

    // ── Store in cache ────────────────────────────────────────────────────────
    const result: GroceryPrefetchResult = {
      categories,
      subcategories,
      homeMessages,
      categoryShortcuts,
      highlights: { best, fresh },
      lastOrder,
      pageBg,
      quizData,
      fetchedAt: now,
    };

    cache.set(storeId, result);
    return result;
  } catch (err) {
    if (__DEV__) console.warn('[groceryPrefetch] prefetch failed (non-fatal):', err);
    return emptyResult();
  }
}

function emptyResult(): GroceryPrefetchResult {
  return {
    categories: [],
    subcategories: [],
    homeMessages: [],
    categoryShortcuts: [],
    highlights: { best: [], fresh: [] },
    lastOrder: null,
    pageBg: null,
    quizData: { introGifUrl: null, title: null },
    fetchedAt: 0,
  };
}
