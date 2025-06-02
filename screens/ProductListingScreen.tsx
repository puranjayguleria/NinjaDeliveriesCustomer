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
import { useLocationContext } from "../context/LocationContext";   // ⬅️ NEW

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
  /***** STATE *****/
  const [products, setProducts] = useState<any[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [isErrorModalVisible, setIsErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  /***** NAV / ROUTE / CONTEXT *****/
  const navigation = useNavigation<ProductListingScreenNavigationProp>();
  const route = useRoute<ProductListingScreenRouteProp>();
  const { categoryId } = route.params || {};
  const { location } = useLocationContext();                       // ⬅️ NEW (storeId)

  /***** CART HOOKS *****/
  const { cart, addToCart, increaseQuantity, decreaseQuantity } = useCart();

  /**********************************************************************
   * EFFECT: fetch sub-cats (once) & products (whenever filters change)
   *********************************************************************/
  useEffect(() => {
    if (!categoryId || !location.storeId) return;

    fetchSubcategories(categoryId,location.storeId);
    fetchProducts(categoryId, selectedSubcategory, location.storeId);
  }, [categoryId, selectedSubcategory, location.storeId]);

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
        .where("storeId", "==", storeId)             // ⬅️ store filter
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
  const renderProductItem = ({ item }: { item: any }) => {
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
  };

  const renderSubcategoryItem = ({ item }: { item: Subcategory }) => (
    <TouchableOpacity
      style={[
        styles.subcategoryItem,
        item.id === selectedSubcategory && styles.selectedSubcategory,
      ]}
      onPress={() => selectSubcategory(item.id)}
    >
      <Image source={{ uri: item.image }} style={styles.subcategoryImage} />
      <Text
        style={[
          styles.subcategoryText,
          item.id === selectedSubcategory && styles.selectedSubcategoryText,
        ]}
      >
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  /*******************************
   * JSX
   *******************************/
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ---------- Side nav ---------- */}
      <View style={styles.sideNav}>
        <FlatList
          data={subcategories}
          keyExtractor={(i) => i.id}
          renderItem={renderSubcategoryItem}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptySubcategoryContainer}>
              <Text style={styles.emptySubcategoryText}>No sub-categories</Text>
            </View>
          }
        />
      </View>

      {/* ---------- Main content ---------- */}
      <View style={styles.mainContent}>
        {/* Search */}
        <View style={styles.searchContainer}>
          <MaterialIcons
            name="search"
            size={24}
            color="#555"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchBar}
            placeholder="Search for products…"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              style={styles.clearIcon}
            >
              <MaterialIcons name="clear" size={24} color="#555" />
            </TouchableOpacity>
          )}
        </View>

        {/* List */}
        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#28a745" />
          </View>
        ) : (
          <FlatList
            data={filteredProducts}
            keyExtractor={(i) => i.id}
            renderItem={renderProductItem}
            numColumns={2}
            columnWrapperStyle={styles.columnWrapper}
            contentContainerStyle={styles.productList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No products found.</Text>
              </View>
            }
          />
        )}
      </View>

      {/* Error modal & toast */}
      <ErrorModal
        visible={isErrorModalVisible}
        message={errorMessage}
        onClose={closeErrorModal}
      />
      <Toast />
    </View>
  );
};

export default ProductListingScreen;

/********** STYLES **********/
const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#FAFAFA",
  },

  /* side nav */
  sideNav: {
    width: SIDE_NAV_WIDTH,
    backgroundColor: "#fff",
    paddingTop: 20,
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderRightColor: "#ddd",
  },
  subcategoryItem: {
    paddingVertical: 10,
    paddingHorizontal: 5,
    borderRadius: 5,
    marginBottom: 8,
    alignItems: "center",
  },
  subcategoryImage: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: IMAGE_SIZE / 2,
    marginBottom: 5,
  },
  selectedSubcategory: { backgroundColor: "#E67E22" },
  subcategoryText: {
    fontSize: 12,
    color: "#333",
    textAlign: "center",
  },
  selectedSubcategoryText: { color: "#fff", fontWeight: "600" },
  emptySubcategoryContainer: { alignItems: "center", marginTop: 20 },
  emptySubcategoryText: { fontSize: 12, color: "#999", textAlign: "center" },

  /* main content */
  mainContent: { flex: 1, padding: 10 },

  /* search */
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    position: "relative",
  },
  searchIcon: { position: "absolute", left: 16, zIndex: 1 },
  searchBar: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 25,
    paddingLeft: 48,
    paddingRight: 48,
    height: 45,
    fontSize: 16,
    color: "#333",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  clearIcon: { position: "absolute", right: 16 },

  /* list */
  productList: { paddingBottom: 20 },
  columnWrapper: { justifyContent: "space-between" },

  /* misc */
  loaderContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 50,
  },
  emptyText: { fontSize: 18, color: "#999" },
});
