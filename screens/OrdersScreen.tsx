import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  Button,
  Platform,
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import Loader from "@/components/VideoLoader";

type Order = {
  id: string;
  status: string;
  pickupCoords: any;
  dropoffCoords: any;
  pickupDetails?: {
    buildingName?: string;
  };
  dropoffDetails?: {
    buildingName?: string;
  };
  createdAt?: {
    seconds: number;
  };
  refundAmount?: number;
  totalAmount?: number;
  cost?: {
    totalAmount?: number;
  };
};

const OrdersScreen: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<"start" | "end" | null>(
    null
  );
  const [isFilterModalVisible, setFilterModalVisible] = useState(false);
  const user = auth().currentUser;
  const navigation = useNavigation<any>();

  useEffect(() => {
    if (!user) {
      Alert.alert("Login Required", "Please log in to view your orders.");
      return;
    }
    checkAndUpdatePendingOrders();
    const unsubscribe = setupRealtimeListener();

    // Cleanup on component unmount
    return () => unsubscribe();
  }, [user, startDate, endDate]);

  const checkAndUpdatePendingOrders = async () => {
    if (!user) return;
    
    try {
      const currentTimestamp = Date.now();
      const fiveMinutesInMillis = 5 * 60 * 1000;

      const snapshot = await firestore()
        .collection("orders")
        .where("orderedBy", "==", user.uid)
        .where("status", "==", "pending")
        .get();

      const batch = firestore().batch();
      snapshot.docs.forEach((doc) => {
        const orderData = doc.data();
        if (
          orderData.createdAt &&
          currentTimestamp - orderData.createdAt.seconds * 1000 >
            fiveMinutesInMillis
        ) {
          const refundAmount = orderData.cost?.totalAmount
            ? orderData.cost.totalAmount - 25
            : 0;
          const orderRef = firestore().collection("orders").doc(doc.id);
          batch.update(orderRef, { status: "cancelled", refundAmount });
        }
      });

      if (!snapshot.empty) {
        await batch.commit();
      }
    } catch (error) {
      console.error("Error checking and updating pending orders:", error);
      Alert.alert("Error", "Failed to update pending orders.");
    }
  };

  const setupRealtimeListener = () => {
    if (!user) return () => {};
    
    let query = firestore()
      .collection("orders")
      .where("orderedBy", "==", user.uid)
      .orderBy("createdAt", "desc");

    if (startDate)
      query = query.where(
        "createdAt",
        ">=",
        firestore.Timestamp.fromDate(startDate)
      );
    if (endDate)
      query = query.where(
        "createdAt",
        "<=",
        firestore.Timestamp.fromDate(endDate)
      );

    return query.onSnapshot(
      (snapshot) => {
        const fetchedOrders = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Order[];
        setOrders(fetchedOrders);
        setLoading(false);
      },
      (error) => {
        console.error("Error setting up real-time listener:", error);
        Alert.alert("Error", "Failed to listen for real-time updates.");
        setLoading(false);
      }
    );
  };

  const handleOrderClick = (order: Order) => {
    if (order.status === "pending") {
      // @ts-ignore - Navigation type issue
      navigation.navigate("OrderAllocating", {
        orderId: order.id,
        pickupCoords: order.pickupCoords,
        dropoffCoords: order.dropoffCoords,
      });
    } else if (order.status === "cancelled") {
      // @ts-ignore - Navigation type issue
      navigation.navigate("OrderCancelled", {
        refundAmount: order.refundAmount,
      });
    } else {
      // @ts-ignore - Navigation type issue
      navigation.navigate("OrderTracking", {
        orderId: order.id,
        pickupCoords: order.pickupCoords,
        dropoffCoords: order.dropoffCoords,
      });
    }
  };

  const showDatePicker = (mode: "start" | "end") => {
    setDatePickerMode(mode);
    setDatePickerVisible(true);
  };

  const handleConfirmDate = (date: Date) => {
    if (datePickerMode === "start") {
      setStartDate(date);
    } else if (datePickerMode === "end") {
      setEndDate(date);
    }
    setDatePickerVisible(false);
  };

  const applyFilter = () => {
    setFilterModalVisible(false);
    // setupRealtimeListener will automatically refetch with new date range
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "#FFA726";
      case "accepted":
        return "#42A5F5";
      case "tripStarted":
        return "#66BB6A";
      case "tripEnded":
        return "#4CAF50";
      case "cancelled":
        return "#EF5350";
      default:
        return "#9E9E9E";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return "time-outline";
      case "accepted":
        return "checkmark-circle-outline";
      case "tripStarted":
        return "bicycle-outline";
      case "tripEnded":
        return "checkmark-done-circle-outline";
      case "cancelled":
        return "close-circle-outline";
      default:
        return "cube-outline";
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Your Orders</Text>

      {loading ? (
        <View style={styles.loadingContainer}>
          <Loader />
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="receipt-outline" size={64} color="#ccc" />
          <Text style={styles.noOrdersText}>
            You have no orders at the moment.
          </Text>
          <Text style={styles.noOrdersSubtext}>
            Start ordering to see your order history here
          </Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => handleOrderClick(item)}
              style={styles.orderCard}
              activeOpacity={0.7}
            >
              <View style={styles.orderCardContent}>
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: getStatusColor(item.status) + "20" },
                  ]}
                >
                  <Ionicons
                    name={getStatusIcon(item.status) as any}
                    size={28}
                    color={getStatusColor(item.status)}
                  />
                </View>
                <View style={styles.orderDetails}>
                  <Text style={styles.orderTitle} numberOfLines={1}>
                    {item.pickupDetails?.buildingName || "Pickup"} ➝{" "}
                    {item.dropoffDetails?.buildingName || "Dropoff"}
                  </Text>
                  <View style={styles.statusRow}>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(item.status) },
                      ]}
                    >
                      <Text style={styles.statusText}>
                        {item.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.orderDate}>
                    {item.createdAt
                      ? format(
                          new Date(item.createdAt.seconds * 1000),
                          "MMM dd, yyyy - h:mm a"
                        )
                      : "N/A"}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color="#999"
                  style={styles.chevron}
                />
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <TouchableOpacity
        onPress={() => setFilterModalVisible(true)}
        style={styles.fabButton}
        activeOpacity={0.8}
      >
        <Ionicons name="filter" size={24} color="#FFFFFF" />
      </TouchableOpacity>

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
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => showDatePicker("start")}
              >
                <Ionicons name="calendar-outline" size={18} color="#fff" />
                <Text style={styles.dateButtonText}>
                  {startDate ? format(startDate, "MMM dd, yyyy") : "Start Date"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => showDatePicker("end")}
              >
                <Ionicons name="calendar-outline" size={18} color="#fff" />
                <Text style={styles.dateButtonText}>
                  {endDate ? format(endDate, "MMM dd, yyyy") : "End Date"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.clearButton]}
                onPress={() => {
                  setStartDate(null);
                  setEndDate(null);
                  setFilterModalVisible(false);
                }}
              >
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.applyButton]}
                onPress={applyFilter}
              >
                <Text style={styles.applyButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
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
    paddingTop: Platform.OS === "ios" ? 50 : 40,
    backgroundColor: "#f8f8f8",
  },
  header: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1C1C1E",
    marginBottom: 20,
    marginHorizontal: 20,
    letterSpacing: -0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  noOrdersText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    textAlign: "center",
    marginTop: 16,
  },
  noOrdersSubtext: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginTop: 8,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  orderCard: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  orderCardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  orderDetails: {
    flex: 1,
  },
  orderTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.5,
  },
  orderDate: {
    fontSize: 13,
    color: "#666",
  },
  chevron: {
    marginLeft: 8,
  },
  fabButton: {
    position: "absolute",
    bottom: 30,
    right: 30,
    backgroundColor: "#4CAF50",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#4CAF50",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "#FFF",
    padding: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalHeader: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 20,
    color: "#1C1C1E",
  },
  dateFilterContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 12,
  },
  dateButton: {
    flex: 1,
    backgroundColor: "#4CAF50",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  dateButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  clearButton: {
    backgroundColor: "#f0f0f0",
  },
  clearButtonText: {
    color: "#666",
    fontWeight: "600",
    fontSize: 15,
  },
  applyButton: {
    backgroundColor: "#4CAF50",
  },
  applyButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
});

export default OrdersScreen;
