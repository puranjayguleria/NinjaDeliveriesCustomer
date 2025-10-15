// components/QuickTile.tsx
import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useUiTheme } from "@/hooks/useUiTheme";
import { useLocationContext } from "@/context/LocationContext";
import { useCart, useCartQty } from "@/context/CartContext";
import { Image } from "expo-image";

const TILE_W = 120;
const TILE_H = 210;
const BLUR = "LKO2?U%2Tw=w]~RBVZRi};ofM{ay"; // tiny blurhash placeholder

// 🚫 overlap fix constants
const CART_BAR_H = 30;
const CART_BAR_MARGIN = 6;
const RESERVED_BOTTOM = CART_BAR_H + CART_BAR_MARGIN + 2; // reserve space inside card

export type QuickTileProps = {
  p: {
    id: string;
    CESS: string;
    CGST: number;
    SGST: number;
    categoryId: string;
    description: string;
    discount: number;
    image: string;
    isNew: boolean;
    isStoreAvailable: boolean;
    name: string;
    price: number;
    quantity: number;
    shelfLife: string;
    storeId: string;
    subcategoryId: string;
    weeklySold: string;
  };
  guard?: (cb: () => void, isPan: boolean) => void;
  isPan?: boolean;
};

export const QuickTile: React.FC<QuickTileProps> = React.memo(
  ({ p, guard, isPan }) => {
    const { addToCart, increaseQuantity, decreaseQuantity } = useCart();
    const qty = useCartQty(p.id);

    const mrp =
      Math.round(
        (Number(p.price ?? 0) + Number(p.CGST ?? 0) + Number(p.SGST ?? 0)) * 100
      ) / 100;

    const discount = p.discount ?? 0;
    const price = mrp - discount;
    const deal = discount > 0;
    const name = (p as any).name || (p as any).title || "Product";
    const stock = p.quantity ?? 1;
    const discountPercent = deal ? Math.round((discount / mrp) * 100) : 0;

    const { location } = useLocationContext();
    const theme = useUiTheme(location?.storeId);

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
              paddingBottom: RESERVED_BOTTOM, // ✅ reserve space for the ADD bar
            },
          ]}
        >
          {/* Image area */}
          <View
            style={[
              styles.imageContainer,
              { backgroundColor: theme.productImageBg },
            ]}
          >
            {deal && (
              <View
                style={[
                  styles.discountTag,
                  { backgroundColor: theme.discountTagBg },
                ]}
              >
                <Text style={styles.discountTagTxt}>
                  {discountPercent}% OFF
                </Text>
              </View>
            )}
            <Image
              source={
                (p as any).imageUrl || p.image
                  ? { uri: (p as any).imageUrl || p.image }
                  : undefined
              }
              style={styles.tileImg}
               contentFit="contain"
    cachePolicy="disk"
    priority="high"
    placeholder={BLUR}
    transition={150}
    recyclingKey={p.id}
            />
          </View>

          {/* Content */}
          <Text style={styles.tileName} numberOfLines={2}>
            {name}
          </Text>

          <View
            style={[styles.ribbon, { backgroundColor: theme.priceOverlayBg }]}
          >
            <Text style={styles.priceNow}>₹{price}</Text>
            {deal && <Text style={styles.priceMRP}>₹{mrp}</Text>}
          </View>

          {/* Cart bar (absolute) */}
          {qty === 0 ? (
            <Pressable
              style={[
                styles.cartBar,
                {
                  backgroundColor: theme.addToCartBg,
                  borderColor: theme.addToCartBg,
                  height: CART_BAR_H,
                  bottom: CART_BAR_MARGIN,
                },
              ]}
              onPress={() => {
                guard?.(() => addToCart(p.id, stock), isPan ?? false);
              }}
            >
              <Text style={styles.cartBarAdd}>ADD</Text>
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
              <Pressable onPress={() => decreaseQuantity(p.id)} hitSlop={12}>
                <MaterialIcons name="remove" size={18} color={theme.qtyBtnBg} />
              </Pressable>
              <Text style={[styles.qtyNum, { color: theme.qtyBtnBg }]}>
                {qty}
              </Text>
              <Pressable
                onPress={() => increaseQuantity(p.id, stock)}
                hitSlop={12}
              >
                <MaterialIcons name="add" size={18} color={theme.qtyBtnBg} />
              </Pressable>
            </View>
          )}
        </View>
      </Pressable>
    );
  }
);

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
    padding: 6,
  },

  imageContainer: {
    position: "relative",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 6,
    height: TILE_W - 12, // square image zone
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
    backgroundColor: "#d35400",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    zIndex: 2,
  },
  discountTagTxt: { color: "#fff", fontSize: 9, fontWeight: "700" },

  // tighten spacing so we stay above the reserved area
  tileName: { fontSize: 11, color: "#333", marginTop: 4, marginBottom: 2, height: 28 },
  ribbon: {
    marginTop: 0,
    marginBottom: 4, // was 6
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

  qtyNum: {
    fontWeight: "700",
    fontSize: 14,
    marginHorizontal: 10,
  },
});
