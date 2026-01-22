import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";

const companies = [
  { id: "1", name: "Ninja Electric Service", price: 199, time: "30 min" },
  { id: "2", name: "Quick Fix Electrician", price: 249, time: "40 min" },
  { id: "3", name: "Home Repair Pro", price: 299, time: "45 min" },
];

export default function CompanySelectionScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const { serviceTitle, issues } = route.params;

  const selectCompany = (company: any) => {
    navigation.navigate("SelectDateTime", {
      serviceTitle,
      issues,
      company,
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Select Company</Text>
      <Text style={styles.subHeader}>{serviceTitle}</Text>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Selected Issues:</Text>
        {Array.isArray(issues) && issues.length > 0 ? (
          issues.map((x: string, i: number) => (
            <Text key={i} style={styles.issueLine}>
              • {x}
            </Text>
          ))
        ) : (
          <Text style={styles.issueLine}>No issues selected</Text>
        )}
      </View>

      <FlatList
        style={{ marginTop: 12 }}
        data={companies}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.9}
            onPress={() => selectCompany(item)}
          >
            <Text style={styles.title}>{item.name}</Text>
            <Text style={styles.price}>
              ₹{item.price} • {item.time}
            </Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  header: { fontSize: 22, fontWeight: "900" },
  subHeader: { marginTop: 4, color: "#666", fontWeight: "700" },

  infoBox: {
    marginTop: 12,
    backgroundColor: "#f6f6f6",
    borderRadius: 16,
    padding: 12,
  },
  infoTitle: { fontWeight: "900", color: "#111", fontSize: 13 },
  issueLine: { marginTop: 6, color: "#444", fontWeight: "700", fontSize: 12 },

  card: {
    backgroundColor: "#f6f6f6",
    padding: 14,
    borderRadius: 18,
    marginBottom: 12,
  },

  title: { fontSize: 15, fontWeight: "900", color: "#111" },
  price: { marginTop: 6, color: "#444", fontWeight: "800" },
});
