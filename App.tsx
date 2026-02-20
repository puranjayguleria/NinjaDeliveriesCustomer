// **************************************************************
//  App.tsx – consolidated & fixed  (May 2025)
// **************************************************************
import app from '@react-native-firebase/app';


import { ensureFirebaseReady } from './firebase.native';
import * as FileSystem from 'expo-file-system';
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
  Image,
} from "react-native";
import {
  NavigationContainer,
  getFocusedRouteNameFromRoute,
  CommonActions,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { navigationRef } from "./navigation/rootNavigation";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { auth, firestore } from './firebase.native'; 
// import auth from "@react-native-firebase/auth";
// import firestore from "@react-native-firebase/firestore";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { NativeModules, Platform } from 'react-native';
import RestaurantCheckoutScreen from "./screens/RestaurantCheckoutScreen";
/* ──────────────────────────────────────────────────────────
   Context Providers
   ────────────────────────────────────────────────────────── */
import { CustomerProvider } from "./context/CustomerContext";
import { CartProvider, useCart } from "./context/CartContext";
import { LocationProvider } from "./context/LocationContext";
import { useLocationContext } from "./context/LocationContext";
import { OrderProvider, useOrder } from "./context/OrderContext";
import { ServiceCartProvider, useServiceCart } from "./context/ServiceCartContext";

/* ──────────────────────────────────────────────────────────
   Screens
   ────────────────────────────────────────────────────────── */
import ProductsHomeScreen from "./screens/ProductsHomeScreen";
import ServicesStack from "./navigation/ServicesStack";

import CategoriesScreen from "./screens/CategoriesScreen";
import FeaturedScreen from "./screens/FeaturedScreen";
import ProductListingScreen from "./screens/ProductListingScreen";
import CartScreen from "./screens/CartScreen";
import CartPaymentScreen from "./screens/CartPaymentScreen";
import UnifiedCartScreen from "./screens/UnifiedCartScreen";
import CartSelectionModal from "./components/CartSelectionModal";
import ServicesUnavailableModal from "./components/ServicesUnavailableModal";
import RazorpayWebView from "./screens/RazorpayWebView";
import ProfileScreen from "./screens/ProfileScreen";
import LocationSelectorScreen from "./screens/LocationSelectorScreen";
import OrderAllocatingScreen from "./screens/OrderAllocatingScreen";
import OrderTrackingScreen from "./screens/OrderTrackingScreen";
import RatingScreen from "./screens/RatingScreen";
import NewOrderCancelledScreen from "./screens/NewOrderCancelledScreen";
import TermsAndConditionsScreen from "./screens/TermsAndConditionsScreen";
import LoginScreen from "./screens/LoginScreen";
import SearchScreen from "./screens/SearchScreen";
import RoseBouquetScreen from "./screens/RoseBouquetScreen";
import ValentineSpecialsScreen from "./screens/ValentineSpecialsScreen";
import MakeBouquetScreen from "./screens/MakeBouquetScreen";
import ProductDetailsScreen from "./screens/ProductDetailsScreen";
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
import { Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import WelcomeServicesOnceModal from "@/components/WelcomeServicesOnceModal";

import CuisinesScreen from './screens/CuisinesScreen';
import RestaurantCategoryListingScreen from './screens/RestaurantCategoryListingScreen';
import { RestaurantCartProvider } from './context/RestaurantCartContext';
import RestaurantDetailsScreen from "./screens/RestaurantDetailsScreen";
import OrdersScreen from "./screens/OrdersScreen";
import OrderSummaryScreen from "./screens/OrderSummaryScreen";

import { ErrorBoundary } from "./components/ErrorBoundary";

const SERVICE_PAYMENT_RECOVERY_KEY = "service_payment_recovery";
const SERVICE_CONFIRMED_BANNER_KEY = "service_confirmed_banner";

type ServiceConfirmedBannerPayload = {
  razorpayOrderId: string;
  createdAt: number;
};

const StartupServicePaymentRecovery: React.FC<{ user: any; firebaseReady: boolean }> = ({
  user,
  firebaseReady,
}) => {
  const { clearCart: clearServiceCart } = useServiceCart();

  useEffect(() => {
    if (!user || !firebaseReady) return;

    let cancelled = false;
    const runServicePaymentRecovery = async () => {
      try {
        const raw = await AsyncStorage.getItem(SERVICE_PAYMENT_RECOVERY_KEY);
        if (!raw) return;

        const recovery = JSON.parse(raw);
        const razorpayOrderId = String(recovery?.razorpayOrderId || "");
        if (!razorpayOrderId) return;
        if (cancelled) return;

        const axios = require("axios").default;
        const api = axios.create({
          timeout: 20000,
          headers: { "Content-Type": "application/json" },
        });

        const token = await user.getIdToken(true);
        const headers = { Authorization: `Bearer ${token}` };

        const CLOUD_FUNCTIONS_BASE_URL = "https://asia-south1-ninjadeliveries-91007.cloudfunctions.net";
        const url = `${CLOUD_FUNCTIONS_BASE_URL}/servicePaymentsReconcile`;

        const resp = await api.post(url, { orderIds: [razorpayOrderId] }, { headers });
        const data = resp?.data;

        const finalizedOrderIds: string[] = Array.isArray(data?.finalizedOrderIds)
          ? data.finalizedOrderIds.map((x: any) => String(x))
          : [];
        const isFinalizedForThisOrder = finalizedOrderIds.includes(razorpayOrderId);

        const shouldClear =
          (data?.ok && isFinalizedForThisOrder) ||
          (data?.ok &&
            (Number(data?.createdBookings || 0) > 0 ||
              Number(data?.updatedBookings || 0) > 0 ||
              !!data?.alreadyFinalized ||
              Number(data?.finalizedIntents || 0) > 0));

        if (!shouldClear) return;

        clearServiceCart();

        const bannerPayload: ServiceConfirmedBannerPayload = {
          razorpayOrderId,
          createdAt: Date.now(),
        };
        await AsyncStorage.setItem(
          SERVICE_CONFIRMED_BANNER_KEY,
          JSON.stringify(bannerPayload)
        );

        await AsyncStorage.removeItem(SERVICE_PAYMENT_RECOVERY_KEY);
      } catch (e) {
        if (__DEV__) console.warn("🧾[SvcPay] app_start_recovery_failed_nonfatal", e);
      }
    };

    runServicePaymentRecovery();
    return () => {
      cancelled = true;
    };
  }, [user, firebaseReady, clearServiceCart]);

  return null;
};

// NinjaEats screens (fallback mappings)
// Some older branches referenced dedicated NinjaEats* screens that aren't present in this repo.
// Map them to existing screens to avoid launch-time crashes / compile failures.
const NinjaEatsHomeScreen = ProductsHomeScreen;
const NinjaEatsOrdersScreen = OrdersScreen;
const NinjaEatsOrderDetailScreen = OrderSummaryScreen;

console.log("[RNFB] Native module present? RNFBApp:", !!NativeModules.RNFBAppModule);
console.log("[RNFB] Native module present? RNFBAuth:", !!NativeModules.RNFBAuthModule);

const NinjaEatsTab = createBottomTabNavigator();
const NinjaEatsStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    <Stack.Screen
      name="NinjaEatsHome"
      component={NinjaEatsHomeScreen}
    />
     <Stack.Screen
      name="RestaurantCategoryListing"
      component={RestaurantCategoryListingScreen}
    />
    <Stack.Screen
      name="RestaurantDetails"
      component={RestaurantDetailsScreen}
    /> 
    <Stack.Screen
      name="RestaurantCheckout"
      component={RestaurantCheckoutScreen}
    />
  </Stack.Navigator>
);

const NinjaEatsOrdersStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen
      name="NinjaEatsOrders"
      component={NinjaEatsOrdersScreen}
    />
    <Stack.Screen
      name="NinjaEatsOrderDetail"
      component={NinjaEatsOrderDetailScreen}
    />
  </Stack.Navigator>
);

