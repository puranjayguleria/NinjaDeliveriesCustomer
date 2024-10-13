import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Image, TouchableOpacity, Linking } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import MapView, { Marker, Polyline, LatLng } from 'react-native-maps';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons'; // For icons

import pickupMarker from '../assets/pickup-marker.png';
import dropoffMarker from '../assets/dropoff-marker.png';
import riderIcon from '../assets/rider-icon-1.png';

type OrderTrackingScreenRouteProp = RouteProp<{ params: { orderId: string; dropoffCoords: LatLng; pickupCoords: LatLng } }, 'params'>;

const OrderTrackingScreen: React.FC = () => {
  const route = useRoute<OrderTrackingScreenRouteProp>();
  const { orderId, dropoffCoords, pickupCoords } = route.params;
  const navigation = useNavigation(); // For navigating to the next screen

  const [riderLocation, setRiderLocation] = useState<LatLng | null>(null);
  const [riderInfo, setRiderInfo] = useState({ riderName: '', contactNumber: '' });
  const [eta, setEta] = useState<number>(0);
  const [riderId, setRiderId] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [orderStatus, setOrderStatus] = useState<string>('pending');
  const [pathCoordinates, setPathCoordinates] = useState<LatLng[]>([]); // For route coordinates

  const mapRef = useRef<MapView | null>(null); // Ref for the MapView

  const GOOGLE_MAPS_APIKEY = "AIzaSyBqYwT_2hMwG1SrcLygclXsJmJc--QjDFg"; // The actual API key

  useEffect(() => {
    const fetchOrderAndRiderData = async () => {
      try {
        const orderRef = firestore().collection('orders').doc(orderId);

        // Subscribe to order status updates
        const unsubscribeOrder = orderRef.onSnapshot(async (orderDoc) => {
          const orderData = orderDoc.data();
          if (orderData) {
            setOrderStatus(orderData.status);

            if (orderData.acceptedBy) {
              const riderId = orderData.acceptedBy;
              setRiderId(riderId);
              const riderRef = firestore().collection('riderDetails').doc(riderId);

              // Subscribe to real-time updates for the rider's location
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

                    // Calculate ETA
                    const distance = calculateDistance(location, targetCoords);
                    const etaMinutes = (distance / 30) * 60; // Assume 30km/h average speed
                    setEta(etaMinutes);

                    // Fetch route if trip started
                    if (orderData.status === 'tripStarted') {
                      await fetchRoute(location, dropoffCoords);
                    }

                    // Adjust map region to fit all markers and polyline
                    fitMapToMarkers([location, pickupCoords, dropoffCoords]);

                    setIsLoading(false); // Data is fetched, stop showing the loader
                  } else {
                    setIsLoading(false);
                  }
                } else {
                  setIsLoading(false);
                }
              });

              return () => unsubscribeRider(); // Unsubscribe when component unmounts
            } else {
              setIsLoading(false);
            }
          } else {
            setIsLoading(false);
          }
        });

        return () => unsubscribeOrder(); // Unsubscribe from order status updates
      } catch (error) {
        setIsLoading(false);
      }
    };

    fetchOrderAndRiderData();
  }, [orderId, pickupCoords, dropoffCoords]);

  // Fetch the route from Google Directions API
  const fetchRoute = async (origin: LatLng, destination: LatLng) => {
    try {
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&key=${GOOGLE_MAPS_APIKEY}`
      );

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

  // Decode polyline from Google Directions API
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

  // Function to calculate distance between two coordinates using Haversine formula
  const calculateDistance = (start: LatLng, end: LatLng): number => {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const R = 6371; // Radius of the Earth in kilometers
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

  // Fit the map to show all markers and polyline route
  const fitMapToMarkers = (markers: LatLng[]) => {
    if (mapRef.current) {
      mapRef.current.fitToCoordinates(markers, {
        edgePadding: { top: 100, right: 100, bottom: 100, left: 100 },
        animated: true,
      });
    }
  };

  // Handle post-trip completion (e.g., display a rating screen)
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
      {/* Top Header with Status */}
      <View style={styles.header}>
        <Text style={styles.orderStatusText}>Order is {orderStatus}</Text>
        <Text style={styles.etaText}>{eta.toFixed(0)} minutes</Text>
      </View>

      {/* Map */}
      <MapView ref={mapRef} style={styles.map}>
        {/* Rider's current location */}
        {riderLocation && (
          <Marker
            coordinate={riderLocation}
            title="Rider's Location"
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <Image source={riderIcon} style={{ width: 35, height: 50 }} />
          </Marker>
        )}

        {/* Pickup Location */}
        <Marker
          coordinate={pickupCoords}
          title="Pickup Location"
          anchor={{ x: 0.5, y: 1 }}
        >
          <Image source={pickupMarker} style={{ width: 40, height: 40 }} />
        </Marker>

        {/* Dropoff Location */}
        <Marker
          coordinate={dropoffCoords}
          title="Dropoff Location"
          anchor={{ x: 0.5, y: 1 }}
        >
          <Image source={dropoffMarker} style={{ width: 40, height: 40 }} />
        </Marker>

        {/* Route Polyline */}
        {pathCoordinates.length > 0 && (
          <Polyline
            coordinates={pathCoordinates}
            strokeWidth={4}
            strokeColor="blue"
          />
        )}
      </MapView>

      {/* Bottom card with rider details */}
      <View style={styles.card}>
        <View style={styles.cardContent}>
          <Image source={riderIcon} style={styles.riderImage} />
          <View style={styles.riderInfo}>
            <Text style={styles.riderName}>{riderInfo.riderName}</Text>
          </View>
          <View style={styles.actions}>
            {/* Call Button */}
            <TouchableOpacity
              style={styles.callButton}
              onPress={() => Linking.openURL(`tel:${riderInfo.contactNumber}`)}
            >
              <Ionicons name="call-outline" size={24} color="white" />
              <Text style={styles.callButtonText}>Call</Text>
            </TouchableOpacity>

            {/* Chat Button
            <TouchableOpacity style={styles.chatButton}>
              <Ionicons name="chatbubbles-outline" size={24} color="white" />
              <Text style={styles.chatButtonText}>Chat</Text>
            </TouchableOpacity> */}
          </View>
        </View>
      </View>
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
  card: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 50,
    // borderTopLeftRadius: 15,
    // borderTopRightRadius: 15,
    elevation: 5,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  riderImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  riderInfo: {
    flex: 1,
    marginLeft: 15,
  },
  riderName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
    marginRight: 10,
  },
  callButtonText: {
    color: '#fff',
    marginLeft: 5,
    fontSize: 16,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#32CD32',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  chatButtonText: {
    color: '#fff',
    marginLeft: 5,
    fontSize: 16,
  },
});

export default OrderTrackingScreen;
