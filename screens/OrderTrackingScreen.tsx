// OrderTrackingScreen.tsx
import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Image,
  TouchableOpacity,
  Linking,
  Alert,
  Animated,
  ScrollView,
} from "react-native";

import firestore from "@react-native-firebase/firestore";
import MapView, { Marker, Polyline, LatLng } from "react-native-maps";
import { useRoute, RouteProp, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useOrder } from "../context/OrderContext";

import riderIcon from "../assets/rider-icon-1.png";
import pickupMarker from "../assets/pickup-marker.png";
import dropoffMarker from "../assets/dropoff-marker.png";

// ------------------ TYPES ------------------
type OrderTrackingScreenRouteProp = RouteProp<
  {
    params: {
      orderId: string;
      dropoffCoords: LatLng;
      pickupCoords: LatLng;
      totalCost: number;
    };
  },
  "params"
>;

interface OrderItem {
  name: string;
  price: number;
  discount?: number;
  quantity: number;
}

// ------------------ COMPONENT ------------------
const OrderTrackingScreen: React.FC = () => {
  const route = useRoute<OrderTrackingScreenRouteProp>();
  const { orderId, dropoffCoords, pickupCoords } = route.params;
  const navigation = useNavigation();
  const { setActiveOrder } = useOrder();

  // Rider + Order
  const [riderLocation, setRiderLocation] = useState<LatLng | null>(null);
  const [riderInfo, setRiderInfo] = useState({ riderName: "", contactNumber: "" });
  const [riderId, setRiderId] = useState<string | null>(null);
  const [orderDoc, setOrderDoc] = useState<any>(null); // entire doc (items, finalTotal, etc.)

  // UI + Status
  const [orderStatus, setOrderStatus] = useState<string>("pending");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [eta, setEta] = useState<number>(0);
  const [pathCoordinates, setPathCoordinates] = useState<LatLng[]>([]);
  const [isMapReady, setIsMapReady] = useState<boolean>(false);

  // For the map
  const mapRef = useRef<MapView | null>(null);
  const mapOpacity = useRef(new Animated.Value(1)).current;

  // Guard to prevent repeated navigation to Rating
  const hasNavigatedToRatingRef = useRef(false);

  // ------------------ UTILS ------------------
  const getFriendlyStatus = (status: string): string => {
    switch (status) {
      case "accepted":
        return "Rider has accepted your order.";
      case "reachedPickup":
        return "Rider has reached the pickup point.";
      case "tripStarted":
        return "Your order is on the way!";
      case "tripEnded":
        return "Trip has ended. Please rate your rider.";
      case "cancelled":
        return "Order has been cancelled.";
      default:
        return "Waiting for a rider to accept your order...";
    }
  };

  const calculateDistance = (start: LatLng, end: LatLng): number => {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const R = 6371; // Earth radius in km
    const dLat = toRad(end.latitude - start.latitude);
    const dLon = toRad(end.longitude - start.longitude);
    const lat1 = toRad(start.latitude);
    const lat2 = toRad(end.latitude);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // distance in km
  };

  // ------------------ EFFECTS ------------------
  useEffect(() => {
    // Reset on new order
    setRiderLocation(null);
    setPathCoordinates([]);
    setIsLoading(true);
    hasNavigatedToRatingRef.current = false;
  }, [orderId]);

  // Listen to order doc
  useEffect(() => {
    const orderRef = firestore().collection("orders").doc(orderId);

    const unsubscribeOrder = orderRef.onSnapshot((snapshot) => {
      const data = snapshot.data();
      if (!data) {
        setIsLoading(false);
        return;
      }
      setOrderDoc(data);
      setOrderStatus(data.status);

      // If there's a rider
      if (data.acceptedBy) {
        setRiderId(data.acceptedBy);
        const riderRef = firestore().collection("riderDetails").doc(data.acceptedBy);

        const unsubscribeRider = riderRef.onSnapshot((riderSnap) => {
          const rData = riderSnap.data();
          if (rData) {
            setRiderInfo({
              riderName: rData.name || "Unknown Rider",
              contactNumber: rData.contactNumber || "No contact",
            });

            // If rider has location
            if (rData.location) {
              const newLocation: LatLng = {
                latitude: rData.location.latitude,
                longitude: rData.location.longitude,
              };
              setRiderLocation(newLocation);

              // path is [pickup, newLocation, dropoff]
              setPathCoordinates([pickupCoords, newLocation, dropoffCoords]);

              // Estimate: 30 km/h => distance / 30 => hr => *60 => minutes
              const distance = calculateDistance(newLocation, dropoffCoords);
              const etaMinutes = (distance / 30) * 60;
              setEta(etaMinutes);
            }
          }
          setIsLoading(false);
        });

        // Cleanup
        return () => unsubscribeRider();
      } else {
        // No rider
        setIsLoading(false);
      }
    });

    // Cleanup
    return () => unsubscribeOrder();
  }, [orderId, pickupCoords, dropoffCoords]);

  // If riderLocation changes => fit map
  useEffect(() => {
    if (riderLocation && isMapReady && mapRef.current) {
      fitMapToMarkers([pickupCoords, riderLocation, dropoffCoords]);
    }
  }, [riderLocation, isMapReady, pickupCoords, dropoffCoords]);

  // Check if ended => go Rating
  useEffect(() => {
    if (orderStatus === "tripEnded" && !hasNavigatedToRatingRef.current && riderId) {
      hasNavigatedToRatingRef.current = true;
      setActiveOrder(null);

      navigation.navigate("RatingScreen" as never, { orderId } as never);
    }
    if (orderStatus === "cancelled") {
      setActiveOrder(null);
    }
  }, [orderStatus, riderId, orderId, navigation, setActiveOrder]);

  // ------------------ FUNCTIONS ------------------
  const fitMapToMarkers = (coords: LatLng[]) => {
    if (mapRef.current) {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 100, right: 100, bottom: 100, left: 100 },
        animated: true,
      });
    }
  };

  const handleCenterOnRider = () => {
    if (riderLocation && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          ...riderLocation,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        500
      );
    }
  };

  // ------------- RENDERING ORDER ITEMS -------------
  const renderOrderItem = ({ item }: { item: OrderItem }) => {
    const finalPrice = item.discount ? item.price - item.discount : item.price;
    return (
      <View style={styles.orderItemRow}>
        <Text style={styles.orderItemName}>{item.name}</Text>
        <Text style={styles.orderItemQty}>x{item.quantity}</Text>
        <Text style={styles.orderItemPrice}>₹{finalPrice.toFixed(2)}</Text>
      </View>
    );
  };

  // ------------------ RENDER ------------------
  if (isLoading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#00C853" />
        <Text style={styles.loaderText}>Loading order and rider details...</Text>
      </View>
    );
  }

  // Determine final display text. If "tripStarted", apply extra highlight
  const statusText = getFriendlyStatus(orderStatus);
  const isTripStarted = orderStatus === "tripStarted";

  return (
    <View style={styles.container}>
      {/* MAP */}
      <Animated.View style={[styles.mapContainer, { opacity: mapOpacity }]}>
        <MapView
          ref={mapRef}
          style={styles.map}
          onMapReady={() => setIsMapReady(true)}
          showsUserLocation
          showsMyLocationButton={false}
        >
          {/* Rider Marker */}
          {riderLocation && (
            <Marker coordinate={riderLocation} title="Rider's Location">
              <Image source={riderIcon} style={{ width: 35, height: 50 }} />
            </Marker>
          )}

          {/* Pickup Marker */}
          <Marker coordinate={pickupCoords} title="Pickup Location">
            <Image source={pickupMarker} style={{ width: 35, height: 50 }} />
          </Marker>

          {/* Dropoff Marker */}
          <Marker coordinate={dropoffCoords} title="Dropoff Location">
            <Image source={dropoffMarker} style={{ width: 35, height: 50 }} />
          </Marker>

          {/* Path */}
          {pathCoordinates.length > 1 && (
            <Polyline
              coordinates={pathCoordinates}
              strokeWidth={3}
              strokeColor="gray"
              lineDashPattern={[2, 8]}
            />
          )}
        </MapView>

        {/* "Center on Rider" button at top-right */}
        <TouchableOpacity style={styles.centerButton} onPress={handleCenterOnRider}>
          <Ionicons name="locate" size={24} color="#fff" />
        </TouchableOpacity>
      </Animated.View>

      {/* BOTTOM CONTAINER */}
      <View style={styles.bottomContainer}>
        <Text
          style={[
            styles.statusText,
            isTripStarted && styles.tripStartedHighlight,
          ]}
        >
          {statusText}
        </Text>

        {eta > 0 && (
          <Text style={styles.etaText}>
            Estimated arrival in {eta.toFixed(0)} min
          </Text>
        )}

        {/* Rider Card area */}
        {riderId && (
          <View style={styles.riderCard}>
            <View style={styles.riderCardLeft}>
              <Image source={riderIcon} style={styles.riderImage} />
              <View>
                <Text style={styles.riderName}>{riderInfo.riderName}</Text>
                <Text style={styles.riderLabel}>Delivery Partner</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.callButton}
              onPress={() => {
                if (riderInfo.contactNumber !== "No contact") {
                  Linking.openURL(`tel:${riderInfo.contactNumber}`).catch(() =>
                    Alert.alert("Error", "Unable to make the call.")
                  );
                } else {
                  Alert.alert("Unavailable", "No contact number available.");
                }
              }}
            >
              <Ionicons name="call-outline" size={20} color="#fff" />
              <Text style={styles.callButtonText}>Call</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Show order details if doc has items */}
        {orderDoc && orderDoc.items && orderDoc.items.length > 0 && (
          <View style={styles.orderDetails}>
            <Text style={styles.orderDetailsHeader}>Order Details</Text>

            {/* Make the list scrollable within the container */}
            <ScrollView style={styles.itemsScrollContainer}>
              {orderDoc.items.map((item: OrderItem, idx: number) => {
                const finalPrice = item.discount ? item.price - item.discount : item.price;
                return (
                  <View style={styles.orderItemRow} key={`item-${idx}`}>
                    <Text style={styles.orderItemName}>{item.name}</Text>
                    <Text style={styles.orderItemQty}>x{item.quantity}</Text>
                    <Text style={styles.orderItemPrice}>
                      ₹{finalPrice.toFixed(2)}
                    </Text>
                  </View>
                );
              })}

              {/* PRICE BREAKDOWN (like in OrderAllocatingScreen) */}
              <View style={styles.billSummaryContainer}>
                {/* Subtotal */}
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Subtotal</Text>
                  <Text style={styles.billValue}>
                    ₹{orderDoc.subtotal?.toFixed(2) || "0.00"}
                  </Text>
                </View>

                {/* Delivery Charge */}
                {typeof orderDoc.deliveryCharge !== "undefined" && (
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Delivery Charge</Text>
                    <Text style={styles.billValue}>
                      ₹{(orderDoc.deliveryCharge || 0).toFixed(2)}
                    </Text>
                  </View>
                )}

                {/* CGST */}
                {typeof orderDoc.cgst !== "undefined" && (
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>CGST</Text>
                    <Text style={styles.billValue}>
                      ₹{(orderDoc.cgst || 0).toFixed(2)}
                    </Text>
                  </View>
                )}

                {/* SGST */}
                {typeof orderDoc.sgst !== "undefined" && (
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>SGST</Text>
                    <Text style={styles.billValue}>
                      ₹{(orderDoc.sgst || 0).toFixed(2)}
                    </Text>
                  </View>
                )}

                {/* Platform Fee */}
                {typeof orderDoc.platformFee !== "undefined" && (
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Platform Fee</Text>
                    <Text style={styles.billValue}>
                      ₹{(orderDoc.platformFee || 0).toFixed(2)}
                    </Text>
                  </View>
                )}

                {/* Discount */}
                {typeof orderDoc.discount !== "undefined" && (
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Discount</Text>
                    <Text style={styles.billValue}>
                      -₹{(orderDoc.discount || 0).toFixed(2)}
                    </Text>
                  </View>
                )}

                {/* Final Total */}
                <View style={styles.billRow}>
                  <Text style={[styles.billLabel, { fontWeight: "700" }]}>
                    Total
                  </Text>
                  <Text style={[styles.billValue, { fontWeight: "700" }]}>
                    ₹{orderDoc.finalTotal?.toFixed(2) || "0.00"}
                  </Text>
                </View>
              </View>
            </ScrollView>
          </View>
        )}
      </View>
    </View>
  );
};

