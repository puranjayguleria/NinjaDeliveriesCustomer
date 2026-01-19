import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";

export default function BookingDetailsScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const {
    bookingId,
    serviceTitle,
    issueTitle,
    agencyName,
    rating,
    amount,
    date,
    time,
  } = route.params || {};

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Booking Confirmed 🎉</Text>

      <View style={styles.card}>
        <Text style={styles.bookingTitle}>
          {serviceTitle || "-"} - {issueTitle || "-"}
        </Text>

        <Text style={styles.subText}>📅 {date || "Today"} | ⏰ {time || "-"}</Text>

        <Text style={styles.subText}>
          👨‍🔧 Agency: {agencyName || "-"} ({rating ? `⭐ ${rating}` : "⭐ -"})
        </Text>

        <Text style={styles.subText}>Starts at ₹{amount || "-"}</Text>
        <Text style={styles.subText}>Paid Amount: ₹{amount || "-"}</Text>

        <Text style={styles.statusText}>Status: Ongoing</Text>
      </View>

      {/* Buttons Row */}
      <View style={styles.row}>
        <TouchableOpacity style={styles.callBtn}>
          <Text style={styles.callText}>Call Agency</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.trackBtn}>
          <Text style={styles.trackText}>Track Booking</Text>
        </TouchableOpacity>
      </View>

      {/* Booking History Button */}
      <TouchableOpacity
        style={styles.historyBtn}
        onPress={() => navigation.navigate("BookingHistory")}
      >
        <Text style={styles.historyText}>Go to Booking History</Text>
      </TouchableOpacity>
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
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 14,
  },
  card: {
    backgroundColor: "#f3f4f6",
    padding: 16,
    borderRadius: 18,
  },
  bookingTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 10,
    color: "#111827",
  },
  subText: {
    color: "#374151",
    marginTop: 6,
    fontSize: 14,
  },
  statusText: {
    marginTop: 10,
    fontWeight: "800",
    fontSize: 15,
    color: "green",
  },

  row: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
  },

  callBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  callText: {
    color: "white",
    fontWeight: "800",
    fontSize: 15,
  },

  trackBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: "#6D28D9",
    alignItems: "center",
    justifyContent: "center",
  },
  trackText: {
    color: "white",
    fontWeight: "800",
    fontSize: 15,
  },

  historyBtn: {
    marginTop: 16,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: "#00a884",
    alignItems: "center",
    justifyContent: "center",
  },
  historyText: {
    color: "white",
    fontWeight: "900",
    fontSize: 16,
  },
});
