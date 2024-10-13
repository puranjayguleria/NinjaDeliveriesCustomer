import React from 'react';
import { View, Text, Button, Alert, StyleSheet } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth'; // Import Firebase Auth to get the current user
import { useRoute, useNavigation } from '@react-navigation/native';
import { calculateDistance } from '../utils/locationUtils'; // Assuming this function exists

const OrderSummaryScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  
  // Destructure and provide default values if props are missing
  const { pickupCoords, dropoffCoords, pickupDetails, dropoffDetails, parcelDetails = {} } = route.params || {};
  const { senderPhoneNumber = '', recipientPhoneNumber = '', packageDescription = '' } = parcelDetails;

  console.log("Pickup Coordinates: ", pickupCoords);
  console.log("Dropoff Coordinates: ", dropoffCoords);

  // Calculate distance and total cost
  const distance = calculateDistance(pickupCoords || {}, dropoffCoords || {});
  const deliveryCharge = 25;
  const platformFee = 3;
  const additionalCost = distance > 2 ? (distance - 2) * 7 : 0;
  const totalCost = deliveryCharge + platformFee + additionalCost;

  // Function to save the order to Firestore
  const handleConfirmOrder = async () => {
    try {
      const user = auth().currentUser; // Get the current logged-in user

      if (!user) {
        Alert.alert('Error', 'You must be logged in to place an order.');
        return;
      }

      const orderRef = await firestore().collection('orders').add({
        pickupCoords,
        dropoffCoords,
        pickupDetails,
        dropoffDetails,
        parcelDetails,
        cost: {
          deliveryCharge,
          platformFee,
          additionalCost,
          totalCost,
        },
        distance,
        orderedBy: user.uid, // Save the user ID who placed the order
        status: 'pending', // Status can be updated later
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      console.log("Order created with ID: ", orderRef.id);

      // Navigate to the next screen where the rider will accept the order
      navigation.navigate('OrderAllocatingScreen', { 
        orderId: orderRef.id, 
        dropoffCoords, 
        pickupCoords // Pass this to center the map initially
      });

      Alert.alert('Order Confirmed', `Your order has been placed successfully. Total cost: ₹${totalCost}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to place the order. Please try again.');
      console.error('Firestore Error: ', error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Order Summary</Text>

      <Text style={styles.summaryText}>
        Sender's Phone: {senderPhoneNumber || 'Not provided'}
      </Text>

      <Text style={styles.summaryText}>
        Recipient's Phone: {recipientPhoneNumber || 'Not provided'}
      </Text>

      <Text style={styles.summaryText}>
        What are you sending?: {packageDescription || 'No description provided'}
      </Text>

      <Text style={styles.summaryText}>Distance: {distance.toFixed(2)} km</Text>

      <Text style={styles.summaryText}>Base Delivery Charge: ₹{deliveryCharge}</Text>

      <Text style={styles.summaryText}>Platform Fee: ₹{platformFee}</Text>

      <Text style={styles.summaryText}>
        Additional Cost (₹7/km after 2 km): ₹{additionalCost.toFixed(2)}
      </Text>

      <Text style={styles.totalCost}>Total Cost: ₹{totalCost.toFixed(2)}</Text>

      <Button title="Confirm Order" onPress={handleConfirmOrder} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
  },
  header: {
    fontSize: 24,
    color: '#FFFFFF',
    marginBottom: 20,
  },
  summaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 10,
  },
  totalCost: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 20,
  },
});

export default OrderSummaryScreen;
