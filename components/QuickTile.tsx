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

const CART_BAR_H = 30;
const CART_BAR_MARGIN = 6;
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
};

function QuickTileBase({ p, guard, isPan }: QuickTileProps) {
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
            backgroundColor: theme.productCardBg,
            borderColor: (theme as any).productBorder ?? "#e0e0e0",
            borderWidth: 1,
            padding: 6,
            paddingBottom: RESERVED_BOTTOM,
          },
        ]}
      >
        {/* Image */}
        <View
          style={[styles.imageContainer, { backgroundColor: theme.productImageBg }]}
        >
          {discountPercent > 0 && (
            <View style={[styles.discountTag, { backgroundColor: theme.discountTagBg }]}>
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

        <View style={[styles.ribbon, { backgroundColor: theme.priceOverlayBg }]}>
          <Text style={styles.priceNow}>₹{price}</Text>
          {discountPercent > 0 && <Text style={styles.priceMRP}>₹{mrp}</Text>}
        </View>

        {/* Cart bar */}
        {qty === 0 ? (
          <Pressable
            style={[
              styles.cartBar,
              {
                backgroundColor: stock > 0 ? theme.addToCartBg : "#bdbdbd",
                borderColor: stock > 0 ? theme.addToCartBg : "#bdbdbd",
                height: CART_BAR_H,
                bottom: CART_BAR_MARGIN,
              },
            ]}
            onPress={handleAdd}
            disabled={stock <= 0}
          >
            <Text style={styles.cartBarAdd}>{stock > 0 ? "ADD" : "OUT OF STOCK"}</Text>
          </Pressable>
        ) : (
          <View
            style={[
              styles.cartBar,
              {
                backgroundColor: theme.qtyBarBg,
                borderColor: theme.qtyBtnBorder,
                flexDirection: "row",
                height: CART_BAR_H,
                bottom: CART_BAR_MARGIN,
              },
            ]}
          >
            <Pressable onPress={handleDec} hitSlop={12}>
              <MaterialIcons name="remove" size={18} color={theme.qtyBtnBg} />
            </Pressable>

            <Text style={[styles.qtyNum, { color: theme.qtyBtnBg }]}>{qty}</Text>

            <Pressable onPress={handleInc} hitSlop={12} disabled={qty >= stock}>
              <MaterialIcons
                name="add"
                size={18}
                color={qty >= stock ? "#bdbdbd" : theme.qtyBtnBg}
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
    left: 6,
    right: 6,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    zIndex: 3,
  },
  cartBarAdd: { color: "#fff", fontWeight: "700", fontSize: 12 },
  qtyNum: { fontWeight: "700", fontSize: 14, marginHorizontal: 10 },
});
