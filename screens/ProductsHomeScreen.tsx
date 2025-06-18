import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
  Linking,
  Vibration,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Video from "react-native-video";
import { MaterialIcons } from "@expo/vector-icons";
import firestore from "@react-native-firebase/firestore";
import { useNavigation } from "@react-navigation/native";
import * as Location from "expo-location";

import { useLocationContext } from "@/context/LocationContext";
import { useCart } from "@/context/CartContext";
import NotificationModal from "../components/ErrorModal";
import Loader from "@/components/VideoLoader";
import { QuickTile } from "@/components/QuickTile";
import { useWeather } from "../context/WeatherContext"; // adjust path if needed

/* ------------------------------------------------------------------ CONSTANTS */
const INITIAL_VIDEO_HEIGHT = 180;
const COLLAPSED_VIDEO_HEIGHT = 100;
const INITIAL_PADDING_TOP = Platform.OS === "ios" ? 80 : 80;
const COLLAPSED_PADDING_TOP = Platform.OS === "ios" ? 60 : 40;

const { width } = Dimensions.get("window");
const H = 16;
const G = 20;
const MOSAIC_W = width * 0.35;
const MOSAIC_W_GAME = width * 0.5;
const TILE_W = 120;
const TILE_H = 210;
const SEARCH_PH = ["atta", "dal", "eggs", "biscuits", "coffee"];
const PAGE_SIZE = 5;
const ROW_LIMIT = 5;
const AnimatedSectionList = Animated.createAnimatedComponent(SectionList);

/* ------------------------------------------------------------------ helpers */
const firstImg = (p: any) =>
  p.imageUrl ||
  p.image ||
  (Array.isArray(p.images) && p.images[0]) ||
  p.thumbnail ||
  "";

