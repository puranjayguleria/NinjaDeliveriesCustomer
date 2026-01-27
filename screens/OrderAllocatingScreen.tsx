// OrderAllocatingScreen.tsx

import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  Animated,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Image,
} from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import {
  useRoute,
  RouteProp,
  useNavigation,
  CommonActions,
} from "@react-navigation/native";
import firestore from "@react-native-firebase/firestore";

import riderIcon from "../assets/rider-icon-1.png";
import pickupMarker from "../assets/pickup-marker.png";
import dropoffMarker from "../assets/dropoff-marker.png";
import { useOrder } from "@/context/OrderContext";
import { Ionicons } from "@expo/vector-icons";
import Loader from "@/components/VideoLoader";
import axios from "axios";
import auth from "@react-native-firebase/auth";

const CLOUD_FUNCTIONS_BASE_URL =
  "https://asia-south1-ninjadeliveries-91007.cloudfunctions.net";
const CANCEL_ORDER_URL = `${CLOUD_FUNCTIONS_BASE_URL}/refundRazorpayPayment`;

type StackParamList = {
  OrderAllocating: {
    orderId: string;
    pickupCoords: { latitude: number; longitude: number };
    dropoffCoords: { latitude: number; longitude: number };
    totalCost?: number;
  };
};

type OrderAllocatingScreenRouteProp = RouteProp<
  StackParamList,
  "OrderAllocating"
>;

const quotes = [
  "Ninjas are fast, but we're faster with your delivery!",
  "Your delivery is so stealthy, even we can't see it!",
  "Is it a bird? Is it a plane? No, it's Ninja Deliveries!",
  "Ninja Delivery: As fast as a throwing star!",
  "Your package is moving like a ninja in the night!",
];

interface OrderItem {
  name: string;
  price: number;
  discount?: number;
  quantity: number;
  CGST: number;
  SGST: number;
}

