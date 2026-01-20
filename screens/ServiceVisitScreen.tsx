import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";

export default function ServiceVisitScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Visit Started</Text>
      <Text style={styles.sub}>You can add extra issue details now</Text>

      <TouchableOpacity
        style={styles.btn}
        activeOpacity={0.9}
        onPress={() => navigation.navigate("ServiceAddOn", route.params)}
      >
        <Text style={styles.btnText}>Add-on / Describe Issue</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16, justifyContent: "center" },
  header: { fontSize: 22, fontWeight: "900", textAlign: "center" },
  sub: { marginTop: 6, color: "#666", textAlign: "center", fontWeight: "600" },

  btn: {
    marginTop: 20,
    backgroundColor: "#000",
    padding: 14,
    borderRadius: 16,
  },
  btnText: { color: "#fff", textAlign: "center", fontWeight: "900" },
});
