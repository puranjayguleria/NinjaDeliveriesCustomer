import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";

export default function FinalCheckoutScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const { company, extraIssue } = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Final Checkout</Text>

      <View style={styles.box}>
        <Text style={styles.label}>Company</Text>
        <Text style={styles.value}>{company?.name}</Text>

        <Text style={styles.label}>Base Price</Text>
        <Text style={styles.value}>₹{company?.price}</Text>

        {extraIssue ? (
          <>
            <Text style={styles.label}>Extra Issue</Text>
            <Text style={styles.value}>{extraIssue}</Text>
          </>
        ) : null}
      </View>

      <TouchableOpacity
        style={styles.btn}
        activeOpacity={0.9}
        onPress={() => navigation.navigate("ServiceTimer", route.params)}
      >
        <Text style={styles.btnText}>Start Timer</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  header: { fontSize: 22, fontWeight: "900" },

  box: { backgroundColor: "#f6f6f6", borderRadius: 18, padding: 14, marginTop: 14 },
  label: { marginTop: 10, color: "#666", fontWeight: "700", fontSize: 12 },
  value: { marginTop: 4, fontWeight: "900", fontSize: 14, color: "#111" },

  btn: { marginTop: 20, backgroundColor: "green", padding: 14, borderRadius: 16 },
  btnText: { color: "#fff", textAlign: "center", fontWeight: "900" },
});
