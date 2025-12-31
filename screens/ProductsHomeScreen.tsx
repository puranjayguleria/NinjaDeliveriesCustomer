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
  Easing,
  Dimensions,
  FlatList,
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
import auth from "@react-native-firebase/auth";
import { useNavigation } from "@react-navigation/native";
import * as Location from "expo-location";
import { Image } from "expo-image";
import { useLocationContext } from "@/context/LocationContext";
import { useCart } from "@/context/CartContext";
import NotificationModal from "../components/ErrorModal";
import Loader from "@/components/VideoLoader";
import { QuickTile } from "@/components/QuickTile";
import { useWeather } from "../context/WeatherContext"; // adjust path if needed
import BannerSwitcher from "@/components/BannerSwitcher";
import { VerticalSwitcher } from "@/components/VerticalSwitcher";

/* ------------------------------------------------------------------ CONSTANTS */
const INITIAL_VIDEO_HEIGHT = 180;
const COLLAPSED_VIDEO_HEIGHT = 100;
const INITIAL_PADDING_TOP = Platform.OS === "ios" ? 52 : 40;
const COLLAPSED_PADDING_TOP = Platform.OS === "ios" ? 44 : 32;
const PLACEHOLDER_BLURHASH = "LKO2?U%2Tw=w]~RBVZRi};ofM{ay"; // tiny generic blur


const { width } = Dimensions.get("window");
const H = 16;
const G = 20;
const MOSAIC_W = width * 0.35;
const MOSAIC_W_GAME = width * 0.5;
const SEARCH_PH = ["atta", "dal", "eggs", "biscuits", "coffee"];

// Show more products by increasing the row limit.
const GRID_ROWS = 2;
const GRID_COLUMNS = 4;
const PAGE_SIZE = 5;
const ROW_LIMIT = GRID_ROWS * GRID_COLUMNS;
const AnimatedSectionList = Animated.createAnimatedComponent(SectionList);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/* ------------------------------------------------------------------ helpers */

const firstImg = (p: any) =>
  p?.imageUrl ||
  p?.imageURL || // <- extra fallback (some payloads use this)
  p?.image ||
  (Array.isArray(p?.images) && p.images.length > 0 ? p.images[0] : null) ||
  p?.thumbnail ||
  p?.photoUrl ||
  "";

type PageBg = {
  enabled?: boolean;
  imageUrl?: string;
  resizeMode?: "cover" | "contain";
  overlayGradient?: string[];
  overlayOpacity?: number;
  activeFrom?: any;
  activeTo?: any;
};

const toRad = (d: number) => (d * Math.PI) / 180;
const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

const dateLabel = (ts?: any) => {
  const d =
    typeof ts?.toDate === "function"
      ? ts.toDate()
      : ts instanceof Date
      ? ts
      : null;
  if (!d) return "";
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const shortId = (s?: string) => (s ? `${s.slice(0, 4)}…${s.slice(-4)}` : "");

const latlng = (c?: { latitude?: number; longitude?: number }) =>
  c?.latitude != null && c?.longitude != null
    ? `${Number(c.latitude).toFixed(4)}, ${Number(c.longitude).toFixed(4)}`
    : "";

/* ------------------------------------------------------------------ types */

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

type LocationPromptProps = {
  setHasPerm: (v: boolean) => void;
  setSelectManually: (v: boolean) => void;
};

/* ------------------------------------------------------------------ location-prompt bottom-sheet */

const LocationPromptCard: React.FC<LocationPromptProps> = ({
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
  }, [updateLocation, setHasPerm, setSelectManually]);

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
      onPress={() => nav.navigate("LocationSelector", { fromScreen: "Products" })}
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
      style={[styles.searchWrapper, styles.searchGap]}
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
          <Image source={{ uri: url }} style={styles.mediaBox} resizeMode="cover" />
        )}
        <View style={styles.quizOverlay}>
          <Text style={styles.quizTxt}>
            {title || "Play Quiz & Earn Discounts"}
          </Text>
        </View>
      </Pressable>
    );
  },
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
              contentFit="contain"
              placeholder={{ blurhash: PLACEHOLDER_BLURHASH }}
              cachePolicy="disk"
              transition={160}
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
          <Text style={styles.mosaicDealTxt}>UP TO {maxDiscountPercent}% OFF</Text>
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

