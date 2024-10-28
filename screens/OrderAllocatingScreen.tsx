import React, { useEffect, useState } from 'react';
import { View, Text, Animated, StyleSheet, ActivityIndicator, Dimensions, Image, Alert, Button } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import firestore from '@react-native-firebase/firestore';
import riderIcon from '../assets/rider-icon-1.png';
import pickupMarker from '../assets/pickup-marker.png';
import dropoffMarker from '../assets/dropoff-marker.png';

type OrderAllocatingScreenRouteProp = RouteProp<
  { params: { orderId: string; pickupCoords: { latitude: number; longitude: number }; dropoffCoords: { latitude: number; longitude: number }, totalCost: number | undefined } },
  'params'
>;

const quotes = [
  "Ninjas are fast, but we're faster with your delivery!",
  "Your delivery is so stealthy, even we can't see it!",
  "Is it a bird? Is it a plane? No, it's Ninja Deliveries!",
  "Ninja Delivery: As fast as a throwing star!",
  "Your package is moving like a ninja in the night!",
];

const OrderAllocatingScreen: React.FC = () => {
  const route = useRoute<OrderAllocatingScreenRouteProp>();
  const navigation = useNavigation();
  const { orderId, pickupCoords, dropoffCoords } = route.params;
  const totalCost = route.params.totalCost || 0; // Ensure totalCost has a default value

  const [region, setRegion] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [quote, setQuote] = useState<string>(quotes[0]);
  const [mapReady, setMapReady] = useState(false);
  const [nearbyRiders, setNearbyRiders] = useState([]);
  const { width, height } = Dimensions.get('window');
  const [markerAnimation] = useState(new Animated.Value(1));
  const [mapOpacity] = useState(new Animated.Value(1));
  const [orderAccepted, setOrderAccepted] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);

  useEffect(() => {
    const quoteInterval = setInterval(() => {
      const nextQuote = quotes[Math.floor(Math.random() * quotes.length)];
      setQuote(nextQuote);
    }, 3000);

    const orderRef = firestore().collection('orders').doc(orderId);

    const unsubscribeOrder = orderRef.onSnapshot((doc) => {
      const data = doc.data();
      setOrderData(data);
      if (data?.acceptedBy) {
        setOrderAccepted(true);
        navigation.reset({
          index: 0,
          routes: [
            {
              name: 'OrderTrackingScreen',
              params: { orderId, pickupCoords, dropoffCoords,totalCost },
            },
          ],
        });
      }
    });

    const fetchNearbyRiders = async () => {
      try {
        if (pickupCoords && dropoffCoords) {
          const mapRegion = {
            latitude: pickupCoords.latitude,
            longitude: pickupCoords.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          };
          setRegion(mapRegion);
        }

        const nearbyRidersSnapshot = await firestore()
          .collection('riderDetails')
          .where('isAvailable', '==', true)
          .get();
        const riders = nearbyRidersSnapshot.docs.map((doc) => doc.data());
        setNearbyRiders(riders);

        Animated.loop(
          Animated.sequence([
            Animated.timing(markerAnimation, {
              toValue: 1.2,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(markerAnimation, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
          ])
        ).start();

        Animated.loop(
          Animated.sequence([
            Animated.timing(mapOpacity, {
              toValue: 0.7,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(mapOpacity, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
          ])
        ).start();

        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching nearby riders:", error);
        setIsLoading(false);
      }
    };

    fetchNearbyRiders();

    const timeoutId = setTimeout(async () => {
      if (!orderAccepted) {
        try {
          await orderRef.update({ status: 'cancelled' });
        } catch (error) {
          console.error('Error updating order status:', error);
        }

        Alert.alert(
          'No Rider Available',
          'No rider accepted your order at this time. Please try again later.'
        );

        navigation.navigate('NewOrderCancelledScreen', { refundAmount: totalCost });
      }
    }, 300000);

    return () => {
      clearInterval(quoteInterval);
      unsubscribeOrder();
      clearTimeout(timeoutId);
    };
  }, [orderId, pickupCoords, dropoffCoords, navigation, orderAccepted]);

  const cancelOrder = async () => {
    try {
      const orderRef = firestore().collection('orders').doc(orderId);
      const refundAmount = totalCost;
      await orderRef.update({
        status: 'cancelled',
        refundAmount,
      });

      Alert.alert(
        'Order Cancelled',
        `Your order has been cancelled. A refund of ₹${refundAmount} will be processed.`,
        [{ text: 'OK', onPress: () => navigation.navigate('NewOrderCancelledScreen', { refundAmount }) }]
      );

    } catch (error) {
      console.error("Error cancelling the order:", error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Assigning you to a rider...</Text>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0000ff" />
        </View>
      ) : region ? (
        <Animated.View style={{ opacity: mapOpacity }}>
          <MapView
            style={[styles.map, { width, height: height * 0.6 }]}
            initialRegion={region}
            region={region}
            onMapReady={() => setMapReady(true)}
            onRegionChangeComplete={(newRegion) => setRegion(newRegion)}
          >
            <Marker coordinate={pickupCoords} title="Pickup Location">
              <Animated.Image
                source={pickupMarker}
                style={{ width: 40, height: 40, transform: [{ scale: markerAnimation }] }}
              />
            </Marker>

            <Marker coordinate={dropoffCoords} title="Dropoff Location">
              <Animated.Image
                source={dropoffMarker}
                style={{ width: 40, height: 40, transform: [{ scale: markerAnimation }] }}
              />
            </Marker>

            {nearbyRiders.map((rider, index) => (
              <Marker
                key={index}
                coordinate={{
                  latitude: rider.location.latitude,
                  longitude: rider.location.longitude,
                }}
                description="Available Rider"
              >
                <Animated.Image
                  source={riderIcon}
                  style={{ width: 30, height: 40, transform: [{ scale: markerAnimation }] }}
                />
              </Marker>
            ))}
          </MapView>
        </Animated.View>
      ) : (
        <View style={styles.loadingContainer}>
          <Text style={styles.quoteText}>{quote}</Text>
        </View>
      )}

      <Text style={styles.quoteText}>{quote}</Text>

      {!orderAccepted && orderData?.status === 'pending' || orderData?.status === 'accepted' ? (
        <Button
          title="Cancel Order"
          color="red"
          onPress={cancelOrder}
          style={styles.cancelButton} // Add this for styling if needed
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  map: {
    width: '100%',
    height: '80%',
  },
  quoteText: {
    fontSize: 18,
    marginTop: 20,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  cancelButton: {
    marginTop: 20,
  }
});

export default OrderAllocatingScreen;