/**
 * Bottom tabs for Ninja Eats:
 * - Home (with its own stack)
 * - Cuisines
 * - Orders
 * - Profile
 */
const NinjaEatsTabs = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: "#00b4a0",
      tabBarInactiveTintColor: "#777",
      tabBarLabelStyle: {
        fontSize: 11,
        fontWeight: "600",
      },
      tabBarStyle: {
        backgroundColor: "#ffffff",
        borderTopColor: "#eee",
        elevation: 8,
        height: 56,
      },
    }}
  >
    <Tab.Screen
      name="NinjaEatsHomeTab"
      component={NinjaEatsStack}
      options={{
        title: "Home",
        tabBarIcon: ({ color, size }) => (
          <MaterialIcons name="home-filled" size={size} color={color} />
        ),
      }}
    />

    <Tab.Screen
      name="CuisinesTab"
      component={CuisinesScreen}
      options={{
        title: "Cuisines",
        tabBarIcon: ({ color, size }) => (
          <MaterialIcons name="restaurant-menu" size={size} color={color} />
        ),
      }}
    />

   <Tab.Screen
  name="OrdersTab"
  component={NinjaEatsOrdersStack}
  options={{
    title: "Orders",
    tabBarIcon: ({ color, size }) => (
      <MaterialIcons name="receipt-long" size={size} color={color} />
    ),
  }}
