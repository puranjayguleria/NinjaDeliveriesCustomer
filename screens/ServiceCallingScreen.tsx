import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";

export default function ServiceCallingScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Calling Technician...</Text>
      <Text style={styles.sub}>Connecting your service provider</Text>

      <TouchableOpacity
        style={styles.btn}
        activeOpacity={0.9}
        onPress={() => navigation.navigate("ServiceVisit", route.params)}
      >
        <Text style={styles.btnText}>Technician Arrived</Text>
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
    backgroundColor: "#6D28D9",
    padding: 14,
    borderRadius: 16,
  },
  btnText: { color: "#fff", textAlign: "center", fontWeight: "900" },
});
