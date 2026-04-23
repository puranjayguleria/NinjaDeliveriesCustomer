// OrderTrackingScreen.tsx
import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Linking,
  Alert,
  Animated,
  ScrollView,
  PanResponder,
  Dimensions,
} from "react-native";

import firestore from "@react-native-firebase/firestore";
import MapView, { Marker, Polyline, LatLng } from "react-native-maps";
import { useRoute, RouteProp, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useOrder } from "../../context/OrderContext";

import riderIcon from "../../assets/rider-icon-1.png";
import pickupMarker from "../../assets/pickup-marker.png";
import dropoffMarker from "../../assets/dropoff-marker.png";
import Loader from "@/components/VideoLoader";

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
  CGST: number;
  SGST: number;
}

const TRACKING_MAP_STYLE = [
  {
    elementType: "geometry",
    stylers: [{ color: "#eef4fb" }],
  },
  {
    elementType: "labels.text.fill",
    stylers: [{ color: "#4b5563" }],
  },
  {
    elementType: "labels.text.stroke",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "administrative",
    elementType: "geometry.stroke",
    stylers: [{ color: "#dbe4f0" }],
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
    stylers: [{ color: "#d7e1ef" }],
  },
  {
    featureType: "road.arterial",
    elementType: "geometry",
    stylers: [{ color: "#fdfefe" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#dce9fb" }],
  },
  {
    featureType: "transit",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#cfe8ff" }],
  },
];

const TRACKING_STEPS = [
  { key: "accepted", label: "Accepted", icon: "checkmark-circle" as const },
  { key: "reachedPickup", label: "Reached Pickup", icon: "storefront" as const },
  { key: "tripStarted", label: "On The Way", icon: "bicycle" as const },
  { key: "tripEnded", label: "Delivered", icon: "home" as const },
];
const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// ------------------ COMPONENT ------------------
const OrderTrackingScreen: React.FC = () => {
  const route = useRoute<OrderTrackingScreenRouteProp>();
  const { orderId, dropoffCoords, pickupCoords } = route.params;
  const navigation = useNavigation();
  const { setActiveOrder } = useOrder();

  // Rider + Order
  const [riderLocation, setRiderLocation] = useState<LatLng | null>(null);
  const [riderInfo, setRiderInfo] = useState({
    riderName: "",
    contactNumber: "",
  });
  const [riderId, setRiderId] = useState<string | null>(null);
  const [orderDoc, setOrderDoc] = useState<any>(null); // entire doc (items, finalTotal, etc.)

  // UI + Status
  const [orderStatus, setOrderStatus] = useState<string>("pending");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [eta, setEta] = useState<number>(0);
  const [pathCoordinates, setPathCoordinates] = useState<LatLng[]>([]);
  const [isMapReady, setIsMapReady] = useState<boolean>(false);
  const [animatedRiderLocation, setAnimatedRiderLocation] = useState<LatLng | null>(
    null
  );

  // For the map
  const mapRef = useRef<MapView | null>(null);
  const mapOpacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const animatedRiderRef = useRef<LatLng | null>(null);
  const riderAnimationFrameRef = useRef<number | null>(null);
  const maxSheetHeight = SCREEN_HEIGHT - Math.max(insets.top, 10) - 88;
  const midSheetHeight = SCREEN_HEIGHT * 0.52;
  const minSheetHeight = SCREEN_HEIGHT * 0.38;
  const sheetHeight = useRef(new Animated.Value(midSheetHeight)).current;
  const sheetHeightRef = useRef(midSheetHeight);
  const sheetDragStartHeight = useRef(midSheetHeight);

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

  const getStepIndex = (status: string): number => {
    return TRACKING_STEPS.findIndex((step) => step.key === status);
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

  const cancelRiderAnimation = () => {
    if (riderAnimationFrameRef.current !== null) {
      cancelAnimationFrame(riderAnimationFrameRef.current);
      riderAnimationFrameRef.current = null;
    }
  };

  const updateAnimatedRiderLocation = (coords: LatLng) => {
    animatedRiderRef.current = coords;
    setAnimatedRiderLocation(coords);
  };

  const animateRiderLocation = (nextLocation: LatLng) => {
    const startLocation = animatedRiderRef.current;

    if (!startLocation) {
      updateAnimatedRiderLocation(nextLocation);
      return;
    }

    cancelRiderAnimation();

    const animationDuration = 700;
    let startTime: number | null = null;

    const animateFrame = (timestamp: number) => {
      if (startTime === null) {
        startTime = timestamp;
      }

      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / animationDuration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);

      updateAnimatedRiderLocation({
        latitude:
          startLocation.latitude +
          (nextLocation.latitude - startLocation.latitude) * easedProgress,
        longitude:
          startLocation.longitude +
          (nextLocation.longitude - startLocation.longitude) * easedProgress,
      });

      if (progress < 1) {
        riderAnimationFrameRef.current = requestAnimationFrame(animateFrame);
      } else {
        riderAnimationFrameRef.current = null;
      }
    };

    riderAnimationFrameRef.current = requestAnimationFrame(animateFrame);
  };

  // ------------------ EFFECTS ------------------
  useEffect(() => {
    // Reset on new order
    cancelRiderAnimation();
    setRiderLocation(null);
    setAnimatedRiderLocation(null);
    animatedRiderRef.current = null;
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
        const riderRef = firestore()
          .collection("riderDetails")
          .doc(data.acceptedBy);

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
              animateRiderLocation(newLocation);

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

  useEffect(() => {
    return () => {
      cancelRiderAnimation();
    };
  }, []);

  useEffect(() => {
    const clampedHeight = Math.max(
      minSheetHeight,
      Math.min(maxSheetHeight, sheetHeightRef.current)
    );
    sheetHeightRef.current = clampedHeight;
    sheetHeight.setValue(clampedHeight);
  }, [minSheetHeight, maxSheetHeight, sheetHeight]);

  // If riderLocation changes => fit map
  useEffect(() => {
    if (riderLocation && isMapReady && mapRef.current) {
      fitMapToMarkers([pickupCoords, riderLocation, dropoffCoords]);
    }
  }, [riderLocation, isMapReady, pickupCoords, dropoffCoords]);

  // Check if ended => go Rating
  useEffect(() => {
    if (
      orderStatus === "tripEnded" &&
      !hasNavigatedToRatingRef.current &&
      riderId
    ) {
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
        edgePadding: { top: 140, right: 70, bottom: 280, left: 70 },
        animated: true,
      });
    }
  };

  const handleCenterOnRider = () => {
    const liveRiderLocation = animatedRiderLocation || riderLocation;
    if (liveRiderLocation && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          ...liveRiderLocation,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        },
        500
      );
    }
  };

  const handleBackPress = () => {
    if ((navigation as any).canGoBack?.()) {
      navigation.goBack();
      return;
    }
    navigation.navigate("HomeTab" as never, { screen: "ProductsHome" } as never);
  };

  const snapSheetTo = (target: number) => {
    const clampedTarget = Math.max(minSheetHeight, Math.min(maxSheetHeight, target));
    sheetHeightRef.current = clampedTarget;
    Animated.spring(sheetHeight, {
      toValue: clampedTarget,
      useNativeDriver: false,
      speed: 18,
      bounciness: 0,
    }).start();
  };

  const toggleSheet = () => {
    const expandedThreshold = (midSheetHeight + maxSheetHeight) / 2;
    const shouldExpand = sheetHeightRef.current < expandedThreshold;
    snapSheetTo(shouldExpand ? maxSheetHeight : minSheetHeight);
  };

  const sheetPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 4,
      onPanResponderGrant: () => {
        sheetDragStartHeight.current = sheetHeightRef.current;
      },
      onPanResponderMove: (_, gestureState) => {
        const nextHeight = sheetDragStartHeight.current - gestureState.dy;
        const clampedHeight = Math.max(
          minSheetHeight,
          Math.min(maxSheetHeight, nextHeight)
        );
        sheetHeightRef.current = clampedHeight;
        sheetHeight.setValue(clampedHeight);
      },
      onPanResponderRelease: () => {
        const snapPoints = [minSheetHeight, midSheetHeight, maxSheetHeight];
        const nearestSnap = snapPoints.reduce((prev, curr) =>
          Math.abs(curr - sheetHeightRef.current) < Math.abs(prev - sheetHeightRef.current)
            ? curr
            : prev
        );
        snapSheetTo(nearestSnap);
      },
      onPanResponderTerminate: () => {
        snapSheetTo(sheetHeightRef.current);
      },
    })
  ).current;

  // ------------------ RENDER ------------------
  if (isLoading) {
    return (
      <View style={styles.loaderContainer}>
        <Loader />
      </View>
    );
  }

  // Determine final display text. If "tripStarted", apply extra highlight
  const statusText = getFriendlyStatus(orderStatus);
  const isTripStarted = orderStatus === "tripStarted";
  const liveRiderLocation = animatedRiderLocation || riderLocation;
  const displayPathCoordinates = liveRiderLocation
    ? [pickupCoords, liveRiderLocation, dropoffCoords]
    : pathCoordinates;
  const currentStepIndex = getStepIndex(orderStatus);
  const completedStepCount = currentStepIndex >= 0 ? currentStepIndex + 1 : 0;
  return (
    <View style={styles.container}>
      {/* HEADER WITH BACK BUTTON - Prevent notch overlap */}
      <View style={[styles.headerContainer, { paddingTop: Math.max(insets.top, 10) }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackPress}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order Tracking</Text>
          <View style={{ width: 40 }} /> 
        </View>
      </View>

      {/* MAP */}
      <Animated.View style={[styles.mapContainer, { opacity: mapOpacity }]}>
        <MapView
          ref={mapRef}
          style={styles.map}
          customMapStyle={TRACKING_MAP_STYLE}
          onMapReady={() => {
            setIsMapReady(true);
            Animated.timing(mapOpacity, {
              toValue: 1,
              duration: 450,
              useNativeDriver: true,
            }).start();
          }}
          showsUserLocation
          showsMyLocationButton={false}
          toolbarEnabled={false}
          showsCompass={false}
          showsBuildings={false}
          showsIndoors={false}
          zoomEnabled
          rotateEnabled={false}
          pitchEnabled={false}
        >
          {/* Rider Marker */}
          {liveRiderLocation && (
            <Marker coordinate={liveRiderLocation} title="Rider's Location">
              <View style={styles.riderMarkerContainer}>
                <View style={styles.riderMarkerHalo} />
                <View style={styles.riderMarkerBadge}>
                  <Image source={riderIcon} style={styles.riderMarkerImage} />
                </View>
              </View>
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
          {displayPathCoordinates.length > 1 && (
            <>
              <Polyline
                coordinates={displayPathCoordinates}
                strokeWidth={10}
                strokeColor="rgba(14, 116, 144, 0.18)"
              />
              <Polyline
                coordinates={displayPathCoordinates}
                strokeWidth={5}
                strokeColor="#0F766E"
              />
            </>
          )}
        </MapView>

        {/* "Center on Rider" button at top-right */}
        <TouchableOpacity
          style={styles.centerButton}
          onPress={handleCenterOnRider}
        >
          <Ionicons name="locate" size={20} color="#0f172a" />
        </TouchableOpacity>
      </Animated.View>

      {/* BOTTOM CONTAINER */}
      <Animated.View style={[styles.bottomContainer, { height: sheetHeight }]}>
        <View {...sheetPanResponder.panHandlers}>
          <TouchableOpacity style={styles.sheetHandlePressable} onPress={toggleSheet}>
            <View style={styles.sheetHandle} />
            <Ionicons name="chevron-up" size={16} color="#64748b" />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.bottomScrollContent,
            { paddingBottom: Math.max(insets.bottom, 10) + 16 },
          ]}
        >
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

          <View style={styles.progressCard}>
            <View style={styles.progressHeaderRow}>
              <Text style={styles.progressTitle}>Delivery Progress</Text>
              <Text style={styles.progressSummary}>{completedStepCount}/4</Text>
            </View>
            <View style={styles.progressStepsRow}>
              {TRACKING_STEPS.map((step, index) => {
                const isCompleted = currentStepIndex >= index;
                const isCurrent = currentStepIndex === index;
                return (
                  <View key={step.key} style={styles.progressStep}>
                    <View
                      style={[
                        styles.progressStepIcon,
                        isCompleted && styles.progressStepIconCompleted,
                        isCurrent && styles.progressStepIconCurrent,
                      ]}
                    >
                      <Ionicons
                        name={step.icon}
                        size={16}
                        color={isCompleted ? "#ffffff" : "#64748b"}
                      />
                    </View>
                    <Text
                      style={[
                        styles.progressStepLabel,
                        isCompleted && styles.progressStepLabelCompleted,
                      ]}
                    >
                      {step.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

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
              <View style={styles.itemsScrollContainer}>
                {orderDoc.items.map((item: OrderItem, idx: number) => {
                  const price = Number(item.price) || 0;
                  const discount = Number(item.discount) || 0;
                  const cgst = Number(item.CGST) || 0;
                  const sgst = Number(item.SGST) || 0;

                  const basePrice = price - discount;
                  const realPrice = basePrice + cgst + sgst;

                  return (
                    <View style={styles.orderItemRow} key={`item-${idx}`}>
                      <Text style={styles.orderItemName}>{item.name}</Text>
                      <Text style={styles.orderItemQty}>x{item.quantity}</Text>
                      <Text style={styles.orderItemPrice}>
                        ₹{realPrice.toFixed(2)}
                      </Text>
                    </View>
                  );
                })}

                <View style={styles.billSummaryContainer}>
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Subtotal</Text>
                    <Text style={styles.billValue}>
                      ₹
                      {(
                        (orderDoc.subtotal || 0) +
                        (orderDoc.productCgst || 0) +
                        (orderDoc.productSgst || 0)
                      ).toFixed(2)}
                    </Text>
                  </View>

                  {typeof orderDoc.deliveryCharge !== "undefined" && (
                    <View style={styles.billRow}>
                      <Text style={styles.billLabel}>Delivery Charge</Text>
                      <Text style={styles.billValue}>
                        ₹
                        {(
                          (orderDoc.deliveryCharge || 0) +
                          (orderDoc.rideCgst || 0) +
                          (orderDoc.rideSgst || 0)
                        ).toFixed(2)}
                      </Text>
                    </View>
                  )}

                  {typeof orderDoc.convenienceFee !== "undefined" && (
                    <View style={styles.billRow}>
                      <Text style={styles.billLabel}>Convenience Fee</Text>
                      <Text style={styles.billValue}>
                        ₹{(orderDoc.convenienceFee || 0).toFixed(2)}
                      </Text>
                    </View>
                  )}
                  {typeof orderDoc.surgeFee !== "undefined" && (
                    <View style={styles.billRow}>
                      <Text style={styles.billLabel}>Surge Fee</Text>
                      <Text style={styles.billValue}>
                        ₹{(orderDoc.surgeFee || 0).toFixed(2)}
                      </Text>
                    </View>
                  )}
                  {typeof orderDoc.platformFee !== "undefined" && (
                    <View style={styles.billRow}>
                      <Text style={styles.billLabel}>Platform Fee</Text>
                      <Text style={styles.billValue}>
                        ₹{(orderDoc.platformFee || 0).toFixed(2)}
                      </Text>
                    </View>
                  )}

                  {typeof orderDoc.discount !== "undefined" && (
                    <View style={styles.billRow}>
                      <Text style={styles.billLabel}>Discount</Text>
                      <Text style={styles.billValue}>
                        -₹{(orderDoc.discount || 0).toFixed(2)}
                      </Text>
                    </View>
                  )}
                  <View style={styles.billRow}>
                    <Text style={[styles.billLabel, { fontWeight: "700" }]}>
                      Total
                    </Text>
                    <Text style={[styles.billValue, { fontWeight: "700" }]}>
                      ₹{orderDoc.finalTotal?.toFixed(2) || "0.00"}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
};

export default OrderTrackingScreen;

// ------------------ STYLES ------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#eef2f7",
  },
  mapContainer: {
    height: "47%",
    marginHorizontal: 14,
    marginTop: 10,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#dbeafe",
    shadowColor: "#0f172a",
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  headerContainer: {
    backgroundColor: "#eef2f7",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 8,
    backgroundColor: "#eef2f7",
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
    backgroundColor: "#ffffff",
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    flex: 1,
    textAlign: "center",
  },
  riderMarkerContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  riderMarkerHalo: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(15, 118, 110, 0.18)",
  },
  riderMarkerBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0f172a",
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  riderMarkerImage: {
    width: 24,
    height: 32,
    resizeMode: "contain",
  },
  centerButton: {
    position: "absolute",
    top: 24,
    right: 16,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  bottomContainer: {
    backgroundColor: "#fff",
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 0,
    borderTopRightRadius: 24,
    borderTopLeftRadius: 24,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 8,
    shadowColor: "#0f172a",
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
    minHeight: 260,
  },
  bottomScrollContent: {
    paddingTop: 2,
  },
  sheetHandlePressable: {
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    width: 90,
    paddingTop: 4,
    paddingBottom: 6,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#cbd5e1",
    marginBottom: 2,
  },
  statusText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
  },
  tripStartedHighlight: {
    color: "#0f766e",
    fontSize: 18,
    fontWeight: "bold",
  },
  etaText: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    marginTop: 4,
  },
  progressCard: {
    marginTop: 14,
    backgroundColor: "#f8fafc",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  progressHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
    paddingHorizontal: 2,
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
  progressStepIconCompleted: {
    backgroundColor: "#0f766e",
  },
  progressStepIconCurrent: {
    shadowColor: "#0f766e",
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  progressStepLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
    textAlign: "center",
  },
  progressStepLabelCompleted: {
    color: "#0f172a",
  },

  // Rider Card
  riderCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    padding: 14,
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOpacity: 0.04,
    shadowRadius: 6,
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
    resizeMode: "contain",
  },
  riderName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  riderLabel: {
    fontSize: 12,
    color: "#64748b",
  },
  callButton: {
    backgroundColor: "#0f766e",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  callButtonText: {
    color: "#fff",
    marginLeft: 5,
    fontSize: 14,
    fontWeight: "600",
  },

  // Order details
  orderDetails: {
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  orderDetailsHeader: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 10,
    textAlign: "left",
  },
  itemsScrollContainer: {
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
    color: "#0f172a",
    flex: 2,
  },
  orderItemQty: {
    fontSize: 13,
    color: "#64748b",
    flex: 1,
    textAlign: "center",
  },
  orderItemPrice: {
    fontSize: 13,
    color: "#0f172a",
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
    color: "#334155",
  },
  billValue: {
    fontSize: 13,
    color: "#0f172a",
  },

  // Loader
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
  },
  loaderText: {
    marginTop: 10,
    fontSize: 16,
    color: "#555",
  },
});