/>


    <Tab.Screen
      name="ProfileTab"
      component={ProfileScreen}
      options={{
        title: "Profile",
        tabBarIcon: ({ color, size }) => (
          <MaterialIcons name="person" size={size} color={color} />
        ),
      }}
    />
  </Tab.Navigator>
);


// Log inbound deep links (for the reCAPTCHA return)
Linking.addEventListener("url", ({ url }) => console.log("[Linking] open url:", url));
Linking.getInitialURL().then((url) => url && console.log("[Linking] initial url:", url));
/* ══════════════════════════════════════════════════════════
   Auth Guard Helper
   ══════════════════════════════════════════════════════════ */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const navigation = useNavigation<any>();
  const user = auth().currentUser;
  useEffect(() => {
    const subscriber = auth().onAuthStateChanged((user) => {
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
              navigation.navigate("LoginInHomeStack"),
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
        name="ValentineSpecials"
        component={ValentineSpecialsScreen}
        options={{ title: "Valentine Specials", headerShown: true }}
      />
      <Stack.Screen
        name="RoseBouquetScreen"
        component={RoseBouquetScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MakeBouquetScreen"
        component={MakeBouquetScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ProductDetails"
        component={ProductDetailsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ProductListingFromHome"
        component={ProductListingScreen as any}
        options={({ route }) => ({
          title: (route.params as any)?.categoryName || "Products",
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
        component={ProductListingScreen as any}
        options={({ route }) => ({
          title: (route.params as any)?.categoryName || "Products",
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
        component={ProductListingScreen as any}
        options={({ route }) => ({
          title: (route.params as any)?.categoryName || "Products",
          headerShown: true,
        })}
      />
    </Stack.Navigator>
  );
}



const CartStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="CartHome" component={UnifiedCartScreen} />
    <Stack.Screen name="GroceryCart" component={CartScreen} />
    <Stack.Screen name="CartPayment" component={CartPaymentScreen} />
    <Stack.Screen name="RazorpayWebView" component={RazorpayWebView} />
    <Stack.Screen
      name="OrderAllocating"
      component={OrderAllocatingScreen}
      options={{ headerShown: false }}
    />
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
  const { totalItems: serviceTotalItems, hasServices } = useServiceCart();
  const { location } = useLocationContext(); // Add location context
  const groceryTotalItems = Object.values(cart).reduce((a, q) => a + q, 0);
  const totalItems = groceryTotalItems + serviceTotalItems;
  const { activeOrders } = useOrder();
  const route = useRoute();
  const currentTab = getFocusedRouteNameFromRoute(route) ?? "HomeTab";
  
  // Cart selection modal state
  const [cartModalVisible, setCartModalVisible] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<any>(null);
  // Service tab loader state (shows ninjaServiceLoader.gif when Services tab is tapped)
  const [serviceLoaderVisible, setServiceLoaderVisible] = useState(false);
  // Services unavailable modal state
  const [servicesUnavailableModalVisible, setServicesUnavailableModalVisible] = useState(false);

  // One-time welcome modal -> jump user to Services (uses root navigation ref)
  /*animation of blink and Side to Side (vibration)*/
     const blinkAnim = useRef(new Animated.Value(1)).current;
     const shakeAnim = useRef(new Animated.Value(0)).current;
     // Services tab bounce animation
     const serviceBounceAnim = useRef(new Animated.Value(0)).current;

   useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(blinkAnim, {
            toValue: 0.4,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(blinkAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(shakeAnim, {
            toValue: -3,
            duration: 80,
            useNativeDriver: true,
          }),
          Animated.timing(shakeAnim, {
            toValue: 3,
            duration: 80,
            useNativeDriver: true,
          }),
          Animated.timing(shakeAnim, {
            toValue: 0,
            duration: 80,
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();

    // Services tab bounce animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(serviceBounceAnim, {
          toValue: -8,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(serviceBounceAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);



  const [currentUser, setCurrentUser] = useState(() => auth().currentUser);
  useEffect(() => auth().onAuthStateChanged(setCurrentUser), []);

  const inProgress = activeOrders.filter(
    (o) => o.status === "pending" || o.status === "active"
  );

  useEffect(() => {
   const onUrl = ({ url }: { url: string }) => {
     console.log('[Linking] Open URL:', url);
   };
   const sub = Linking.addEventListener('url', onUrl);
   Linking.getInitialURL().then((u) => u && console.log('[Linking] Initial URL:', u));
   return () => sub.remove();
  }, []);

  const promptLogin = (navigation: any, tab: string) =>
    Alert.alert("Login Required", `You must be logged in to access ${tab}.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Continue",
        onPress: () =>
          navigation.navigate("HomeTab", { screen: "LoginInHomeStack" }),
      },
    ]);

  // Cart modal handlers
  const handleCartModalClose = () => {
    setCartModalVisible(false);
    setPendingNavigation(null);
  };

  const handleSelectGrocery = () => {
    setCartModalVisible(false);
    if (pendingNavigation) {
      // Navigate to grocery cart (original CartScreen)
      pendingNavigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [
            {
              name: "CartFlow",
              state: { routes: [{ name: "GroceryCart" }] },
            },
          ],
        })
      );
    }
    setPendingNavigation(null);
  };

  const handleSelectServices = () => {
    setCartModalVisible(false);
    if (pendingNavigation) {
      // Show loader briefly, then navigate to services tab and service cart
      setServiceLoaderVisible(true);
      setTimeout(() => {
        pendingNavigation.navigate("ServicesTab", { 
          screen: "ServiceCart" 
        });
        setServiceLoaderVisible(false);
      }, 500);
    }
    setPendingNavigation(null);
  };

  const handleSelectUnified = () => {
    setCartModalVisible(false);
    if (pendingNavigation) {
      // Navigate to unified cart
      pendingNavigation.dispatch(
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
    setPendingNavigation(null);
  };

  return (
    <>
      <WelcomeServicesOnceModal
        onGoToServices={() => {
          // Navigate from the ROOT navigator so this works from a global modal.
          if (navigationRef.isReady()) {
            (navigationRef.navigate as any)("ServicesTab", { screen: "ServicesHome" });
          }
        }}
      />

      <Tab.Navigator
        initialRouteName="HomeTab"
        screenOptions={({ route }) => {
          const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
            HomeTab: "home-outline",
            CategoriesTab: "apps-outline",
            FeaturedTab: "star-outline",
            CartFlow: "cart-outline",
            Profile: "person-outline",
            ServicesTab: "construct-outline",
          };
          return {
            headerShown: false,
            tabBarActiveTintColor: "blue",
            tabBarInactiveTintColor: "grey",
            tabBarStyle: {
              backgroundColor: "#ffffff",
              borderTopWidth: 1,
              borderTopColor: "#f0f0f0",
              height: Platform.OS === "android" ? 60 : 85,
              paddingBottom: Platform.OS === "android" ? 10 : 30,
              elevation: 8,
            },
            // tab bar icon configuration
            tabBarIcon: ({ color, size }) => {
              const isService = route.name === "ServicesTab";
              const iconName = iconMap[route.name];

              return (
                <Animated.View
                  style={{
                    width: size + 12,
                    height: size + 12,
                    alignItems: "center",
                    justifyContent: "center",
                    transform: isService ? [{ translateY: serviceBounceAnim }] : [],
                  }}
                >
                  {isService && (
                    <View
                      style={{
                        position: "absolute",
                        top: -8,
                        backgroundColor: "red",
                        paddingHorizontal: 4,
                        borderRadius: 6,
                      }}
                    >
                      <Text style={{ color: "#fff", fontSize: 8, fontWeight: "700" }}>
                        NEW
                      </Text>
                    </View>
                  )}

                  <Ionicons
                    name={iconName}
                    size={size}
                    color={isService ? "red" : color}
                  />

                  {route.name === "CartFlow" && totalItems > 0 && (
                    <View style={styles.badgeContainer}>
                      <Text style={styles.badgeText}>{totalItems}</Text>
                    </View>
                  )}

                </Animated.View>
              );
            },
          };
        }}
      >

        <Tab.Screen
          name="HomeTab"
          component={HomeStack}
          options={{ title: "Home" }}
        />

        {/* ⿢ Categories Tab */}
        <Tab.Screen
          name="CategoriesTab"
          component={CategoriesStack}
          options={{ title: "Categories" }}
        />
        
        {/* ⿣ Featured Tab */}
        <Tab.Screen
          name="FeaturedTab"
          component={FeaturedStack}
          options={{ title: "Featured" }}
        />

        {/* ⿣ Services Tab */}
        <Tab.Screen
          name="ServicesTab"
          component={ServicesStack}
          options={{
            title: "Services",
          }}
          listeners={({ navigation, route }) => ({
            tabPress: (e) => {
              // Check if user is in Tanda location or other restricted locations
              // Tanda storeId from logs: i0h9WGnOlkhk0mD4Lfv3
              const restrictedStoreIds = ["i0h9WGnOlkhk0mD4Lfv3"]; // Tanda storeId
              
              // Debug: Log current storeId to help identify location
              if (__DEV__) {
                console.log("[Services Tab] Current storeId:", location?.storeId);
                console.log("[Services Tab] Is restricted?", location?.storeId && restrictedStoreIds.includes(location.storeId));
                console.log("[Services Tab] Restricted IDs:", restrictedStoreIds);
              }
              
              if (location?.storeId && restrictedStoreIds.includes(location.storeId)) {
                e.preventDefault();
                setServicesUnavailableModalVisible(true);
                return;
              }

              // Non-restricted location:
              // Show loader and navigate to ServicesHome
              e.preventDefault();
              setServiceLoaderVisible(true);
              setTimeout(() => {
                navigation.navigate("ServicesTab", { screen: "ServicesHome" });
                setServiceLoaderVisible(false);
              }, 800);
            },
          })}
        />

        {/* ⿤ Cart (with modal selection) */}
        <Tab.Screen
          name="CartFlow"
          component={CartStack}
          options={{ title: "Cart" }}
          listeners={({ navigation, route }) => ({
            tabPress: (e) => {
              if (!auth().currentUser) {
                e.preventDefault();
                promptLogin(navigation, "Cart");
              } else {
                // Show modal if both grocery and services have items, or if user wants to choose
                if (groceryTotalItems > 0 || serviceTotalItems > 0) {
                  e.preventDefault();
                  setPendingNavigation(navigation);
                  setCartModalVisible(true);
                } else {
                  // Empty cart - go to unified cart
                  const nestedState = (route as any)?.state ?? (route as any)?.params?.state;
                  if (nestedState && typeof nestedState.index === "number" && nestedState.index > 0) {
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
                }
              }
            },
          })}
        />

        {/* ⿥ Profile */}
        <Tab.Screen
          name="Profile"
          component={ProfileStack}
          options={{ title: "Profile" }}
          listeners={({ navigation }) => ({
            tabPress: (e) => {
              if (!auth().currentUser) {
                promptLogin(navigation, "Profile");
                e.preventDefault();
                // ...login prompt...
              }
            },
          })}
        />
      </Tab.Navigator>
      
      {/* Service Loader Modal */}
      {serviceLoaderVisible && (
        <RNModal
          visible
          transparent
          animationType="fade"
          statusBarTranslucent
        >
          <View style={styles.serviceLoaderOverlay}>
            <Image
              source={require("./assets/ninjaServiceLoader3.gif")}
              style={styles.serviceLoaderImage}
              resizeMode="contain"
            />
          </View>
        </RNModal>
      )}

      {/* Services Unavailable Modal */}
      {servicesUnavailableModalVisible && (
        <ServicesUnavailableModal
          visible
          onClose={() => setServicesUnavailableModalVisible(false)}
        />
      )}

      {/* Cart Selection Modal */}
      {cartModalVisible && (
        <CartSelectionModal
          visible
          onClose={handleCartModalClose}
          onSelectGrocery={handleSelectGrocery}
          onSelectServices={handleSelectServices}
          onSelectUnified={handleSelectUnified}
          groceryItemCount={groceryTotalItems}
          serviceItemCount={serviceTotalItems}
        />
      )}
    </>
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
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState<boolean | null>(null);
  const checkingOta = useOtaUpdate();

  useEffect(() => {
    (async () => {
      await ensureFirebaseReady();
      setFirebaseReady(true);
      // Optional: verify
      // import { getApps } from '@react-native-firebase/app';
      // console.log('[RNFB] post-init apps:', getApps().map(a => a.name));
    })();
  }, []);

  // DEV-only: prove whether native Razorpay module is actually bundled in this build
  useEffect(() => {
    if (!__DEV__) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { probeRazorpayNative } = require("./utils/razorpayProbe");
      const res = probeRazorpayNative();
      console.log("💳[RZPProbe]", res);
    } catch (e) {
      console.log("💳[RZPProbe] probe_failed", e);
    }
  }, []);

   useEffect(() => {
    if (!firebaseReady) return;
    const unsub = auth().onAuthStateChanged(async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const doc = await firestore().collection('users').doc(firebaseUser.uid).get();
        // ... your terms logic
      }
      setLoadingAuth(false);
    });
    return () => unsub();
  }, [firebaseReady]);

  /* push-token permission modal */
  const [showNotifModal, setShowNotifModal] = useState(false);
  const NOTIF_MODAL_SNOOZE_UNTIL_KEY = "notif_modal_snooze_until_v1";
  const NOTIF_MODAL_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  useEffect(() => {
    (async () => {
      // (optional) prove the plist is bundled
      const p = FileSystem.bundleDirectory + "GoogleService-Info.plist";
      const info = await FileSystem.getInfoAsync(p);
      console.log("[RNFB] Plist in bundle?", info.exists, p);
    })();
  }, []);
  /* ask for push-permission on first mount */
  useEffect(() => {
    (async () => {
      try {
        const snoozeRaw = await AsyncStorage.getItem(NOTIF_MODAL_SNOOZE_UNTIL_KEY);
        const snoozeUntil = snoozeRaw ? Number(snoozeRaw) : 0;
        if (Number.isFinite(snoozeUntil) && snoozeUntil > Date.now()) {
          return;
        }

        const perms = await Notifications.getPermissionsAsync();
        if (__DEV__) {
          console.log("[NotifModal] permissions", {
            status: perms?.status,
            granted: perms?.granted,
            canAskAgain: perms?.canAskAgain,
          });
        }
        const isEnabled = (perms?.granted === true) || (perms?.status === "granted");
        const canAskAgain = perms?.canAskAgain !== false;

        if (!isEnabled) {
          // If the OS won't show the permission prompt again, don't nag the user every launch.
          if (!canAskAgain) {
            await AsyncStorage.setItem(
              NOTIF_MODAL_SNOOZE_UNTIL_KEY,
              String(Date.now() + (30 * 24 * 60 * 60 * 1000))
            );
            return;
          }
          setShowNotifModal(true);
        } else {
          await ensurePushTokenSynced();
        }
      } catch (e) {
        // Non-fatal: if storage/permissions read fails, don't block app start.
        console.log("[NotifModal] permissions check failed", e);
      }
    })();
  }, []);

  /* listen for token rotation → store in Firestore */
  useEffect(() => {
    const sub = Notifications.addPushTokenListener(({ type, data }) => {
      const uid = auth().currentUser?.uid;
      if (type === "expo" && uid) {
        firestore()
          .collection("users")
          .doc(uid)
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

  /* Check for pending payments on app startup - SILENT RECOVERY */
  useEffect(() => {
    if (!user || !firebaseReady) return;

    const checkPendingPayments = async () => {
      try {
        console.log('🔍 Silently checking for pending payments on app startup...');
        
        // Simplified query - get recent bookings with pending payment status
        // No orderBy to avoid index requirement
        const bookingsSnapshot = await firestore()
          .collection('service_bookings')
          .where('customerId', '==', user.uid)
          .where('paymentStatus', '==', 'pending')
          .where('paymentMethod', '==', 'online')
          .limit(10)
          .get();

        if (bookingsSnapshot.empty) {
          console.log('✅ No pending payments found');
          return;
        }

        console.log(`📋 Found ${bookingsSnapshot.size} bookings with pending payments`);

        // Filter to only recent bookings (last 24 hours) in memory
        const oneDayAgo = new Date();
        oneDayAgo.setHours(oneDayAgo.getHours() - 24);
        
        const recentBookings = bookingsSnapshot.docs.filter(doc => {
          const booking = doc.data();
          const createdAt = booking.createdAt?.toDate?.() || new Date(booking.createdAt);
          return createdAt > oneDayAgo;
        });

        console.log(`📋 ${recentBookings.length} recent bookings (last 24 hours)`);

        // Check each booking's payment status in service_payments collection
        for (const bookingDoc of recentBookings) {
          const booking = bookingDoc.data();
          const bookingId = bookingDoc.id;
          
          console.log(`🔍 Checking payment for booking ${bookingId}...`);
          
          // Check if payment was actually completed
          const paymentSnapshot = await firestore()
            .collection('service_payments')
            .where('bookingId', '==', bookingId)
            .where('paymentStatus', '==', 'paid')
            .limit(1)
            .get();

          if (!paymentSnapshot.empty) {
            // Payment was completed but booking status wasn't updated
            console.log(`✅ Found completed payment for booking ${bookingId}, silently updating booking status...`);
            
            await firestore()
              .collection('service_bookings')
              .doc(bookingId)
              .update({
                paymentStatus: 'paid',
                updatedAt: new Date(),
              });
            
            console.log(`✅ Silently updated booking ${bookingId} payment status to paid`);
            console.log(`📱 User stays on current screen - no navigation to confirmation`);
          }
        }
        
        console.log('✅ Silent payment recovery completed - user remains on home screen');
      } catch (error) {
        console.error('❌ Error checking pending payments:', error);
      }
    };

    // Run check after a short delay to ensure Firebase is fully initialized
    const timer = setTimeout(checkPendingPayments, 2000);
    return () => clearTimeout(timer);
  }, [user, firebaseReady]);


  if (!firebaseReady || loadingAuth || checkingOta) {
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
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ErrorBoundary>
        <StatusBar style="dark" translucent backgroundColor="transparent" />

        <CustomerProvider>
        <CartProvider>
          <RestaurantCartProvider>
            <ServiceCartProvider>
              <StartupServicePaymentRecovery user={user} firebaseReady={firebaseReady} />
              <LocationProvider>
                <WeatherProvider>
                  <OrderProvider>
                <NavigationContainer ref={navigationRef}>
                  <GlobalCongrats />
                  <RootStack.Navigator
                    initialRouteName={initialRoute}
                    screenOptions={{ headerShown: false }}
                  >
                    <RootStack.Screen
                      name="TermsAndConditions"
                      component={TermsAndConditionsScreen}
                    />
                    <RootStack.Screen
                      name="MakeBouquetScreen"
                      component={MakeBouquetScreen}
                      options={{ headerShown: false }}
                    />
                    <RootStack.Screen name="AppTabs" component={AppTabs} />
                      <RootStack.Screen name="NinjaEatsTabs" component={NinjaEatsTabs} />
                    <RootStack.Screen
                      name="LocationSelector"
                      component={LocationSelectorScreen}
                      options={{ title: "Select Location" }}
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
            </ServiceCartProvider>
          </RestaurantCartProvider>
        </CartProvider>
      </CustomerProvider>

      {/* push-permission modal */}
      {showNotifModal && (
        <RNModal
          visible
          transparent
          animationType="slide"
          onRequestClose={async () => {
            setShowNotifModal(false);
            try {
              await AsyncStorage.setItem(
                NOTIF_MODAL_SNOOZE_UNTIL_KEY,
                String(Date.now() + NOTIF_MODAL_SNOOZE_MS)
              );
            } catch {}
          }}
          statusBarTranslucent
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

                    // Request OS permission even if the user isn't logged in yet.
                    // (ensurePushTokenSynced() short-circuits when auth().currentUser is null.)
                    try {
                      const perms = await Notifications.requestPermissionsAsync();
                      const isEnabled = (perms?.granted === true) || (perms?.status === "granted");
                      if (isEnabled) {
                        // Don't show again once enabled.
                        await AsyncStorage.removeItem(NOTIF_MODAL_SNOOZE_UNTIL_KEY);
                        await ensurePushTokenSynced();
                      } else {
                        // User denied or didn't enable: snooze so it doesn't reappear every launch.
                        const canAskAgain = perms?.canAskAgain !== false;
                        const snoozeMs = canAskAgain ? NOTIF_MODAL_SNOOZE_MS : (30 * 24 * 60 * 60 * 1000);
                        await AsyncStorage.setItem(
                          NOTIF_MODAL_SNOOZE_UNTIL_KEY,
                          String(Date.now() + snoozeMs)
                        );
                      }
                    } catch (e) {
                      console.log("[NotifModal] request permissions failed", e);
                      await AsyncStorage.setItem(
                        NOTIF_MODAL_SNOOZE_UNTIL_KEY,
                        String(Date.now() + NOTIF_MODAL_SNOOZE_MS)
                      );
                    }
                  }}
                >
                  <Text style={styles.modalButtonText}>Enable</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancelButton]}
                  onPress={async () => {
                    setShowNotifModal(false);
                    try {
                      await AsyncStorage.setItem(
                        NOTIF_MODAL_SNOOZE_UNTIL_KEY,
                        String(Date.now() + NOTIF_MODAL_SNOOZE_MS)
                      );
                    } catch {}
                  }}
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
      )}
      <Toast />
      </ErrorBoundary>
      </GestureHandlerRootView>
    </SafeAreaProvider>
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

  serviceLoaderOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  serviceLoaderImage: {
    width: 160,
    height: 160,
  },

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
