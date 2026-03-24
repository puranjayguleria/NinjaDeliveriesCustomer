import { useLocationContext } from "../../context/LocationContext";
import { useToggleContext } from "../../context/ToggleContext";
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
import { useIsFocused } from "@react-navigation/native";
import { Ionicons } from '@expo/vector-icons';
import { FirestoreService, ServiceCategory, ServiceBanner } from "../../services/firestoreService";
import { firestore } from "../../firebase.native";
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

// Header images array
const HEADER_IMAGES = [
  require("../../assets/ninjaServicebanner1.png"),
  require("../../assets/ninjaServicebanner2.png"),
  require("../../assets/ninjaServicebanner3.png"),
];

const SERVICES_HEADER_MEDIA_HEIGHT = 280;
const SERVICES_HEADER_MEDIA_COLLAPSED_HEIGHT = 120;
const SERVICES_HEADER_PADDING_TOP_INITIAL = Platform.OS === 'ios' ? 52 : 40;
const SERVICES_HEADER_PADDING_TOP_COLLAPSED = Platform.OS === 'ios' ? 44 : 32;
// Solid, very light + friendly header colors (no transparency).
// Soft off-white to a subtle mint/teal tint feels calmer during scroll.
const SERVICES_HEADER_GRADIENT_COLORS = ['#d3d3d3ff', '#f0fdfa'] as const;
// Sticky header should only reserve space until the search bar (not the full media height).
// Keep this compact; history is inline with the search bar.
const SERVICES_STICKY_HEADER_HEIGHT = Platform.OS === 'ios' ? 280 : 265;

const SERVICES_SEARCH_PLACEHOLDERS = [
  'plumber',
  'car wash',
  'automobile washing',
  'home cleaning',
  'astrology',
  'physiotherapy',
] as const;

const SERVICES_SEARCH_PLACEHOLDER_CYCLE_MS = 4000;
const SERVICES_SEARCH_PLACEHOLDER_ANIM_MS = 240;

