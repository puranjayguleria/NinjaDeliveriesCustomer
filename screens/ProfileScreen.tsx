// ProfileScreen.tsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  FlatList,
  Platform,
  Modal,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { Button, TextInput } from "react-native-paper";
import { CommonActions, useNavigation } from "@react-navigation/native";
import { format } from "date-fns";

const pastelGreen = "#e7f8f6";
const primaryTextColor = "#333";

/** Updated Order Interface */
interface Order {
  id: string;
  status: string; // "pending", "cancelled", "active", etc.
  createdAt: any; // Firestore Timestamp
  items?: Array<{
    name: string;
    price: number;
    discount?: number;
    quantity: number;
  }>;
  subtotal?: number;
  discount?: number;
  finalTotal?: number;
  pickupCoords?: { latitude: number; longitude: number };
  dropoffCoords?: { latitude: number; longitude: number };
  refundAmount?: number; // For cancelled orders
}

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation();

  // Local states
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [userName, setUserName] = useState<string>("");
  const [dob, setDob] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);

  // Orders
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState<boolean>(false);

  // Modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);

  const currentUser = auth().currentUser;

  // Refs to prevent repeated state updates
  const oldUserName = useRef<string>("");
  const oldDob = useRef<string>("");
  const oldOrders = useRef<string>("");

  useEffect(() => {
    console.log("[ProfileScreen] Mounted, currentUser:", currentUser?.uid);
  }, [currentUser?.uid]);

  /** ----------------------------------------------
   *  ON MOUNT => Fetch user profile + listen to orders
   ---------------------------------------------- */
  useEffect(() => {
    let unsubscribeUser: any;
    let unsubscribeOrders: any;

    if (currentUser) {
      console.log("[ProfileScreen] Subscribing to user doc + orders...");

      // 1) Listen to user doc
      unsubscribeUser = firestore()
        .collection("users")
        .doc(currentUser.uid)
        .onSnapshot(
          (doc) => {
            if (doc.exists) {
              const data = doc.data();
              console.log("[User Snapshot] doc data:", data);

              // Name
              const newName = data?.name || "";
              if (oldUserName.current !== newName) {
                console.log("Updating userName from", oldUserName.current, "to", newName);
                setUserName(newName);
                oldUserName.current = newName;
              }

              // DOB
              const rawDob = data?.dob || "";
              if (rawDob && oldDob.current !== rawDob) {
                console.log("Updating DOB from", oldDob.current, "to", rawDob);
                const newDate = new Date(rawDob);
                setDob(newDate);
                oldDob.current = rawDob;
              }
            }
            setLoading(false);
          },
          (error) => {
            console.error("[User Snapshot] Error:", error);
            Alert.alert("Error", "Failed to fetch user info.");
            setLoading(false);
          }
        );

      // 2) Listen to orders
      setOrdersLoading(true);
      unsubscribeOrders = firestore()
        .collection("orders")
        .where("orderedBy", "==", currentUser.uid)
        .orderBy("createdAt", "desc")
        .onSnapshot(
          (snapshot) => {
            console.log("[Orders Snapshot] size:", snapshot.size);

            const fetched: Order[] = [];
            snapshot.forEach((doc) => {
              const data = doc.data();
              fetched.push({
                id: doc.id,
                status: data.status || "unknown",
                createdAt: data.createdAt,
                items: Array.isArray(data.items) ? data.items : [],
                subtotal: data.subtotal || 0,
                discount: data.discount || 0,
                finalTotal: data.finalTotal || 0,
                refundAmount: data.refundAmount || 0,
                pickupCoords: data.pickupCoords
                  ? {
                      latitude: data.pickupCoords.latitude,
                      longitude: data.pickupCoords.longitude,
                    }
                  : undefined,
                dropoffCoords: data.dropoffCoords
                  ? {
                      latitude: data.dropoffCoords.latitude,
                      longitude: data.dropoffCoords.longitude,
                    }
                  : undefined,
              });
            });

            const newOrdersString = JSON.stringify(fetched);
            if (oldOrders.current !== newOrdersString) {
              console.log("Orders changed. Updating state...");
              setOrders(fetched);
              oldOrders.current = newOrdersString;
            } else {
              console.log("Orders did not change. No setState call.");
            }
            setOrdersLoading(false);
          },
          (error) => {
            console.error("[Orders Snapshot] Error:", error);
            Alert.alert("Error", "Failed to fetch your orders.");
            setOrdersLoading(false);
          }
        );
    } else {
      console.log("[ProfileScreen] currentUser is null, skipping fetch...");
      setLoading(false);
    }

    return () => {
      if (unsubscribeUser) {
        console.log("[ProfileScreen] Unsubscribing user doc...");
        unsubscribeUser();
      }
      if (unsubscribeOrders) {
        console.log("[ProfileScreen] Unsubscribing orders...");
        unsubscribeOrders();
      }
    };
  }, [currentUser]);

  /** ----------------------------------------------
   *  HANDLE SAVE
   ---------------------------------------------- */
  const handleSave = async () => {
    if (!currentUser) return;
    try {
      setSaving(true);
      const dobStr = dob ? dob.toISOString().split("T")[0] : "";
      await firestore().collection("users").doc(currentUser.uid).update({
        name: userName.trim(),
        dob: dobStr,
      });
      Alert.alert("Saved", "Profile updated successfully!");
    } catch (error) {
      console.error("Error saving user info:", error);
      Alert.alert("Error", "Failed to save profile info.");
    } finally {
      setSaving(false);
    }
  };

  /** ----------------------------------------------
   *  HANDLE LOGOUT
   ---------------------------------------------- */
   const handleLogout = async () => {
    try {
      if (currentUser) {
        await firestore().collection("users").doc(currentUser.uid).update({
          isLoggedOut: true,
        });
      }
      await auth().signOut();
  
      // Force immediate navigation to Login
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "Login" }],
        })
      );
  
      // Optional: remove Alert or use a toast
      // Alert.alert("Logged Out", "You have successfully logged out.");
    } catch (error) {
      console.error("Error logging out:", error);
      Alert.alert("Error", "Failed to log out.");
    }
  };
  

  /** ----------------------------------------------
   *  DATE PICKER
   ---------------------------------------------- */
  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDob(selectedDate);
      oldDob.current = selectedDate.toISOString().split("T")[0];
    }
  };

  /** ----------------------------------------------
   *  NAVIGATE TO ORDER STATUS SCREEN
   ---------------------------------------------- */
  const navigateToOrderScreen = useCallback(
    (order: Order) => {
      console.log("[ProfileScreen] navigateToOrderScreen =>", order.id, order.status);

      const { status, id, pickupCoords, dropoffCoords, finalTotal, refundAmount } = order;
      if (!id) {
        Alert.alert("Error", "Invalid order ID.");
        return;
      }
      // If no coords, can't track or allocate
      if (!pickupCoords || !dropoffCoords) {
        Alert.alert("Error", "Order location details are missing.");
        return;
      }

      // Decide which screen to go to based on order status
      if (status === "pending") {
        console.log("[ProfileScreen] Navigating to OrderAllocating");
        navigation.navigate("OrderAllocating" as never, {
          orderId: id,
          pickupCoords,
          dropoffCoords,
          totalCost: finalTotal,
        } as never);
      } else if (status === "cancelled") {
        console.log("[ProfileScreen] Navigating to OrderCancelled");
        navigation.navigate("OrderCancelled" as never, {
          orderId: id,
          refundAmount: refundAmount || finalTotal,
        } as never);
      } else if (status === "tripEnded") {
        // Directly go to RatingScreen
        console.log("[ProfileScreen] Navigating directly to RatingScreen");
        navigation.navigate("RatingScreen" as never, {
          orderId: id,
        } as never);
      } else {
        // For other statuses => typically "active", "reachedPickup", etc.
        console.log("[ProfileScreen] Navigating to OrderTracking");
        navigation.navigate("OrderTracking" as never, {
          orderId: id,
          pickupCoords,
          dropoffCoords,
          totalCost: finalTotal,
        } as never);
      }
    },
    [navigation]
  );

  /** ----------------------------------------------
   *  OPEN DETAILS SHEET
   ---------------------------------------------- */
  const openDetailsModal = (order: Order) => {
    setSelectedOrder(order);
    setShowDetailsModal(true);
  };

  /** ----------------------------------------------
   *  RENDER ORDER ITEM
   ---------------------------------------------- */
  const renderOrderItem = ({ item }: { item: Order }) => {
    // Convert Firestore timestamp => JS Date
    const dateObj = item.createdAt?.toDate
      ? item.createdAt.toDate()
      : new Date(item.createdAt);
    const dateString = format(dateObj, "dd MMM, yyyy");
    const timeString = format(dateObj, "hh:mm a");

    return (
      <View style={styles.orderCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.orderId}>Order ID: {item.id}</Text>
          <Text style={styles.orderDate}>
            {dateString} at {timeString}
          </Text>
          <View style={styles.orderStatusContainer}>
            <Text style={styles.orderStatusLabel}>Status: </Text>
            <Text style={styles.orderStatusValue}>
              {item.status.toUpperCase()}
            </Text>
          </View>
          <View style={styles.orderActionRow}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: "#3498db" }]}
              onPress={() => navigateToOrderScreen(item)}
            >
              <Text style={styles.actionButtonText}>Go To Order</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: "#95a5a6" }]}
              onPress={() => openDetailsModal(item)}
            >
              <Text style={styles.actionButtonText}>View Details</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#666" />
      </View>
    );
  };

  /** ----------------------------------------------
   *  MAIN RENDER
   ---------------------------------------------- */
  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#28a745" />
      </View>
    );
  }

  if (!currentUser) {
    return (
      <View style={styles.notLoggedInContainer}>
        <Image
          source={require("../assets/ninja-logo.jpg")}
          style={styles.promptImage}
        />
        <Text style={styles.promptText}>
          Login to view and manage your profile
        </Text>
        <Button
          mode="contained"
          onPress={() => navigation.navigate("Login" as never)}
          style={{ backgroundColor: "#FF7043", marginTop: 16 }}
        >
          Login
        </Button>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <View style={styles.headerBlock}>
        <Text style={styles.mainTitle}>My Profile</Text>
        <Text style={styles.subTitle}>
          View and update your info, and see your recent orders
        </Text>
      </View>

      <View style={styles.profileCard}>
        <Image
          source={require("../assets/ninja-logo.jpg")}
          style={styles.profileImage}
        />
        <TextInput
          label="Name"
          value={userName}
          onChangeText={setUserName}
          mode="outlined"
          style={styles.input}
        />

        <Text style={styles.label}>Date of Birth</Text>
        <TouchableOpacity
          onPress={() => setShowDatePicker(true)}
          style={styles.dobSelect}
        >
          <Text style={{ color: dob ? "#333" : "#999" }}>
            {dob ? format(dob, "dd MMM yyyy") : "Select Date of Birth"}
          </Text>
          <MaterialIcons name="calendar-today" size={16} color="#555" />
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={dob || new Date()}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "calendar"}
            onChange={onDateChange}
            maximumDate={new Date()}
          />
        )}

        <View style={styles.btnRow}>
          <Button
            mode="contained"
            onPress={handleSave}
            loading={saving}
            style={styles.saveButton}
            labelStyle={{ color: "#fff" }}
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
          <Button
            mode="outlined"
            onPress={handleLogout}
            style={styles.logoutButton}
            labelStyle={{ color: "#e74c3c" }}
          >
            Logout
          </Button>
        </View>
      </View>

      <View style={styles.myOrdersHeader}>
        <Text style={styles.myOrdersTitle}>My Orders</Text>
        {ordersLoading && <ActivityIndicator size="small" color="#333" />}
      </View>

      {orders.length === 0 && !ordersLoading ? (
        <View style={styles.noOrdersContainer}>
          <Text style={styles.noOrdersText}>You have no orders yet.</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={renderOrderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10 }}
          style={{ marginTop: 10 }}
        />
      )}

      {/* Bottom Sheet Modal */}
      <Modal
        visible={showDetailsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDetailsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.bottomSheet}>
            <Text style={styles.bottomSheetTitle}>Order Details</Text>

            {selectedOrder ? (
              <View>
                <Text style={styles.sheetSubtitle}>
                  Order ID: {selectedOrder.id}
                </Text>
                {selectedOrder.createdAt && (
                  <Text style={styles.sheetSubtitle}>
                    Date:{" "}
                    {format(
                      selectedOrder.createdAt.toDate
                        ? selectedOrder.createdAt.toDate()
                        : new Date(selectedOrder.createdAt),
                      "dd MMM yyyy, hh:mm a"
                    )}
                  </Text>
                )}

                {Array.isArray(selectedOrder.items) &&
                selectedOrder.items.length > 0 ? (
                  <FlatList
                    data={selectedOrder.items}
                    keyExtractor={(it, idx) =>
                      it?.name ? it.name + idx : `item-${idx}`
                    }
                    renderItem={({ item }) => {
                      if (typeof item !== "object" || item === null) {
                        console.warn("Invalid item data:", item);
                        return null;
                      }
                      const realPrice = item.discount
                        ? item.price - item.discount
                        : item.price;
                      return (
                        <View style={styles.detailItemRow}>
                          <Text style={styles.detailItemName}>{item.name}</Text>
                          <Text style={styles.detailItemQty}>
                            x{item.quantity}
                          </Text>
                          <Text style={styles.detailItemPrice}>
                            ₹{realPrice.toFixed(2)}
                          </Text>
                        </View>
                      );
                    }}
                    style={{ maxHeight: 150, marginVertical: 8 }}
                    ListEmptyComponent={
                      <Text style={{ marginVertical: 8, color: "#666" }}>
                        No items found for this order.
                      </Text>
                    }
                  />
                ) : (
                  <Text style={{ marginVertical: 8, color: "#666" }}>
                    No items found for this order.
                  </Text>
                )}

                <View style={styles.billSummaryContainer}>
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Subtotal</Text>
                    <Text style={styles.billValue}>
                      ₹{selectedOrder.subtotal?.toFixed(2) || "0.00"}
                    </Text>
                  </View>

                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>Discount</Text>
                    <Text style={styles.billValue}>
                      -₹{selectedOrder.discount}
                    </Text>
                  </View>

                  <View style={styles.billRow}>
                    <Text style={[styles.billLabel, { fontWeight: "700" }]}>
                      Total
                    </Text>
                    <Text
                      style={[styles.billValue, { fontWeight: "700" }]}
                    >
                      ₹{selectedOrder.finalTotal?.toFixed(2) || "0.00"}
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <Text>No order selected</Text>
            )}

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowDetailsModal(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

export default ProfileScreen;

/****************************************
 *          STYLES
 ****************************************/
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fefefe",
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  notLoggedInContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    backgroundColor: "#fff",
  },
  promptImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 20,
  },
  promptText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    textAlign: "center",
    marginBottom: 16,
  },
  headerBlock: {
    backgroundColor: pastelGreen,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderBottomRightRadius: 24,
    borderBottomLeftRadius: 24,
  },
  mainTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: primaryTextColor,
    marginBottom: 5,
  },
  subTitle: {
    fontSize: 13,
    color: "#666",
  },
  profileCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: -30,
    padding: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#f9f9f9",
    alignSelf: "center",
    marginBottom: 16,
  },
  input: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
  },
  dobSelect: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    marginBottom: 16,
  },
  btnRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  saveButton: {
    flex: 1,
    marginRight: 8,
    backgroundColor: "#28a745",
  },
  logoutButton: {
    flex: 1,
    marginLeft: 8,
    borderColor: "#e74c3c",
  },
  myOrdersHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    paddingHorizontal: 16,
    justifyContent: "space-between",
  },
  myOrdersTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
  },
  noOrdersContainer: {
    marginTop: 20,
    alignItems: "center",
  },
  noOrdersText: {
    fontSize: 14,
    color: "#999",
  },
  orderCard: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#eee",
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    elevation: 1,
  },
  orderId: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
  },
  orderDate: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  orderStatusContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 6,
  },
  orderStatusLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#555",
  },
  orderStatusValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#27ae60",
  },
  orderActionRow: {
    flexDirection: "row",
    marginTop: 8,
  },
  actionButton: {
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  bottomSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: "80%",
  },
  bottomSheetTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
    color: "#333",
  },
  sheetSubtitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
    marginTop: 2,
  },
  detailItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
    backgroundColor: "#f9f9f9",
    borderRadius: 4,
    padding: 6,
  },
  detailItemName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
  },
  detailItemQty: {
    fontSize: 13,
    fontWeight: "500",
    color: "#555",
  },
  detailItemPrice: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
  },
  billSummaryContainer: {
    marginTop: 10,
    padding: 8,
    backgroundColor: pastelGreen,
    borderRadius: 6,
  },
  billRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  billLabel: {
    fontSize: 14,
    color: "#333",
  },
  billValue: {
    fontSize: 14,
    color: "#333",
  },
  closeButton: {
    backgroundColor: "#e74c3c",
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 16,
  },
  closeButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
});
