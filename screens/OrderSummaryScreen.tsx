import React, { useState } from 'react';
import { View, Text, Alert, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth'; 
import { useRoute, useNavigation } from '@react-navigation/native';
import { calculateDistance } from '../utils/locationUtils';
import { Picker } from '@react-native-picker/picker';

const OrderSummaryScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();

  const { pickupCoords, dropoffCoords, pickupDetails, dropoffDetails, parcelDetails = {} } = route.params || {};
  const { senderPhoneNumber = '', recipientPhoneNumber = '', packageDescription = '' } = parcelDetails;

  const distance = calculateDistance(pickupCoords || {}, dropoffCoords || {});
  const deliveryCharge = 50;
  const platformFee = 4;
  const additionalCost = distance > 2 ? (distance - 2) * 11 : 0;
  const totalCost = deliveryCharge + platformFee + additionalCost;

  const [paymentMethod, setPaymentMethod] = useState(''); // For selecting payment method

  const handleConfirmOrder = async () => {
    if (!paymentMethod) {
      Alert.alert('Error', 'Please select a payment method.');
      return;
    }

    try {
      const user = auth().currentUser;

      if (!user) {
        Alert.alert('Error', 'You must be logged in to place an order.');
        return;
      }

      // Save the order to Firestore
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
        orderedBy: user.uid, 
        paymentMethod, // Save the selected payment method
        status: 'pending', // Set the initial status to pending
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      console.log("Order created with ID: ", orderRef.id);

      // Navigate to the OrderAllocatingScreen for tracking
      navigation.navigate('OrderAllocatingScreen', { 
        orderId: orderRef.id, 
        dropoffCoords, 
        pickupCoords, // Pass these to center the map initially
        totalCost
      });

      Alert.alert('Order Confirmed', `Your order has been placed successfully. Total cost: ₹${totalCost}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to place the order. Please try again.');
      console.error('Firestore Error: ', error);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        {/* Details Section */}
        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Sender's Phone:</Text>
            <Text style={styles.detailValue}>{senderPhoneNumber}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Recipient's Phone:</Text>
            <Text style={styles.detailValue}>{recipientPhoneNumber}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Package Description:</Text>
            <Text style={styles.detailValue}>{packageDescription}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Distance:</Text>
            <Text style={styles.detailValue}>{distance.toFixed(2)} km</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Base Delivery Charge:</Text>
            <Text style={styles.detailValue}>₹{deliveryCharge}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Platform Fee:</Text>
            <Text style={styles.detailValue}>₹{platformFee}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Additional Cost (₹11/km after 2 km):</Text>
            <Text style={styles.detailValue}>₹{additionalCost.toFixed(2)}</Text>
          </View>

          {/* Divider Line */}
          <View style={styles.divider} />

          {/* Total Row */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total:</Text>
            <Text style={styles.totalValue}>₹{totalCost.toFixed(2)}</Text>
          </View>
        </View>

        {/* Payment Options */}
        <View style={styles.paymentContainer}>
          <Text style={styles.paymentLabel}>Select Payment Method:</Text>
          <Picker
            selectedValue={paymentMethod}
            onValueChange={(itemValue) => setPaymentMethod(itemValue)}
            style={styles.picker}
          >
            <Picker.Item label="Select" value="" />
            <Picker.Item label="UPI" value="UPI" />
            <Picker.Item label="Card" value="Card" />
          </Picker>
        </View>

        {/* Confirm Order Button */}
        <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmOrder}>
          <Text style={styles.confirmButtonText}>Confirm Order</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F5F5F5',
  },
  detailsContainer: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: 'bold',
    width: '50%',
  },
  detailValue: {
    fontSize: 14,
    color: '#555',
    width: '50%',
    textAlign: 'right',
  },
  divider: {
    borderBottomColor: '#C0C0C0',
    borderBottomWidth: 1,
    marginVertical: 15,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: 'bold',
    width: '50%',
  },
  totalValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: 'bold',
    textAlign: 'right',
    width: '50%',
  },
  paymentContainer: {
    marginBottom: 20,
  },
  paymentLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  picker: {
    backgroundColor: '#fff',
    borderRadius: 5,
  },
  confirmButton: {
    backgroundColor: '#00C853',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default OrderSummaryScreen;
