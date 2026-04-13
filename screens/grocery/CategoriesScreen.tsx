/* ------------------------------------------------------------------
   CategoriesScreen.tsx — 2025-06 Pan Corner age-gate v3
   • Age-gate now guards *adding* Pan Corner items too
   • Remembers acceptance for the session (only ask once)
------------------------------------------------------------------- */
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Modal,
  Animated,
  Linking,
  Pressable,
  Vibration,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import firestore from "@react-native-firebase/firestore";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Image } from "expo-image";

import { RootStackParamList } from "../../types/navigation";
import { StackNavigationProp } from "@react-navigation/stack";

import ProductCard from "../../components/ProductCard";
import ErrorModal from "../../components/ErrorModal";
import { useCart } from "../../context/CartContext";
import { useLocationContext } from "../../context/LocationContext";
import Loader from "@/components/VideoLoader";

/* ────────── types & helpers ────────── */
type CategoriesNav = StackNavigationProp<RootStackParamList, "CategoriesHome">;

type Category = { id: string; name: string; image: string; priority?: number };
type Product = {
  id: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
  discount?: number;
  categoryId?: string;
  description?: string; // added to match search usage
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

const { width } = Dimensions.get("window");
const CARD_W = (width - 48) / 3;

/* quick helper */
const isPanCorner = (p: { categoryId?: string; name: string }, catId: string) =>
  p.categoryId === catId || p.name.toLowerCase().includes("pan corner");

/* ────────── component ────────── */
const CategoriesScreen: React.FC = () => {
  const navigation = useNavigation<CategoriesNav>();
  const route = useRoute<any>();
  const { location } = useLocationContext();
  const { cart, addToCart, increaseQuantity, decreaseQuantity } = useCart();

  /* catalogue state */
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [didAutoOpen, setDidAutoOpen] = useState(false);

  /* Pan Corner gate state */
  const [catAlert, setCatAlert] = useState<CategoryAlert | null>(null);
  const [showGate, setShowGate] = useState(false);
  const [gateAction, setGateAction] = useState<() => void>(() => {});
  const [panAccepted, setPanAccepted] = useState(false); // remember acceptance

  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (!loading) return;
    const blink = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ])
      );
    const a1 = blink(dot1, 0);
    const a2 = blink(dot2, 200);
    const a3 = blink(dot3, 400);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [loading]);

  const visibleCategories = search.trim()
    ? categories.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase())
      )
    : categories;

  const visibleProducts = search.trim()
    ? products.filter((p) =>
        (p.name + (p.description ?? ""))
          .toLowerCase()
          .includes(search.toLowerCase())
      )
    : [];
  /* ────────── fetch alert doc once ────────── */
  useEffect(() => {
    firestore()
      .collection("category_alerts")
      .where("categoryId", "==", "Pan Corner")
      .limit(1)
      .get()
      .then((snap) => {
        if (!snap.empty) setCatAlert(snap.docs[0].data() as CategoryAlert);
      })
      .catch((e) => console.warn("[category_alerts] fetch", e));
  }, []);

  /* ────────── fetch catalogue on store change ────────── */
  useEffect(() => {
    if (!location.storeId) return;

    (async () => {
      try {
        setLoading(true);

        const catSnap = await firestore()
          .collection("categories")
          .where("storeId", "==", location.storeId)
          .get();

        const cats = catSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Category) }));
        cats.sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
        setCategories(cats);
        setError(null);
        setLoading(false);

        firestore()
          .collection("products")
          .where("storeId", "==", location.storeId)
          .where("quantity", ">", 0)
          .get()
          .then((prodSnap) => {
            setProducts(prodSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Product) })));
          })
          .catch((e) => console.warn("[Categories] products fetch", e));

        return;
        setError(null);
      } catch (e) {
        console.error("[Categories] fetch", e);
        setError("Couldn’t load catalogue. Pull to retry.");
      } finally {
        setLoading(false);
      }
    })();
  }, [location.storeId]);

  useEffect(() => {
    if (didAutoOpen) return;
    if (!route?.params?.autoOpenFirstCategory) return;
    if (!categories.length) return;
    setDidAutoOpen(true);
    navigation.navigate("ProductListingFromCats", {
      categoryId: categories[0].id,
      categoryName: categories[0].name,
    });
  }, [route?.params?.autoOpenFirstCategory, categories, didAutoOpen, navigation]);

  /* ────────── gate helper ────────── */
  const askGate = useCallback(
    (onAccept: () => void) => {
      if (panAccepted || !catAlert) {
        onAccept();
        return;
      }

      setGateAction(() => () => {
        setPanAccepted(true);
        onAccept();
      });
      setShowGate(true);
    },
    [catAlert, panAccepted]
  );

  /* category tap */
  const handleCategoryPress = (item: Category) => {
    const go = () =>
      navigation.navigate("ProductListingFromCats", {
        categoryId: item.id,
        categoryName: item.name,
      });

    catAlert && isPanCorner(item, catAlert.categoryId) ? askGate(go) : go();
  };

  /* product tap (search) */
  const handleProductPress = (item: Product) => {
    const go = () =>
      navigation.navigate("ProductDetail", { productId: item.id });

    catAlert && isPanCorner(item, catAlert.categoryId) ? askGate(go) : go();
  };

  /* add / increase wrappers */
  const attemptAdd = (item: Product, mode: "add" | "inc") => {
    const doAdd = () =>
      mode === "add"
        ? addToCart(item.id, item.quantity)
        : increaseQuantity(item.id, item.quantity);

    if (catAlert && isPanCorner(item, catAlert.categoryId) && !panAccepted) {
      askGate(doAdd);
      Vibration.vibrate(80); // gentle feedback on reject path
    } else {
      doAdd();
    }
  };

  /* ────────── renderers ────────── */
  const renderCategory = useCallback(({ item }: { item: Category }) => (
    <TouchableOpacity
      style={styles.catCard}
      onPress={() => handleCategoryPress(item)}
    >
      <Image
        source={{ uri: item.image }}
        style={styles.catImg}
        contentFit="cover"
        cachePolicy="disk"
        transition={120}
        recyclingKey={item.id}
        priority="high"
      />
      <Text style={styles.catTxt}>{item.name}</Text>
    </TouchableOpacity>
  ), []);

  const renderProduct = useCallback(({ item }: { item: Product }) => (
    <ProductCard
      style={styles.prodCardOverride}
      item={item}
      onPress={() => handleProductPress(item)}
      quantity={cart[item.id] ?? 0}
      onAddToCart={() => attemptAdd(item, "add")}
      onIncrease={() => attemptAdd(item, "inc")}
      onDecrease={() => decreaseQuantity(item.id)}
    />
  ), [cart, attemptAdd, decreaseQuantity]);

  const keyExtractor = useCallback((item: { id: string }) => item.id, []);

  /* ────────── UI ────────── */
  return (
    <SafeAreaView style={styles.safe}>
      {/* search bar */}
      <View style={styles.searchRow}>
        <MaterialIcons
          name="search"
          size={22}
          color="#555"
          style={styles.icn}
        />
        <TextInput
          style={styles.searchPlaceholder}
          placeholder="Search categories or products"
          placeholderTextColor="#777"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      {/* Loading Modal */}
      <Modal visible={loading} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.loadingModalOverlay}>
          <View style={styles.loadingModalCard}>
            <MaterialIcons name="shopping-cart" size={48} color="#007D34" style={{ marginBottom: 16 }} />
            <Text style={styles.loadingTitle}>Finding best grocery</Text>
            <Text style={styles.loadingSubtitle}>categories for you...</Text>
            <View style={styles.loadingDotsRow}>
              {[dot1, dot2, dot3].map((dot, i) => (
                <Animated.View key={i} style={[styles.loadingDot, { opacity: dot }]} />
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {loading ? null : error ? (
        <View style={styles.centerBox}>
          <Text style={styles.errTxt}>{error}</Text>
        </View>
      ) : search.trim() === "" ? (
        <FlatList
          data={visibleCategories}
          keyExtractor={keyExtractor}
          renderItem={renderCategory}
          numColumns={3}
          columnWrapperStyle={{ justifyContent: "flex-start" }}
          contentContainerStyle={{ padding: 16 }}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={5}
          removeClippedSubviews={true}
        />
      ) : (
        <FlatList
          data={visibleProducts}
          keyExtractor={keyExtractor}
          renderItem={renderProduct}
          numColumns={3}
          columnWrapperStyle={{ justifyContent: "flex-start" }}
          contentContainerStyle={{ padding: 16 }}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={5}
          removeClippedSubviews={true}
        />
      )}

      <ErrorModal
        visible={!!error}
        message={error ?? ""}
        onClose={() => setError(null)}
      />

      {/* ────────── Pan Corner modal ────────── */}
      <Modal
        visible={showGate}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGate(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setShowGate(false)}>
          <Pressable style={styles.modalCard}>
            <Text style={styles.modalTitle}>{catAlert?.title}</Text>
            <Text style={styles.modalMsg}>{catAlert?.message}</Text>

            <TouchableOpacity
              onPress={() => Linking.openURL(catAlert?.linkUrl ?? "")}
              style={styles.linkBtn}
            >
              <Text style={styles.linkTxt}>{catAlert?.linkLabel}</Text>
            </TouchableOpacity>

            <View style={styles.rowButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.btnSecondary]}
                onPress={() => setShowGate(false)}
              >
                <Text style={styles.btnSecondaryTxt}>
                  {catAlert?.declineLabel}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.btnPrimary]}
                onPress={() => {
                  setShowGate(false);
                  setPanAccepted(true);
                  setTimeout(() => gateAction(), 150); // after close anim
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
    </SafeAreaView>
  );
};