const OrderAllocatingScreen: React.FC = () => {
  // --------------------------------------------------
  // HOOKS & PARAMS
  // --------------------------------------------------
  const route = useRoute<OrderAllocatingScreenRouteProp>();
  const navigation = useNavigation();
  const { orderId, pickupCoords, dropoffCoords, totalCost = 0 } = route.params;

  // If you have an OrderContext to set the active order:
  const { setActiveOrder } = useOrder();

  // --------------------------------------------------
  // LOCAL STATES
  // --------------------------------------------------
  const [region, setRegion] = useState<Region | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [quote, setQuote] = useState(quotes[0]);
  const [mapReady, setMapReady] = useState(false);
  const [nearbyRiders, setNearbyRiders] = useState<any[]>([]);
  const [orderAccepted, setOrderAccepted] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Animation Refs
  const markerAnimation = useRef(new Animated.Value(1)).current;
  const mapOpacity = useRef(new Animated.Value(1)).current;
  const mapRef = useRef<MapView>(null);

  // --------------------------------------------------
  // ON MOUNT
  // --------------------------------------------------
  useEffect(() => {
    console.log("OrderAllocatingScreen Params:", {
      orderId,
      pickupCoords,
      dropoffCoords,
      totalCost,
    });

    if (!pickupCoords || !dropoffCoords) {
      Alert.alert("Error", "Order location details are missing.");
      navigation.goBack();
      return;
    }

    // Initial region for the map
    const initialRegion: Region = {
      latitude: pickupCoords.latitude,
      longitude: pickupCoords.longitude,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
    setRegion(initialRegion);

    // Programmatically fit map to show both pickup and dropoff
    setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.fitToCoordinates([pickupCoords, dropoffCoords], {
          edgePadding: { top: 100, right: 100, bottom: 100, left: 100 },
          animated: true,
        });
      }
    }, 1000);

    // Cycle random quotes every 3 seconds
    const quoteInterval = setInterval(() => {
      const nextQuote = quotes[Math.floor(Math.random() * quotes.length)];
      setQuote(nextQuote);
    }, 3000);

    // Firestore ref for the order
    const orderRef = firestore().collection("orders").doc(orderId);

    // Listen for changes to the order document in real-time
    const unsubscribeOrder = orderRef.onSnapshot((doc) => {
      const data = doc.data();
      if (!data) return;

      setOrderData(data);

      // If a rider has accepted and we haven't navigated yet:
      if (data.acceptedBy && !orderAccepted) {
        setOrderAccepted(true);

        // (Optional) Set an active order in context
        setActiveOrder?.({
          id: orderId,
          status: "active",
          pickupCoords: {
            latitude: data.pickupCoords.latitude,
            longitude: data.pickupCoords.longitude,
          },
          dropoffCoords: {
            latitude: data.dropoffCoords.latitude,
            longitude: data.dropoffCoords.longitude,
          },
          totalCost,
        });

        // Navigate to OrderTracking (inside HomeStack)
        navigation.navigate(
          "HomeTab" as never,
          {
            screen: "OrderTracking",
            params: {
              orderId,
              pickupCoords,
              dropoffCoords,
              totalCost,
            },
          } as never
        );
      }

      // If the order was cancelled remotely (e.g. by Lambda or admin):
      if (data.status === "cancelled" && !orderAccepted) {
        navigation.navigate(
          "HomeTab" as never,
          {
            screen: "OrderCancelled",
            params: {
              orderId,
              refundAmount: data.refundAmount ?? totalCost,
            },
          } as never
        );
      }
    });

    // Fetch riders around
    const fetchNearbyRiders = async () => {
      try {
        const snapshot = await firestore()
          .collection("riderDetails")
          .where("isAvailable", "==", true)
          .get();

        const ridersList = snapshot.docs.map((doc) => doc.data());
        setNearbyRiders(ridersList);

        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching riders:", err);
        Alert.alert("Error", "Failed to fetch nearby riders.");
        setIsLoading(false);
      }
    };
    fetchNearbyRiders();

    return () => {
      clearInterval(quoteInterval);
      unsubscribeOrder();
    };
  }, [
    orderId,
    pickupCoords,
    dropoffCoords,
    totalCost,
    orderAccepted,
    markerAnimation,
    mapOpacity,
    navigation,
    setActiveOrder,
  ]);

  // --------------------------------------------------
  // CANCEL ORDER LOGIC (if user manually cancels)
  // --------------------------------------------------
 const cancelOrder = async () => {
  if (isCancelling) return;

  Alert.alert(
    "Cancel Order?",
    "Are you sure you want to cancel this order?",
    [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: async () => {
          setIsCancelling(true);
          try {
            const orderRef = firestore().collection("orders").doc(orderId);
            const snap = await orderRef.get();
            if (!snap.exists) {
              Alert.alert("Error", "Order not found. Please contact support.");
              return;
            }

            const data = snap.data() || {};
            const paymentMethod = String(
              data.paymentMethod || data?.payment?.method || "cod"
            );
            const refundAmount = Number(data.finalTotal || 0);

            const isOnlinePaid =
              paymentMethod === "online" &&
              !!(
                data?.razorpay?.razorpay_payment_id ||
                data?.payment?.razorpay?.paymentId
              );

            // ✅ COD: cancel only
            if (paymentMethod === "cod") {
              await orderRef.update({
                status: "cancelled",
                cancelledBy: "user",
                cancelledAt: firestore.FieldValue.serverTimestamp(),
                refundAmount: 0,
                refundStatus: "not_applicable",
              });

              setActiveOrder?.(null);

              navigation.navigate(
                "HomeTab" as never,
                { screen: "OrderCancelled", params: { orderId, refundAmount: 0 } } as never
              );
              return;
            }

            // ✅ ONLINE but not paid: cancel only
            if (paymentMethod === "online" && !isOnlinePaid) {
              await orderRef.update({
                status: "cancelled",
                cancelledBy: "user",
                cancelledAt: firestore.FieldValue.serverTimestamp(),
                refundAmount: 0,
                refundStatus: "not_paid",
              });

              setActiveOrder?.(null);

              navigation.navigate(
                "HomeTab" as never,
                { screen: "OrderCancelled", params: { orderId, refundAmount: 0 } } as never
              );
              return;
            }

            // ✅ ONLINE + paid: call server refund function
            const user = auth().currentUser;
            const token = await user?.getIdToken();
            if (!token) throw new Error("User not logged in");

            const resp = await axios.post(
              CANCEL_ORDER_URL,
              { orderId },
              {
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
              }
            );

            const refunded =
              typeof resp?.data?.refundAmount === "number"
                ? resp.data.refundAmount
                : typeof resp?.data?.refundAmountPaise === "number"
                  ? resp.data.refundAmountPaise / 100
                  : refundAmount;

            setActiveOrder?.(null);

            navigation.navigate(
              "HomeTab" as never,
              { screen: "OrderCancelled", params: { orderId, refundAmount: refunded } } as never
            );
          } catch (e: any) {
            console.error("cancel/refund error:", e);
            const msg =
              e?.response?.data?.error ||
              e?.message ||
              "Cancellation failed. Please try again.";
            Alert.alert("Cancel Failed", msg);
          } finally {
            setIsCancelling(false);
          }
        },
      },
    ]
  );
};





  // --------------------------------------------------
  // OTHER HANDLERS
  // --------------------------------------------------
  const handleForgotItemsLink = () => {
    navigation.navigate("HomeTab", {
      screen: "ProductsHome",
    });
  };

  const handleClose = () => {
    // Example: jump to the CartFlow tab’s screen
    navigation.navigate(
      "CartFlow" as never,
      {
        screen: "CartHome",
      } as never
    );
  };

  // --------------------------------------------------
  // RENDER ORDER ITEMS
  // --------------------------------------------------
  const renderOrderItem = ({ item }: { item: OrderItem }) => {
    const price = Number(item.price) || 0;
    const discount = Number(item.discount) || 0;
    const cgst = Number(item.CGST) || 0;
    const sgst = Number(item.SGST) || 0;

    const basePrice = price - discount;
    const realPrice = basePrice + cgst + sgst;

    return (
      <View style={styles.orderItemRow}>
        <Text style={styles.orderItemName}>{item.name}</Text>
        <Text style={styles.orderItemQuantity}>x{item.quantity}</Text>
        <Text style={styles.orderItemPrice}>₹{realPrice.toFixed(2)}</Text>
      </View>
    );
  };
