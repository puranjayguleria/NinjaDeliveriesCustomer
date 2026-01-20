// screens/NinjaEatsProfileScreen.tsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Easing,
  Animated,
  Vibration,
  ScrollView,
  FlatList,
  Platform,
  Modal,
  TextInput as RNTextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import auth, { FirebaseAuthTypes } from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { Button, TextInput } from "react-native-paper";
import { CommonActions, useNavigation } from "@react-navigation/native";
import { format } from "date-fns";
import Loader from "@/components/VideoLoader";

const ninjaOrange = "#FF6B35";
const pastelOrange = "#FFF4F0";
const primaryTextColor = "#D84315";

interface RestaurantOrder {
  id: string;
  status: string;
  createdAt: any;
  items?: Array<{
    name: string;
    price: number;
    discount?: number;
    quantity: number;
  }>;
  subtotal?: number;
  discount?: number;
  finalTotal?: number;
  refundAmount?: number;
  restaurantName?: string;
  deliveryAddress?: string;
  estimatedDeliveryTime?: string;
}

const NinjaEatsProfileScreen: React.FC = () => {
  const navigation = useNavigation();
  const currentUser = auth().currentUser;

  // Profile UI state
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [userName, setUserName] = useState<string>("");
  const [dob, setDob] = useState<Date | null>(null);

  // Restaurant Orders
  const [orders, setOrders] = useState<RestaurantOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState<boolean>(false);

  // For date pickers
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [showIosModal, setShowIosModal] = useState<boolean>(false);

  // Order details modal
  const [selectedOrder, setSelectedOrder] = useState<RestaurantOrder | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);

  // Keep old state for minimal re-renders
  const oldUserName = useRef<string>("");
  const oldDob = useRef<string>("");
  const oldOrders = useRef<string>("");

  // Re-auth flow states
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [reauthOTP, setReauthOTP] = useState("");
  const [reauthConfirm, setReauthConfirm] = useState<any>(null);
  const [reauthLoading, setReauthLoading] = useState(false);

  useEffect(() => {
    console.log("[NinjaEatsProfileScreen] currentUser:", currentUser?.uid);
  }, [currentUser?.uid]);

  /** Listen to user doc + restaurant orders */
  useEffect(() => {
    let unsubscribeUser: any;
    let unsubscribeOrders: any;
    let timeoutId: NodeJS.Timeout;

    // Add a small delay to ensure Firebase auth is fully initialized
    timeoutId = setTimeout(() => {
      if (currentUser && currentUser.uid) {
        console.log("[NinjaEatsProfileScreen] Setting up listeners for user:", currentUser.uid);
        
        // 1) Listen to user doc
        unsubscribeUser = firestore()
          .collection("users")
          .doc(currentUser.uid)
          .onSnapshot(
          (doc) => {
            if (doc.exists) {
              const data = doc.data();
              const newName = data?.name || "";
              if (oldUserName.current !== newName) {
                setUserName(newName);
                oldUserName.current = newName;
              }

              const rawDob = data?.dob || "";
              if (rawDob && oldDob.current !== rawDob) {
                const newDate = new Date(rawDob);
                setDob(newDate);
                oldDob.current = rawDob;
              }
            }
            setLoading(false);
          },
          (error) => {
            Alert.alert("Error", "Failed to fetch user info.");
            setLoading(false);
          }
        );

      // 2) Listen to restaurant orders only
      setOrdersLoading(true);
      unsubscribeOrders = firestore()
        .collection("restaurantOrders")
        .where("orderedBy", "==", currentUser.uid)
        // .orderBy("createdAt", "desc") // Temporarily commented out until Firestore index is created
        .onSnapshot(
          (snapshot) => {
            const fetched: RestaurantOrder[] = [];
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
                restaurantName: data.restaurantName || "Unknown Restaurant",
                deliveryAddress: data.deliveryAddress || "",
                estimatedDeliveryTime: data.estimatedDeliveryTime || "",
              });
            });

            // Sort by createdAt on client side since we can't use orderBy without index
            fetched.sort((a, b) => {
              const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
              const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
              return bTime - aTime; // Descending order (newest first)
            });

            const newOrdersString = JSON.stringify(fetched);
            if (oldOrders.current !== newOrdersString) {
              setOrders(fetched);
              oldOrders.current = newOrdersString;
            }
            setOrdersLoading(false);
          },
          (error) => {
            console.error("[NinjaEatsProfileScreen] Orders fetch error:", error);
            console.error("[NinjaEatsProfileScreen] Error code:", error.code);
            console.error("[NinjaEatsProfileScreen] Error message:", error.message);
            
            // Only show alert if it's not a permission issue or missing collection (common for new users)
            if (error.code !== 'permission-denied' && error.code !== 'failed-precondition' && error.code !== 'not-found') {
              Alert.alert("Error", "Failed to fetch your restaurant orders.");
            } else {
              console.log("[NinjaEatsProfileScreen] Expected error for new user - no orders collection or permissions:", error.code);
            }
            setOrdersLoading(false);
          }
        );
      } else {
        setLoading(false);
      }
    }, 500); // 500ms delay to ensure Firebase is ready

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (unsubscribeUser) unsubscribeUser();
      if (unsubscribeOrders) unsubscribeOrders();
    };
  }, [currentUser]);

  /** Save user changes */
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
      Alert.alert("Error", "Failed to save profile info.");
    } finally {
      setSaving(false);
    }
  };

  /** Logout */
  const handleLogout = async () => {
    try {
      if (currentUser) {
        await firestore()
          .collection("users")
          .doc(currentUser.uid)
          .update({ isLoggedOut: true });
      }
      await auth().signOut();
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "NinjaEatsTabs" }],
        })
      );
    } catch (error) {
      Alert.alert("Error", "Failed to log out.");
    }
  };

  /** Re-auth if needed => phone flow in a modal. */
  const doPhoneReauth = async (phoneNumber: string) => {
    let finalNumber = phoneNumber.startsWith("+91")
      ? phoneNumber
      : "+91" + phoneNumber.replace("+91", "");
    setReauthLoading(true);
    try {
      const confirmationResult = await auth().signInWithPhoneNumber(
        finalNumber
      );
      setReauthConfirm(confirmationResult);
      setShowReauthModal(true);
    } catch (err) {
      Alert.alert("Error", "Failed to send OTP for re-auth. Try again.");
      console.log("Error in doPhoneReauth:", err);
    } finally {
      setReauthLoading(false);
    }
  };

  const handleConfirmReauthOTP = async () => {
    if (!reauthConfirm) {
      Alert.alert("Error", "No re-auth flow in progress.");
      return;
    }
    try {
      setReauthLoading(true);
      await reauthConfirm.confirm(reauthOTP);
      await finalizeDelete();
      setShowReauthModal(false);
    } catch (err) {
      console.log("Error confirming reauth OTP:", err);
      Alert.alert("Error", "Invalid OTP. Please try again.");
    } finally {
      setReauthLoading(false);
    }
  };

  /** Finalizing the account delete once re-auth is successful */
  const finalizeDelete = async () => {
    if (!currentUser) return;
    await firestore().collection("users").doc(currentUser.uid).delete();
    await currentUser.delete();

    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "NinjaEatsTabs" }],
      })
    );
  };

  /** Attempt direct delete => if 'requires-recent-login', do phone reauth flow. */
  const attemptDelete = async () => {
    if (!currentUser) {
      Alert.alert("Error", "No user is currently logged in.");
      return;
    }
    try {
      await currentUser.delete();
      await firestore().collection("users").doc(currentUser.uid).delete();
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "NinjaEatsTabs" }],
        })
      );
    } catch (error: any) {
      console.log("Error in attemptDelete user:", error);
      if (error.code === "auth/requires-recent-login") {
        try {
          const userDoc = await firestore()
            .collection("users")
            .doc(currentUser.uid)
            .get();
          if (!userDoc.exists) {
            Alert.alert("Error", "No user doc found to re-auth phone number.");
            return;
          }
          const phone = userDoc.data()?.phoneNumber;
          if (!phone) {
            Alert.alert("Error", "Phone number missing, cannot re-auth.");
            return;
          }
          await doPhoneReauth(phone);
        } catch (err) {
          Alert.alert(
            "Error",
            "Failed to start re-auth flow. Please try again."
          );
          console.log("Error reading phone from user doc:", err);
        }
      } else {
        Alert.alert("Error", "Failed to delete account. Please try again.");
      }
    }
  };

  /** HANDLE DELETE ACCOUNT */
  const handleDeleteAccount = async () => {
    if (!currentUser) {
      Alert.alert("Error", "No user is currently logged in.");
      return;
    }
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await attemptDelete();
          },
        },
      ]
    );
  };

  /** Reward section animation */
  const scaleValue = new Animated.Value(1);
  const rotateValue = new Animated.Value(0);

  useEffect(() => {
    // Continuous subtle animation
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.spring(scaleValue, {
            toValue: 1.05,
            friction: 3,
            useNativeDriver: true,
          }),
          Animated.spring(scaleValue, {
            toValue: 1,
            friction: 5,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(rotateValue, {
          toValue: 1,
          duration: 10000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Initial pop effect
    scaleValue.setValue(0.5);
    Animated.spring(scaleValue, {
      toValue: 1,
      friction: 6,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, []);

  const rotateInterpolate = rotateValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["-3deg", "3deg"],
  });

  const handleRewardPress = () => {
    Vibration.vibrate(50);
    navigation.navigate("RewardScreen");
  };

  /** For date picking */
  const openDatePicker = () => {
    if (Platform.OS === "ios") {
      setShowIosModal(true);
    } else {
      setShowDatePicker(true);
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") setShowDatePicker(false);
    if (selectedDate) setDob(selectedDate);
  };

  const handleIosDone = () => setShowIosModal(false);

  /** Navigate to restaurant order screen based on status */
  const navigateToOrderScreen = useCallback(
    (order: RestaurantOrder) => {
      const { status, id } = order;
      if (!id) {
        Alert.alert("Error", "Invalid order ID.");
        return;
      }

      // Navigate to NinjaEats order detail screen
      navigation.navigate("OrdersTab", {
        screen: "NinjaEatsOrderDetail",
        params: { orderId: id },
      });
    },
    [navigation]
  );

  const openDetailsModal = (order: RestaurantOrder) => {
    setSelectedOrder(order);
    setShowDetailsModal(true);
  };

  /** RENDER RESTAURANT ORDER ITEM */
  const renderOrderItem = ({ item }: { item: RestaurantOrder }) => {
    const dateObj = item.createdAt?.toDate
      ? item.createdAt.toDate()
      : new Date(item.createdAt);
    const dateString = format(dateObj, "dd MMM, yyyy");
    const timeString = format(dateObj, "hh:mm a");

    return (
      <View style={styles.orderCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.restaurantName}>{item.restaurantName}</Text>
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
              style={[styles.actionButton, { backgroundColor: ninjaOrange }]}
              onPress={() => navigateToOrderScreen(item)}
            >
              <Text style={styles.actionButtonText}>Track Order</Text>
              <Ionicons
                name="arrow-forward"
                size={16}
                color="#fff"
                style={{ marginLeft: 4 }}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: "#95a5a6" }]}
              onPress={() => openDetailsModal(item)}
            >
              <Text style={styles.actionButtonText}>View Details</Text>
              <Ionicons
                name="list"
                size={16}
                color="#fff"
                style={{ marginLeft: 4 }}
              />
            </TouchableOpacity>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#666" />
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <Loader />
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
          Login to view and manage your Ninja Eats profile
        </Text>
        <Button
          mode="contained"
          onPress={() => navigation.navigate("AppTabs", { 
            screen: "HomeTab", 
            params: { screen: "LoginInHomeStack" } 
          })}
          style={{ backgroundColor: ninjaOrange, marginTop: 16 }}
        >
          Login
        </Button>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View style={styles.headerBlock}>
          <Text style={styles.mainTitle}>Ninja Eats Profile</Text>
          <MaterialIcons name="restaurant" size={24} color={primaryTextColor} />
        </View>

        <View style={styles.profileCard}>
          <Image
            source={require("../assets/ninja-logo.jpg")}
            style={styles.profileImage}
          />

          {/* Section header for user details */}
          <Text style={styles.sectionHeader}>Personal Information</Text>

          {/* Name Input */}
          <TextInput
            label="Full Name"
            value={userName}
            onChangeText={setUserName}
            mode="outlined"
            style={styles.input}
            theme={{ colors: { primary: ninjaOrange } }}
          />

          <Text style={styles.label}>Date of Birth</Text>
          <TouchableOpacity onPress={openDatePicker} style={styles.dobSelect}>
            <Text style={{ color: dob ? "#333" : "#999" }}>
              {dob ? format(dob, "dd MMM yyyy") : "Select Date of Birth"}
            </Text>
            <MaterialIcons name="calendar-today" size={16} color="#555" />
          </TouchableOpacity>

          {/* Android Date Picker */}
          {showDatePicker && Platform.OS === "android" && (
            <DateTimePicker
              value={dob || new Date()}
              mode="date"
              display="calendar"
              onChange={onDateChange}
              maximumDate={new Date()}
            />
          )}

          {/* iOS Date Picker in Modal */}
          {Platform.OS === "ios" && (
            <Modal
              visible={showIosModal}
              transparent
              animationType="slide"
              onRequestClose={() => setShowIosModal(false)}
            >
              <View style={styles.modalOverlayDate}>
                <View style={styles.modalContainerDate}>
                  <View style={styles.iosPickerHeader}>
                    <TouchableOpacity onPress={() => setShowIosModal(false)}>
                      <Text style={styles.doneButtonText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                  <DateTimePicker
                    themeVariant="light"
                    value={dob || new Date()}
                    mode="date"
                    display="spinner"
                    onChange={onDateChange}
                    maximumDate={new Date()}
                    style={{ backgroundColor: "#fff" }}
                  />
                </View>
              </View>
            </Modal>
          )}

          {/* Save Changes Button */}
          <Button
            icon={() => <Ionicons name="save" size={18} color="#fff" />}
            mode="contained"
            onPress={handleSave}
            loading={saving}
            style={[styles.fullWidthButton, { backgroundColor: ninjaOrange }]}
            labelStyle={{ color: "#fff" }}
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>

          {/* Restaurant-specific features */}
          <View style={styles.restaurantFeaturesSection}>
            <Text style={styles.sectionHeader}>Restaurant Features</Text>
            
            <TouchableOpacity style={styles.featureButton}>
              <MaterialIcons name="favorite" size={20} color={ninjaOrange} />
              <Text style={styles.featureButtonText}>Favorite Restaurants</Text>
              <Ionicons name="chevron-forward" size={16} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.featureButton}>
              <MaterialIcons name="history" size={20} color={ninjaOrange} />
              <Text style={styles.featureButtonText}>Order History</Text>
              <Ionicons name="chevron-forward" size={16} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.featureButton}>
              <MaterialIcons name="location-on" size={20} color={ninjaOrange} />
              <Text style={styles.featureButtonText}>Saved Addresses</Text>
              <Ionicons name="chevron-forward" size={16} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.featureButton}>
              <MaterialIcons name="payment" size={20} color={ninjaOrange} />
              <Text style={styles.featureButtonText}>Payment Methods</Text>
              <Ionicons name="chevron-forward" size={16} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Logout Button */}
          <Button
            icon={() => (
              <Ionicons name="log-out-outline" size={18} color="#e74c3c" />
            )}
            mode="outlined"
            onPress={handleLogout}
            style={styles.fullWidthButton}
            labelStyle={{ color: "#e74c3c" }}
          >
            Logout
          </Button>

          {/* Delete Account Button */}
          <TouchableOpacity
            style={[
              styles.fullWidthButtonTouchable,
              { backgroundColor: "#e74c3c" },
            ]}
            onPress={handleDeleteAccount}
          >
            <Ionicons
              name="trash"
              size={16}
              color="#fff"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.deleteAccountButtonText}>Delete Account</Text>
          </TouchableOpacity>
        </View>

        {/* Premium Reward Section */}
        <View style={styles.rewardSectionContainer}>
          <Animated.View
            style={[
              styles.rewardButtonContainer,
              {
                transform: [
                  { scale: scaleValue },
                  { rotate: rotateInterpolate },
                ],
              },
            ]}
          >
            <TouchableOpacity
              onPress={handleRewardPress}
              activeOpacity={0.7}
              style={styles.rewardTouchable}
            >
              <Image
                source={require("../assets/rewards.png")}
                style={styles.rewardIconPremium}
              />
            </TouchableOpacity>
          </Animated.View>
          <Text style={styles.rewardText}>Rewards</Text>
        </View>

        {/* My Restaurant Orders Header */}
        <View style={styles.myOrdersHeader}>
          <Text style={styles.myOrdersTitle}>My Restaurant Orders</Text>
          {ordersLoading && <Loader />}
        </View>

        {orders.length === 0 && !ordersLoading ? (
          <View style={styles.noOrdersContainer}>
            <MaterialIcons name="restaurant" size={48} color="#ccc" />
            <Text style={styles.noOrdersText}>No restaurant orders yet.</Text>
            <Text style={styles.noOrdersSubtext}>Order from your favorite restaurants!</Text>
          </View>
        ) : (
          <FlatList
            data={orders}
            keyExtractor={(item) => item.id}
            renderItem={renderOrderItem}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 10,
              flexGrow: 1,
            }}
            scrollEnabled={false}
            style={{ marginTop: 10 }}
          />
        )}

        {/* Restaurant Order Details Modal */}
        <Modal
          visible={showDetailsModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDetailsModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.bottomSheet}>
              <Text style={styles.bottomSheetTitle}>Restaurant Order Details</Text>

              {selectedOrder ? (
                <>
                  <View>
                    <Text style={styles.sheetSubtitle}>
                      Restaurant: {selectedOrder.restaurantName}
                    </Text>
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
                    {selectedOrder.estimatedDeliveryTime && (
                      <Text style={styles.sheetSubtitle}>
                        Estimated Delivery: {selectedOrder.estimatedDeliveryTime}
                      </Text>
                    )}
                  </View>

                  <ScrollView style={{ maxHeight: 300, marginVertical: 8 }}>
                    {/* Item List */}
                    {Array.isArray(selectedOrder.items) &&
                    selectedOrder.items.length > 0 ? (
                      selectedOrder.items.map((item: any, idx: number) => {
                        const price = Number(item.price) || 0;
                        const discount = Number(item.discount) || 0;
                        const realPrice = price - discount;

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
                              ₹{realPrice.toFixed(2)}
                            </Text>
                          </View>
                        );
                      })
                    ) : (
                      <Text>No items found</Text>
                    )}

                    {/* BILL SUMMARY */}
                    <View style={styles.billSummaryContainer}>
                      <View style={styles.billRow}>
                        <Text style={styles.billLabel}>Subtotal</Text>
                        <Text style={styles.billValue}>
                          ₹{(selectedOrder.subtotal || 0).toFixed(2)}
                        </Text>
                      </View>

                      {typeof selectedOrder.discount !== "undefined" && (
                        <View style={styles.billRow}>
                          <Text style={styles.billLabel}>Discount</Text>
                          <Text style={styles.billValue}>
                            -₹{(selectedOrder.discount || 0).toFixed(2)}
                          </Text>
                        </View>
                      )}

                      <View style={styles.billRow}>
                        <Text style={[styles.billLabel, { fontWeight: "700" }]}>
                          Total
                        </Text>
                        <Text style={[styles.billValue, { fontWeight: "700" }]}>
                          ₹{selectedOrder.finalTotal?.toFixed(2) || "0.00"}
                        </Text>
                      </View>
                    </View>
                  </ScrollView>

                  <TouchableOpacity
                    style={[styles.closeButton, { backgroundColor: ninjaOrange }]}
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
      </ScrollView>

      {/* RE-AUTH MODAL FOR PHONE OTP */}
      <Modal
        visible={showReauthModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReauthModal(false)}
      >
        <View style={styles.reauthOverlay}>
          <View style={styles.reauthContainer}>
            <Text style={styles.reauthTitle}>Re-authenticate to Delete</Text>
            <Text style={styles.reauthSubtitle}>
              Enter the OTP sent to your phone to confirm account deletion.
            </Text>

            <RNTextInput
              style={styles.reauthOTPInput}
              placeholder="OTP"
              keyboardType="number-pad"
              value={reauthOTP}
              onChangeText={setReauthOTP}
              placeholderTextColor="#999"
            />

            {reauthLoading ? (
              <Loader />
            ) : (
              <>
                <TouchableOpacity
                  style={styles.reauthConfirmButton}
                  onPress={handleConfirmReauthOTP}
                >
                  <Text style={styles.reauthConfirmButtonText}>
                    Confirm OTP
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.reauthCancelButton}
                  onPress={() => {
                    setShowReauthModal(false);
                    setReauthOTP("");
                  }}
                >
                  <Text style={styles.reauthCancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
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
    backgroundColor: pastelOrange,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderBottomRightRadius: 24,
    borderBottomLeftRadius: 24,
    marginBottom: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mainTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: primaryTextColor,
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
  sectionHeader: {
    fontSize: 15,
    fontWeight: "bold",
    color: primaryTextColor,
    marginBottom: 10,
    textAlign: "left",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
  },
  input: {
    marginBottom: 12,
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
  restaurantFeaturesSection: {
    marginTop: 20,
    marginBottom: 20,
  },
  featureButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  featureButtonText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  fullWidthButton: {
    width: "100%",
    marginVertical: 6,
  },
  fullWidthButtonTouchable: {
    width: "100%",
    marginVertical: 6,
    borderRadius: 6,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteAccountButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  rewardSectionContainer: {
    justifyContent: "center",
    alignItems: "flex-start",
    marginHorizontal: 30,
    marginVertical: 25,
    paddingTop: 10,
  },
  rewardButtonContainer: {
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 15,
    marginBottom: 8,
  },
  rewardTouchable: {
    position: "relative",
  },
  rewardIconPremium: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#FFF",
  },
  rewardText: {
    color: "#333",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.5,
    textShadowColor: "rgba(255, 215, 0, 0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
    color: primaryTextColor,
  },
  noOrdersContainer: {
    marginTop: 20,
    alignItems: "center",
    paddingVertical: 40,
  },
  noOrdersText: {
    fontSize: 16,
    color: "#666",
    marginTop: 12,
    fontWeight: "500",
  },
  noOrdersSubtext: {
    fontSize: 14,
    color: "#999",
    marginTop: 4,
  },
  orderCard: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e9ecef",
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    elevation: 1,
  },
  restaurantName: {
    fontSize: 15,
    fontWeight: "700",
    color: primaryTextColor,
    marginBottom: 2,
  },
  orderId: {
    fontSize: 13,
    fontWeight: "600",
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
    color: ninjaOrange,
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
    flexDirection: "row",
    alignItems: "center",
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
    color: primaryTextColor,
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
    backgroundColor: pastelOrange,
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
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 16,
  },
  closeButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  modalOverlayDate: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContainerDate: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  iosPickerHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    padding: 12,
    backgroundColor: "#fefefe",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  doneButtonText: {
    color: ninjaOrange,
    fontSize: 16,
    fontWeight: "600",
  },
  reauthOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  reauthContainer: {
    width: "85%",
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 10,
    alignItems: "center",
  },
  reauthTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },
  reauthSubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 10,
  },
  reauthOTPInput: {
    width: "80%",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    textAlign: "center",
    fontSize: 16,
    marginBottom: 10,
  },
  reauthConfirmButton: {
    backgroundColor: "#e74c3c",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
    marginBottom: 10,
  },
  reauthConfirmButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  reauthCancelButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e74c3c",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
  },
  reauthCancelButtonText: {
    color: "#e74c3c",
    fontWeight: "600",
  },
});

export default NinjaEatsProfileScreen;