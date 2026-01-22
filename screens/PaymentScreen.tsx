import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";

export default function PaymentScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const {
    bookingId,
    amount,
    serviceTitle,
    issues,
    company,
    date,
    time,
  } = route.params || {};

  // Format issues for display
  const displayIssues = Array.isArray(issues) && issues.length > 0 
    ? issues.join(", ") 
    : "No issues selected";

  const onPay = () => {
    navigation.navigate("BookingDetails", {
      bookingId,
      serviceTitle,
      issues,
      company,
      amount,
      date,
      time,
    });
  };

  return (
    <View style={styles.container}>
      {/* Header Section */}
      <View style={styles.headerSection}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        
        <Text style={styles.header}>Payment</Text>
        <Text style={styles.subHeader}>Review and confirm your booking</Text>
      </View>

      {/* Scrollable Content */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Secure Booking Banner */}
        <View style={styles.bannerCard}>
          <Image
            source={require("../assets/images/icon_home_repair.png")}
            style={styles.bannerIcon}
          />

          <View style={styles.bannerContent}>
            <Text style={styles.bannerTitle}>Secure Your Slot</Text>
            <Text style={styles.bannerSub}>
              Pay advance amount to confirm your booking
            </Text>
          </View>
        </View>

        {/* Booking Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Booking Summary</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.label}>Service</Text>
            <Text style={styles.value}>{serviceTitle || "N/A"}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.label}>Issues</Text>
            <Text style={styles.valueMultiline}>{displayIssues}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.label}>Provider</Text>
            <Text style={styles.value}>
              {company?.name || "Service Provider"}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.label}>Time Slot</Text>
            <Text style={styles.value}>{time || "N/A"}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.label}>Date</Text>
            <Text style={styles.value}>{date || "Today"}</Text>
          </View>
        </View>

        {/* Payment Details */}
        <View style={styles.paymentCard}>
          <Text style={styles.paymentTitle}>Payment Details</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.label}>Booking ID</Text>
            <Text style={styles.value}>{bookingId || "N/A"}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.label}>Service Charge</Text>
            <Text style={styles.amount}>₹{company?.price || amount || 0}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.label}>Advance Amount</Text>
            <Text style={styles.advanceAmount}>₹{Math.min(99, company?.price || amount || 99)}</Text>
          </View>

          <View style={styles.noteBox}>
            <Text style={styles.noteTitle}>💡 Payment Note</Text>
            <Text style={styles.noteText}>
              Pay advance amount to secure your slot. Remaining payment will be collected after service completion.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Fixed Bottom Section */}
      <View style={styles.bottomSection}>
        <TouchableOpacity 
          style={styles.payBtn} 
          activeOpacity={0.7} 
          onPress={onPay}
        >
          <Text style={styles.payBtnText}>
            Pay ₹{Math.min(99, company?.price || amount || 99)} & Confirm
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.backBtn} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#fafbfc",
  },

  // Header Section
  headerSection: {
    backgroundColor: "white",
    paddingHorizontal: 24,
    paddingTop: 50,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },

  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },

  backButtonText: {
    color: "#2563eb",
    fontSize: 16,
    fontWeight: "500",
  },

  header: { 
    fontSize: 28, 
    fontWeight: "600",
    color: "#0f172a",
    letterSpacing: -0.6,
    marginBottom: 8,
  },

  subHeader: { 
    color: "#64748b", 
    fontSize: 16, 
    fontWeight: "400",
    lineHeight: 24,
  },

  // Scroll View
  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: 20,
  },

  // Banner Card
  bannerCard: {
    backgroundColor: "#f0f9ff",
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginHorizontal: 24,
    marginTop: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#e0f2fe",
  },

  bannerIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: "#fff",
  },

  bannerContent: {
    flex: 1,
  },

  bannerTitle: { 
    fontSize: 18, 
    fontWeight: "500", 
    color: "#0f172a",
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  
  bannerSub: { 
    fontSize: 14, 
    color: "#64748b",
    fontWeight: "400",
    lineHeight: 20,
  },

  // Summary Card
  summaryCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 24,
    marginBottom: 24,
    elevation: 0,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  
  summaryTitle: { 
    fontSize: 20, 
    fontWeight: "600", 
    marginBottom: 20,
    color: "#0f172a",
    letterSpacing: -0.3,
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    gap: 16,
  },

  label: { 
    fontSize: 14, 
    color: "#64748b", 
    fontWeight: "500", 
    width: "35%",
  },
  
  value: { 
    fontSize: 14, 
    color: "#0f172a", 
    fontWeight: "500", 
    flex: 1,
    textAlign: "right",
  },

  valueMultiline: {
    fontSize: 14,
    color: "#0f172a",
    fontWeight: "500",
    flex: 1,
    textAlign: "right",
    lineHeight: 20,
  },

  // Payment Card
  paymentCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 24,
    marginBottom: 24,
    elevation: 0,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  paymentTitle: { 
    fontSize: 20, 
    fontWeight: "600", 
    marginBottom: 20,
    color: "#0f172a",
    letterSpacing: -0.3,
  },

  amount: { 
    fontSize: 16, 
    color: "#0f172a", 
    fontWeight: "600",
    letterSpacing: -0.2,
  },

  advanceAmount: { 
    fontSize: 20, 
    color: "#059669", 
    fontWeight: "600",
    letterSpacing: -0.3,
  },

  noteBox: {
    marginTop: 20,
    backgroundColor: "#f8fafc",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  noteTitle: { 
    fontWeight: "500", 
    marginBottom: 8, 
    color: "#0f172a",
    fontSize: 14,
  },
  
  noteText: { 
    fontSize: 13, 
    color: "#64748b", 
    lineHeight: 20,
    fontWeight: "400",
  },

  // Fixed Bottom Section
  bottomSection: {
    backgroundColor: "white",
    paddingHorizontal: 24,
    paddingVertical: 20,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },

  payBtn: {
    backgroundColor: "#2563eb",
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 0,
    shadowColor: '#2563eb',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },

  payBtnText: {
    color: "white",
    fontWeight: "500",
    textAlign: "center",
    fontSize: 16,
    letterSpacing: -0.2,
  },

  backBtn: {
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "white",
  },

  backText: {
    textAlign: "center",
    fontWeight: "500",
    color: "#64748b",
    fontSize: 16,
  },
});