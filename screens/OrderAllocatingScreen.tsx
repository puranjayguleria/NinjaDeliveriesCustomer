import React, { useEffect, useState } from 'react';
import { View, Text, Animated, StyleSheet, ActivityIndicator, Dimensions, Image } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native'; // Add useNavigation
import firestore from '@react-native-firebase/firestore';
import riderIcon from '../assets/rider-icon-1.png'; // Custom rider icon
import pickupMarker from '../assets/pickup-marker.png'; // Custom pickup marker
import dropoffMarker from '../assets/dropoff-marker.png'; // Custom dropoff marker

type OrderAllocatingScreenRouteProp = RouteProp<{ params: { orderId: string; pickupCoords: { latitude: number; longitude: number }; dropoffCoords: { latitude: number; longitude: number } } }, 'params'>;

const quotes = [
  "Fast as a ninja, your package is on the way!",
  "Ninja delivery – stealthy and reliable!",
  "A ninja never rests, your delivery is on the move!",
  "Speed and precision – the ninja way of delivery!",
];

const OrderAllocatingScreen: React.FC = () => {
  const route = useRoute<OrderAllocatingScreenRouteProp>();
  const navigation = useNavigation(); // Initialize useNavigation hook
  const { orderId, pickupCoords, dropoffCoords } = route.params;

  const [region, setRegion] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [quote, setQuote] = useState<string>(quotes[0]);
  const [mapReady, setMapReady] = useState(false);
  const [nearbyRiders, setNearbyRiders] = useState([]); // List of nearby riders
  const { width, height } = Dimensions.get('window'); // Get screen dimensions for map sizing

  useEffect(() => {
    console.log("Order created with ID: ", orderId);
    console.log("Pickup Coordinates: ", pickupCoords);
    console.log("Dropoff Coordinates: ", dropoffCoords);

    // Set random quote
    setQuote(quotes[Math.floor(Math.random() * quotes.length)]);

    const orderRef = firestore().collection('orders').doc(orderId);

    // Firestore snapshot to detect changes in the order
    const unsubscribeOrder = orderRef.onSnapshot(async (doc) => {
      const orderData = doc.data();
      console.log("Order Data: ", orderData);

      if (orderData?.acceptedBy) {
        console.log("Order Accepted by: ", orderData.acceptedBy);

        // Navigate to OrderTrackingScreen when acceptedBy is populated
        navigation.navigate('OrderTrackingScreen', {
          orderId,
          pickupCoords,
          dropoffCoords,
        });
      }
    });

    const fetchNearbyRiders = async () => {
      try {
        // Set region to focus the map on pickup location
        if (pickupCoords && dropoffCoords) {
          const mapRegion = {
            latitude: pickupCoords.latitude,
            longitude: pickupCoords.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          };

          setRegion(mapRegion);
        }

        // Fetch nearby riders and show them on the map
        const nearbyRidersSnapshot = await firestore().collection('riderDetails').where('isAvailable', '==', true).get();
        const riders = nearbyRidersSnapshot.docs.map((doc) => doc.data());

        setNearbyRiders(riders);
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching nearby riders:", error);
        setIsLoading(false);
      }
    };

    fetchNearbyRiders();

    return () => unsubscribeOrder(); // Cleanup Firestore listener
  }, [orderId, pickupCoords, dropoffCoords, navigation]); // Add navigation dependency

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text style={styles.quoteText}>{quote}</Text>
        </View>
      ) : region ? (
        <View style={styles.container}>
          <MapView
            style={[styles.map, { width: width, height: height * 0.6 }]}  // Adjusted to make sure the map fills the space
            initialRegion={region}
            region={region}
            onMapReady={() => {
              setMapReady(true);
            }}
            onRegionChangeComplete={(newRegion) => {
              setRegion(newRegion);  // Update region on map movement
            }}
          >
            {/* Custom marker for Pickup Location */}
            <Marker coordinate={pickupCoords} title="Pickup Location">
              <Image source={pickupMarker} style={{ width: 40, height: 40 }} />
            </Marker>

            {/* Custom marker for Dropoff Location */}
            {dropoffCoords && (
              <Marker coordinate={dropoffCoords} title="Dropoff Location">
                <Image source={dropoffMarker} style={{ width: 40, height: 40 }} />
              </Marker>
            )}

            {/* Display nearby riders with custom icons */}
            {nearbyRiders.map((rider, index) => (
              <Marker
                key={index}
                coordinate={{
                  latitude: rider.location.latitude,
                  longitude: rider.location.longitude,
                }}
                description="Available Rider"
              >
                <Image
                  source={riderIcon}  // Custom rider icon
                  style={{ width: 30, height: 40 }}  // Adjust size of the rider icon
                />
              </Marker>
            ))}
          </MapView>
        </View>
      ) : (
        <View style={styles.loadingContainer}>
          <Text style={styles.quoteText}>{quote}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  map: {
    width: '100%',
    height: '80%',  // Adjust the height of the map
  },
  quoteText: {
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
  },
});

export default OrderAllocatingScreen;
