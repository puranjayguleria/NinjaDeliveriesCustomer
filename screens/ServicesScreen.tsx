// screens/ServicesScreen.tsx
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

export default function ServicesScreen() {
  return (
    <View style={styles.container}>
      
      {/* ===== Header ===== */}
      <View style={styles.header}>
        <MaterialIcons name="miscellaneous-services" size={64} color="#1E88E5" />
        <Text style={styles.headerTitle}>Services</Text>
        <Text style={styles.headerSub}>
          Book & manage your services easily
        </Text>
      </View>

      {/* ===== Service Cards ===== */}
      <TouchableOpacity style={styles.card} onPress={() => {}}>
        <MaterialIcons name="event-available" size={32} color="#1E88E5" />
        <Text style={styles.cardText}>Book Service</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={() => {}}>
        <MaterialIcons name="assignment" size={32} color="#43A047" />
        <Text style={styles.cardText}>My Services</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={() => {}}>
        <MaterialIcons name="support-agent" size={32} color="#FB8C00" />
        <Text style={styles.cardText}>Support</Text>
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
    padding: 16,
  },

  /* Header */
  header: {
    alignItems: "center",
    marginBottom: 32,
    marginTop: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    marginTop: 8,
    color: "#222",
  },
  headerSub: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },

  /* Cards */
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  cardText: {
    fontSize: 18,
    fontWeight: "600",
    marginLeft: 16,
    color: "#333",
  },
});