export default OrderTrackingScreen;

// ------------------ STYLES ------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  centerButton: {
    position: "absolute",
    top: 40,
    right: 20,
    backgroundColor: "#2196F3",
    padding: 12,
    borderRadius: 50,
    elevation: 5,
    flexDirection: "row",
    alignItems: "center",
  },

  bottomContainer: {
    backgroundColor: "#fff",
    padding: 16,
    borderTopRightRadius: 12,
    borderTopLeftRadius: 12,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: -2 },
    maxHeight: "50%", // allow scrolling for longer orders
  },
  statusText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    textAlign: "center",
  },
  tripStartedHighlight: {
    color: "#e67e22",
    fontSize: 18,
    fontWeight: "bold",
  },
  etaText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginTop: 4,
  },

  // Rider Card
  riderCard: {
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  riderCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  riderImage: {
    width: 40,
    height: 40,
    marginRight: 10,
  },
  riderName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
  },
  riderLabel: {
    fontSize: 12,
    color: "#666",
  },
  callButton: {
    backgroundColor: "#2196F3",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  callButtonText: {
    color: "#fff",
    marginLeft: 5,
    fontSize: 14,
    fontWeight: "600",
  },

  // Order details
  orderDetails: {
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    flex: 1,
  },
  orderDetailsHeader: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
    marginBottom: 8,
    textAlign: "center",
  },
  itemsScrollContainer: {
    maxHeight: 150,
    marginBottom: 10,
  },
  orderItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  orderItemName: {
    fontSize: 13,
    color: "#333",
    flex: 2,
  },
  orderItemQty: {
    fontSize: 13,
    color: "#666",
    flex: 1,
    textAlign: "center",
  },
  orderItemPrice: {
    fontSize: 13,
    color: "#333",
    flex: 1,
    textAlign: "right",
  },
  billSummaryContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
  },
  billRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  billLabel: {
    fontSize: 13,
    color: "#333",
  },
  billValue: {
    fontSize: 13,
    color: "#333",
  },

  // Loader
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loaderText: {
    marginTop: 10,
    fontSize: 16,
    color: "#555",
  },
});
