import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Image, TouchableOpacity, Linking, Alert } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import MapView, { Marker, Polyline, LatLng } from 'react-native-maps';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';

import pickupMarker from '../assets/pickup-marker.png';
import dropoffMarker from '../assets/dropoff-marker.png';
import riderIcon from '../assets/rider-icon-1.png';

type OrderTrackingScreenRouteProp = RouteProp<{ params: { orderId: string; dropoffCoords: LatLng; pickupCoords: LatLng; totalCost: number } }, 'params'>;

const OrderTrackingScreen: React.FC = () => {
  const route = useRoute<OrderTrackingScreenRouteProp>();
  const { orderId, dropoffCoords, pickupCoords, totalCost } = route.params;
  const navigation = useNavigation();

  const [riderLocation, setRiderLocation] = useState<LatLng | null>(null);
  const [riderInfo, setRiderInfo] = useState({ riderName: '', contactNumber: '' });
  const [eta, setEta] = useState<number>(0);
  const [riderId, setRiderId] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [orderStatus, setOrderStatus] = useState<string>('pending');
  const [pathCoordinates, setPathCoordinates] = useState<LatLng[]>([]);

  const mapRef = useRef<MapView | null>(null);
  const [isMapReady, setIsMapReady] = useState<boolean>(false);

  const GOOGLE_MAPS_APIKEY = "AIzaSyBqYwT_2hMwG1SrcLygclXsJmJc--QjDFg";

  useEffect(() => {
    setRiderLocation(null);
    setPathCoordinates([]);
    setIsLoading(true);
  }, [orderId]);

  useEffect(() => {
    const fetchOrderAndRiderData = async () => {
      try {
        const orderRef = firestore().collection('orders').doc(orderId);

        const unsubscribeOrder = orderRef.onSnapshot(async (orderDoc) => {
          const orderData = orderDoc.data();
          if (orderData) {
            setOrderStatus(orderData.status);

            if (orderData.acceptedBy) {
              const riderId = orderData.acceptedBy;
              setRiderId(riderId);
              const riderRef = firestore().collection('riderDetails').doc(riderId);

              const unsubscribeRider = riderRef.onSnapshot(async (riderDoc) => {
                const riderData = riderDoc.data();
                if (riderData) {
                  setRiderInfo({
                    riderName: riderData?.name || 'Unknown',
                    contactNumber: riderData?.contactNumber || 'No contact',
                  });

                  const location = riderData.location;
                  if (location) {
                    setRiderLocation({ latitude: location.latitude, longitude: location.longitude });

                    const targetCoords = orderData.status === 'tripStarted' ? dropoffCoords : pickupCoords;

                    const distance = calculateDistance(location, targetCoords);
                    const etaMinutes = (distance / 30) * 60;
                    setEta(etaMinutes);

                    if (orderData.status === 'tripStarted') {
                      await fetchRoute(location, dropoffCoords);
                    }

                    setIsLoading(false);
                  } else {
                    setIsLoading(false);
                  }
                } else {
                  setIsLoading(false);
                }
              });

              return () => unsubscribeRider();
            } else {
              setIsLoading(false);
            }
          } else {
            setIsLoading(false);
          }
        });

        return () => unsubscribeOrder();
      } catch (error) {
        setIsLoading(false);
      }
    };

    fetchOrderAndRiderData();
  }, [orderId, pickupCoords, dropoffCoords]);

  useEffect(() => {
    if (riderLocation && isMapReady && mapRef.current) {
      fitMapToMarkers([riderLocation, pickupCoords, dropoffCoords]);
    }
  }, [riderLocation, pickupCoords, dropoffCoords, isMapReady]);

  const fetchRoute = async (origin: LatLng, destination: LatLng) => {
    try {
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude}&key=${GOOGLE_MAPS_APIKEY}`
      );
      console.log(response)
      if (response.data.routes.length > 0) {
        const points = decodePolyline(response.data.routes[0].overview_polyline.points);
        setPathCoordinates(points);
      } else {
        console.log('No route found in the response.');
      }
    } catch (error) {
      console.error('Error fetching route:', error);
    }
  };

  const decodePolyline = (encoded: string): LatLng[] => {
    let points: LatLng[] = [];
    let index = 0, len = encoded.length;
    let lat = 0, lng = 0;

    while (index < len) {
      let b, shift = 0, result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }

    return points;
  };

  const calculateDistance = (start: LatLng, end: LatLng): number => {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(end.latitude - start.latitude);
    const dLon = toRad(end.longitude - start.longitude);
    const lat1 = toRad(start.latitude);
    const lat2 = toRad(end.latitude);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance;
  };

  const fitMapToMarkers = (markers: LatLng[]) => {
    if (mapRef.current) {
      mapRef.current.fitToCoordinates(markers, {
        edgePadding: { top: 100, right: 100, bottom: 100, left: 100 },
        animated: true,
      });
    }
  };

  const handleCancelOrder = async () => {
    const refundAmount = totalCost - 25;
    await firestore().collection('orders').doc(orderId).update({
      status: 'cancelled',
      refundAmount: refundAmount,
    });
    Alert.alert('Order Cancelled', `₹${refundAmount} will be refunded.`);
    navigation.navigate('NewOrderCancelledScreen', { refundAmount });
  };

  useEffect(() => {
    if (orderStatus === 'tripEnded') {
      navigation.navigate('RatingScreen', { orderId, riderId });
    }
  }, [orderStatus]);

  if (isLoading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Loading order and rider details...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.orderStatusText}>Order is {orderStatus}</Text>
        <Text style={styles.etaText}>{eta.toFixed(0)} minutes</Text>
      </View>

      <MapView
        ref={mapRef}
        style={styles.map}
        onMapReady={() => setIsMapReady(true)}
      >
        {riderLocation && (
          <Marker
            coordinate={riderLocation}
            title="Rider's Location"
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <Image source={riderIcon} style={{ width: 35, height: 50 }} />
          </Marker>
        )}

        <Marker
          coordinate={pickupCoords}
          title="Pickup Location"
          anchor={{ x: 0.5, y: 1 }}
        >
          <Image source={pickupMarker} style={{ width: 40, height: 40 }} />
        </Marker>

        <Marker
          coordinate={dropoffCoords}
          title="Dropoff Location"
          anchor={{ x: 0.5, y: 1 }}
        >
          <Image source={dropoffMarker} style={{ width: 40, height: 40 }} />
        </Marker>

        {pathCoordinates.length > 0 && (
          <Polyline
            coordinates={pathCoordinates}
            strokeWidth={4}
            strokeColor="blue"
          />
        )}
      </MapView>

      {/* Rider Information Card styled similarly to Zomato */}
      <View style={[styles.riderCard, orderStatus !== 'accepted' && { bottom: 20 }]}>
        <View style={styles.riderCardContent}>
          <Image source={riderIcon} style={styles.riderImageLarge} />
          <View style={styles.riderDetails}>
            <Text style={styles.riderName}>{riderInfo.riderName}</Text>
            <Text style={styles.riderLabel}>Delivery Partner</Text>
            <Text style={styles.trackMessage}>Track your order on the map above or call if needed.</Text>
          </View>
          <View style={styles.contactActions}>
            <TouchableOpacity
              style={styles.contactButton}
              onPress={() => Linking.openURL(`tel:${riderInfo.contactNumber}`)}
            >
              <Ionicons name="call-outline" size={24} color="white" />
              <Text style={styles.contactButtonText}>Call</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Show cancel button only if order status is 'accepted' */}
      {orderStatus === 'accepted' && (
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancelOrder}>
          <Text style={styles.cancelButtonText}>Cancel Order</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#1E824C',
    padding: 15,
    paddingTop: 40,
    alignItems: 'center',
  },
  orderStatusText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  etaText: {
    fontSize: 16,
    color: '#fff',
  },
  map: {
    width: '100%',
    height: '60%',
  },
  riderCard: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    elevation: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  riderCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  riderImageLarge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  riderDetails: {
    flex: 1,
  },
  riderName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  riderLabel: {
    fontSize: 14,
    color: '#888',
  },
  trackMessage: {
    fontSize: 14,
    color: '#888',
    marginTop: 5,
  },
  contactActions: {
    flexDirection: 'row',
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  contactButtonText: {
    color: '#fff',
    marginLeft: 5,
    fontSize: 16,
  },
  cancelButton: {
    backgroundColor: 'red',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 20,
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default OrderTrackingScreen;
