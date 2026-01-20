import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";

export default function ServiceRatingScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const [rating, setRating] = useState(5);

  const submit = () => {
    navigation.popToTop();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Rate Service</Text>
      <Text style={styles.sub}>How was your experience?</Text>

      <View style={styles.ratingRow}>
        {[1, 2, 3, 4, 5].map((num) => (
          <TouchableOpacity
            key={num}
            onPress={() => setRating(num)}
            style={[styles.star, rating >= num ? styles.starActive : null]}
          >
            <Text style={{ fontWeight: "900" }}>{num}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.btn} activeOpacity={0.9} onPress={submit}>
        <Text style={styles.btnText}>Submit Rating</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16, justifyContent: "center" },
  header: { fontSize: 22, fontWeight: "900", textAlign: "center" },
  sub: { marginTop: 6, color: "#666", textAlign: "center", fontWeight: "600" },

  ratingRow: { flexDirection: "row", justifyContent: "center", gap: 10, marginTop: 20 },

  star: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#f6f6f6",
    alignItems: "center",
    justifyContent: "center",
  },

  starActive: {
    backgroundColor: "#FFD700",
  },

  btn: { marginTop: 25, backgroundColor: "#6D28D9", padding: 14, borderRadius: 16 },
  btnText: { color: "#fff", textAlign: "center", fontWeight: "900" },
});
