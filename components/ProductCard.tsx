// components/ProductCard.tsx

import React, { useState, useCallback, memo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  ViewStyle,
} from "react-native";
import { Image } from "expo-image";

import { MaterialIcons } from "@expo/vector-icons";
import { Product } from "../types/Product";
import { useUiTheme } from "@/hooks/useUiTheme";
import { useLocationContext } from "@/context/LocationContext";
import { Colors } from "@/constants/colors";
import { Typography } from "@/constants/typography";
import { useCart, useCartQty } from "@/context/CartContext";

type ProductCardProps = {
  item: Product;
  /**
   * Optional: Provide quantity if you want to control it from parent.
   * If undefined, it will use useCartQty(item.id) internally.
   */
  quantity?: number;
  /**
   * Optional: Override add to cart behavior.
   * If undefined, uses internal addToCart.
   */
  onAddToCart?: () => void;
  onIncrease?: () => void;
  onDecrease?: () => void;
  onPress?: () => void;
  displayPrice?: number;
  style?: ViewStyle;
};

const { width } = Dimensions.get("window");
const SIDE_NAV_WIDTH = 100;  // Change to 65
const CARD_MARGIN =2;
// Slightly adjusted width calculation to ensure it fits well
const CARD_WIDTH = (width - SIDE_NAV_WIDTH - CARD_MARGIN * 6) / 2.05;
const CARD_HEIGHT = 270;
const PLACEHOLDER_BLURHASH = "LKO2?U%2Tw=w]~RBVZRi};ofM{ay";

