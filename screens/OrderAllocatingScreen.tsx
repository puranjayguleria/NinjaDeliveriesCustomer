// OrderAllocatingScreen.tsx

import React, { useEffect, useState, useRef } from 'react';
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
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import firestore from '@react-native-firebase/firestore';

import riderIcon from '../assets/rider-icon-1.png';
import pickupMarker from '../assets/pickup-marker.png';
import dropoffMarker from '../assets/dropoff-marker.png';
import { useOrder } from '@/context/OrderContext';
import { Ionicons } from '@expo/vector-icons';

type StackParamList = {
  OrderAllocating: {
    orderId: string;
    pickupCoords: { latitude: number; longitude: number };
    dropoffCoords: { latitude: number; longitude: number };
    totalCost?: number;
  };
};

type OrderAllocatingScreenRouteProp = RouteProp<StackParamList, 'OrderAllocating'>;

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
    const orderRef = firestore().collection('orders').doc(orderId);

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
          status: 'active',
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

        // Navigate to OrderTracking
        navigation.navigate('OrderTracking', {
          orderId,
          pickupCoords,
          dropoffCoords,
          totalCost,
        });
      }

      // If the order was cancelled remotely (e.g. by Lambda or admin):
      if (data.status === 'cancelled' && !orderAccepted) {
        navigation.navigate('OrderCancelled', {
          orderId,
          refundAmount: data.refundAmount ?? totalCost,
        });
      }
    });

    // Fetch riders around
    const fetchNearbyRiders = async () => {
      try {
        const snapshot = await firestore()
          .collection('riderDetails')
          .where('isAvailable', '==', true)
          .get();

        const ridersList = snapshot.docs.map((doc) => doc.data());
        setNearbyRiders(ridersList);

        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching riders:', err);
        Alert.alert("Error", "Failed to fetch nearby riders.");
        setIsLoading(false);
      }
    };
    fetchNearbyRiders();

    // ----- REMOVED AUTO-CANCEL LOGIC -----
    // (We rely on the Lambda or other backend services to cancel the order if needed.)

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
    try {
      const orderRef = firestore().collection('orders').doc(orderId);
      const snap = await orderRef.get();
      if (!snap.exists) {
        Alert.alert('Error', 'Order not found. Please contact support.');
        return;
      }
      const data = snap.data();
      const existingCost = data?.finalTotal || 0;
      const refundAmount = existingCost;

      // Mark as cancelled
      await orderRef.update({
        status: 'cancelled',
        refundAmount,
      });

      // (Optional) Clear from context
      setActiveOrder?.(null);

      Alert.alert(
        'Order Cancelled',
        `Your order has been cancelled.`,
        [
          {
            text: 'OK',
            onPress: () =>
              navigation.navigate('OrderCancelled', { orderId, refundAmount }),
          },
        ]
      );
    } catch (error) {
      console.error('Error cancelling the order:', error);
      Alert.alert("Error", "Failed to cancel the order.");
    }
  };

  // --------------------------------------------------
  // OTHER HANDLERS
  // --------------------------------------------------
  const handleForgotItemsLink = () => {
    navigation.navigate('Home');
  };

  const handleClose = () => {
    // Example: go back to CartFlow or wherever you want
    navigation.dispatch(
      navigation.navigate({
        name: 'CartFlow',
        params: { screen: 'CartHome' },
      })
    );
  };

  // --------------------------------------------------
  // RENDER ORDER ITEMS
  // --------------------------------------------------
  const renderOrderItem = ({ item }: { item: OrderItem }) => {
    const realPrice = item.discount ? item.price - item.discount : item.price;
    return (
      <View style={styles.orderItemRow}>
        <Text style={styles.orderItemName}>{item.name}</Text>
        <Text style={styles.orderItemQuantity}>x{item.quantity}</Text>
        <Text style={styles.orderItemPrice}>₹{realPrice.toFixed(2)}</Text>
      </View>
    );
  };

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------
  return (
    <View style={styles.container}>
      {/* Close Button (top-right) */}
      <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
        <Ionicons name="close" size={24} color="#e74c3c" />
      </TouchableOpacity>

      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#28a745" />
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
                  mapRef.current?.fitToCoordinates([pickupCoords, dropoffCoords], {
                    edgePadding: { top: 100, right: 100, bottom: 100, left: 100 },
                    animated: true,
                  });
                }}
                onRegionChangeComplete={(newReg) => setRegion(newReg)}
                onError={(error) => {
                  console.error('MapView Error:', error);
                  Alert.alert("Error", "Failed to load the map.");
                }}
              >
                {/* Pickup Marker */}
                <Marker coordinate={pickupCoords} title="Pickup Location">
                  <Image
                    source={pickupMarker}
                    style={{
                      width: 40,
                      height: 40,
                      transform: [{ scale: markerAnimation }],
                    }}
                  />
                </Marker>

                {/* Dropoff Marker */}
                <Marker coordinate={dropoffCoords} title="Dropoff Location">
                  <Image
                    source={dropoffMarker}
                    style={{
                      width: 40,
                      height: 40,
                      transform: [{ scale: markerAnimation }],
                    }}
                  />
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
                    <Image
                      source={riderIcon}
                      style={{
                        width: 30,
                        height: 40,
                        transform: [{ scale: markerAnimation }],
                      }}
                    />
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
            {(orderData?.status === 'pending' || orderData?.status === 'accepted') &&
              !orderAccepted && (
                <TouchableOpacity style={styles.cancelButton} onPress={cancelOrder}>
                  <Text style={styles.cancelButtonText}>Cancel Order</Text>
                </TouchableOpacity>
              )}

            {/* Order Details Card */}
            {orderData && orderData.items && orderData.items.length > 0 && (
              <View style={styles.orderDetailsCard}>
                <Text style={styles.orderDetailsHeader}>Order Details</Text>

                <FlatList
                  data={orderData.items}
                  keyExtractor={(item, index) => `${item.name}-${index}`}
                  renderItem={renderOrderItem}
                  ItemSeparatorComponent={() => <View style={styles.separator} />}
                />

                {/* PRICE BREAKDOWN */}
                <View style={styles.billSummaryContainer}>
                  {/* Subtotal */}
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Subtotal</Text>
                    <Text style={styles.billValue}>
                      ₹{orderData.subtotal?.toFixed(2) || '0.00'}
                    </Text>
                  </View>

                  {/* Delivery Charge */}
                  {typeof orderData.deliveryCharge !== 'undefined' && (
                    <View style={styles.billRow}>
                      <Text style={styles.billLabel}>Delivery Charge</Text>
                      <Text style={styles.billValue}>
                        ₹{(orderData.deliveryCharge || 0).toFixed(2)}
                      </Text>
                    </View>
                  )}

                  {/* CGST */}
                  {typeof orderData.cgst !== 'undefined' && (
                    <View style={styles.billRow}>
                      <Text style={styles.billLabel}>CGST</Text>
                      <Text style={styles.billValue}>
                        ₹{(orderData.cgst || 0).toFixed(2)}
                      </Text>
                    </View>
                  )}

                  {/* SGST */}
                  {typeof orderData.sgst !== 'undefined' && (
                    <View style={styles.billRow}>
                      <Text style={styles.billLabel}>SGST</Text>
                      <Text style={styles.billValue}>
                        ₹{(orderData.sgst || 0).toFixed(2)}
                      </Text>
                    </View>
                  )}

                  {/* Platform Fee */}
                  {typeof orderData.platformFee !== 'undefined' && (
                    <View style={styles.billRow}>
                      <Text style={styles.billLabel}>Platform Fee</Text>
                      <Text style={styles.billValue}>
                        ₹{(orderData.platformFee || 0).toFixed(2)}
                      </Text>
                    </View>
                  )}

                  {/* Discount */}
                  {typeof orderData.discount !== 'undefined' && (
                    <View style={styles.billRow}>
                      <Text style={styles.billLabel}>Discount</Text>
                      <Text style={styles.billValue}>
                        -₹{(orderData.discount || 0).toFixed(2)}
                      </Text>
                    </View>
                  )}

                  {/* Final Total */}
                  <View style={styles.billRow}>
                    <Text style={[styles.billLabel, { fontWeight: '700' }]}>
                      Total
                    </Text>
                    <Text style={[styles.billValue, { fontWeight: '700' }]}>
                      ₹{orderData.finalTotal?.toFixed(2) || '0.00'}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
};

export default OrderAllocatingScreen;

// ---------------- STYLES ----------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 15,
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 20,
    padding: 6,
  },
  loaderContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  mapContainer: {
    flex: 1,
    backgroundColor: '#e1e1e1',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  bottomScroll: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '60%',
    backgroundColor: '#fff',
    borderTopRightRadius: 12,
    borderTopLeftRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: -2 },
  },
  bottomContainerContent: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  header: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
    color: '#333',
  },
  highlightText: {
    color: '#e67e22',
    fontSize: 20,
    fontWeight: 'bold',
  },
  quoteText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    color: '#666',
    marginBottom: 12,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
  },
  linkLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#444',
    marginRight: 5,
  },
  linkText: {
    fontSize: 14,
    color: '#3498db',
    textDecorationLine: 'underline',
  },
  cancelButton: {
    alignSelf: 'center',
    backgroundColor: '#e74c3c',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 5,
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  orderDetailsCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  orderDetailsHeader: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
    color: '#333',
    textAlign: 'center',
  },
  orderItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderItemName: {
    fontSize: 14,
    color: '#333',
    flex: 2,
  },
  orderItemQuantity: {
    fontSize: 14,
    color: '#555',
    flex: 1,
    textAlign: 'center',
  },
  orderItemPrice: {
    fontSize: 14,
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  separator: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 8,
  },
  billSummaryContainer: {
    marginTop: 20,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: '#ddd',
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  billLabel: {
    fontSize: 14,
    color: '#333',
  },
  billValue: {
    fontSize: 14,
    color: '#333',
  },
});
