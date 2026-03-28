import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ActivityIndicator,
  Linking,
  ScrollView,
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { useNavigation, CommonActions } from "@react-navigation/native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { format } from "date-fns";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import Loader from "@/components/VideoLoader";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

const PHONE = "8219105753";
const EMAIL = "admin@ninjadeliveries.com";

interface Order {
  id: string;
  status: string;
  createdAt: any;
  items?: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
  subtotal?: number;
  discount?: number;
  deliveryCharge?: number;
  convenienceFee?: number;
  platformFee?: number;
  surgeFee?: number;
  finalTotal?: number;
  pickupCoords?: { latitude: number; longitude: number };
  dropoffCoords?: { latitude: number; longitude: number };
  refundAmount?: number;
}

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
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailsModalVisible, setDetailsModalVisible] = useState(false);

  const user = auth().currentUser;
  const navigation = useNavigation();

  useEffect(() => {
    if (!user) {
      Alert.alert("Login Required", "Please log in to view your orders.");
      return;
    }
    checkAndUpdatePendingOrders();
    const unsubscribe = setupRealtimeListener();

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
          const refundAmount = orderData.finalTotal
            ? orderData.finalTotal - 25
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
        setLoading(false);
      }
    );
  };

  const handleGoToOrder = (order: Order) => {
    const { status, id, pickupCoords, dropoffCoords, finalTotal, refundAmount } =
      order;

    if (status === "pending") {
      navigation.navigate("AppTabs", {
        screen: "HomeTab",
        params: {
          screen: "OrderAllocating",
          params: {
            orderId: id,
            pickupCoords,
            dropoffCoords,
            totalCost: finalTotal,
          },
        },
      });
    } else if (status === "cancelled") {
      navigation.navigate("AppTabs", {
        screen: "HomeTab",
        params: {
          screen: "OrderCancelled",
          params: { orderId: id, refundAmount: refundAmount || finalTotal },
        },
      });
    } else if (status === "tripEnded") {
      navigation.navigate("AppTabs", {
        screen: "HomeTab",
        params: {
          screen: "RatingScreen",
          params: { orderId: id },
        },
      });
    } else {
      navigation.navigate("AppTabs", {
        screen: "HomeTab",
        params: {
          screen: "OrderTracking",
          params: {
            orderId: id,
            pickupCoords,
            dropoffCoords,
            totalCost: finalTotal,
          },
        },
      });
    }
  };

  const openDetails = (order: Order) => {
    setSelectedOrder(order);
    setDetailsModalVisible(true);
  };

  const handleCall = () => Linking.openURL(`tel:${PHONE}`);
  const handleEmail = () => Linking.openURL(`mailto:${EMAIL}`);

  const renderOrderItem = ({ item }: { item: Order }) => {
    const dateObj = item.createdAt?.seconds
      ? new Date(item.createdAt.seconds * 1000)
      : new Date(item.createdAt);
    const dateString = format(dateObj, "dd MMM, yyyy 'at' hh:mm a");

    const statusColor = "#4CAF50"; 

    return (
      <View style={styles.orderCard}>
        <TouchableOpacity
          onPress={() => handleGoToOrder(item)}
          style={styles.orderCardHeader}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.orderIdText}>Order ID: {item.id}</Text>
            <Text style={styles.orderDateText}>{dateString}</Text>
            <Text style={styles.orderStatusText}>
              Status: <Text style={{ color: statusColor, fontWeight: "bold" }}>{item.status.toUpperCase()}</Text>
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#555" />
        </TouchableOpacity>

        <View style={styles.orderCardButtons}>
          <TouchableOpacity
            onPress={() => handleGoToOrder(item)}
            style={styles.goToOrderButton}
          >
            <Text style={styles.buttonText}>Go To Order</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFF" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => openDetails(item)}
            style={styles.viewDetailsButton}
          >
            <Text style={[styles.buttonText, { color: "#FFF" }]}>View Details</Text>
            <Ionicons name="list" size={16} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.header}>My Orders</Text>
        </View>

        <LinearGradient
          colors={["#5C6BC0", "#3949AB", "#283593"]}
          style={styles.helpBanner}
        >
          <Text style={styles.helpTitle}>Need Help?</Text>
          <Text style={styles.helpSubtitle}>
            Our dedicated support team is available to assist you with any inquiries or concerns you may have.
          </Text>
          <View style={styles.helpButtons}>
            <TouchableOpacity onPress={handleCall} style={[styles.helpButton, { backgroundColor: "#2E7D32" }]}>
              <Ionicons name="call" size={18} color="#FFF" />
              <Text style={styles.helpButtonText}>Call Us</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleEmail} style={[styles.helpButton, { backgroundColor: "#C62828" }]}>
              <Ionicons name="mail" size={18} color="#FFF" />
              <Text style={styles.helpButtonText}>Email Us</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {loading ? (
          <Loader />
        ) : orders.length === 0 ? (
          <Text style={styles.noOrdersText}>
            You have no orders at the moment.
          </Text>
        ) : (
          <FlatList
            data={orders}
            keyExtractor={(item) => item.id}
            renderItem={renderOrderItem}
            contentContainerStyle={{ paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Order Details Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={isDetailsModalVisible}
          onRequestClose={() => setDetailsModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.detailsModalContent}>
              <View style={styles.modalIndicator} />
              <Text style={styles.detailsHeader}>Order Details</Text>
              
              {selectedOrder && (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text style={styles.detailsId}>Order ID: {selectedOrder.id}</Text>
                  <Text style={styles.detailsDate}>
                    Date: {format(selectedOrder.createdAt?.seconds ? new Date(selectedOrder.createdAt.seconds * 1000) : new Date(selectedOrder.createdAt), "dd MMM yyyy, hh:mm a")}
                  </Text>

                  <View style={styles.itemsList}>
                    {selectedOrder.items && selectedOrder.items.length > 0 ? (
                      selectedOrder.items.map((item, index) => (
                        <View key={index} style={styles.itemRow}>
                          <Text style={styles.itemName}>{item.name}</Text>
                          <Text style={styles.itemQty}>x{item.quantity}</Text>
                          <Text style={styles.itemPrice}>₹{item.price.toFixed(2)}</Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.noItemsText}>No items found in this order.</Text>
                    )}
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.summaryContainer}>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Subtotal</Text>
                      <Text style={styles.summaryValue}>₹{(selectedOrder.subtotal || 0).toFixed(2)}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Delivery Charge</Text>
                      <Text style={styles.summaryValue}>₹{(selectedOrder.deliveryCharge || 0).toFixed(2)}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Convenience Fee</Text>
                      <Text style={styles.summaryValue}>₹{(selectedOrder.convenienceFee || 0).toFixed(2)}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Surge Fee</Text>
                      <Text style={styles.summaryValue}>₹{(selectedOrder.surgeFee || 0).toFixed(2)}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Platform Fee</Text>
                      <Text style={styles.summaryValue}>₹{(selectedOrder.platformFee || 0).toFixed(2)}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Discount</Text>
                      <Text style={[styles.summaryValue, { color: "red" }]}>-₹{(selectedOrder.discount || 0).toFixed(2)}</Text>
                    </View>
                    <View style={[styles.summaryRow, { marginTop: 10 }]}>
                      <Text style={[styles.summaryLabel, { fontWeight: "bold", fontSize: 16, color: "#000" }]}>Total</Text>
                      <Text style={[styles.summaryValue, { fontWeight: "bold", fontSize: 16, color: "#000" }]}>₹{(selectedOrder.finalTotal || 0).toFixed(2)}</Text>
                    </View>
                  </View>
                </ScrollView>
              )}

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setDetailsModalVisible(false)}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <TouchableOpacity
          onPress={() => setFilterModalVisible(true)}
          style={styles.fabButton}
        >
          <Ionicons name="filter" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <Modal
          animationType="slide"
          transparent={true}
          visible={isFilterModalVisible}
          onRequestClose={() => setFilterModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.filterModalContent}>
              <Text style={styles.modalHeader}>Filter by Date</Text>
              <View style={styles.dateFilterContainer}>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => {
                    setDatePickerMode("start");
                    setDatePickerVisible(true);
                  }}
                >
                  <Text style={styles.dateButtonText}>
                    {startDate ? format(startDate, "MMM dd, yyyy") : "Start Date"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => {
                    setDatePickerMode("end");
                    setDatePickerVisible(true);
                  }}
                >
                  <Text style={styles.dateButtonText}>
                    {endDate ? format(endDate, "MMM dd, yyyy") : "End Date"}
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.applyFilterButton}
                onPress={() => setFilterModalVisible(false)}
              >
                <Text style={styles.applyFilterText}>Apply Filter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <DateTimePickerModal
          isVisible={isDatePickerVisible}
          mode="date"
          onConfirm={(date) => {
            if (datePickerMode === "start") setStartDate(date);
            else setEndDate(date);
            setDatePickerVisible(false);
          }}
          onCancel={() => setDatePickerVisible(false)}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  header: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1A1A1A",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  backButton: {
    paddingRight: 12,
  },
  helpBanner: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  helpTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFF",
    marginBottom: 8,
  },
  helpSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 18,
  },
  helpButtons: {
    flexDirection: "row",
    justifyContent: "center",
    width: "100%",
  },
  helpButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginHorizontal: 8,
    minWidth: 120,
    justifyContent: "center",
  },
  helpButtonText: {
    color: "#FFF",
    fontWeight: "bold",
    marginLeft: 6,
    fontSize: 14,
  },
  noOrdersText: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 40,
  },
  orderCard: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  orderCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  orderIdText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },
  orderDateText: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 4,
  },
  orderStatusText: {
    fontSize: 13,
    color: "#374151",
  },
  orderCardButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  goToOrderButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3B82F6",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    flex: 0.48,
    justifyContent: "center",
  },
  viewDetailsButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#9CA3AF",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    flex: 0.48,
    justifyContent: "center",
  },
  buttonText: {
    color: "#FFF",
    fontWeight: "700",
    marginRight: 6,
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  detailsModalContent: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: "85%",
  },
  modalIndicator: {
    width: 40,
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  detailsHeader: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 16,
  },
  detailsId: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 4,
  },
  detailsDate: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 24,
  },
  itemsList: {
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  itemName: {
    fontSize: 14,
    color: "#111827",
    flex: 1,
    fontWeight: "500",
  },
  itemQty: {
    fontSize: 14,
    color: "#6B7280",
    marginHorizontal: 12,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    width: 80,
    textAlign: "right",
  },
  noItemsText: {
    fontSize: 14,
    color: "#9CA3AF",
    fontStyle: "italic",
    textAlign: "center",
    marginVertical: 10,
  },
  divider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 20,
  },
  summaryContainer: {
    backgroundColor: "#F9FAFB",
    padding: 16,
    borderRadius: 16,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 14,
    color: "#4B5563",
  },
  summaryValue: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "500",
  },
  closeButton: {
    backgroundColor: "#EF4444",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 24,
  },
  closeButtonText: {
    color: "#FFF",
    fontWeight: "800",
    fontSize: 16,
  },
  fabButton: {
    position: "absolute",
    bottom: 30,
    right: 20,
    backgroundColor: "#10B981",
    padding: 14,
    borderRadius: 50,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  filterModalContent: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalHeader: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    marginBottom: 24,
  },
  dateFilterContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  dateButton: {
    flex: 0.47,
    backgroundColor: "#F3F4F6",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  dateButtonText: {
    color: "#374151",
    fontWeight: "600",
    fontSize: 13,
  },
  applyFilterButton: {
    backgroundColor: "#3B82F6",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  applyFilterText: {
    color: "#FFF",
    fontWeight: "800",
    fontSize: 15,
  },
});

export default OrdersScreen;


