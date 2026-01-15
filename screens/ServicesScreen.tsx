//"services for car wash"
import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";

const SERVICES = [
  {
    id: "car-wash",
    title: "Car Wash",
    subtitle: "Exterior & Interior cleaning",
    price: "Starting at ₹299",
  },
];

export default function ServicesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Our Services</Text>

      <FlatList
        data={SERVICES}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card}>
            <View>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.subtitle}>{item.subtitle}</Text>
              <Text style={styles.price}>{item.price}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
  },
  header: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#f6f6f6",
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    elevation: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 13,
    color: "#666",
    marginTop: 4,
  },
  price: {
    fontSize: 14,
    color: "#00a884",
    marginTop: 8,
    fontWeight: "600",
  },
});
