import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";

export default function PaymentScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const { bookingId, amount } = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Payment</Text>

      {/* Top Banner Card */}
      <View style={styles.bannerCard}>
        <Image
          source={require("../assets/images/icon_home_repair.png")}
          style={styles.bannerIcon}
        />

        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle}>Secure Your Slot</Text>
          <Text style={styles.bannerSub}>
            Pay small advance to confirm booking
          </Text>
        </View>
      </View>

      {/* Payment Details Card */}
      <View style={styles.payCard}>
        <Text style={styles.payTitle}>Pay Now</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Booking ID</Text>
          <Text style={styles.value}>{bookingId}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Advance Amount</Text>
          <Text style={styles.amount}>₹{amount}</Text>
        </View>

        <View style={styles.noteBox}>
          <Text style={styles.noteTitle}>Note</Text>
          <Text style={styles.noteText}>
            This amount confirms your slot. Remaining payment will be collected
            after service completion.
          </Text>
        </View>
      </View>

      {/* Pay Button */}
 <TouchableOpacity
  style={styles.payBtn}
  activeOpacity={0.9}
  onPress={() =>
    navigation.navigate("BookingDetails", {
      bookingId,
      serviceTitle: "Electrician",
      issueTitle: "Switchboard Repair",
      agencyName: "Fixit Experts",
      rating: 4.5,
      amount,
      date: "Today",
      time: "1:00 PM - 3:00 PM",
    })
  }
>
  <Text style={styles.payBtnText}>Pay ₹{amount} & Confirm</Text>
</TouchableOpacity>


      {/* Skip / Back */}
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.backText}>Go Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },

  header: { fontSize: 22, fontWeight: "800", marginBottom: 14 },

  bannerCard: {
    backgroundColor: "#F3E8FF",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },

  bannerIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#fff",
  },

  bannerTitle: { fontSize: 16, fontWeight: "900", color: "#4C1D95" },
  bannerSub: { marginTop: 4, fontSize: 12, color: "#6B21A8" },

  payCard: {
    backgroundColor: "#f6f6f6",
    borderRadius: 18,
    padding: 16,
  },

  payTitle: { fontSize: 16, fontWeight: "900", marginBottom: 12 },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  label: { fontSize: 13, color: "#666", fontWeight: "700" },
  value: { fontSize: 13, color: "#111", fontWeight: "800" },

  amount: { fontSize: 16, color: "#16A34A", fontWeight: "900" },

  noteBox: {
    marginTop: 12,
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 14,
  },

  noteTitle: { fontWeight: "900", marginBottom: 4, color: "#111" },
  noteText: { fontSize: 12, color: "#444", lineHeight: 16 },

  payBtn: {
    marginTop: 18,
    backgroundColor: "#6D28D9",
    paddingVertical: 14,
    borderRadius: 16,
  },

  payBtnText: {
    color: "white",
    fontWeight: "900",
    textAlign: "center",
    fontSize: 14,
  },

  backBtn: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ddd",
  },

  backText: {
    textAlign: "center",
    fontWeight: "800",
    color: "#333",
  },
});
