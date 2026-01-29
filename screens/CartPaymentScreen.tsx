import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import auth from "@react-native-firebase/auth";
import axios from "axios";

// WebView Razorpay Integration - No native module needed
console.log("🚀 Cart Payment system initialized - WebView Razorpay Integration");

// Types
type CartItem = {
  id: string;
  name: string;
  price: number;
  discount?: number;
  quantity: number;
  CGST?: number;
  SGST?: number;
  cess?: number;
};

type PaymentData = {
  cartItems: CartItem[];
  subtotal: number;
  discount: number;
  deliveryCharge: number;
  platformFee: number;
  convenienceFee: number;
  surgeFee: number;
  finalTotal: number;
  selectedLocation: any;
  selectedPromo: any;
  productCgst: number;
  productSgst: number;
  productCess: number;
  rideCgst: number;
  rideSgst: number;
};

type RazorpayPaymentMeta = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

// API Configuration
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

export default function CartPaymentScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(false);

  const paymentData: PaymentData = route.params?.paymentData || {};
  const onPaymentComplete = route.params?.onPaymentComplete;

  console.log("CartPaymentScreen received data:", {
    paymentData: Object.keys(paymentData),
    hasOnPaymentComplete: !!onPaymentComplete,
    finalTotal: paymentData.finalTotal,
    selectedLocation: paymentData.selectedLocation?.placeLabel,
  });

  const {
    cartItems = [],
    subtotal = 0,
    discount = 0,
    deliveryCharge = 0,
    platformFee = 0,
    convenienceFee = 0,
    surgeFee = 0,
    finalTotal = 0,
    selectedLocation,
    selectedPromo,
    productCgst = 0,
    productSgst = 0,
    productCess = 0,
    rideCgst = 0,
    rideSgst = 0,
  } = paymentData;

  const createRazorpayOrderOnServer = async (amountRupees: number) => {
    console.log("Creating Razorpay order - Amount:", amountRupees);
    const user = auth().currentUser;
    if (!user) throw new Error("Not logged in");

    const amountPaise = toPaise(amountRupees);
    console.log("Amount in paise:", amountPaise);
    
    const headers = await getAuthHeaders();
    console.log("Auth headers obtained");

    const requestData = {
      amountPaise,
      currency: "INR",
      receipt: `rcpt_${user.uid}_${Date.now()}`,
      notes: { uid: user.uid, storeId: selectedLocation?.storeId || "" },
    };
    console.log("Request data:", requestData);
    console.log("API URL:", CREATE_RZP_ORDER_URL);

    const { data } = await api.post(CREATE_RZP_ORDER_URL, requestData, { headers });
    console.log("Server response:", data);

    if (!data?.orderId || !data?.keyId) {
      console.error("Invalid server response:", data);
      throw new Error(data?.error || "Failed to create Razorpay order");
    }

    const result = {
      orderId: String(data.orderId),
      keyId: String(data.keyId),
      amountPaise: Number(data.amountPaise ?? amountPaise),
      currency: String(data.currency ?? "INR"),
    };
    console.log("Processed server order:", result);
    return result;
  };

  const verifyRazorpayPaymentOnServer = async (meta: RazorpayPaymentMeta) => {
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
    console.log("Opening Razorpay WebView with:", { keyId, orderId, amountPaise, currency });
    
    const user = auth().currentUser;
    if (!user) throw new Error("Not logged in");

    const contact = (user.phoneNumber || "").replace("+91", "");
    console.log("User contact:", contact);

    // Navigate to WebView payment
    navigation.navigate("RazorpayWebView", {
      orderId,
      amount: amountPaise / 100, // Convert back to rupees for display
      keyId,
      currency: currency || "INR",
      name: "Ninja Deliveries",
      description: "Order payment",
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
          
          console.log("Payment verified, calling completion callback...");
          if (onPaymentComplete) {
            onPaymentComplete("success", response);
          }
        } catch (error) {
          console.error("Payment verification failed:", error);
          Alert.alert("Payment Verification Failed", "Please contact support.");
          if (onPaymentComplete) {
            onPaymentComplete("failed", { error: "Verification failed" });
          }
        }
      },
      onFailure: (error: any) => {
        console.log("Payment failed:", error);
        Alert.alert("Payment Failed", error?.description || "Payment was not completed.");
        if (onPaymentComplete) {
          onPaymentComplete("failed", error);
        }
      },
    });
  };

  const handlePaymentMethod = async (method: "cod" | "online") => {
    console.log("Payment method selected:", method);
    setLoading(true);

    try {
      if (method === "online") {
        console.log("Starting online payment flow...");
        console.log("Final total:", finalTotal);
        console.log("Selected location:", selectedLocation);

        // Validate required data
        if (!finalTotal || finalTotal <= 0) {
          throw new Error("Invalid payment amount");
        }

        if (!selectedLocation?.storeId) {
          throw new Error("Store ID not found. Please select a delivery address.");
        }

        // Create Razorpay order
        console.log("Creating Razorpay order on server...");
        const serverOrder = await createRazorpayOrderOnServer(finalTotal);
        console.log("Server order created:", serverOrder);

        // Open Razorpay WebView
        console.log("Opening Razorpay WebView...");
        await openRazorpayWebView(
          serverOrder.keyId,
          serverOrder.orderId,
          serverOrder.amountPaise,
          serverOrder.currency
        );
        
        // Note: Payment completion will be handled by WebView callbacks
        // The onSuccess/onFailure callbacks in openRazorpayWebView will handle the rest
      } else {
        // COD payment
        console.log("Processing COD payment...");
        if (onPaymentComplete) {
          await onPaymentComplete(method);
        }
      }

      console.log("Payment completed successfully, navigating back...");
      navigation.goBack();
    } catch (error: any) {
      console.error("Payment error:", error);
      
      // More detailed error handling
      let message = "Payment failed. Please try again.";
      
      if (error?.code === "BAD_REQUEST_ERROR") {
        message = "Invalid payment request. Please check your details and try again.";
      } else if (error?.code === "GATEWAY_ERROR") {
        message = "Payment gateway error. Please try again in a moment.";
      } else if (error?.code === "NETWORK_ERROR") {
        message = "Network error. Please check your internet connection.";
      } else if (error?.description) {
        message = error.description;
      } else if (error?.message) {
        message = error.message;
      }
      
      Alert.alert("Payment Failed", message);
    } finally {
      setLoading(false);
    }
  };

  const itemsSubtotal = subtotal + productCgst + productSgst + productCess;
  const deliveryTotal = deliveryCharge + rideCgst + rideSgst;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Delivery Address */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="location" size={20} color="#00C853" />
            <Text style={styles.cardTitle}>Delivery Address</Text>
          </View>
          <Text style={styles.addressText}>
            {selectedLocation?.placeLabel} - {selectedLocation?.houseNo}
          </Text>
          <Text style={styles.addressSubtext}>{selectedLocation?.address}</Text>
        </View>

        {/* Order Summary */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="receipt" size={20} color="#00C853" />
            <Text style={styles.cardTitle}>Order Summary</Text>
          </View>

          <Text style={styles.itemCount}>
            {cartItems.length} item{cartItems.length > 1 ? "s" : ""}
          </Text>

          {cartItems.slice(0, 3).map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Text style={styles.itemName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.itemQuantity}>x{item.quantity}</Text>
              <Text style={styles.itemPrice}>
                ₹{((item.price - (item.discount || 0)) * item.quantity).toFixed(2)}
              </Text>
            </View>
          ))}

          {cartItems.length > 3 && (
            <Text style={styles.moreItems}>
              +{cartItems.length - 3} more item{cartItems.length - 3 > 1 ? "s" : ""}
            </Text>
          )}
        </View>

        {/* Bill Details */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="calculator" size={20} color="#00C853" />
            <Text style={styles.cardTitle}>Bill Details</Text>
          </View>

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Items Total</Text>
            <Text style={styles.billValue}>₹{itemsSubtotal.toFixed(2)}</Text>
          </View>

          {discount > 0 && (
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Discount</Text>
              <Text style={styles.discountValue}>-₹{discount.toFixed(2)}</Text>
            </View>
          )}

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Delivery Charge</Text>
            <Text style={styles.billValue}>₹{deliveryTotal.toFixed(2)}</Text>
          </View>

          {platformFee > 0 && (
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Platform Fee</Text>
              <Text style={styles.billValue}>₹{platformFee.toFixed(2)}</Text>
            </View>
          )}

          {convenienceFee > 0 && (
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Convenience Fee</Text>
              <Text style={styles.billValue}>₹{convenienceFee.toFixed(2)}</Text>
            </View>
          )}

          {surgeFee > 0 && (
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Weather Surge</Text>
              <Text style={styles.billValue}>₹{surgeFee.toFixed(2)}</Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.billRow}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>₹{finalTotal.toFixed(2)}</Text>
          </View>
        </View>

        {/* Payment Methods */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="card" size={20} color="#00C853" />
            <Text style={styles.cardTitle}>Payment Methods</Text>
          </View>

          {/* Debug Info */}
          <View style={styles.debugInfo}>
            <Text style={styles.debugText}>Debug Info:</Text>
            <Text style={styles.debugText}>Total: ₹{finalTotal}</Text>
            <Text style={styles.debugText}>Store ID: {selectedLocation?.storeId || "Not set"}</Text>
            <Text style={styles.debugText}>Razorpay Available: {RazorpayCheckout ? "Yes" : "No"}</Text>
          </View>

          <TouchableOpacity
            style={[styles.paymentOption, loading && styles.disabledOption]}
            onPress={() => handlePaymentMethod("online")}
            disabled={loading}
          >
            <View style={styles.paymentOptionLeft}>
              <MaterialIcons name="payment" size={24} color="#00C853" />
              <View style={styles.paymentOptionText}>
                <Text style={styles.paymentOptionTitle}>Pay Online</Text>
                <Text style={styles.paymentOptionSubtitle}>
                  UPI, Cards, Net Banking
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.paymentOption, loading && styles.disabledOption]}
            onPress={() => handlePaymentMethod("cod")}
            disabled={loading}
          >
            <View style={styles.paymentOptionLeft}>
              <MaterialIcons name="money" size={24} color="#FF9800" />
              <View style={styles.paymentOptionText}>
                <Text style={styles.paymentOptionTitle}>Cash on Delivery</Text>
                <Text style={styles.paymentOptionSubtitle}>
                  Pay when order arrives
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Payment Note */}
        <View style={styles.noteCard}>
          <Ionicons name="information-circle" size={16} color="#00695c" />
          <Text style={styles.noteText}>
            No cash in hand? Our rider carries a QR code — pay instantly with any UPI app at the doorstep.
          </Text>
        </View>
      </ScrollView>

      {/* Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00C853" />
            <Text style={styles.loadingText}>Processing payment...</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
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

  scrollView: {
    flex: 1,
  },

  card: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginLeft: 8,
  },

  addressText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
    marginBottom: 4,
  },

  addressSubtext: {
    fontSize: 12,
    color: "#666",
    lineHeight: 16,
  },

  itemCount: {
    fontSize: 12,
    color: "#666",
    marginBottom: 8,
  },

  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },

  itemName: {
    flex: 1,
    fontSize: 13,
    color: "#333",
  },

  itemQuantity: {
    fontSize: 13,
    color: "#666",
    marginHorizontal: 8,
  },

  itemPrice: {
    fontSize: 13,
    fontWeight: "500",
    color: "#333",
  },

  moreItems: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
    marginTop: 4,
  },

  billRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },

  billLabel: {
    fontSize: 14,
    color: "#333",
  },

  billValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },

  discountValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#e74c3c",
  },

  divider: {
    height: 1,
    backgroundColor: "#e9ecef",
    marginVertical: 8,
  },

  totalLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },

  totalValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#00C853",
  },

  paymentOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e9ecef",
    marginBottom: 12,
  },

  disabledOption: {
    opacity: 0.5,
  },

  paymentOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  paymentOptionText: {
    marginLeft: 12,
  },

  paymentOptionTitle: {
    fontSize: 15,
    fontWeight: "500",
    color: "#333",
  },

  paymentOptionSubtitle: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
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

  noteCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e0f2f1",
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 24,
    borderRadius: 8,
    padding: 12,
  },

  noteText: {
    flex: 1,
    fontSize: 12,
    color: "#00695c",
    marginLeft: 8,
    lineHeight: 16,
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
});