const toRad = (d: number) => (d * Math.PI) / 180;
const haversineKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) => {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

type DeliveryZone = {
  storeId: string;
  lat: number;
  lng: number;
  radius: number;
};

type CategoryAlert = {
  categoryId: string;
  title: string;
  message: string;
  acceptLabel: string;
  declineLabel: string;
  linkLabel: string;
  linkUrl: string;
};
type Props = {
  setHasPerm: (v: boolean) => void;
  setSelectManually: (v: boolean) => void;
};
/* ------------------------------------------------------------------ location-prompt bottom-sheet (unchanged) */
const LocationPromptCard: React.FC<Props> = ({
  setHasPerm,
  setSelectManually,
}) => {
  const nav = useNavigation<any>();
  const { updateLocation } = useLocationContext();
  const [busy, setBusy] = useState(false);

  const enable = useCallback(async () => {
    try {
      setBusy(true);
      let { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") {
        status = (await Location.requestForegroundPermissionsAsync()).status;
      }
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Please allow location access, or select your address manually."
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      updateLocation({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        address: "",
        storeId: null,
      });
      setHasPerm(true);
      setSelectManually(true);
    } catch (e) {
      Alert.alert("Error", "Unable to fetch location. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [updateLocation, setHasPerm]);

  const handleManualSelection = () => {
    setHasPerm(true);
    setSelectManually(true);
    nav.navigate("LocationSelector", { fromScreen: "Products" });
  };
  return (
    <View style={styles.locSheet}>
      <View style={styles.locHandle} />
      <View style={styles.locHeader}>
        <MaterialIcons name="location-on" size={26} color="#009688" />
        <Text style={styles.locTitle}>Set your delivery location</Text>
      </View>
      <Text style={styles.locSub}>
        Turn on location services or pick your address manually.
      </Text>

      <TouchableOpacity
        style={[styles.locBtn, styles.locBtnPrimary]}
        onPress={enable}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.locBtnTxtPrimary}>Enable Location</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.locBtn, styles.locBtnSecondary]}
        onPress={handleManualSelection}
        disabled={busy}
      >
        <Text style={styles.locBtnTxtSecondary}>Select Manually</Text>
      </TouchableOpacity>
    </View>
  );
};

/* ------------------------------------------------------------------ header + search */

const Header = memo(() => {
  const { location } = useLocationContext();
  const { isBadWeather } = useWeather();
  const nav = useNavigation<any>();
  return (
    <Pressable
      style={styles.locationRow}
      onPress={() =>
        nav.navigate("LocationSelector", { fromScreen: "Products" })
      }
    >
      <MaterialIcons
        name="place"
        size={20}
        color="#fff"
        style={{ marginRight: 4 }}
      />
      <View style={styles.textRow}>
        <Text style={styles.locationTxt} numberOfLines={1}>
          {location.address
            ? `Delivering to ${location.address}`
            : "Set delivery location"}
        </Text>

        {isBadWeather && (
          <View style={styles.badge01}>
            <Text style={styles.badgeText}>🌩️ Bad Weather</Text>
          </View>
        )}
      </View>
      <MaterialIcons name="keyboard-arrow-down" size={18} color="#fff" />
    </Pressable>
  );
});

const SearchBar = memo(({ ph }: { ph: string }) => {
  const nav = useNavigation<any>();
  return (
    <Pressable
      style={styles.searchWrapper}
      onPress={() => nav.navigate("Search")}
    >
      <MaterialIcons
        name="search"
        size={20}
        color="#555"
        style={{ marginRight: 6 }}
      />
      <Text style={styles.searchTxt}>{`Search for ${ph}`}</Text>
    </Pressable>
  );
});

/* ------------------------------------------------------------------ intro media */
type IntroProps = { url: string | null; title: string | null };
const MemoIntroCard = React.memo(
  ({ url, title }: IntroProps) => {
    const nav = useNavigation<any>();
    const ref = useRef<Video>(null);
    const [dur, setDur] = useState(0);
    const [spin, setSpin] = useState(true);
    const isMp4 = !!url && /\.mp4(\?|$)/i.test(url);

    if (!url) {
      return (
        <View style={[styles.mediaBox, styles.center]}>
          <ActivityIndicator color="#ffffff" size="large" />
        </View>
      );
    }

    const onProgress = ({ currentTime }: { currentTime: number }) => {
      if (dur && currentTime >= dur - 0.05) ref.current?.seek(0.001);
    };

    return (
      <Pressable style={styles.quizCard} onPress={() => nav.navigate("Quiz")}>
        {isMp4 ? (
          <>
            <Video
              ref={ref}
              source={{ uri: url }}
              style={styles.mediaBox}
              resizeMode="cover"
              muted
              repeat
              onLoad={({ duration }) => setDur(duration)}
              onProgress={onProgress}
              onReadyForDisplay={() => setSpin(false)}
            />
            {spin && (
              <View style={[styles.mediaBox, styles.loaderOverlay]}>
                <ActivityIndicator color="#ffffff" size="large" />
              </View>
            )}
          </>
        ) : (
          <Image
            source={{ uri: url }}
            style={styles.mediaBox}
            resizeMode="cover"
          />
        )}
        <View style={styles.quizOverlay}>
          <Text style={styles.quizTxt}>
            {title || "Play Quiz & Earn Discounts"}
          </Text>
        </View>
      </Pressable>
    );
  },
  // Only re-render if the incoming props really changed
  (prev, next) => prev.url === next.url && prev.title === next.title
);

/* ------------------------------------------------------------------ chips row */
const ChipsRow: React.FC<{ subs: any[]; onPress: (s: any) => void }> = ({
  subs,
  onPress,
}) =>
  subs.length ? (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingLeft: H, paddingVertical: 6 }}
    >
      {subs.map((s) => (
        <Pressable key={s.id} style={styles.chip} onPress={() => onPress(s)}>
          <Text style={styles.chipTxt}>{s.name}</Text>
        </Pressable>
      ))}
    </ScrollView>
  ) : null;

