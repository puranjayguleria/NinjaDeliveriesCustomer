import React, { useState, useEffect } from 'react';
import { View, Text, Alert, StyleSheet, TouchableOpacity } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

type RatingScreenRouteProp = RouteProp<{ params: { orderId: string; riderId: string } }, 'params'>;

const RatingScreen: React.FC = () => {
  const route = useRoute<RatingScreenRouteProp>();
  const { orderId, riderId } = route.params;
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [riderName, setRiderName] = useState<string>('Unknown Rider');

  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        const orderDoc = await firestore().collection('orders').doc(orderId).get();
        const orderData = orderDoc.data();
        setOrderDetails(orderData);

        const riderDoc = await firestore().collection('riderDetails').doc(riderId).get();
        const riderData = riderDoc.data();
        setRiderName(riderData?.name || 'Unknown Rider');
      } catch (error) {
        console.error('Error fetching order details:', error);
      }
    };

    fetchOrderDetails();
  }, [orderId, riderId]);

  const renderDetailedBill = () => (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.completedIconContainer}>
          <Ionicons name="checkmark-circle" size={70} color="green" />
        </View>

        <Text style={styles.title}>Order Summary</Text>

        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>Rider: {riderName}</Text>
          <Text style={styles.infoText}>Pickup: {orderDetails?.pickupDetails?.buildingName}, {orderDetails?.pickupDetails?.flatNumber}</Text>
          <Text style={styles.infoText}>Drop-off: {orderDetails?.dropoffDetails?.buildingName}, {orderDetails?.dropoffDetails?.flatNumber}</Text>
          <Text style={styles.infoText}>Date: {new Date(orderDetails?.createdAt.seconds * 1000).toLocaleString()}</Text>
        </View>

        <View style={styles.costSection}>
          <Text style={styles.costText}>Delivery: ₹{orderDetails?.cost?.deliveryCharge}</Text>
          <Text style={styles.costText}>Additional: ₹{orderDetails?.cost?.additionalCost.toFixed(2)}</Text>
          <Text style={styles.costText}>Platform Fee: ₹{orderDetails?.cost?.platformFee}</Text>
          <Text style={styles.totalCost}>Total: ₹{orderDetails?.cost?.totalCost.toFixed(2)}</Text>
        </View>
      </View>

      {/* Help Button Moved Further Up */}
      <TouchableOpacity style={styles.helpButton} onPress={() => Alert.alert('Help', 'Customer support will contact you.')}>
        <Ionicons name="help-circle" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      <Text style={styles.loveMessage}>Love from Ninja Deliveries</Text>
      <Text style={styles.nextOrderMessage}>Can't wait for your next order!</Text>
    </View>
  );

  return <View style={styles.container}>{renderDetailedBill()}</View>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
  },
  card: {
    width: '95%',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    marginTop: 20,
  },
  completedIconContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
  },
  infoContainer: {
    marginVertical: 12,
  },
  infoText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  costSection: {
    marginTop: 16,
    paddingVertical: 8,
    borderTopColor: '#E0E0E0',
    borderTopWidth: 1,
  },
  costText: {
    fontSize: 16,
    color: '#555',
    marginBottom: 5,
  },
  totalCost: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 10,
  },
  helpButton: {
    backgroundColor: '#007BFF',
    borderRadius: 30,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: 100, // Adjusted position to avoid overlapping the text
    right: 20,
    elevation: 5,
  },
  loveMessage: {
    fontSize: 12,
    textAlign: 'center',
    color: '#555',
    marginTop: 30, // Added margin for better spacing from the help button
  },
  nextOrderMessage: {
    fontSize: 12,
    textAlign: 'center',
    color: '#FF5733',
    marginTop: 4,
  },
});

export default RatingScreen;
