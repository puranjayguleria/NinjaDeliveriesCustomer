import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";

export default function BookingDetailsScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  // Get all possible parameters
  const params = route.params || {};
  
  console.log("BookingDetailsScreen received params:", params);

  // Try to extract data from different possible formats
  const extractedData = {
    bookingId: params.bookingId || params.bookings?.[0]?.bookingId || "BK" + Date.now().toString().slice(-6),
    serviceTitle: params.serviceTitle || params.bookings?.[0]?.serviceTitle || "Electrician Service",
    issues: params.issues || params.bookings?.[0]?.issues || ["Fan not working", "Switch repair"],
    company: params.company || params.bookings?.[0]?.company || { name: "Quick Fix Services", price: 299, rating: 4.5 },
    agency: params.agency || params.bookings?.[0]?.agency || null,
    amount: params.amount || params.totalAmount || params.bookings?.[0]?.totalPrice || 299,
    date: params.date || params.bookings?.[0]?.selectedDate || new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric", 
      month: "long",
      day: "numeric"
    }),
    time: params.time || params.bookings?.[0]?.selectedTime || "2:00 PM - 4:00 PM",
    paymentMethod: params.paymentMethod || "cash",
    paymentStatus: params.paymentStatus || "pending",
  };

  console.log("Extracted data:", extractedData);

  return (
    <View style={styles.container}>
      {/* Header with back button */}
      <View style={styles.headerSection}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.header}>Booking Confirmed 🎉</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.bookingTitle}>
            {extractedData.serviceTitle}
          </Text>

          {/* Booking ID */}
          <View style={styles.detailRow}>
            <Text style={styles.label}>🧾 Booking ID</Text>
            <Text style={styles.value}>{extractedData.bookingId}</Text>
          </View>

          {/* Date & Time */}
          <View style={styles.detailRow}>
            <Text style={styles.label}>📅 Date</Text>
            <Text style={styles.value}>{extractedData.date}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.label}>⏰ Time</Text>
            <Text style={styles.value}>{extractedData.time}</Text>
          </View>

          {/* Company/Agency */}
          <View style={styles.detailRow}>
            <Text style={styles.label}>🏢 Provider</Text>
            <Text style={styles.value}>
              {extractedData.company?.name || extractedData.agency?.name || "Service Provider"}
              {extractedData.company?.price && ` • ₹${extractedData.company.price}`}
              {extractedData.agency?.rating && ` • ⭐ ${extractedData.agency.rating}`}
              {extractedData.company?.rating && ` • ⭐ ${extractedData.company.rating}`}
            </Text>
          </View>

          {/* Issues */}
          <View style={styles.issuesSection}>
            <Text style={styles.sectionTitle}>🛠 Selected Issues:</Text>
            <ScrollView style={styles.issuesScroll} showsVerticalScrollIndicator={false}>
              {(extractedData.issues || []).map((issue: string, i: number) => (
                <Text key={i} style={styles.issueLine}>
                  • {issue}
                </Text>
              ))}
            </ScrollView>
          </View>

          {/* Payment Info */}
          <View style={styles.paymentSection}>
            <View style={styles.detailRow}>
              <Text style={styles.label}>💰 Amount</Text>
              <Text style={styles.amount}>₹{extractedData.amount}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.label}>💳 Payment</Text>
              <Text style={styles.value}>
                {extractedData.paymentMethod === "online" ? "Paid Online" : "Cash on Service"}
              </Text>
            </View>

            <View style={styles.statusContainer}>
              <Text style={[
                styles.statusText, 
                { color: extractedData.paymentStatus === "paid" ? "#10B981" : "#F59E0B" }
              ]}>
                Status: {extractedData.paymentStatus === "paid" ? "Payment Completed" : "Booking Confirmed"}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionSection}>
          <View style={styles.row}>
            <TouchableOpacity style={styles.callBtn} activeOpacity={0.9}>
              <Text style={styles.callText}>📞 Call Provider</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.trackBtn} 
              activeOpacity={0.9}
              onPress={() => navigation.navigate("TrackBooking", {
                bookingId: extractedData.bookingId,
              })}
            >
              <Text style={styles.trackText}>📍 Track Booking</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.historyBtn}
            activeOpacity={0.9}
            onPress={() => navigation.navigate("BookingHistory")}
          >
            <Text style={styles.historyText}>📚 View Booking History</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  
  // Header Section
  headerSection: {
    backgroundColor: "white",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },

  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },

  backButtonText: {
    color: "#3B82F6",
    fontSize: 16,
    fontWeight: "500",
  },

  header: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },

  // Scroll View
  scrollView: {
    flex: 1,
  },

  // Main Card
  card: {
    backgroundColor: "white",
    margin: 20,
    padding: 24,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  bookingTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 20,
    color: "#111827",
    textAlign: "center",
  },

  // Detail Rows
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
    gap: 16,
  },

  label: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
    width: "40%",
  },

  value: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
  },

  amount: {
    fontSize: 16,
    color: "#10B981",
    fontWeight: "700",
    flex: 1,
    textAlign: "right",
  },

  // Services Section (for multiple bookings)
  servicesSection: {
    marginTop: 16,
    marginBottom: 16,
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 12,
  },

  serviceItem: {
    backgroundColor: "#F3F4F6",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },

  serviceTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },

  serviceCompany: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },

  servicePrice: {
    fontSize: 14,
    fontWeight: "600",
    color: "#10B981",
  },

  moreServices: {
    fontSize: 12,
    color: "#6B7280",
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 4,
  },

  // Issues Section (for single booking)
  issuesSection: {
    marginTop: 16,
    marginBottom: 16,
  },

  issuesScroll: {
    maxHeight: 100,
  },

  issueLine: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "500",
    marginBottom: 4,
    lineHeight: 18,
  },

  // Payment Section
  paymentSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },

  statusContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "#F0FDF4",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },

  statusText: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },

  // Action Section
  actionSection: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },

  row: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },

  callBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },

  callText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },

  trackBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#3B82F6",
    alignItems: "center",
    justifyContent: "center",
  },

  trackText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },

  historyBtn: {
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
  },

  historyText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
});