/* ------------------------------------------------------------------ mosaic card */
const MosaicCard: React.FC<{
  cat: any;
  products: any[];
  badge?: string;
  color?: string;
}> = ({ cat, products, badge, color = "#009688" }) => {
  const nav = useNavigation<any>();
  const pics = products.slice(0, 4).map(firstImg);

  // Max discount percentage across products
  const maxDiscountPercent = products.reduce((max, p) => {
    const price =
      Number(p.price ?? 0) + Number(p.CGST ?? 0) + Number(p.SGST ?? 0);
    const discount = Number(p.discount ?? 0);
    const percent = price > 0 ? Math.round((discount / price) * 100) : 0;
    return Math.max(max, percent);
  }, 0);

  const grid =
    products.length === 1
      ? [styles.wholeCell]
      : products.length === 2
      ? [styles.halfCell, styles.halfCell]
      : products.length === 3
      ? [styles.halfCell, styles.halfCell, styles.fullWidthCell]
      : Array(4).fill(styles.quarterCell);

  return (
    <Pressable
      style={styles.mosaicCard}
      onPress={() =>
        nav.navigate("ProductListingFromHome", {
          categoryId: cat.id,
          categoryName: cat.name,
        })
      }
    >
      {grid.map((cellStyle, idx) => (
        <View
          key={idx}
          style={[
            cellStyle,
            idx === 0 && styles.roundTL,
            idx === grid.length - 1 && styles.roundBR,
          ]}
        >
          {pics[idx] ? (
            <Image
              source={{ uri: pics[idx] }}
              style={styles.mosaicImg}
              resizeMode="contain"
            />
          ) : (
            <View style={{ flex: 1, backgroundColor: "#fafafa" }} />
          )}
        </View>
      ))}

      {products.length > 4 && (
        <View style={styles.morePill}>
          <Text style={styles.moreTxt}>+{products.length - 4}</Text>
        </View>
      )}
      {maxDiscountPercent > 0 && (
        <View style={styles.mosaicDeal}>
          <Text style={styles.mosaicDealTxt}>
            UP TO {maxDiscountPercent}% OFF
          </Text>
        </View>
      )}

      <View style={styles.cardLabel}>
        {badge && (
          <View style={[styles.badge, { backgroundColor: color }]}>
            <Text style={styles.badgeTxt}>{badge}</Text>
          </View>
        )}
        <Text style={styles.cardTitle}>{cat.name}</Text>
      </View>
    </Pressable>
  );
};
const StableSearchBar = () => {
  const [phIdx, setPhIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhIdx((prev) => (prev + 1) % SEARCH_PH.length);
    }, 3000); // change every 3 seconds
    return () => clearInterval(interval);
  }, []);

  return <SearchBar ph={SEARCH_PH[phIdx]} />;
};
/* ------------------------------------------------------------------ MAIN */
export default function ProductsHomeScreen() {
  const nav = useNavigation<any>();
  const { location, updateLocation } = useLocationContext();
  const { cart } = useCart();

  /* ========== Pan Corner age-gate state ========== */
  const [catAlert, setCatAlert] = useState<CategoryAlert | null>(null);
  const [acceptedPan, setAcceptedPan] = useState(false);
  const [showGate, setShowGate] = useState(false);
  const onAcceptRef = useRef<() => void>(() => {});
  const vibrateCancel = () => Vibration.vibrate(70);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isErrorModalVisible, setIsErrorModalVisible] = useState(false);
  const [onErrorConfirm, setOnErrorConfirm] = useState<() => void>(() => {});

  useEffect(() => {
    firestore()
      .collection("category_alerts")
      .where("categoryId", "==", "Pan Corner")
      .limit(1)
      .get()
      .then((snap) => {
        if (!snap.empty) setCatAlert(snap.docs[0].data() as CategoryAlert);
      })
      .catch((e) => console.warn("[category_alerts]", e));
  }, []);

  const maybeGate = useCallback(
    (cb: () => void, isPan: boolean) => {
      if (!isPan || acceptedPan || !catAlert) {
        cb();
        return;
      }
      onAcceptRef.current = cb;
      setShowGate(true);
    },
    [acceptedPan, catAlert]
  );

  const isPanProd = useCallback(
    (p: any) =>
      !!catAlert &&
      (p.categoryId === catAlert.categoryId ||
        p.name?.toLowerCase().includes("pan corner")),
    [catAlert]
  );

  const maybeNavigateCat = useCallback(
    (cat: any) => {
      const isPan =
        catAlert &&
        (cat.id === catAlert.categoryId ||
          cat.name.toLowerCase().includes("pan corner"));
      maybeGate(
        () =>
          nav.navigate("ProductListingFromHome", {
            categoryId: cat.id,
            categoryName: cat.name,
          }),
        !!isPan
      );
    },
    [nav, catAlert, maybeGate]
  );

  /* -------------------------------------------------- permissions / location — unchanged logic */
  const [hasPerm, setHasPerm] = useState<boolean | null>(null);
  const [selectManually, setSelectManually] = useState(false);

  useEffect(() => {
    Location.getForegroundPermissionsAsync().then((r) => {
      setHasPerm(r.status === "granted");

      // If location is granted, user doesn't need manual selection
      if (r.status === "granted") {
        setSelectManually(true);
      }
    });
  }, []);

  const [zones, setZones] = useState<DeliveryZone[] | null>(null);
  useEffect(() => {
    firestore()
      .collection("delivery_zones")
      .get()
      .then((snap) =>
        setZones(
          snap.docs.map((d) => {
            const v: any = d.data();
            return {
              storeId: d.id,
              lat: +v.latitude,
              lng: +v.longitude,
              radius: +v.radius,
            };
          })
        )
      )
      .catch((e) => console.warn("fetch zones", e));
  }, []);

  const mapCoordsToStore = useCallback(
    async (lat: number, lng: number) => {
      if (!zones || location.storeId) return;
      let picked: DeliveryZone | null = null;
      let best = Infinity;
      zones.forEach((z) => {
        const d = haversineKm(lat, lng, z.lat, z.lng);
        if (d <= z.radius && d < best) {
          best = d;
          picked = z;
        }
      });
      const showErrorModal = (message: string, onConfirm?: () => void) => {
        setErrorMessage(message);
        if (onConfirm) setOnErrorConfirm(() => onConfirm);
        else setOnErrorConfirm(() => () => {});
        setIsErrorModalVisible(true);
      };

      if (!picked) {
        showErrorModal(
          "Sorry, we don’t deliver to your current location.",
          () => nav.navigate("LocationSelector", { fromScreen: "Products" })
        );
        return;
      }

      let addr = "";
      try {
        const g = await Location.reverseGeocodeAsync({
          latitude: lat,
          longitude: lng,
        });
        if (g.length) {
          const { name, district, city } = g[0];
          addr = [name, district, city].filter(Boolean).join(", ");
        }
      } catch (_) {}
      updateLocation({ storeId: picked.storeId, address: addr });
    },
    [zones, location.storeId, updateLocation]
  );

  const triedAuto = useRef(false);
  useEffect(() => {
    (async () => {
      if (triedAuto.current || !hasPerm) return;
      if (location.lat && location.lng) return;
      triedAuto.current = true;
      try {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        updateLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          address: "",
          storeId: null,
        });
        mapCoordsToStore(pos.coords.latitude, pos.coords.longitude);
      } catch {}
    })();
  }, [hasPerm, location.lat, location.lng, updateLocation, mapCoordsToStore]);

  useEffect(() => {
    if (hasPerm && zones && location.lat && location.lng && !location.storeId) {
      mapCoordsToStore(location.lat, location.lng);
    }
  }, [
    hasPerm,
    zones,
    location.lat,
    location.lng,
    location.storeId,
    mapCoordsToStore,
  ]);

  /* intro media (quiz) */
  const [introUrl, setIntroUrl] = useState<string | null>(null);
  const [quizTitle, setQuizTitle] = useState<string | null>(null);
  useEffect(() => {
    if (!location.storeId) {
      setIntroUrl(null);
      setQuizTitle(null);
      return;
    }
    const unsub = firestore()
      .collection("quizzes")
      .where("storeId", "==", location.storeId)
      .where("isActive", "==", true)
      .limit(1)
      .onSnapshot(
        (snap) => {
          const d = snap.docs[0]?.data();
          setIntroUrl(d?.introGifUrl && d?.isActive ? d.introGifUrl : null);
          setQuizTitle(d?.title ?? null);
        },
        () => {
          setIntroUrl(null);
          setQuizTitle(null);
        }
      );
    return unsub;
  }, [location.storeId]);

  /* catalogue */
  const [cats, setCats] = useState<any[]>([]);
  const [subMap, setSubMap] = useState<Record<string, any[]>>({});
  const [prodMap, setProdMap] = useState<Record<string, { rows: any[] }>>({});
  const [page, setPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [noMore, setNoMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevStoreIdRef = useRef<string | null>(null);

  const initFetch = useCallback(async () => {
    if (!location.storeId) return;

    // Reset states when storeId changes
    if (prevStoreIdRef.current !== location.storeId) {
      setCats([]);
      setSubMap({});
      setProdMap({});
      setPage(0);
      setNoMore(false);
      setError(null);
      setBestProducts([]);
      setFreshProducts([]);
    }
    prevStoreIdRef.current = location.storeId;
    // continue init
    try {
      const [catSnap, subSnap] = await Promise.all([
        firestore()
          .collection("categories")
          .where("storeId", "==", location.storeId)
          .orderBy("priority", "asc")
          .get(),
        firestore()
          .collection("subcategories")
          .where("storeId", "==", location.storeId)
          .get(),
      ]);

      setCats(catSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      const m: Record<string, any[]> = {};
      subSnap.docs.forEach((d) => {
        const s = { id: d.id, ...d.data() } as any;
        (m[s.categoryId] ||= []).push(s);
      });
      setSubMap(m);

      setProdMap({});
      setPage(0);
      setNoMore(false);
    } catch (e) {
      setError("Could not load catalogue.");
    }
  }, [location.storeId]);
  useEffect(() => {
    initFetch();
  }, [initFetch]);

  const extra = React.useMemo(
    () => ({ introUrl, prodMap, cart }),
    [introUrl, prodMap, cart]
  );
  const pending = useRef(false);
  const loadMoreRows = useCallback(async () => {
    if (!location.storeId || pending.current || noMore) return;

    const slice = cats.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    if (!slice.length) {
      setNoMore(true);
      return;
    }

    pending.current = true;
    setLoadingMore(true);

    try {
      const ids = slice.map((c) => c.id);
      const snap = await firestore()
        .collection("products")
        .where("storeId", "==", location.storeId)
        .where("categoryId", "in", ids as any)
        .where("quantity", ">", 0)
        .get();
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const up: typeof prodMap = {};
      slice.forEach((c) => {
        const arr = all.filter((p) => p.categoryId === c.id);
        up[c.id] = {
          rows: arr
            .sort((a, b) => (b.quantity ?? 0) - (a.quantity ?? 0))
            .slice(0, ROW_LIMIT),
        };
      });
      setProdMap((prev) => ({ ...prev, ...up }));
      setPage((p) => p + 1);
    } catch {
      pending.current = false; // Ensure reset on error
    } finally {
      pending.current = false;
      setLoadingMore(false);
    }
  }, [cats, page, noMore, location.storeId]);

  /* store-wide highlights */
  const [bestProducts, setBestProducts] = useState<any[]>([]);
  const [freshProducts, setFreshProducts] = useState<any[]>([]);

  const loadHighlights = useCallback(async () => {
    if (!location.storeId) {
      setBestProducts([]);
      setFreshProducts([]);
      return;
    }
    try {
      const snap = await firestore()
        .collection("products")
        .where("storeId", "==", location.storeId)
        .where("quantity", ">", 0)
        .get();

      const all = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          createdAt: data.createdAt?.toDate?.() ?? null, // Optional timestamp
        };
      });

      setBestProducts(
        all
          .filter((p) => (p.weeklySold ?? 0) > 0)
          .sort((a, b) => (b.weeklySold ?? 0) - (a.weeklySold ?? 0))
      );

      setFreshProducts(
        all
          .filter((p) => p.isNew)
          .sort((a, b) => {
            const aTime = a.createdAt?.getTime?.() ?? 0;
            const bTime = b.createdAt?.getTime?.() ?? 0;
            return bTime - aTime;
          })
      );
    } catch (err) {
      console.error("Failed to load highlights", err);
    }
  }, [location.storeId]);

  useEffect(() => {
    loadHighlights();
  }, [loadHighlights]);

  const catLookup = useMemo(() => {
    const m: Record<string, any> = {};
    cats.forEach((c) => (m[c.id] = c));
    return m;
  }, [cats]);

  const groupByCat = useCallback(
    (list: any[]) => {
      const m: Record<string, { cat: any; products: any[] }> = {};
      list.forEach((p) => {
        const cat = catLookup[p.categoryId];
        if (!cat) return;
        (m[cat.id] ||= { cat, products: [] }).products.push(p);
      });
      return Object.values(m);
    },
    [catLookup]
  );

  const bestHeader = useMemo(
    () => groupByCat(bestProducts),
    [bestProducts, groupByCat]
  );
  const freshHeader = useMemo(
    () => groupByCat(freshProducts),
    [freshProducts, groupByCat]
  );
  const sections = useMemo(
    () => [{ data: cats.slice(0, page * PAGE_SIZE) }],
    [cats, page]
  );

  const listHeader = useMemo(() => {
    if (!introUrl) return null;
    return <MemoIntroCard url={introUrl} title={quizTitle} />;
  }, [introUrl, quizTitle]);

  const renderSectionHeader = useCallback(() => {
    return (
      <>
        {bestHeader.length > 0 && (
          <>
            <Text style={styles.laneTitle}>Best sellers</Text>
            <FlatList
              horizontal
              data={bestHeader}
              keyExtractor={(_, i) => `best${i}`}
              renderItem={({ item }) => <MosaicCard {...item} badge="HOT" />}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingLeft: H }}
            />
          </>
        )}
        {freshHeader.length > 0 && (
          <>
            <Text style={styles.laneTitle}>Fresh arrivals</Text>
            <FlatList
              horizontal
              data={freshHeader}
              keyExtractor={(_, i) => `fresh${i}`}
              renderItem={({ item }) => (
                <MosaicCard {...item} badge="JUST IN" color="#ff7043" />
              )}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingLeft: H }}
            />
          </>
        )}
      </>
    );
  }, [bestHeader, freshHeader]);
  // Animate on slide

  const scrollY = useRef(new Animated.Value(0)).current;

  const videoHeight = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [INITIAL_VIDEO_HEIGHT, COLLAPSED_VIDEO_HEIGHT],
    extrapolate: "clamp",
  });

  const videoOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const gradientOpacity = scrollY.interpolate({
    inputRange: [50, 100],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const topPadding = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [INITIAL_PADDING_TOP, COLLAPSED_PADDING_TOP],
    extrapolate: "clamp",
  });
  const memoizedGuard = useCallback(maybeGate, []);
  const memoizedIsPan = useCallback((p) => isPanProd?.(p), [isPanProd]);
  // -----------------------------------------------------------------
  // Ensures a stable reference for SectionList.re-render optimisation
  const listExtraData = useMemo(() => prodMap, [prodMap]); // -----------------------------------------------------------------

  /* -------------------------------------------------- render guard for loading-permission */
  if (hasPerm === null) {
    return (
      <View style={[styles.center, { flex: 1 }]}>
        <Loader />
      </View>
    );
  }

  return (
    <>
      <View style={{ flex: 1, backgroundColor: "#fdfdfd" }}>
        <Animated.View
          // ① this full-screen wrapper must not swallow taps outside its children
          pointerEvents="box-none"
          // ② give it the stacking power so iOS puts it above the list
          style={[styles.headerWrapper, { paddingTop: topPadding }]}
        >
          {/* --- Background video (decorative, not touchable) --- */}

          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { height: videoHeight, opacity: videoOpacity },
            ]}
          >
            <Video
              source={require("../assets/deliveryBackground.mp4")}
              style={StyleSheet.absoluteFill}
              muted
              repeat
              resizeMode="cover"
              rate={1.0}
              ignoreSilentSwitch="obey"
            />
          </Animated.View>

          {/* --- Gradient overlay (also decorative) --- */}
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { opacity: gradientOpacity }]}
          >
            <LinearGradient
              colors={["#00b4a0", "#00d2c7", "#ffffff"]}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          {/* --- CLICKABLE HEADER & SEARCH --- */}
          <Header />
          <View style={{ paddingBottom: 12 }}>
            <StableSearchBar />
          </View>
        </Animated.View>

        {error && <Text style={styles.errorTxt}>{error}</Text>}

        {location.storeId ? (
          <AnimatedSectionList
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={false}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: false }
            )}
            scrollEventThrottle={16}
            contentContainerStyle={{ paddingTop: INITIAL_VIDEO_HEIGHT }}
            sections={sections}
            ListHeaderComponent={listHeader}
            renderSectionHeader={renderSectionHeader}
            keyExtractor={(item) => item.id}
            extraData={listExtraData}
            renderItem={({ item }) => (
              <View style={{ marginTop: 32 }}>
                <View style={styles.rowHeader}>
                  <Text style={styles.rowTitle}>{item.name}</Text>
                  <Pressable onPress={() => maybeNavigateCat(item)}>
                    <Text style={styles.seeAllTxt}>See all</Text>
                  </Pressable>
                </View>

                <ChipsRow
                  subs={subMap[item.id] || []}
                  onPress={(s) =>
                    maybeNavigateCat({
                      ...item,
                      id: item.id,
                      name: item.name,
                      subcategoryId: s.id,
                    })
                  }
                />

                <FlatList
                  style={{ marginTop: 8 }}
                  horizontal
                  data={prodMap[item.id]?.rows || []}
                  keyExtractor={(p) => p.id}
                  removeClippedSubviews
                  initialNumToRender={10}
                  maxToRenderPerBatch={10}
                  windowSize={5}
                  renderItem={({ item: p }) => {
                    const isPan = isPanProd(p);
                    return (
                      <QuickTile
                        p={p}
                        isPan={isPan}
                        guard={maybeGate} // passes age gate logic
                      />
                    );
                  }}
                  extraData={cart}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingLeft: H }}
                />
              </View>
            )}
            onEndReached={loadMoreRows}
            onEndReachedThreshold={0.3}
            ListFooterComponent={() =>
              loadingMore ? (
                <Loader />
              ) : noMore ? (
                <Text style={{ textAlign: "center", margin: 12 }}>
                  No more products
                </Text>
              ) : null
            }
          />
        ) : hasPerm ? (
          <View style={[styles.center, { flex: 1 }]}>
            <Loader />
          </View>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        {hasPerm === false && selectManually === false && (
          <LocationPromptCard
            setHasPerm={setHasPerm}
            setSelectManually={setSelectManually}
          />
        )}
      </View>

      {/* ---------------- Pan Corner modal ---------------- */}
      <Modal
        visible={showGate}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGate(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setShowGate(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>{catAlert?.title}</Text>
            <Text style={styles.modalMsg}>{catAlert?.message}</Text>

            {!!catAlert?.linkUrl && (
              <TouchableOpacity
                onPress={() => Linking.openURL(catAlert.linkUrl)}
                style={styles.linkBtn}
              >
                <Text style={styles.linkTxt}>{catAlert.linkLabel}</Text>
              </TouchableOpacity>
            )}

            <View style={styles.rowButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.btnSecondary]}
                onPress={() => {
                  setShowGate(false);
                  vibrateCancel();
                }}
              >
                <Text style={styles.btnSecondaryTxt}>
                  {catAlert?.declineLabel}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.btnPrimary]}
                onPress={() => {
                  setAcceptedPan(true);
                  setShowGate(false);
                  setTimeout(() => onAcceptRef.current(), 120);
                }}
              >
                <Text style={styles.btnPrimaryTxt}>
                  {catAlert?.acceptLabel}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      <NotificationModal
        visible={isErrorModalVisible}
        message={errorMessage}
        confirmText="Change Location"
        onClose={() => {
          setIsErrorModalVisible(false);
          onErrorConfirm(); // run the stored callback
        }}
      />
    </>
  );
}
/* ------------------------------------------------------------------ STYLES (same + modal) */
const pastelGreen = "#e7f8f6";
const BORDER_CLR = "#e0e0e0";
const GAP_BG = "#f8f8f8"; // shows in the tiny gaps between thumbs