/* ────────── styles (unchanged) ────────── */
const pastelGreen = "#e7f8f6";

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f2f2f2" },

  /* search */
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    margin: 16,
    backgroundColor: "#fff",
    borderRadius: 25,
    paddingHorizontal: 14,
    elevation: 3,
  },
  icn: { marginRight: 4 },
  searchPlaceholder: {
    flex: 1,
    height: 44,
    lineHeight: 20,
    fontSize: 15,
    paddingVertical: 0,
    textAlignVertical: "center",
    color: "#777",
  },

  /* category */
  catCard: {
    width: CARD_W,
    marginRight: 8,
    marginBottom: 16,
    borderRadius: 14,
    backgroundColor: "#fff",
    elevation: 2,
    overflow: "hidden",
  },
  catImg: { width: "100%", aspectRatio: 1 },
  catTxt: {
    paddingVertical: 8,
    textAlign: "center",
    fontWeight: "600",
    color: "#333",
  },

  /* product override */
  prodCardOverride: { width: CARD_W, marginRight: 8, marginBottom: 16 },

  /* loading / error */
  centerBox: { flex: 1, justifyContent: "center", alignItems: "center" },
  errTxt: { color: "#e53935", fontSize: 16, textAlign: "center" },

  /* loading modal */
  loadingModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
    textAlign: 'center',
  },
  loadingSubtitle: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 20,
  },
  loadingDotsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  loadingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007D34',
  },

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
  modalMsg: {
    fontSize: 14,
    color: "#555",
    lineHeight: 20,
    marginBottom: 16,
  },
  linkBtn: { marginBottom: 16, alignSelf: "flex-start" },
  linkTxt: {
    fontSize: 13,
    color: "#007aff",
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
});

export default CategoriesScreen;

