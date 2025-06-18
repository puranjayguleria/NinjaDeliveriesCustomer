import React from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

import { useCart, useCartQty } from "@/context/CartContext";

const TILE_W = 120;
const TILE_H = 210;

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
  guard?: (cb: () => void, isPan: boolean) => void; // ✅ NEW
  isPan?: boolean; // ✅ NEW
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
    const name = p.name || p.title || "Product";
    const stock = p.quantity ?? 1; // Ensures there's a fallback
    const discountPercent = deal ? Math.round((discount / mrp) * 100) : 0;

    return (
      <Pressable>
        <View style={[styles.tile, { width: TILE_W, height: TILE_H }]}>
          <Image
            source={
              p.imageUrl || p.image ? { uri: p.imageUrl || p.image } : undefined
            }
            style={styles.tileImg}
            resizeMode="cover"
          />
          {deal && (
            <View style={styles.discountTag}>
              <Text style={styles.discountTagTxt}>{discountPercent}% OFF</Text>
            </View>
          )}
          <Text style={styles.tileName} numberOfLines={2}>
            {name}
          </Text>
          <View style={styles.ribbon}>
            <Text style={styles.priceNow}>₹{price}</Text>
            {deal && <Text style={styles.priceMRP}>₹{mrp}</Text>}
          </View>
          {qty === 0 ? (
            <Pressable
              style={[
                styles.cartBar,
                { backgroundColor: "#009688", borderColor: "#009688" },
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
                  backgroundColor: "#fff",
                  borderColor: "#009688",
                  flexDirection: "row",
                },
              ]}
            >
              <Pressable onPress={() => decreaseQuantity(p.id)} hitSlop={12}>
                <MaterialIcons name="remove" size={18} color="#009688" />
              </Pressable>
              <Text style={styles.qtyNum}>{qty}</Text>
              <Pressable
                onPress={() => increaseQuantity(p.id, stock)}
                hitSlop={12}
              >
                <MaterialIcons name="add" size={18} color="#009688" />
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
  tileImg: {
    width: TILE_W - 12,
    height: TILE_W - 12,
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
  },
  discountTagTxt: { color: "#fff", fontSize: 9, fontWeight: "700" },
  tileName: { fontSize: 11, color: "#333", marginTop: 4, height: 28 },
  ribbon: {
    marginTop: 2,
    marginBottom: 6,
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
    bottom: 6,
    left: 6,
    right: 6,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  cartBarAdd: { color: "#fff", fontWeight: "700", fontSize: 12 },
  qtyNum: {
    color: "#009688",
    fontWeight: "700",
    fontSize: 14,
    marginHorizontal: 10,
  },
});
