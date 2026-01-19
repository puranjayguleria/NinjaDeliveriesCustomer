import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
} from "react-native";
import { useNavigation } from "@react-navigation/native";

const BOOKINGS = [
  {
    id: "BK001",
    service: "Electrician",
    issue: "Fan Not Working",
    date: "Today",
    time: "1:00 PM - 3:00 PM",
    agency: "Fixit Experts",
    status: "Ongoing",
    icon: require("../assets/images/icon_home_repair.png"),
  },
  {
    id: "BK002",
    service: "AC Repair",
    issue: "AC servicing & repair",
    date: "Tomorrow",
    time: "11:00 AM - 1:00 PM",
    agency: "Quick Care Services",
    status: "Completed",
    icon: require("../assets/images/icon_cleaning.png"),
  },
];

export default function BookingHistoryScreen() {
  const navigation = useNavigation<any>();

  const renderItem = ({ item }: any) => {
    const isOngoing = item.status === "Ongoing";

    return (
      <View style={styles.card}>
        {/* Left Icon */}
        <Image source={item.icon} style={styles.icon} />

        {/* Middle Info */}
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>
            {item.service} - {item.issue}
          </Text>

          <Text style={styles.meta}>
            📅 {item.date} | ⏰ {item.time}
          </Text>

          <Text style={styles.meta}>👨‍🔧 {item.agency}</Text>
        </View>

        {/* Right Status */}
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: isOngoing ? "#DCFCE7" : "#DBEAFE" },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              { color: isOngoing ? "#166534" : "#1D4ED8" },
            ]}
          >
            {item.status}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Booking History</Text>

      <FlatList
        style={{ marginTop: 14 }}
        data={BOOKINGS}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 20 }}
      />

      <TouchableOpacity
        style={styles.backBtn}
        activeOpacity={0.9}
        onPress={() => navigation.navigate("ServicesHome")}
      >
        <Text style={styles.backText}>Back to Services</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },

  header: { fontSize: 22, fontWeight: "900" },

  card: {
    backgroundColor: "#f6f6f6",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  icon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#fff",
  },

  title: {
    fontSize: 14,
    fontWeight: "900",
    color: "#111",
  },

  meta: {
    marginTop: 6,
    fontSize: 12,
    color: "#555",
    fontWeight: "600",
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  statusText: {
    fontSize: 11,
    fontWeight: "900",
  },

  backBtn: {
    marginTop: 8,
    backgroundColor: "#6D28D9",
    paddingVertical: 14,
    borderRadius: 16,
  },

  backText: {
    color: "white",
    fontWeight: "900",
    textAlign: "center",
    fontSize: 14,
  },
});