/* ------------------------------------------------------------------ search placeholder rotator */

const StableSearchBar = () => {
  const [phIdx, setPhIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(
      () => setPhIdx((prev) => (prev + 1) % SEARCH_PH.length),
      3000
    );
    return () => clearInterval(interval);
  }, []);

  return <SearchBar ph={SEARCH_PH[phIdx]} />;
};

/* ------------------------------------------------------------------ See all button (animated) */

const SeeAllButton: React.FC<{ onPress: () => void }> = ({ onPress }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const rotate = useRef(new Animated.Value(0)).current; // 0..1 -> -6deg..6deg

  useEffect(() => {
    const pulse = Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.08,
        duration: 700,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 700,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.delay(1200),
    ]);

    const wiggle = Animated.sequence([
      Animated.timing(rotate, {
        toValue: 1,
        duration: 250,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(rotate, {
        toValue: 0,
        duration: 250,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.delay(600),
    ]);

    const loop = Animated.loop(
      Animated.parallel([pulse, wiggle], { stopTogether: false })
    );
    loop.start();
    return () => loop.stop();
  }, [scale, rotate]);

  const rotateDeg = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["-6deg", "6deg"],
  });

  const handlePress = useCallback(() => {
    Vibration.vibrate(20);
    onPress();
  }, [onPress]);

  return (
    <AnimatedPressable
      onPress={handlePress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="See all products in this category"
      style={{ transform: [{ scale }] }}
    >
      <View style={styles.seeAllRow}>
        <Text style={styles.seeAllTxt}>See all</Text>
        <Animated.View style={{ transform: [{ rotate: rotateDeg }] }}>
          <MaterialIcons name="arrow-forward-ios" size={14} color="#009688" />
        </Animated.View>
      </View>
    </AnimatedPressable>
  );
};

/* ------------------------------------------------------------------ ReorderCard + RepeatLastOrderCard */

type ReorderCardProps = {
  order: any;
  lookup: Record<string, any>;
  onRepeat: () => void;
};


type RepeatLastOrderCardProps = {
  lastOrder: any | null;
  productLookupById: Record<string, any>;
  extraProductsById: Record<string, any>;
  setErrorMessage: (s: string) => void;
  setConfirmText: (s: string) => void;
  setOnErrorConfirm: (fn: () => void) => void;
  setIsErrorModalVisible: (v: boolean) => void;
};

// const RepeatLastOrderCard: React.FC<RepeatLastOrderCardProps> = ({
//   lastOrder,
//   productLookupById,
//   extraProductsById,
//   setErrorMessage,
//   setConfirmText,
//   setOnErrorConfirm,
//   setIsErrorModalVisible,
// }) => {
//   const { addToCart, addMultipleItems } = useCart() as any;
//   const nav = useNavigation<any>();

//   const handleRepeatOrder = useCallback(async () => {
//     if (!lastOrder || !(lastOrder.items || []).length) return;

//     const resolved = (lastOrder.items || []).map((it: any) => {
//       const id = it.productId || it.product?.id || it.id;

//       const prod =
//         (id && (productLookupById[id] || extraProductsById[id])) ||
//         it.product ||
//         it;

//       const name = prod?.name || it.name || "Item";
//       const reqQty = Number(it.quantity ?? 1);
//       const stock = Number(prod?.availableQuantity ?? prod?.quantity ?? 0);

//       const addQty = Math.max(0, Math.min(reqQty, stock));
//       return { id, name, reqQty, stock, addQty, prod };
//     });

//     const toAdd = resolved
//       .filter((r) => r.id && r.addQty > 0)
//       .map((r) => ({
//         productId: r.id,
//         quantity: r.addQty,
//         availableQuantity: r.stock,
//       }));

//     const skipped = resolved.filter((r) => r.addQty === 0);
//     const partial = resolved.filter((r) => r.addQty > 0 && r.addQty < r.reqQty);

//     if (toAdd.length) {
//       if (typeof addMultipleItems === "function") {
//         addMultipleItems(toAdd);
//       } else {
//         for (const { productId, quantity, availableQuantity } of toAdd) {
//           for (let i = 0; i < quantity; i++) {
//             addToCart(productId, availableQuantity);
//             // let the JS thread breathe a bit
//             // eslint-disable-next-line no-await-in-loop
//             await new Promise((r) => setTimeout(r, 0));
//           }
//         }
//       }
//     }

//     const addedUnits = toAdd.reduce((s, r) => s + (r.quantity ?? 0), 0);
//     const addedDistinct = toAdd.length;

//     const list = (
//       arr: { name: string; reqQty?: number; addQty?: number }[],
//       mapFn: (r: any) => string
//     ) => {
//       const parts = arr.map(mapFn);
//       const preview = parts.slice(0, 5).join(", ");
//       return parts.length > 5
//         ? `${preview} +${parts.length - 5} more`
//         : preview;
//     };

//     let msg = "";
//     if (addedUnits > 0) {
//       msg += `Added ${addedUnits} item${
//         addedUnits > 1 ? "s" : ""
//       } across ${addedDistinct} product${
//         addedDistinct > 1 ? "s" : ""
//       } from your last order.`;
//     } else {
//       msg += `Couldn’t add any items from your last order.`;
//     }

//     if (partial.length) {
//       msg += `\n\nPartially added: ${list(
//         partial,
//         (r) => `${r.name} (${r.addQty}/${r.reqQty})`
//       )}`;
//     }
//     if (skipped.length) {
//       msg += `\n\nOut of stock / unavailable: ${list(skipped, (r) => r.name)}`;
//     }

//     setConfirmText(addedUnits ? "Review Cart" : "OK");
//     setOnErrorConfirm(() => {
//       if (addedUnits) nav.navigate("CartFlow");
//     });
//     setErrorMessage(msg);
//     setIsErrorModalVisible(true);
//   }, [
//     lastOrder,
//     productLookupById,
//     extraProductsById,
//     addMultipleItems,
//     addToCart,
//     nav,
//     setConfirmText,
//     setErrorMessage,
//     setIsErrorModalVisible,
//     setOnErrorConfirm,
//   ]);

//   if (!lastOrder) return null;

//   return (
//     <ReorderCard
//       order={lastOrder}
//       lookup={{ ...productLookupById, ...extraProductsById }}
//       onRepeat={handleRepeatOrder}
//     />
//   );
// };

/* ------------------------------------------------------------------ multi-row grid */

const MultiRowProductGrid: React.FC<{
  products: any[];
  isPanProd: (p: any) => boolean;
  maybeGate: (cb: () => void, isPan: boolean) => void;
}> = ({ products, isPanProd, maybeGate }) => {
  const groupMap: Record<string, { items: any[]; total: number }> = {};

  products.forEach((p) => {
    const subId =
      (
        p.subcategoryId ||
        p.subCategoryId ||
        p.subcategory ||
        "unknown"
      ).toString();
    const weekly = Number(p.weeklySold ?? 0);
    if (!groupMap[subId]) {
      groupMap[subId] = { items: [], total: 0 };
    }
    groupMap[subId].items.push(p);
    groupMap[subId].total += weekly;
  });

  const groups = Object.entries(groupMap)
    .map(([id, g]) => ({ id, items: g.items, total: g.total }))
    .sort((a, b) => b.total - a.total);

  const DESIRED_COUNT = 7;
  const total = products.length;
  const maxPerRow = Math.floor(total / 2);
  const rowCount = Math.max(1, Math.min(DESIRED_COUNT, maxPerRow));

  const topGroups = groups.slice(0, 2);
  const rows: any[][] = [[], []];
  const usedIds: Set<string> = new Set();

  const tryPush = (rowIdx: number, item: any) => {
    if (rows[rowIdx].length >= rowCount) return;
    const idStr = String(item.id);
    if (!usedIds.has(idStr)) {
      rows[rowIdx].push(item);
      usedIds.add(idStr);
    }
  };

  if (topGroups.length >= 1) {
    topGroups[0].items.forEach((item: any) => {
      tryPush(0, item);
    });
  }
  if (topGroups.length >= 2) {
    topGroups[1].items.forEach((item: any) => {
      tryPush(1, item);
    });
  }

  const leftover: any[] = [];
  if (topGroups.length >= 1) {
    topGroups[0].items.forEach((item: any) => {
      if (!usedIds.has(String(item.id))) leftover.push(item);
    });
  }
  if (topGroups.length >= 2) {
    topGroups[1].items.forEach((item: any) => {
      if (!usedIds.has(String(item.id))) leftover.push(item);
    });
  }
  groups.slice(topGroups.length).forEach((grp) => {
    grp.items.forEach((item: any) => {
      if (!usedIds.has(String(item.id))) leftover.push(item);
    });
  });

  leftover.sort(
    (a, b) => Number(b.weeklySold ?? 0) - Number(a.weeklySold ?? 0)
  );

  let idx = 0;
  while (
    (rows[0].length < rowCount || rows[1].length < rowCount) &&
    idx < leftover.length
  ) {
    const targetRow = rows[0].length <= rows[1].length ? 0 : 1;
    const rowIdx =
      rows[targetRow].length < rowCount ? targetRow : 1 - targetRow;
    const item = leftover[idx++];
    const idStr = String(item.id);
    if (!usedIds.has(idStr)) {
      rows[rowIdx].push(item);
      usedIds.add(idStr);
    }
  }

  return (
    <View>
      {rows.map((rowItems, rowIdx) => (
        <ScrollView
          key={`row${rowIdx}`}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingLeft: H,
            marginTop: rowIdx === 0 ? 0 : 8,
          }}
          directionalLockEnabled
          alwaysBounceVertical={false}
        >
          {rowItems.map((p: any) => {
            const isPan = isPanProd(p);
            return (
              <View key={p.id} style={{ marginRight: 8 }}>
                <QuickTile p={p} isPan={isPan} guard={maybeGate} />
              </View>
            );
          })}
        </ScrollView>
      ))}
    </View>
  );
};

