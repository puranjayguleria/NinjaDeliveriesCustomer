// components/QuickTile.tsx
import React, { memo, useCallback, useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useUiTheme } from "@/hooks/useUiTheme";
import { useLocationContext } from "@/context/LocationContext";
import { useCart, useCartQty } from "@/context/CartContext"; // ⬅️ useCartQty here
import { Image } from "expo-image";

const TILE_W = 120;
const TILE_H = 210;
const BLUR = "LKO2?U%2Tw=w]~RBVZRi};ofM{ay";

const CART_BAR_H = 28;
const CART_BAR_MARGIN = 4;
const RESERVED_BOTTOM = CART_BAR_H + CART_BAR_MARGIN + 4;

export type QuickTileProps = {
  p: {
    id: string;
    CESS: string;
    CGST: number;
    SGST: number;
    categoryId: string;
    description: string;
    discount: number;
    image?: string;
    imageUrl?: string;
    images?: string[];
    isNew: boolean;
    isStoreAvailable: boolean;
    name: string;
    price: number;
    quantity: number;
    shelfLife: string;
    storeId: string;
    subcategoryId: string;
    weeklySold: string;
    availableQuantity?: number;
    title?: string;
  };
  guard?: (cb: () => void, isPan: boolean) => void;
  isPan?: boolean;
  ribbonColor?: string;
  style?: any; // Allow style overrides
};

