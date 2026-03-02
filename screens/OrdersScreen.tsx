import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  Button,
  ActivityIndicator,
  ScrollView,
  SafeAreaView
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import Loader from "@/components/VideoLoader";

const OrdersScreen: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<"start" | "end" | null>(
    null
  );
  const [isFilterModalVisible, setFilterModalVisible] = useState(false);
  
  // Details Modal State
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

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
          const refundAmount = orderData.totalAmount
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
        }));
        setOrders(fetchedOrders);
        setLoading(false);
      },
      (error) => {
        console.error("Error setting up real-time listener:", error);
        Alert.alert("Error", "Failed to listen for real-time updates.");
      }
    );
  };

  const handleOrderClick = (order: any) => {
    if (order.status === "pending") {
      navigation.navigate("HomeTab", {
        screen: "OrderAllocating",
        params: {
          orderId: order.id,
          pickupCoords: order.pickupCoords,
          dropoffCoords: order.dropoffCoords,
        },
      });
    } else if (order.status === "cancelled") {
      navigation.navigate("HomeTab", {
        screen: "OrderCancelled",
        params: {
          refundAmount: order.refundAmount,
        },
      });
    } else if (order.status === "tripEnded") {
       navigation.navigate("HomeTab", {
         screen: "RatingScreen",
         params: {
           orderId: order.id,
         },
       });
    } else {
      navigation.navigate("HomeTab", {
        screen: "OrderTracking",
        params: {
          orderId: order.id,
          pickupCoords: order.pickupCoords,
          dropoffCoords: order.dropoffCoords,
        },
      });
    }
  };

  const openDetailsModal = (order: any) => {
    setSelectedOrder(order);
    setShowDetailsModal(true);
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

  const renderOrderItem = ({ item }: { item: any }) => {
    const dateObj = item.createdAt?.toDate
      ? item.createdAt.toDate()
      : new Date(item.createdAt.seconds * 1000);
    
    const dateString = format(dateObj, "dd MMM, yyyy");
    const timeString = format(dateObj, "hh:mm a");
    const total = typeof item.finalTotal === "number" ? item.finalTotal : 0;

    const statusRaw = String(item.status || "unknown").toLowerCase();
    const statusText = statusRaw === "tripended" ? "Completed" : statusRaw;
    const statusTheme =
      statusRaw === "cancelled"
        ? { bg: "#FEE2E2", fg: "#991B1B" }
        : statusRaw === "pending"
        ? { bg: "#FEF3C7", fg: "#92400E" }
        : statusRaw === "tripended"
        ? { bg: "#DCFCE7", fg: "#166534" }
        : { bg: "#E5E7EB", fg: "#374151" };

    return (
      <View style={styles.orderCard}>
        <View style={styles.orderTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.orderId} numberOfLines={1}>
              Order ID: {item.id}
            </Text>
            <Text style={styles.orderDate}>
              {dateString} at {timeString}
            </Text>
            <View style={{ flexDirection: 'row', marginTop: 4 }}>
               <Text style={[styles.orderStatus, { color: '#000' }]}>Status: </Text>
               <Text style={[styles.orderStatus, { color: statusTheme.fg }]}>
                 {statusText.toUpperCase()}
               </Text>
            </View>
          </View>

          <View style={{ justifyContent: 'center', alignItems: 'center' }}>
             <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </View>
        </View>

        <View style={styles.orderActionRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionPrimary]}
            onPress={() => {
              handleOrderClick(item);
            }}
          >
            <Text style={styles.actionButtonText}>Go To Order</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" style={{ marginLeft: 6 }} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionSecondary]}
            onPress={() => {
              openDetailsModal(item);
            }}
          >
            <Text style={[styles.actionButtonText, { color: "#fff" }]}>
              View Details
            </Text>
            <Ionicons name="list" size={16} color="#fff" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.headerBackButton}
          onPress={() => {
            if ((navigation as any)?.canGoBack?.()) {
              (navigation as any).goBack();
              return;
            }
            (navigation as any).navigate?.("Profile");
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Orders</Text>
        <View style={styles.headerSpacer} />
      </View>

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
          contentContainerStyle={{ paddingBottom: 80 }}
        />
      )}

      {/* Details Modal */}
      <Modal
          visible={showDetailsModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDetailsModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.bottomSheet}>
              {selectedOrder ? (
                <>
                  <View style={{ marginBottom: 15 }}>
                    <Text style={styles.sheetTitle}>Order Details</Text>
                    <Text style={styles.orderIdText}>
                      Order ID: {selectedOrder.id}
                    </Text>
                    <Text style={styles.orderDateText}>
                      Date:{" "}
                      {selectedOrder.createdAt &&
                        format(
                          selectedOrder.createdAt.toDate
                            ? selectedOrder.createdAt.toDate()
                            : new Date(selectedOrder.createdAt.seconds * 1000),
                          "dd MMM yyyy, hh:mm a"
                        )}
                    </Text>
                  </View>

                  <ScrollView style={{ maxHeight: 300, marginVertical: 8 }}>
                    {/* Item List */}
                    {Array.isArray(selectedOrder.items) &&
                    selectedOrder.items.length > 0 ? (
                      selectedOrder.items.map((item: any, idx: number) => {
                        const price = Number(item.price) || 0;
                        const discount = Number(item.discount) || 0;
                        const finalPrice = price - discount;
                        
                        return (
                          <View
                            style={styles.detailItemRow}
                            key={`item-${idx}`}
                          >
                            <Text style={styles.detailItemName}>
                              {item.name}
                            </Text>
                            <Text style={styles.detailItemQty}>
                              x{item.quantity}
                            </Text>
                            <Text style={styles.detailItemPrice}>
                              ₹{finalPrice.toFixed(2)}
                            </Text>
                          </View>
                        );
                      })
                    ) : (
                      <Text>No items found</Text>
                    )}

                    {/* BILL SUMMARY */}
                    <View style={styles.billSummaryContainer}>
                      {/* Subtotal */}
                      <View style={styles.billRow}>
                        <Text style={styles.billLabel}>Subtotal</Text>
                        <Text style={styles.billValue}>
                          ₹
                          {(
                            (selectedOrder.subtotal || 0) +
                            (selectedOrder.productCgst || 0) +
                            (selectedOrder.productSgst || 0)
                          ).toFixed(2)}
                        </Text>
                      </View>

                      {/* Delivery Charge */}
                      <View style={styles.billRow}>
                        <Text style={styles.billLabel}>Delivery Charge</Text>
                        <Text style={styles.billValue}>
                          ₹
                          {(
                            (selectedOrder.deliveryCharge || 0) +
                            (selectedOrder.rideCgst || 0) +
                            (selectedOrder.rideSgst || 0)
                          ).toFixed(2)}
                        </Text>
                      </View>

                      {/* Convenience Fee */}
                      <View style={styles.billRow}>
                        <Text style={styles.billLabel}>Convenience Fee</Text>
                        <Text style={styles.billValue}>
                          ₹{(selectedOrder.convenienceFee || 0).toFixed(2)}
                        </Text>
                      </View>

                      {/* Surge Fee */}
                      <View style={styles.billRow}>
                        <Text style={styles.billLabel}>Surge Fee</Text>
                        <Text style={styles.billValue}>
                          ₹{(selectedOrder.surgeFee || 0).toFixed(2)}
                        </Text>
                      </View>

                      {/* Platform Fee */}
                      <View style={styles.billRow}>
                        <Text style={styles.billLabel}>Platform Fee</Text>
                        <Text style={styles.billValue}>
                          ₹{(selectedOrder.platformFee || 0).toFixed(2)}
                        </Text>
                      </View>

                      {/* Discount */}
                      <View style={styles.billRow}>
                        <Text style={styles.billLabel}>Discount</Text>
                        <Text style={styles.billValue}>
                          -₹{(selectedOrder.discount || 0).toFixed(2)}
                        </Text>
                      </View>

                      {/* Final Total */}
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalValue}>
                          ₹{selectedOrder.finalTotal?.toFixed(2) || "0.00"}
                        </Text>
                      </View>
                    </View>
                  </ScrollView>

                  {/* Close Button */}
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => setShowDetailsModal(false)}
                  >
                    <Text style={styles.closeButtonText}>Close</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <Text>No order selected</Text>
              )}
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
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Filter by Date</Text>

            <View style={styles.dateFilterContainer}>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => showDatePicker("start")}
              >
                <Text style={styles.dateButtonText}>
                  {startDate ? format(startDate, "MMM dd, yyyy") : "Start Date"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => showDatePicker("end")}
              >
                <Text style={styles.dateButtonText}>
                  {endDate ? format(endDate, "MMM dd, yyyy") : "End Date"}
                </Text>
              </TouchableOpacity>
            </View>

            <Button title="Apply Filter" onPress={applyFilter} />
          </View>
        </View>
      </Modal>

      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        onConfirm={handleConfirmDate}
        onCancel={() => setDatePickerVisible(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    marginBottom: 12,
  },
  headerBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#333",
    flex: 1,
    textAlign: "center",
  },
  headerSpacer: { width: 40 },
  header: {
    fontSize: 20,
    fontWeight: "800",
    color: "#333",
    marginBottom: 15,
    marginTop: 10,
  },
  loadingIndicator: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  noOrdersText: {
    fontSize: 16,
    color: "#1C1C1E",
    textAlign: "center",
    marginTop: 20,
  },
  orderCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  orderTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  orderId: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  orderDate: {
    fontSize: 12,
    color: "#6B7280",
  },
  orderStatus: {
    fontSize: 12,
    fontWeight: "700",
  },
  orderActionRow: {
    flexDirection: "row",
    marginTop: 8,
  },
  actionButton: {
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: 'center',
    flex: 1,
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  actionPrimary: {
    backgroundColor: "#2563EB", // Blue for Go To Order
  },
  actionSecondary: {
    backgroundColor: "#78909C", // Greyish for View Details
  },
  fabButton: {
    position: "absolute",
    bottom: 30,
    right: 30,
    backgroundColor: "#4CAF50",
    padding: 15,
    borderRadius: 50,
    alignItems: "center",
    elevation: 5,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "#FFF",
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalHeader: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 15,
  },
  dateFilterContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 15,
  },
  dateButton: {
    flex: 1,
    backgroundColor: "#4CAF50",
    paddingVertical: 10,
    marginHorizontal: 5,
    borderRadius: 8,
    alignItems: "center",
  },
  dateButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 14,
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  bottomSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "80%",
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 4,
  },
  orderIdText: {
    fontSize: 14,
    color: "#333",
    marginBottom: 2,
  },
  orderDateText: {
    fontSize: 14,
    color: "#666",
  },
  detailItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  detailItemName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },
  detailItemQty: {
    fontSize: 14,
    color: "#666",
    marginHorizontal: 16,
  },
  detailItemPrice: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000",
  },
  billSummaryContainer: {
    marginTop: 16,
    backgroundColor: "#E0F2F1", // Light teal/mint background
    borderRadius: 8,
    padding: 12,
  },
  billRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  billLabel: {
    fontSize: 14,
    color: "#333",
  },
  billValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#B2DFDB",
    paddingTop: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#000",
  },
  totalValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#000",
  },
  closeButton: {
    marginTop: 20,
    backgroundColor: "#EF5350",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
  },
});

export default OrdersScreen;
