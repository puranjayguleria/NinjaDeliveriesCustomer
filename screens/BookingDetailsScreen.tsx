import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";

export default function BookingDetailsScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const {
    bookingId,
    serviceTitle,
    issues,
    company,
    agency,
    amount,
    date,
    time,
  } = route.params || {};

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Booking Confirmed 🎉</Text>

      <View style={styles.card}>
        <Text style={styles.bookingTitle}>
          {serviceTitle || "-"}
        </Text>

        {/* Booking ID */}
        <Text style={styles.subText}>🧾 Booking ID: {bookingId || "-"}</Text>

        {/* Slot */}
        <Text style={styles.subText}>
          📅 {date || "-"} | ⏰ {time || "-"}
        </Text>

        {/* Company */}
        {company?.name ? (
          <Text style={styles.subText}>
            🏢 Company: {company.name} • ₹{company.price}
          </Text>
        ) : (
          <Text style={styles.subText}>🏢 Company: -</Text>
        )}

        {/* Agency */}
        {agency?.name ? (
          <Text style={styles.subText}>
            👨‍🔧 Agency: {agency.name} ({agency.rating ? `⭐ ${agency.rating}` : "⭐ -"})
          </Text>
        ) : (
          <Text style={styles.subText}>👨‍🔧 Agency: -</Text>
        )}

        {/* Issues list */}
        <Text style={[styles.subText, { marginTop: 10, fontWeight: "800" }]}>
          🛠 Selected Issues:
        </Text>

        {Array.isArray(issues) && issues.length > 0 ? (
          <ScrollView style={{ maxHeight: 90 }} showsVerticalScrollIndicator={false}>
            {issues.map((x: string, i: number) => (
              <Text key={i} style={styles.issueLine}>
                • {x}
              </Text>
            ))}
          </ScrollView>
        ) : (
          <Text style={styles.issueLine}>-</Text>
        )}

        {/* Payment */}
        <Text style={[styles.subText, { marginTop: 10 }]}>
          💰 Advance Paid: ₹{amount || "-"}
        </Text>

        <Text style={styles.statusText}>Status: Ongoing</Text>
      </View>

      {/* Buttons Row */}
      <View style={styles.row}>
        <TouchableOpacity style={styles.callBtn} activeOpacity={0.9}>
          <Text style={styles.callText}>Call Agency</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.trackBtn} activeOpacity={0.9}>
          <Text style={styles.trackText}>Track Booking</Text>
        </TouchableOpacity>
      </View>

      {/* Booking History Button */}
      <TouchableOpacity
        style={styles.historyBtn}
        activeOpacity={0.9}
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
    fontWeight: "900",
    marginBottom: 10,
    color: "#111827",
  },
  subText: {
    color: "#374151",
    marginTop: 6,
    fontSize: 14,
    fontWeight: "700",
  },

  issueLine: {
    marginTop: 4,
    color: "#111827",
    fontSize: 13,
    fontWeight: "700",
  },

  statusText: {
    marginTop: 12,
    fontWeight: "900",
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
