import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";

const companies = [
  { id: "1", name: "Ninja Electric Service", price: 199, time: "30 min" },
  { id: "2", name: "Quick Fix Electrician", price: 249, time: "40 min" },
  { id: "3", name: "Home Repair Pro", price: 299, time: "45 min" },
];

export default function CompanySelectionScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const { serviceTitle, issueTitle, description } = route.params;

  const selectCompany = (company: any) => {
    navigation.navigate("ServiceCheckout", {
      serviceTitle,
      issueTitle,
      description,
      company,
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Select Company</Text>
      <Text style={styles.subHeader}>Issue: {issueTitle}</Text>

      <FlatList
        data={companies}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.9}
            onPress={() => selectCompany(item)}
          >
            <Text style={styles.title}>{item.name}</Text>
            <Text style={styles.price}>₹{item.price} • {item.time}</Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  header: { fontSize: 22, fontWeight: "900" },
  subHeader: { marginTop: 4, color: "#666", fontWeight: "600" },

  card: {
    backgroundColor: "#f6f6f6",
    padding: 14,
    borderRadius: 18,
    marginTop: 12,
  },

  title: { fontSize: 15, fontWeight: "900", color: "#111" },
  price: { marginTop: 6, color: "#444", fontWeight: "700" },
});
