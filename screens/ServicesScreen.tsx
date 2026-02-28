import { useLocationContext } from '../context/LocationContext';
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  TextInput,
  ImageBackground,
  ScrollView,
  Animated,
  RefreshControl,
  Platform,
  Alert,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from '@expo/vector-icons';
import { FirestoreService, ServiceCategory, ServiceBanner } from '../services/firestoreService';
import { firestore } from '../firebase.native';
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width } = Dimensions.get('window');

// Lightweight in-memory cache so returning to Services doesn't refetch everything.
// Kept intentionally small/short-lived to avoid stale zone mapping.
const ZONE_MAPPING_CACHE_TTL_MS = 2 * 60 * 1000;
// Persisted mapping is safe to keep longer; if it drifts, we refresh in background.
const ZONE_MAPPING_STORAGE_TTL_MS = 6 * 60 * 60 * 1000;
const zoneMappingStorageKey = (zoneId: string) => `services_zone_mapping_v1_${zoneId}`;
const zoneMappingCache = new Map<
  string,
  {
    ts: number;
    zoneCompanyIdsKey: string;
    zoneCompanyNamesKey: string;
    zoneCategoryIdsKey: string;
  }
>();

// Cache for zone-scoped services used by search (avoid loading ALL services across all zones).
const ZONE_SERVICES_CACHE_TTL_MS = 2 * 60 * 1000;
const zoneServicesCache = new Map<string, { ts: number; services: any[] }>();

const CACHED_CATEGORIES_KEY = 'services_cached_categories_v1';
const CACHED_CATEGORIES_TTL_MS = 6 * 60 * 60 * 1000; // 6h

// Function to get icon and colors based on service category name
const getCategoryStyle = (categoryName: string, index: number) => {
  const name = categoryName.toLowerCase();
  
  // Icon mapping based on category name
  let icon = "construct-outline"; // default
  let color = "#64748b";
  let bgColor = "#f1f5f9";
  
  // Electrical Services
  if (name.includes("electric") || name.includes("wiring") || name.includes("voltage")) {
    icon = "flash-outline";
    color = "#F59E0B";
    bgColor = "#FFFBEB";
  } 
  // Plumbing Services
  else if (name.includes("plumb") || name.includes("pipe") || name.includes("water") || name.includes("drain")) {
    icon = "water-outline";
    color = "#3B82F6";
    bgColor = "#EFF6FF";
  } 
  // Car Wash / Vehicle Cleaning (check before general cleaning)
  else if (name.includes("car") && name.includes("clean")) {
    icon = "water-outline";
    color = "#0EA5E9";
    bgColor = "#F0F9FF";
  }
  else if (name.includes("car") || name.includes("wash") || name.includes("vehicle") || name.includes("auto") || name.includes("bike")) {
    icon = "water-outline";
    color = "#0EA5E9";
    bgColor = "#F0F9FF";
  } 
  // Home Cleaning Services (check before general cleaning)
  else if ((name.includes("home") && name.includes("clean")) || name.includes("housekeep") || name.includes("maid") || name.includes("domestic")) {
    icon = "home-outline";
    color = "#10B981";
    bgColor = "#ECFDF5";
  }
  // General Cleaning Services
  else if (name.includes("clean") || name.includes("sanitiz")) {
    icon = "sparkles-outline";
    color = "#06B6D4";
    bgColor = "#ECFEFF";
  } 
  // Health & Fitness
  else if (name.includes("health") || name.includes("fitness") || name.includes("yoga") || name.includes("physio") || name.includes("massage") || name.includes("therapy")) {
    icon = "fitness-outline";
    color = "#10B981";
    bgColor = "#ECFDF5";
  } 
  // Daily Wages / Labor
  else if (name.includes("daily") || name.includes("wage") || name.includes("worker") || name.includes("labor") || name.includes("helper")) {
    icon = "people-outline";
    color = "#8B5CF6";
    bgColor = "#F3E8FF";
  } 
  // AC / Cooling Services
  else if (name.includes("ac") || name.includes("air") || name.includes("condition") || name.includes("cooling") || name.includes("hvac")) {
    icon = "snow-outline";
    color = "#0EA5E9";
    bgColor = "#F0F9FF";
  } 
  else {
    // Fallback to index-based colors for unknown categories
    const fallbackColors = [
      { color: "#3B82F6", bgColor: "#EFF6FF", icon: "construct-outline" },
      { color: "#10B981", bgColor: "#ECFDF5", icon: "build-outline" },
      { color: "#F59E0B", bgColor: "#FFFBEB", icon: "hammer-outline" },
      { color: "#EF4444", bgColor: "#FEF2F2", icon: "settings-outline" },
      { color: "#8B5CF6", bgColor: "#F3E8FF", icon: "cog-outline" },
      { color: "#06B6D4", bgColor: "#ECFEFF", icon: "wrench-outline" },
    ];
    const fallback = fallbackColors[index % fallbackColors.length];
    icon = fallback.icon;
    color = fallback.color;
    bgColor = fallback.bgColor;
  }
  
  return { icon, color, bgColor };
};

// const SERVICES = [
//   {
//     id: "home-repair",
//     title: "Home Repair",
//     subtitle: "Electrician, plumber, etc.",
//     icon: "home-outline",
//     screen: "ServiceCategory",
//     params: { serviceTitle: "Electrician" },
//     color: "#3B82F6",
//     bgColor: "#EFF6FF",
//   },
//   {
//     id: "health",
//     title: "Health",
//     subtitle: "Physio, yoga, gym",
//     icon: "fitness-outline",
//     screen: "HealthCategory",
//     params: { serviceTitle: "Health" },
//     color: "#10B981",
//     bgColor: "#ECFDF5",
//   },
//   {
//     id: "daily-wages",
//     title: "Daily Wages",
//     subtitle: "Half day / Full day",
//     icon: "people-outline",
//     screen: "DailyWagesCategory",
//     params: { serviceTitle: "Daily Wages" },
//     color: "#F59E0B",
//     bgColor: "#FFFBEB",
//   },
// ];

// Remove unused constants
// const ALL_SERVICES = [
//   {
//     id: "1",
//     title: "Electrician",
//     subtitle: "Wiring, repairs & installations",
//     screen: "ServiceCategory",
//     params: { serviceTitle: "Electrician" },
//     icon: "flash-outline",
//     availability: "Available 24/7",
//   },
//   {
//     id: "2",
//     title: "Plumber",
//     subtitle: "Pipe repairs & water solutions",
//     screen: "ServiceCategory",
//     params: { serviceTitle: "Plumber" },
//     icon: "water-outline",
//     availability: "Emergency service",
//   },
//   {
//     id: "3",
//     title: "Health",
//     subtitle: "Wellness & fitness services",
//     screen: "HealthCategory",
//     params: { serviceTitle: "Health" },
//     icon: "fitness-outline",
//     availability: "Book sessions",
//   },
//   {
//     id: "4",
//     title: "Cleaning",
//     subtitle: "Deep cleaning & maintenance",
//     screen: "CleaningCategory",
//     params: { serviceTitle: "Cleaning" },
//     icon: "sparkles-outline",
//     availability: "Same day service",
//   },
//   {
//     id: "5",
//     title: "Daily Wages",
//     subtitle: "Skilled workers for hire",
//     screen: "DailyWagesCategory",
//     params: { serviceTitle: "Daily Wages" },
//     icon: "people-outline",
//     availability: "Flexible hours",
//   },
//   {
//     id: "6",
//     title: "Car Wash",
//     subtitle: "Premium car care services",
//     screen: "CarWashCategory",
//     params: { serviceTitle: "Car Wash" },
//     icon: "car-outline",
//     availability: "Doorstep service",
//   },
// ];

interface LiveBooking {
  id: string;
  serviceName: string;
  location: string;
  timestamp: any;
}

// GIF sources array
const HEADER_GIFS = [
  require('../assets/ninjaVideo1.gif'),
  require('../assets/ninjaVideo.gif'),
];

const SERVICES_HEADER_MEDIA_HEIGHT = 200;
const SERVICES_HEADER_MEDIA_COLLAPSED_HEIGHT = 90;
const SERVICES_HEADER_PADDING_TOP_INITIAL = Platform.OS === 'ios' ? 52 : 40;
const SERVICES_HEADER_PADDING_TOP_COLLAPSED = Platform.OS === 'ios' ? 44 : 32;
// Solid, very light + friendly header colors (no transparency).
// Soft off-white to a subtle mint/teal tint feels calmer during scroll.
const SERVICES_HEADER_GRADIENT_COLORS = ['#f8fafc', '#f0fdfa'] as const;
// Sticky header should only reserve space until the search bar (not the full media height).
// Keep this compact; history is inline with the search bar.
const SERVICES_STICKY_HEADER_HEIGHT = Platform.OS === 'ios' ? 190 : 175;

const SERVICES_SEARCH_PLACEHOLDERS = [
  'electrician',
  'plumber',
  'car wash',
  'home cleaning',
  'astrology',
  'painter',
] as const;

const SERVICES_SEARCH_PLACEHOLDER_CYCLE_MS = 4000;
const SERVICES_SEARCH_PLACEHOLDER_ANIM_MS = 240;

