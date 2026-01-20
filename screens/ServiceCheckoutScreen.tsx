import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";

export default function ServiceCheckoutScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const { serviceTitle, issueTitle, description, company } = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Checkout</Text>

      <View style={styles.box}>
        <Text style={styles.label}>Service</Text>
        <Text style={styles.value}>{serviceTitle}</Text>

        <Text style={styles.label}>Issue</Text>
        <Text style={styles.value}>{issueTitle}</Text>

        {description ? (
          <>
            <Text style={styles.label}>Description</Text>
            <Text style={styles.value}>{description}</Text>
          </>
        ) : null}

        <Text style={styles.label}>Company</Text>
        <Text style={styles.value}>{company?.name}</Text>

        <Text style={styles.label}>Price</Text>
        <Text style={styles.value}>₹{company?.price}</Text>
      </View>

      <TouchableOpacity
        style={styles.btn}
        activeOpacity={0.9}
        onPress={() =>
          navigation.navigate("ServiceCalling", {
            ...route.params,
          })
        }
      >
        <Text style={styles.btnText}>Confirm & Call</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  header: { fontSize: 22, fontWeight: "900" },

  box: {
    backgroundColor: "#f6f6f6",
    borderRadius: 18,
    padding: 14,
    marginTop: 14,
  },

  label: { marginTop: 10, color: "#666", fontWeight: "700", fontSize: 12 },
  value: { marginTop: 4, fontWeight: "900", fontSize: 14, color: "#111" },

  btn: {
    marginTop: 20,
    backgroundColor: "#6D28D9",
    padding: 14,
    borderRadius: 16,
  },
  btnText: { color: "#fff", textAlign: "center", fontWeight: "900" },
});
