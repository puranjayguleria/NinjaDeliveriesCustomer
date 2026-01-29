// screens/SearchScreen.tsx

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  View,
  Text,
  SectionList,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  ScrollView,
  Modal,
  Pressable,
  Linking,
  Vibration,
  Image,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import firestore from "@react-native-firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCart } from "@/context/CartContext";
import { useLocationContext } from "@/context/LocationContext";
import Loader from "@/components/VideoLoader";

const RECENT_KEY = "RECENT_SEARCHES";
const GUTTER = 8;
const COLUMN_COUNT = 4;
const H = 10;
const SCREEN_WIDTH = Dimensions.get("window").width;
const SEARCH_SCALE = 0.8;
const TILE_W = 120;
const TILE_H = 210; // match ProductsHomeScreen tile height
const TILE_WIDTH = (SCREEN_WIDTH - GUTTER * (COLUMN_COUNT + 1)) / COLUMN_COUNT;
const pastelGreen = "#e7f8f6";

/* Helper: pick an image URL field from a product object */
const firstImg = (p: any) =>
  p.imageUrl ||
  p.image ||
  (Array.isArray(p.images) && p.images[0]) ||
  p.thumbnail ||
  "";

type CategoryAlert = {
  categoryId: string;
  title: string;
  message: string;
  acceptLabel: string;
  declineLabel: string;
  linkLabel: string;
  linkUrl: string;
};