const ProductCardBase: React.FC<ProductCardProps> = ({
  item,
  quantity: propQuantity,
  onAddToCart,
  onIncrease,
  onDecrease,
  onPress,
  displayPrice,
  style,
}) => {
  const [isImageLoading, setIsImageLoading] = useState<boolean>(true);
  const { location } = useLocationContext();
  const theme = useUiTheme(location?.storeId);
  
  // Internal cart hooks
  const { addToCart, increaseQuantity, decreaseQuantity } = useCart();
  const contextQty = useCartQty(item.id);

  // Use prop if provided, otherwise use internal context state
  const quantity = propQuantity !== undefined ? propQuantity : contextQty;

  const handleAddToCart = useCallback(() => {
    if (onAddToCart) {
      onAddToCart();
    } else {
      const maxStock = typeof item.quantity === "number" ? item.quantity : 0;
      addToCart(item.id, maxStock);
    }
  }, [onAddToCart, addToCart, item.id, item.quantity]);

  const handleIncrease = useCallback(() => {
    if (onIncrease) {
      onIncrease();
    } else {
      const maxStock = typeof item.quantity === "number" ? item.quantity : 0;
      increaseQuantity(item.id, maxStock);
    }
  }, [onIncrease, increaseQuantity, item.id, item.quantity]);

  const handleDecrease = useCallback(() => {
    if (onDecrease) {
      onDecrease();
    } else {
      decreaseQuantity(item.id);
    }
  }, [onDecrease, decreaseQuantity, item.id]);

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

  const safeFinal = Number((finalPrice ?? 0).toFixed(2));
  const safeOriginal = Number((originalPriceIncl ?? 0).toFixed(2));

  const discountAmount = safeOriginal - safeFinal;
  const discountPercent =
    discountAmount > 0 ? Math.round((discountAmount / safeOriginal) * 100) : 0;

  return (
    <View style={[styles.cardContainer, { backgroundColor: theme.productCardBg }, style]}>
      <TouchableOpacity 
        activeOpacity={onPress ? 0.7 : 1} 
        onPress={onPress}
        style={[styles.imageContainer, { backgroundColor: theme.productImageBg }]}
        accessibilityLabel={`View details for ${item.name}`}
        accessibilityRole="button"
      >
        <Image
          source={{ uri: item.image }}
          style={styles.productImage}
          contentFit="contain"
          cachePolicy="disk"
          transition={200}
          placeholder={PLACEHOLDER_BLURHASH}
          onLoadEnd={() => setIsImageLoading(false)}
        />

        {isImageLoading && (
          <View style={styles.loaderOverlay}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        )}

        {/* Discount Tag */}
        {typeof item.discount === "number" && item.discount > 0 && (
          <View style={[styles.discountTag, { backgroundColor: theme.discountTagBg }]}>
            <Text style={styles.discountTagText}>
              {discountPercent.toFixed(0)}% OFF
            </Text>
          </View>
        )}
        {/* Price Overlay */}
        <View style={[styles.priceOverlay, { backgroundColor: theme.priceOverlayBg }]}>
          <Text style={styles.discountedPrice}>₹{safeFinal.toFixed(2)}</Text>
          {typeof item.discount === "number" && item.discount > 0 && (
            <Text style={styles.originalPrice}>₹{safeOriginal.toFixed(2)}</Text>
          )}
        </View>
      </TouchableOpacity>

      {/* Product Info */}
      <TouchableOpacity 
        activeOpacity={onPress ? 0.7 : 1} 
        onPress={onPress}
        style={styles.productDetails}
        accessibilityLabel={`View details for ${item.name}`}
        accessibilityRole="button"
      >
        <Text style={styles.productName} numberOfLines={2}>
          {item.name || "Unnamed Product"}
        </Text>
        <Text style={styles.productDescription} numberOfLines={2}>
          {item.description || "No description available"}
        </Text>
      </TouchableOpacity>

      {/* Cart Action */}
      {quantity > 0 ? (
        <View style={[styles.quantityControl, { backgroundColor: theme.qtyBarBg }]} >
          <TouchableOpacity
            onPress={handleDecrease}
            style={[
              styles.controlButton,
              { backgroundColor: theme.qtyBtnBg, borderColor: theme.qtyBtnBorder },
            ]}
            accessibilityLabel="Decrease quantity"
            accessibilityRole="button"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons name="remove" size={20} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.quantityText} accessibilityLabel={`Quantity: ${quantity}`}>{quantity}</Text>
          <TouchableOpacity
            onPress={handleIncrease}
            style={[
              styles.controlButton,
              { backgroundColor: theme.qtyBtnBg, borderColor: theme.qtyBtnBorder },
            ]}
            accessibilityLabel="Increase quantity"
            accessibilityRole="button"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons name="add" size={20} color={Colors.white} />
          </TouchableOpacity>
        </View>
      ) : item.outOfStock ? (
        <View style={[styles.oosButton, { backgroundColor: theme.oosBg }]} accessibilityLabel="Out of stock">
          <Text style={styles.oosButtonText}>Out of Stock</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.addToCartButton, { backgroundColor: theme.addToCartBg }]}
          onPress={handleAddToCart}
          accessibilityLabel={`Add ${item.name} to cart`}
          accessibilityRole="button"
          activeOpacity={0.8}
        >
          <MaterialIcons name="shopping-cart" size={18} color={Colors.white} />
          <Text style={styles.addToCartText}>Add to Cart</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  // Card
  cardContainer: {
    width: CARD_WIDTH,
    backgroundColor: Colors.white,
    borderRadius: 10,
    margin: CARD_MARGIN,
    overflow: "hidden",
    shadowColor: Colors.black,
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
    backgroundColor: Colors.grey[500],
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
  },
  oosText: {
    color: Colors.white,
    fontSize: 9,
    fontWeight: "700",
  },
  oosButton: {
    backgroundColor: Colors.grey[400],
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  oosButtonText: {
    color: Colors.white,
    fontWeight: "600",
  },

  // Image Container
  imageContainer: {
    position: "relative",
    width: "100%",
    height: 120,
    backgroundColor: Colors.background.default,
  },
  productImage: {
    width: "100%",
    height: "100%",
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
    backgroundColor: Colors.danger,
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 4,
  },
  discountTagText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: "700",
  },

  // Price Overlay
  priceOverlay: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: Colors.info,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 5,
    flexDirection: "row",
    alignItems: "center",
  },
  discountedPrice: {
    color: Colors.white,
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
    color: Colors.text.primary,
    marginBottom: 4,
  },
  productDescription: {
    fontSize: 10,
    color: Colors.text.muted,
    marginBottom: 6,
    height: 36,
  },

  // Add to Cart Button
  addToCartButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.success,
    paddingVertical: 10,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    height: 50,
  },
  addToCartText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 5,
  },

  // Quantity Control
  quantityControl: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.background.default,
    paddingVertical: 8,
    paddingHorizontal: 10,
    height: 50,
    justifyContent: "center",
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  controlButton: {
    backgroundColor: Colors.success,
    padding: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.success,
    justifyContent: "center",
    alignItems: "center",
  },
  quantityText: {
    color: Colors.text.primary,
    marginHorizontal: 10,
    fontSize: 16,
    fontWeight: "600",
  },
});

export default memo(ProductCardBase, (prev, next) => {
  // Custom equality check for performance
  return (
    prev.item.id === next.item.id &&
    prev.item.price === next.item.price &&
    prev.item.discount === next.item.discount &&
    prev.item.quantity === next.item.quantity && // stock
    prev.item.outOfStock === next.item.outOfStock &&
    prev.quantity === next.quantity && // external controlled qty
    prev.displayPrice === next.displayPrice
  );
});
