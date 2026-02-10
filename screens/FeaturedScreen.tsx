// screens/FeaturedScreen.tsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  ImageBackground,
  Animated,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import firestore from "@react-native-firebase/firestore";
import { useNavigation } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { useCart } from "../context/CartContext";
import ProductCard from "../components/ProductCard";
import { useLocationContext } from "../context/LocationContext";
import Loader from "@/components/VideoLoader";
/***********************************************************
 * CONSTANTS & TYPES
 ***********************************************************/
const { width, height } = Dimensions.get("window");
const CARD_MARGIN = 6;
const GRID_COLUMNS = 3;
const GRID_CARD_WIDTH =
  (width - CARD_MARGIN * (GRID_COLUMNS * 2)) / GRID_COLUMNS;

interface EventAttributes {
  name: string;
  themeColor: string;
  bannerImage: string;
  emojis: string[];
}

/***********************************************************
 * COMPONENT
 ***********************************************************/
const FeaturedScreen: React.FC = () => {
  /* ----------------------------------------------------- */
  /*  HOOKS & CONTEXT                                      */
  /* ----------------------------------------------------- */
  const navigation = useNavigation();
  const { cart, addToCart, increaseQuantity, decreaseQuantity } = useCart();

  /* ----------------------------------------------------- */
  /*  STATE                                                */
  /* ----------------------------------------------------- */
  const [eventAttrs, setEventAttrs] = useState<EventAttributes | null>(null);
  const [activeSubcatIds, setActiveSubcatIds] = useState<string[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const { location } = useLocationContext();
  /* ----------------------------------------------------- */
  /*  DATA FETCHING                                        */
  /* ----------------------------------------------------- */
  const fetchEventAttributes = async (storeId: string) => {
    try {
      const doc = await firestore()
        .collection("event_attributes")
        .where("storeId", "==", storeId)
        .get();
      if (!doc.empty) {
        setEventAttrs(doc.docs[0].data() as EventAttributes);
      } else {
        setEventAttrs({
          name: "Coming Soon",
          themeColor: "#d32f2f",
          bannerImage:
            "https://via.placeholder.com/700x300.png?text=Event+Banner",
          emojis: ["🎉", "✨", "🔥"],
        });
      }
    } catch (err) {
      console.error("[Featured] fetchEventAttributes:", err);
    }
  };

  const fetchActiveSubcats = async (storeId: string) => {
    try {
      const snap = await firestore()
        .collection("subcategories")
        .where("eventEnabled", "==", true)
        .where("storeId", "==", storeId)
        .get();

      const ids = snap.docs.map((d) => d.id);
      setActiveSubcatIds(ids);
    } catch (err) {
      console.error("[Featured] fetchActiveSubcats:", err);
    }
  };

  useEffect(() => {
    console.log("[Featured] storeId =", location.storeId);
  }, [location.storeId]);

  const fetchProducts = async (subIds: string[], storeId: string) => {
    setLoading(true);
    try {
      if (subIds.length === 0) {
        setProducts([]);
        setFiltered([]);
        setLoading(false); // <-- add this
        return;
      }
      const snap = await firestore()
        .collection("products")
        .where("subcategoryId", "in", subIds)
        .where("storeId", "==", storeId)
        .get();
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((p) => p.quantity > 0)
        .sort((a, b) => (b.discount || 0) - (a.discount || 0));
      setProducts(data);
      setFiltered(data);
    } catch (err) {
      console.error("[Featured] fetchProducts:", err);
    } finally {
      setLoading(false);
    }
  };

  /* ----------------------------------------------------- */
  /*  EFFECTS                                              */
  /* ----------------------------------------------------- */
  useEffect(() => {
    if (!location.storeId) return; // wait for nearest-store resolution
    fetchEventAttributes(location.storeId);
    fetchActiveSubcats(location.storeId);
  }, [location.storeId]);

  useEffect(() => {
    if (activeSubcatIds.length > 0 && location.storeId) {
      fetchProducts(activeSubcatIds, location.storeId);
    }
  }, [activeSubcatIds, location.storeId]);

  // search filtering
  useEffect(() => {
    if (search.trim() === "") {
      setFiltered(products);
      return;
    }
    const q = search.toLowerCase();
    const res = products.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
    );
    res.sort((a, b) => (b.discount || 0) - (a.discount || 0));
    setFiltered(res);
  }, [search, products]);

  /* ----------------------------------------------------- */
  /*  DERIVED DATA                                         */
  /* ----------------------------------------------------- */
  const featuredProduct = useMemo(
    () => (filtered.length > 0 ? filtered[0] : null),
    [filtered]
  );
  const gridProducts = useMemo(
    () => (filtered.length > 1 ? filtered.slice(1) : []),
    [filtered]
  );

  /* ----------------------------------------------------- */
  /*  FLOATING EMOJIS                                      */
  /* ----------------------------------------------------- */
  const FloatingEmoji: React.FC<{ emoji: string }> = ({ emoji }) => {
    const translateY = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(1)).current;
    const x = Math.random() * (width - 40);

    useEffect(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -height * 0.5,
          duration: 4000 + Math.random() * 2000,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 4000 + Math.random() * 2000,
          useNativeDriver: true,
        }),
      ]).start();
    }, []);

    return (
      <Animated.View
        style={{
          position: "absolute",
          bottom: 0,
          left: x,
          transform: [{ translateY }],
          opacity,
        }}
      >
        <Text style={{ fontSize: 30 }}>{emoji}</Text>
      </Animated.View>
    );
  };

  const renderFloatingEmojis = () => {
    if (!eventAttrs?.emojis?.length) return null;
    const pool = Array.from({ length: 10 }).map(
      () =>
        eventAttrs.emojis[Math.floor(Math.random() * eventAttrs.emojis.length)]
    );
    return (
      <View style={styles.floatingEmojiContainer} pointerEvents="none">
        {pool.map((e, i) => (
          <FloatingEmoji key={i} emoji={e} />
        ))}
      </View>
    );
  };

  /* ----------------------------------------------------- */
  /*  RENDER: FEATURED HERO                                */
  /* ----------------------------------------------------- */
  const renderFeatured = () => {
    if (!featuredProduct) return null;
    const qty = cart[featuredProduct.id] || 0;

    return (
      <View style={styles.featuredContainer}>
        <ImageBackground
          source={{
            uri: featuredProduct.image || "https://via.placeholder.com/500",
          }}
          style={styles.featuredImage}
          resizeMode="cover"
        >
          <View style={styles.featuredOverlay}>
            <Text style={styles.featuredTitle}>{featuredProduct.name}</Text>
            <Text style={styles.featuredPrice}>₹{featuredProduct.price}</Text>
            {featuredProduct.discount && (
              <Text style={styles.featuredDiscount}>
                ₹{featuredProduct.discount} OFF
              </Text>
            )}
          </View>
        </ImageBackground>

        {qty === 0 ? (
          <TouchableOpacity
            style={styles.addToCartButton}
            onPress={() =>
              addToCart(featuredProduct.id, featuredProduct.quantity)
            }
          >
            <Text style={styles.addToCartText}>Add to Cart</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.plusMinusContainer}>
            <TouchableOpacity
              onPress={() => decreaseQuantity(featuredProduct.id)}
            >
              <MaterialIcons
                name="remove-circle"
                size={32}
                color="white"
              />
            </TouchableOpacity>
            <Text style={styles.quantityText}>{qty}</Text>
            <TouchableOpacity
              onPress={() =>
                increaseQuantity(featuredProduct.id, featuredProduct.quantity)
              }
            >
              <MaterialIcons
                name="add-circle"
                size={32}
                color="white"
              />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  /* ----------------------------------------------------- */
  /*  MAIN JSX                                             */
  /* ----------------------------------------------------- */
  return (
    <SafeAreaView style={styles.safeArea}>
      <View
        style={[
          styles.container,
          { backgroundColor: eventAttrs?.themeColor || "#fafafa" },
        ]}
      >
        {/* ---------- Banner ---------- */}
        {eventAttrs?.bannerImage ? (
          <ImageBackground
            source={{ uri: eventAttrs.bannerImage }}
            style={styles.banner}
            resizeMode="cover"
          >
            <View style={styles.bannerOverlay}>
              <Text style={styles.bannerText}>{eventAttrs.name}</Text>
            </View>
          </ImageBackground>
        ) : (
          <View
            style={[
              styles.header,
              { backgroundColor: eventAttrs?.themeColor || "#d32f2f" },
            ]}
          >
            <Text style={styles.headerTitle}>
              {eventAttrs?.name || "Event Specials"}
            </Text>
            <TouchableOpacity
              style={styles.continueButton}
              onPress={() => navigation.replace("Categories" as never)}
            >
              <Text style={styles.continueButtonText}>Browse All</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ---------- Body ---------- */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {/* search */}
          <View style={styles.searchContainer}>
            <MaterialIcons
              name="search"
              size={24}
              color="#555"
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchBar}
              placeholder="Search products…"
              placeholderTextColor="#999"
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearch("")}
                style={styles.clearIcon}
              >
                <MaterialIcons name="clear" size={24} color="#555" />
              </TouchableOpacity>
            )}
          </View>

          {/* hero */}
          {search.trim() === "" && renderFeatured()}

          {/* products grid */}
          {loading ? (
            <Loader />
          ) : (
            <View style={styles.gridContainer}>
              {(search.trim() !== "" ? filtered : gridProducts).map((item) => {
                const qty = cart[item.id] || 0;
                return (
                  <View
                    key={item.id}
                    style={[
                      styles.gridItemWrapper,
                      { width: GRID_CARD_WIDTH, margin: CARD_MARGIN },
                    ]}
                  >
                    <ProductCard
                      style={{ width: "100%", minHeight: 170 }}
                      item={item}
                      quantity={qty}
                      onAddToCart={() => addToCart(item.id, item.quantity)}
                      onIncrease={() =>
                        increaseQuantity(item.id, item.quantity)
                      }
                      onDecrease={() => decreaseQuantity(item.id)}
                    />
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* floating emojis */}
        {renderFloatingEmojis()}
      </View>
    </SafeAreaView>
  );
};

export default FeaturedScreen;

/***********************************************************
 * STYLESHEET
 ***********************************************************/
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f2f2f2" },
  container: { flex: 1 },

  /* banner / header */
  banner: { width: "100%", height: 180, justifyContent: "flex-end" },
  bannerOverlay: {
    backgroundColor: "rgba(0,0,0,0.4)",
    padding: 10,
    alignItems: "center",
  },
  bannerText: { fontSize: 28, fontWeight: "700", color: "#fff" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
  },
  headerTitle: { fontSize: 24, fontWeight: "700", color: "#fff" },
  continueButton: {
    backgroundColor: "#fff",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  continueButtonText: { color: "#d32f2f", fontSize: 14, fontWeight: "600" },

  /* search */
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    margin: 10,
    position: "relative",
  },
  searchIcon: { position: "absolute", left: 20, zIndex: 2 },
  searchBar: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 25,
    paddingLeft: 50,
    paddingRight: 50,
    height: 45,
    fontSize: 16,
    lineHeight: 20,
    paddingVertical: 0,
    textAlignVertical: "center",
    color: "#333",
    elevation: 3,
  },
  clearIcon: { position: "absolute", right: 20, zIndex: 2 },

  /* featured hero */
  featuredContainer: { width: "100%", marginBottom: 15 },
  featuredImage: { width: "100%", height: 250, justifyContent: "flex-end" },
  featuredOverlay: { backgroundColor: "rgba(0,0,0,0.3)", padding: 10 },
  featuredTitle: { fontSize: 26, fontWeight: "700", color: "#fff" },
  featuredPrice: {
    fontSize: 22,
    fontWeight: "600",
    color: "#fff",
    marginTop: 4,
  },
  featuredDiscount: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffeb3b",
    marginTop: 4,
  },
  addToCartButton: {
    backgroundColor: "#fff",
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: "center",
    borderRadius: 25,
    marginTop: 10,
  },
  addToCartText: { color: "#d32f2f", fontSize: 16, fontWeight: "600" },
  plusMinusContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    
     
  },
  quantityText: { color: "white",fontSize: 18, fontWeight: "600", marginHorizontal: 10 },

  /* grid */
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },
  gridItemWrapper: { overflow: "visible" },

  /* emojis */
  floatingEmojiContainer: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
});