const CancellingOverlay = () => {
  if (!isCancelling) return null;
  return (
    <View style={styles.cancellingOverlay}>
      <View style={styles.cancellingCard}>
        <ActivityIndicator size="large" />
        <Text style={styles.cancellingText}>
          Cancelling your order...
        </Text>
      </View>
    </View>
  );
};

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------
  return (
    <View style={styles.container}>
      {/* Close Button (top-right) */}
      <CancellingOverlay />

      <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
        <Ionicons name="close" size={24} color="#e74c3c" />
      </TouchableOpacity>

      {isLoading ? (
        <View style={styles.loaderContainer}>
          <Loader />
        </View>
      ) : (
        <>
          {/* Animated Map Container */}
          <Animated.View style={[styles.mapContainer, { opacity: mapOpacity }]}>
            {region ? (
              <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={region}
                onMapReady={() => {
                  setMapReady(true);
                  mapRef.current?.fitToCoordinates(
                    [pickupCoords, dropoffCoords],
                    {
                      edgePadding: {
                        top: 100,
                        right: 100,
                        bottom: 100,
                        left: 100,
                      },
                      animated: true,
                    }
                  );
                }}
                onRegionChangeComplete={(newReg) => setRegion(newReg)}
                onError={(error) => {
                  console.error("MapView Error:", error);
                  Alert.alert("Error", "Failed to load the map.");
                }}
              >
                {/* Pickup Marker */}
                <Marker coordinate={pickupCoords} title="Pickup Location">
                  <Animated.View
                    style={{ transform: [{ scale: markerAnimation }] }}
                  >
                    <Image
                      source={pickupMarker}
                      style={{ width: 40, height: 40 }}
                    />
                  </Animated.View>
                </Marker>

                {/* Dropoff Marker */}
                <Marker coordinate={dropoffCoords} title="Dropoff Location">
                  <Animated.View
                    style={{ transform: [{ scale: markerAnimation }] }}
                  >
                    <Image
                      source={dropoffMarker}
                      style={{ width: 40, height: 40 }}
                    />
                  </Animated.View>
                </Marker>

                {/* Nearby Riders Markers */}
                {nearbyRiders.map((r: any, idx: number) => (
                  <Marker
                    key={idx}
                    coordinate={{
                      latitude: r.location.latitude,
                      longitude: r.location.longitude,
                    }}
                    description="Available Rider"
                  >
                    <Animated.View
                      style={{ transform: [{ scale: markerAnimation }] }}
                    >
                      <Image
                        source={riderIcon}
                        style={{ width: 30, height: 40 }}
                      />
                    </Animated.View>
                  </Marker>
                ))}
              </MapView>
            ) : (
              <View style={styles.loaderContainer}>
                <Text style={styles.quoteText}>{quote}</Text>
              </View>
            )}
          </Animated.View>

          {/* Bottom Container => Scrollable if needed */}
          <ScrollView
            style={styles.bottomScroll}
            contentContainerStyle={styles.bottomContainerContent}
          >
            <Text style={[styles.header, styles.highlightText]}>
              We are assigning a Ninja rider for you...
            </Text>
            <Text style={styles.quoteText}>{quote}</Text>

            <View style={styles.linkRow}>
              <Text style={styles.linkLabel}>Forgot something?</Text>
              <TouchableOpacity onPress={handleForgotItemsLink}>
                <Text style={styles.linkText}>Order More</Text>
              </TouchableOpacity>
            </View>

            {/* Show "Cancel Order" only if status is still pending or accepted */}
            {(orderData?.status === "pending" ||
              orderData?.status === "accepted") &&
              !orderAccepted && (
                <TouchableOpacity
  style={[styles.cancelButton, isCancelling && { opacity: 0.6 }]}
  onPress={cancelOrder}
  disabled={isCancelling}
>
  <Text style={styles.cancelButtonText}>
    {isCancelling ? "Cancelling..." : "Cancel Order"}
  </Text>
</TouchableOpacity>

              )}

            {/* Order Details Card */}
            {orderData && orderData.items && orderData.items.length > 0 && (
              <View style={styles.orderDetailsCard}>
                <Text style={styles.orderDetailsHeader}>Order Details</Text>

                <ScrollView style={styles.orderDetailsScroll}>
                  {/* Order Items */}
                  {orderData.items.map((item, index) => (
                    <View key={index}>
                      {renderOrderItem({ item })}
                      {index < orderData.items.length - 1 && (
                        <View style={styles.separator} />
                      )}
                    </View>
                  ))}

                  {/* PRICE BREAKDOWN */}
                  <View style={styles.billSummaryContainer}>
                    <View style={styles.billRow}>
                      <Text style={styles.billLabel}>Subtotal</Text>
                      <Text style={styles.billValue}>
                        ₹
                        {(
                          (orderData.subtotal || 0) +
                          (orderData.productCgst || 0) +
                          (orderData.productSgst || 0)
                        ).toFixed(2)}
                      </Text>
                    </View>

                    {typeof orderData.deliveryCharge !== "undefined" && (
                      <View style={styles.billRow}>
                        <Text style={styles.billLabel}>Delivery Charge</Text>
                        <Text style={styles.billValue}>
                          ₹
                          {(
                            (orderData.deliveryCharge || 0) +
                            (orderData.rideCgst || 0) +
                            (orderData.rideSgst || 0)
                          ).toFixed(2)}
                        </Text>
                      </View>
                    )}

                    {typeof orderData.convenienceFee !== "undefined" && (
                      <View style={styles.billRow}>
                        <Text style={styles.billLabel}>Convenience Fee</Text>
                        <Text style={styles.billValue}>
                          ₹{(orderData.convenienceFee || 0).toFixed(2)}
                        </Text>
                      </View>
                    )}

                    {typeof orderData.surgeFee !== "undefined" && (
                      <View style={styles.billRow}>
                        <Text style={styles.billLabel}>Surge Fee</Text>
                        <Text style={styles.billValue}>
                          ₹{(orderData.surgeFee || 0).toFixed(2)}
                        </Text>
                      </View>
                    )}

                    {typeof orderData.platformFee !== "undefined" && (
                      <View style={styles.billRow}>
                        <Text style={styles.billLabel}>Platform Fee</Text>
                        <Text style={styles.billValue}>
                          ₹{(orderData.platformFee || 0).toFixed(2)}
                        </Text>
                      </View>
                    )}

                    {typeof orderData.discount !== "undefined" && (
                      <View style={styles.billRow}>
                        <Text style={styles.billLabel}>Discount</Text>
                        <Text style={styles.billValue}>
                          -₹{(orderData.discount || 0).toFixed(2)}
                        </Text>
                      </View>
                    )}

                    <View style={styles.billRow}>
                      <Text style={[styles.billLabel, { fontWeight: "700" }]}>
                        Total
                      </Text>
                      <Text style={[styles.billValue, { fontWeight: "700" }]}>
                        ₹{orderData.finalTotal?.toFixed(2) || "0.00"}
                      </Text>
                    </View>
                  </View>
                </ScrollView>
              </View>
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
};

export default OrderAllocatingScreen;
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  itemsScrollContainer: {
    maxHeight: 150, // or use height: '40%' for relative sizing
    marginBottom: 10,
  },
  orderDetailsCard: {
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    height: "70%", // or 300 depending on screen size
  },
  orderDetailsScroll: {
    maxHeight: "100%", // adjust based on screen height (can use Dimensions.get if needed)
  },

  closeButton: {
    position: "absolute",
    top: 15,
    right: 20,
    zIndex: 10,
    backgroundColor: "rgba(255,255,255,0.8)",
    borderRadius: 20,
    padding: 6,
  },
  loaderContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  mapContainer: {
    flex: 1,
    backgroundColor: "#e1e1e1",
    height: "40%", // You can adjust this to desired map portion
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  bottomScroll: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "60%", // dynamic height for bottom drawer
    backgroundColor: "#fff",
    borderTopRightRadius: 12,
    borderTopLeftRadius: 12,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: -2 },
  },
  bottomContainerContent: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 20,
    height: "100%", // fills the bottomScroll container
  },
  cancellingOverlay: {
  ...StyleSheet.absoluteFillObject,
  backgroundColor: "rgba(0,0,0,0.35)",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 9999,
},
cancellingCard: {
  backgroundColor: "#fff",
  paddingVertical: 18,
  paddingHorizontal: 22,
  borderRadius: 12,
  alignItems: "center",
  width: "80%",
},
cancellingText: {
  marginTop: 10,
  fontSize: 14,
  color: "#333",
  textAlign: "center",
  fontWeight: "600",
},

  header: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
    color: "#333",
  },
  highlightText: {
    color: "#e67e22",
    fontSize: 20,
    fontWeight: "bold",
  },
  quoteText: {
    fontSize: 14,
    fontStyle: "italic",
    textAlign: "center",
    color: "#666",
    marginBottom: 12,
  },
  linkRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 12,
  },
  linkLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#444",
    marginRight: 5,
  },
  linkText: {
    fontSize: 14,
    color: "#3498db",
    textDecorationLine: "underline",
  },
  cancelButton: {
    alignSelf: "center",
    backgroundColor: "#e74c3c",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 5,
  },
  cancelButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },

  orderDetailsHeader: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
    color: "#333",
    textAlign: "center",
  },
  orderItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderItemName: {
    fontSize: 14,
    color: "#333",
    flex: 2,
  },
  orderItemQuantity: {
    fontSize: 14,
    color: "#555",
    flex: 1,
    textAlign: "center",
  },
  orderItemPrice: {
    fontSize: 14,
    color: "#333",
    flex: 1,
    textAlign: "right",
  },
  separator: {
    height: 1,
    backgroundColor: "#eee",
    marginVertical: 8,
  },
  billSummaryContainer: {
    marginTop: 20,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: "#ddd",
    height: "auto", // or use % if it's a known section
  },
  billRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  billLabel: {
    fontSize: 14,
    color: "#333",
  },
  billValue: {
    fontSize: 14,
    color: "#333",
  },
});
