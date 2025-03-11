// ./screens/FeaturedScreen.tsx

import React, { useEffect, useRef, useState } from "react";
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
import firestore from "@react-native-firebase/firestore";
import { useNavigation } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { useCart } from "../context/CartContext";
import ProductCard from "../components/ProductCard";

const { width, height } = Dimensions.get("window");

// Event Attributes type
type EventAttributes = {
  name: string;
  themeColor: string; 
  bannerImage: string; 
  emojis: string[];
};

const FeaturedScreen: React.FC = () => {
  const navigation = useNavigation();
  const { cart, addToCart, increaseQuantity, decreaseQuantity } = useCart();

  // Product data states
  const [products, setProducts] = useState<any[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loadingProducts, setLoadingProducts] = useState<boolean>(false);

  // Event & subcategory states
  const [eventAttributes, setEventAttributes] = useState<EventAttributes | null>(null);
  const [activeSubcatIds, setActiveSubcatIds] = useState<string[]>([]);

  // Layout for grid: 3 columns with a small margin
  const cardMargin = 6;
  const columns = 3;
  const gridCardWidth = (width - cardMargin * (columns * 2)) / columns;

  // 1) Fetch event attributes
  const fetchEventAttributes = async () => {
    try {
      const doc = await firestore()
        .collection("event_attributes")
        .doc("current")
        .get();
      if (doc.exists) {
        setEventAttributes(doc.data() as EventAttributes);
      } else {
        setEventAttributes({
          name: "Valentine's Day Specials",
          themeColor: "#d32f2f",
          bannerImage: "https://example.com/valentines-banner.jpg",
          emojis: ["❤️", "💖", "💕", "😍"],
        });
      }
    } catch (error) {
      console.error("Error fetching event attributes:", error);
    }
  };

  // 2) Fetch active subcategory IDs
  const fetchActiveSubcategoryIDs = async () => {
    try {
      const snapshot = await firestore()
        .collection("subcategories")
        .where("eventEnabled", "==", true)
        .get();
      const subcatIds = snapshot.docs.map(doc => doc.id);
      if (subcatIds.length === 0) {
        navigation.replace("Categories");
      } else {
        setActiveSubcatIds(subcatIds);
      }
    } catch (error) {
      console.error("Error fetching subcategories:", error);
    }
  };

  // 3) Fetch products
  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      if (activeSubcatIds.length > 0) {
        const snapshot = await firestore()
          .collection("products")
          .where("subcategoryId", "in", activeSubcatIds)
          .get();
        const productData = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((p) => p.quantity > 0)
          .sort((a, b) => (b.discount || 0) - (a.discount || 0));
        setProducts(productData);
        setFilteredProducts(productData);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    fetchEventAttributes();
    fetchActiveSubcategoryIDs();
  }, []);

  useEffect(() => {
    if (activeSubcatIds.length > 0) {
      fetchProducts();
    }
  }, [activeSubcatIds]);

  // 4) Search filter
  useEffect(() => {
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      const filtered = products.filter(
        (p) =>
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.description && p.description.toLowerCase().includes(q))
      );
      filtered.sort((a, b) => (b.discount || 0) - (a.discount || 0));
      setFilteredProducts(filtered);
    } else {
      setFilteredProducts(products);
    }
  }, [searchQuery, products]);

  // 5) Determine featured and grid products
  const featuredProduct = filteredProducts.length > 0 ? filteredProducts[0] : null;
  const gridProducts = filteredProducts.length > 1 ? filteredProducts.slice(1) : [];

  // 6) Floating emojis
  const FloatingEmoji: React.FC<{ emoji: string }> = ({ emoji }) => {
    const translateY = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(1)).current;
    const horizontalPosition = Math.random() * (width - 40);
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
    }, [translateY, opacity]);
    return (
      <Animated.View
        style={{
          position: "absolute",
          bottom: 0,
          left: horizontalPosition,
          transform: [{ translateY }],
          opacity,
        }}
      >
        <Text style={{ fontSize: 30 }}>{emoji}</Text>
      </Animated.View>
    );
  };

  const renderFloatingEmojis = () => {
    if (!eventAttributes?.emojis || eventAttributes.emojis.length === 0) return null;
    const emojis = Array.from({ length: 10 }).map(
      () => eventAttributes.emojis[Math.floor(Math.random() * eventAttributes.emojis.length)]
    );
    return (
      <View style={styles.floatingEmojiContainer} pointerEvents="none">
        {emojis.map((emoji, index) => (
          <FloatingEmoji key={index} emoji={emoji} />
        ))}
      </View>
    );
  };

  // 7) Render Featured Product (only if not searching)
  const renderFeaturedProduct = () => {
    if (!featuredProduct) return null;
    const quantityInCart = cart[featuredProduct.id] || 0;

    return (
      <View style={styles.featuredContainer}>
        <ImageBackground
          source={{ uri: featuredProduct.image || "https://via.placeholder.com/350" }}
          style={styles.featuredImage}
          resizeMode="cover"
        >
          <View style={styles.featuredOverlay}>
            <Text style={styles.featuredTitle}>{featuredProduct.name}</Text>
            <Text style={styles.featuredPrice}>₹{featuredProduct.price}</Text>
            {featuredProduct.discount && (
              <Text style={styles.featuredDiscount}>
                Discount: ₹{featuredProduct.discount} OFF
              </Text>
            )}
          </View>
        </ImageBackground>
        {quantityInCart === 0 ? (
          <TouchableOpacity
            style={styles.addToCartButton}
            onPress={() => addToCart(featuredProduct.id, featuredProduct.quantity)}
          >
            <Text style={styles.addToCartText}>Add to Cart</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.plusMinusContainer}>
            <TouchableOpacity onPress={() => decreaseQuantity(featuredProduct.id)}>
              <MaterialIcons name="remove-circle" size={32} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.quantityText}>{quantityInCart}</Text>
            <TouchableOpacity onPress={() => increaseQuantity(featuredProduct.id, featuredProduct.quantity)}>
              <MaterialIcons name="add-circle" size={32} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // 8) Scrollable layout with search, featured (if no search), and grid
  return (
    <View style={[styles.container, { backgroundColor: eventAttributes?.themeColor || "#FAFAFA" }]}>
      {/* Banner */}
      {eventAttributes?.bannerImage ? (
        <ImageBackground
          source={{ uri: eventAttributes.bannerImage }}
          style={styles.banner}
          resizeMode="cover"
        >
          <View style={styles.bannerOverlay}>
            <Text style={styles.bannerText}>{eventAttributes.name}</Text>
          </View>
        </ImageBackground>
      ) : (
        <View style={[styles.header, { backgroundColor: eventAttributes?.themeColor || "#d32f2f" }]}>
          <Text style={styles.headerTitle}>{eventAttributes?.name || "Event Specials"}</Text>
          <TouchableOpacity style={styles.continueButton} onPress={() => navigation.replace("Categories")}>
            <Text style={styles.continueButtonText}>Browse All</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Main Scrollable Content */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <MaterialIcons name="search" size={24} color="#555" style={styles.searchIcon} />
          <TextInput
            style={styles.searchBar}
            placeholder="Search products..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearIcon}>
              <MaterialIcons name="clear" size={24} color="#555" />
            </TouchableOpacity>
          )}
        </View>

        {/* Only show featured product if not searching */}
        {searchQuery.trim() === "" && renderFeaturedProduct()}

        {/* Grid Section */}
        <View style={styles.gridContainer}>
          {(searchQuery.trim() !== "" ? filteredProducts : gridProducts).map((item) => {
            const quantityInCart = cart[item.id] || 0;
            return (
              <View
                key={item.id}
                style={[
                  styles.gridItemWrapper,
                  { width: gridCardWidth, margin: cardMargin },
                ]}
              >
                <ProductCard
                  style={{ width: "100%", height: 130 }}
                  item={item}
                  quantity={quantityInCart}
                  onAddToCart={() => addToCart(item.id, item.quantity)}
                  onIncrease={() => increaseQuantity(item.id, item.quantity)}
                  onDecrease={() => decreaseQuantity(item.id)}
                />
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Floating Emojis */}
      {renderFloatingEmojis()}
    </View>
  );
};

export default FeaturedScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Banner
  banner: {
    width: "100%",
    height: 180,
    justifyContent: "flex-end",
  },
  bannerOverlay: {
    backgroundColor: "rgba(0,0,0,0.4)",
    padding: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerText: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
  },
  continueButton: {
    backgroundColor: "#fff",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  continueButtonText: {
    color: "#d32f2f",
    fontSize: 14,
    fontWeight: "600",
  },
  // Content
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    margin: 10,
    position: "relative",
  },
  searchIcon: {
    position: "absolute",
    left: 20,
    zIndex: 2,
  },
  searchBar: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 25,
    paddingLeft: 50,
    paddingRight: 50,
    height: 45,
    fontSize: 16,
    color: "#333",
    elevation: 3,
  },
  clearIcon: {
    position: "absolute",
    right: 20,
    zIndex: 2,
  },
  loader: {
    marginTop: 50,
    alignSelf: "center",
  },
  // Featured Product
  featuredContainer: {
    width: "100%",
    marginBottom: 15,
  },
  featuredImage: {
    width: "100%",
    height: 250,
    justifyContent: "flex-end",
  },
  featuredOverlay: {
    backgroundColor: "rgba(0,0,0,0.3)",
    padding: 10,
  },
  featuredTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#fff",
  },
  featuredPrice: {
    fontSize: 22,
    fontWeight: "600",
    color: "#fff",
    marginTop: 5,
  },
  featuredDiscount: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffeb3b",
    marginTop: 5,
  },
  addToCartButton: {
    backgroundColor: "#fff",
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: "center",
    borderRadius: 25,
    marginTop: 10,
  },
  addToCartText: {
    color: "#d32f2f",
    fontSize: 16,
    fontWeight: "600",
  },
  plusMinusContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  quantityText: {
    marginHorizontal: 10,
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  // Grid
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start", // Left aligned if a row has a single item
  },
  gridItemWrapper: {
    // Width assigned inline in JS
  },
  // Fallback
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 50,
  },
  emptyText: {
    fontSize: 18,
    color: "#fff",
  },
  // Emojis
  floatingEmojiContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
});