function QuickTileBase({ p, guard, isPan, ribbonColor, style }: QuickTileProps) {
  const { addToCart, increaseQuantity, decreaseQuantity } = useCart();
  const qty = useCartQty(p.id); // ⬅️ subscribe per item — no parent cart prop
  const { location } = useLocationContext();
  const theme = useUiTheme(location?.storeId);

  // —— Derivations —— //
  const mrp = useMemo(() => {
    const raw = Number(p.price ?? 0) + Number(p.CGST ?? 0) + Number(p.SGST ?? 0);
    return Math.round(raw * 100) / 100;
  }, [p.price, p.CGST, p.SGST]);

  const discount = p.discount ?? 0;
  const price = useMemo(() => mrp - discount, [mrp, discount]);

  const discountPercent = useMemo(
    () => (discount > 0 && mrp > 0 ? Math.round((discount / mrp) * 100) : 0),
    [discount, mrp]
  );

  const stock = useMemo(
    () => (p.availableQuantity ?? p.quantity ?? 0),
    [p.availableQuantity, p.quantity]
  );

  const name = p.name || p.title || "Product";

  const imgSrc = useMemo(() => {
    const u =
      p.imageUrl ||
      p.image ||
      (Array.isArray(p.images) && p.images.length ? p.images[0] : undefined);
    return u ? { uri: u } : undefined;
  }, [p.imageUrl, p.image, p.images]);

  // —— Handlers —— //
  const handleAdd = useCallback(() => {
    if (stock <= 0) return;
    const run = () => addToCart(p.id, stock);
    guard ? guard(run, !!isPan) : run();
  }, [addToCart, guard, isPan, p.id, stock]);

  const handleInc = useCallback(() => {
    if (stock <= 0) return;
    increaseQuantity(p.id, stock);
  }, [increaseQuantity, p.id, stock]);

  const handleDec = useCallback(() => {
    if (qty <= 0) return;
    decreaseQuantity(p.id);
  }, [decreaseQuantity, p.id, qty]);

  return (
    <Pressable>
      <View
        style={[
          styles.tile,
          {
            width: TILE_W,
            height: TILE_H,
            backgroundColor: '#FFF',
            borderColor: '#E1BEE7', // Light Purple Border
            borderWidth: 1.5,
            borderRadius: 16,
            padding: 8,
            paddingBottom: RESERVED_BOTTOM,
            shadowColor: '#E91E63', // Festive Pink Shadow
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 6,
            elevation: 4
          },
          style // Apply style override here
        ]}
      >
        {/* Decorative corner flowers (CSS-based approximation) */}
        {style?.borderWidth === 1 && style?.borderColor === '#DAA520' && (
          <>
            <View style={{ position: 'absolute', top: -4, left: -4, zIndex: 10 }}>
              <Text style={{ fontSize: 16 }}>🌼</Text>
            </View>
            <View style={{ position: 'absolute', top: -4, right: -4, zIndex: 10 }}>
              <Text style={{ fontSize: 16 }}>🌼</Text>
            </View>
            <View style={{ position: 'absolute', bottom: 2, left: -4, zIndex: 10 }}>
              <Text style={{ fontSize: 16 }}>🌼</Text>
            </View>
            <View style={{ position: 'absolute', bottom: 2, right: -4, zIndex: 10 }}>
              <Text style={{ fontSize: 16 }}>🌼</Text>
            </View>
          </>
        )}
        {/* Image */}
        <View
          style={[styles.imageContainer, { backgroundColor: theme.productImageBg }]}
        >
          {discountPercent > 0 && (
            <View style={[styles.discountTag, { 
              backgroundColor: '#FF4081', // Festive Pink
              borderRadius: 8,
              transform: [{ rotate: '-12deg' }],
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 2,
              elevation: 3
            }]}>
              <Text style={styles.discountTagTxt}>{discountPercent}% OFF</Text>
            </View>
          )}
          <Image
            source={imgSrc}
            style={styles.tileImg}
            contentFit="contain"
            cachePolicy="disk"
            priority="high"
            placeholder={BLUR}
            transition={150}
          />
        </View>

        {/* Content */}
        <Text style={styles.tileName} numberOfLines={2}>{name}</Text>

        <View style={[styles.ribbon, { backgroundColor: ribbonColor || '#FF9800', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }]}>
          <Text style={styles.priceNow}>₹{price}</Text>
          {discountPercent > 0 && <Text style={styles.priceMRP}>₹{mrp}</Text>}
        </View>

        {/* Cart bar */}
        {qty === 0 ? (
          <Pressable
            style={({ pressed }) => [
              styles.cartBar,
              {
                backgroundColor: stock > 0 ? (ribbonColor || "#009688") : "#f5f5f5",
                height: CART_BAR_H,
                bottom: CART_BAR_MARGIN,
                opacity: pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}
            onPress={handleAdd}
            disabled={stock <= 0}
          >
            <Text style={[styles.cartBarAdd, { color: stock > 0 ? "#fff" : "#aaa" }]}>
              {stock > 0 ? "ADD" : "SOLD OUT"}
            </Text>
          </Pressable>
        ) : (
          <View
            style={[
              styles.cartBar,
              {
                backgroundColor: "#fff",
                borderWidth: 1.5,
                borderColor: (ribbonColor || "#009688"),
                flexDirection: "row",
                height: CART_BAR_H,
                bottom: CART_BAR_MARGIN,
                justifyContent: "space-between",
                paddingHorizontal: 2,
              },
            ]}
          >
            <Pressable onPress={handleDec} hitSlop={12} style={{ padding: 4 }}>
              <MaterialIcons name="remove" size={16} color={ribbonColor || "#009688"} />
            </Pressable>

            <Text style={[styles.qtyNum, { color: ribbonColor || "#009688", fontSize: 12 }]}>{qty}</Text>

            <Pressable onPress={handleInc} hitSlop={12} disabled={qty >= stock} style={{ padding: 4 }}>
              <MaterialIcons
                name="add"
                size={16}
                color={qty >= stock ? "#e0e0e0" : (ribbonColor || "#009688")}
              />
            </Pressable>
          </View>
        )}
      </View>
    </Pressable>
  );
}

// Only re-render when prop-driven visuals change (qty is internal)
export const QuickTile = memo(QuickTileBase, (prev, next) => {
  if (prev.isPan !== next.isPan) return false;
  if (prev.guard !== next.guard) return false;
  if (prev.ribbonColor !== next.ribbonColor) return false;
  // If style changes, re-render
  if (JSON.stringify(prev.style) !== JSON.stringify(next.style)) return false;

  const a = prev.p;
  const b = next.p;

  if (a.id !== b.id) return false;
  if (a.price !== b.price) return false;
  if (a.CGST !== b.CGST) return false;
  if (a.SGST !== b.SGST) return false;
  if ((a.discount ?? 0) !== (b.discount ?? 0)) return false;
  if ((a.availableQuantity ?? a.quantity) !== (b.availableQuantity ?? b.quantity)) return false;

  const aImg = a.imageUrl || a.image || (Array.isArray(a.images) && a.images[0]) || "";
  const bImg = b.imageUrl || b.image || (Array.isArray(b.images) && b.images[0]) || "";
  if (aImg !== bImg) return false;

  if ((a.name || a.title) !== (b.name || b.title)) return false;

  return true;
});

const styles = StyleSheet.create({
  tile: {
    marginRight: 8,
    backgroundColor: "#fff",
    borderRadius: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  imageContainer: {
    position: "relative",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 6,
    height: TILE_W - 12,
    justifyContent: "center",
    alignItems: "center",
  },
  tileImg: {
    width: "100%",
    height: "100%",
    borderRadius: 6,
    alignSelf: "center",
  },
  discountTag: {
    position: "absolute",
    top: 6,
    left: 6,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    zIndex: 2,
  },
  discountTagTxt: { color: "#fff", fontSize: 9, fontWeight: "700" },
  tileName: {
    fontSize: 11,
    color: "#333",
    marginTop: 4,
    marginBottom: 2,
    height: 28,
  },
  ribbon: {
    marginTop: 0,
    marginBottom: 4,
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
    left: 10,
    right: 10,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    zIndex: 3,
  },
  cartBarAdd: { color: "#fff", fontWeight: "800", fontSize: 11, letterSpacing: 0.5 },
  qtyNum: { fontWeight: "700", fontSize: 12, marginHorizontal: 8 },
});
