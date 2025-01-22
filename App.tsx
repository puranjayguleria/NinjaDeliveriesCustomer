// App.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  Animated,
  Alert,
  Linking,
  Modal as RNModal,
  BackHandler,
} from "react-native";
import {
  NavigationContainer,
  getFocusedRouteNameFromRoute,
  CommonActions,
  useNavigation,
} from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";

// Providers
import { CustomerProvider } from "./context/CustomerContext";
import { CartProvider, useCart } from "./context/CartContext";
import { LocationProvider } from "./context/LocationContext";
import { useOrder, OrderProvider } from "./context/OrderContext";

// Screens
import CategoriesScreen from "./screens/CategoriesScreen";
import ProductListingScreen from "./screens/ProductListingScreen";
import CartScreen from "./screens/CartScreen";
import ProfileScreen from "./screens/ProfileScreen";
import LoginScreen from "./screens/LoginScreen";
import LocationSelectorScreen from "./screens/LocationSelectorScreen";
import OrderAllocatingScreen from "./screens/OrderAllocatingScreen";
import OrderTrackingScreen from "./screens/OrderTrackingScreen";
import RatingScreen from "./screens/RatingScreen";
import NewOrderCancelledScreen from "./screens/NewOrderCancelledScreen";
import ContactUsScreen from "./screens/ContactUsScreen";
import TermsAndConditionsScreen from "./screens/TermsAndConditionsScreen"; // <-- Import your T&C screen
import { GestureHandlerRootView } from "react-native-gesture-handler";

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

/* ------------------------------------------------------------------
   1) MAIN TAB NAVIGATOR
------------------------------------------------------------------ */
function AppTabs() {
  const { cart } = useCart();
  const totalItems = Object.values(cart).reduce((acc, qty) => acc + qty, 0);
  const { activeOrders } = useOrder();

  // Only show blinking bar on these screens
  const categoryScreens = ["Home"];

  // Current route in the Tab
  const routeName = getFocusedRouteNameFromRoute(
    // useRoute() can be used within each navigator if needed.
    // For simplicity, we assume "Home" if not defined.
    { routes: [{ name: "Home" }], index: 0 }
  ) || "Home";

  // Filter orders
  const inProgress = activeOrders.filter(
    (o) => o.status === "pending" || o.status === "active"
  );

  return (
    <View style={{ flex: 1, position: "relative" }}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ color, size }) => {
            let iconName = "home-outline";
            if (route.name === "Home") iconName = "home-outline";
            else if (route.name === "CartFlow") iconName = "cart-outline";
            else if (route.name === "Profile") iconName = "person-outline";
            else if (route.name === "ContactUsTab") iconName = "call-outline";

            return (
              <View style={{ width: size, height: size }}>
                <Ionicons name={iconName} size={size} color={color} />
                {route.name === "CartFlow" && totalItems > 0 && (
                  <View style={styles.badgeContainer}>
                    <Text style={styles.badgeText}>{totalItems}</Text>
                  </View>
                )}
              </View>
            );
          },
          tabBarActiveTintColor: "blue",
          tabBarInactiveTintColor: "gray",
          headerShown: false,
        })}
      >
        <Tab.Screen name="Home" component={CategoriesStack} />
        <Tab.Screen
          name="CartFlow"
          component={CartFlowStack}
          options={{
            title: "Cart",
            listeners: ({ navigation, route }) => ({
              tabPress: (e) => {
                if (route.state && route.state.index > 0) {
                  e.preventDefault();
                  navigation.dispatch(
                    CommonActions.reset({
                      index: 0,
                      routes: [
                        {
                          name: "CartFlow",
                          state: {
                            routes: [{ name: "CartHome" }],
                          },
                        },
                      ],
                    })
                  );
                }
              },
            }),
          }}
        />
        <Tab.Screen name="Profile" component={ProfileStack} />
        <Tab.Screen
          name="ContactUsTab"
          component={ContactUsScreen}
          options={{ title: "Contact Us" }}
        />
      </Tab.Navigator>

      {/* Show blinking bar on "Home" only if there are in-progress orders */}
      {categoryScreens.includes(routeName) && inProgress.length > 0 && (
        <BlinkingInProgressBar orders={activeOrders} />
      )}
    </View>
  );
}

/* ------------------------------------------------------------------
   2) CATEGORIES STACK
------------------------------------------------------------------ */
function CategoriesStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Categories"
        component={CategoriesScreen}
        options={{ title: "Categories", headerShown: false }}
      />
      <Stack.Screen
        name="ProductListing"
        component={ProductListingScreen}
        options={({ route }) => ({
          title: route.params?.categoryName || "Products",
        })}
      />
    </Stack.Navigator>
  );
}

