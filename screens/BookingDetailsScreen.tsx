import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";

export default function BookingDetailsScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const {
    // New format from PaymentScreen (multiple bookings)
    bookings,
    totalAmount,
    paymentMethod,
    paymentStatus,
    // Old format (single booking)
    bookingId,
    serviceTitle,
    issues,
    company,
    agency,
    amount,
    date,
    time,
  } = route.params || {};

  // Determine if this is new format (multiple bookings) or old format (single booking)
  const isMultipleBookings = bookings && Array.isArray(bookings);
  
  // Extract data based on format
  const displayData = isMultipleBookings ? {
    bookingId: bookings[0]?.bookingId || "BK" + Date.now().toString().slice(-6),
    serviceTitle: bookings.length > 1 
      ? `${bookings.length} Services Booked` 
      : bookings[0]?.serviceTitle || "Service Booking",
    issues: bookings.flatMap((booking: any) => booking.issues || []),
    company: bookings[0]?.company,
    agency: bookings[0]?.agency,
    amount: totalAmount,
    date: bookings[0]?.selectedDate || "Today",
    time: bookings[0]?.selectedTime || "TBD",
    paymentMethod: paymentMethod || "cash",
    paymentStatus: paymentStatus || "pending",
  } : {
    bookingId: bookingId || "BK" + Date.now().toString().slice(-6),
    serviceTitle: serviceTitle || "Service Booking",
    issues: issues || [],
    company,
    agency,
    amount: amount || 0,
    date: date || "Today",
    time: time || "TBD",
    paymentMethod: paymentMethod || "cash",
    paymentStatus: paymentStatus || "pending",
  };

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
            {displayData.serviceTitle}
          </Text>

          {/* Booking ID */}
          <View style={styles.detailRow}>
            <Text style={styles.label}>🧾 Booking ID</Text>
            <Text style={styles.value}>{displayData.bookingId}</Text>
          </View>

          {/* Date & Time */}
          <View style={styles.detailRow}>
            <Text style={styles.label}>📅 Date</Text>
            <Text style={styles.value}>{displayData.date}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.label}>⏰ Time</Text>
            <Text style={styles.value}>{displayData.time}</Text>
          </View>

          {/* Company/Agency */}
          {(displayData.company?.name || displayData.agency?.name) && (
            <View style={styles.detailRow}>
              <Text style={styles.label}>🏢 Provider</Text>
              <Text style={styles.value}>
                {displayData.company?.name || displayData.agency?.name}
                {displayData.company?.price && ` • ₹${displayData.company.price}`}
                {displayData.agency?.rating && ` • ⭐ ${displayData.agency.rating}`}
              </Text>
            </View>
          )}

          {/* Issues/Services */}
          {isMultipleBookings ? (
            <View style={styles.servicesSection}>
              <Text style={styles.sectionTitle}>📋 Services Booked:</Text>
              {bookings.slice(0, 3).map((booking: any, index: number) => (
                <View key={index} style={styles.serviceItem}>
                  <Text style={styles.serviceTitle}>{booking.serviceTitle}</Text>
                  <Text style={styles.serviceCompany}>{booking.company?.name || "Service Provider"}</Text>
                  <Text style={styles.servicePrice}>₹{booking.totalPrice}</Text>
                </View>
              ))}
              {bookings.length > 3 && (
                <Text style={styles.moreServices}>
                  +{bookings.length - 3} more service{bookings.length - 3 > 1 ? 's' : ''}
                </Text>
              )}
            </View>
          ) : (
            displayData.issues && displayData.issues.length > 0 && (
              <View style={styles.issuesSection}>
                <Text style={styles.sectionTitle}>🛠 Selected Issues:</Text>
                <ScrollView style={styles.issuesScroll} showsVerticalScrollIndicator={false}>
                  {displayData.issues.map((issue: string, i: number) => (
                    <Text key={i} style={styles.issueLine}>
                      • {issue}
                    </Text>
                  ))}
                </ScrollView>
              </View>
            )
          )}

          {/* Payment Info */}
          <View style={styles.paymentSection}>
            <View style={styles.detailRow}>
              <Text style={styles.label}>💰 Amount</Text>
              <Text style={styles.amount}>₹{displayData.amount}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.label}>💳 Payment</Text>
              <Text style={styles.value}>
                {displayData.paymentMethod === "online" ? "Paid Online" : "Cash on Service"}
              </Text>
            </View>

            <View style={styles.statusContainer}>
              <Text style={[
                styles.statusText, 
                { color: displayData.paymentStatus === "paid" ? "#10B981" : "#F59E0B" }
              ]}>
                Status: {displayData.paymentStatus === "paid" ? "Payment Completed" : "Booking Confirmed"}
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
                bookingId: displayData.bookingId,
                serviceTitle: displayData.serviceTitle,
                selectedDate: displayData.date,
                selectedTime: displayData.time,
                company: displayData.company,
                agency: displayData.agency,
                issues: displayData.issues,
                totalPrice: displayData.amount,
                bookingType: "electrician", // Can be made dynamic
                paymentMethod: displayData.paymentMethod,
                notes: "",
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
