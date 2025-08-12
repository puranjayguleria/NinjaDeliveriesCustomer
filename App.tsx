// **************************************************************
//  App.tsx – consolidated & fixed  (May 2025)
// **************************************************************

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  Animated,
  Alert,
  AppState,
  Modal as RNModal,
} from "react-native";
import {
  NavigationContainer,
  getFocusedRouteNameFromRoute,
  CommonActions,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Toast from "react-native-toast-message";

/* ──────────────────────────────────────────────────────────
   Context Providers
   ────────────────────────────────────────────────────────── */
import { CustomerProvider } from "./context/CustomerContext";
import { CartProvider, useCart } from "./context/CartContext";
import { LocationProvider } from "./context/LocationContext";
import { OrderProvider, useOrder } from "./context/OrderContext";

/* ──────────────────────────────────────────────────────────
   Screens
   ────────────────────────────────────────────────────────── */
import ProductsHomeScreen from "./screens/ProductsHomeScreen";
import CategoriesScreen from "./screens/CategoriesScreen";
import FeaturedScreen from "./screens/FeaturedScreen";
import ProductListingScreen from "./screens/ProductListingScreen";
import CartScreen from "./screens/CartScreen";
import ProfileScreen from "./screens/ProfileScreen";
import LocationSelectorScreen from "./screens/LocationSelectorScreen";
import OrderAllocatingScreen from "./screens/OrderAllocatingScreen";
import OrderTrackingScreen from "./screens/OrderTrackingScreen";
import RatingScreen from "./screens/RatingScreen";
import NewOrderCancelledScreen from "./screens/NewOrderCancelledScreen";
import ContactUsScreen from "./screens/ContactUsScreen";
import TermsAndConditionsScreen from "./screens/TermsAndConditionsScreen";
import LoginScreen from "./screens/LoginScreen";
import SearchScreen from "./screens/SearchScreen";
import QuizScreen from "./screens/QuizScreen";
import CongratsScreen from "./screens/CongratsScreen";
import LeaderboardScreen from "./screens/LeaderBoardScreen";
import AllDiscountedProductsScreen from "./screens/AllDiscountedProductsScreen";
/* ──────────────────────────────────────────────────────────
   Utilities
   ────────────────────────────────────────────────────────── */
import { ensurePushTokenSynced } from "./utils/PushTokenManager";
import { useOtaUpdate } from "./utils/useOtaUpdate";
import { WeatherProvider } from "./context/WeatherContext";
import { StatusBar } from "expo-status-bar";
import GlobalCongrats from "./components/CongratulationModal ";
import HiddenCouponCard from "./screens/RewardScreen";

/* ══════════════════════════════════════════════════════════
   Auth Guard Helper
   ══════════════════════════════════════════════════════════ */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const navigation = useNavigation<any>();
  const user = auth().currentUser;
  useEffect(() => {
    const subscriber = auth().onAuthStateChanged((user) => {
      // Auth state changes will be handled by CustomerContext
      console.log("User auth state changed:", user?.uid);
    });
    return subscriber; // unsubscribe on unmount
  }, []);
  useEffect(() => {
    if (!user) {
      Alert.alert(
        "Login Required",
        "You must be logged in to access this screen.",
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => navigation.goBack(),
          },
          {
            text: "Log In",
            onPress: () =>
              navigation.navigate("HomeTab", { screen: "LoginInHomeStack" }),
          },
        ]
      );
    }
  }, [user, navigation]);

  if (!user) return null;
  return <>{children}</>;
}

/* ══════════════════════════════════════════════════════════
   Navigator Instances
   ══════════════════════════════════════════════════════════ */
const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const RootStack = createNativeStackNavigator();

/* ==========================================================
   STACK COMPOSITIONS
   ========================================================== */
function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProductsHome" component={ProductsHomeScreen} />

      {/* Quiz flow (gated) */}
      <Stack.Screen name="Quiz" options={{ title: "Quiz & Win" }}>
        {() => (
          <RequireAuth>
            <QuizScreen />
          </RequireAuth>
        )}
      </Stack.Screen>

      <Stack.Screen
        name="Congrats"
        options={{ title: "Congratulations!", headerShown: false }}
      >
        {() => (
          <RequireAuth>
            <CongratsScreen />
          </RequireAuth>
        )}
      </Stack.Screen>
      <Stack.Screen
        name="Leaderboard"
        options={{ title: "Leaderboard", headerShown: false }}
      >
        {() => (
          <RequireAuth>
            <LeaderboardScreen />
          </RequireAuth>
        )}
      </Stack.Screen>

      {/* Search & listing */}
      <Stack.Screen
        name="Search"
        component={SearchScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ProductListingFromHome"
        component={ProductListingScreen}
        options={({ route }) => ({
          title: route.params?.categoryName || "Products",
          headerShown: true,
        })}
      />
      <Stack.Screen
        name="AllDiscountedProducts"
        component={AllDiscountedProductsScreen}
        options={{ title: "Discounted Products", headerShown: false }}
      />

      {/* Order flow */}
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
      {/* Reward */}
      <Stack.Screen
        name="RewardScreen"
        component={HiddenCouponCard}
        options={{ title: "Reward Screen", headerShown: false }}
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
        name="RatingScreen"
        component={RatingScreen}
        options={{
          title: "Rate Your Rider",
          headerLeft: () => null,
          gestureEnabled: false,
        }}
      />

      {/* Login (inside Home stack so bottom tabs remain visible) */}
      <Stack.Screen
        name="LoginInHomeStack"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

function CategoriesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CategoriesHome" component={CategoriesScreen} />
      <Stack.Screen
        name="ProductListingFromCats"
        component={ProductListingScreen}
        options={({ route }) => ({
          title: route.params?.categoryName || "Products",
          headerShown: true,
        })}
      />
      <Stack.Screen
        name="OrderAllocating"
        component={OrderAllocatingScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

function FeaturedStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="FeaturedHome" component={FeaturedScreen} />
      <Stack.Screen
        name="ProductListingFromFeatured"
        component={ProductListingScreen}
        options={({ route }) => ({
          title: route.params?.categoryName || "Products",
          headerShown: true,
        })}
      />
    </Stack.Navigator>
  );
}

const CartStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="CartHome" component={CartScreen} />
  </Stack.Navigator>
);

const ProfileStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ProfileHome" component={ProfileScreen} />
    <Stack.Screen
      name="RewardScreen"
      component={HiddenCouponCard}
      options={{ title: "Reward Screen", headerShown: false }}
    />
  </Stack.Navigator>
);

/* ==========================================================
   TAB NAVIGATOR
   ========================================================== */
function AppTabs() {
  const { cart } = useCart();
  const totalItems = Object.values(cart).reduce((a, q) => a + q, 0);
  const { activeOrders } = useOrder();
  const route = useRoute();
  const currentTab = getFocusedRouteNameFromRoute(route) ?? "HomeTab";

  const [currentUser, setCurrentUser] = useState(() => auth().currentUser);
  useEffect(() => auth().onAuthStateChanged(setCurrentUser), []);

  const inProgress = activeOrders.filter(
    (o) => o.status === "pending" || o.status === "active"
  );

  const promptLogin = (navigation: any, tab: string) =>
    Alert.alert("Login Required", `You must be logged in to access ${tab}.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Continue",
        onPress: () =>
          navigation.navigate("HomeTab", { screen: "LoginInHomeStack" }),
      },
    ]);

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        initialRouteName="HomeTab"
        screenOptions={({ route }) => {
          const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
            HomeTab: "home-outline",
            CategoriesTab: "apps-outline",
            FeaturedTab: "star-outline",
            CartFlow: "cart-outline",
            Profile: "person-outline",
            ContactUsTab: "call-outline",
          };
          return {
            headerShown: false,
            tabBarActiveTintColor: "blue",
            tabBarInactiveTintColor: "gray",
            tabBarIcon: ({ color, size }) => (
              <View style={{ width: size, height: size }}>
                <Ionicons
                  name={iconMap[route.name]}
                  size={size}
                  color={color}
                />
                {route.name === "CartFlow" && totalItems > 0 && (
                  <View style={styles.badgeContainer}>
                    <Text style={styles.badgeText}>{totalItems}</Text>
                  </View>
                )}
              </View>
            ),
          };
        }}
      >
        {/* 1️⃣ Home */}
        <Tab.Screen
          name="HomeTab"
          component={HomeStack}
          options={{ title: "Home" }}
        />

        {/* 2️⃣ Categories */}
        <Tab.Screen
          name="CategoriesTab"
          component={CategoriesStack}
          options={{ title: "Categories" }}
        />

        {/* 3️⃣ Featured */}
        <Tab.Screen
          name="FeaturedTab"
          component={FeaturedStack}
          options={{ title: "Featured" }}
        />

        {/* 4️⃣ Cart (login-gated) */}
        <Tab.Screen
          name="CartFlow"
          component={CartStack}
          options={{ title: "Cart" }}
          listeners={({ navigation, route }) => ({
            tabPress: (e) => {
              if (!currentUser) {
                e.preventDefault();
                promptLogin(navigation, "Cart");
              } else if (route.state && route.state["index"] > 0) {
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
          })}
        />

        {/* 5️⃣ Profile (login-gated) */}
        <Tab.Screen
          name="Profile"
          component={ProfileStack}
          options={{ title: "Profile" }}
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              if (!currentUser) {
                e.preventDefault();
                promptLogin(navigation, "Profile");
              }
            },
          })}
        />

        {/* 6️⃣ Contact Us */}
        <Tab.Screen
          name="ContactUsTab"
          component={ContactUsScreen}
          options={{ title: "Contact Us" }}
        />
      </Tab.Navigator>

      {/* blinking bar when order is in progress */}
      {currentTab === "HomeTab" && inProgress.length > 0 && (
        <BlinkingInProgressBar orders={inProgress} />
      )}
    </View>
  );
}

/* ==========================================================
   BLINKING PROGRESS BAR
   ========================================================== */
const BlinkingInProgressBar: React.FC<{ orders: any[] }> = ({ orders }) => {
  const navigation = useNavigation<any>();
  const fade = useRef(new Animated.Value(1)).current;
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(fade, {
          toValue: 0.7,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(fade, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [fade]);

  if (!isVisible) return null;

  return (
    <Animated.View style={[styles.inProgressBar, { opacity: fade }]}>
      <View style={styles.messageContainer}>
        <Text style={styles.messageText}>
          You have {orders.length} order{orders.length > 1 ? "s" : ""} in
          progress. Tap to view.
        </Text>
      </View>
      <TouchableOpacity
        style={styles.profileNavButton}
        onPress={() => navigation.navigate("Profile")}
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

/* ==========================================================
   ROOT APP COMPONENT
   ========================================================== */
const App: React.FC = () => {
  const [user, setUser] = useState<null | any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState<boolean | null>(null);
  const checkingOta = useOtaUpdate();

  /* push-token permission modal */
  const [showNotifModal, setShowNotifModal] = useState(false);

  /* ask for push-permission on first mount */
  useEffect(() => {
    (async () => {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== "granted") {
        setShowNotifModal(true);
      } else {
        await ensurePushTokenSynced();
      }
    })();
  }, []);

  /* listen for token rotation → store in Firestore */
  useEffect(() => {
    const sub = Notifications.addPushTokenListener(({ type, data }) => {
      if (type === "expo" && auth().currentUser) {
        firestore()
          .collection("users")
          .doc(auth().currentUser.uid)
          .set({ expoPushToken: data }, { merge: true });
      }
    });
    return () => sub.remove();
  }, []);

  /* keep token fresh when app returns to foreground */
  useEffect(() => {
    const sub = AppState.addEventListener("change", async (s) => {
      if (s === "active") await ensurePushTokenSynced();
    });
    return () => sub.remove();
  }, []);

  /* auth listener */
  useEffect(() => {
    const unsub = auth().onAuthStateChanged(async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const doc = await firestore()
          .collection("users")
          .doc(firebaseUser.uid)
          .get();
        setTermsAccepted(
          doc.exists ? doc.data()?.hasAcceptedTerms === true : false
        );
      }
      setLoadingAuth(false);
    });
    return () => unsub();
  }, []);

  if (loadingAuth || checkingOta) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00C853" />
      </View>
    );
  }

  /* decide initial route */
  const initialRoute = !user
    ? "AppTabs"
    : termsAccepted === false
    ? "TermsAndConditions"
    : "AppTabs";

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" translucent backgroundColor="transparent" />

      <CustomerProvider>
        <CartProvider>
          <LocationProvider>
            <WeatherProvider>
              <OrderProvider>
                <NavigationContainer>
                  <GlobalCongrats />
                  <RootStack.Navigator
                    initialRouteName={initialRoute}
                    screenOptions={{ headerShown: false }}
                  >
                    <RootStack.Screen
                      name="TermsAndConditions"
                      component={TermsAndConditionsScreen}
                    />
                    <RootStack.Screen name="AppTabs" component={AppTabs} />
                    <RootStack.Screen
                      name="LocationSelector"
                      component={LocationSelectorScreen}
                      options={{ title: "Select Location" }}
                    />
                    <RootStack.Screen
                      name="ContactUs"
                      component={ContactUsScreen}
                      options={{ title: "Contact Us", headerShown: true }}
                    />
                    <RootStack.Screen
                      name="RewardScreen"
                      component={HiddenCouponCard}
                      options={{ title: "Reward Screen", headerShown: false }}
                    />
                  </RootStack.Navigator>
                </NavigationContainer>
              </OrderProvider>
            </WeatherProvider>
          </LocationProvider>
        </CartProvider>
      </CustomerProvider>

      {/* push-permission modal */}
      <RNModal
        visible={showNotifModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNotifModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Enable Notifications</Text>
            <Text style={styles.modalMessage}>
              We use push notifications to keep you updated on your orders and
              exclusive offers.
            </Text>
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={async () => {
                  setShowNotifModal(false);
                  await ensurePushTokenSynced();
                }}
              >
                <Text style={styles.modalButtonText}>Enable</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setShowNotifModal(false)}
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
      <Toast />
    </GestureHandlerRootView>
  );
};

/* ==========================================================
   STYLES
   ========================================================== */
const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },

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
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "600" },

  inProgressBar: {
    position: "absolute",
    bottom: 50,
    left: 10,
    right: 10,
    height: 22,
    backgroundColor: "#E55252",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  messageContainer: { flex: 1, marginRight: 10 },
  messageText: { fontSize: 12, color: "#fff", fontWeight: "600" },
  profileNavButton: { marginRight: 8 },
  closeButton: {},

  /* modal */
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
    padding: 14,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
    color: "#333",
  },
  modalMessage: {
    fontSize: 14,
    color: "#555",
    textAlign: "center",
    marginBottom: 18,
  },
  modalButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
  },
  modalButton: {
    backgroundColor: "#00C853",
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  modalButtonText: { color: "#fff", fontWeight: "600" },
  modalCancelButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#00C853",
  },
  modalCancelButtonText: { color: "#00C853" },
});

export default App;
