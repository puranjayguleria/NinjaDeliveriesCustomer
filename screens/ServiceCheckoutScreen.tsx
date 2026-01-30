import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ScrollView,
  Alert,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useServiceCart, ServiceCartItem } from "../context/ServiceCartContext";
import { FirestoreService } from "../services/firestoreService";

export default function ServiceCheckoutScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { clearCart } = useServiceCart();
  
  const { services, totalAmount } = route.params;
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [loading, setLoading] = useState(false);

  const handleProceedToPayment = async () => {
    Alert.alert(
      "Confirm Booking",
      `You are about to book ${services.length} service${services.length > 1 ? 's' : ''} for ₹${totalAmount}. Continue?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            setLoading(true);
            try {
              // Create bookings in Firebase service_bookings collection
              const bookingPromises = services.map(async (service: ServiceCartItem) => {
                const bookingData = {
                  serviceName: service.serviceTitle,
                  workName: service.issues?.join(', ') || service.serviceTitle,
                  customerName: "Customer", // You might want to get this from user context
                  customerPhone: "", // You might want to get this from user context
                  customerAddress: "", // You might want to get this from user context
                  date: service.selectedDate,
                  time: service.selectedTime,
                  status: 'pending' as const,
                  companyId: service.company.id,
                  totalPrice: service.totalPrice,
                  addOns: service.addOns || [],
                };

                const bookingId = await FirestoreService.createServiceBooking(bookingData);
                console.log(`✅ Created booking ${bookingId} for ${service.serviceTitle}`);
                
                return {
                  ...service,
                  bookingId,
                  notes,
                  paymentMethod,
                };
              });

              const bookings = await Promise.all(bookingPromises);
              
              // Clear cart after successful booking creation
              clearCart();

              // Navigate to booking confirmation screen with the first booking details
              const firstBooking = bookings[0];
              navigation.navigate("BookingConfirmation", {
                bookingId: firstBooking.bookingId,
                serviceName: firstBooking.serviceTitle,
                companyName: firstBooking.company?.name || "Service Provider",
                companyPhone: firstBooking.company?.phone || firstBooking.company?.contactInfo?.phone || "",
                agencyName: firstBooking.company?.name || "Service Agency",
                selectedIssues: firstBooking.issues || [],
                advancePaid: 0,
                totalPrice: totalAmount,
                selectedDate: firstBooking.selectedDate,
                selectedTime: firstBooking.selectedTime,
                status: "Ongoing",
                paymentMethod: paymentMethod,
                notes: notes,
              });

            } catch (error) {
              console.error('❌ Error creating bookings:', error);
              Alert.alert(
                "Booking Failed",
                "Failed to create your bookings. Please try again.",
                [{ text: "OK" }]
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const renderServiceItem = ({ item }: { item: ServiceCartItem }) => (
    <View style={styles.serviceCard}>
      <View style={styles.serviceHeader}>
        <Text style={styles.serviceTitle}>{item.serviceTitle}</Text>
        <Text style={styles.servicePrice}>₹{item.totalPrice}</Text>
      </View>

      <View style={styles.serviceDetails}>
        <Text style={styles.companyName}>{item.company.name}</Text>
        <View style={styles.ratingContainer}>
          <Ionicons name="star" size={14} color="#FFD700" />
          <Text style={styles.rating}>{item.company.rating}</Text>
          <Text style={styles.experience}>• {item.company.experience}</Text>
          {item.company.verified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.bookingInfo}>
        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={16} color="#666" />
          <Text style={styles.infoText}>{item.selectedDate}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={16} color="#666" />
          <Text style={styles.infoText}>{item.selectedTime}</Text>
        </View>
      </View>

      <View style={styles.issuesContainer}>
        <Text style={styles.issuesTitle}>Issues:</Text>
        <View style={styles.issuesList}>
          {(item.issues || []).map((issue, index) => (
            <View key={index} style={styles.issueTag}>
              <Text style={styles.issueText}>{issue}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Service Checkout</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Services ({services.length})</Text>
        
        <FlatList
          data={services}
          renderItem={renderServiceItem}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          contentContainerStyle={styles.servicesList}
        />

        <View style={styles.notesSection}>
          <Text style={styles.sectionTitle}>Additional Notes (Optional)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Any special instructions or requirements..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.paymentSection}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          
          <TouchableOpacity
            style={[
              styles.paymentOption,
              paymentMethod === "cash" && styles.paymentOptionSelected,
            ]}
            onPress={() => setPaymentMethod("cash")}
          >
            <View style={styles.paymentOptionContent}>
              <Ionicons name="cash-outline" size={24} color="#333" />
              <Text style={styles.paymentOptionText}>Cash on Service</Text>
            </View>
            {paymentMethod === "cash" && (
              <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.paymentOption,
              paymentMethod === "online" && styles.paymentOptionSelected,
            ]}
            onPress={() => setPaymentMethod("online")}
          >
            <View style={styles.paymentOptionContent}>
              <Ionicons name="card-outline" size={24} color="#333" />
              <Text style={styles.paymentOptionText}>Pay Online</Text>
            </View>
            {paymentMethod === "online" && (
              <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>Booking Summary</Text>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Services ({services.length})</Text>
            <Text style={styles.summaryValue}>₹{totalAmount}</Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Service Charges</Text>
            <Text style={styles.summaryValue}>₹0</Text>
          </View>
          
          <View style={styles.summaryDivider} />
          
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>₹{totalAmount}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.totalContainer}>
          <Text style={styles.footerTotalLabel}>Total: ₹{totalAmount}</Text>
          <Text style={styles.footerServiceCount}>{services.length} service{services.length > 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity
          style={[styles.proceedButton, loading && styles.proceedButtonDisabled]}
          onPress={handleProceedToPayment}
          disabled={loading}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.proceedButtonText}>Creating Bookings...</Text>
            </View>
          ) : (
            <Text style={styles.proceedButtonText}>Proceed to Payment</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    paddingTop: 50,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginLeft: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 16,
    marginTop: 8,
  },
  servicesList: {
    marginBottom: 24,
  },
  serviceCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  serviceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  serviceTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    flex: 1,
  },
  servicePrice: {
    fontSize: 16,
    fontWeight: "600",
    color: "#4CAF50",
  },
  serviceDetails: {
    marginBottom: 12,
  },
  companyName: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  rating: {
    fontSize: 14,
    color: "#333",
    marginLeft: 4,
  },
  experience: {
    fontSize: 14,
    color: "#666",
    marginLeft: 4,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
  },
  verifiedText: {
    fontSize: 12,
    color: "#4CAF50",
    marginLeft: 2,
  },
  bookingInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  infoText: {
    fontSize: 14,
    color: "#666",
    marginLeft: 4,
  },
  issuesContainer: {
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    paddingTop: 12,
  },
  issuesTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
    marginBottom: 8,
  },
  issuesList: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  issueTag: {
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
    marginBottom: 4,
  },
  issueText: {
    fontSize: 12,
    color: "#666",
  },
  notesSection: {
    marginBottom: 24,
  },
  notesInput: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#333",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    minHeight: 80,
  },
  paymentSection: {
    marginBottom: 24,
  },
  paymentOption: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  paymentOptionSelected: {
    borderColor: "#4CAF50",
    backgroundColor: "#f8fff8",
  },
  paymentOptionContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  paymentOptionText: {
    fontSize: 16,
    color: "#333",
    marginLeft: 12,
  },
  summarySection: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 100,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: "#666",
  },
  summaryValue: {
    fontSize: 14,
    color: "#333",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "#e0e0e0",
    marginVertical: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  totalValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  totalContainer: {
    flex: 1,
  },
  footerTotalLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  footerServiceCount: {
    fontSize: 14,
    color: "#666",
  },
  proceedButton: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  proceedButtonDisabled: {
    backgroundColor: "#A5D6A7",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  proceedButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});