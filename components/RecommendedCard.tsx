import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

type Props = {
  item: {
    name: string;
    image: string;
    price: number;
    discount?: number;
  };
  qtyInCart: number;
  width?: number;          // 👈 optional – parent sends it
  onAdd: () => void;
  onInc: () => void;
  onDec: () => void;
};

/* ---------- sizing ---------- */
const DEFAULT_W = (Dimensions.get("window").width - 48) / 3.2; // your old calc

export default function RecommendCard({
  item,
  qtyInCart,
  width = DEFAULT_W,
  onAdd,
  onInc,
  onDec,
}: Props) {
  /* price helpers ---------------------------------------------------- */
  const base    = item.price ?? 0;
  const saving  = item.discount ?? 0;
  const final   = Math.max(base - saving, 0);

  return (
    <View style={[styles.card, { width }]}>
      {/* product image */}
      <Image source={{ uri: item.image }} style={styles.img} />

      {/* name */}
      <Text style={styles.name} numberOfLines={2}>
        {item.name}
      </Text>

      {/* price row */}
      <View style={styles.priceRow}>
        <Text style={styles.final}>₹{final}</Text>
        {saving > 0 && (
          <>
            <Text style={styles.mrp}>₹{base}</Text>
            <View style={styles.saveTag}>
              <Text style={styles.saveTxt}>-{saving}</Text>
            </View>
          </>
        )}
      </View>

      {/* cart controls */}
      {qtyInCart > 0 ? (
        <View style={styles.qtyBox}>
          <TouchableOpacity onPress={onDec} hitSlop={8}>
            <MaterialIcons name="remove" size={18} color="#fff" />
          </TouchableOpacity>

          <Text style={styles.qtyTxt}>{qtyInCart}</Text>

          <TouchableOpacity onPress={onInc} hitSlop={8}>
            <MaterialIcons name="add" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.addBtn} onPress={onAdd}>
          <MaterialIcons name="add-shopping-cart" size={16} color="#fff" />
          <Text style={styles.addTxt}>Add</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/* ---------- styles ---------- */
const ACCENT = "#00C853";              // Blinkit green

const styles = StyleSheet.create({
  card: {
    marginRight: 12,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 2,
  },

  img: {
    width: "100%",
    height: 80,
    resizeMode: "contain",
    borderRadius: 6,
  },

  name: {
    fontSize: 11,
    fontWeight: "600",
    color: "#333",
    marginTop: 4,
    minHeight: 28,
  },

  /* price */
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  final: { fontSize: 12, fontWeight: "700", color: "#212121" },
  mrp: {
    fontSize: 10,
    color: "#777",
    textDecorationLine: "line-through",
    marginLeft: 4,
  },
  saveTag: {
    marginLeft: 4,
    backgroundColor: "#FFEDE8",
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  saveTxt: { fontSize: 9, color: "#E65100", fontWeight: "700" },

  /* add / qty */
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ACCENT,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 6,
  },
  addTxt: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
    marginLeft: 4,
  },

  qtyBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: ACCENT,
    borderRadius: 6,
    marginTop: 6,
    paddingHorizontal: 6,
    minHeight: 32,
  },
  qtyTxt: { color: "#fff", fontSize: 12, fontWeight: "700" },
});