export default function ServicesScreen() {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const { location } = useLocationContext();
  const { activeMode, setActiveMode } = useToggleContext();

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

  const locationRowOpacity = React.useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [0, 60],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      }),
    [scrollY]
  );

  const toggleRowOpacity = React.useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [0, 40],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      }),
    [scrollY]
  );

  const toggleRowHeight = React.useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [0, 40],
        outputRange: [50, 0],
        extrapolate: 'clamp',
      }),
    [scrollY]
  );

  const searchBarTranslateY = React.useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [0, 80],
        outputRange: [0, -50],
        extrapolate: 'clamp',
      }),
    [scrollY]
  );

  const stickyHeaderHeight = React.useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [0, 80],
        outputRange: [SERVICES_STICKY_HEADER_HEIGHT, 130],
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
  const [activeGifIndex] = useState(0); // kept for useMemo dep compatibility
  const [activeHeaderImageIndex, setActiveHeaderImageIndex] = useState(0);
  const searchInputRef = React.useRef<TextInput>(null);
  const bannerScrollRef = React.useRef<FlatList>(null);
  const liveBookingsScrollRef = React.useRef<ScrollView>(null);
  const currentBannerIndex = React.useRef(0);
  const bannerAutoScrollIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const headerImageAutoScrollIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  // const currentBookingIndex = React.useRef(0);
  const scrollX = React.useRef(0);
  const blinkAnim = React.useRef(new Animated.Value(1)).current;
  const bookingBlinkAnim = React.useRef(new Animated.Value(1)).current;
  const liveDotBlinkAnim = React.useRef(new Animated.Value(1)).current;
  const arrowAnim = React.useRef(new Animated.Value(0)).current;
  const [randomServices, setRandomServices] = useState<any[]>([]);
  const [plumberServices, setPlumberServices] = useState<any[]>([]);
  const [automobileWashingServices, setAutomobileWashingServices] = useState<any[]>([]);
  const [homeCleaningServices, setHomeCleaningServices] = useState<any[]>([]);

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

  // Check if services are enabled for this store
  useEffect(() => {
    if (location?.services === false) {
      Alert.alert(
        "Service Unavailable",
        "Services are not available at this location.",
        [
          {
            text: "Change Location",
            onPress: () => navigation.navigate("LocationSelector"),
          },
          {
            text: "Go Back",
            onPress: () => navigation.goBack(),
            style: "cancel",
          },
        ]
      );
    }
  }, [location?.services, navigation]);

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
        
        // Stop header image auto-scroll when leaving the screen.
        if (headerImageAutoScrollIntervalRef.current) {
          clearInterval(headerImageAutoScrollIntervalRef.current);
          headerImageAutoScrollIntervalRef.current = null;
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
          const seenBookings = new Set<string>();
          
          snapshot.forEach(doc => {
            const data = doc.data();
            const serviceName = data.serviceName || data.serviceTitle || 'Service';
            const location = data.address?.city || data.address?.area || 'Your area';
            
            // Create unique key based on service name and location
            const uniqueKey = `${serviceName}-${location}`;
            
            // Only add if not already seen
            if (!seenBookings.has(uniqueKey)) {
              seenBookings.add(uniqueKey);
              bookings.push({
                id: doc.id,
                serviceName: serviceName,
                location: location,
                timestamp: data.createdAt,
              });
            }
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

  // Auto-scroll header images every 10 seconds
  useEffect(() => {
    if (!isFocused) return;

    // Clear any previous interval
    if (headerImageAutoScrollIntervalRef.current) {
      clearInterval(headerImageAutoScrollIntervalRef.current);
      headerImageAutoScrollIntervalRef.current = null;
    }

    const interval = setInterval(() => {
      setActiveHeaderImageIndex((prev) => (prev + 1) % HEADER_IMAGES.length);
    }, 10000); // 10 seconds

    headerImageAutoScrollIntervalRef.current = interval;

    return () => {
      clearInterval(interval);
      if (headerImageAutoScrollIntervalRef.current === interval) {
        headerImageAutoScrollIntervalRef.current = null;
      }
    };
  }, [isFocused]);

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

  // Auto-cycle through live bookings vertically (one by one)
  const [currentBookingIndex, setCurrentBookingIndex] = useState(0);
  const [shouldBlinkBooking, setShouldBlinkBooking] = useState(false);
  const bookingTransitionAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (liveBookings.length <= 1) return;

    const interval = setInterval(() => {
      // Slide up animation
      Animated.timing(bookingTransitionAnim, {
        toValue: -24,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        // Change booking
        setCurrentBookingIndex((prevIndex) => 
          (prevIndex + 1) % liveBookings.length
        );
        // Reset position to bottom and slide up
        bookingTransitionAnim.setValue(24);
        Animated.timing(bookingTransitionAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }, 3000); // Change booking every 3 seconds

    return () => clearInterval(interval);
  }, [liveBookings.length, bookingTransitionAnim]);

  // Trigger blink only when new bookings are added
  useEffect(() => {
    if (liveBookings.length > 0) {
      setShouldBlinkBooking(true);
    }
  }, [liveBookings.length]);

  const latestLiveBooking = React.useMemo(() => {
    if (!liveBookings?.length) return null;
    return liveBookings[currentBookingIndex] || liveBookings[0];
  }, [liveBookings, currentBookingIndex]);

  // Fetch random packages for modal cards
  useEffect(() => {
    const fetchRandomPackages = async () => {
      try {
        const snap = await firestore()
          .collection('service_services')
          .where('isActive', '==', true)
          .limit(150)
          .get();

        const packagesWithService: any[] = [];
        snap.forEach((doc) => {
          const data = doc.data() as any;
          if (Array.isArray(data?.packages) && data.packages.length > 0) {
            // For each package, store it with service details
            data.packages.forEach((pkg: any, index: number) => {
              packagesWithService.push({
                id: `${doc.id}_${index}`,
                serviceId: doc.id,
                serviceName: data.name || 'Service',
                categoryName: data.categoryName,
                companyName: data.companyName,
                companyId: data.companyId,
                categoryId: data.categoryId || data.categoryMasterId,
                package: pkg,
                allPackages: data.packages,
                // Booking count for trending packages (most booked)
                bookingCount: data.bookingCount || pkg.bookingCount || 0,
                // Rating for highest rated packages
                rating: data.rating || pkg.rating || 0,
              });
            });
          }
        });

        // Sort by booking count (descending) to show most booked packages first
        const sorted = packagesWithService.sort((a, b) => (b.bookingCount || 0) - (a.bookingCount || 0));
        
        // Show only 3-4 most booked packages in Trending Packages section
        setRandomServices(sorted.slice(0, 4));
      } catch (e) {
        if (__DEV__) console.log('Failed to fetch random packages:', e);
      }
    };

    fetchRandomPackages();
  }, []);

  // Fetch Plumber services (same logic as ServiceCategoryScreen)
  useEffect(() => {
    const fetchPlumberServices = async () => {
      try {
        console.log('🔧 Fetching Plumber services...');

        const zid = String(location?.storeId || '').trim();
        if (!zid) {
          console.log('❌ No zone selected');
          return;
        }

        // Get zone companies first
        const zoneCompanyIds = zoneCompanyIdsKey
          ? zoneCompanyIdsKey.split('|').map((s) => String(s).trim()).filter(Boolean)
          : [];
        
        const zoneCompanyNames = zoneCompanyNamesKey
          ? zoneCompanyNamesKey.split('|').map((s) => String(s).trim()).filter(Boolean)
          : [];

        if (zoneCompanyIds.length === 0 && zoneCompanyNames.length === 0) {
          console.log('❌ No companies available in this zone');
          return;
        }

        const zoneCompanyIdSet = new Set(zoneCompanyIds);
        const zoneCompanyNameSet = new Set(zoneCompanyNames);

        // First, find the Plumber category
        const categorySnap = await firestore()
          .collection('app_categories')
          .where('isActive', '==', true)
          .get();

        let plumberCategoryId = '';
        let plumberMasterCategoryId = '';
        
        categorySnap.forEach((doc) => {
          const data = doc.data();
          const name = String(data?.name || '').toLowerCase();
          if (name.includes('plumb')) {
            plumberCategoryId = doc.id;
            plumberMasterCategoryId = data?.masterCategoryId || doc.id;
            console.log(`✅ Found Plumber category:`);
            console.log(`   - categoryId: ${doc.id}`);
            console.log(`   - categoryName: ${data?.name}`);
            console.log(`   - masterCategoryId: ${plumberMasterCategoryId}`);
          }
        });

        if (!plumberCategoryId) {
          if (__DEV__) console.log('❌ Plumber category not found');
          return;
        }

        // Fetch services using categoryMasterId (same as ServiceCategoryScreen)
        console.log(`🔍 Querying service_services where categoryMasterId == "${plumberMasterCategoryId}"`);
        
        const servicesSnapshot = await firestore()
          .collection('service_services')
          .where('categoryMasterId', '==', plumberMasterCategoryId)
          .get();

        console.log(`📊 Found ${servicesSnapshot.size} plumber services`);

        const plumberServicesData: any[] = [];
        
        servicesSnapshot.forEach(doc => {
          const data = doc.data();
          
          // Check if company is active in this zone
          const companyId = String(data?.companyId || '').trim();
          const companyName = String(data?.companyName || '').trim();
          
          const isCompanyInZone = 
            (companyId && zoneCompanyIdSet.has(companyId)) ||
            (companyName && zoneCompanyNameSet.has(companyName));
          
          if (!isCompanyInZone) {
            console.log(`⏭️ Skipping service "${data.name}" - company not in zone`);
            return;
          }

          plumberServicesData.push({
            id: doc.id,
            name: data.name || '',
            imageUrl: data.imageUrl || null,
            price: data.price,
            packages: data.packages || [],
            categoryId: plumberCategoryId,
            categoryMasterId: plumberMasterCategoryId,
            companyId: data.companyId,
            companyName: data.companyName,
            description: data.description || '',
            isActive: data.isActive !== false,
          });
        });

        // Sort alphabetically by name
        const sorted = plumberServicesData.sort((a, b) => {
          const nameA = String(a?.name || '').toLowerCase();
          const nameB = String(b?.name || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });

        console.log(`✅ Plumber services loaded (zone-filtered): ${sorted.length}`);
        setPlumberServices(sorted.slice(0, 6));
      } catch (e) {
        if (__DEV__) console.log('❌ Failed to fetch plumber services:', e);
      }
    };

    if (location?.storeId && !zoneCompaniesLoading) {
      fetchPlumberServices();
    }
  }, [location?.storeId, zoneCompanyIdsKey, zoneCompanyNamesKey, zoneCompaniesLoading]);

  // Fetch Automobile Washing services (same logic as ServiceCategoryScreen)
  useEffect(() => {
    const fetchAutomobileWashingServices = async () => {
      try {
        console.log('🚗 Fetching Automobile Washing services...');

        const zid = String(location?.storeId || '').trim();
        if (!zid) {
          console.log('❌ No zone selected');
          return;
        }

        // Get zone companies first
        const zoneCompanyIds = zoneCompanyIdsKey
          ? zoneCompanyIdsKey.split('|').map((s) => String(s).trim()).filter(Boolean)
          : [];
        
        const zoneCompanyNames = zoneCompanyNamesKey
          ? zoneCompanyNamesKey.split('|').map((s) => String(s).trim()).filter(Boolean)
          : [];

        if (zoneCompanyIds.length === 0 && zoneCompanyNames.length === 0) {
          console.log('❌ No companies available in this zone');
          return;
        }

        const zoneCompanyIdSet = new Set(zoneCompanyIds);
        const zoneCompanyNameSet = new Set(zoneCompanyNames);

        // First, find the Automobile Washing category
        const categorySnap = await firestore()
          .collection('app_categories')
          .where('isActive', '==', true)
          .get();

        let automobileCategoryId = '';
        let automobileMasterCategoryId = '';
        
        categorySnap.forEach((doc) => {
          const data = doc.data();
          const name = String(data?.name || '').toLowerCase();
          // More specific matching for car wash/automobile washing only
          if ((name.includes('car') && name.includes('wash')) || 
              (name.includes('automobile') && name.includes('wash')) ||
              name.includes('car wash') ||
              name.includes('vehicle wash')) {
            automobileCategoryId = doc.id;
            automobileMasterCategoryId = data?.masterCategoryId || doc.id;
            console.log(`✅ Found Automobile Washing category:`);
            console.log(`   - categoryId: ${doc.id}`);
            console.log(`   - categoryName: ${data?.name}`);
            console.log(`   - masterCategoryId: ${automobileMasterCategoryId}`);
          }
        });

        if (!automobileCategoryId) {
          if (__DEV__) console.log('❌ Automobile Washing category not found');
          return;
        }

        // Fetch services using categoryMasterId (same as ServiceCategoryScreen)
        console.log(`🔍 Querying service_services where categoryMasterId == "${automobileMasterCategoryId}"`);
        
        const servicesSnapshot = await firestore()
          .collection('service_services')
          .where('categoryMasterId', '==', automobileMasterCategoryId)
          .get();

        console.log(`📊 Found ${servicesSnapshot.size} automobile washing services`);

        const automobileServicesData: any[] = [];
        
        servicesSnapshot.forEach(doc => {
          const data = doc.data();
          
          // Check if company is active in this zone
          const companyId = String(data?.companyId || '').trim();
          const companyName = String(data?.companyName || '').trim();
          
          const isCompanyInZone = 
            (companyId && zoneCompanyIdSet.has(companyId)) ||
            (companyName && zoneCompanyNameSet.has(companyName));
          
          if (!isCompanyInZone) {
            console.log(`⏭️ Skipping service "${data.name}" - company not in zone`);
            return;
          }

          automobileServicesData.push({
            id: doc.id,
            name: data.name || '',
            imageUrl: data.imageUrl || null,
            price: data.price,
            packages: data.packages || [],
            categoryId: automobileCategoryId,
            categoryMasterId: automobileMasterCategoryId,
            companyId: data.companyId,
            companyName: data.companyName,
            description: data.description || '',
            isActive: data.isActive !== false,
          });
        });

        // Sort alphabetically by name
        const sorted = automobileServicesData.sort((a, b) => {
          const nameA = String(a?.name || '').toLowerCase();
          const nameB = String(b?.name || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });

        console.log(`✅ Automobile Washing services loaded (zone-filtered): ${sorted.length}`);
        setAutomobileWashingServices(sorted.slice(0, 6));
      } catch (e) {
        if (__DEV__) console.log('❌ Failed to fetch automobile washing services:', e);
      }
    };

    if (location?.storeId && !zoneCompaniesLoading) {
      fetchAutomobileWashingServices();
    }
  }, [location?.storeId, zoneCompanyIdsKey, zoneCompanyNamesKey, zoneCompaniesLoading]);

  // Fetch Home Cleaning services (same logic as ServiceCategoryScreen)
  useEffect(() => {
    const fetchHomeCleaningServices = async () => {
      try {
        console.log('🏠 Fetching Home Cleaning services...');

        const zid = String(location?.storeId || '').trim();
        if (!zid) {
          console.log('❌ No zone selected');
          return;
        }

        // Get zone companies first
        const zoneCompanyIds = zoneCompanyIdsKey
          ? zoneCompanyIdsKey.split('|').map((s) => String(s).trim()).filter(Boolean)
          : [];
        
        const zoneCompanyNames = zoneCompanyNamesKey
          ? zoneCompanyNamesKey.split('|').map((s) => String(s).trim()).filter(Boolean)
          : [];

        if (zoneCompanyIds.length === 0 && zoneCompanyNames.length === 0) {
          console.log('❌ No companies available in this zone');
          return;
        }

        const zoneCompanyIdSet = new Set(zoneCompanyIds);
        const zoneCompanyNameSet = new Set(zoneCompanyNames);

        // First, find the Home Cleaning category
        const categorySnap = await firestore()
          .collection('app_categories')
          .where('isActive', '==', true)
          .get();

        let cleaningCategoryId = '';
        let cleaningMasterCategoryId = '';
        
        categorySnap.forEach((doc) => {
          const data = doc.data();
          const name = String(data?.name || '').toLowerCase();
          // Specific matching for home cleaning
          if ((name.includes('home') && name.includes('clean')) || 
              name.includes('housekeep') || 
              name.includes('maid') || 
              name.includes('domestic')) {
            cleaningCategoryId = doc.id;
            cleaningMasterCategoryId = data?.masterCategoryId || doc.id;
            console.log(`✅ Found Home Cleaning category:`);
            console.log(`   - categoryId: ${doc.id}`);
            console.log(`   - categoryName: ${data?.name}`);
            console.log(`   - masterCategoryId: ${cleaningMasterCategoryId}`);
          }
        });

        if (!cleaningCategoryId) {
          if (__DEV__) console.log('❌ Home Cleaning category not found');
          return;
        }

        // Fetch services using categoryMasterId (same as ServiceCategoryScreen)
        console.log(`🔍 Querying service_services where categoryMasterId == "${cleaningMasterCategoryId}"`);
        
        const servicesSnapshot = await firestore()
          .collection('service_services')
          .where('categoryMasterId', '==', cleaningMasterCategoryId)
          .get();

        console.log(`📊 Found ${servicesSnapshot.size} home cleaning services`);

        const cleaningServicesData: any[] = [];
        
        servicesSnapshot.forEach(doc => {
          const data = doc.data();
          
          // Check if company is active in this zone
          const companyId = String(data?.companyId || '').trim();
          const companyName = String(data?.companyName || '').trim();
          
          const isCompanyInZone = 
            (companyId && zoneCompanyIdSet.has(companyId)) ||
            (companyName && zoneCompanyNameSet.has(companyName));
          
          if (!isCompanyInZone) {
            console.log(`⏭️ Skipping service "${data.name}" - company not in zone`);
            return;
          }

          cleaningServicesData.push({
            id: doc.id,
            name: data.name || '',
            imageUrl: data.imageUrl || null,
            price: data.price,
            packages: data.packages || [],
            categoryId: cleaningCategoryId,
            categoryMasterId: cleaningMasterCategoryId,
            companyId: data.companyId,
            companyName: data.companyName,
            description: data.description || '',
            isActive: data.isActive !== false,
          });
        });

        // Sort alphabetically by name
        const sorted = cleaningServicesData.sort((a, b) => {
          const nameA = String(a?.name || '').toLowerCase();
          const nameB = String(b?.name || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });

        console.log(`✅ Home Cleaning services loaded (zone-filtered): ${sorted.length}`);
        setHomeCleaningServices(sorted.slice(0, 6));
      } catch (e) {
        if (__DEV__) console.log('❌ Failed to fetch home cleaning services:', e);
      }
    };

    if (location?.storeId && !zoneCompaniesLoading) {
      fetchHomeCleaningServices();
    }
  }, [location?.storeId, zoneCompanyIdsKey, zoneCompanyNamesKey, zoneCompaniesLoading]);



  // Continuous blinking animation for live dot
  useEffect(() => {
    const liveDotBlink = Animated.loop(
      Animated.sequence([
        Animated.timing(liveDotBlinkAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(liveDotBlinkAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    liveDotBlink.start();

    return () => {
      liveDotBlink.stop();
    };
  }, [liveDotBlinkAnim]);

  // Smooth blinking animation for Book Now buttons
  useEffect(() => {
    const buttonBlink = Animated.loop(
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

    buttonBlink.start();

    return () => {
      buttonBlink.stop();
    };
  }, [blinkAnim]);

  // Blinking animation for live bookings - trigger only on new bookings
  useEffect(() => {
    if (!shouldBlinkBooking || !latestLiveBooking) return;

    // Reset to 1 first
    bookingBlinkAnim.setValue(1);

    // Then animate blink
    const blinkAnimation = Animated.sequence([
      Animated.timing(bookingBlinkAnim, {
        toValue: 0.2,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(bookingBlinkAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(bookingBlinkAnim, {
        toValue: 0.2,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(bookingBlinkAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]);

    blinkAnimation.start(() => {
      // Reset the flag after animation completes
      setShouldBlinkBooking(false);
    });

    return () => {
      blinkAnimation.stop();
    };
  }, [shouldBlinkBooking, bookingBlinkAnim]);

  // Arrow movement animation for View All button and package cards
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

      setTapLoading({ visible: true, message: 'Opening…' });
      try {
        // Navigate directly to CompanySelection screen
        navigation.navigate('CompanySelection', {
          serviceTitle: svc.name || 'Service',
          categoryId,
          issues: [svc.name],
          serviceIds: [svc.id],
          allCategories: serviceCategories,
        } as any);
      } catch (e) {
        console.log('❌ Failed to navigate to CompanySelection', e);
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
    
    // Check if category has packages - run in parallel with navigation
    const navigationParams = {
      serviceTitle: category.name,
      categoryId: category.id,
      allCategories: serviceCategories,
    };
    
    // Start navigation immediately without waiting for package check
    let hasPackages = false;
    try {
      hasPackages = await Promise.race([
        FirestoreService.categoryHasPackages(category.id),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 300)) // 300ms timeout
      ]);
    } catch (e) {
      if (__DEV__) console.log('⚠️ categoryHasPackages failed:', e);
    }
    
    if (hasPackages) {
      if (__DEV__) console.log('✅ Category has packages, navigating to PackageSelection');
      navigation.navigate("PackageSelection", navigationParams);
    } else {
      if (__DEV__) console.log('✅ Category has no packages, navigating directly to ServiceCategory');
      navigation.navigate("ServiceCategory", navigationParams);
    }
    
    // Hide loading immediately after navigation
    setTimeout(() => setTapLoading({ visible: false }), 100);
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

  // Data slices with null checks - Show 6 categories in main view
  const listCategories = searchQuery 
    ? (filteredCategories || []).slice(0, 20) 
    : (serviceCategories || []).slice(0, 6);
  
  // Check if there are more categories to show
  const hasMoreCategories = !searchQuery && (serviceCategories || []).length > 6;

  const ListFooterUI = React.useMemo(() => {
    if (searchQuery.length > 0) return null;

    return (
      <View>
        {/* Quick Services Section - Before Trending Packages */}
        {plumberServices.length > 0 && (
          <View style={styles.quickServicesContainer}>
            <View style={styles.quickServicesHeader}>
              <Text style={styles.quickServicesTitle}>Plumber</Text>
              <TouchableOpacity
                onPress={() => {
                  // Find plumber category and navigate
                  const plumberCategory = serviceCategories.find(cat => 
                    cat.name.toLowerCase().includes('plumb')
                  );
                  if (plumberCategory) {
                    console.log('🔧 Navigating to Plumber category:', plumberCategory.name);
                    handleCategoryPress(plumberCategory);
                  } else {
                    console.log('❌ Plumber category not found in serviceCategories');
                  }
                }}
                activeOpacity={0.7}
                style={styles.seeAllButton}
              >
                <Text style={styles.seeAllText}>See all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickServicesScroll}
              scrollEventThrottle={16}
            >
              {plumberServices.map((service, index) => {
                const hasPackages = Array.isArray(service?.packages) && service.packages.length > 0;
                const displayPrice = hasPackages 
                  ? `₹${service.packages[0]?.price || 'N/A'}`
                  : service.price 
                    ? `₹${service.price}`
                    : 'Contact for price';

                return (
                  <TouchableOpacity
                    key={service.id}
                    style={styles.quickServiceCard}
                    activeOpacity={0.7}
                    onPress={() => onServicePress(service)}
                  >
                    <View style={styles.quickServiceImageContainer}>
                      {service.imageUrl ? (
                        <ExpoImage
                          source={{ uri: service.imageUrl }}
                          style={styles.quickServiceImage}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                          transition={150}
                        />
                      ) : (
                        <View style={[styles.quickServiceIconFallback, { backgroundColor: '#EFF6FF' }]}>
                          <Ionicons 
                            name="water-outline" 
                            size={28} 
                            color="#3B82F6" 
                          />
                        </View>
                      )}
                    </View>
                    <View style={styles.quickServiceInfo}>
                      <View style={styles.quickServiceTextContainer}>
                        <Text style={styles.quickServiceName} numberOfLines={2}>
                          {service.name || 'Service'}
                        </Text>
                      </View>
                      <TouchableOpacity 
                        style={styles.addToCartButton}
                        activeOpacity={0.7}
                        onPress={() => onServicePress(service)}
                      >
                        <LinearGradient
                          colors={['#10b981', '#059669', '#047857']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.addToCartIconContainer}
                        >
                          <Ionicons name="arrow-forward" size={16} color="#fff" />
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Automobile Washing Services Section */}
        {automobileWashingServices.length > 0 && (
          <View style={styles.quickServicesContainer}>
            <View style={styles.quickServicesHeader}>
              <Text style={styles.quickServicesTitle}>Automobile Washing</Text>
              <TouchableOpacity
                onPress={() => {
                  // Find automobile washing category and navigate
                  const automobileCategory = serviceCategories.find(cat => {
                    const name = cat.name.toLowerCase();
                    return (name.includes('car') && name.includes('wash')) || 
                           (name.includes('automobile') && name.includes('wash')) ||
                           name.includes('car wash') ||
                           name.includes('vehicle wash');
                  });
                  if (automobileCategory) {
                    console.log('🚗 Navigating to Automobile Washing category:', automobileCategory.name);
                    handleCategoryPress(automobileCategory);
                  } else {
                    console.log('❌ Automobile Washing category not found in serviceCategories');
                  }
                }}
                activeOpacity={0.7}
                style={styles.seeAllButton}
              >
                <Text style={styles.seeAllText}>See all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickServicesScroll}
              scrollEventThrottle={16}
            >
              {automobileWashingServices.map((service, index) => {
                const hasPackages = Array.isArray(service?.packages) && service.packages.length > 0;
                const displayPrice = hasPackages 
                  ? `₹${service.packages[0]?.price || 'N/A'}`
                  : service.price 
                    ? `₹${service.price}`
                    : 'Contact for price';

                return (
                  <TouchableOpacity
                    key={service.id}
                    style={styles.quickServiceCard}
                    activeOpacity={0.7}
                    onPress={() => onServicePress(service)}
                  >
                    <View style={styles.quickServiceImageContainer}>
                      {service.imageUrl ? (
                        <ExpoImage
                          source={{ uri: service.imageUrl }}
                          style={styles.quickServiceImage}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                          transition={150}
                        />
                      ) : (
                        <View style={[styles.quickServiceIconFallback, { backgroundColor: '#F0F9FF' }]}>
                          <Ionicons 
                            name="car-outline" 
                            size={28} 
                            color="#0EA5E9" 
                          />
                        </View>
                      )}
                    </View>
                    <View style={styles.quickServiceInfo}>
                      <View style={styles.quickServiceTextContainer}>
                        <Text style={styles.quickServiceName} numberOfLines={2}>
                          {service.name || 'Service'}
                        </Text>
                      </View>
                      <TouchableOpacity 
                        style={styles.addToCartButton}
                        activeOpacity={0.7}
                        onPress={() => onServicePress(service)}
                      >
                        <LinearGradient
                          colors={['#10b981', '#059669', '#047857']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.addToCartIconContainer}
                        >
                          <Ionicons name="arrow-forward" size={16} color="#fff" />
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Home Cleaning Services Section */}
        {homeCleaningServices.length > 0 && (
          <View style={styles.quickServicesContainer}>
            <View style={styles.quickServicesHeader}>
              <Text style={styles.quickServicesTitle}>Home Cleaning</Text>
              <TouchableOpacity
                onPress={() => {
                  // Find home cleaning category and navigate
                  const cleaningCategory = serviceCategories.find(cat => {
                    const name = cat.name.toLowerCase();
                    return (name.includes('home') && name.includes('clean')) || 
                           name.includes('housekeep') || 
                           name.includes('maid') || 
                           name.includes('domestic');
                  });
                  if (cleaningCategory) {
                    console.log('🏠 Navigating to Home Cleaning category:', cleaningCategory.name);
                    handleCategoryPress(cleaningCategory);
                  } else {
                    console.log('❌ Home Cleaning category not found in serviceCategories');
                  }
                }}
                activeOpacity={0.7}
                style={styles.seeAllButton}
              >
                <Text style={styles.seeAllText}>See all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickServicesScroll}
              scrollEventThrottle={16}
            >
              {homeCleaningServices.map((service, index) => {
                const hasPackages = Array.isArray(service?.packages) && service.packages.length > 0;
                const displayPrice = hasPackages 
                  ? `₹${service.packages[0]?.price || 'N/A'}`
                  : service.price 
                    ? `₹${service.price}`
                    : 'Contact for price';

                return (
                  <TouchableOpacity
                    key={service.id}
                    style={styles.quickServiceCard}
                    activeOpacity={0.7}
                    onPress={() => onServicePress(service)}
                  >
                    <View style={styles.quickServiceImageContainer}>
                      {service.imageUrl ? (
                        <ExpoImage
                          source={{ uri: service.imageUrl }}
                          style={styles.quickServiceImage}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                          transition={150}
                        />
                      ) : (
                        <View style={[styles.quickServiceIconFallback, { backgroundColor: '#ECFDF5' }]}>
                          <Ionicons 
                            name="home-outline" 
                            size={28} 
                            color="#10B981" 
                          />
                        </View>
                      )}
                    </View>
                    <View style={styles.quickServiceInfo}>
                      <View style={styles.quickServiceTextContainer}>
                        <Text style={styles.quickServiceName} numberOfLines={2}>
                          {service.name || 'Service'}
                        </Text>
                      </View>
                      <TouchableOpacity 
                        style={styles.addToCartButton}
                        activeOpacity={0.7}
                        onPress={() => onServicePress(service)}
                      >
                        <LinearGradient
                          colors={['#10b981', '#059669', '#047857']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.addToCartIconContainer}
                        >
                          <Ionicons name="arrow-forward" size={16} color="#fff" />
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}
      </View>
    );
  }, [searchQuery, plumberServices, automobileWashingServices, homeCleaningServices, navigation, serviceCategories, handleCategoryPress, onServicePress]);

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
    
    // Gradient colors for borders
    const gradientColorSets = [
      ['#FFD89B', '#19547B'] as const, // Yellow to Blue
      ['#FF6B9D', '#C44569'] as const, // Pink to Red
      ['#4FACFE', '#00F2FE'] as const, // Blue to Cyan
    ];
    const borderGradient = gradientColorSets[index % 3];
    
    return (
      <View style={styles.gradientBorderWrapper}>
        <LinearGradient
          colors={[...borderGradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBorder}
        >
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
        </LinearGradient>
      </View>
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

  const renderRandomServiceModal = useCallback(({ item, index }: { item: any; index: number }) => {
    if (!item || !item.package) return null;

    const pkg = item.package;
    const displayPrice = `₹${pkg.price || 'N/A'}`;
    
    // Format duration properly with unit
    const formatDuration = () => {
      let duration = pkg?.duration || pkg?.durationDays;
      let unit = String(pkg?.durationUnit || pkg?.unit || '').toLowerCase().trim();
      
      if (!duration) return 'N/A';
      
      const count = Number(duration);
      
      // Remove "(s)" from unit if present
      unit = unit.replace(/\(s\)/g, '');
      
      // Format based on unit
      if (unit === 'day' || unit === 'days') {
        return `${count} ${count === 1 ? 'day' : 'days'}`;
      } else if (unit === 'week' || unit === 'weeks') {
        return `${count} ${count === 1 ? 'week' : 'weeks'}`;
      } else if (unit === 'month' || unit === 'months') {
        return `${count} ${count === 1 ? 'month' : 'months'}`;
      } else if (unit === 'hour' || unit === 'hours') {
        return `${count} ${count === 1 ? 'hour' : 'hours'}`;
      } else if (unit === 'minute' || unit === 'minutes' || unit === 'mins' || unit === 'min') {
        return `${count} ${count === 1 ? 'min' : 'mins'}`;
      } else if (unit === 'year' || unit === 'years') {
        return `${count} ${count === 1 ? 'year' : 'years'}`;
      } else {
        // Default to minutes if no unit specified
        return `${count} mins`;
      }
    };
    
    const displayDuration = formatDuration();

    const onModalPress = () => {
      if (!item.categoryId) {
        console.log('❌ Package missing categoryId; cannot open flow');
        return;
      }

      setTapLoading({ visible: true, message: 'Opening…' });
      try {
        navigation.navigate('PackageSelection', {
          serviceTitle: item.serviceName || 'Service',
          categoryId: item.categoryId,
          allCategories: serviceCategories,
          serviceId: item.serviceId,
          serviceName: item.serviceName,
        } as any);
      } catch (e) {
        console.log('❌ Failed to navigate from package modal', e);
        setTapLoading({ visible: false });
      }
    };

    return (
      <TouchableOpacity
        style={styles.randomPackageModal}
        activeOpacity={0.7}
        onPress={onModalPress}
      >
        {/* Header with Badge and Arrow */}
        <View style={styles.packageModalHeader}>
          <View style={styles.packageBadge}>
            <Ionicons name="gift-outline" size={12} color="#10b981" />
            <Text style={styles.packageBadgeText}>Package</Text>
          </View>
          <Ionicons name="arrow-forward" size={16} color="#00b4a0" />
        </View>

        {/* Service Name */}
        <Text style={styles.packageServiceName} numberOfLines={2}>
          {String(item.serviceName || 'Service')}
        </Text>

        {/* Package Name */}
        <Text style={styles.packageName} numberOfLines={1}>
          {String(pkg.name || 'Package')}
        </Text>

        {/* Description */}
        {pkg.description && (
          <Text style={styles.packageDescription} numberOfLines={2}>
            {String(pkg.description)}
          </Text>
        )}

        {/* Details Row */}
        <View style={styles.packageDetailsRow}>
          <View style={styles.packageDetail}>
            <Ionicons name="time-outline" size={14} color="#64748b" />
            <Text style={styles.packageDetailText}>{displayDuration}</Text>
          </View>
          <View style={styles.packageDetail}>
            <Ionicons name="checkmark-circle-outline" size={14} color="#64748b" />
            <Text style={styles.packageDetailText}>
              {pkg.features?.length || 0} features
            </Text>
          </View>
        </View>

        {/* Features List */}
        {Array.isArray(pkg.features) && pkg.features.length > 0 && (
          <View style={styles.packageFeatures}>
            {pkg.features.slice(0, 2).map((feature: any, idx: number) => (
              <View key={idx} style={styles.featureItem}>
                <View style={styles.featureDot} />
                <Text style={styles.featureText} numberOfLines={1}>
                  {String(feature)}
                </Text>
              </View>
            ))}
            {pkg.features.length > 2 && (
              <Text style={styles.moreFeatures}>
                +{pkg.features.length - 2} more
              </Text>
            )}
          </View>
        )}

        {/* Footer with Price and Company */}
        <View style={styles.packageModalFooter}>
          <View>
            <Text style={styles.packagePrice}>{displayPrice}</Text>
            {item.companyName && (
              <Text style={styles.packageCompany} numberOfLines={1}>
                {String(item.companyName)}
              </Text>
            )}
          </View>
          <View style={styles.packageCTA}>
            <Text style={styles.packageCTAText}>Book Now</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [navigation, serviceCategories]);

  const StickyHeaderUI = React.useMemo(() => {
    return (
      <Animated.View
        style={[
          styles.stickyHeaderWrapper,
          {
            paddingTop: headerTopPadding,
            height: stickyHeaderHeight,
            overflow: 'hidden',
            backgroundColor: '#ffffff',
          },
        ]}
        pointerEvents="box-none"
      >
        <StatusBar barStyle="light-content" backgroundColor="#ffffff" />

        {/* Scroll background (BEHIND the GIF, not on top of it) - Hidden on scroll */}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, { opacity: 0 }]}
        >
          <LinearGradient
            colors={[...SERVICES_HEADER_GRADIENT_COLORS]}
            style={StyleSheet.absoluteFillObject}
          />
        </Animated.View>

        {/* Background media (Scrolling Images) */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.stickyHeaderMediaLayer,
            { height: headerMediaHeight, opacity: headerMediaOpacity, backgroundColor: '#f8fafc' },
          ]}
        >
          <ExpoImage
            source={HEADER_IMAGES[activeHeaderImageIndex]}
            style={[StyleSheet.absoluteFillObject, { backgroundColor: '#f8fafc' }]}
            contentFit="cover"
            contentPosition="center"
            cachePolicy="memory-disk"
            transition={800}
          />
        </Animated.View>

        <View style={[styles.stickyHeaderContent, { overflow: 'hidden' }]} pointerEvents="box-none">

          <Animated.View style={[styles.headerRow, { opacity: locationRowOpacity }]}>
            {/* Location row (always visible) */}
            <TouchableOpacity
              style={[styles.locationRow, styles.locationRowHeader]}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('LocationSelector', { fromScreen: 'Services' })}
            >
              <View style={styles.locationRowLeft}>
                <Ionicons name="location-outline" size={18} color="#00b4a0" />
                <Text style={[
                  styles.locationRowText, 
                  styles.locationRowTextHeader,
                  !hasSelectedLocation && styles.locationRowTextRed
                ]} numberOfLines={1}>
                  {hasSelectedLocation
                    ? `Delivering to ${locationDisplayText}`
                    : 'Set delivery location'}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={16} color="#64748b" />
            </TouchableOpacity>

            {/* Profile Icon */}
            <TouchableOpacity
              onPress={() => navigation.navigate('Profile')}
              activeOpacity={0.8}
              style={styles.profileIconButton}
              accessibilityLabel="Profile"
            >
              <Ionicons name="person" size={20} color="#0f172a" />
            </TouchableOpacity>
          </Animated.View>

          {/* Search Bar - Always visible */}
          <Animated.View style={[styles.searchContainer, styles.searchContainerHeader, { transform: [{ translateY: searchBarTranslateY }] }]}>
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

              {/* Booking History Icon */}
              <TouchableOpacity
                onPress={handleHistoryPress}
                activeOpacity={0.8}
                style={styles.historyIconButtonSearch}
                accessibilityLabel="Booking history"
              >
                <Ionicons name="reader-outline" size={20} color="#0f172a" />
              </TouchableOpacity>
            </View>
          </Animated.View>

        </View>
      </Animated.View>
    );
  }, [activeGifIndex, activeMode, clearSearch, handleHistoryPress, handleSearch, hasSelectedLocation, headerGradientOpacity, headerMediaHeight, headerMediaOpacity, headerTopPadding, isSearchFocused, locationDisplayText, locationRowOpacity, navigation, placeholderOpacity, placeholderTranslateY, searchBarTranslateY, searchPlaceholderText, searchQuery, setActiveMode, showAnimatedSearchPlaceholder, stickyHeaderHeight, toggleRowHeight, toggleRowOpacity]);

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
            {/* Grocery/Service/Food Toggle - Moved to top of content */}
            <View style={styles.toggleRowContent}>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  activeMode === "grocery" && styles.toggleBtnActive,
                ]}
                onPress={() => {
                  setActiveMode("grocery");
                  navigation.reset({
                    index: 0,
                    routes: [{ name: "HomeTab" }],
                  });
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.toggleLabel,
                    activeMode === "grocery" && styles.toggleLabelActive,
                  ]}
                >
                  Grocery
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  activeMode === "service" && styles.toggleBtnActive,
                ]}
                onPress={() => setActiveMode("service")}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.toggleLabel,
                    activeMode === "service" && styles.toggleLabelActive,
                  ]}
                >
                  Service
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  activeMode === "food" && styles.toggleBtnActive,
                ]}
                onPress={() => {
                  setActiveMode("food");
                  navigation.navigate("ProductsHome");
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.toggleLabel,
                    activeMode === "food" && styles.toggleLabelActive,
                  ]}
                >
                  Food
                </Text>
              </TouchableOpacity>
            </View>

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

            {/* All Services Section with White Background */}
            <View style={styles.allServicesSection}>
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
                  <View style={styles.liveIndicator}>
                    <Animated.View style={[styles.liveDot, { opacity: liveDotBlinkAnim }]} />
                    <Text style={styles.liveText}>Live Bookings</Text>
                  </View>
                </View>
                <View style={styles.liveUpdatesWrapper}>
                  {latestLiveBooking ? (
                    <Animated.View style={[
                      styles.liveUpdateItem, 
                      { 
                        transform: [{ translateY: bookingTransitionAnim }]
                      }
                    ]}>
                      <View style={styles.liveUpdateDot} />
                      <Text style={styles.liveUpdateText} numberOfLines={1}>
                        <Text style={styles.liveUpdateBold}>{latestLiveBooking.serviceName}</Text>
                        {' '}booked in{' '}
                        <Text style={[
                          styles.liveUpdateLocation,
                          latestLiveBooking.location === 'Your area' && styles.liveUpdateLocationRed
                        ]}>
                          {latestLiveBooking.location}
                        </Text>
                      </Text>
                    </Animated.View>
                  ) : (
                    <View style={styles.liveUpdateItem}>
                      <View style={[styles.liveUpdateDot, { backgroundColor: '#cbd5e1' }]} />
                      <Text style={styles.liveUpdateText}>
                        <Text style={styles.liveUpdateBold}>No live bookings</Text>
                        {' '}at the moment
                      </Text>
                    </View>
                  )}
                </View>
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
  }, [searchQuery, filteredCategories, searchServices, bannersLoading, serviceBanners, renderBanner, activeBannerIndex, hasMoreCategories, arrowAnim, bookingTransitionAnim, handleViewAllCategories, renderServiceListItem, latestLiveBooking, activeMode, setActiveMode, navigation]);

  return (
    <ImageBackground
      source={require("../../assets/serviceBG.png")}
      style={styles.container}
      resizeMode="cover"
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
          ListFooterComponent={ListFooterUI}
          renderItem={renderListItem}
          numColumns={3}
          columnWrapperStyle={styles.gridRow}
          key="three-columns"
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
          contentContainerStyle={{ paddingTop: SERVICES_STICKY_HEADER_HEIGHT, paddingBottom: 30, backgroundColor: 'white' }}
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
    backgroundColor: '#ffffff',
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

  locationRowTextRed: {
    color: '#ef4444',
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

  profileIconButton: {
    marginLeft: 10,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },

  historyIconButtonSearch: {
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

  // Toggle Styles
  toggleRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 6,
    marginBottom: 0,
    gap: 8,
  },
  toggleRowContent: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 0,
    marginBottom: 0,
    gap: 8,
    backgroundColor: "#ffffff",
  },
  toggleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.15)",
  },
  toggleBtnActive: {
    backgroundColor: "#00b4a0",
    borderColor: "#00b4a0",
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333333",
  },
  toggleLabelActive: {
    color: "#ffffff",
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

  allServicesSection: {
    backgroundColor: "white",
    paddingBottom: 12,
  },

  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 12,
    marginTop: 8,
    backgroundColor: "white",
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
  },

  viewAllButtonInline: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0fdfa",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },

  viewAllTextInline: {
    color: "#00b4a0",
    fontSize: 13,
    fontWeight: "700",
  },

  // Live Updates Styles
  liveUpdatesContainer: {
    paddingVertical: 12,
    backgroundColor: "white",
    marginBottom: 4,
  },

  liveUpdatesHeader: {
    paddingHorizontal: 16,
    marginBottom: 8,
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
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },

  liveUpdatesWrapper: {
    paddingHorizontal: 16,
    height: 24,
    overflow: "hidden",
  },

  liveUpdateItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  liveUpdateDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#00b4a0",
  },

  liveUpdateText: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "400",
    flex: 1,
  },

  liveUpdateBold: {
    fontWeight: "700",
    color: "#0f172a",
  },

  liveUpdateLocation: {
    color: "#00b4a0",
    fontWeight: "600",
  },

  liveUpdateLocationRed: {
    color: "#ef4444",
  },

  // Grid Styles (3 columns)
  gridRow: {
    paddingHorizontal: 12,
    justifyContent: "space-between",
    marginBottom: 12,
  },

  gradientBorderWrapper: {
    width: (width - 48) / 3,
    borderRadius: 16,
    padding: 2,
  },

  gradientBorder: {
    borderRadius: 16,
    padding: 0,
  },

  gridCard: {
    width: '100%',
    backgroundColor: "white",
    borderRadius: 14,
    padding: 0,
    alignItems: "center",
    overflow: 'hidden',
  },

  gridMedia: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 0,
    paddingBottom: 0,
  },

  gridIconContainer: {
    width: '100%',
    height: 100,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  gridCategoryImage: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },

  gridInfo: {
    width: '100%',
    paddingHorizontal: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },

  gridTitle: {
    fontSize: 12,
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

  // Random Service Modals Styles
  randomServicesContainer: {
    paddingVertical: 12,
    backgroundColor: "#f8fafc",
    marginBottom: 16,
  },

  randomServicesScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },

  randomServiceModal: {
    width: (width - 64) / 2,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },

  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  modalBadge: {
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },

  modalBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#10b981",
    textTransform: "uppercase",
  },

  modalServiceName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 6,
    lineHeight: 18,
  },

  modalCategoryName: {
    fontSize: 12,
    fontWeight: "500",
    color: "#64748b",
    marginBottom: 10,
  },

  modalFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },

  modalPrice: {
    fontSize: 16,
    fontWeight: "700",
    color: "#00b4a0",
  },

  modalPackageCount: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94a3b8",
  },

  // Random Package Modal Styles
  randomPackageModal: {
    width: (width - 64) / 2,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },

  packageModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  // New Package Card Styles (Image-based design)
  packageCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    width: 180,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },

  packageIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#f59e0b",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  packageCardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 6,
  },

  packageCardDescription: {
    fontSize: 12,
    fontWeight: "400",
    color: "#64748b",
    marginBottom: 12,
    lineHeight: 16,
  },

  packageCardDuration: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 16,
  },

  packageCardDurationText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#64748b",
  },

  packageCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
  },

  packagePriceBadge: {
    flex: 1,
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1fae5",
  },

  packagePriceContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  packageCardPriceLabel: {
    fontSize: 9,
    fontWeight: "600",
    color: "#059669",
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  packageCardPrice: {
    fontSize: 16,
    fontWeight: "800",
    color: "#10b981",
  },

  packageBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },

  packageBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#10b981",
    textTransform: "uppercase",
  },

  packageServiceName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
    lineHeight: 16,
  },

  packageName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#00b4a0",
    marginBottom: 6,
  },

  packageDescription: {
    fontSize: 11,
    fontWeight: "400",
    color: "#64748b",
    marginBottom: 8,
    lineHeight: 14,
  },

  packageDetailsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },

  packageDetail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },

  packageDetailText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#64748b",
  },

  packageFeatures: {
    marginBottom: 8,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },

  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },

  featureDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#00b4a0",
  },

  featureText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#475569",
    flex: 1,
  },

  moreFeatures: {
    fontSize: 10,
    fontWeight: "600",
    color: "#00b4a0",
    marginTop: 4,
  },

  packageModalFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
  },

  packagePrice: {
    fontSize: 16,
    fontWeight: "700",
    color: "#00b4a0",
  },

  packagePriceSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 8,
  },

  packageCompany: {
    fontSize: 10,
    fontWeight: "500",
    color: "#94a3b8",
    marginTop: 2,
  },

  packageCTA: {
    backgroundColor: "#22c55e",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },

  packageCTAText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ffffff",
  },

  randomServicesHeader: {
    paddingHorizontal: 16,
    marginBottom: 12,
    marginTop: 20,
  },

  randomServicesTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },

  // Trending Packages Styles
  trendingPackagesContainer: {
    paddingVertical: 12,
    backgroundColor: "#fdfdfd",
    marginBottom: 12,
    marginTop: 8,
  },

  // Quick Services Styles (Popular Services)
  quickServicesContainer: {
    paddingVertical: 16,
    backgroundColor: "#ffffff",
    marginBottom: 8,
  },

  quickServicesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 12,
  },

  quickServicesTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },

  seeAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#f0fdfa",
  },

  seeAllText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#10b981",
  },

  quickServicesScroll: {
    paddingHorizontal: 16,
    gap: 10,
  },

  quickServiceCard: {
    width: 110,
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  quickServiceImageContainer: {
    width: "100%",
    height: 90,
    backgroundColor: "#f8fafc",
    overflow: "hidden",
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },

  quickServiceImage: {
    width: "100%",
    height: "100%",
  },

  quickServiceIconFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },

  quickServiceInfo: {
    padding: 6,
    width: "100%",
    position: "relative",
    minHeight: 55,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },

  quickServiceTextContainer: {
    flex: 1,
    paddingRight: 4,
  },

  quickServiceName: {
    fontSize: 11,
    fontWeight: "600",
    color: "#0f172a",
    lineHeight: 14,
  },

  quickServicePrice: {
    fontSize: 12,
    fontWeight: "700",
    color: "#10b981",
    textAlign: "center",
  },

  bookNowButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginTop: 4,
  },

  bookNowText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  addToCartButton: {
    flexShrink: 0,
  },

  addToCartIconContainer: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },

  packageBookNowButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  packageBookNowText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  trendingPackagesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 12,
  },

  trendingHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  trendingPackagesTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },

  trendingSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#10b981",
  },

  trendingPackagesScroll: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },

});


