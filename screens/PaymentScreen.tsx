import React, { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView, Alert, ActivityIndicator } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import auth from "@react-native-firebase/auth";
import axios from "axios";

// Real Razorpay WebView Integration - No native module needed
console.log("🚀 Payment system initialized - WebView Razorpay Integration");

// API Configuration for Razorpay
const api = axios.create({
  timeout: 20000,
  headers: { "Content-Type": "application/json" },
});

const CLOUD_FUNCTIONS_BASE_URL = "https://asia-south1-ninjadeliveries-91007.cloudfunctions.net";
const CREATE_RZP_ORDER_URL = `${CLOUD_FUNCTIONS_BASE_URL}/createRazorpayOrder`;
const VERIFY_RZP_PAYMENT_URL = `${CLOUD_FUNCTIONS_BASE_URL}/verifyRazorpayPayment`;

const getAuthHeaders = async () => {
  const user = auth().currentUser;
  if (!user) throw new Error("Not logged in");
  const token = await user.getIdToken(true);
  return { Authorization: `Bearer ${token}` };
};

const toPaise = (amountRupees: number) => Math.round(Number(amountRupees) * 100);

export default function PaymentScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(false);
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slowTextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showSlowText, setShowSlowText] = useState(false);

  useEffect(() => {
    return () => {
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }

      if (slowTextTimerRef.current) {
        clearTimeout(slowTextTimerRef.current);
        slowTextTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (slowTextTimerRef.current) {
      clearTimeout(slowTextTimerRef.current);
      slowTextTimerRef.current = null;
    }

    if (!loading) {
      if (showSlowText) setShowSlowText(false);
      return;
    }

    setShowSlowText(false);
    slowTextTimerRef.current = setTimeout(() => {
      setShowSlowText(true);
    }, 5000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Handle both old single booking format and new multiple bookings format
  const {
    bookings, // New format from ServiceCheckoutScreen
    totalAmount, // New format
    paymentMethod, // New format
    // Old format (for backward compatibility)
    bookingId,
    amount,
    serviceTitle,
    issues,
    company,
    date,
    time,
    // Add-on services format
    addOnServices,
    addOnTotal,
    originalAmount,
    isAddOnPayment,
    serviceName,
    companyName,
  } = route.params || {};

  console.log("PaymentScreen received:", { 
    bookings, 
    totalAmount, 
    paymentMethod, 
    bookingId, 
    amount, 
    addOnServices, 
    addOnTotal,
    originalAmount,
    isAddOnPayment,
    serviceName,
    companyName
  });

  // Determine if this is new format (multiple bookings) or old format (single booking) or add-on payment
  const isMultipleBookings = bookings && Array.isArray(bookings);
  const isAddOn = isAddOnPayment && addOnServices && Array.isArray(addOnServices);
  const finalAmount = isAddOn ? totalAmount : (isMultipleBookings ? totalAmount : amount);
  const selectedPaymentMethod: "online" = "online";

  console.log("PaymentScreen processed:", { 
    isMultipleBookings, 
    isAddOn,
    finalAmount, 
    selectedPaymentMethod,
    razorpayAvailable: true, // WebView always available
    razorpayOpenAvailable: true // WebView always available
  });

  // Format issues for display (old format)
  const displayIssues = Array.isArray(issues) && issues.length > 0 
    ? issues.join(", ") 
    : "No issues selected";

  const createRazorpayOrderOnServer = async (amountRupees: number) => {
    console.log("Creating Razorpay order for services - Amount:", amountRupees);
    const user = auth().currentUser;
    if (!user) throw new Error("Not logged in");

    const amountPaise = toPaise(amountRupees);
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

    return {
      orderId: String(data.orderId),
      keyId: String(data.keyId),
      amountPaise: Number(data.amountPaise ?? amountPaise),
      currency: String(data.currency ?? "INR"),
    };
  };

  const verifyRazorpayPaymentOnServer = async (meta: any) => {
    const headers = await getAuthHeaders();
    const { data } = await api.post(VERIFY_RZP_PAYMENT_URL, meta, { headers });

    if (!data?.verified) {
      throw new Error(data?.error || "Payment verification failed");
    }
    return true;
  };

  const openRazorpayWebView = async (
    keyId: string,
    orderId: string,
    amountPaise: number,
    currency: string
  ) => {
    console.log("Opening Razorpay WebView for payment");
    
    const user = auth().currentUser;
    if (!user) throw new Error("Not logged in");

    const contact = (user.phoneNumber || "").replace("+91", "");

    // Navigate to WebView payment
    navigation.navigate("RazorpayWebView", {
      orderId,
      amount: amountPaise / 100, // Convert back to rupees for display
      keyId,
      currency: currency || "INR",
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
          await verifyRazorpayPaymentOnServer(response);
          
          console.log("Payment verified, navigating to booking details...");
          navigateToBookingDetails("paid");
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
  };

  // Real Razorpay WebView availability check
  const isRazorpayReallyAvailable = () => {
    // WebView approach is always available since react-native-webview is installed
    console.log("Razorpay WebView check: Always available");
    return true;
  };

  const handlePayment = async () => {
    console.log("handlePayment called with method:", selectedPaymentMethod);
    setLoading(true);

    // Avoid a stuck overlay in odd edge cases (e.g., navigation interrupted).
    // If the flow is still alive after 60s, user can try again.
    if (loadingTimerRef.current) {
      clearTimeout(loadingTimerRef.current);
    }
    loadingTimerRef.current = setTimeout(() => {
      setLoading(false);
    }, 60000);

    try {
      console.log("Processing online payment for services...");

      const razorpayWorking = isRazorpayReallyAvailable();
      console.log("WebView Razorpay check result:", razorpayWorking);

      if (!razorpayWorking) {
        setLoading(false);
        Alert.alert(
          "⚠️ Payment Gateway Unavailable",
          "Online payment is temporarily unavailable. Please try again.",
          [{ text: "OK" }]
        );
        return;
      }

      console.log("Razorpay WebView is working, proceeding with real payment...");
      try {
        console.log("Creating Razorpay order...");
        const serverOrder = await createRazorpayOrderOnServer(finalAmount);

        console.log("Opening Razorpay WebView...");
        await openRazorpayWebView(
          serverOrder.keyId,
          serverOrder.orderId,
          serverOrder.amountPaise,
          serverOrder.currency
        );

        // The next screen (WebView) handles success/failure callbacks.
        // Keep loader on briefly to cover navigation lag, then let it go.
        setTimeout(() => setLoading(false), 800);
      } catch (razorpayError: any) {
        console.error("Razorpay WebView error:", razorpayError);
        setLoading(false);
        Alert.alert(
          "Payment Gateway Error",
          "The payment gateway encountered an error. Please try again.",
          [{ text: "OK" }]
        );
        return;
      }
    } catch (error: any) {
      console.error("Payment error:", error);
      let message = "Payment failed. Please try again.";

      setLoading(false);
      
      if (error?.description) {
        message = error.description;
      } else if (error?.message) {
        message = error.message;
      }
      
      Alert.alert("Payment Failed", message, [{ text: "OK" }]);
    } finally {
      setLoading(false);
    }
  };

  const navigateToBookingDetails = (paymentStatus: string) => {
    // Navigate to booking details
    if (isAddOn) {
      // For add-on payments, go back to booking confirmation with updated info
      navigation.navigate("BookingConfirmation", {
        bookingId,
        addOnPaymentComplete: true,
        paymentStatus,
        addOnServices,
        addOnTotal,
        totalAmount: finalAmount
      });
    } else if (isMultipleBookings) {
      // For multiple bookings from service cart, call the success callback
      const { onPaymentSuccess } = route.params;
      if (onPaymentSuccess && paymentStatus === "paid") {
        onPaymentSuccess();
      } else {
        // Fallback navigation
        navigation.navigate("BookingDetails", {
          bookings,
          totalAmount,
          paymentMethod: selectedPaymentMethod,
          paymentStatus,
        });
      }
    } else {
      // For single booking (old format)
      navigation.navigate("BookingDetails", {
        bookingId,
        serviceTitle,
        issues,
        company,
        amount: finalAmount,
        date,
        time,
        paymentMethod: selectedPaymentMethod,
        paymentStatus,
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
          Payment
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.contentArea}>
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
              <Text style={styles.bannerTitle}>
                {isAddOn ? "Secure Add-On Payment" : "Secure Your Service"}
              </Text>
              <Text style={styles.bannerSub}>
                {isAddOn
                  ? "Pay securely for additional services"
                  : "Pay securely to confirm your booking"}
              </Text>
            </View>
          </View>

          {/* Booking Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>
              {isAddOn ? "Add-On Services" : "Booking Summary"}
            </Text>

            {isAddOn ? (
              // Add-on services display
              <>
                <View style={styles.summaryRow}>
                  <Text style={styles.label}>Original Booking</Text>
                  <Text style={styles.value}>{serviceName || "Service"}</Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.label}>Service Provider</Text>
                  <Text style={styles.value}>{companyName || "Service Provider"}</Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.label}>Additional Services</Text>
                  <Text style={styles.value}>
                    {addOnServices?.length || 0} service{(addOnServices?.length || 0) > 1 ? "s" : ""}
                  </Text>
                </View>

                {addOnServices?.map((service: any, index: number) => (
                  <View key={index} style={styles.serviceItem}>
                    <Text style={styles.serviceTitle}>+ {service.name}</Text>
                    <Text style={styles.servicePrice}>₹{service.price}</Text>
                  </View>
                ))}

                <View style={styles.summaryDivider} />

                <View style={styles.summaryRow}>
                  <Text style={styles.label}>Original Amount</Text>
                  <Text style={styles.value}>₹{originalAmount || 0}</Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.label}>Add-On Total</Text>
                  <Text style={styles.value}>₹{addOnTotal || 0}</Text>
                </View>
              </>
            ) : isMultipleBookings ? (
              // Multiple bookings display
              <>
                <View style={styles.summaryRow}>
                  <Text style={styles.label}>Services</Text>
                  <Text style={styles.value}>
                    {bookings.length} service{bookings.length > 1 ? "s" : ""}
                  </Text>
                </View>

                {bookings.slice(0, 3).map((booking: any, index: number) => (
                  <View key={index} style={styles.serviceItem}>
                    <Text style={styles.serviceTitle}>{booking.serviceTitle}</Text>
                    <Text style={styles.serviceCompany}>{booking.company.name}</Text>
                    <Text style={styles.servicePrice}>₹{booking.totalPrice}</Text>
                  </View>
                ))}

                {bookings.length > 3 && (
                  <Text style={styles.moreServices}>
                    +{bookings.length - 3} more service{bookings.length - 3 > 1 ? "s" : ""}
                  </Text>
                )}
              </>
            ) : (
              // Single booking display (old format)
              <>
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
                  <Text style={styles.value}>{company?.name || "Service Provider"}</Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.label}>Time Slot</Text>
                  <Text style={styles.value}>{time || "N/A"}</Text>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.label}>Date</Text>
                  <Text style={styles.value}>{date || "Today"}</Text>
                </View>
              </>
            )}
          </View>

          {/* Payment Details */}
          <View style={styles.paymentCard}>
            <Text style={styles.paymentTitle}>Payment Details</Text>

            {/* Debug Info */}
            <View style={styles.debugInfo}>
              <Text style={styles.debugText}>🔧 Debug Info:</Text>
              <Text style={styles.debugText}>Payment System: Real Razorpay WebView</Text>
              <Text style={styles.debugText}>WebView Status: Available</Text>
              <Text style={styles.debugText}>
                Payment Type: {isAddOn ? "Add-On Payment" : "Regular Payment"}
              </Text>
              <Text style={styles.debugText}>Payment Method: {selectedPaymentMethod}</Text>
              <Text style={styles.debugText}>Amount: ₹{finalAmount}</Text>
              <Text style={styles.successText}>✅ Real Razorpay WebView ready</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.label}>Payment Method</Text>
              <Text style={styles.value}>Pay Online</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.label}>Service Charge</Text>
              <Text style={styles.amount}>₹{finalAmount || 0}</Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.label}>Amount to Pay Now</Text>
              <Text style={styles.advanceAmount}>₹{finalAmount || 0}</Text>
            </View>

            <View style={styles.noteBox}>
              <Text style={styles.noteTitle}>💳 Online Payment</Text>
              <Text style={styles.noteText}>
                Pay securely using UPI (Google Pay, PhonePe, Paytm), Cards, or Net Banking via Razorpay. Your payment is protected.
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Fixed Bottom Section */}
        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={[styles.payBtn, loading && styles.disabledBtn]}
            activeOpacity={0.7}
            onPress={handlePayment}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.payBtnText}>
                {`Pay ₹${finalAmount || 0} & Confirm`}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Loading Overlay (does not block header) */}
        {loading && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4CAF50" />
              <Text style={styles.loadingText}>
                {showSlowText ? 'It is taking longer than expected please wait.' : 'Processing payment...'}
              </Text>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#fafbfc",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },

  backButton: {
    padding: 8,
  },

  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    textAlign: "center",
    marginRight: 40,
  },

  headerSpacer: {
    width: 40,
  },

  contentArea: {
    flex: 1,
    position: "relative",
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

  serviceItem: {
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },

  serviceTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 4,
  },

  serviceCompany: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 4,
  },

  servicePrice: {
    fontSize: 14,
    fontWeight: "600",
    color: "#059669",
  },

  moreServices: {
    fontSize: 12,
    color: "#64748b",
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 8,
  },

  summaryDivider: {
    height: 1,
    backgroundColor: "#e2e8f0",
    marginVertical: 12,
  },

  disabledBtn: {
    opacity: 0.6,
  },

  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },

  loadingContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#333",
  },

  debugInfo: {
    backgroundColor: "#f0f0f0",
    padding: 8,
    borderRadius: 4,
    marginBottom: 12,
  },

  debugText: {
    fontSize: 11,
    color: "#666",
    marginBottom: 2,
  },

  warningText: {
    fontSize: 11,
    color: "#e74c3c",
    fontWeight: "600",
    marginTop: 4,
  },

  mockText: {
    fontSize: 11,
    color: "#2563eb",
    fontWeight: "600",
    marginTop: 4,
  },

  successText: {
    fontSize: 11,
    color: "#059669",
    fontWeight: "600",
    marginTop: 4,
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