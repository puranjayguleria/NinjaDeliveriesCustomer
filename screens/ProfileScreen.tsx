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
  Animated,
  Easing,
  Keyboard,
  Vibration,
  ScrollView,
  FlatList,
  Platform,
  Modal,
  TextInput as RNTextInput, // rename to avoid confusion
  Linking,
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
const H = 16;
const R = 18;
const BG = "#F6F7FB";
const ACCENT = "#FF8A00";

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
}

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation();
  const currentUser = auth().currentUser;
  const currentUserId = (currentUser as any)?.uid as string | undefined;

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
  const [showAllOrders, setShowAllOrders] = useState(false);
  const [detailsY, setDetailsY] = useState(0);

  const scrollRef = useRef<ScrollView>(null);
  const nameInputRef = useRef<any>(null);
  const logoutConfirmShownRef = useRef(false);
  const screenFade = useRef(new Animated.Value(0)).current;
  const rewardsPulse = useRef(new Animated.Value(0)).current;
  const emptyCtaScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(screenFade, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [screenFade]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(rewardsPulse, {
          toValue: 1,
          duration: 650,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(rewardsPulse, {
          toValue: 0,
          duration: 650,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(600),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [rewardsPulse]);

  useEffect(() => {
    if (!currentUserId) return;
    if (ordersLoading || orders.length !== 0) return;
    emptyCtaScale.setValue(1);
    Animated.sequence([
      Animated.timing(emptyCtaScale, {
        toValue: 1.04,
        duration: 160,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(emptyCtaScale, {
        toValue: 1,
        duration: 160,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [currentUserId, emptyCtaScale, orders.length, ordersLoading]);

  const vibrateTap = useCallback((ms = 12) => {
    try {
      Vibration.vibrate(ms);
    } catch {
      // ignore
    }
  }, []);

  const TileButton = ({
    icon,
    iconColor,
    title,
    subtitle,
    onPress,
    danger,
    iconAnimated,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    title: string;
    subtitle?: string;
    onPress: () => void;
    danger?: boolean;
    iconAnimated?: { scale: any; opacity: any };
  }) => {
    const scale = useRef(new Animated.Value(1)).current;

    const onPressIn = () => {
      Animated.spring(scale, {
        toValue: 1.03,
        friction: 6,
        tension: 120,
        useNativeDriver: true,
      }).start();
    };

    const onPressOut = () => {
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 120,
        useNativeDriver: true,
      }).start();
    };

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
      >
        <Animated.View
          style={[
            styles.optionTile,
            danger ? styles.dangerTile : null,
            { transform: [{ scale }] },
          ]}
        >
          {iconAnimated ? (
            <Animated.View
              style={[
                styles.optionIcon,
                danger ? styles.dangerIcon : null,
                {
                  transform: [{ scale: iconAnimated.scale }],
                  opacity: iconAnimated.opacity,
                },
              ]}
            >
              <Ionicons name={icon} size={18} color={iconColor} />
            </Animated.View>
          ) : (
            <View style={[styles.optionIcon, danger ? styles.dangerIcon : null]}>
              <Ionicons name={icon} size={18} color={iconColor} />
            </View>
          )}

          <View style={{ flex: 1 }}>
            <Text style={[styles.optionTitle, danger ? styles.dangerText : null]}>
              {title}
            </Text>
            {!!subtitle && <Text style={styles.optionSub}>{subtitle}</Text>}
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </Animated.View>
      </TouchableOpacity>
    );
  };

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
  const handleSave = async (): Promise<boolean> => {
    if (!currentUser) return false;
    try {
      setSaving(true);
      const dobStr = dob ? dob.toISOString().split("T")[0] : "";
      await firestore().collection("users").doc(currentUser.uid).update({
        name: userName.trim(),
        dob: dobStr,
      });
      Alert.alert("Saved", "Profile updated successfully!");
      return true;
    } catch (error) {
      Alert.alert("Error", "Failed to save profile info.");
      return false;
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
  /** For date picking */
  const openDatePicker = () => {
    vibrateTap(8);
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
        /* active / reachedPickup / etc. */
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
            <Text style={styles.orderDate}>
              {dateString} • {timeString}
            </Text>
            <Text style={styles.orderId} numberOfLines={1}>
              Order #{item.id}
            </Text>
          </View>

          <View style={[styles.statusPill, { backgroundColor: statusTheme.bg }]}>
            <Text style={[styles.statusPillText, { color: statusTheme.fg }]}>
              {statusText.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.orderMetaRow}>
          <Text style={styles.orderMetaText}>
            Total{" "}
            <Text style={styles.orderMetaStrong}>₹{Number(total).toFixed(2)}</Text>
          </Text>
        </View>

        <View style={styles.orderActionRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionPrimary]}
            onPress={() => {
              vibrateTap();
              navigateToOrderScreen(item);
            }}
          >
            <Text style={styles.actionButtonText}>Track</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" style={{ marginLeft: 6 }} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionSecondary]}
            onPress={() => {
              vibrateTap();
              openDetailsModal(item);
            }}
          >
            <Text style={[styles.actionButtonText, { color: "#111827" }]}>
              Details
            </Text>
            <Ionicons name="list" size={16} color="#111827" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>
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
            navigation.navigate(
              "AppTabs" as never,
              {
                screen: "HomeTab",
                params: { screen: "LoginInHomeStack" },
              } as never
            )
          }
          style={{ backgroundColor: "#FF7043", marginTop: 16 }}
        >
          Login
        </Button>
      </View>
    );
  }

  const displayName =
    String(userName || "").trim() ||
    String((currentUser as any)?.displayName || "").trim() ||
    "Ninja Customer";
  const contactLine =
    String((currentUser as any)?.phoneNumber || "").trim() ||
    String((currentUser as any)?.email || "").trim();
  const ordersToRender = showAllOrders ? orders : orders.slice(0, 3);
  const dobText = dob ? format(dob, "dd MMM yyyy") : "Not set";

  const rewardsScale = rewardsPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });
  const rewardsOpacity = rewardsPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1],
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <Animated.View style={{ opacity: screenFade }}>
          <LinearGradient
            colors={[pastelGreen, "#FFFFFF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroTopRow}>
              <TouchableOpacity
                onPress={() => (navigation as any).goBack?.()}
                style={styles.backBtn}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <Ionicons name="arrow-back" size={22} color={primaryTextColor} />
              </TouchableOpacity>
              <Text style={styles.heroTitle}>Profile</Text>
              <View style={{ width: 34 }} />
            </View>

            <View style={styles.heroCard}>
              <View style={styles.avatarWrap}>
                <Image
                  source={require("../assets/ninja-logo.jpg")}
                  style={styles.avatarImage}
                />
              </View>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.heroName} numberOfLines={1}>
                  {displayName}
                </Text>
                {!!contactLine && (
                  <Text style={styles.heroSub} numberOfLines={1}>
                    {contactLine}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                disabled={isEditing}
                style={[styles.editPill, isEditing ? { opacity: 0.7 } : null]}
                onPress={() => {
                  vibrateTap();
                  setIsEditing(true);
                  scrollRef.current?.scrollTo({ y: detailsY, animated: true });
                  setTimeout(() => nameInputRef.current?.focus?.(), 200);
                }}
              >
                <Text style={styles.editPillText}>{isEditing ? "Editing" : "Edit"}</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>

          <View
            style={styles.card}
            onLayout={(e) => setDetailsY(e.nativeEvent.layout.y)}
          >
            <Text style={styles.cardTitle}>Personal details</Text>

            {!isEditing ? (
              <View style={styles.detailsBlock}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>👤 Name</Text>
                  <Text style={styles.detailValue} numberOfLines={1}>
                    {displayName}
                  </Text>
                </View>
                <View style={styles.detailDivider} />
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>🎂 Date of Birth</Text>
                  <Text style={styles.detailValue} numberOfLines={1}>
                    {dobText}
                  </Text>
                </View>
              </View>
            ) : (
              <>
                <TextInput
                  ref={nameInputRef}
                  label="👤 Name"
                  value={userName}
                  onChangeText={setUserName}
                  mode="outlined"
                  style={styles.input}
                  editable
                />

                <Text style={styles.label}>🎂 Date of Birth</Text>
                <TouchableOpacity onPress={openDatePicker} style={styles.dobSelect}>
                  <Text
                    style={{
                      color: dob ? "#111827" : "#9CA3AF",
                      fontWeight: "700",
                    }}
                  >
                    {dob ? format(dob, "dd MMM yyyy") : "Select Date of Birth"}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color="#6B7280" />
                </TouchableOpacity>
              </>
            )}

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

          {isEditing ? (
            <Button
              icon={() => <Ionicons name="save" size={18} color="#fff" />}
              mode="contained"
              onPress={async () => {
                vibrateTap();
                const ok = await handleSave();
                if (ok) {
                  setIsEditing(false);
                  Keyboard.dismiss();
                }
              }}
              loading={saving}
              style={styles.primaryButton}
              labelStyle={{ color: "#fff" }}
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Account options</Text>

            <TileButton
              icon="receipt-outline"
              iconColor="#2563EB"
              title="📦 Your Orders"
              subtitle="Track & manage orders"
              onPress={() => {
                vibrateTap();
                (navigation as any).navigate("YourOrders");
              }}
            />

            <TileButton
              icon="gift-outline"
              iconColor={ACCENT}
              title="⭐ Rewards"
              subtitle="Unlock more savings"
              iconAnimated={{ scale: rewardsScale, opacity: rewardsOpacity }}
              onPress={() => {
                vibrateTap();
                (navigation as any).navigate("RewardScreen");
              }}
            />

            <TileButton
              icon="help-circle-outline"
              iconColor={ACCENT}
              title="❓ Help"
              subtitle="Get support fast"
              onPress={() => {
                vibrateTap();
                (navigation as any).navigate("ContactUs");
              }}
            />

            <TileButton
              icon="document-text-outline"
              iconColor={ACCENT}
              title="📜 Terms"
              subtitle="Policies & conditions"
              onPress={() => {
                vibrateTap();
                (navigation as any).navigate("TermsAndConditions");
              }}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Security</Text>

            <TileButton
              icon="log-out-outline"
              iconColor="#EF4444"
              title="Logout"
              subtitle="Sign out from this device"
              danger
              onPress={() => {
                vibrateTap();
                if (logoutConfirmShownRef.current) return;
                logoutConfirmShownRef.current = true;
                Alert.alert(
                  "Logout",
                  "Are you sure you want to logout?",
                  [
                    {
                      text: "Cancel",
                      style: "cancel",
                      onPress: () => {
                        logoutConfirmShownRef.current = false;
                      },
                    },
                    {
                      text: "Logout",
                      style: "destructive",
                      onPress: () => {
                        logoutConfirmShownRef.current = false;
                        void handleLogout();
                      },
                    },
                  ],
                  {
                    cancelable: true,
                    onDismiss: () => {
                      logoutConfirmShownRef.current = false;
                    },
                  }
                );
              }}
            />

            <TileButton
              icon="trash-outline"
              iconColor="#EF4444"
              title="Delete account"
              subtitle="This action cannot be undone"
              danger
              onPress={() => {
                vibrateTap();
                handleDeleteAccount();
              }}
            />
          </View>
        </Animated.View>

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
                        (item: OrderItem, idx: number) => {
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
    backgroundColor: BG,
  },
  container: {
    flex: 1,
    backgroundColor: BG,
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
  hero: {
    paddingBottom: 18,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    paddingHorizontal: H,
    paddingTop: 8,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 6,
    paddingBottom: 10,
  },
  backBtn: {
    padding: 6,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: primaryTextColor,
  },
  heroCard: {
    backgroundColor: "#fff",
    borderRadius: R,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  avatarWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  heroName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 2,
  },
  heroSub: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  editPill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: ACCENT,
    shadowColor: ACCENT,
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  editPillText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#fff",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: R,
    marginHorizontal: H,
    marginTop: 12,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 10,
  },
  seeAllLink: {
    fontSize: 13,
    fontWeight: "800",
    color: ACCENT,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    marginBottom: 6,
  },
  input: {
    marginBottom: 12,
  },
  dobSelect: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    borderRadius: 14,
    marginBottom: 14,
  },
  primaryButton: {
    width: "100%",
    marginTop: 4,
    backgroundColor: ACCENT,
    borderRadius: 12,
  },
  detailsBlock: {
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    borderRadius: 14,
    overflow: "hidden",
  },
  detailRow: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
  },
  detailDivider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    marginRight: 10,
  },
  detailValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 14,
    fontWeight: "900",
    color: "#111827",
  },
  optionTile: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    marginBottom: 10,
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.04)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#111827",
  },
  optionSub: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
  },
  dangerTile: {
    backgroundColor: "#fff",
  },
  dangerIcon: {
    backgroundColor: "rgba(239,68,68,0.08)",
  },
  dangerText: {
    color: "#B91C1C",
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  settingsIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.04)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  settingsText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  rowDivider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  deleteRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 2,
  },
  deleteRowText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "800",
    color: "#EF4444",
  },
  orderCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    marginBottom: 10,
  },
  orderId: {
    fontSize: 13,
    fontWeight: "800",
    color: "#111827",
  },
  orderDate: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
  },
  orderTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "900",
  },
  orderMetaRow: {
    marginTop: 8,
  },
  orderMetaText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
  },
  orderMetaStrong: {
    fontSize: 13,
    fontWeight: "900",
    color: "#111827",
  },
  orderActionRow: {
    flexDirection: "row",
    marginTop: 8,
  },
  actionButton: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
  actionPrimary: {
    backgroundColor: "#111827",
  },
  actionSecondary: {
    backgroundColor: "#F3F4F6",
  },
  ordersLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  ordersLoadingText: {
    marginLeft: 10,
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
  },
  emptyOrders: {
    alignItems: "center",
    paddingVertical: 8,
  },
  emptyArt: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: "rgba(0,0,0,0.05)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  emptyOrdersTitle: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "900",
    color: "#111827",
  },
  emptyOrdersSub: {
    marginTop: 6,
    marginBottom: 12,
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    textAlign: "center",
  },
  supportCard: {
    backgroundColor: "#fff",
    borderRadius: R,
    marginHorizontal: H,
    marginTop: 12,
    marginBottom: 12,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  supportTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111827",
  },
  supportSub: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
  },
  supportButtonsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  supportBtn: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
  },
  supportBtnBg: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 8,
  },
  supportBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
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
    color: "#black",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.5,
    textShadowColor: "rgba(255, 215, 0, 0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  
  // Contact Section Styles
  contactSection: {
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 16,
    elevation: 8,
    shadowColor: "#667eea",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  contactOverlay: {
    padding: 24,
    borderRadius: 16,
  },
  contactSectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  contactSectionSubtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  contactButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },
  contactButton: {
    flex: 1,
    borderRadius: 12,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  contactButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  contactButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginLeft: 8,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
});
