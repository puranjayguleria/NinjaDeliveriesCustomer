// screens/ProductListingScreen.tsx
import React, { useState, useEffect } from "react";
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
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import { useRoute, useNavigation } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";
import { StatusBar } from "react-native";
import { RootStackParamList } from "../types/navigation";
import ErrorModal from "../components/ErrorModal";
import ProductCard from "../components/ProductCard";
import Toast from "react-native-toast-message";
import { useCart } from "../context/CartContext"; // Use the custom hook

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

const { width } = Dimensions.get("window");
const SIDE_NAV_WIDTH = 100;
const IMAGE_SIZE = 50;

const ProductListingScreen: React.FC<Props> = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(
    null
  );
  const [isErrorModalVisible, setIsErrorModalVisible] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const route = useRoute<ProductListingScreenRouteProp>();
  const navigation = useNavigation<ProductListingScreenNavigationProp>();

  const { categoryId, categoryName } = route.params || {};

  // Cart functions from global context
  const {
    cart,
    addToCart,
    increaseQuantity,
    decreaseQuantity,
  } = useCart();

  useEffect(() => {
    if (categoryId) {
      fetchSubcategories(categoryId);
      fetchProducts(categoryId, selectedSubcategory);
    }
  }, [categoryId, selectedSubcategory]);

  useEffect(() => {
    if (searchQuery) {
      const queryLower = searchQuery.toLowerCase();
      const filtered = products.filter(
        (product) =>
          product.name.toLowerCase().includes(queryLower) ||
          product.description?.toLowerCase().includes(queryLower)
      );
      setFilteredProducts(filtered);
    } else {
      setFilteredProducts(products);
    }
  }, [searchQuery, products]);

  const fetchSubcategories = async (categoryId: string) => {
    try {
      const subcategorySnapshot = await firestore()
        .collection("subcategories")
        .where("categoryId", "==", categoryId)
        .get();
      const subcategoryData = subcategorySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setSubcategories(subcategoryData);
    } catch (error) {
      console.error("Error fetching subcategories:", error);
      showErrorModal("Error", "Failed to fetch subcategories.");
    }
  };

  const fetchProducts = async (
    categoryId: string,
    subcategoryId: string | null
  ) => {
    setLoading(true);
    try {
      let productQuery = firestore()
        .collection("products")
        .where("categoryId", "==", categoryId);

      if (subcategoryId) {
        productQuery = productQuery.where("subcategoryId", "==", subcategoryId);
      }

      const productSnapshot = await productQuery.get();
      const productData = productSnapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        // Remove or filter out products that have 0 or less in quantity
        .filter((p) => p.quantity > 0)
        // Sort products by discount descending
        .sort((a, b) => (b.discount || 0) - (a.discount || 0));

      setProducts(productData);
      setFilteredProducts(productData);
    } catch (error) {
      Alert.alert("Error", "Failed to fetch products.");
    } finally {
      setLoading(false);
    }
  };

  const showErrorModal = (title: string, message: string) => {
    setErrorMessage(message);
    setIsErrorModalVisible(true);
  };

  const closeErrorModal = () => {
    setIsErrorModalVisible(false);
  };

  const selectSubcategory = (subcategoryId: string) => {
    if (subcategoryId === selectedSubcategory) {
      setSelectedSubcategory(null);
    } else {
      setSelectedSubcategory(subcategoryId);
    }
  };

  // Render individual product cards
  const renderProductItem = ({ item }: { item: any }) => (
    <ProductCard
      item={item}
      quantity={cart[item.id] || 0}
      onAddToCart={() => {
        addToCart(item.id, item.quantity);  // <-- Pass item.quantity
      }}
      onIncrease={() => {
        increaseQuantity(item.id, item.quantity); // <-- Pass item.quantity
      }}
      onDecrease={() => {
        decreaseQuantity(item.id);
      }}
    />
  );

  // Render individual subcategory items
  const renderSubcategoryItem = ({ item }: { item: Subcategory }) => (
    <TouchableOpacity
      style={[
        styles.subcategoryItem,
        item.id === selectedSubcategory && styles.selectedSubcategory,
      ]}
      onPress={() => selectSubcategory(item.id)}
      accessibilityLabel={`Select ${item.name} subcategory`}
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Side Navigation for Subcategories */}
      <View style={styles.sideNav}>
        <FlatList
          data={subcategories}
          keyExtractor={(item) => item.id}
          renderItem={renderSubcategoryItem}
          ListEmptyComponent={
            <View style={styles.emptySubcategoryContainer}>
              <Text style={styles.emptySubcategoryText}>
                No subcategories available.
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      </View>

      {/* Main Content Area */}
      <View style={styles.mainContent}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <MaterialIcons
            name="search"
            size={24}
            color="#555"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchBar}
            placeholder="Search for products..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
            accessibilityLabel="Search Products"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              style={styles.clearIcon}
              accessibilityLabel="Clear Search"
            >
              <MaterialIcons name="clear" size={24} color="#555" />
            </TouchableOpacity>
          )}
        </View>

        {/* Products List */}
        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#28a745" />
          </View>
        ) : (
          <FlatList
            data={filteredProducts}
            keyExtractor={(item) => item.id}
            renderItem={renderProductItem}
            numColumns={2}
            contentContainerStyle={styles.productList}
            showsVerticalScrollIndicator={false}
            columnWrapperStyle={styles.columnWrapper}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No products found.</Text>
              </View>
            }
          />
        )}
      </View>

      {/* Error Modal */}
      <ErrorModal
        visible={isErrorModalVisible}
        message={errorMessage}
        onClose={closeErrorModal}
      />

      {/* Toast Messages */}
      <Toast />
    </View>
  );
};

export default ProductListingScreen;

/* -------------- STYLES -------------- */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#FAFAFA",
  },

  /***** SIDE NAV *****/
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
  selectedSubcategory: {
    backgroundColor: "#E67E22",
  },
  subcategoryText: {
    fontSize: 12,
    color: "#333",
    textAlign: "center",
  },
  selectedSubcategoryText: {
    color: "#fff",
    fontWeight: "600",
  },
  emptySubcategoryContainer: {
    alignItems: "center",
    marginTop: 20,
  },
  emptySubcategoryText: {
    fontSize: 12,
    color: "#999",
    textAlign: "center",
  },

  /***** MAIN CONTENT *****/
  mainContent: {
    flex: 1,
    padding: 10,
  },

  /***** SEARCH BAR *****/
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    position: "relative",
  },
  searchIcon: {
    position: "absolute",
    left: 16,
    zIndex: 1,
  },
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
  clearIcon: {
    position: "absolute",
    right: 16,
  },

  /***** PRODUCT LIST *****/
  productList: {
    paddingBottom: 20,
  },
  columnWrapper: {
    justifyContent: "space-between",
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 50,
  },
  emptyText: {
    fontSize: 18,
    color: "#999",
  },
});
