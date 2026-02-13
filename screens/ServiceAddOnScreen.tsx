import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";

export default function ServiceAddOnScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const { serviceTitle, issueTitle } = route.params;

  const [extraIssue, setExtraIssue] = useState("");

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Add-on Details</Text>
      <Text style={styles.subHeader}>
        {serviceTitle} • {issueTitle}
      </Text>

      <TextInput
        placeholder="Example: fan noise + switch sparks..."
        value={extraIssue}
        onChangeText={setExtraIssue}
        multiline
        style={styles.input}
      />

      <TouchableOpacity
        style={styles.btn}
        activeOpacity={0.9}
        onPress={() =>
          navigation.navigate("FinalCheckout", {
            ...route.params,
            extraIssue,
          })
        }
      >
        <Text style={styles.btnText}>Go to Final Checkout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  header: { fontSize: 22, fontWeight: "900" },
  subHeader: { marginTop: 6, color: "#666", fontWeight: "600" },

  input: {
    marginTop: 14,
    height: 120,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 16,
    padding: 12,
    textAlignVertical: "top",
    fontWeight: "600",
    color: "#111",
  },

  btn: { marginTop: 20, backgroundColor: "#6D28D9", padding: 14, borderRadius: 16 },
  btnText: { color: "#fff", textAlign: "center", fontWeight: "900" },
});
