// ProfileScreen.tsx

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
  Easing,
  Animated,
  Vibration,
  ScrollView,
  FlatList,
  Platform,
  Modal,
  TextInput as RNTextInput, // rename to avoid confusion
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
import { LinearGradient } from "expo-linear-gradient";

const pastelGreen = "#e7f8f6";
const primaryTextColor = "#333";

/** Order interface for your reference */
interface Order {
  id: string;
  status: string;
  createdAt: any; // Firestore Timestamp
  items?: Array<{
    name: string;
    price: number;
    discount?: number;
    quantity: number;
  }>;
  subtotal?: number;
  discount?: number;
  productCgst?: number;
  productSgst?: number;
  rideCgst?: number;
  deliveryCharge?: number;
  rideSgst?: number;
  finalTotal?: number;
  pickupCoords?: { latitude: number; longitude: number };
  dropoffCoords?: { latitude: number; longitude: number };
  refundAmount?: number;
  convenienceFee?: number;
  platformFee?: number;
  surgeFee?: number;
  paymentMethod?: string;
  paymentStatus?: string;
  deliveryAddress?: string;
  mobile?: string;
  storeName?: string;
}

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation();
  const currentUser = auth().currentUser;
  const memberSinceYear =
    currentUser?.metadata?.creationTime
      ? new Date(currentUser.metadata.creationTime).getFullYear()
      : new Date().getFullYear();

  // Profile UI state
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [userName, setUserName] = useState<string>("");
  const [dob, setDob] = useState<Date | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Orders
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState<boolean>(false);

  // For date pickers
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [showIosModal, setShowIosModal] = useState<boolean>(false);

  // Order details modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
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
    console.log("[ProfileScreen] currentUser:", currentUser?.uid);
  }, [currentUser?.uid]);

  /** ----------------------------------------------
   *  ON MOUNT => Listen to user doc + orders
   ---------------------------------------------- */
  useEffect(() => {
    let unsubscribeUser: any;
    let unsubscribeOrders: any;

    if (currentUser) {
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

      // 2) Listen to orders
      setOrdersLoading(true);
      unsubscribeOrders = firestore()
        .collection("orders")
        .where("orderedBy", "==", currentUser.uid)
        .orderBy("createdAt", "desc")
        .onSnapshot(
          (snapshot) => {
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

                // New Additional Fields
                surgeFee: data.surgeFee || 0,
                productCgst: data.productCgst || 0,
                productSgst: data.productSgst || 0,
                rideCgst: data.rideCgst || 0,
                rideSgst: data.rideSgst || 0,
                deliveryCharge: data.deliveryCharge || 0,
                convenienceFee: data.convenienceFee || 0,
                platformFee: data.platformFee || 0,
                paymentMethod: data.paymentMethod || "",
                paymentStatus: data.paymentStatus || "",
                deliveryAddress: data.deliveryAddress || "",
                mobile: data.mobile || "",
                storeName: data.storeName || "",

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
              setOrders(fetched);
              oldOrders.current = newOrdersString;
            }
            setOrdersLoading(false);
          },
          (error) => {
            Alert.alert("Error", "Failed to fetch your orders.");
            setOrdersLoading(false);
          }
        );
    } else {
      setLoading(false);
    }

    return () => {
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
      setIsEditing(false);
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
          routes: [{ name: "AppTabs" }],
        })
      );
    } catch (error) {
      Alert.alert("Error", "Failed to log out.");
    }
  };

  /** Re-auth if needed => phone flow in a modal. */
  const doPhoneReauth = async (phoneNumber: string) => {
    let finalNumber = phoneNumber.trim();
    // Robust formatting for E.164
    if (finalNumber.startsWith("+")) {
      finalNumber = finalNumber.replace(/[\s-()]/g, "");
    } else {
      const digits = finalNumber.replace(/\D/g, "");
      if (digits.length === 10) {
        finalNumber = `+91${digits}`;
      } else if (digits.length === 12 && digits.startsWith("91")) {
        finalNumber = `+${digits}`;
      } else {
        finalNumber = `+91${digits}`;
      }
    }

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

      // user re-authenticated => finalize delete
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
        routes: [{ name: "AppTabs" }],
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
      // If the user can be deleted => success => remove doc + navigate away
      await currentUser.delete();
      await firestore().collection("users").doc(currentUser.uid).delete();
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "AppTabs" }],
        })
      );
    } catch (error: any) {
      console.log("Error in attemptDelete user:", error);
      if (error.code === "auth/requires-recent-login") {
        // Must do phone re-auth => fetch phone from doc
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
  /**Reward section */
  const scaleValue = useRef(new Animated.Value(1)).current;
  const rotateValue = useRef(new Animated.Value(0)).current;

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

  const handlePress = () => {
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

  /** Navigate to order screen based on status */
  const navigateToOrderScreen = useCallback(
    (order: Order) => {
      const {
        status,
        id,
        pickupCoords,
        dropoffCoords,
        finalTotal,
        refundAmount,
      } = order;
      if (!id) {
        Alert.alert("Error", "Invalid order ID.");
        return;
      }
      if (!pickupCoords || !dropoffCoords) {
        Alert.alert("Error", "Order location details are missing.");
        return;
      }

      // Direct which screen to go to
      if (status === "pending") {
        navigation.navigate("HomeTab", {
          screen: "OrderAllocating",
          params: {
            orderId: id,
            pickupCoords,
            dropoffCoords,
            totalCost: finalTotal,
          },
        });
      } else if (status === "cancelled") {
        navigation.navigate("HomeTab", {
          screen: "OrderCancelled",
          params: { orderId: id, refundAmount: refundAmount || finalTotal },
        });
      } else if (status === "tripEnded") {
        navigation.navigate("HomeTab", {
          screen: "RatingScreen",
          params: { orderId: id },
        });
      } else {
        /* active / reachedPickup / etc. */
        navigation.navigate("HomeTab", {
          screen: "OrderTracking",
          params: {
            orderId: id,
            pickupCoords,
            dropoffCoords,
            totalCost: finalTotal,
          },
        });
      }
    },
    [navigation]
  );

  const openDetailsModal = (order: Order) => {
    setSelectedOrder(order);
    setShowDetailsModal(true);
  };

  /** RENDER ORDER ITEM */
  const renderOrderItem = ({ item }: { item: Order }) => {
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
          Login to view and manage your profile
        </Text>
        <Button
          mode="contained"
          onPress={() =>
            navigation.navigate("AppTabs", {
              screen: "HomeTab",
              params: { screen: "LoginInHomeStack" },
            })
          }
          style={{ backgroundColor: "#FF7043", marginTop: 16 }}
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
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ position: "absolute", left: 16, top: "50%", marginTop: -12, zIndex: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.mainTitle}>My Profile</Text>


        </View>

        <View style={styles.profileCard}>
          <Image
            source={require("../assets/ninja-logo.jpg")}
            style={styles.profileImage}
          />

          <TouchableOpacity
            onPress={() => setIsEditing(true)}
            style={styles.editButton}
          >
            <Text style={styles.editButtonText}>Edit Details</Text>
          </TouchableOpacity>

          <Text style={styles.profileName}>{userName || "John Doe"}</Text>
          <Text style={styles.memberSince}>Member since {memberSinceYear}</Text>

          {isEditing && (
            <>
              <Text style={styles.sectionHeader}>User Details</Text>
              <TextInput
                label="Name"
                value={userName}
                onChangeText={setUserName}
                mode="outlined"
                style={styles.input}
                outlineColor="#ddd"
                activeOutlineColor="#5b2ecc"
              />

              <Text style={styles.label}>Date of Birth</Text>
              <TouchableOpacity
                onPress={openDatePicker}
                style={styles.dobSelect}
              >
                <Text style={{ color: dob ? "#333" : "#999" }}>
                  {dob ? format(dob, "dd MMM yyyy") : "Select Date of Birth"}
                </Text>
                <MaterialIcons name="calendar-today" size={16} color="#555" />
              </TouchableOpacity>

              {showDatePicker && Platform.OS === "android" && (
                <DateTimePicker
                  value={dob || new Date()}
                  mode="date"
                  display="calendar"
                  onChange={onDateChange}
                  maximumDate={new Date()}
                />
              )}

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
            </>
          )}

          {/* Full-width "Save Changes" with icon */}
          <Button
            icon={() => <Ionicons name="save" size={18} color="#fff" />}
            mode="contained"
            onPress={handleSave}
            loading={saving}
            style={[styles.fullWidthButton, styles.saveButton]}
            labelStyle={{ color: "#fff" }}
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>

          {/* Full-width "Logout" with icon */}
          <Button
            icon={() => (
              <Ionicons name="log-out-outline" size={18} color="#e74c3c" />
            )}
            mode="outlined"
            onPress={() =>
              Alert.alert("Logout", "Are you sure you want to logout?", [
                { text: "Cancel", style: "cancel" },
                { text: "Logout", style: "destructive", onPress: handleLogout },
              ])
            }
            style={[styles.fullWidthButton, styles.outlinedButton]}
            labelStyle={{ color: "#e74c3c" }}
          >
            Logout
          </Button>

          {/* Full-width "Contact Us" */}
          <TouchableOpacity
            style={[styles.fullWidthButtonTouchable, styles.contactButton]}
            onPress={() => navigation.navigate("ContactUs" as never)}
          >
            <Ionicons
              name="call-outline"
              size={16}
              color="#333"
              style={{ marginRight: 6 }}
            />
            <Text style={{ color: "#333", fontWeight: "600", fontSize: 14 }}>
              Contact Us
            </Text>
          </TouchableOpacity>

        {/* Full-width "Delete Account" with icon */}
          <TouchableOpacity
            style={[styles.fullWidthButtonTouchable, styles.deleteButton]}
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
              onPress={handlePress}
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
        {/* My Orders Header */}
        <View style={styles.myOrdersHeader}>
          <Text style={styles.myOrdersTitle}>My Orders</Text>
          {ordersLoading && <Loader />}
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
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 10,
              flexGrow: 1,
            }}
            scrollEnabled={false}
            style={{ marginTop: 10 }}
          />
        )}

        {/* Bottom Sheet Modal for Order Details */}
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
                <>
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
                  </View>

                  <ScrollView style={{ maxHeight: 300, marginVertical: 8 }}>
                    {/* Item List */}
                    {Array.isArray(selectedOrder.items) &&
                    selectedOrder.items.length > 0 ? (
                      selectedOrder.items.map(
                        (item: any, idx: number) => {
                          const price = Number(item.price) || 0;
                          const discount = Number(item.discount) || 0;
                          const cgst = Number(item.CGST) || 0;
                          const sgst = Number(item.SGST) || 0;

                          const basePrice = price - discount;
                          const realPrice = basePrice + cgst + sgst;

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
                        }
                      )
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
                      {typeof selectedOrder.deliveryCharge !== "undefined" && (
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
                      )}

                      {/* Convenience Fee */}
                      {typeof selectedOrder.convenienceFee !== "undefined" && (
                        <View style={styles.billRow}>
                          <Text style={styles.billLabel}>Convenience Fee</Text>
                          <Text style={styles.billValue}>
                            ₹{(selectedOrder.convenienceFee || 0).toFixed(2)}
                          </Text>
                        </View>
                      )}
                      {/* Surge Fee */}
                      {typeof selectedOrder.surgeFee !== "undefined" && (
                        <View style={styles.billRow}>
                          <Text style={styles.billLabel}>Surge Fee</Text>
                          <Text style={styles.billValue}>
                            ₹{(selectedOrder.surgeFee || 0).toFixed(2)}
                          </Text>
                        </View>
                      )}

                      {/* Platform Fee */}
                      {typeof selectedOrder.platformFee !== "undefined" && (
                        <View style={styles.billRow}>
                          <Text style={styles.billLabel}>Platform Fee</Text>
                          <Text style={styles.billValue}>
                            ₹{(selectedOrder.platformFee || 0).toFixed(2)}
                          </Text>
                        </View>
                      )}

                      {/* Discount */}
                      {typeof selectedOrder.discount !== "undefined" && (
                        <View style={styles.billRow}>
                          <Text style={styles.billLabel}>Discount</Text>
                          <Text style={styles.billValue}>
                            -₹{(selectedOrder.discount || 0).toFixed(2)}
                          </Text>
                        </View>
                      )}

                      {/* Final Total */}
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

export default ProfileScreen;

/****************************************
 *               STYLES
 ****************************************/
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f2f2f2",
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
    backgroundColor: "#f4f6ff",
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderBottomRightRadius: 24,
    borderBottomLeftRadius: 24,
    marginBottom: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  mainTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: primaryTextColor,
  },

  profileCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    marginHorizontal: 16,
    marginTop: -30,
    padding: 16,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#f9f9f9",
    alignSelf: "center",
    marginBottom: 16,
  },
  profileName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#333",
    textAlign: "center",
  },
  memberSince: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
    marginTop: 2,
    marginBottom: 10,
  },
  editButton: {
    alignSelf: "center",
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  editButtonText: {
    fontSize: 12,
    color: "#333",
    fontWeight: "600",
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#333",
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
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  dobSelect: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: "#fff",
  },

  fullWidthButton: {
    width: "100%",
    marginVertical: 8,
    borderRadius: 24,
  },
  fullWidthButtonTouchable: {
    width: "100%",
    marginVertical: 8,
    borderRadius: 24,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
  },
  saveButton: {
    backgroundColor: "#5b2ecc",
    elevation: 6,
  },
  outlinedButton: {
    borderColor: "#ddd",
    backgroundColor: "#fff",
  },
  contactButton: {
    backgroundColor: "#f4f4f8",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  deleteAccountButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  deleteButton: {
    backgroundColor: "#e74c3c",
    elevation: 6,
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
  // iOS date modal
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
    color: "#007BFF",
    fontSize: 16,
    fontWeight: "600",
  },
  // Re-auth flow modal
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
  containerReward: {
    position: "absolute",
    top: -25, // Half outside the tab bar
    right: 20,
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 10,
  },
  rewardIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "rgba(255, 215, 0, 0.3)",
    // Add these if you want a shine effect
    overflow: "hidden",
    backgroundColor: "#FFF",
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
  rewardBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#FF4757",
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  rewardBadgeText: {
    color: "#FFF",
    fontWeight: "bold",
    fontSize: 14,
    marginTop: -1,
  },
  rewardText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.5,
    textShadowColor: "rgba(255, 215, 0, 0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
