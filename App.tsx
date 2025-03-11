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
import Constants from "expo-constants";

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
import TermsAndConditionsScreen from "./screens/TermsAndConditionsScreen"; // <-- Import T&C
import { GestureHandlerRootView } from "react-native-gesture-handler";
import FeaturedScreen from "./screens/FeaturedScreen";

// ---------------------------------------------------
// Create Navigators
// ---------------------------------------------------
const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

/* ------------------------------------------------------------------
   1) MAIN TAB NAVIGATOR
------------------------------------------------------------------ */
function AppTabs() {
  const { cart } = useCart();
  const totalItems = Object.values(cart).reduce((acc, qty) => acc + qty, 0);
  const { activeOrders } = useOrder();

  // Determine current focused route for the Home tab.
  const routeName =
    getFocusedRouteNameFromRoute({ routes: [{ name: "Home" }], index: 0 }) ||
    "Home";

  // Filter only "pending" / "active" orders.
  const inProgress = activeOrders.filter(
    (o) => o.status === "pending" || o.status === "active"
  );

  return (
    <View style={{ flex: 1, position: "relative" }}>
      <Tab.Navigator
        screenOptions={({ route }) => {
          let iconName = "home-outline";
          if (route.name === "Home") iconName = "home-outline";
          else if (route.name === "Featured") iconName = "star-outline";
          else if (route.name === "CartFlow") iconName = "cart-outline";
          else if (route.name === "Profile") iconName = "person-outline";
          else if (route.name === "ContactUsTab") iconName = "call-outline";

          return {
            tabBarIcon: ({ color, size }) => (
              <View style={{ width: size, height: size }}>
                <Ionicons name={iconName} size={size} color={color} />
                {route.name === "CartFlow" && totalItems > 0 && (
                  <View style={styles.badgeContainer}>
                    <Text style={styles.badgeText}>{totalItems}</Text>
                  </View>
                )}
              </View>
            ),
            tabBarActiveTintColor: "blue",
            tabBarInactiveTintColor: "gray",
            headerShown: false,
          };
        }}
      >
        <Tab.Screen name="Home" component={CategoriesStack} />
        <Tab.Screen
          name="Featured"
          component={FeaturedStack}
          options={{ title: "Featured" }}
        />
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
                          state: { routes: [{ name: "CartHome" }] },
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

      {/* Blinking bar for in-progress orders on the Home tab */}
      {routeName === "Home" && inProgress.length > 0 && (
        <BlinkingInProgressBar orders={inProgress} />
      )}
    </View>
  );
}

/* ------------------------------------------------------------------
   2) CATEGORIES STACK (Home Tab)
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
   3) FEATURED STACK (New Tab)
------------------------------------------------------------------ */
function FeaturedStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Featured"
        component={FeaturedScreen}
        options={{ headerShown: false }}
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
   4) PROFILE STACK
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
   5) CART FLOW STACK
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
   6) BLINKING BAR with an "X" button
------------------------------------------------------------------ */
const BlinkingInProgressBar: React.FC<{ orders: any[] }> = ({ orders }) => {
  const navigation = useNavigation();
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [isVisible, setIsVisible] = useState(true);

  const inProgress = orders.filter(
    (o) => o.status === "pending" || o.status === "active"
  );

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

  if (inProgress.length === 0 || !isVisible) {
    return null;
  }

  return (
    <Animated.View style={[styles.inProgressBar, { opacity: fadeAnim }]}>
      <View style={styles.messageContainer}>
        <Text style={styles.messageText}>
          You have {inProgress.length} order
          {inProgress.length > 1 ? "s" : ""} in progress. Tap to view.
        </Text>
      </View>
      <TouchableOpacity
        style={styles.profileNavButton}
        onPress={() => {
          navigation.navigate("Profile", { screen: "ProfileHome" });
        }}
      >
        <Ionicons name="person-circle-outline" size={20} color="#fff" />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.closeButton}
        onPress={() => setIsVisible(false)}
      >
        <Ionicons name="close" size={20} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );
};

