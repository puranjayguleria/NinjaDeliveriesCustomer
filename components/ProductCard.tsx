// components/ProductCard.tsx

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { Product } from "../types/Product";

type ProductCardProps = {
  item: Product;
  quantity: number;
  onAddToCart: () => void;
  onIncrease: () => void;
  onDecrease: () => void;
  displayPrice?: number;
  style?: any;
};

const { width } = Dimensions.get("window");
const SIDE_NAV_WIDTH = 100;
const CARD_MARGIN = 6;
const CARD_WIDTH = (width - SIDE_NAV_WIDTH - CARD_MARGIN * 6) / 2.05;
const CARD_HEIGHT = 270;

const ProductCard: React.FC<ProductCardProps> = ({
  item,
  quantity,
  onAddToCart,
  onIncrease,
  onDecrease,
  displayPrice,
  style,
}) => {
  const [isImageLoading, setIsImageLoading] = useState<boolean>(true);

  /** Safely coerce possible string/undefined tax values to numbers */
  const n = (v: unknown): number => {
    const num = Number(v);
    return isFinite(num) ? num : 0;
  };

  // final price (base – discount + taxes)
  const finalPrice =
    typeof displayPrice === "number"
      ? displayPrice
      : (() => {
          const base =
            typeof item.price === "number" && typeof item.discount === "number"
              ? item.price - item.discount
              : item.price;

          return base + n(item.CGST) + n(item.SGST) + n(item.cess);
        })();

  // original strike-through price (price + taxes)
  const originalPriceIncl =
    typeof item.price === "number"
      ? item.price + n(item.CGST) + n(item.SGST) + n(item.cess)
      : item.price;

  // ✅ Use toFixed to retain 2 decimal precision safely
  const safeFinal = Number((finalPrice ?? 0).toFixed(2));
  const safeOriginal = Number((originalPriceIncl ?? 0).toFixed(2));

  // ✅ Calculate discount percentage with decimals
  const discountAmount = safeOriginal - safeFinal;
  const discountPercent =
    discountAmount > 0 ? Math.round((discountAmount / safeOriginal) * 100) : 0;

  return (
    <View style={[styles.cardContainer, style]}>
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: item.image }}
          style={styles.productImage}
          onLoadEnd={() => setIsImageLoading(false)}
        />

        {isImageLoading && (
          <View style={styles.loaderOverlay}>
            <ActivityIndicator size="small" color="#27ae60" />
          </View>
        )}

        {/* Discount Tag */}
        {typeof item.discount === "number" && item.discount > 0 && (
          <View style={styles.discountTag}>
            <Text style={styles.discountTagText}>
              {discountPercent.toFixed(0)}% OFF
            </Text>
          </View>
        )}
        {/* Price Overlay */}
        <View style={styles.priceOverlay}>
          <Text style={styles.discountedPrice}>₹{safeFinal.toFixed(2)}</Text>
          {typeof item.discount === "number" && item.discount > 0 && (
            <Text style={styles.originalPrice}>₹{safeOriginal.toFixed(2)}</Text>
          )}
        </View>
      </View>

      {/* Product Info */}
      <View style={styles.productDetails}>
        <Text style={styles.productName} numberOfLines={2}>
          {item.name || "Unnamed Product"}
        </Text>
        <Text style={styles.productDescription} numberOfLines={2}>
          {item.description || "No description available"}
        </Text>
      </View>

      {/* Cart Action */}
      {quantity > 0 ? (
        <View style={styles.quantityControl}>
          <TouchableOpacity
            onPress={onDecrease}
            style={styles.controlButton}
            accessibilityLabel={`Decrease quantity of ${item.name}`}
            activeOpacity={0.7}
          >
            <MaterialIcons name="remove" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.quantityText}>{quantity}</Text>
          <TouchableOpacity
            onPress={onIncrease}
            style={styles.controlButton}
            accessibilityLabel={`Increase quantity of ${item.name}`}
            activeOpacity={0.7}
          >
            <MaterialIcons name="add" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      ) : item.outOfStock ? (
        <View style={styles.oosButton}>
          <Text style={styles.oosButtonText}>Out of Stock</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.addToCartButton}
          onPress={onAddToCart}
          accessibilityLabel={`Add ${item.name} to cart`}
          activeOpacity={0.8}
        >
          <MaterialIcons name="shopping-cart" size={18} color="#FFFFFF" />
          <Text style={styles.addToCartText}>Add to Cart</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default ProductCard;

const styles = StyleSheet.create({
  // Card
  cardContainer: {
    width: CARD_WIDTH,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    margin: CARD_MARGIN,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    flexDirection: "column",
    justifyContent: "space-between",
    height: CARD_HEIGHT,
  },

  oosBanner: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#7f8c8d",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
  },
  oosText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
  },
  oosButton: {
    backgroundColor: "#bdc3c7",
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  oosButtonText: {
    color: "#fff",
    fontWeight: "600",
  },

  // Image Container
  imageContainer: {
    position: "relative",
    width: "100%",
    height: 120,
    backgroundColor: "#f8f9fa",
  },
  productImage: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },

  // Overlay loader while image is loading
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },

  // Discount Tag
  discountTag: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "#d35400",
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 4,
  },
  discountTagText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },

  // Price Overlay
  priceOverlay: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "#16a085",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 5,
    flexDirection: "row",
    alignItems: "center",
  },
  discountedPrice: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  originalPrice: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    textDecorationLine: "line-through",
    marginLeft: 6,
  },

  // Product Details
  productDetails: {
    padding: 10,
    flex: 1,
  },
  productName: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2c3e50",
    marginBottom: 4,
  },
  productDescription: {
    fontSize: 10,
    color: "#666666",
    marginBottom: 6,
    height: 36,
  },

  // Add to Cart Button
  addToCartButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#27ae60",
    paddingVertical: 10,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    height: 50,
  },
  addToCartText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 5,
  },

  // Quantity Control
  quantityControl: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    paddingVertical: 8,
    paddingHorizontal: 10,
    height: 50,
    justifyContent: "center",
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  controlButton: {
    backgroundColor: "#27ae60",
    padding: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#27ae60",
    justifyContent: "center",
    alignItems: "center",
  },
  quantityText: {
    color: "#2c3e50",
    marginHorizontal: 10,
    fontSize: 16,
    fontWeight: "600",
  },
});