/* ------------------------------------------------------------------
   3) PROFILE STACK
------------------------------------------------------------------ */
function ProfileStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="ProfileHome"
        component={ProfileScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

/* ------------------------------------------------------------------
   4) CART FLOW STACK
------------------------------------------------------------------ */
function CartFlowStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="CartHome"
        component={CartScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

/* ------------------------------------------------------------------
   5) BLINKING BAR
------------------------------------------------------------------ */
const BlinkingInProgressBar: React.FC<{ orders: any[] }> = ({ orders }) => {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const inProgress = orders.filter(
    (o) => o.status === "pending" || o.status === "active"
  );
  if (inProgress.length === 0) return null;
  const navigation = useNavigation();

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0.85,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [fadeAnim]);

  return (
    <Animated.View style={[styles.inProgressBar, { opacity: fadeAnim }]}>
      <TouchableOpacity
        onPress={() => {
          // Navigate to ProfileHome when pressed.
          navigation.navigate("Profile", { screen: "ProfileHome" });
        }}
        style={styles.touchableArea}
      >
        <View style={styles.messageContainer}>
          <Text style={styles.messageText}>
            You have {inProgress.length} order
            {inProgress.length > 1 ? "s" : ""} in progress. Tap to view.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );
};

/* ------------------------------------------------------------------
   6) ROOT APP COMPONENT
------------------------------------------------------------------ */
const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  // New state to track T&C acceptance:
  const [termsAccepted, setTermsAccepted] = useState<boolean | null>(null);

  const navigationRef = useRef<any>(null);
  const routeNameRef = useRef<string | undefined>("");

  // State to control our custom notification permission modal
  const [showNotificationModal, setShowNotificationModal] = useState(false);

  // Function to register for push notifications.
  const registerForPushNotificationsAsync = async () => {
    try {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (finalStatus !== "granted") {
        // Show our custom modal (the modal's enable button will call handleEnableNotifications)
        setShowNotificationModal(true);
        return null;
      }

      if (finalStatus === "granted") {
        const { data } = await Notifications.getExpoPushTokenAsync({
          projectId: (await import("expo-constants")).default.expoConfig?.extra?.eas?.projectId,
        });
        console.log("Expo Push Token:", data);
        // Optionally update the token in your backend/user record here.
        return data;
      }
      return null;
    } catch (error) {
      console.error("Error registering for push notifications:", error);
      return null;
    }
  };

  // When the user taps "Enable" in our modal.
  const handleEnableNotifications = async () => {
    setShowNotificationModal(false);
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === "granted") {
        const { data } = await Notifications.getExpoPushTokenAsync({
          projectId: (await import("expo-constants")).default.expoConfig?.extra?.eas?.projectId,
        });
        console.log("Expo Push Token (after enable):", data);
        // Optionally update the token in your backend/user record here.
      } else {
        // If permission is still not granted, direct the user to Settings.
        Alert.alert(
          "Notifications Required",
          "To receive order updates and special offers, please enable notifications from your device settings.",
          [
            {
              text: "Open Settings",
              onPress: () => Linking.openSettings(),
            },
            { text: "Cancel", style: "cancel" },
          ]
        );
      }
    } catch (error) {
      console.error("Error enabling notifications:", error);
    }
  };

  useEffect(() => {
    const fetchPushToken = async () => {
      await registerForPushNotificationsAsync();
    };

    fetchPushToken();
  }, []);

  // Listen for authentication state changes.
  useEffect(() => {
    console.log("[App] Mounting. Setting up auth listener...");
    const unsubscribeAuth = auth().onAuthStateChanged(async (authUser) => {
      console.log("[App] Auth state changed. user:", authUser?.uid);
      setUser(authUser);
      if (authUser) {
        // When a user is logged in, fetch their document to check the T&C flag.
        try {
          const userDoc = await firestore()
            .collection("users")
            .doc(authUser.uid)
            .get();
          if (userDoc.exists) {
            const data = userDoc.data();
            // Update our state with the accepted flag.
            setTermsAccepted(data?.hasAcceptedTerms === true);
          } else {
            // If the document does not exist, create it with hasAcceptedTerms false.
            await firestore().collection("users").doc(authUser.uid).set({
              phoneNumber: authUser.phoneNumber,
              expoPushToken: null, // Handle expoPushToken appropriately
              hasAcceptedTerms: false,
            });
            setTermsAccepted(false);
          }
        } catch (err) {
          console.error("[App] Error fetching user document:", err);
          setTermsAccepted(false);
        }
      }
      setLoading(false);
    });
    return () => {
      console.log("[App] Unmounting. Cleanup auth listener...");
      unsubscribeAuth();
    };
  }, []);

  useEffect(() => {
    console.log("[App] Setting up notification listeners...");
    const handleNotificationResponse = (response: any) => {
      console.log("[App] Notification response received:", response);
      // (Notification response handling code omitted for brevity)
    };

    const notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log("[App] Notification Received:", notification);
      }
    );
    const responseListener =
      Notifications.addNotificationResponseReceivedListener(
        handleNotificationResponse
      );

    return () => {
      console.log("[App] Cleanup notification listeners...");
      Notifications.removeNotificationSubscription(notificationListener);
      Notifications.removeNotificationSubscription(responseListener);
    };
  }, []);

  function getActiveRouteName(state: any): string {
    if (!state || !state.routes) return "";
    const route = state.routes[state.index];
    if (route.state) {
      return getActiveRouteName(route.state);
    }
    return route.name;
  }
  const handleStateChange = (state: any) => {
    const previousRouteName = routeNameRef.current;
    const currentRouteName = getActiveRouteName(state);
    if (previousRouteName !== currentRouteName) {
      console.log(
        `[App] Route changed from '${previousRouteName}' to '${currentRouteName}'`
      );
    }
    routeNameRef.current = currentRouteName;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00C853" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <CustomerProvider>
      <CartProvider>
        <LocationProvider>
          <OrderProvider>
            <NavigationContainer
              ref={navigationRef}
              onStateChange={handleStateChange}
            >
              {/* ----------------------------------------
                  1) Decide the initial route:
                     - If not logged in -> "Login"
                     - If logged in + T&C NOT accepted -> "TermsAndConditions"
                     - Else -> "AppTabs"
                 ---------------------------------------- */}
              <Stack.Navigator
                initialRouteName={
                  !user
                    ? "Login"
                    : termsAccepted === false
                    ? "TermsAndConditions"
                    : "AppTabs"
                }
                screenOptions={{ headerShown: false }}
              >
                {/* ----------------------------------------
                    2) Declare ALL routes in one stack
                ---------------------------------------- */}
                <Stack.Screen
                  name="Login"
                  component={LoginScreen}
                  options={{ headerShown: false }}
                />
  
                <Stack.Screen
                  name="TermsAndConditions"
                  component={TermsAndConditionsScreen}
                  options={{ headerShown: false }}
                />
  
                <Stack.Screen
                  name="AppTabs"
                  component={AppTabs}
                  options={{ headerShown: false }}
                />
  
                <Stack.Screen
                  name="OrderAllocating"
                  component={OrderAllocatingScreen}
                  options={{ headerShown: false }}
                />
  
                <Stack.Screen
                  name="OrderTracking"
                  component={OrderTrackingScreen}
                  options={{
                    headerShown: true,
                    headerLeft: () => null,
                    gestureEnabled: false,
                    title: "Order Tracking",
                  }}
                />
  
                <Stack.Screen
                  name="OrderCancelled"
                  component={NewOrderCancelledScreen}
                  options={{
                    title: "Order Cancelled",
                    headerLeft: () => null,
                    gestureEnabled: false,
                  }}
                />
  
                <Stack.Screen
                  name="LocationSelector"
                  component={LocationSelectorScreen}
                  options={{ title: "Select Location" }}
                />
  
                <Stack.Screen
                  name="RatingScreen"
                  component={RatingScreen}
                  options={{
                    title: "Rate Your Rider",
                    headerBackTitleVisible: false,
                    headerLeft: () => null,
                    gestureEnabled: false,
                  }}
                />
  
                <Stack.Screen
                  name="ContactUs"
                  component={ContactUsScreen}
                  options={{
                    title: "Contact Us",
                    headerTintColor: "#1E824C",
                    headerStyle: {
                      backgroundColor: "#fff",
                    },
                  }}
                />
              </Stack.Navigator>
            </NavigationContainer>
          </OrderProvider>
        </LocationProvider>
      </CartProvider>
    </CustomerProvider>
  
    {/* Custom Notification Permission Modal */}
    <RNModal
      visible={showNotificationModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowNotificationModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Enable Notifications</Text>
          <Text style={styles.modalMessage}>
            We use push notifications to keep you updated on your
            orders and exclusive offers. Enabling notifications ensures
            you never miss an important update.
          </Text>
          <View style={styles.modalButtonContainer}>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleEnableNotifications}
            >
              <Text style={styles.modalButtonText}>Enable Notifications</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalCancelButton]}
              onPress={() => setShowNotificationModal(false)}
            >
              <Text
                style={[styles.modalButtonText, styles.modalCancelButtonText]}
              >
                Later
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </RNModal>
  </GestureHandlerRootView>
  
  );
};

export default App;

/****************************************
 *                STYLES
 ****************************************/
const styles = StyleSheet.create({
  inProgressBar: {
    position: "absolute",
    height: 30,
    bottom: 50,
    left: 10,
    right: 10,
    backgroundColor: "#E55252",
    paddingHorizontal: 15,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 1000,
  },
  touchableArea: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  messageContainer: {
    flex: 1,
    marginRight: 10,
  },
  messageText: {
    fontSize: 12,
    color: "#fff",
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeContainer: {
    position: "absolute",
    top: -3,
    right: -8,
    backgroundColor: "#e74c3c",
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "600",
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "85%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 10,
    color: "#333",
    textAlign: "center",
  },
  modalMessage: {
    fontSize: 16,
    textAlign: "center",
    color: "#555",
    marginBottom: 20,
  },
  modalButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
  },
  modalButton: {
    backgroundColor: "#00C853",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  modalButtonText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
  },
  modalCancelButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#00C853",
  },
  modalCancelButtonText: {
    color: "#00C853",
  },
});
