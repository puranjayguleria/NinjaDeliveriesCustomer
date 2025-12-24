// components/RestaurantMenuItemRow.tsx

import React from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useRestaurantCart } from "@/context/RestaurantCartContext";

export type RestaurantMenuItem = {
  id: string;
  name: string;
  description?: string;
  price?: number;
  isVeg?: boolean;
  imageUrl?: string;
  image?: string;    // fallback
  photoUrl?: string; // fallback
};

type Props = {
  restaurantId: string;
  item: RestaurantMenuItem;
};

const RestaurantMenuItemRow: React.FC<Props> = ({ restaurantId, item }) => {
  const { addItem, increase, decrease, getItemQty } = useRestaurantCart();

  const qty = getItemQty(item.id);

  const price =
    item.price ??
    // @ts-ignore – defensive fallback
    item.finalPrice ??
    // @ts-ignore
    item.defaultPrice ??
    0;

  const description =
    item.description ??
    // @ts-ignore
    item.subtitle ??
    "";

  const img =
    item.imageUrl ??
    // @ts-ignore
    item.image ??
    // @ts-ignore
    item.photoUrl ??
    undefined;

  const isVeg = item.isVeg ?? true;

  const handleAdd = () => {
    if (!restaurantId) return;
    addItem(restaurantId, {
      id: item.id,
      name: item.name,
      price,
      isVeg,
      imageUrl: img,
    });
  };

  return (
    <View style={styles.container}>
      {/* Left: veg icon + text */}
      <View style={{ flex: 1, paddingRight: 8 }}>
        <View style={styles.vegRow}>
          <View
            style={[
              styles.vegBox,
              { borderColor: isVeg ? "#2e7d32" : "#b71c1c" },
            ]}
          >
            <View
              style={[
                styles.vegDot,
                { backgroundColor: isVeg ? "#2e7d32" : "#b71c1c" },
              ]}
            />
          </View>
        </View>

        <Text style={styles.name}>{item.name}</Text>

        {!!description && (
          <Text style={styles.desc} numberOfLines={2}>
            {description}
          </Text>
        )}

        <Text style={styles.price}>₹{price}</Text>
      </View>

      {/* Right: image + ADD / + - control */}
      <View style={styles.rightBlock}>
        {img ? (
          <Image source={{ uri: img }} style={styles.image} />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Text style={styles.imagePlaceholderText}>Food</Text>
          </View>
        )}

        {qty === 0 ? (
          <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
            <Text style={styles.addText}>ADD</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.qtyControls}>
            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={() => decrease(item.id)}
            >
              <Text style={styles.qtyBtnText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.qtyText}>{qty}</Text>
            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={() => increase(item.id)}
            >
              <Text style={styles.qtyBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

export default RestaurantMenuItemRow;

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
    alignItems: "center",
  },
  vegRow: {
    marginBottom: 4,
  },
  vegBox: {
    width: 14,
    height: 14,
    borderRadius: 2,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  vegDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  name: {
    fontSize: 14,
    fontWeight: "600",
    color: "#222",
  },
  desc: {
    fontSize: 11,
    color: "#777",
    marginTop: 2,
  },
  price: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
    marginTop: 6,
  },
  rightBlock: {
    alignItems: "center",
    width: 90,
  },
  image: {
    width: 76,
    height: 76,
    borderRadius: 8,
    marginBottom: 6,
  },
  imagePlaceholder: {
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
  },
  imagePlaceholderText: {
    fontSize: 11,
    color: "#999",
  },
  addBtn: {
    borderWidth: 1,
    borderColor: "#00b4a0",
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  addText: {
    fontSize: 12,
    color: "#00b4a0",
    fontWeight: "700",
  },
  qtyControls: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#00b4a0",
    overflow: "hidden",
  },
  qtyBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#00b4a0",
  },
  qtyBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  qtyText: {
    paddingHorizontal: 10,
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
  },
});
