import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
  ActivityIndicator,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { FirestoreService, ServiceBooking } from "../services/firestoreService";
import firestore from "@react-native-firebase/firestore";

export default function BookingConfirmationScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  
  const { bookingId } = route.params || {};
  
  const [loading, setLoading] = useState(true);
  const [bookingData, setBookingData] = useState<ServiceBooking | null>(null);
  const [companyName, setCompanyName] = useState<string>("");
  const [companyPhone, setCompanyPhone] = useState<string>("");

  // Fetch booking data from Firebase
  useEffect(() => {
    const fetchBookingData = async () => {
      if (!bookingId) {
        console.error("No bookingId provided");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        console.log(`📱 Fetching booking data for ID: ${bookingId}`);
        
        const booking = await FirestoreService.getServiceBookingById(bookingId);
        
        if (booking) {
          setBookingData(booking);
          
          // Fetch company name if companyId exists
          if (booking.companyId) {
            try {
              const companyNameFetched = await FirestoreService.getActualCompanyName(booking.companyId);
              setCompanyName(companyNameFetched);
              
              // Try to get company phone from service_company collection
              const companyDoc = await firestore()
                .collection('service_company')
                .doc(booking.companyId)
                .get();
              
              if (companyDoc.exists) {
                const companyData = companyDoc.data();
                setCompanyPhone(companyData?.phone || companyData?.contactInfo?.phone || "");
              }
            } catch (error) {
              console.error("Error fetching company data:", error);
              setCompanyName(`Company ${booking.companyId}`);
            }
          }
        } else {
          Alert.alert("Error", "Booking not found");
        }
      } catch (error) {
        console.error("Error fetching booking:", error);
        Alert.alert("Error", "Failed to load booking details");
      } finally {
        setLoading(false);
      }
    };

    fetchBookingData();
  }, [bookingId]);

  // Fallback data from route params (for backward compatibility)
  const fallbackData = route.params || {};
  
  const displayData = bookingData ? {
    bookingId: bookingData.id || fallbackData.bookingId || bookingId,
    serviceName: bookingData.serviceName || fallbackData.serviceName,
    selectedIssues: bookingData.workName ? [bookingData.workName] : (fallbackData.selectedIssues || []),
    totalPrice: bookingData.totalPrice || fallbackData.totalPrice || 0,
    advancePaid: fallbackData.advancePaid || 0,
    selectedDate: bookingData.date || fallbackData.selectedDate,
    selectedTime: bookingData.time || fallbackData.selectedTime,
    status: bookingData.status || fallbackData.status || "pending",
    paymentMethod: fallbackData.paymentMethod || "cash",
    notes: fallbackData.notes || "",
  } : {
    bookingId: fallbackData.bookingId || bookingId,
    serviceName: fallbackData.serviceName || "",
    selectedIssues: fallbackData.selectedIssues || [],
    totalPrice: fallbackData.totalPrice || 0,
    advancePaid: fallbackData.advancePaid || 0,
    selectedDate: fallbackData.selectedDate || "",
    selectedTime: fallbackData.selectedTime || "",
    status: fallbackData.status || "pending",
    paymentMethod: fallbackData.paymentMethod || "cash",
    notes: fallbackData.notes || "",
  };

  const handleTrackBooking = () => {
    navigation.navigate("TrackBooking", {
      bookingId: bookingId,
    });
  };

  const handleCallAgency = () => {
    if (companyPhone) {
      Alert.alert(
        "Call Company",
        `Call ${companyName || "Service Provider"} at ${companyPhone}?`,
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading booking details...</Text>
      </View>
    );
  }

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
              <Text style={styles.detailValue}>{displayData.bookingId || "-"}</Text>
            </View>
          </View>

          {/* Service Name */}
          <View style={styles.detailRow}>
            <View style={styles.iconContainer}>
              <Ionicons name="construct" size={20} color="#6B7280" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Service:</Text>
              <Text style={styles.detailValue}>{displayData.serviceName || "-"}</Text>
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
                {displayData.selectedDate || "-"} | {displayData.selectedTime || "-"}
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

          {/* Status */}
          <View style={styles.detailRow}>
            <View style={styles.iconContainer}>
              <Ionicons name="information-circle" size={20} color="#6B7280" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Status:</Text>
              <Text style={[styles.detailValue, styles.statusText]}>{displayData.status}</Text>
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
                {displayData.selectedIssues.length > 0 ? (
                  displayData.selectedIssues.map((issue: string, index: number) => (
                    <Text key={index} style={styles.issueItem}>• {issue}</Text>
                  ))
                ) : (
                  <Text style={styles.issueItem}>• {displayData.serviceName || "Service"}</Text>
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
              <Text style={styles.priceValue}>₹{displayData.totalPrice || 0}</Text>
            </View>
          </View>

          {/* Advance Paid */}
          <View style={styles.detailRow}>
            <View style={styles.iconContainer}>
              <Ionicons name="card" size={20} color="#6B7280" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Advance Paid:</Text>
              <Text style={styles.detailValue}>₹{displayData.advancePaid || 0}</Text>
            </View>
          </View>

          {/* Payment Method */}
          <View style={styles.detailRow}>
            <View style={styles.iconContainer}>
              <Ionicons name="wallet" size={20} color="#6B7280" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Payment Method:</Text>
              <Text style={styles.detailValue}>{displayData.paymentMethod === "cash" ? "Cash on Service" : "Online Payment"}</Text>
            </View>
          </View>

          {/* Notes */}
          {displayData.notes && (
            <View style={styles.detailRow}>
              <View style={styles.iconContainer}>
                <Ionicons name="chatbubble-ellipses" size={20} color="#6B7280" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Notes:</Text>
                <Text style={styles.detailValue}>{displayData.notes}</Text>
              </View>
            </View>
          )}

          {/* Status */}
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Status:</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>{displayData.status}</Text>
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
  statusBadgeText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  statusText: {
    textTransform: "capitalize",
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6B7280",
  },
  statusText: {
    textTransform: "capitalize",
    fontWeight: "500",
  },
});