const styles = StyleSheet.create({
  /* ---- (unchanged styles from previous version plus modal styles) ---- */
  /* generic */
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  /* header */
  videoContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 0,
    overflow: "hidden",
  },
  backgroundVideo: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },
  topBg: {
    paddingHorizontal: H,
    paddingBottom: 16,
    position: "relative",
    zIndex: 1,
    backgroundColor: "transparent",
  },
  gradientHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  badge01: {
    backgroundColor: "#FF3D00",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
  },
  videoOverlay: {
    position: "relative",
    backgroundColor: "transparent",
    flex: 1,
  },
  locationRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  locationTxt: { flex: 1, fontSize: 14, fontWeight: "600", color: "#fff" },
  /* search */
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fafafa",
    borderRadius: 22,
    paddingVertical: 8,
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  searchTxt: { color: "#555", fontSize: 14 },
  /* intro ... (identical to previous) */
  quizCard: {
    margin: H,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#fff",
    elevation: 2,
  },
  mediaBox: { width: "100%", height: MOSAIC_W_GAME, backgroundColor: "#000" },
  loaderOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  quizOverlay: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 8,
  },
  quizTxt: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  /* errors */
  errorTxt: { color: "#c62828", textAlign: "center", margin: 12 },
  /* row header */
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: H,
    marginTop: 10,
    marginBottom: 8,
  },
  rowTitle: { flex: 1, fontSize: 16, fontWeight: "700", color: "#333" },
  seeAllTxt: { fontSize: 12, color: "#009688", fontWeight: "600" },
  /* chips */
  chip: {
    backgroundColor: "#e0f2f1",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 6,
  },
  chipTxt: { fontSize: 11, color: "#00695c", fontWeight: "600" },
  tile: {
    marginRight: 8,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 6,

    borderWidth: 1,
    borderColor: BORDER_CLR,

    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  mosaicCard: {
    width: MOSAIC_W,
    height: MOSAIC_W,
    borderRadius: 12,
    backgroundColor: "#f5f5f5",
    overflow: "hidden",
    marginRight: G,
    flexDirection: "row",
    flexWrap: "wrap",

    borderWidth: 1,
    borderColor: BORDER_CLR,
  },

  tileImg: {
    width: TILE_W - 12,
    height: TILE_W - 12,
    borderRadius: 6,
    alignSelf: "center",
  },
  discountTag: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "#d35400",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  discountTagTxt: { color: "#fff", fontSize: 9, fontWeight: "700" },
  tileName: { fontSize: 11, color: "#333", marginTop: 4, height: 28 },
  ribbon: {
    marginTop: 2,
    marginBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#004d40",
    borderRadius: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  priceNow: { fontSize: 12, fontWeight: "700", color: "#fff" },
  priceMRP: {
    fontSize: 10,
    color: "rgba(255,255,255,0.8)",
    textDecorationLine: "line-through",
    marginLeft: 4,
  },
  headerWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    elevation: 20,
  },
  cartBar: {
    position: "absolute",
    bottom: 6,
    left: 6,
    right: 6,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  cartBarAdd: { color: "#fff", fontWeight: "700", fontSize: 12 },
  qtyNum: {
    color: "#009688",
    fontWeight: "700",
    fontSize: 14,
    marginHorizontal: 10,
  },
  /* lane title */
  laneTitle: {
    marginTop: 25,
    marginBottom: 10,
    fontSize: 17,
    fontWeight: "700",
    color: "#333",
    marginHorizontal: H,
  },

  wholeCell: {
    width: "100%",
    height: "100%",
    borderWidth: 0, // ⟵ no inner border
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    overflow: "hidden",
  },

  fullWidthCell: {
    width: "100%",
    height: "50%",
    borderWidth: 0, // ⟵ no inner border
    backgroundColor: GAP_BG,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    overflow: "hidden",
  },

  halfCell: {
    width: "50%",
    height: "100%",
    borderWidth: 0,
    borderColor: BORDER_CLR,
    backgroundColor: GAP_BG,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    overflow: "hidden",
  },

  quarterCell: {
    width: "50%",
    height: "50%",
    borderWidth: 0.5,
    borderColor: BORDER_CLR,
    backgroundColor: GAP_BG,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    overflow: "hidden",
  },

  roundTL: { borderTopLeftRadius: 12 },
  roundBR: { borderBottomRightRadius: 12 },
  mosaicImg: {
    width: "88%", // a little breathing space all round
    height: "88%",
    alignSelf: "center",

    backgroundColor: "#fff", // keeps any transparent PNGs looking clean
    resizeMode: "contain",
  },
  morePill: {
    position: "absolute",
    bottom: 18,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  moreTxt: { color: "#fff", fontSize: 10, fontWeight: "700" },
  mosaicDeal: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "#e53935",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  mosaicDealTxt: { color: "#fff", fontSize: 9, fontWeight: "700" },
  cardLabel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    flexDirection: "row",
    alignItems: "center",
    padding: 4,
  },
  badge: {
    marginRight: 4,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  badgeTxt: { color: "#fff", fontSize: 9, fontWeight: "700" },
  cardTitle: { color: "#fff", fontSize: 12, fontWeight: "700", flex: 1 },
  /* bottom-sheet */
  locSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 32 : 20,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: -2 },
    elevation: 12,
  },
  locHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ccc",
    marginBottom: 12,
  },

  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "bold",
  },
  textRow: {
    flexDirection: "row",
    alignItems: "center",
    maxWidth: "80%",
    flexWrap: "wrap",
  },
  locHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  locTitle: { fontSize: 18, fontWeight: "700", color: "#333", marginLeft: 6 },
  locSub: { fontSize: 14, color: "#555", lineHeight: 20, marginBottom: 20 },
  locBtn: {
    paddingVertical: 14,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  locBtnPrimary: { backgroundColor: "#009688" },
  locBtnSecondary: { backgroundColor: "#e0f2f1" },
  locBtnTxtPrimary: { color: "#fff", fontSize: 16, fontWeight: "700" },
  locBtnTxtSecondary: { color: "#00796b", fontSize: 16, fontWeight: "700" },
  /* modal */
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    backgroundColor: pastelGreen,
    borderRadius: 14,
    padding: 20,
    elevation: 6,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    marginBottom: 10,
  },
  modalMsg: { fontSize: 14, color: "#555", lineHeight: 20, marginBottom: 16 },
  linkBtn: { marginBottom: 16, alignSelf: "flex-start" },
  linkTxt: {
    fontSize: 13,
    color: "#007aff",
    textDecorationLine: "underline",
    fontWeight: "600",
  },
  rowButtons: { flexDirection: "row", justifyContent: "flex-end" },
  modalBtn: {
    minWidth: 100,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    marginLeft: 8,
  },
  btnPrimary: { backgroundColor: "#009688" },
  btnPrimaryTxt: { color: "#fff", fontWeight: "700" },
  btnSecondary: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#bbb",
  },
  btnSecondaryTxt: { color: "#333", fontWeight: "600" },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#f5f5f5",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  locationText: {
    fontSize: 16,
    color: "#333",
    flex: 1,
  },
  changeLocationButton: {
    backgroundColor: "#4a90e2",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  changeLocationText: {
    color: "white",
    fontSize: 14,
    fontWeight: "500",
  },
});
