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
  ScrollView,
  Image,
} from "react-native";
import MapView, { Marker, Polyline, Region } from "react-native-maps";
import {
  useRoute,
  RouteProp,
  useNavigation,
} from "@react-navigation/native";
import firestore from "@react-native-firebase/firestore";

import riderIcon from "../../assets/rider-icon-1.png";
import pickupMarker from "../../assets/pickup-marker.png";
import dropoffMarker from "../../assets/dropoff-marker.png";
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

const ALLOCATING_MAP_STYLE = [
  {
    elementType: "geometry",
    stylers: [{ color: "#edf4fb" }],
  },
  {
    elementType: "labels.text.fill",
    stylers: [{ color: "#475569" }],
  },
  {
    elementType: "labels.text.stroke",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "poi",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#d8e4f0" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#dceafe" }],
  },
  {
    featureType: "transit",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#cde6ff" }],
  },
];

const ALLOCATION_STEPS = [
  { key: "placed", label: "Order Placed", icon: "receipt-outline" as const },
  { key: "searching", label: "Searching Rider", icon: "search-outline" as const },
  { key: "assigned", label: "Rider Assigned", icon: "person-outline" as const },
  { key: "tracking", label: "Tracking Starts", icon: "navigate-outline" as const },
];

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
  const [nearbyRiders, setNearbyRiders] = useState<any[]>([]);
  const [orderAccepted, setOrderAccepted] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Animation Refs
  const markerAnimation = useRef(new Animated.Value(1)).current;
  const mapOpacity = useRef(new Animated.Value(0)).current;
  const mapRef = useRef<MapView>(null);

  // --------------------------------------------------
  // ON MOUNT
  // --------------------------------------------------
  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(markerAnimation, {
          toValue: 1.08,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(markerAnimation, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );

    pulseAnimation.start();

    return () => {
      pulseAnimation.stop();
    };
  }, [markerAnimation]);

  useEffect(() => {
    console.log("OrderAllocatingScreen Params:", {
      orderId,
      pickupCoords,
      dropoffCoords,
      totalCost,
    });

    if (!pickupCoords || !dropoffCoords) {
      Alert.alert("Error", "Order location details are missing.");
      if ((navigation as any).canGoBack?.()) {
        navigation.goBack();
      } else {
        navigation.navigate(
          "HomeTab" as never,
          { screen: "ProductsHome" } as never
        );
      }
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

  const getProgressStepIndex = () => {
    if (orderAccepted || orderData?.acceptedBy) {
      return 3;
    }

    return 1;
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
  const currentStepIndex = getProgressStepIndex();

  return (
    <View style={styles.container}>
      {/* Close Button (top-right) */}
      <CancellingOverlay />

      <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
        <Ionicons name="close" size={22} color="#0f172a" />
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
                customMapStyle={ALLOCATING_MAP_STYLE}
                onMapReady={() => {
                  Animated.timing(mapOpacity, {
                    toValue: 1,
                    duration: 450,
                    useNativeDriver: true,
                  }).start();
                  mapRef.current?.fitToCoordinates(
                    [pickupCoords, dropoffCoords],
                    {
                      edgePadding: {
                        top: 110,
                        right: 70,
                        bottom: 180,
                        left: 70,
                      },
                      animated: true,
                    }
                  );
                }}
                onRegionChangeComplete={(newReg) => setRegion(newReg)}
                toolbarEnabled={false}
                showsCompass={false}
                showsBuildings={false}
                showsIndoors={false}
                rotateEnabled={false}
                pitchEnabled={false}
                onError={(error) => {
                  console.error("MapView Error:", error);
                  Alert.alert("Error", "Failed to load the map.");
                }}
              >
                <Marker coordinate={pickupCoords} title="Pickup Location">
                  <View style={styles.markerShell}>
                    <Animated.View
                      style={[
                        styles.markerPulse,
                        { transform: [{ scale: markerAnimation }] },
                      ]}
                    />
                    <Image
                      source={pickupMarker}
                      style={styles.primaryMarkerImage}
                    />
                  </View>
                </Marker>

                <Marker coordinate={dropoffCoords} title="Dropoff Location">
                  <View style={styles.markerShell}>
                    <Animated.View
                      style={[
                        styles.markerPulse,
                        styles.dropoffPulse,
                        { transform: [{ scale: markerAnimation }] },
                      ]}
                    />
                    <Image
                      source={dropoffMarker}
                      style={styles.primaryMarkerImage}
                    />
                  </View>
                </Marker>

                <Polyline
                  coordinates={[pickupCoords, dropoffCoords]}
                  strokeWidth={10}
                  strokeColor="rgba(15, 118, 110, 0.16)"
                />
                <Polyline
                  coordinates={[pickupCoords, dropoffCoords]}
                  strokeWidth={4}
                  strokeColor="#0F766E"
                  lineDashPattern={[1, 0]}
                />

                {/* Pickup Marker */}
                {nearbyRiders.map((r: any, idx: number) => (
                  <Marker
                    key={idx}
                    coordinate={{
                      latitude: r.location.latitude,
                      longitude: r.location.longitude,
                    }}
                    description="Available Rider"
                  >
                    <View style={styles.nearbyRiderMarker}>
                      <Image
                        source={riderIcon}
                        style={styles.nearbyRiderMarkerImage}
                      />
                    </View>
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
            <View style={styles.sheetHandle} />

            <View style={styles.heroCard}>
              <View style={styles.heroHeaderRow}>
                <View style={styles.heroIconBadge}>
                  <Ionicons name="sparkles-outline" size={18} color="#0f766e" />
                </View>
                <View style={styles.heroTextBlock}>
                  <Text style={styles.heroTitle}>
                    We are assigning a Ninja rider for you
                  </Text>
                  <Text style={styles.heroSubtitle}>{quote}</Text>
                </View>
              </View>
            </View>

            <View style={styles.progressCard}>
              <View style={styles.progressHeaderRow}>
                <Text style={styles.progressTitle}>Allocation Progress</Text>
                <Text style={styles.progressSummary}>
                  {Math.min(currentStepIndex + 1, ALLOCATION_STEPS.length)}/4
                </Text>
              </View>
              <View style={styles.progressStepsRow}>
                {ALLOCATION_STEPS.map((step, index) => {
                  const isCompleted = index <= currentStepIndex;
                  return (
                    <View key={step.key} style={styles.progressStep}>
                      <View
                        style={[
                          styles.progressStepIcon,
                          isCompleted && styles.progressStepIconActive,
                        ]}
                      >
                        <Ionicons
                          name={step.icon}
                          size={15}
                          color={isCompleted ? "#ffffff" : "#64748b"}
                        />
                      </View>
                      <Text
                        style={[
                          styles.progressStepLabel,
                          isCompleted && styles.progressStepLabelActive,
                        ]}
                      >
                        {step.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={styles.actionCard}>
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
                  <Ionicons name="close-circle-outline" size={18} color="#fff" />
                  <Text style={styles.cancelButtonText}>
                    {isCancelling ? "Cancelling..." : "Cancel Order"}
                  </Text>
                </TouchableOpacity>
              )}

            {/* Order Details Card */}
            {orderData && orderData.items && orderData.items.length > 0 && (
              <View style={styles.orderDetailsCard}>
                <View style={styles.orderDetailsHeaderRow}>
                  <Text style={styles.orderDetailsHeader}>Order Details</Text>
                  <View style={styles.totalPill}>
                    <Text style={styles.totalPillText}>
                      ₹{orderData.finalTotal?.toFixed(2) || "0.00"}
                    </Text>
                  </View>
                </View>

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
    backgroundColor: "#eef2f7",
  },
  itemsScrollContainer: {
    maxHeight: 150,
    marginBottom: 10,
  },
  orderDetailsCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 20,
    padding: 16,
    marginTop: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    flex: 1,
  },
  orderDetailsScroll: {
    maxHeight: "100%",
  },
  closeButton: {
    position: "absolute",
    top: 18,
    right: 20,
    zIndex: 10,
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 21,
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  loaderContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#eef2f7",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
  mapContainer: {
    height: "43%",
    marginHorizontal: 14,
    marginTop: 14,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#dbeafe",
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  markerShell: {
    alignItems: "center",
    justifyContent: "center",
  },
  markerPulse: {
    position: "absolute",
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(37, 99, 235, 0.16)",
  },
  dropoffPulse: {
    backgroundColor: "rgba(239, 68, 68, 0.14)",
  },
  primaryMarkerImage: {
    width: 38,
    height: 46,
    resizeMode: "contain",
  },
  nearbyRiderMarker: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#dbeafe",
    shadowColor: "#0f172a",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  nearbyRiderMarkerImage: {
    width: 18,
    height: 24,
    resizeMode: "contain",
  },
  bottomScroll: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "58%",
    backgroundColor: "#fff",
    borderTopRightRadius: 28,
    borderTopLeftRadius: 28,
    elevation: 8,
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
  },
  bottomContainerContent: {
    paddingTop: 10,
    paddingHorizontal: 18,
    paddingBottom: 24,
    minHeight: "100%",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#cbd5e1",
    marginBottom: 14,
  },
  cancellingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.28)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  cancellingCard: {
    backgroundColor: "#fff",
    paddingVertical: 18,
    paddingHorizontal: 22,
    borderRadius: 16,
    alignItems: "center",
    width: "80%",
  },
  cancellingText: {
    marginTop: 10,
    fontSize: 14,
    color: "#0f172a",
    textAlign: "center",
    fontWeight: "600",
  },
  quoteText: {
    fontSize: 14,
    fontStyle: "italic",
    textAlign: "center",
    color: "#64748b",
    marginBottom: 12,
  },
  heroCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 14,
  },
  heroHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  heroIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ecfdf5",
    marginRight: 12,
  },
  heroTextBlock: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
    lineHeight: 24,
  },
  heroSubtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: "#64748b",
  },
  progressCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    marginBottom: 14,
  },
  progressHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  progressSummary: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f766e",
  },
  progressStepsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressStep: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 3,
  },
  progressStepIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  progressStepIconActive: {
    backgroundColor: "#0f766e",
  },
  progressStepLabel: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
    color: "#64748b",
  },
  progressStepLabelActive: {
    color: "#0f172a",
  },
  actionCard: {
    backgroundColor: "#eff6ff",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  linkLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1e293b",
  },
  linkText: {
    fontSize: 14,
    color: "#2563eb",
    fontWeight: "700",
  },
  cancelButton: {
    alignSelf: "stretch",
    backgroundColor: "#ef4444",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 16,
    marginTop: 2,
    marginBottom: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#991b1b",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cancelButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
    marginLeft: 8,
  },
  orderDetailsHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  orderDetailsHeader: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  totalPill: {
    backgroundColor: "#ecfdf5",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  totalPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f766e",
  },
  orderItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  orderItemName: {
    fontSize: 14,
    color: "#0f172a",
    flex: 2,
  },
  orderItemQuantity: {
    fontSize: 14,
    color: "#64748b",
    flex: 1,
    textAlign: "center",
  },
  orderItemPrice: {
    fontSize: 14,
    color: "#0f172a",
    flex: 1,
    textAlign: "right",
  },
  separator: {
    height: 1,
    backgroundColor: "#e2e8f0",
    marginVertical: 8,
  },
  billSummaryContainer: {
    marginTop: 20,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: "#dbe2ea",
  },
  billRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  billLabel: {
    fontSize: 14,
    color: "#334155",
  },
  billValue: {
    fontSize: 14,
    color: "#0f172a",
  },
});