/* ------------------------------------------------------------------ MAIN */

export default function ProductsHomeScreen() {
  const nav = useNavigation<any>();
  const { location, updateLocation } = useLocationContext();

  const [lastOrder, setLastOrder] = useState<any | null>(null);
  const [buyAgainItems, setBuyAgainItems] = useState<any[]>([]);
  const [confirmText, setConfirmText] = useState<string>("OK");

  const [headerGradientColors, setHeaderGradientColors] = useState<string[]>([
    "#00b4a0",
    "#00d2c7",
    "#ffffff",
  ]); // fallback defaults

  const [activeVerticalMode, setActiveVerticalMode] =
    useState<"grocery" | "restaurants">("grocery");
    
  /* ========== Pan Corner age-gate state ========== */
  const [catAlert, setCatAlert] = useState<CategoryAlert | null>(null);
  const [acceptedPan, setAcceptedPan] = useState(false);
  const [showGate, setShowGate] = useState(false);
  const onAcceptRef = useRef<() => void>(() => {});
  const vibrateCancel = () => Vibration.vibrate(70);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isErrorModalVisible, setIsErrorModalVisible] = useState(false);

  // ensure initial value is a function, not undefined
  const [onErrorConfirm, setOnErrorConfirm] = useState<() => void>(() => () => {});

  const [pageBg, setPageBg] = useState<PageBg | null>(null);
  const [extraProductsById, setExtraProductsById] = useState<Record<string, any>>(
    {}
  );

  /* ------------------------------------------------------------------ Reorder fetch & config */

  // pull gradient colors for the collapsing header from Firestore
  useEffect(() => {
    if (!location.storeId) {
      setHeaderGradientColors(["#00b4a0", "#00d2c7", "#ffffff"]);
      return;
    }

    const unsub = firestore()
      .collection("config")
      .where("storeId", "==", location.storeId)
      .limit(1)
      .onSnapshot(
        (snap) => {
          const d = snap.docs[0]?.data() as any;

          const arr = Array.isArray(d?.headerGradientColors)
            ? d.headerGradientColors.filter(
                (c: unknown) =>
                  typeof c === "string" &&
                  (/^#/.test(c) || /^rgb/.test(c) || /^hsl/.test(c))
              )
            : null;

          setHeaderGradientColors(
            arr && arr.length ? arr : ["#00b4a0", "#00d2c7", "#ffffff"]
          );
        },
        () => setHeaderGradientColors(["#00b4a0", "#00d2c7", "#ffffff"])
      );

    return unsub;
  }, [location.storeId]);

  useEffect(() => {
    const currentUser = auth().currentUser;

    // If no user or no store selected yet, clear Buy Again
    if (!currentUser || !location.storeId) {
      setLastOrder(null);
      setBuyAgainItems([]);
      return;
    }

    const fetchOrders = async () => {
      // Latest orders for this user *for this store only*
      const snap = await firestore()
        .collection("orders")
        .where("orderedBy", "==", currentUser.uid)
        .where("storeId", "==", location.storeId)
        .orderBy("createdAt", "desc")
        .limit(20)
        .get();

      if (snap.empty) {
        setLastOrder(null);
        setBuyAgainItems([]);
        return;
      }

      // First order with status = tripEnded (case-insensitive)
      const latestCompleted = snap.docs.find((doc) => {
        const status = String(doc.data().status || "").toLowerCase();
        return status === "tripended";
      });

      if (!latestCompleted) {
        setLastOrder(null);
        setBuyAgainItems([]);
        return;
      }

      const data = latestCompleted.data();
      const items: any[] = data.items || [];

      setLastOrder({
        id: latestCompleted.id,
        items,
        createdAt: data.createdAt,
        status: data.status,
      });

      // Build Buy Again list from THIS order only (distinct products)
      const byId: Record<string, any> = {};
      items.forEach((it: any) => {
        const rawProd = it.product || it;
        const id = it.productId || rawProd.id || rawProd.productId;
        if (!id) return;
        byId[id] = { ...rawProd, id };
      });

      setBuyAgainItems(Object.values(byId));
    };

    fetchOrders();
  }, [location.storeId]);

  useEffect(() => {
    if (!location.storeId) {
      setPageBg(null);
      return;
    }

    const q = firestore()
      .collection("page_backgrounds")
      .where("storeId", "==", location.storeId)
      .where("page", "==", "home")
      .limit(1);

    const unsub = q.onSnapshot(
      (snap) => {
        const d = snap.docs[0]?.data() as PageBg | undefined;
        if (!d || d.enabled === false) {
          setPageBg(null);
          return;
        }

        const now = Date.now();
        const fromOk = !d.activeFrom || new Date(d.activeFrom).getTime() <= now;
        const toOk = !d.activeTo || new Date(d.activeTo).getTime() >= now;
        setPageBg(fromOk && toOk ? d : null);
      },
      () => setPageBg(null)
    );

    return unsub;
  }, [location.storeId]);

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

  /* ------------------------------------------------------------------ permissions / location */

  const [hasPerm, setHasPerm] = useState<boolean | null>(null);
  const [selectManually, setSelectManually] = useState(false);

  useEffect(() => {
    Location.getForegroundPermissionsAsync().then((r) => {
      setHasPerm(r.status === "granted");
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

      const showErrorModal = (
        message: string,
        onConfirm?: () => void,
        confirm: string = "OK"
      ) => {
        setErrorMessage(message);
        setConfirmText(confirm);
        if (onConfirm) setOnErrorConfirm(() => onConfirm);
        else setOnErrorConfirm(() => () => {});
        setIsErrorModalVisible(true);
      };

      if (!picked) {
        showErrorModal(
          "Sorry, we don’t deliver to your current location.",
          () => nav.navigate("LocationSelector", { fromScreen: "Products" }),
          "Change Location"
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
      } catch (_) {
        // ignore
      }

      updateLocation({ storeId: picked.storeId, address: addr });
    },
    [zones, location.storeId, updateLocation, nav, setErrorMessage, setConfirmText]
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
      } catch {
        // ignore
      }
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

  /* ------------------------------------------------------------------ intro media (quiz) */

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

  /* ------------------------------------------------------------------ catalogue */

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
      // ignore
    } finally {
      pending.current = false;
      setLoadingMore(false);
    }
  }, [cats, page, noMore, location.storeId]);


  // 🚀 Keep loading more categories in the background,
// without waiting for the user to reach the end of the list.
useEffect(() => {
  if (!location.storeId) return;
  if (!cats.length) return;
  if (noMore) return;

  const totalPages = Math.ceil(cats.length / PAGE_SIZE);

  // If there are still pages whose products we haven't fetched,
  // keep pre-loading them sequentially in the background.
  if (page < totalPages && !pending.current) {
    loadMoreRows();
  }
}, [location.storeId, cats, page, noMore, loadMoreRows]);

  /* ------------------------------------------------------------------ store-wide highlights */

  const [bestProducts, setBestProducts] = useState<any[]>([]);
  const [freshProducts, setFreshProducts] = useState<any[]>([]);

  const productLookupById = useMemo(() => {
    const map: Record<string, any> = {};
    Object.values(prodMap || {}).forEach(({ rows }) => {
      rows?.forEach((p: any) => {
        if (p?.id) map[p.id] = p;
      });
    });
    bestProducts.forEach((p) => {
      if (p?.id) map[p.id] = p;
    });
    freshProducts.forEach((p) => {
      if (p?.id) map[p.id] = p;
    });
    Object.assign(map, extraProductsById);
    return map;
  }, [prodMap, bestProducts, freshProducts, extraProductsById]);

  // Hydrate products referenced by lastOrder & buyAgainItems so images/stock work
  useEffect(() => {
    if (!location.storeId) return;

    const rawIds: string[] = [];

    if (lastOrder?.items?.length) {
      rawIds.push(
        ...(lastOrder.items || [])
          .map((it: any) => it.productId || it.product?.id || it.id)
          .filter(Boolean)
      );
    }

    if (buyAgainItems?.length) {
      rawIds.push(
        ...buyAgainItems
          .map((raw: any) => raw?.id || raw?.productId || raw?.product?.id)
          .filter(Boolean)
      );
    }

    const needIds = Array.from(
      new Set(
        rawIds.filter(
          (id: string) => !productLookupById[id] && !extraProductsById[id]
        )
      )
    );
    if (!needIds.length) return;

    const chunks: string[][] = [];
    for (let i = 0; i < needIds.length; i += 10) {
      chunks.push(needIds.slice(i, i + 10));
    }

    const fetchChunk = async (ids: string[]) => {
      const snap = await firestore()
        .collection("products")
        .where("storeId", "==", location.storeId)
        .where(firestore.FieldPath.documentId(), "in", ids as any)
        .get();
      const acc: Record<string, any> = {};
      snap.docs.forEach((doc) => (acc[doc.id] = { id: doc.id, ...doc.data() }));
      return acc;
    };

    (async () => {
      const merged: Record<string, any> = {};
      for (const ids of chunks) {
        try {
          Object.assign(merged, await fetchChunk(ids));
        } catch (e) {
          console.warn("[hydrate supplemental products]", e);
        }
      }
      if (Object.keys(merged).length) {
        setExtraProductsById((prev) => ({ ...prev, ...merged }));
      }
    })();
  }, [
    location.storeId,
    lastOrder,
    buyAgainItems,
    productLookupById,
    extraProductsById,
  ]);

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

  const bestHeader = useMemo(() => groupByCat(bestProducts), [bestProducts, groupByCat]);
  const freshHeader = useMemo(
    () => groupByCat(freshProducts),
    [freshProducts, groupByCat]
  );

  const sections = useMemo(() => {
    const loaded = cats.slice(0, page * PAGE_SIZE);
    const data: any[] = [...loaded];
    return [{ data }];
  }, [cats, page]);

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

  const listExtraData = useMemo(() => prodMap, [prodMap]);

  const buyAgainResolved = useMemo(() => {
    if (!buyAgainItems?.length) return [];
    return buyAgainItems
      .map((raw) => {
        const id = raw?.id || raw?.productId || raw?.product?.id;
        return id ? productLookupById[id] : null;
      })
      .filter((p: any) => p && (p.quantity ?? 0) > 0);
  }, [buyAgainItems, productLookupById]);

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
          createdAt: data.createdAt?.toDate?.() ?? null,
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

  const listHeader = (
    <>
      {/* Promotional banners */}
      <BannerSwitcher storeId={location.storeId} />

      {/* Last order → Repeat order card */}
     

      {/* Buy again section using existing QuickTile cards */}
      {buyAgainResolved.length > 0 && (
        <View>
          <Text style={styles.buyAgainTitle}>Buy Again</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingLeft: H,
              paddingBottom: 16,
              paddingRight: H,
            }}
          >
            {buyAgainResolved.map((p: any) => {
              const id = p?.id || p?.productId;
              if (!id) return null;
              const isPan = isPanProd(p);
              return (
                <View key={id} style={{ marginRight: 8 }}>
                  <QuickTile p={p} isPan={isPan} guard={maybeGate} />
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}
    </>
  );

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

  if (hasPerm === null) {
    return (
      <View style={[styles.center, { flex: 1 }]}>
        <Loader />
      </View>
    );
  }
  const navigation = useNavigation<any>();

const handleModeChange = (mode: "grocery" | "restaurants") => {
  if (mode === "restaurants") {
    requestAnimationFrame(() => {
      navigation.replace("NinjaEatsTabs");
    });
  }
  // grocery → already on ProductsHome
};

  return (
    <>
      <View
        style={{
          flex: 1,
          position: "relative",
          backgroundColor: pageBg ? "transparent" : "#fdfdfd",
        }}
      >
        {/* UNDERLAY: page background */}
        {pageBg ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {pageBg.imageUrl ? (
              <Image
                source={{ uri: pageBg.imageUrl }}
                style={StyleSheet.absoluteFill}
                contentFit={pageBg.resizeMode || "cover"}
                placeholder={{ blurhash: PLACEHOLDER_BLURHASH }}
                cachePolicy="disk"
                transition={200}
              />
            ) : null}

            {pageBg.overlayGradient && pageBg.overlayGradient.length > 0 ? (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { opacity: pageBg.overlayOpacity ?? 1 },
                ]}
              >
                <LinearGradient
                  colors={pageBg.overlayGradient}
                  style={StyleSheet.absoluteFill}
                />
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Collapsing header + background video */}
        <Animated.View
          pointerEvents="box-none"
          style={[styles.headerWrapper, { paddingTop: topPadding }]}
        >
          {/* Background video */}
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

          {/* Gradient overlay */}
                  {/* Gradient overlay */}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { opacity: gradientOpacity }]}
        >
          <LinearGradient
            colors={headerGradientColors}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

<View style={styles.topBg}>
  <Header />

  {/* Search bar */}
  <View style={styles.searchFlex}>
    <StableSearchBar />
  </View>

  {/* Vertical switcher BELOW search */}
  {/* <View style={styles.verticalSwitcherRow}>
    <VerticalSwitcher
      active={activeVerticalMode}
      onChange={handleModeChange}
    />
  </View> */}
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
            contentContainerStyle={{ paddingTop: INITIAL_VIDEO_HEIGHT  }}
            sections={sections}
            ListHeaderComponent={listHeader}
            renderSectionHeader={renderSectionHeader}
            keyExtractor={(item) => item.id}
            extraData={listExtraData}
            renderItem={({ item }) => {
              if (!item?.id || !item?.name) return null;

              const data = prodMap[item.id]?.rows || [];
              return (
                <View style={{ marginTop: 32 }}>
                  <View style={styles.rowHeader}>
                    <Text style={styles.rowTitle}>{item.name}</Text>
                    <SeeAllButton onPress={() => maybeNavigateCat(item)} />
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

                  <MultiRowProductGrid
                    products={data}
                    isPanProd={isPanProd}
                    maybeGate={maybeGate}
                  />
                </View>
              );
            }}
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
                <Text style={styles.btnSecondaryTxt}>{catAlert?.declineLabel}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.btnPrimary]}
                onPress={() => {
                  setAcceptedPan(true);
                  setShowGate(false);
                  setTimeout(() => onAcceptRef.current(), 120);
                }}
              >
                <Text style={styles.btnPrimaryTxt}>{catAlert?.acceptLabel}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <NotificationModal
        visible={isErrorModalVisible}
        message={errorMessage}
        confirmText={confirmText}
        onClose={() => {
          setIsErrorModalVisible(false);
          onErrorConfirm();
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------------ STYLES */

const pastelGreen = "#e7f8f6";
const BORDER_CLR = "#e0e0e0";
const GAP_BG = "#f8f8f8";

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  videoContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 0,
    overflow: "hidden",
  },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
pillActive: {
  backgroundColor: '#00b4a0', // Ninja green accent for active
},
label: { fontSize: 12, fontWeight: '600', color: '#333' },
labelActive: { color: '#fff' },
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
  locationRow: {
  flexDirection: "row",
  alignItems: "center",
  marginBottom: 10,
  // no paddingHorizontal here – topBg already has it
},

  locationTxt: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
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
  // remove marginHorizontal – topBg already handles left/right padding
},
  searchTxt: { color: "#555", fontSize: 14 },
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
  errorTxt: { color: "#c62828", textAlign: "center", margin: 12 },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: H,
    marginTop: 10,
    marginBottom: 8,
  },
  rowTitle: { flex: 1, fontSize: 16, fontWeight: "700", color: "#333" },
  seeAllTxt: { fontSize: 12, color: "#009688", fontWeight: "600" },
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
  mosaicImg: {
    width: "88%",
    height: "88%",
    alignSelf: "center",
    backgroundColor: "#fff",
    resizeMode: "contain",
  },
  wholeCell: {
    width: "100%",
    height: "100%",
    borderWidth: 0,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    overflow: "hidden",
  },
  fullWidthCell: {
    width: "100%",
    height: "50%",
    borderWidth: 0,
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
  headerWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    elevation: 20,
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
  locHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
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
  laneTitle: {
    marginTop: 25,
    marginBottom: 10,
    fontSize: 17,
    fontWeight: "700",
    color: "#333",
    marginHorizontal: H,
  },
  seeAllRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  descriptionContainer: {
    position: "absolute",
    bottom: 30,
    left: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  descriptionText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  reorderCardUp: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginHorizontal: H,
    marginTop: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e8e8e8",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  reorderHeadRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  reorderTitle: { fontSize: 16, fontWeight: "700", color: "#2f2f2f" },
  reorderDate: { fontSize: 12, color: "#777", fontWeight: "600" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#e0f2f1",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pillStatus: { backgroundColor: "#26a69a" },
  pillText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  pillTextDark: { color: "#00695c", fontSize: 11, fontWeight: "700" },
  addrRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  addrChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  addrText: { fontSize: 12, color: "#555", fontWeight: "600" },
  actionsRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  repeatBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#009688",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexShrink: 0,
  },
  repeatBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  buyAgainTitle: {
    marginTop: 24,
    marginBottom: 8,
    marginHorizontal: H,
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
  },
  reorderTile: {
    width: 100,
    marginRight: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 6,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  reorderTileImg: {
    width: "100%",
    height: 60,
    borderRadius: 6,
    backgroundColor: "#f0f0f0",
  },
  reorderTileName: {
    fontSize: 12,
    color: "#333",
    marginTop: 4,
  },
  reorderTileQtyBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#009688",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 8,
  },
  reorderTileQtyText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  reorderMoreCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },
  reorderMoreText: {
    color: "#555",
    fontSize: 12,
    fontWeight: "600",
  },
verticalSwitcherRow: {
  marginTop: 8,          // space below search bar
  alignSelf: "flex-start", // or "center" if you prefer
},


searchSwitchRow: {
  flexDirection: "row",
  alignItems: "center",
  marginTop: 6,
},

searchFlex: {
  flex: 1,
  marginRight: 22,
},
});
