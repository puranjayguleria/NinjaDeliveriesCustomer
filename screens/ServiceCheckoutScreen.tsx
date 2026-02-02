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
import { useLocationContext } from "../context/LocationContext";
import { FirestoreService } from "../services/firestoreService";
import { formatDateToDDMMYYYY } from "../utils/dateUtils";

export default function ServiceCheckoutScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { clearCart } = useServiceCart();
  const { location } = useLocationContext();
  
  const { services, totalAmount } = route.params;
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [loading, setLoading] = useState(false);

  const handleProceedToPayment = async () => {
    // Validate that user has selected an address
    if (!location.address || location.address.trim() === "") {
      Alert.alert(
        "Address Required",
        "Please select a service address before proceeding with the booking.",
        [
          {
            text: "Select Address",
            onPress: () => navigation.navigate("LocationSelector")
          },
          {
            text: "Cancel",
            style: "cancel"
          }
        ]
      );
      return;
    }

    if (paymentMethod === "online") {
      // For online payment, directly open Razorpay payment
      await handleRazorpayPayment();
    } else {
      // For cash payment, create bookings directly
      Alert.alert(
        "Confirm Booking",
        `You are about to book ${services.length} service${services.length > 1 ? 's' : ''} for ₹${totalAmount}. Continue?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Confirm",
            onPress: async () => {
              await createBookings();
            },
          },
        ]
      );
    }
  };

  const handleRazorpayPayment = async () => {
    setLoading(true);
    try {
      // Import auth and axios here to avoid issues
      const auth = require("@react-native-firebase/auth").default;
      const axios = require("axios").default;

      // API Configuration for Razorpay
      const api = axios.create({
        timeout: 20000,
        headers: { "Content-Type": "application/json" },
      });

      const CLOUD_FUNCTIONS_BASE_URL = "https://asia-south1-ninjadeliveries-91007.cloudfunctions.net";
      const CREATE_RZP_ORDER_URL = `${CLOUD_FUNCTIONS_BASE_URL}/createRazorpayOrder`;

      const getAuthHeaders = async () => {
        const user = auth().currentUser;
        if (!user) throw new Error("Not logged in");
        const token = await user.getIdToken(true);
        return { Authorization: `Bearer ${token}` };
      };

      const toPaise = (amountRupees: number) => Math.round(Number(amountRupees) * 100);

      // Create Razorpay order
      console.log("Creating Razorpay order for services - Amount:", totalAmount);
      const user = auth().currentUser;
      if (!user) throw new Error("Not logged in");

      const amountPaise = toPaise(totalAmount);
      const headers = await getAuthHeaders();

      const requestData = {
        amountPaise,
        currency: "INR",
        receipt: `service_${user.uid}_${Date.now()}`,
        notes: { uid: user.uid, type: "service_booking" },
      };

      const { data } = await api.post(CREATE_RZP_ORDER_URL, requestData, { headers });

      if (!data?.orderId || !data?.keyId) {
        throw new Error(data?.error || "Failed to create Razorpay order");
      }

      const contact = (user.phoneNumber || "").replace("+91", "");

      // Navigate directly to Razorpay WebView
      navigation.navigate("RazorpayWebView", {
        orderId: String(data.orderId),
        amount: totalAmount,
        keyId: String(data.keyId),
        currency: String(data.currency ?? "INR"),
        name: "Ninja Services",
        description: "Service booking payment",
        prefill: {
          contact,
          email: "",
          name: "",
        },
        onSuccess: async (response: any) => {
          try {
            console.log("Payment successful:", response);
            
            // Verify payment on server
            const VERIFY_RZP_PAYMENT_URL = `${CLOUD_FUNCTIONS_BASE_URL}/verifyRazorpayPayment`;
            const verifyHeaders = await getAuthHeaders();
            const { data: verifyData } = await api.post(VERIFY_RZP_PAYMENT_URL, response, { headers: verifyHeaders });

            if (!verifyData?.verified) {
              throw new Error(verifyData?.error || "Payment verification failed");
            }
            
            console.log("Payment verified, creating bookings with payment details...");
            
            // Create bookings with paid status and Razorpay response
            await createBookings("paid", response);
            
          } catch (error) {
            console.error("Payment verification failed:", error);
            Alert.alert("Payment Verification Failed", "Please contact support.");
          }
        },
        onFailure: (error: any) => {
          console.log("Payment failed:", error);
          Alert.alert("Payment Failed", error?.description || "Payment was not completed.");
        },
      });

    } catch (error: any) {
      console.error("Razorpay payment error:", error);
      let message = "Payment failed. Please try again.";
      
      if (error?.description) {
        message = error.description;
      } else if (error?.message) {
        message = error.message;
      }
      
      Alert.alert("Payment Failed", message, [
        { text: "OK" },
        {
          text: "Use Cash Payment",
          onPress: () => {
            setPaymentMethod("cash");
          }
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const createBookings = async (paymentStatus: string = "pending", razorpayResponse?: any) => {
    setLoading(true);
    try {
      console.log(`🔍 Starting booking creation process...`);
      console.log(`📍 Current location data:`, JSON.stringify(location, null, 2));
      console.log(`💳 Payment status: ${paymentStatus}, method: ${paymentMethod}`);
      
      // Get actual customer information from Firebase
      let customerData = {
        name: "Customer",
        phone: "",
        address: location.address || "" // Use address from LocationContext
      };

      try {
        const currentUser = await FirestoreService.getCurrentUser();
        if (currentUser) {
          customerData = {
            name: currentUser.name || currentUser.displayName || `Customer ${currentUser.phone?.slice(-4) || ''}`,
            phone: currentUser.phone || currentUser.phoneNumber || "",
            address: location.address || currentUser.address || currentUser.location || currentUser.fullAddress || ""
          };
      console.log(`📱 Retrieved customer data: ${customerData.name}, ${customerData.phone}`);
      console.log(`📍 Using service address: ${customerData.address}`);
      console.log(`🛒 Services to book: ${services.length}`);
      
      // Validate services array
      if (!services || services.length === 0) {
        throw new Error('No services to book');
      }
      
      // Log each service for debugging
      services.forEach((service, index) => {
        console.log(`🔧 Service ${index + 1}:`, {
          title: service.serviceTitle,
          issues: service.issues,
          company: service.company?.name || service.company?.id,
          date: service.selectedDate,
          time: service.selectedTime,
          price: service.totalPrice
        });
      });
        }
      } catch (userError) {
        console.error("Error fetching user data:", userError);
        // Continue with location address from context
        customerData.address = location.address || "";
      }

      // Create bookings in Firebase service_bookings collection
      const bookingPromises = services.map(async (service: ServiceCartItem) => {
        // Ensure all required fields have valid values
        const bookingData = {
          serviceName: service.serviceTitle || "Service",
          workName: (service.issues && service.issues.length > 0) ? service.issues.join(', ') : (service.serviceTitle || "Service"),
          customerName: customerData.name || "Customer",
          customerPhone: customerData.phone || "",
          customerAddress: customerData.address || "",
          date: service.selectedDate || new Date().toISOString().split('T')[0],
          time: service.selectedTime || "10:00 AM",
          status: 'pending' as const,
          companyId: service.company?.companyId || service.company?.id || "",
          totalPrice: service.totalPrice || 0,
          addOns: service.addOns || [],
          // Add location data for website access (with strict validation)
          location: {
            lat: (location.lat !== null && location.lat !== undefined) ? location.lat : null,
            lng: (location.lng !== null && location.lng !== undefined) ? location.lng : null,
            address: location.address || customerData.address || "",
            ...(location.houseNo && location.houseNo.trim() !== "" && { houseNo: location.houseNo }),
            ...(location.placeLabel && location.placeLabel.trim() !== "" && { placeLabel: location.placeLabel }),
          },
          paymentMethod: paymentMethod || "cash",
          paymentStatus: paymentStatus || "pending",
          notes: notes || "",
        };

        console.log(`📋 About to create booking with data:`, JSON.stringify(bookingData, null, 2));

        const bookingId = await FirestoreService.createServiceBooking(bookingData);
        console.log(`✅ Created booking ${bookingId} for ${service.serviceTitle}`);
        console.log(`📍 Location data saved: lat=${location.lat}, lng=${location.lng}, address="${location.address}"`);
        
        // Create payment record in service_payments collection
        // Ensure all required fields have valid values
        if (!bookingId) {
          throw new Error('Failed to create booking - no booking ID returned');
        }
        
        const paymentData = {
          bookingId,
          amount: service.totalPrice || 0,
          paymentMethod: paymentMethod as 'cash' | 'online',
          paymentStatus: paymentStatus as 'pending' | 'paid',
          serviceName: service.serviceTitle || 'Service',
          companyName: service.company?.name || 'Service Provider',
          companyId: service.company?.companyId || service.company?.id || '',
          paymentGateway: paymentMethod === 'online' ? 'razorpay' as const : 'cash' as const,
          // Add Razorpay details if payment was successful
          ...(razorpayResponse && paymentStatus === 'paid' && {
            transactionId: razorpayResponse.razorpay_payment_id || '',
            razorpayOrderId: razorpayResponse.razorpay_order_id || '',
            razorpaySignature: razorpayResponse.razorpay_signature || '',
          }),
        };

        console.log('Creating payment record with data:', paymentData);
        const paymentId = await FirestoreService.createServicePayment(paymentData);
        console.log(`✅ Created payment record ${paymentId} for booking ${bookingId}`);
        
        return {
          ...service,
          bookingId,
          paymentId,
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
        paymentMethod,
        paymentStatus,
        totalAmount,
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
          <Text style={styles.rating}>{item.company.rating}</Text>
          <Text style={styles.experience}>{item.company.experience}</Text>
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
          <Text style={styles.infoText}>{formatDateToDDMMYYYY(item.selectedDate)}</Text>
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

        {/* Service Address Section */}
        <View style={styles.addressSection}>
          <Text style={styles.sectionTitle}>Service Address</Text>
          <View style={[
            styles.addressCard, 
            (!location.address || location.address.trim() === "") && styles.addressCardEmpty
          ]}>
            <View style={styles.addressHeader}>
              <Ionicons 
                name="location" 
                size={20} 
                color={(!location.address || location.address.trim() === "") ? "#ef4444" : "#4CAF50"} 
              />
              <Text style={styles.addressTitle}>
                {(!location.address || location.address.trim() === "") ? "No Address Selected" : "Selected Location"}
              </Text>
            </View>
            
            {(!location.address || location.address.trim() === "") ? (
              <View style={styles.noAddressContainer}>
                <Text style={styles.noAddressText}>
                  Please select your service location to continue
                </Text>
                <TouchableOpacity 
                  style={styles.selectAddressButton}
                  onPress={() => navigation.navigate("LocationSelector")}
                >
                  <Ionicons name="add-circle" size={16} color="#fff" />
                  <Text style={styles.selectAddressText}>Select Address</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.addressText}>
                  {location.address}
                </Text>
                {location.houseNo && (
                  <Text style={styles.houseNoText}>
                    House/Flat: {location.houseNo}
                  </Text>
                )}
                {location.placeLabel && (
                  <Text style={styles.placeLabelText}>
                    {location.placeLabel}
                  </Text>
                )}
                <TouchableOpacity 
                  style={styles.changeAddressButton}
                  onPress={() => navigation.navigate("LocationSelector")}
                >
                  <Ionicons name="pencil" size={16} color="#2563eb" />
                  <Text style={styles.changeAddressText}>Change Address</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

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
              <View style={styles.paymentOptionTextContainer}>
                <Text style={styles.paymentOptionText}>Cash on Service</Text>
                <Text style={styles.paymentOptionSubtext}>Pay when service is completed</Text>
              </View>
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
              <View style={styles.paymentOptionTextContainer}>
                <Text style={styles.paymentOptionText}>Pay Online</Text>
                <Text style={styles.paymentOptionSubtext}>UPI, Cards, Net Banking via Razorpay</Text>
              </View>
            </View>
            {paymentMethod === "online" && (
              <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            )}
          </TouchableOpacity>

          {paymentMethod === "online" && (
            <View style={styles.paymentNote}>
              <Ionicons name="information-circle-outline" size={16} color="#2563eb" />
              <Text style={styles.paymentNoteText}>
                Secure payment via Razorpay. Supports UPI (Google Pay, PhonePe, Paytm), Credit/Debit Cards, and Net Banking.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>Booking Summary</Text>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Services ({services.length})</Text>
            <Text style={styles.summaryValue}>₹{totalAmount}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Service Address</Text>
            <Text style={[styles.summaryValue, styles.summaryAddressValue]}>
              {location.address ? 
                (location.address.length > 30 ? 
                  `${location.address.substring(0, 30)}...` : 
                  location.address
                ) : 
                "Not selected"
              }
            </Text>
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
            <Text style={styles.proceedButtonText}>
              {paymentMethod === "online" 
                ? `Pay ₹${totalAmount} Online` 
                : "Confirm Booking"
              }
            </Text>
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
  addressSection: {
    marginBottom: 24,
  },
  addressCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  addressCardEmpty: {
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
  },
  addressHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  addressTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginLeft: 8,
  },
  noAddressContainer: {
    alignItems: "center",
    paddingVertical: 8,
  },
  noAddressText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 12,
  },
  selectAddressButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4CAF50",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  selectAddressText: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "600",
    marginLeft: 4,
  },
  addressText: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
    marginBottom: 8,
  },
  houseNoText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  placeLabelText: {
    fontSize: 14,
    color: "#666",
    fontStyle: "italic",
    marginBottom: 12,
  },
  changeAddressButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#f0f9ff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0f2fe",
  },
  changeAddressText: {
    fontSize: 14,
    color: "#2563eb",
    fontWeight: "500",
    marginLeft: 4,
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
    flex: 1,
  },
  paymentOptionTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  paymentOptionText: {
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
  paymentOptionSubtext: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  paymentNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#f0f9ff",
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#e0f2fe",
  },
  paymentNoteText: {
    fontSize: 12,
    color: "#2563eb",
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
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
  summaryAddressValue: {
    fontSize: 12,
    color: "#666",
    textAlign: "right",
    flex: 1,
    marginLeft: 8,
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