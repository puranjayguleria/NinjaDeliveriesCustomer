// screens/ProductListingScreen.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  Dimensions,
  Image,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import firestore from "@react-native-firebase/firestore";
import { useRoute, useNavigation } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList } from "../types/navigation";
import ErrorModal from "../components/ErrorModal";
import ProductCard from "../components/ProductCard";
import Toast from "react-native-toast-message";
import { useCart } from "../context/CartContext";
import { useLocationContext } from "../context/LocationContext"; // ⬅️ NEW
import { ProductGridSkeleton } from "../components/Skeleton";
import Loader from "@/components/VideoLoader";
import { Colors } from "@/constants/colors";
import { Typography } from "@/constants/typography";

/********** NAV TYPES **********/
type ProductListingScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "ProductListing"
>;
type ProductListingScreenRouteProp = RouteProp<
  RootStackParamList,
  "ProductListing"
>;

type Props = {
  navigation: ProductListingScreenNavigationProp;
  route: ProductListingScreenRouteProp;
};

type Subcategory = {
  id: string;
  name: string;
  categoryId: string;
  image: string;
};

/********** DIMENSIONS **********/
const { width } = Dimensions.get("window");
const SIDE_NAV_WIDTH = 100;
const IMAGE_SIZE = 50;

/********** COMPONENT **********/
const ProductListingScreen: React.FC<Props> = () => {
  /***** NAV / ROUTE / CONTEXT *****/
  const navigation = useNavigation<ProductListingScreenNavigationProp>();
  const route = useRoute<ProductListingScreenRouteProp>();
  const { categoryId, searchQuery: initialQuery } = route.params || {};
  const { location } = useLocationContext();

  /***** STATE *****/
  const [products, setProducts] = useState<any[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState(initialQuery || "");
  const [loading, setLoading] = useState(true);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(
    null
  );
  const [isErrorModalVisible, setIsErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  /***** CART HOOKS *****/
  const { cart, addToCart, increaseQuantity, decreaseQuantity } = useCart();
  useEffect(() => {
    if (!location.storeId) return;

    // If we have a categoryId, fetch by category
    if (categoryId) {
      fetchSubcategories(categoryId, location.storeId);
      fetchProducts(categoryId, selectedSubcategory, location.storeId);
    } else if (initialQuery) {
      // If no categoryId but we have a search query, fetch products by keyword
      fetchProductsByKeyword(initialQuery, location.storeId);
    }
  }, [categoryId, selectedSubcategory, location.storeId, initialQuery]);

  /**********************************************************************
   * EFFECT: search filter
   *********************************************************************/
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredProducts(products);
      return;
    }
    const q = searchQuery.toLowerCase();
    setFilteredProducts(
      products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q)
      )
    );
  }, [searchQuery, products]);

  /*******************************
   * Firestore helpers
   *******************************/
  const fetchSubcategories = async (catId: string, storeId: string) => {
    try {
      const snap = await firestore()
        .collection("subcategories")
        .where("categoryId", "==", catId)
        .where("storeId", "==", storeId)
        .get();

      setSubcategories(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
      );
    } catch (err) {
      showErrorModal("Error", "Failed to fetch sub-categories.");
    }
  };

  const fetchProducts = async (
    catId: string,
    subId: string | null,
    storeId: string
  ) => {
    setLoading(true);
    try {
      let q = firestore()
        .collection("products")
        .where("storeId", "==", storeId) // ⬅️ store filter
        .where("categoryId", "==", catId);

      if (subId) q = q.where("subcategoryId", "==", subId);

      const snap = await q.get();

      const data = snap.docs
        .map((d) => {
          const doc = d.data() as any;
          const base = doc.discount ? doc.price - doc.discount : doc.price;
          return {
            id: d.id,
            ...doc,
            outOfStock: doc.quantity <= 0,
            priceInclTax:
              (base ?? 0) + (doc.CGST ?? 0) + (doc.SGST ?? 0) + (doc.cess ?? 0),
          };
        })
        .sort((a, b) => (b.discount || 0) - (a.discount || 0));

      setProducts(data);
      setFilteredProducts(data);
    } catch {
      Alert.alert("Error", "Failed to fetch products.");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch products by keyword/name search (when no categoryId is provided)
   */
  const fetchProductsByKeyword = async (keyword: string, storeId: string) => {
    setLoading(true);
    try {
      // Fetch all products from the store and filter by keyword
      const snap = await firestore()
        .collection("products")
        .where("storeId", "==", storeId)
        .get();

      const q = keyword.toLowerCase();
      const data = snap.docs
        .map((d) => {
          const doc = d.data() as any;
          const base = doc.discount ? doc.price - doc.discount : doc.price;
          return {
            id: d.id,
            ...doc,
            outOfStock: doc.quantity <= 0,
            priceInclTax:
              (base ?? 0) + (doc.CGST ?? 0) + (doc.SGST ?? 0) + (doc.cess ?? 0),
          };
        })
        .filter((p) => {
          const name = (p.name || p.title || "").toLowerCase();
          const desc = (p.description || "").toLowerCase();
          const keywords = Array.isArray(p.keywords)
            ? p.keywords.map((k: string) => k.toLowerCase())
            : [];
          return (
            name.includes(q) ||
            desc.includes(q) ||
            keywords.some((kw: string) => kw.includes(q))
          );
        })
        .sort((a, b) => (b.discount || 0) - (a.discount || 0));

      setProducts(data);
      setFilteredProducts(data);
      // Clear subcategories since we're doing keyword search
      setSubcategories([]);
    } catch {
      Alert.alert("Error", "Failed to fetch products.");
    } finally {
      setLoading(false);
    }
  };

  /*******************************
   * Modal helpers
   *******************************/
  const showErrorModal = (title: string, message: string) => {
    setErrorMessage(message);
    setIsErrorModalVisible(true);
  };
  const closeErrorModal = () => setIsErrorModalVisible(false);

  /*******************************
   * UI callbacks
   *******************************/
  const selectSubcategory = (id: string) =>
    setSelectedSubcategory((prev) => (prev === id ? null : id));

  /*******************************
   * Renderers
   *******************************/
  const renderProductItem = useCallback(
    ({ item }: { item: any }) => {
      /** protect against undefined quantity */
      const maxStock = typeof item.quantity === "number" ? item.quantity : 0;

      return (
        <ProductCard
          item={item}
          quantity={cart[item.id] || 0}
          displayPrice={item.priceInclTax}
          onAddToCart={() => addToCart(item.id, maxStock)}
          onIncrease={() => increaseQuantity(item.id, maxStock)}
          onDecrease={() => decreaseQuantity(item.id)}
        />
      );
    },
    [cart, addToCart, increaseQuantity, decreaseQuantity]
  );

  const keyExtractor = useCallback((item: any) => item.id, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f9f9f9" }}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            accessibilityLabel="Go back"
            accessibilityRole="button"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <View style={styles.searchContainer}>
            <MaterialIcons
              name="search"
              size={20}
              color="#666"
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search products..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#999"
              accessibilityLabel="Search products"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity 
                onPress={() => setSearchQuery("")}
                accessibilityLabel="Clear search"
                accessibilityRole="button"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons name="close" size={20} color="#666" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Subcategories (Horizontal Scroll) */}
        {subcategories.length > 0 && (
          <View style={styles.subCatContainer}>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={subcategories}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: 4 }}
              renderItem={({ item }) => {
                const isSelected = selectedSubcategory === item.id;
                return (
                  <TouchableOpacity
                    style={[
                      styles.subCatItem,
                      isSelected && styles.subCatItemSelected,
                    ]}
                    onPress={() =>
                      setSelectedSubcategory(isSelected ? null : item.id)
                    }
                    accessibilityLabel={`Filter by ${item.name}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Image
                      source={{ uri: item.image }}
                      style={[
                        styles.subCatImage,
                        isSelected && { borderColor: Colors.primary, borderWidth: 1 },
                      ]}
                    />
                    <Text
                      style={[
                        styles.subCatText,
                        isSelected && styles.subCatTextSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        )}
      </View>

      {/* Main Content */}
      {loading ? (
        <View style={styles.center}>
          <ProductGridSkeleton />
        </View>
      ) : filteredProducts.length === 0 ? (
        <View style={styles.center}>
          <MaterialIcons name="search-off" size={48} color="#ccc" />
          <Text style={{ marginTop: 10, color: "#888" }}>
            No products found.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={keyExtractor}
          renderItem={renderProductItem}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.columnWrapper}
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={true}
        />
      )}

      {/* Error modal & toast */}
      <ErrorModal
        visible={isErrorModalVisible}
        message={errorMessage}
        onClose={closeErrorModal}
      />
      <Toast />
    </SafeAreaView>
  );
};

export default ProductListingScreen;

/********** STYLES **********/
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },
  /* Header Layout */
  header: {
    backgroundColor: Colors.white,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background.light,
    elevation: 2,
    shadowColor: Colors.black,
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 2 },
    zIndex: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  searchIcon: {
    position: "absolute",
    left: 12,
    zIndex: 1,
  },
  searchInput: {
    flex: 1,
    backgroundColor: Colors.background.light,
    borderRadius: 8,
    paddingLeft: 40,
    paddingRight: 40,
    height: 40,
    fontSize: 14,
    color: Colors.text.primary,
  },
  
  /* Subcategories (Horizontal) */
  subCatContainer: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  subCatItem: {
    alignItems: "center",
    marginRight: 16,
    padding: 4,
    opacity: 0.7,
  },
  subCatItemSelected: {
    opacity: 1,
  },
  subCatImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: 4,
    borderWidth: 2,
    borderColor: "transparent",
  },
  subCatText: {
    fontSize: 12,
    color: Colors.text.muted,
    textAlign: "center",
    maxWidth: 60,
  },
  subCatTextSelected: {
    color: Colors.primary,
    fontWeight: "600",
  },

  /* Content */
  listContent: {
    padding: 8,
    paddingBottom: 20,
  },
  columnWrapper: {
    justifyContent: "space-between",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