/* ------------------------------------------------------------------
   7) ROOT APP COMPONENT
------------------------------------------------------------------ */
const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState<boolean | null>(null);
  const navigationRef = useRef<any>(null);
  const routeNameRef = useRef<string | undefined>("");
  const [showNotificationModal, setShowNotificationModal] = useState(false);

  // ---------------------------------------------------
  // Register for Push Notifications
  // ---------------------------------------------------
  const registerForPushNotificationsAsync = async () => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (finalStatus !== "granted") {
        setShowNotificationModal(true);
        return null;
      }

      if (finalStatus === "granted") {
        // Use static import of Constants & fallback:
        const projectId = Constants.expoConfig?.extra?.eas?.projectId || "FALLBACK_ID";
        const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
        console.log("Expo Push Token:", data);
        return data;
      }

      return null;
    } catch (error) {
      console.error("Error registering for push notifications:", error);
      return null;
    }
  };

  const handleEnableNotifications = async () => {
    setShowNotificationModal(false);
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === "granted") {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId || "FALLBACK_ID";
        const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
        console.log("Expo Push Token (after enable):", data);
      } else {
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
    (async () => {
      await registerForPushNotificationsAsync();
    })();
  }, []);

  // ---------------------------------------------------
  // Firebase Auth listener
  // ---------------------------------------------------
  useEffect(() => {
    console.log("[App] Auth listener setup...");
    const unsubscribeAuth = auth().onAuthStateChanged(async (authUser) => {
      console.log("[App] Auth state changed. user:", authUser?.uid);
      setUser(authUser);
      if (authUser) {
        try {
          const userDoc = await firestore()
            .collection("users")
            .doc(authUser.uid)
            .get();
          if (userDoc.exists) {
            setTermsAccepted(userDoc.data()?.hasAcceptedTerms === true);
          } else {
            await firestore().collection("users").doc(authUser.uid).set({
              phoneNumber: authUser.phoneNumber,
              expoPushToken: null,
              hasAcceptedTerms: false,
            });
            setTermsAccepted(false);
          }
        } catch (err) {
          console.error("[App] Error fetching user doc:", err);
          setTermsAccepted(false);
        }
      }
      setLoading(false);
    });
    return () => {
      console.log("[App] Cleanup auth listener...");
      unsubscribeAuth();
    };
  }, []);

  // ---------------------------------------------------
  // Notifications: handle incoming/responses
  // ---------------------------------------------------
  useEffect(() => {
    console.log("[App] Notification listeners setup...");
    const notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log("[App] Notification Received:", notification);
      }
    );
    const responseListener =
      Notifications.addNotificationResponseReceivedListener((response) => {
        console.log("[App] Notification response:", response);
      });

    return () => {
      console.log("[App] Removing notification listeners...");
      Notifications.removeNotificationSubscription(notificationListener);
      Notifications.removeNotificationSubscription(responseListener);
    };
  }, []);

  // ---------------------------------------------------
  // Track route name changes (optional)
  // ---------------------------------------------------
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

  // ---------------------------------------------------
  // Loading indicator if not done checking user
  // ---------------------------------------------------
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00C853" />
      </View>
    );
  }

  // ---------------------------------------------------
  // Main App
  // ---------------------------------------------------
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
              We use push notifications to keep you updated on your orders and
              exclusive offers. Enabling notifications ensures you never miss an
              important update.
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
                <Text style={[styles.modalButtonText, styles.modalCancelButtonText]}>
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  inProgressBar: {
    position: "absolute",
    bottom: 50,
    left: 10,
    right: 10,
    height: 20,
    backgroundColor: "#E55252",
    borderRadius: 12,
    zIndex: 1000,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
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
  profileNavButton: {
    marginRight: 8,
  },
  closeButton: {},
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
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },
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
    padding: 10,
    alignItems: "center",
    elevation: 5,
  },
  modalTitle: {
    fontSize: 10,
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
