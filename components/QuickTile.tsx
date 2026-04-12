// components/QuickTile.tsx
import React, { memo, useCallback, useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useUiTheme } from "@/hooks/useUiTheme";
import { useLocationContext } from "@/context/LocationContext";
import { useCart, useCartQty } from "@/context/CartContext"; // ⬅️ useCartQty here
import { Image } from "expo-image";

const TILE_W = 110;
const TILE_H = 195;
const BLUR = "LKO2?U%2Tw=w]~RBVZRi};ofM{ay";

const CART_BAR_H = 22;
const ADD_BAR_H = 18;
const CART_BAR_MARGIN = 4;
const RESERVED_BOTTOM = CART_BAR_H + CART_BAR_MARGIN + 2;

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
};

function QuickTileBase({ p, guard, isPan, ribbonColor }: QuickTileProps) {
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
            backgroundColor: "#ffffff", // ⬅ ️Hardcoded to white as requested
            borderColor: "#f0f0f0",     // ⬅️ Subtle border
            borderWidth: 1,
            padding: 4,
            paddingBottom: RESERVED_BOTTOM,
          },
        ]}
      >
        {/* Image */}
        <View
          style={[styles.imageContainer, { backgroundColor: theme.productImageBg }]}
        >
          {discountPercent > 0 && (
            <View style={[styles.discountTag, { backgroundColor: "#FF2C5E" }]}>
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

        <View style={styles.priceRow}>
          <Text style={styles.priceNow}>₹{price}</Text>
          {discountPercent > 0 && <Text style={styles.priceMRP}>₹{mrp}</Text>}
        </View>

        {/* Cart bar */}
        {qty === 0 ? (
          <Pressable
            style={[
              styles.cartBar,
              {
                backgroundColor: stock > 0 ? "#009688" : "#bdbdbd",
                borderColor: stock > 0 ? "#009688" : "#bdbdbd",
                height: ADD_BAR_H,
                bottom: CART_BAR_MARGIN,
              },
            ]}
            onPress={handleAdd}
            disabled={stock <= 0}
          >
            <View style={styles.addBtnContent}>
              <Text style={styles.cartBarAdd}>{stock > 0 ? "ADD" : "OUT OF STOCK"}</Text>
              {stock > 0 && <MaterialIcons name="chevron-right" size={14} color="#fff" />}
            </View>
          </Pressable>
        ) : (
          <View
            style={[
              styles.cartBar,
              {
                backgroundColor: "#009688",
                borderColor: "#009688",
                flexDirection: "row",
                height: CART_BAR_H,
                bottom: CART_BAR_MARGIN,
              },
            ]}
          >
            <Pressable onPress={handleDec} hitSlop={12} style={styles.qtyBtn}>
              <MaterialIcons name="remove" size={18} color="#fff" />
            </Pressable>

            <Text style={[styles.qtyNum, { color: "#fff" }]}>{qty}</Text>

            <Pressable onPress={handleInc} hitSlop={12} disabled={qty >= stock} style={styles.qtyBtn}>
              <MaterialIcons
                name="add"
                size={18}
                color={qty >= stock ? "rgba(255,255,255,0.5)" : "#fff"}
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
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  imageContainer: {
    position: "relative",
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 6,
    height: TILE_W - 8,
    justifyContent: "center",
    alignItems: "center",
  },
  tileImg: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
    alignSelf: "center",
  },
  discountTag: {
    position: "absolute",
    top: 0,
    left: 0,
    borderBottomRightRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 2,
  },
  discountTagTxt: { color: "#fff", fontSize: 9, fontWeight: "800" },
  tileName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
    marginTop: 4,
    marginBottom: 4,
    height: 32,
    paddingHorizontal: 2,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  priceNow: { fontSize: 13, fontWeight: "800", color: "#111" },
  priceMRP: {
    fontSize: 10,
    color: "#999",
    textDecorationLine: "line-through",
    marginLeft: 6,
  },
  cartBar: {
    position: "absolute",
    left: 8,
    right: 8,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0,
    zIndex: 3,
  },
  addBtnContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  cartBarAdd: { color: "#fff", fontWeight: "800", fontSize: 10, marginRight: 2 },
  qtyBtn: {
    paddingHorizontal: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  qtyNum: { fontWeight: "800", fontSize: 13, marginHorizontal: 6 },
});
