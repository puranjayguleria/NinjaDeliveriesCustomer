import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

export default function BookingConfirmationScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  
  const {
    bookingId,
    serviceName,
    companyName,
    companyPhone,
    agencyName,
    selectedIssues = [],
    advancePaid = 0,
    totalPrice = 0,
    selectedDate,
    selectedTime,
    status = "Ongoing",
    paymentMethod = "cash",
    notes = "",
  } = route.params || {};

  const handleTrackBooking = () => {
    navigation.navigate("TrackBooking", {
      bookingId: bookingId,
    });
  };

  const handleCallAgency = () => {
    if (companyPhone) {
      Alert.alert(
        "Call Company",
        `Call ${companyName} at ${companyPhone}?`,
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Call", 
            onPress: () => {
              Linking.openURL(`tel:${companyPhone}`);
            }
          },
        ]
      );
    } else {
      Alert.alert(
        "Contact Information",
        "Company contact information is not available at the moment.",
        [{ text: "OK" }]
      );
    }
  };

  const handleGoToBookingHistory = () => {
    navigation.navigate("BookingHistory");
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Booking Confirmed 🎉</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Booking Details Card */}
        <View style={styles.bookingCard}>
          
          {/* Booking ID */}
          <View style={styles.detailRow}>
            <View style={styles.iconContainer}>
              <Ionicons name="document-text" size={20} color="#6B7280" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Booking ID:</Text>
              <Text style={styles.detailValue}>{bookingId || "-"}</Text>
            </View>
          </View>

          {/* Service Name */}
          <View style={styles.detailRow}>
            <View style={styles.iconContainer}>
              <Ionicons name="construct" size={20} color="#6B7280" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Service:</Text>
              <Text style={styles.detailValue}>{serviceName || "-"}</Text>
            </View>
          </View>

          {/* Service Date & Time */}
          <View style={styles.detailRow}>
            <View style={styles.iconContainer}>
              <Ionicons name="calendar" size={20} color="#6B7280" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Scheduled:</Text>
              <Text style={styles.detailValue}>
                {selectedDate || "-"} | {selectedTime || "-"}
              </Text>
            </View>
          </View>

          {/* Company */}
          <View style={styles.detailRow}>
            <View style={styles.iconContainer}>
              <Ionicons name="business" size={20} color="#6B7280" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Company:</Text>
              <Text style={styles.detailValue}>{companyName || "-"}</Text>
              {companyPhone && (
                <Text style={styles.phoneText}>📞 {companyPhone}</Text>
              )}
            </View>
          </View>

          {/* Agency */}
          <View style={styles.detailRow}>
            <View style={styles.iconContainer}>
              <Ionicons name="people" size={20} color="#6B7280" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Agency:</Text>
              <Text style={styles.detailValue}>{agencyName || "-"}</Text>
            </View>
          </View>

          {/* Selected Issues */}
          <View style={styles.detailRow}>
            <View style={styles.iconContainer}>
              <Ionicons name="list" size={20} color="#6B7280" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Selected Issues:</Text>
              <View style={styles.issuesContainer}>
                {selectedIssues.length > 0 ? (
                  selectedIssues.map((issue: string, index: number) => (
                    <Text key={index} style={styles.issueItem}>• {issue}</Text>
                  ))
                ) : (
                  <Text style={styles.detailValue}>-</Text>
                )}
              </View>
            </View>
          </View>

          {/* Total Amount */}
          <View style={styles.detailRow}>
            <View style={styles.iconContainer}>
              <Ionicons name="cash" size={20} color="#6B7280" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Total Amount:</Text>
              <Text style={styles.priceValue}>₹{totalPrice || 0}</Text>
            </View>
          </View>

          {/* Advance Paid */}
          <View style={styles.detailRow}>
            <View style={styles.iconContainer}>
              <Ionicons name="card" size={20} color="#6B7280" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Advance Paid:</Text>
              <Text style={styles.detailValue}>₹{advancePaid || 0}</Text>
            </View>
          </View>

          {/* Payment Method */}
          <View style={styles.detailRow}>
            <View style={styles.iconContainer}>
              <Ionicons name="wallet" size={20} color="#6B7280" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Payment Method:</Text>
              <Text style={styles.detailValue}>{paymentMethod === "cash" ? "Cash on Service" : "Online Payment"}</Text>
            </View>
          </View>

          {/* Notes */}
          {notes && (
            <View style={styles.detailRow}>
              <View style={styles.iconContainer}>
                <Ionicons name="chatbubble-ellipses" size={20} color="#6B7280" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Notes:</Text>
                <Text style={styles.detailValue}>{notes}</Text>
              </View>
            </View>
          )}

          {/* Status */}
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Status:</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>{status}</Text>
            </View>
          </View>

        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          
          {/* Call Agency & Track Booking Row */}
          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={styles.callButton}
              onPress={handleCallAgency}
            >
              <Ionicons name="call" size={18} color="#fff" />
              <Text style={styles.callButtonText}>Call Agency</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.trackButton}
              onPress={handleTrackBooking}
            >
              <Ionicons name="location" size={18} color="#fff" />
              <Text style={styles.trackButtonText}>Track Booking</Text>
            </TouchableOpacity>
          </View>

          {/* Go to Booking History */}
          <TouchableOpacity 
            style={styles.historyButton}
            onPress={handleGoToBookingHistory}
          >
            <Ionicons name="time" size={18} color="#fff" />
            <Text style={styles.historyButtonText}>Go to Booking History</Text>
          </TouchableOpacity>

        </View>

        {/* Bottom spacing */}
        <View style={{ height: 30 }} />

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
  },
  content: {
    flex: 1,
    padding: 20,
  },
  bookingCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 15,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 4,
    fontWeight: "500",
  },
  detailValue: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "600",
  },
  phoneText: {
    fontSize: 14,
    color: "#10B981",
    marginTop: 4,
    fontWeight: "500",
  },
  priceValue: {
    fontSize: 18,
    color: "#10B981",
    fontWeight: "700",
  },
  issuesContainer: {
    marginTop: 4,
  },
  issueItem: {
    fontSize: 14,
    color: "#374151",
    marginBottom: 2,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  statusLabel: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "600",
  },
  statusBadge: {
    backgroundColor: "#10B981",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  actionButtons: {
    gap: 15,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 15,
  },
  callButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#1F2937",
    paddingVertical: 16,
    borderRadius: 12,
  },
  callButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  trackButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#8B5CF6",
    paddingVertical: 16,
    borderRadius: 12,
  },
  trackButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  historyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#10B981",
    paddingVertical: 16,
    borderRadius: 12,
  },
  historyButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});