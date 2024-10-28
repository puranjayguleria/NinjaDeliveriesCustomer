import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, Modal, Button, ActivityIndicator } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import DateTimePickerModal from 'react-native-modal-datetime-picker';

const OrdersScreen: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'start' | 'end' | null>(null);
  const [isFilterModalVisible, setFilterModalVisible] = useState(false);
  const user = auth().currentUser;
  const navigation = useNavigation();

  useEffect(() => {
    if (!user) {
      Alert.alert('Login Required', 'Please log in to view your orders.');
      return;
    }
    fetchOrders(); // Fetch orders on load or when date filters change
  }, [user, startDate, endDate]);

  const fetchOrders = async () => {
    setLoading(true);
    let query = firestore()
      .collection('orders')
      .where('orderedBy', '==', user.uid)
      .orderBy('createdAt', 'desc');

    if (startDate) query = query.where('createdAt', '>=', firestore.Timestamp.fromDate(startDate));
    if (endDate) query = query.where('createdAt', '<=', firestore.Timestamp.fromDate(endDate));

    try {
      const ordersSnapshot = await query.get();
      const currentTimestamp = Date.now();

      const fetchedOrders = ordersSnapshot.docs.map((doc) => {
        const data = doc.data();
        return { id: doc.id, ...data };
      });

      // Check for stale 'waiting' orders older than 5 minutes and cancel them
      const updatedOrders = await Promise.all(
        fetchedOrders.map(async (order) => {
          if (
            order.status === 'waiting' &&
            order.createdAt &&
            currentTimestamp - order.createdAt.seconds * 1000 > 5 * 60 * 1000
          ) {
            // Order is stale, update status to 'cancelled' and set refundAmount
            const refundAmount = order.totalAmount ? order.totalAmount - 25 : 0;
            await firestore().collection('orders').doc(order.id).update({
              status: 'cancelled',
              refundAmount: refundAmount,
            });
            return { ...order, status: 'cancelled', refundAmount };
          }
          return order;
        })
      );

      setOrders(updatedOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      Alert.alert('Error', 'Failed to fetch orders.');
    } finally {
      setLoading(false);
    }
  };

  const handleOrderClick = (order) => {
    if (order.status === 'pending') {
      navigation.navigate('OrderAllocatingScreen', {
        orderId: order.id,
        pickupCoords: order.pickupCoords,
        dropoffCoords: order.dropoffCoords,
      });
    } else if (order.status === 'cancelled') {
      navigation.navigate('NewOrderCancelledScreen', { refundAmount: order.refundAmount });
    } else {
      navigation.navigate('OrderTrackingScreen', {
        orderId: order.id,
        pickupCoords: order.pickupCoords,
        dropoffCoords: order.dropoffCoords,
      });
    }
  };

  const showDatePicker = (mode) => {
    setDatePickerMode(mode);
    setDatePickerVisible(true);
  };

  const handleConfirmDate = (date) => {
    if (datePickerMode === 'start') {
      setStartDate(date);
    } else if (datePickerMode === 'end') {
      setEndDate(date);
    }
    setDatePickerVisible(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Your Orders</Text>

      {orders.length === 0 && !loading ? (
        <Text style={styles.noOrdersText}>You have no orders at the moment.</Text>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => handleOrderClick(item)} style={styles.orderCard}>
              <View style={styles.orderCardContent}>
                <Ionicons name="cube-outline" size={30} color="#4CAF50" style={styles.icon} />
                <View style={styles.orderDetails}>
                  <Text style={styles.orderTitle}>{item.pickupDetails?.buildingName || 'Pickup'} ➝ {item.dropoffDetails?.buildingName || 'Dropoff'}</Text>
                  <Text style={styles.orderStatus}>Status: {item.status}</Text>
                  <Text style={styles.orderDate}>
                    {item.createdAt ? format(new Date(item.createdAt.seconds * 1000), 'MMM dd, yyyy - h:mm a') : 'N/A'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListFooterComponent={loading && <ActivityIndicator size="large" color="#4CAF50" />}
        />
      )}

      {/* Floating Action Button */}
      <TouchableOpacity onPress={() => setFilterModalVisible(true)} style={styles.fabButton}>
        <Ionicons name="filter" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Bottom Sheet Modal for Filters */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isFilterModalVisible}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Filter by Date</Text>

            <View style={styles.dateFilterContainer}>
              <TouchableOpacity style={styles.dateButton} onPress={() => showDatePicker('start')}>
                <Text style={styles.dateButtonText}>{startDate ? format(startDate, 'MMM dd, yyyy') : 'Start Date'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dateButton} onPress={() => showDatePicker('end')}>
                <Text style={styles.dateButtonText}>{endDate ? format(endDate, 'MMM dd, yyyy') : 'End Date'}</Text>
              </TouchableOpacity>
            </View>

            <Button title="Apply Filter" onPress={() => setFilterModalVisible(false)} />
          </View>
        </View>
      </Modal>

      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        onConfirm={handleConfirmDate}
        onCancel={() => setDatePickerVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 15,
  },
  noOrdersText: {
    fontSize: 16,
    color: '#1C1C1E',
    textAlign: 'center',
    marginTop: 20,
  },
  orderCard: {
    backgroundColor: '#F8F8F8',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  orderCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 15,
  },
  fabButton: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 50,
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#FFF',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
  },
  dateFilterContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 15,
  },
  dateButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    marginHorizontal: 5,
    borderRadius: 8,
    alignItems: 'center',
  },
  dateButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
});

export default OrdersScreen;
