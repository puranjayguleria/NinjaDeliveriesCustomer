import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Platform,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import firestore from "@react-native-firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { useCart } from "../context/CartContext";

const { width } = Dimensions.get("window");

const ProductDetailsScreen = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { productId, product: paramProduct } = route.params || {};
  
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { getItemQuantity, addToCart, increaseQuantity, decreaseQuantity } = useCart();

  useEffect(() => {
    if (paramProduct) {
      setProduct(paramProduct);
      setLoading(false);
    } else if (productId) {
      fetchProduct();
    }
  }, [productId, paramProduct]);

  const fetchProduct = async () => {
    try {
      const doc = await firestore().collection("products").doc(productId).get();
      if (doc.exists) {
        setProduct({ id: doc.id, ...doc.data() });
      } else {
        // Try saleProducts if not found in products
         const saleDoc = await firestore().collection("saleProducts").doc(productId).get();
         if (saleDoc.exists) {
            setProduct({ id: saleDoc.id, ...saleDoc.data() });
         }
      }
    } catch (error) {
      console.error("Error fetching product details:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D81B60" />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Product not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
           <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const quantity = getItemQuantity(product.id);
  const price = Number(product.price || 0);
  const discount = Number(product.discount || 0);
  const cgst = Number(product.CGST || 0);
  const sgst = Number(product.SGST || 0);
  const cess = Number(product.cess || 0);
  
  const finalPrice = price - discount + cgst + sgst + cess;
  const originalPrice = price + cgst + sgst + cess;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
           <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backIcon}>
              <Ionicons name="arrow-back" size={24} color="#333" />
           </TouchableOpacity>
        </View>

        <Image source={{ uri: product.image || product.imageUrl }} style={styles.image} resizeMode="contain" />

        <View style={styles.infoContainer}>
          <Text style={styles.name}>{product.name}</Text>
          <Text style={styles.brand}>{product.brand || product.vendorName || "Ninja Local"}</Text>
          
          <View style={styles.priceRow}>
             <Text style={styles.finalPrice}>₹{finalPrice.toFixed(2)}</Text>
             {discount > 0 && (
                <Text style={styles.originalPrice}>₹{originalPrice.toFixed(2)}</Text>
             )}
             {discount > 0 && (
                <View style={styles.discountBadge}>
                   <Text style={styles.discountText}>{Math.round((discount/originalPrice)*100)}% OFF</Text>
                </View>
             )}
          </View>

          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{product.description || "No description available."}</Text>
          
          {product.ingredients && (
            <>
               <Text style={styles.sectionTitle}>Ingredients</Text>
               <Text style={styles.description}>{product.ingredients}</Text>
            </>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
         {quantity === 0 ? (
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => addToCart(product.id, product.quantity || 100)}
            >
               <Text style={styles.addButtonText}>Add to Cart</Text>
            </TouchableOpacity>
         ) : (
            <View style={styles.quantityControl}>
               <TouchableOpacity onPress={() => decreaseQuantity(product.id)} style={styles.qtyBtn}>
                  <Ionicons name="remove" size={24} color="#fff" />
               </TouchableOpacity>
               <Text style={styles.qtyText}>{quantity}</Text>
               <TouchableOpacity onPress={() => increaseQuantity(product.id)} style={styles.qtyBtn}>
                  <Ionicons name="add" size={24} color="#fff" />
               </TouchableOpacity>
            </View>
         )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingTop: Platform.OS === 'android' ? 25 : 0
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    padding: 16,
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 10,
  },
  backIcon: {
    backgroundColor: "rgba(255,255,255,0.8)",
    padding: 8,
    borderRadius: 20,
  },
  image: {
    width: width,
    height: width * 0.8,
    backgroundColor: "#f9f9f9",
  },
  infoContainer: {
    padding: 20,
  },
  name: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  brand: {
    fontSize: 14,
    color: "#757575",
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  finalPrice: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#D81B60",
    marginRight: 12,
  },
  originalPrice: {
    fontSize: 18,
    color: "#999",
    textDecorationLine: "line-through",
    marginRight: 12,
  },
  discountBadge: {
    backgroundColor: "#E91E63",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  discountText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginTop: 16,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: "#555",
    lineHeight: 22,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    backgroundColor: "#fff",
  },
  addButton: {
    backgroundColor: "#D81B60",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  addButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  quantityControl: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    padding: 8,
  },
  qtyBtn: {
    backgroundColor: "#D81B60",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  qtyText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  errorText: {
    fontSize: 18,
    color: "#333",
    textAlign: "center",
    marginTop: 100,
  },
  backButton: {
    marginTop: 20,
    alignSelf: "center",
    padding: 10,
  },
  backButtonText: {
    color: "#D81B60",
    fontSize: 16,
  }
});

export default ProductDetailsScreen;