export default function SearchScreen() {
  const nav = useNavigation<any>();
  const { location } = useLocationContext();
  const { cart, addToCart, increaseQuantity, decreaseQuantity } = useCart();

  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [subsMap, setSubsMap] = useState<Record<string, any[]>>({});
  const [search, setSearch] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  /* Pan Corner age-gate */
  const [catAlert, setCatAlert] = useState<CategoryAlert | null>(null);
  const [acceptedPan, setAcceptedPan] = useState(false);
  const [showGate, setShowGate] = useState(false);
  const onAcceptRef = useRef<() => void>(() => {});
  const vibrateCancel = () => Vibration.vibrate(70);

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

  const isPanProduct = useCallback(
    (p: any) =>
      !!catAlert &&
      (p.categoryId === catAlert.categoryId ||
        (p.name || "").toLowerCase().includes("pan corner")),
    [catAlert]
  );

  const isPanCategory = useCallback(
    (c: any) =>
      !!catAlert &&
      (c.id === catAlert.categoryId ||
        (c.name || "").toLowerCase().includes("pan corner")),
    [catAlert]
  );

  const maybeGate = useCallback(
    (cb: () => void, shouldGate: boolean) => {
      if (!shouldGate || acceptedPan || !catAlert) {
        cb();
        return;
      }
      onAcceptRef.current = cb;
      setShowGate(true);
    },
    [acceptedPan, catAlert]
  );

  /* ───────── load recents & full catalog once ───────── */
  useEffect(() => {
    (async () => {
      const json = await AsyncStorage.getItem(RECENT_KEY);
      if (json) setRecent(JSON.parse(json));

      if (!location.storeId) {
        setLoading(false);
        return;
      }

      const [prodSnap, catSnap, subSnap] = await Promise.all([
        firestore()
          .collection("products")
          .where("storeId", "==", location.storeId)
          .where("quantity", ">", 0)
          .get(),
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

      setAllProducts(prodSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      const cats = catSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCategories(cats);

      const m: Record<string, any[]> = {};
      subSnap.docs.forEach((d) => {
        const s = { id: d.id, ...d.data() } as any;
        (m[s.categoryId] ||= []).push(s);
      });
      setSubsMap(m);

      setLoading(false);
    })();
  }, [location.storeId]);

  /* ───────── record recents ───────── */
  const onSubmit = useCallback(async () => {
    const term = search.trim();
    if (!term) return;
    const next = [term, ...recent.filter((r) => r !== term)].slice(0, 10);
    setRecent(next);
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
  }, [search, recent]);

  /* ───────── build sections ───────── */
  const sections = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];

    const matches = allProducts.filter((p) => {
      const name = (p.name || p.title || "").toLowerCase();
      const desc = (p.description || "").toLowerCase();
      const keywords = Array.isArray(p.keywords)
        ? p.keywords.map((k) => k.toLowerCase())
        : [];

      return (
        name.includes(q) ||
        desc.includes(q) ||
        keywords.some((kw) => kw.includes(q))
      );
    });

    const byCat: Record<string, any[]> = {};
    matches.forEach((p) => {
      (byCat[p.categoryId] ||= []).push(p);
    });

    return categories
      .filter((c) => byCat[c.id]?.length > 0)
      .map((c) => ({ category: c, data: byCat[c.id] }));
  }, [search, allProducts, categories]);

  /* ────────── local QuickTile (using same styling as ProductsHomeScreen) ────────── */
  const QuickTileLocal: React.FC<{ p: any }> = React.memo(
    ({ p }) => {
      const qty = cart[p.id] ?? 0;
      const discount = Number(p.discount ?? 0);
      const deal = discount > 0;

      const price =
        Math.round(
          (Number(p.price ?? 0) + Number(p.CGST ?? 0) + Number(p.SGST ?? 0)) *
            100
        ) / 100;

      const finalPrice = Math.round(Math.max(price - discount, 0) * 100) / 100;

      // Calculate discount percentage
      const discountPercent = deal ? Math.round((discount / price) * 100) : 0;
      const pan = isPanProduct(p);
      const imgUri = firstImg(p);

      const handleAdd = () => maybeGate(() => addToCart(p.id, p.quantity), pan);
      const handleInc = () =>
        maybeGate(() => increaseQuantity(p.id, p.quantity), pan);
      const handleDec = () => decreaseQuantity(p.id);

      return (
        <View style={[styles.tile, { width: TILE_W, height: TILE_H }]}>
          <Image
            source={imgUri ? { uri: imgUri } : undefined}
            style={styles.tileImg}
            resizeMode="contain"
          />

          {deal && (
            <View style={styles.discountTag}>
              <Text style={styles.discountTagTxt}>{discountPercent}% OFF</Text>
            </View>
          )}

          <Text style={styles.tileName} numberOfLines={2}>
            {p.name || p.title}
          </Text>

          <View style={styles.ribbon}>
            <Text style={styles.priceNow}>₹{price - p.discount}</Text>
            {deal && <Text style={styles.priceMRP}>₹{price}</Text>}
          </View>

          {qty === 0 ? (
            <Pressable
              style={[
                styles.cartBar,
                { backgroundColor: "#009688", borderColor: "#009688" },
              ]}
              onPress={handleAdd}
              android_ripple={{ color: "rgba(0,0,0,0.1)" }}
            >
              <Text style={styles.cartBarAdd}>ADD</Text>
            </Pressable>
          ) : (
            <View
              style={[
                styles.cartBar,
                { flexDirection: "row", borderColor: "#009688" },
              ]}
            >
              <Pressable
                onPress={handleDec}
                hitSlop={8}
                android_ripple={{ color: "rgba(0,0,0,0.1)" }}
              >
                <MaterialIcons name="remove" size={18} color="#009688" />
              </Pressable>
              <Text style={styles.qtyNum}>{qty}</Text>
              <Pressable
                onPress={handleInc}
                hitSlop={8}
                android_ripple={{ color: "rgba(0,0,0,0.1)" }}
              >
                <MaterialIcons name="add" size={18} color="#009688" />
              </Pressable>
            </View>
          )}
        </View>
      );
    },
    (prev, next) => prev.p.id === next.p.id && prev.qty === next.qty
  );

  /* ────────── loading state ────────── */
  if (loading) {
    return (
      <View style={styles.centerBox}>
        <Loader />
      </View>
    );
  }

  /* ────────── render ────────── */
  return (
    <>
      <SafeAreaView style={styles.safe}>
        {/* Search Bar + Back */}
        <View style={styles.searchRow}>
          <Pressable
            onPress={() => {
              if (nav.canGoBack()) {
                nav.goBack();
              } else {
                nav.navigate("Home", { screen: "ProductsHome" });
              }
            }}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <MaterialIcons
              name="arrow-back"
              size={22}
              color="#555"
              style={{ marginRight: 6 }}
            />
          </Pressable>
          <MaterialIcons
            name="search"
            size={20}
            color="#555"
            style={{ marginRight: 4 }}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products"
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={onSubmit}
            returnKeyType="search"
          />
          {search !== "" && (
            <Pressable onPress={() => setSearch("")} style={{ marginLeft: 4 }}>
              <MaterialIcons name="clear" size={20} color="#555" />
            </Pressable>
          )}
        </View>

        {search.trim() === "" ? (
          // Recent searches
          <ScrollView
            style={{ flex: 1, paddingHorizontal: GUTTER }}
            contentContainerStyle={{ paddingVertical: 12 }}
          >
            <Text style={styles.sectionTitle}>Recent searches</Text>
            <View style={styles.recentWrap}>
              {recent.length > 0 ? (
                recent.map((term) => (
                  <Pressable
                    key={term}
                    style={styles.recentChip}
                    onPress={() => setSearch(term)}
                    android_ripple={{ color: "rgba(0,0,0,0.1)" }}
                  >
                    <Text style={styles.recentTxt}>{term}</Text>
                  </Pressable>
                ))
              ) : (
                <Text style={styles.empty}>No recent searches</Text>
              )}
            </View>
          </ScrollView>
        ) : sections.length === 0 ? (
          <View style={styles.centerBox}>
            <Text style={{ color: "#777", fontSize: 14 }}>
              No products found.
            </Text>
          </View>
        ) : (
          // Results
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            stickySectionHeadersEnabled={false}
            renderSectionHeader={({ section }) => (
              <View>
                <View style={styles.rowHeader}>
                  <Text style={styles.rowTitle}>{section.category.name}</Text>
                  <Pressable
                    onPress={() =>
                      maybeGate(
                        () =>
                          nav.navigate("ProductListingFromHome", {
                            categoryId: section.category.id,
                            categoryName: section.category.name,
                            searchQuery: search,
                          }),
                        isPanCategory(section.category)
                      )
                    }
                    style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                  >
                    <Text style={styles.seeAllTxt}>See all</Text>
                  </Pressable>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingLeft: H, marginBottom: 6 }}
                >
                  {(subsMap[section.category.id] || []).map((sub) => (
                    <Pressable
                      key={sub.id}
                      style={styles.chip}
                      onPress={() =>
                        maybeGate(
                          () =>
                            nav.navigate("ProductListingFromHome", {
                              categoryId: section.category.id,
                              subcategoryId: sub.id,
                              categoryName: section.category.name,
                              searchQuery: search,
                            }),
                          isPanCategory(section.category)
                        )
                      }
                      android_ripple={{ color: "rgba(0,0,0,0.1)" }}
                    >
                      <Text style={styles.chipTxt}>{sub.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <FlatList
                  horizontal
                  data={section.data}
                  keyExtractor={(p) => p.id}
                  renderItem={({ item }) => (
                    <View
                      style={{
                        transform: [{ scale: SEARCH_SCALE }],
                        marginRight: GUTTER,
                      }}
                    >
                      <QuickTileLocal p={item} />
                    </View>
                  )}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingLeft: H, paddingBottom: 12 }}
                  extraData={cart}
                  initialNumToRender={4}
                />
              </View>
            )}
            renderItem={() => null}
            contentContainerStyle={{ paddingBottom: GUTTER }}
          />
        )}
      </SafeAreaView>

      {/* Pan Corner Alert Modal */}
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
              <Pressable
                onPress={() => Linking.openURL(catAlert.linkUrl)}
                style={styles.linkBtn}
                android_ripple={{ color: "rgba(0,0,0,0.1)" }}
              >
                <Text style={styles.linkTxt}>{catAlert.linkLabel}</Text>
              </Pressable>
            )}

            <View style={styles.rowButtons}>
              <Pressable
                style={[styles.modalBtn, styles.btnSecondary]}
                onPress={() => {
                  setShowGate(false);
                  vibrateCancel();
                }}
                android_ripple={{ color: "rgba(0,0,0,0.1)" }}
              >
                <Text style={styles.btnSecondaryTxt}>
                  {catAlert?.declineLabel}
                </Text>
              </Pressable>

              <Pressable
                style={[styles.modalBtn, styles.btnPrimary]}
                onPress={() => {
                  setAcceptedPan(true);
                  setShowGate(false);
                  setTimeout(() => onAcceptRef.current(), 120);
                }}
                android_ripple={{ color: "rgba(0,0,0,0.1)" }}
              >
                <Text style={styles.btnPrimaryTxt}>
                  {catAlert?.acceptLabel}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fdfdfd", paddingTop: 30 },
  centerBox: { flex: 1, justifyContent: "center", alignItems: "center" },

  /* search bar */
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    margin: GUTTER,
    backgroundColor: "#fff",
    borderRadius: 22,
    paddingHorizontal: 10,

    elevation: 2,
  },
  searchInput: { flex: 1, height: 40, fontSize: 14, color: "#222" },

  /* recent searches */
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
  },
  recentWrap: { flexDirection: "row", flexWrap: "wrap" },
  recentChip: {
    backgroundColor: "#e0f2f1",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    margin: 4,
  },
  recentTxt: { color: "#00695c", fontSize: 12, fontWeight: "500" },
  empty: { color: "#777", fontSize: 12, fontStyle: "italic" },

  /* section headers */
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: H,
    marginTop: 12,
    marginBottom: 4,
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

  /* tile styling (matched to ProductsHomeScreen) */
  tile: {
    marginRight: 8,
    backgroundColor: "#fff",
    borderRadius: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    padding: 6,
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

  /* modal overlay */
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
});