export default function ServicesScreen() {
  const navigation = useNavigation<any>();
  const { location } = useLocationContext();

  const scrollY = React.useRef(new Animated.Value(0)).current;

  const headerMediaHeight = React.useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [0, 120],
        outputRange: [SERVICES_HEADER_MEDIA_HEIGHT, SERVICES_HEADER_MEDIA_COLLAPSED_HEIGHT],
        extrapolate: 'clamp',
      }),
    [scrollY]
  );

  const headerMediaOpacity = React.useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [0, 120],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      }),
    [scrollY]
  );

  const headerGradientOpacity = React.useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [60, 120],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      }),
    [scrollY]
  );

  const headerTopPadding = React.useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [0, 120],
        outputRange: [SERVICES_HEADER_PADDING_TOP_INITIAL, SERVICES_HEADER_PADDING_TOP_COLLAPSED],
        extrapolate: 'clamp',
      }),
    [scrollY]
  );


  const hasSelectedLocation =
    (typeof location?.address === 'string' && location.address.trim().length > 0) ||
    (typeof location?.storeId === 'string' && location.storeId.trim().length > 0) ||
    (location?.lat != null && location?.lng != null);

  const locationDisplayText = React.useMemo(() => {
    const placeLabel = String((location as any)?.placeLabel || '').trim();
    const houseNo = String((location as any)?.houseNo || '').trim();
    const address = String((location as any)?.address || '').trim();

    const combined = [houseNo, address].filter(Boolean).join(' ');
    const best = placeLabel || combined || address;
    return best || 'your location';
  }, [location]);

  const locationPromptShownRef = React.useRef(false);

  useEffect(() => {
    if (hasSelectedLocation) locationPromptShownRef.current = false;
  }, [hasSelectedLocation]);

  useFocusEffect(
    useCallback(() => {
      if (hasSelectedLocation) return;
      if (locationPromptShownRef.current) return;
      locationPromptShownRef.current = true;

      Alert.alert(
        'Select location',
        'Please select your location to see services available in your area.',
        [
          {
            text: 'Select Location',
            onPress: () => navigation.navigate('LocationSelector', { fromScreen: 'Services' }),
          },
          { text: 'Not now', style: 'cancel' },
        ],
        { cancelable: true }
      );
    }, [hasSelectedLocation, navigation])
  );
  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>([]);
  const [rawServiceCategories, setRawServiceCategories] = useState<ServiceCategory[]>([]);
  const [serviceBanners, setServiceBanners] = useState<ServiceBanner[]>([]);
  const [liveBookings, setLiveBookings] = useState<LiveBooking[]>([]);
  const [allServices, setAllServices] = useState<any[]>([]);
  const [allServicesLoaded, setAllServicesLoaded] = useState(false);
  const [searchServices, setSearchServices] = useState<any[]>([]);
  const [activeServiceCategoryIdsKey, setActiveServiceCategoryIdsKey] = useState('');
  const [zoneCategoryIdsKey, setZoneCategoryIdsKey] = useState('');
  const [zoneCompanyIdsKey, setZoneCompanyIdsKey] = useState('');
  const [zoneCompanyNamesKey, setZoneCompanyNamesKey] = useState('');
  const [zoneCompaniesLoading, setZoneCompaniesLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [bannersLoading, setBannersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tapLoading, setTapLoading] = useState<{ visible: boolean; message?: string }>(
    { visible: false }
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchPlaceholderIndex, setSearchPlaceholderIndex] = useState(0);
  const placeholderTranslateY = React.useRef(new Animated.Value(6)).current;
  const placeholderOpacity = React.useRef(new Animated.Value(0)).current;
  const [refreshing, setRefreshing] = useState(false);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [activeGifIndex, setActiveGifIndex] = useState(0);
  const searchInputRef = React.useRef<TextInput>(null);
  const bannerScrollRef = React.useRef<FlatList>(null);
  const liveBookingsScrollRef = React.useRef<ScrollView>(null);
  const currentBannerIndex = React.useRef(0);
  const bannerAutoScrollIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  // const currentBookingIndex = React.useRef(0);
  const scrollX = React.useRef(0);
  const blinkAnim = React.useRef(new Animated.Value(1)).current;
  const bookingBlinkAnim = React.useRef(new Animated.Value(1)).current;
  const arrowAnim = React.useRef(new Animated.Value(0)).current;

  const categorySnapshotSeqRef = React.useRef(0);

  const prefetchedUrlsRef = React.useRef<string>('');

  // One-time banner shown after backend/webhook finalized a service payment.
  const SERVICE_CONFIRMED_BANNER_KEY = "service_confirmed_banner";
  const [serviceConfirmedBanner, setServiceConfirmedBanner] = useState<
    null | { razorpayOrderId: string; createdAt: number }
  >(null);

  // Important: do NOT block the initial UI on loading the full `service_services` dataset.
  // That collection can be large and may take a long time to stream the first snapshot.
  const isLoading = loading || zoneCompaniesLoading;

  const zoneCompanyIdSet = React.useMemo(() => {
    const ids = zoneCompanyIdsKey ? zoneCompanyIdsKey.split('|').map((s) => String(s).trim()).filter(Boolean) : [];
    return new Set(ids);
  }, [zoneCompanyIdsKey]);

  const zoneCompanyNameSet = React.useMemo(() => {
    const names = zoneCompanyNamesKey ? zoneCompanyNamesKey.split('|').map((s) => String(s).trim()).filter(Boolean) : [];
    return new Set(names);
  }, [zoneCompanyNamesKey]);

  const visibleCategoryIdSet = React.useMemo(() => {
    const ids = new Set<string>();
    for (const c of serviceCategories || []) {
      const own = String((c as any)?.id || '').trim();
      const master = String((c as any)?.masterCategoryId || '').trim();
      if (own) ids.add(own);
      if (master) ids.add(master);
    }
    return ids;
  }, [serviceCategories]);

  // Load zone-specific companies from service_company mapping.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const zid = String(location?.storeId || '').trim();

      let appliedPersistedMapping = false;

      const cached = zid ? zoneMappingCache.get(zid) : undefined;
      const hasFreshCache =
        !!cached &&
        (Date.now() - cached.ts) < ZONE_MAPPING_CACHE_TTL_MS &&
        (!!cached.zoneCompanyIdsKey || !!cached.zoneCompanyNamesKey || !!cached.zoneCategoryIdsKey);

      if (hasFreshCache && cached) {
        setZoneCompanyIdsKey(cached.zoneCompanyIdsKey);
        setZoneCompanyNamesKey(cached.zoneCompanyNamesKey);
        setZoneCategoryIdsKey(cached.zoneCategoryIdsKey);
        setActiveServiceCategoryIdsKey(cached.zoneCategoryIdsKey);
        setZoneCompaniesLoading(false);
        return;
      } else {
        setZoneCategoryIdsKey('');
        setZoneCompanyIdsKey('');
        setZoneCompanyNamesKey('');
        setZoneCompaniesLoading(true);
      }

      try {
        if (!zid) {
          // No deliverable zone selected → show none.
          if (!cancelled) {
            setZoneCompanyIdsKey('');
            setZoneCompanyNamesKey('');
          }
          return;
        }

        // Try persisted zone mapping (survives app restart). This keeps Android cold starts snappy.
        try {
          const raw = await AsyncStorage.getItem(zoneMappingStorageKey(zid));
          if (raw) {
            const payload = JSON.parse(raw);
            const ts = Number(payload?.ts || 0);
            const zoneCompanyIdsKey = String(payload?.zoneCompanyIdsKey || '');
            const zoneCompanyNamesKey = String(payload?.zoneCompanyNamesKey || '');
            const zoneCategoryIdsKey = String(payload?.zoneCategoryIdsKey || '');

            const hasAny = !!(zoneCompanyIdsKey || zoneCompanyNamesKey || zoneCategoryIdsKey);

            const fresh = ts > 0 && (Date.now() - ts) < ZONE_MAPPING_STORAGE_TTL_MS;
            if (fresh && hasAny) {
              setZoneCompanyIdsKey(zoneCompanyIdsKey);
              setZoneCompanyNamesKey(zoneCompanyNamesKey);
              setZoneCategoryIdsKey(zoneCategoryIdsKey);
              setActiveServiceCategoryIdsKey(zoneCategoryIdsKey);
              setZoneCompaniesLoading(false);

              zoneMappingCache.set(zid, {
                ts: Date.now(),
                zoneCompanyIdsKey,
                zoneCompanyNamesKey,
                zoneCategoryIdsKey,
              });

              return;
            }

            // Stale-while-revalidate: even if the mapping is older than our TTL,
            // it is still far better UX to show something immediately and then
            // refresh in the background.
            if (!fresh && hasAny) {
              appliedPersistedMapping = true;
              setZoneCompanyIdsKey(zoneCompanyIdsKey);
              setZoneCompanyNamesKey(zoneCompanyNamesKey);
              setZoneCategoryIdsKey(zoneCategoryIdsKey);
              setActiveServiceCategoryIdsKey(zoneCategoryIdsKey);
              setZoneCompaniesLoading(false);

              // Yield so the UI can render before doing heavier refresh work.
              await new Promise((r) => setTimeout(r, 0));
            }
          }
        } catch {
          // ignore
        }

        const t0 = __DEV__ ? Date.now() : 0;

        // 1) Try matching by deliveryZoneId
        let snap = await firestore()
          .collection('service_company')
          .where('deliveryZoneId', '==', zid)
          .get();

        // 2) Fallback: match by deliveryZoneName (derived from delivery_zones/{storeId}.name)
        if (snap.empty) {
          try {
            const zoneDoc = await firestore().collection('delivery_zones').doc(zid).get();
            const zoneName = String(zoneDoc.data()?.name || '').trim();
            if (zoneName) {
              snap = await firestore()
                .collection('service_company')
                .where('deliveryZoneName', '==', zoneName)
                .get();
            }
          } catch {
            // ignore
          }
        }

        if (cancelled) return;

        const ids = new Set<string>();
        const names = new Set<string>();
        const companyIdsForQuery = new Set<string>();
        const allowedCatIds = new Set<string>();

        const collectCategoryIdsFromCompany = (data: any) => {
          const push = (v: any) => {
            const s = String(v || '').trim();
            if (s) allowedCatIds.add(s);
          };

          // Common direct fields
          push(data?.categoryId);
          push(data?.masterCategoryId);
          push(data?.categoryMasterId);
          push(data?.category_id);
          push(data?.master_category_id);
          push(data?.category_master_id);

          // Common array fields
          const arrayFields = [
            'categoryIds',
            'categoryMasterIds',
            'masterCategoryIds',
            'appCategoryIds',
            'category_ids',
            'category_master_ids',
            'master_category_ids',
            'app_category_ids',
          ];
          for (const f of arrayFields) {
            const arr = data?.[f];
            if (Array.isArray(arr)) arr.forEach(push);
          }

          // Categories array may contain strings or objects
          const cats = data?.categories;
          if (Array.isArray(cats)) {
            cats.forEach((c: any) => {
              if (typeof c === 'string' || typeof c === 'number') {
                push(c);
                return;
              }
              push(c?.id);
              push(c?.categoryId);
              push(c?.masterCategoryId);
              push(c?.categoryMasterId);
              push(c?.category_id);
              push(c?.master_category_id);
              push(c?.category_master_id);
            });
          }

          // Some schemas store service/category objects under services/serviceList
          const serviceArrays = [data?.services, data?.serviceList, data?.serviceCategories];
          for (const arr of serviceArrays) {
            if (!Array.isArray(arr)) continue;
            arr.forEach((s: any) => {
              push(s?.categoryId);
              push(s?.masterCategoryId);
              push(s?.categoryMasterId);
            });
          }
        };

        snap.forEach((doc) => {
          const data = doc.data() as any;
          if (data?.isActive === false) return;

          const docId = String(doc.id || '').trim();
          if (docId) ids.add(docId);
          const dataCompanyId = String(data?.companyId || '').trim();
          if (dataCompanyId) ids.add(dataCompanyId);

          // Prefer explicit companyId when available for service_services joins.
          if (dataCompanyId) companyIdsForQuery.add(dataCompanyId);
          else if (docId) companyIdsForQuery.add(docId);

          const nm = String(data?.companyName || data?.name || '').trim();
          if (nm) names.add(nm);

          // Fast-path: if the zone mapping already stores category IDs, use them.
          // This avoids extra service_services reads on initial load.
          collectCategoryIdsFromCompany(data);
        });

        const zoneIdsKey = Array.from(ids).filter(Boolean).sort().join('|');
        const zoneNamesKey = Array.from(names).filter(Boolean).sort().join('|');
        setZoneCompanyIdsKey(zoneIdsKey);
        setZoneCompanyNamesKey(zoneNamesKey);

        // Derive allowed category IDs for this zone by querying service_services for these companies.
        // Only do this if the mapping docs didn't already provide category IDs.
        const companyIds = Array.from(companyIdsForQuery).filter(Boolean);

        if (allowedCatIds.size === 0 && companyIds.length > 0) {
          const batchSize = 10; // Firestore 'in' limit
          for (let i = 0; i < companyIds.length; i += batchSize) {
            if (cancelled) return;
            const batch = companyIds.slice(i, i + batchSize);
            if (batch.length === 0) continue;

            const svcSnap = await firestore()
              .collection('service_services')
              .where('companyId', 'in', batch)
              .get();

            svcSnap.forEach((svcDoc) => {
              const s = svcDoc.data() as any;
              if (s?.isActive === false) return;

              const candidates = [
                s?.categoryMasterId,
                s?.masterCategoryId,
                s?.categoryId,
                s?.category_master_id,
                s?.master_category_id,
                s?.category_id,
              ];

              for (const c of candidates) {
                const id = String(c || '').trim();
                if (id) allowedCatIds.add(id);
              }
            });
          }
        }

        // Best-effort fallback: some schemas join services by company name.
        if (allowedCatIds.size === 0 && names.size > 0) {
          const allNames = Array.from(names).filter(Boolean);
          const batchSize = 10;
          const tryField = async (field: string) => {
            for (let i = 0; i < allNames.length; i += batchSize) {
              if (cancelled) return;
              const batch = allNames.slice(i, i + batchSize);
              if (batch.length === 0) continue;
              try {
                const svcSnap = await firestore()
                  .collection('service_services')
                  .where(field, 'in', batch)
                  .get();

                svcSnap.forEach((svcDoc) => {
                  const s = svcDoc.data() as any;
                  if (s?.isActive === false) return;
                  const id = String(s?.categoryMasterId || s?.masterCategoryId || s?.categoryId || '').trim();
                  if (id) allowedCatIds.add(id);
                });
              } catch {
                // ignore index/field issues
              }
            }
          };

          await tryField('companyName');
          if (allowedCatIds.size === 0) await tryField('company');
        }

        const catIdsKey = Array.from(allowedCatIds).filter(Boolean).sort().join('|');
        setZoneCategoryIdsKey(catIdsKey);
        // We now derive category ids directly from service_services for this zone,
        // so this is also a good proxy for “categories that have active services”.
        setActiveServiceCategoryIdsKey(catIdsKey);

        if (zid) {
          zoneMappingCache.set(zid, {
            ts: Date.now(),
            zoneCompanyIdsKey: zoneIdsKey,
            zoneCompanyNamesKey: zoneNamesKey,
            zoneCategoryIdsKey: catIdsKey,
          });

          // Persist for cold-start performance.
          try {
            await AsyncStorage.setItem(
              zoneMappingStorageKey(zid),
              JSON.stringify({
                ts: Date.now(),
                zoneCompanyIdsKey: zoneIdsKey,
                zoneCompanyNamesKey: zoneNamesKey,
                zoneCategoryIdsKey: catIdsKey,
              })
            );
          } catch {
            // ignore
          }
        }

        if (__DEV__ && t0) {
          console.log(`[Services][ZoneMapping] storeId=${zid} ms=${Date.now() - t0}`);
        }

        if (__DEV__) {
          console.log(
            `[Services][ZoneCompanies] storeId=${zid} companies=${snap.size} ids=${ids.size} names=${names.size} zoneCategoryIds=${allowedCatIds.size}`
          );
        }
      } finally {
        if (!cancelled && !appliedPersistedMapping) setZoneCompaniesLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [location?.storeId]);

  // Zone-scoped services fetch for search.
  // We DO NOT subscribe to the full `service_services` collection (too large / slow).
  // Instead, fetch only services for companies that serve the current zone, and filter client-side.
  useEffect(() => {
    const zid = String(location?.storeId || '').trim();
    const shouldLoadForSearch = isSearchFocused || searchQuery.trim().length > 0;

    // Don't waste work when user isn't searching.
    if (!shouldLoadForSearch) return;

    // Need zone mapping first.
    if (!zid || zoneCompaniesLoading) return;

    let cancelled = false;
    const run = async () => {
      try {
        const cached = zoneServicesCache.get(zid);
        const now = Date.now();
        if (cached && (now - cached.ts) < ZONE_SERVICES_CACHE_TTL_MS) {
          setAllServices(cached.services);
          setAllServicesLoaded(true);
          return;
        }

        setAllServicesLoaded(false);

        const companyIds = zoneCompanyIdsKey
          ? Array.from(
              new Set(
                zoneCompanyIdsKey
                  .split('|')
                  .map((s) => String(s).trim())
                  .filter(Boolean)
              )
            )
          : [];

        const companyNames = zoneCompanyNamesKey
          ? Array.from(
              new Set(
                zoneCompanyNamesKey
                  .split('|')
                  .map((s) => String(s).trim())
                  .filter(Boolean)
              )
            )
          : [];

        if (companyIds.length === 0 && companyNames.length === 0) {
          setAllServices([]);
          setAllServicesLoaded(true);
          zoneServicesCache.set(zid, { ts: now, services: [] });
          return;
        }

        const t0 = __DEV__ ? Date.now() : 0;

        const services: any[] = [];
        const seenServiceId = new Set<string>();

        const pushDocs = (snap: any) => {
          snap.forEach((doc: any) => {
            const id = String(doc.id || '').trim();
            if (!id || seenServiceId.has(id)) return;
            seenServiceId.add(id);
            services.push({ id, ...(doc.data() as any) });
          });
        };

        // Primary join: service_services.companyId in zoneCompanyIdsKey
        const batchSize = 10;
        for (let i = 0; i < companyIds.length; i += batchSize) {
          if (cancelled) return;
          const batch = companyIds.slice(i, i + batchSize);
          if (batch.length === 0) continue;
          try {
            const snap = await firestore()
              .collection('service_services')
              .where('companyId', 'in', batch)
              .get();
            pushDocs(snap);
          } catch (e) {
            if (__DEV__) console.log('[Services][ZoneSearchServices] companyId batch failed', e);
          }
        }

        // Fallback join by company name fields.
        const tryField = async (field: string) => {
          for (let i = 0; i < companyNames.length; i += batchSize) {
            if (cancelled) return;
            const batch = companyNames.slice(i, i + batchSize);
            if (batch.length === 0) continue;
            try {
              const snap = await firestore()
                .collection('service_services')
                .where(field, 'in', batch)
                .get();
              pushDocs(snap);
            } catch (e) {
              if (__DEV__) console.log(`[Services][ZoneSearchServices] '${field}' batch failed`, e);
            }
          }
        };

        if (services.length === 0 && companyNames.length > 0) {
          await tryField('companyName');
          if (services.length === 0) await tryField('company');
        }

        // Client-side filter for active services (avoid composite index requirements).
        const activeOnly = services.filter((s) => (s as any)?.isActive !== false);

        zoneServicesCache.set(zid, { ts: Date.now(), services: activeOnly });
        if (!cancelled) {
          setAllServices(activeOnly);
          setAllServicesLoaded(true);
        }

        if (__DEV__ && t0) {
          console.log(`[Services][ZoneSearchServices] storeId=${zid} services=${activeOnly.length} ms=${Date.now() - t0}`);
        }
      } catch {
        if (!cancelled) {
          setAllServices([]);
          setAllServicesLoaded(true);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [isSearchFocused, searchQuery, location?.storeId, zoneCompaniesLoading, zoneCompanyIdsKey, zoneCompanyNamesKey]);

  useEffect(() => {
    let mounted = true;
    const loadBanner = async () => {
      try {
        const raw = await AsyncStorage.getItem(SERVICE_CONFIRMED_BANNER_KEY);
        if (!raw) return;

        const payload = JSON.parse(raw);
        const razorpayOrderId = String(payload?.razorpayOrderId || "");
        const createdAt = Number(payload?.createdAt || 0);

        if (!razorpayOrderId || !Number.isFinite(createdAt)) {
          await AsyncStorage.removeItem(SERVICE_CONFIRMED_BANNER_KEY);
          return;
        }

        // Auto-expire after 1 hour to avoid stale banners.
        if (Date.now() - createdAt > 60 * 60 * 1000) {
          await AsyncStorage.removeItem(SERVICE_CONFIRMED_BANNER_KEY);
          return;
        }

        if (mounted) setServiceConfirmedBanner({ razorpayOrderId, createdAt });
      } catch {
        // ignore
      }
    };

    loadBanner();
    return () => {
      mounted = false;
    };
  }, []);

  const dismissServiceConfirmedBanner = useCallback(async () => {
    setServiceConfirmedBanner(null);
    await AsyncStorage.removeItem(SERVICE_CONFIRMED_BANNER_KEY);
  }, []);

  // (handleSearch / clearSearch are defined later near other handlers)

  // Manual refresh function
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Real-time listeners will automatically fetch fresh data
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  // Re-subscribe to listeners when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (__DEV__) console.log('📱 ServicesScreen focused - real-time listeners active');
      return () => {
        if (__DEV__) console.log('📱 ServicesScreen unfocused');

        // Stop banner auto-scroll when leaving the screen.
        if (bannerAutoScrollIntervalRef.current) {
          clearInterval(bannerAutoScrollIntervalRef.current);
          bannerAutoScrollIntervalRef.current = null;
        }
      };
    }, [])
  );

  // Real-time listener for service categories
  useEffect(() => {
    if (__DEV__) console.log('🔥 Setting up real-time listener for service categories...');
    setLoading(true);
    setError(null);

    // Load cached categories first (fast initial paint on Android).
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(CACHED_CATEGORIES_KEY);
        if (!raw) return;
        const payload = JSON.parse(raw);
        const ts = Number(payload?.ts || 0);
        const categories = Array.isArray(payload?.categories) ? payload.categories : [];
        const fresh = ts > 0 && (Date.now() - ts) < CACHED_CATEGORIES_TTL_MS;
        if (!fresh || categories.length === 0) return;

        // Only apply cache if we don't already have categories.
        setRawServiceCategories((prev) => {
          if (Array.isArray(prev) && prev.length > 0) return prev;
          return categories as ServiceCategory[];
        });
        setLoading(false);
      } catch {
        // ignore
      }
    })();

    const unsubscribe = firestore()
      .collection('app_categories')
      .where('isActive', '==', true)
      .onSnapshot(
        (snapshot) => {
          try {
            if (__DEV__) {
              console.log(`📊 Real-time categories: ${snapshot.size} active @ ${new Date().toLocaleTimeString()}`);
            }
            
            const allCategories: ServiceCategory[] = [];
            
            snapshot.forEach(doc => {
              const data = doc.data();
              const category = {
                id: doc.id,
                name: data.name || '',
                isActive: data.isActive || false,
                masterCategoryId: data.masterCategoryId,
                imageUrl: null,
                createdAt: data.createdAt,
                updatedAt: data.updatedAt,
              };
              allCategories.push(category);
            });

            // Sort by name
            allCategories.sort((a, b) => a.name.localeCompare(b.name));

            // Store raw categories immediately so the UI can render fast.
            // Populate images in the background to avoid blocking initial paint.
            const seq = ++categorySnapshotSeqRef.current;
            setRawServiceCategories(allCategories);
            setLoading(false);
            if (__DEV__) console.log('✅ Real-time categories updated (raw):', allCategories.length);

            FirestoreService.populateCategoryImages(allCategories)
              .then(() => {
                if (categorySnapshotSeqRef.current !== seq) return;
                // Trigger re-render with the now-populated imageUrl fields.
                setRawServiceCategories([...allCategories]);

                // Persist for next cold start.
                AsyncStorage.setItem(
                  CACHED_CATEGORIES_KEY,
                  JSON.stringify({ ts: Date.now(), categories: allCategories })
                ).catch(() => {});
              })
              .catch(() => {
                // ignore
              });
          } catch (error) {
            console.error('❌ Error processing real-time category update:', error);
            setError('Failed to load services. Pull down to refresh.');
            setServiceCategories([]);
            setRawServiceCategories([]);
            setLoading(false);
          }
        },
        (error) => {
          console.error('❌ Real-time listener error for categories:', error);
          setError('Connection lost. Pull down to refresh.');
          setServiceCategories([]);
          setRawServiceCategories([]);
          setLoading(false);
        }
      );

    // Cleanup listener on unmount
    return () => {
      if (__DEV__) console.log('🔥 Cleaning up service categories listener');
      unsubscribe();
    };
  }, []);

  // Filter categories using already-loaded active services category IDs.
  // Avoid blocking UI on an extra Firestore query.
  useEffect(() => {
    if (!Array.isArray(rawServiceCategories) || rawServiceCategories.length === 0) {
      setServiceCategories([]);
      return;
    }

    // If we don't have a deliverable zone or zone mapping yet, show none.
    const zoneIds = zoneCategoryIdsKey
      ? zoneCategoryIdsKey.split('|').filter(Boolean)
      : [];
    if (!location?.storeId || zoneIds.length === 0) {
      setServiceCategories([]);
      return;
    }

    const zoneSet = new Set(zoneIds);
    const zoneFiltered = rawServiceCategories.filter((category) => {
      const own = zoneSet.has(String(category.id));
      const master = category.masterCategoryId ? zoneSet.has(String(category.masterCategoryId)) : false;
      return own || master;
    });

    const ids = activeServiceCategoryIdsKey
      ? activeServiceCategoryIdsKey.split('|').filter(Boolean)
      : [];

    // While active services are still loading, show raw categories to keep the screen responsive.
    if (ids.length === 0) {
      setServiceCategories(zoneFiltered);
      return;
    }

    const activeSet = new Set(ids);
    const filtered = zoneFiltered.filter((category) => {
      const hasWorkersWithOwnId = activeSet.has(category.id);
      const hasWorkersWithMasterId = category.masterCategoryId
        ? activeSet.has(String(category.masterCategoryId))
        : false;
      return hasWorkersWithOwnId || hasWorkersWithMasterId;
    });

    if (__DEV__) {
      console.log(`✅ Categories shown: ${filtered.length}/${rawServiceCategories.length}`);
    }

    setServiceCategories(filtered);
  }, [activeServiceCategoryIdsKey, rawServiceCategories, zoneCategoryIdsKey, location?.storeId]);

  // NOTE: we intentionally do not subscribe to all active services.

  // Client-side service search (debounced) to avoid Firestore index errors and reduce load.
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      setSearchServices([]);
      return;
    }

    // IMPORTANT: search must respect delivery zone.
    // Categories are already filtered by zone; search results must not show services
    // from other zones just because they are active.
    const zid = String(location?.storeId || '').trim();
    const zoneReady = !!zid && !zoneCompaniesLoading && allServicesLoaded && visibleCategoryIdSet.size > 0;
    if (!zoneReady) {
      setSearchServices([]);
      return;
    }

    const t = setTimeout(() => {
      const raw = (allServices || [])
        .filter((s) => {
          if ((s as any)?.isActive === false) return false;

          const cat = String(
            (s as any)?.categoryMasterId ||
            (s as any)?.masterCategoryId ||
            (s as any)?.categoryId ||
            ''
          ).trim();
          // Only allow services for categories currently visible in this zone.
          if (!cat || !visibleCategoryIdSet.has(cat)) return false;

          const cid = String((s as any)?.companyId || '').trim();
          const cname = String((s as any)?.companyName || (s as any)?.company || '').trim();
          const matchesZone = (cid && zoneCompanyIdSet.has(cid)) || (cname && zoneCompanyNameSet.has(cname));
          // Company matching is an extra safety check; category filtering is the primary gate.
          if (!matchesZone) return false;
          return String(s?.name || '').toLowerCase().includes(q);
        });

      // Deduplicate ONLY direct-price services. If a service has packages, keep multiple
      // entries because packages/prices can differ by company.
      const seenDirect = new Set<string>();
      const deduped: any[] = [];

      for (const s of raw) {
        const hasPackages = Array.isArray((s as any)?.packages) && (s as any).packages.length > 0;
        if (hasPackages) {
          deduped.push(s);
          continue;
        }

        const nameKey = String((s as any)?.name || '').trim().toLowerCase();
        const catKey = String((s as any)?.categoryMasterId || (s as any)?.categoryId || '').trim();
        const key = `${catKey}::${nameKey}`;
        if (!nameKey) continue;
        if (seenDirect.has(key)) continue;
        seenDirect.add(key);
        deduped.push(s);
      }

      setSearchServices(deduped.slice(0, 25));
    }, 250);

    return () => clearTimeout(t);
  }, [searchQuery, allServices, location?.storeId, zoneCompaniesLoading, allServicesLoaded, zoneCompanyIdSet, zoneCompanyNameSet, visibleCategoryIdSet]);

  // Real-time listener for service banners
  useEffect(() => {
    if (__DEV__) console.log('🔥 Setting up real-time listener for service banners...');
    setBannersLoading(true);

    const unsubscribe = firestore()
      .collection('service_banners')
      .where('isActive', '==', true)
      .onSnapshot(
        (snapshot) => {
          if (__DEV__) {
            console.log(`📊 Real-time banners: ${snapshot.size} active @ ${new Date().toLocaleTimeString()}`);
          }
          
          const banners: ServiceBanner[] = [];
          
          snapshot.forEach(doc => {
            const data = doc.data();
            banners.push({
              id: doc.id,
              title: data.title || '',
              subtitle: data.subtitle,
              description: data.description,
              imageUrl: data.imageUrl,
              backgroundColor: data.backgroundColor,
              textColor: data.textColor,
              isActive: data.isActive || false,
              clickable: data.clickable,
              redirectType: data.redirectType,
              redirectUrl: data.redirectUrl,
              categoryId: data.categoryId,
              offerText: data.offerText,
              iconName: data.iconName,
              priority: data.priority || 0,
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
            });
          });

          // Sort by priority on client side (descending - highest priority first)
          banners.sort((a, b) => (b.priority || 0) - (a.priority || 0));

          setServiceBanners(banners);
          setBannersLoading(false);
          if (__DEV__) console.log('✅ Real-time banners updated:', banners.length);
        },
        (error) => {
          console.error('❌ Real-time listener error for banners:', error);
          setServiceBanners([]);
          setBannersLoading(false);
        }
      );

    // Cleanup listener on unmount
    return () => {
      if (__DEV__) console.log('🔥 Cleaning up service banners listener');
      unsubscribe();
    };
  }, []);

  // Non-blocking image prefetch (helps first paint/scroll feel faster).
  useEffect(() => {
    try {
      const urls: string[] = [];
      for (const b of serviceBanners || []) {
        const u = String((b as any)?.imageUrl || '').trim();
        if (u && (u.startsWith('http://') || u.startsWith('https://'))) urls.push(u);
      }
      for (const c of serviceCategories || []) {
        const u = String((c as any)?.imageUrl || '').trim();
        if (u && (u.startsWith('http://') || u.startsWith('https://'))) urls.push(u);
      }

      const unique = Array.from(new Set(urls)).slice(0, 20);
      const key = unique.join('|');
      if (!key || prefetchedUrlsRef.current === key) return;
      prefetchedUrlsRef.current = key;

      // expo-image exposes Image.prefetch, but TS typing varies across versions.
      const prefetch = (ExpoImage as any)?.prefetch;
      if (typeof prefetch === 'function') {
        prefetch(unique);
      }
    } catch {
      // ignore
    }
  }, [serviceBanners, serviceCategories]);

  // Real-time listener for live bookings
  useEffect(() => {
    if (__DEV__) console.log('🔥 Setting up real-time listener for live bookings...');

    const unsubscribe = firestore()
      .collection('service_bookings')
      .orderBy('createdAt', 'desc')
      .limit(15)
      .onSnapshot(
        (snapshot) => {
          if (__DEV__) {
            console.log(`📊 Real-time live bookings: ${snapshot.size} @ ${new Date().toLocaleTimeString()}`);
          }
          
          const bookings: LiveBooking[] = [];
          
          snapshot.forEach(doc => {
            const data = doc.data();
            bookings.push({
              id: doc.id,
              serviceName: data.serviceName || data.serviceTitle || 'Service',
              location: data.address?.city || data.address?.area || 'Your area',
              timestamp: data.createdAt,
            });
          });

          setLiveBookings(bookings);
          if (__DEV__) console.log('✅ Real-time bookings updated:', bookings.length);
        },
        (error) => {
          console.error('❌ Real-time listener error for bookings:', error);
          setLiveBookings([]);
        }
      );

    // Cleanup listener on unmount
    return () => {
      if (__DEV__) console.log('🔥 Cleaning up live bookings listener');
      unsubscribe();
    };
  }, []);

  // Auto-scroll banners with pause
  useEffect(() => {
    if (serviceBanners.length <= 1) return;

    const bannerWidth = width - 32;

    // Defensive: clear any previous interval (can happen if banner count changes)
    if (bannerAutoScrollIntervalRef.current) {
      clearInterval(bannerAutoScrollIntervalRef.current);
      bannerAutoScrollIntervalRef.current = null;
    }

    const interval = setInterval(() => {
      currentBannerIndex.current = (currentBannerIndex.current + 1) % serviceBanners.length;

      // Keep logs quiet; this runs frequently.
      // If you ever need it again, wrap it in __DEV__.
      // if (__DEV__) console.log('🔄 Banner auto-scroll - changing to index:', currentBannerIndex.current);
      
      // Update state immediately before scrolling
      setActiveBannerIndex(currentBannerIndex.current);
      
      if (bannerScrollRef.current) {
        bannerScrollRef.current.scrollToOffset({
          offset: currentBannerIndex.current * bannerWidth,
          animated: true,
        });
      }
    }, 4000);

    bannerAutoScrollIntervalRef.current = interval;

    return () => {
      clearInterval(interval);
      if (bannerAutoScrollIntervalRef.current === interval) {
        bannerAutoScrollIntervalRef.current = null;
      }
    };
  }, [serviceBanners.length]);

  // Auto-scroll live bookings with smooth continuous marquee effect
  useEffect(() => {
    if (liveBookings.length === 0) return;

    // iOS: this continuous scroll can keep a responder active and make the
    // rest of the screen feel "not clickable". Disable it on iOS.
    if (Platform.OS === 'ios') {
      return;
    }

    let animationFrameId: number;
    const scrollSpeed = 1; // Pixels per frame - increased from 0.5 to 1

    const smoothScroll = () => {
      if (liveBookingsScrollRef.current) {
        scrollX.current += scrollSpeed;
        
        liveBookingsScrollRef.current.scrollTo({
          x: scrollX.current,
          animated: false, // Use false for smooth continuous scroll
        });
      }
      
      animationFrameId = requestAnimationFrame(smoothScroll);
    };

    animationFrameId = requestAnimationFrame(smoothScroll);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [liveBookings.length]);

  const latestLiveBooking = React.useMemo(() => {
    if (!liveBookings?.length) return null;
    // Query is already orderBy createdAt desc, but keep it defensive.
    const sorted = [...liveBookings].sort((a, b) => {
      const aSec = (a as any)?.timestamp?.seconds ?? 0;
      const bSec = (b as any)?.timestamp?.seconds ?? 0;
      return bSec - aSec;
    });
    return sorted[0] || null;
  }, [liveBookings]);

  // Auto-switch GIFs with different durations for each GIF
  useEffect(() => {
    console.log('🎬 GIF Auto-switch started');
    let gifTimeout: ReturnType<typeof setTimeout>;
    
    const scheduleNextSwitch = (currentIndex: number) => {
      // ninjaVideo1.gif is longer, ninjaVideo.gif is shorter
      const duration = currentIndex === 0 ? 16000 : 5000; // 20s for first, 5s for second
      console.log(`🎬 Scheduling next switch in ${duration}ms for GIF index ${currentIndex}`);
      
      gifTimeout = setTimeout(() => {
        setActiveGifIndex((prevIndex) => {
          const newIndex = prevIndex === 0 ? 1 : 0;
          console.log('🎬 Switching GIF from', prevIndex, 'to', newIndex);
          scheduleNextSwitch(newIndex);
          return newIndex;
        });
      }, duration);
    };
    
    scheduleNextSwitch(0);

    return () => {
      console.log('🎬 GIF Auto-switch cleanup');
      if (gifTimeout) clearTimeout(gifTimeout);
    };
  }, []);

  // Blinking animation for View All button (light)
  useEffect(() => {
    const blinkAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, {
          toValue: 0.7,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(blinkAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    blinkAnimation.start();

    return () => {
      blinkAnimation.stop();
    };
  }, [blinkAnim]);

  // Blinking animation for live bookings
  useEffect(() => {
    const blinkAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(bookingBlinkAnim, {
          toValue: 0.6,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(bookingBlinkAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    blinkAnimation.start();

    return () => {
      blinkAnimation.stop();
    };
  }, [bookingBlinkAnim]);

  // Arrow movement animation for View All button
  useEffect(() => {
    const arrowAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(arrowAnim, {
          toValue: 5,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(arrowAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );

    arrowAnimation.start();

    return () => {
      arrowAnimation.stop();
    };
  }, [arrowAnim]);

  // Search functionality - simplified without useMemo to avoid React null error
  const getFilteredCategories = () => {
    if (!searchQuery.trim()) {
      return serviceCategories || [];
    }
    
    const query = searchQuery.toLowerCase().trim();
    return (serviceCategories || []).filter(category =>
      (category && category.name && category.name.toLowerCase().includes(query)) ||
      (category && category.name && category.name.toLowerCase().replace(/\s+/g, '').includes(query.replace(/\s+/g, '')))
    );
  };

  const filteredCategories = getFilteredCategories();

  const onServicePress = useCallback((svc: any) => {
    if (!svc?.id) return;
    const categoryId = String(svc.categoryId || svc.categoryMasterId || '');
    if (!categoryId) {
      console.log('❌ Service missing categoryId/categoryMasterId; cannot open flow', svc);
      return;
    }

    const hasPackages = Array.isArray(svc?.packages) && svc.packages.length > 0;

    setTapLoading({ visible: true, message: 'Opening…' });
    try {
      if (hasPackages) {
        // PackageSelectionScreen supports (serviceId + serviceName) to fetch only that
        // service’s packages.
        navigation.navigate('PackageSelection', {
          serviceTitle: svc.categoryName || svc.name || 'Service',
          categoryId,
          allCategories: serviceCategories,
          serviceId: svc.id,
          serviceName: svc.name || 'Service',
        } as any);
      } else {
        // Direct-price services should open the category service selection screen
        // so the user can pick the service and continue to CompanySelection -> SelectDateTime.
        navigation.navigate('ServiceCategory', {
          serviceTitle: svc.categoryName || 'Services',
          categoryId,
        } as any);
      }
    } catch (e) {
      console.log('❌ Failed to navigate from service search', e);
      setTapLoading({ visible: false });
    }
  }, [navigation, serviceCategories]);

  // Ensure we never leave the "Opening..." overlay stuck if navigation succeeds.
  useFocusEffect(
    useCallback(() => {
      return () => {
        setTapLoading({ visible: false });
      };
    }, [])
  );

  const handleCategoryPress = useCallback(async (category: ServiceCategory) => {
    if (__DEV__) console.log('🎯 Category clicked:', category.name, category.id);

    // Instant feedback so the user knows the tap registered.
    setTapLoading({ visible: true, message: 'Opening…' });
    
    // Check if category has packages
    let hasPackages = false;
    try {
      hasPackages = await FirestoreService.categoryHasPackages(category.id);
    } catch (e) {
      if (__DEV__) console.log('⚠️ categoryHasPackages failed:', e);
    }
    
    const navigationParams = {
      serviceTitle: category.name,
      categoryId: category.id,
      allCategories: serviceCategories,
    };
    
    if (hasPackages) {
      if (__DEV__) console.log('✅ Category has packages, navigating to PackageSelection');
      navigation.navigate("PackageSelection", navigationParams);
    } else {
      if (__DEV__) console.log('✅ Category has no packages, navigating directly to ServiceCategory');
      navigation.navigate("ServiceCategory", navigationParams);
    }
  }, [navigation, serviceCategories]);

  const handleViewAllCategories = useCallback(() => {
    setTapLoading({ visible: true, message: 'Loading…' });
    navigation.navigate('AllServices');
  }, [navigation]);

  const handleHistoryPress = useCallback(() => {
    setTapLoading({ visible: true, message: 'Loading…' });
    navigation.navigate('BookingHistory');
  }, [navigation]);

  useEffect(() => {
    // Rotate placeholder text only when user isn't interacting.
    if (isSearchFocused) return;
    if (searchQuery.trim().length > 0) return;

    const tick = () => {
      // Fade out then slide in from bottom.
      Animated.parallel([
        Animated.timing(placeholderOpacity, {
          toValue: 0,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(placeholderTranslateY, {
          toValue: -4,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setSearchPlaceholderIndex((prev) => (prev + 1) % SERVICES_SEARCH_PLACEHOLDERS.length);

        placeholderTranslateY.setValue(6);
        placeholderOpacity.setValue(0);

        Animated.parallel([
          Animated.timing(placeholderOpacity, {
            toValue: 1,
            duration: SERVICES_SEARCH_PLACEHOLDER_ANIM_MS,
            useNativeDriver: true,
          }),
          Animated.timing(placeholderTranslateY, {
            toValue: 0,
            duration: SERVICES_SEARCH_PLACEHOLDER_ANIM_MS,
            useNativeDriver: true,
          }),
        ]).start();
      });
    };

    // Start with an intro animation.
    placeholderTranslateY.setValue(6);
    placeholderOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(placeholderOpacity, {
        toValue: 1,
        duration: SERVICES_SEARCH_PLACEHOLDER_ANIM_MS,
        useNativeDriver: true,
      }),
      Animated.timing(placeholderTranslateY, {
        toValue: 0,
        duration: SERVICES_SEARCH_PLACEHOLDER_ANIM_MS,
        useNativeDriver: true,
      }),
    ]).start();

    const id = setInterval(tick, SERVICES_SEARCH_PLACEHOLDER_CYCLE_MS);

    return () => clearInterval(id);
  }, [isSearchFocused, placeholderOpacity, placeholderTranslateY, searchQuery]);

  const searchPlaceholderText = React.useMemo(() => {
    const word = SERVICES_SEARCH_PLACEHOLDERS[searchPlaceholderIndex] || 'services';
    return `Search for ${word}...`;
  }, [searchPlaceholderIndex]);

  const showAnimatedSearchPlaceholder = !isSearchFocused && searchQuery.trim().length === 0;

  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchServices([]);
    searchInputRef.current?.focus();
  }, []);

  // Data slices with null checks - Show only 6 categories in main view
  const listCategories = searchQuery 
    ? (filteredCategories || []).slice(0, 20) 
    : (serviceCategories || []).slice(0, 6);
  
  // Check if there are more categories to show
  const hasMoreCategories = !searchQuery && (serviceCategories || []).length > 6;

  // Render functions
  const renderBanner = React.useCallback(({ item: banner, index }: { item: ServiceBanner; index: number }) => {
    const backgroundColor = banner.backgroundColor || '#667eea';
    const textColor = banner.textColor || 'white';

    const onBannerPress = async () => {
      console.log('🎯 Banner clicked:', {
        title: banner.title,
        clickable: banner.clickable,
        redirectType: banner.redirectType,
        categoryId: banner.categoryId,
        serviceId: (banner as any).serviceId,
        companyId: (banner as any).companyId,
      });

      // If clickable is false, don't navigate
      if (banner.clickable === false) {
        console.log('⚠️ Banner is not clickable');
        return;
      }

      // Service-level deep link (preferred when present)
      // Banner doc example contains: serviceId, serviceName, companyId, categoryId...
      const bannerServiceId = (banner as any).serviceId as string | undefined;
      const bannerCompanyId = (banner as any).companyId as string | undefined;
      const bannerServiceName = (banner as any).serviceName as string | undefined;
      if (bannerServiceId && bannerCompanyId) {
        try {
          console.log('✅ Banner has serviceId; navigating to service flow', {
            bannerServiceId,
            bannerCompanyId,
          });

          // We navigate directly to the service checkout flow used elsewhere in the app.
          // NOTE: some stacks may require a different route name; this is the one used by ServiceCartScreen.
          navigation.navigate('ServiceCheckout', {
            serviceId: bannerServiceId,
            companyId: bannerCompanyId,
            serviceName: bannerServiceName || banner.title,
          } as any);
          return;
        } catch (e) {
          console.log('⚠️ Failed to navigate via serviceId banner deep link; falling back to category flow', e);
        }
      }

      // If categoryId exists, check for packages before navigating
      if (banner.categoryId) {
        const hasPackages = await FirestoreService.categoryHasPackages(banner.categoryId);
        
        const navigationParams = {
          serviceTitle: banner.title,
          categoryId: banner.categoryId,
          allCategories: serviceCategories,
        };
        
        if (hasPackages) {
          console.log('✅ Category has packages, navigating to PackageSelection');
          navigation.navigate("PackageSelection", navigationParams);
        } else {
          console.log('✅ Category has no packages, navigating to ServiceCategory');
          navigation.navigate("ServiceCategory", navigationParams);
        }
        return;
      }

      // Fallback to redirectType-based navigation
      if (banner.redirectType === "ServiceCategory" && banner.categoryId) {
        const hasPackages = await FirestoreService.categoryHasPackages(banner.categoryId);
        
        if (hasPackages) {
          navigation.navigate("PackageSelection", { 
            serviceTitle: banner.title,
            categoryId: banner.categoryId,
            allCategories: serviceCategories,
          });
        } else {
          navigation.navigate("ServiceCategory", { 
            serviceTitle: banner.title,
            categoryId: banner.categoryId,
            allCategories: serviceCategories,
          });
        }
      } else if (banner.redirectType === "AllServices") {
        navigation.navigate("AllServices");
      } else if (banner.redirectUrl) {
        console.log('Banner redirect URL:', banner.redirectUrl);
      } else {
        console.log('⚠️ No valid navigation target found for banner');
      }
    };

    return (
      <TouchableOpacity 
        key={banner.id}
        activeOpacity={banner.clickable === false ? 1 : 0.7}
        onPress={onBannerPress}
        style={styles.bannerItem}
        disabled={banner.clickable === false}
      >
        {banner.imageUrl ? (
          <View style={styles.bannerImage}>
            <ExpoImage
              source={{ uri: banner.imageUrl }}
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={150}
            />
            <View style={styles.bannerOverlay} pointerEvents="none">
              <View style={styles.bannerContent}>
                <View style={styles.bannerTextSection}>
                  {/* Tag at the top */}
                  {(banner as any).tag && (
                    <View style={styles.bannerTag}>
                      <Text style={styles.bannerTagText}>{(banner as any).tag}</Text>
                    </View>
                  )}
                  <Text style={[styles.bannerTitle, { color: textColor }]}>
                    {banner.title}
                  </Text>
                  {banner.subtitle && (
                    <Text style={[styles.bannerSubTitle, { color: textColor }]}>
                      {banner.subtitle}
                    </Text>
                  )}
                  {banner.offerText && (
                    <View style={styles.bannerOffer}>
                      <Text style={styles.offerText}>{banner.offerText}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>
        ) : (
          <LinearGradient
            colors={[backgroundColor, backgroundColor + 'CC']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientBanner}
          >
            <View style={styles.bannerContent}>
              <View style={styles.bannerTextSection}>
                {/* Tag at the top */}
                {(banner as any).tag && (
                  <View style={styles.bannerTag}>
                    <Text style={styles.bannerTagText}>{(banner as any).tag}</Text>
                  </View>
                )}
                <Text style={[styles.bannerTitle, { color: textColor }]}>
                  {banner.title}
                </Text>
                {banner.subtitle && (
                  <Text style={[styles.bannerSubTitle, { color: textColor }]}>
                    {banner.subtitle}
                  </Text>
                )}
                {banner.offerText && (
                  <View style={styles.bannerOffer}>
                    <Text style={styles.offerText}>{banner.offerText}</Text>
                  </View>
                )}
              </View>
            </View>
          </LinearGradient>
        )}
      </TouchableOpacity>
    );
  }, [navigation, serviceCategories]);

  // NOTE: renderBanner intentionally depends on serviceCategories via outer scope.
  // This file has a few legacy hook-deps warnings; we keep behavior as-is.

  const renderListItem = useCallback(({ item, index }: { item: ServiceCategory; index: number }) => {
    if (!item || !item.name) return null; // Safety check
    
    const categoryStyle = getCategoryStyle(item.name, index);
    return (
      <TouchableOpacity
        style={styles.gridCard}
        activeOpacity={0.7}
        onPress={() => handleCategoryPress(item)}
      >
        <View style={styles.gridMedia}>
          <View style={[styles.gridIconContainer, { backgroundColor: categoryStyle.bgColor }]}>
            {item.imageUrl ? (
              <ExpoImage
                source={{ uri: item.imageUrl }}
                style={styles.gridCategoryImage}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={150}
                onError={(e) => {
                  if (__DEV__) {
                    console.log(`⚠️ Failed to load image for ${item.name}`, {
                      url: item.imageUrl,
                      error: (e as any)?.nativeEvent,
                    });
                  }
                }}
              />
            ) : (
              <Ionicons 
                name={categoryStyle.icon as any} 
                size={36} 
                color={categoryStyle.color} 
              />
            )}
          </View>
        </View>

        <View style={styles.gridInfo}>
          <Text style={styles.gridTitle} numberOfLines={2}>{item.name}</Text>
        </View>
      </TouchableOpacity>
    );
  }, [handleCategoryPress]);

  const renderServiceListItem = useCallback(({ item }: { item: any }) => {
    if (!item) return null;
    return (
      <TouchableOpacity
        style={styles.searchServiceRow}
        activeOpacity={0.7}
        onPress={() => onServicePress(item)}
      >
        <View style={styles.searchServiceLeft}>
          <View style={styles.searchServiceIcon}>
            <Ionicons name="briefcase-outline" size={18} color="#0f172a" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.searchServiceTitle} numberOfLines={1}>
              {String(item.name || 'Service')}
            </Text>
            {!!item.categoryName && (
              <Text style={styles.searchServiceSub} numberOfLines={1}>
                {String(item.categoryName)}
              </Text>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
      </TouchableOpacity>
    );
  }, [onServicePress]);

  const StickyHeaderUI = React.useMemo(() => {
    return (
      <Animated.View
        style={[
          styles.stickyHeaderWrapper,
          {
            paddingTop: headerTopPadding,
            height: SERVICES_STICKY_HEADER_HEIGHT,
          },
        ]}
        pointerEvents="box-none"
      >
        <StatusBar barStyle="light-content" backgroundColor="#ffffff" />

        {/* Scroll background (BEHIND the GIF, not on top of it) */}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, { opacity: headerGradientOpacity }]}
        >
          <LinearGradient
            colors={[...SERVICES_HEADER_GRADIENT_COLORS]}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>

        {/* Background media (GIF) */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.stickyHeaderMediaLayer,
            { height: headerMediaHeight, opacity: headerMediaOpacity },
          ]}
        >
          <ImageBackground
            key={`gif-${activeGifIndex}`}
            source={HEADER_GIFS[activeGifIndex]}
            style={StyleSheet.absoluteFillObject}
            resizeMode="contain"
          />
        </Animated.View>

        <View style={styles.stickyHeaderContent} pointerEvents="box-none">

          <View style={styles.headerRow}>
            {/* Location row (always visible) */}
            <TouchableOpacity
              style={[styles.locationRow, styles.locationRowHeader]}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('LocationSelector', { fromScreen: 'Services' })}
            >
              <View style={styles.locationRowLeft}>
                <Ionicons name="location-outline" size={18} color="#00b4a0" />
                <Text style={[styles.locationRowText, styles.locationRowTextHeader]} numberOfLines={1}>
                  {hasSelectedLocation
                    ? `Delivering to ${locationDisplayText}`
                    : 'Set delivery location'}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={16} color="#64748b" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleHistoryPress}
              activeOpacity={0.8}
              style={styles.historyIconButton}
              accessibilityLabel="Booking history"
            >
              <Ionicons name="reader-outline" size={18} color="#0f172a" />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={[styles.searchContainer, styles.searchContainerHeader]}>
            <View style={styles.searchHeaderRow}>
              <View style={[styles.searchBar, styles.searchBarHeader, isSearchFocused && styles.searchBarFocused]}>
                <Ionicons name="search" size={20} color="#00b4a0" style={styles.searchIcon} />
                <View style={styles.searchInputWrap}>
                  {showAnimatedSearchPlaceholder && (
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        styles.searchPlaceholderOverlayWrap,
                        { opacity: placeholderOpacity, transform: [{ translateY: placeholderTranslateY }] },
                      ]}
                    >
                      <Text style={styles.searchPlaceholderOverlayText} numberOfLines={1}>
                        {searchPlaceholderText}
                      </Text>
                    </Animated.View>
                  )}
                  <TextInput
                    ref={searchInputRef}
                    style={styles.searchInput}
                    placeholder={isSearchFocused ? 'Search for services...' : ''}
                    placeholderTextColor="#94a3b8"
                    value={searchQuery}
                    onChangeText={handleSearch}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setIsSearchFocused(false)}
                    returnKeyType="search"
                    autoCapitalize="none"
                    autoCorrect={false}
                    underlineColorAndroid="transparent"
                    selectionColor="#00b4a0"
                    cursorColor="#00b4a0"
                  />
                </View>
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
                    <Ionicons name="close-circle" size={20} color="#cbd5e1" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Spacer so search width matches location (which shares row with History) */}
              <View pointerEvents="none" style={styles.headerRightSpacer} />
            </View>
          </View>
        </View>
      </Animated.View>
    );
  }, [activeGifIndex, clearSearch, handleHistoryPress, handleSearch, hasSelectedLocation, headerGradientOpacity, headerMediaHeight, headerMediaOpacity, headerTopPadding, isSearchFocused, locationDisplayText, navigation, placeholderOpacity, placeholderTranslateY, searchPlaceholderText, searchQuery, showAnimatedSearchPlaceholder]);

  const ListHeaderUI = React.useMemo(() => {
    return (
      <View>
        {/* Show search results header when searching */}
        {searchQuery.length > 0 && (
          <View style={styles.searchResultsHeader}>
            <Text style={styles.searchResultsText}>
              {(filteredCategories || []).length + (searchServices || []).length} result{((filteredCategories || []).length + (searchServices || []).length) !== 1 ? 's' : ''} found
            </Text>
          </View>
        )}

        {/* Only show banner when not searching */}
        {searchQuery.length === 0 && (
          <>
            {/* Service Banners */}
            {!bannersLoading && serviceBanners.length > 0 && (
              <View style={styles.bannerContainer}>
                <FlatList
                  ref={bannerScrollRef}
                  data={serviceBanners}
                  renderItem={renderBanner}
                  keyExtractor={(item) => item.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.bannerScrollContent}
                  snapToInterval={width - 32}
                  decelerationRate="fast"
                  pagingEnabled={false}
                  onMomentumScrollEnd={(event) => {
                    const index = Math.round(event.nativeEvent.contentOffset.x / (width - 32));
                    setActiveBannerIndex(index);
                  }}
                />

                {/* Pagination Dots */}
                {serviceBanners.length > 1 && (
                  <View style={styles.paginationContainer}>
                    {serviceBanners.map((_, index) => (
                      <View
                        key={index}
                        style={[
                          styles.paginationDot,
                          index === activeBannerIndex && styles.paginationDotActive
                        ]}
                      />
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* All Services List Header with View All Button */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>All Services</Text>
              {hasMoreCategories && (
                <TouchableOpacity
                  style={styles.viewAllButtonInline}
                  onPress={handleViewAllCategories}
                  activeOpacity={0.7}
                >
                  <Text style={styles.viewAllTextInline}>View All</Text>
                  <Animated.View style={{ transform: [{ translateX: arrowAnim }] }}>
                    <Ionicons name="arrow-forward" size={14} color="#00b4a0" />
                  </Animated.View>
                </TouchableOpacity>
              )}
            </View>

            {/* Live Updates Section */}
            <View style={styles.liveUpdatesContainer}>
              <View style={styles.liveUpdatesHeader}>
                <Animated.View style={[styles.liveIndicator, { opacity: bookingBlinkAnim }]}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>Live Bookings</Text>
                </Animated.View>
              </View>
              <View style={styles.liveUpdatesWrapper}>
                {latestLiveBooking ? (
                  <Animated.View style={[styles.liveUpdateCard, { opacity: bookingBlinkAnim }]}>
                    <View style={styles.liveUpdateCardLeft}>
                      <View style={styles.liveUpdateDot} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.liveUpdateCardTitle} numberOfLines={1}>
                          {latestLiveBooking.serviceName}
                        </Text>
                        <Text style={styles.liveUpdateCardSubtitle} numberOfLines={1}>
                          Booked in {latestLiveBooking.location}
                        </Text>
                      </View>
                    </View>
                  </Animated.View>
                ) : (
                  <View style={styles.liveUpdateCard}>
                    <View style={styles.liveUpdateCardLeft}>
                      <View style={[styles.liveUpdateDot, { backgroundColor: '#cbd5e1' }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.liveUpdateCardTitle} numberOfLines={1}>
                          No live bookings
                        </Text>
                        <Text style={styles.liveUpdateCardSubtitle} numberOfLines={1}>
                          No active bookings right now
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
              </View>
            </View>
          </>
        )}

        {/* Search results (services only). Categories are shown in the main grid list below. */}
        {searchQuery.length > 0 && (searchServices || []).length > 0 && (
          <View style={styles.searchResultsCard}>
            <Text style={styles.searchSectionTitle}>Services</Text>
            <FlatList
              data={searchServices}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderServiceListItem}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={styles.searchDivider} />}
            />
          </View>
        )}
      </View>
    );
  }, [searchQuery, filteredCategories, searchServices, bannersLoading, serviceBanners, renderBanner, activeBannerIndex, hasMoreCategories, arrowAnim, bookingBlinkAnim, handleViewAllCategories, latestLiveBooking, renderServiceListItem]);

  return (
    <ImageBackground
      source={require('../assets/serviceBG.png')}
      style={styles.container}
      resizeMode="cover"
      blurRadius={3}
    >
      {StickyHeaderUI}
      {serviceConfirmedBanner && (
        <View style={styles.serviceConfirmedBanner}>
          <View style={styles.serviceConfirmedBannerLeft}>
            <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
            <Text style={styles.serviceConfirmedBannerText}>
              Service booking confirmed
            </Text>
          </View>
          <TouchableOpacity
            onPress={dismissServiceConfirmedBanner}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={18} color="#ffffff" />
          </TouchableOpacity>
        </View>
      )}
      {tapLoading.visible && (
        <View style={styles.tapLoadingOverlay} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.tapLoadingCard}
            activeOpacity={1}
            onPress={() => setTapLoading({ visible: false })}
          >
            <ActivityIndicator size="small" color="#00b4a0" />
            <Text style={styles.tapLoadingText}>{tapLoading.message || 'Opening…'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Add safety check for initial render */}
      {!serviceCategories && isLoading ? (
        <View style={styles.emptyLoadingContainer}>
          <ActivityIndicator size="large" color="#00b4a0" />
          <Text style={styles.emptyLoadingText}>Loading services...</Text>
        </View>
      ) : (
        <Animated.FlatList
          data={isLoading ? [] : (listCategories || [])}
          keyExtractor={(item, index) => item?.id || `item-${index}`}
          ListHeaderComponent={ListHeaderUI}
          renderItem={renderListItem}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          key="two-columns"
          ListFooterComponent={null}
          ListEmptyComponent={
            isLoading ? (
              <View style={styles.emptyLoadingContainer}>
                <ActivityIndicator size="large" color="#00b4a0" />
                <Text style={styles.emptyLoadingText}>Loading services...</Text>
              </View>
            ) : error ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="cloud-offline-outline" size={48} color="#ef4444" style={styles.emptyIcon} />
                <Text style={styles.emptyText}>{error}</Text>
              </View>
            ) : searchQuery.length > 0 && (filteredCategories || []).length === 0 && (searchServices || []).length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="search" size={48} color="#cbd5e1" style={styles.emptyIcon} />
                <Text style={styles.emptyText}>No services found</Text>
                <Text style={styles.emptySubText}>Try different keywords</Text>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No services available</Text>
              </View>
            )
          }
          contentContainerStyle={{ paddingTop: SERVICES_STICKY_HEADER_HEIGHT, paddingBottom: 30 }}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#00b4a0', '#00d2c7']}
              tintColor="#00b4a0"
            />
          }
          removeClippedSubviews={false}
          maxToRenderPerBatch={10}
          windowSize={10}
          initialNumToRender={searchQuery ? 20 : 6}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="on-drag"
          nestedScrollEnabled
        />
      )}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fdfdfd",
  },

  serviceConfirmedBanner: {
    position: "absolute",
    top: Platform.OS === "android" ? 44 : 54,
    left: 12,
    right: 12,
    zIndex: 1200,
    elevation: 1200,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#0d9488",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
  },
  serviceConfirmedBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    paddingRight: 10,
  },
  serviceConfirmedBannerText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },

  tapLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    elevation: 999,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.08)",
  },

  tapLoadingCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },

  tapLoadingText: {
    marginLeft: 10,
    fontSize: 14,
    color: "#0f172a",
    fontWeight: "600",
  },

  // Header Styles
  stickyHeaderWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 1000,
    overflow: 'hidden',
  },

  stickyHeaderMediaLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#f8fafc',
  },

  stickyHeaderContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 10,
    justifyContent: 'flex-start',
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  locationRowHeader: {
    marginTop: 4,
    marginHorizontal: 0,
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderColor: 'rgba(226,232,240,0.85)',
  },

  locationRow: {
    marginTop: 10,
    marginHorizontal: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.9)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  locationRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 8,
    paddingRight: 10,
  },
  locationRowText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },

  locationRowTextHeader: {
    color: '#0f172a',
  },

  headerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.1)",
    justifyContent: "flex-end",
  },

  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 50,
  },

  historyButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#0F172A",
    
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },

  historyButtonText: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "800",
  },

  // Search Bar Styles
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#fdfdfd",
  },

  searchContainerHeader: {
    paddingHorizontal: 0,
    paddingVertical: 4,
    backgroundColor: 'transparent',
  },

  searchHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  headerRightSpacer: {
    width: 42,
    marginLeft: 10,
  },

  searchBarHeader: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },

  searchBarFocused: {
    borderColor: "#00b4a0",
    elevation: 4,
    shadowOpacity: 0.1,
  },

  searchIcon: {
    marginRight: 12,
  },

  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#1e293b",
    fontWeight: "400",
    backgroundColor: 'transparent',
    paddingVertical: 0,
    paddingHorizontal: 0,
    textAlignVertical: 'center',
    includeFontPadding: false,
    minHeight: 20,
    lineHeight: 20,
  },

  searchInputWrap: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
    minHeight: 24,
  },

  searchPlaceholderOverlayWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 0,
  },

  searchPlaceholderOverlayText: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '400',
    includeFontPadding: false,
  },

  clearButton: {
    padding: 4,
    marginLeft: 8,
  },

  historyIconButton: {
    marginLeft: 10,
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.85)',
    backgroundColor: 'rgba(255,255,255,0.82)',
  },

  searchResultsCard: {
    marginHorizontal: 16,
    marginTop: 6,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  searchSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 10,
  },

  searchDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 8,
  },

  searchEmptyText: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    paddingVertical: 8,
  },

  searchServiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
  },

  searchServiceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingRight: 10,
  },

  searchServiceIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e2e8f0',
  },

  searchServiceTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },

  searchServiceSub: {
    marginTop: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },

  searchResultsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#f8fafc",
  },

  searchResultsText: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
  },

  // Banner Styles
  bannerContainer: {
    paddingVertical: 16,
  },

  bannerScrollContent: {
    paddingHorizontal: 16,
  },

  paginationContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
    gap: 6,
  },

  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#cbd5e1",
  },

  paginationDotActive: {
    width: 8,
    height: 8,
    backgroundColor: "#00b4a0",
  },

  bannerItem: {
    width: width - 48,
    marginHorizontal: 8,
  },

  gradientBanner: {
    borderRadius: 16,
    overflow: "hidden",
    height: 160,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },

  bannerImage: {
    width: "100%",
    height: 160,
    borderRadius: 16,
    overflow: "hidden",
  },

  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 16,
  },

  bannerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    height: "100%",
  },

  bannerTextSection: {
    flex: 1,
  },

  bannerTitle: {
    color: "white",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 6,
  },

  bannerSubTitle: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 18,
    marginBottom: 10,
  },

  bannerOffer: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "flex-start",
  },

  offerText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },

  bannerTag: {
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginBottom: 10,
  },

  bannerTagText: {
    color: "#00b4a0",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },

  // Section Styles
  sectionContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
    marginTop: 8,
  },

  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 12,
    marginTop: 8,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
  },

  viewAllButtonInline: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#00b4a0",
    gap: 4,
  },

  viewAllTextInline: {
    color: "#00b4a0",
    fontSize: 13,
    fontWeight: "600",
  },

  // Live Updates Styles
  liveUpdatesContainer: {
    paddingVertical: 12,
    // backgroundColor: "#f8fafc",
    backgroundColor: "white",
    marginBottom: 16,
  },

  liveUpdatesHeader: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },

  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ef4444",
    shadowColor: "#ef4444",
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 4,
  },

  liveText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },

  liveUpdatesWrapper: {
    overflow: "hidden",
  },

  liveUpdatesScroll: {
    paddingHorizontal: 16,
    flexDirection: "row",
  },

  liveUpdateItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 40,
    gap: 8,
  },

  liveUpdateDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#00b4a0",
  },

  liveUpdateSimpleText: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "400",
  },

  liveUpdateLocation: {
    color: "#00b4a0",
    fontWeight: "500",
  },

  liveUpdateCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    marginRight: 10,
    minWidth: 270,
  },

  liveUpdateCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },

  liveUpdateCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },

  liveUpdateCardSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },

  liveUpdateText: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "400",
  },

  liveUpdateBold: {
    fontWeight: "600",
    color: "#0f172a",
  },

  // Grid Styles (2 columns)
  gridRow: {
    paddingHorizontal: 16,
    justifyContent: "space-between",
    marginBottom: 16,
  },

  gridCard: {
    width: (width - 48) / 2,
    backgroundColor: "white",
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    overflow: 'hidden',
  },

  gridMedia: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
    paddingBottom: 10,
  },

  gridIconContainer: {
    width: '100%',
    height: 108,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  gridCategoryImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },

  gridInfo: {
    width: '100%',
    paddingHorizontal: 6,
    paddingBottom: 10,
  },

  gridTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
    textAlign: "center",
  },

  // Loading and Empty States
  emptyLoadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },

  emptyLoadingText: {
    marginTop: 16,
    fontSize: 15,
    color: "#00b4a0",
    fontWeight: "500",
  },

  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    paddingHorizontal: 48,
  },

  emptyText: {
    fontSize: 16,
    color: "#64748b",
    fontWeight: "600",
    textAlign: "center",
  },

  emptySubText: {
    fontSize: 13,
    color: "#94a3b8",
    fontWeight: "400",
    textAlign: "center",
    marginTop: 8,
  },

  emptyIcon: {
    marginBottom: 16,
    alignSelf: "center",
    color: "#cbd5e1",
  },

});
