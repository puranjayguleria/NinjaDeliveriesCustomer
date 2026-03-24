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
import { navigationRef, setLastNonCartTab } from "./navigation/rootNavigation";
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
/* ──────────────────────────────────────────────────────────
   Context Providers
   ────────────────────────────────────────────────────────── */
import { CustomerProvider } from "./context/CustomerContext";
import { CartProvider, useCart } from "./context/CartContext";
import { LocationProvider } from "./context/LocationContext";
import { ToggleProvider, useToggleContext } from "./context/ToggleContext";
import { useLocationContext } from "./context/LocationContext";
import { fetchLocationFlags } from "./utils/fetchLocationFlags";
import { OrderProvider, useOrder } from "./context/OrderContext";
import { ServiceCartProvider, useServiceCart } from "./context/ServiceCartContext";

/* ──────────────────────────────────────────────────────────
   Screens
   ────────────────────────────────────────────────────────── */
import ProductsHomeScreen from "./screens/grocery/ProductsHomeScreen";
import ServicesStack from "./navigation/ServicesStack";
import ServicesScreen from "./screens/services/ServicesScreen";
import AllServicesScreen from "./screens/services/AllServicesScreen";
import FoodScreen from "@/screens/food/FoodScreen";
import RestaurantDetailScreen from "@/screens/food/RestaurantDetailScreen";
import FoodCartScreen from "@/screens/food/FoodCartScreen";
import FoodCheckoutScreen from "@/screens/food/FoodCheckoutScreen";
import FoodOrderSuccessScreen from "@/screens/food/FoodOrderSuccessScreen";
import FoodTrackingScreen from "@/screens/food/FoodTrackingScreen";
import FoodOrdersScreen from "@/screens/food/FoodOrdersScreen";
import FoodCategoriesScreen from "@/screens/food/FoodCategoriesScreen";
import FoodSearchScreen from "@/screens/food/FoodSearchScreen";
import { FoodCartProvider } from "./context/FoodCartContext";
import { useFoodCart } from "./context/FoodCartContext";
import SwiggyTabBar from "@/components/Footertabs";
import BookingHistoryScreen from "./screens/services/BookingHistoryScreen";
import ServiceCategoryScreen from "./screens/services/ServiceCategoryScreen";
import PackageSelectionScreen from "./screens/services/PackageSelectionScreen";
import CompanySelectionScreen from "./screens/services/CompanySelectionScreen";
import SelectDateTimeScreen from "./screens/services/SelectDateTimeScreen";
import PaymentScreen from "./screens/services/PaymentScreen";
import BookingDetailsScreen from "./screens/services/BookingDetailsScreen";
import BookingConfirmationScreen from "./screens/services/BookingConfirmationScreen";
import TrackBookingScreen from "./screens/services/TrackBookingScreen";
import ServiceCartScreen from "./screens/services/ServiceCartScreen";
import ServiceCheckoutScreen from "./screens/services/ServiceCheckoutScreen";
import ServiceAddOnScreen from "./screens/services/ServiceAddOnScreen";
import ServiceCallingScreen from "./screens/services/ServiceCallingScreen";
import ServiceVisitScreen from "./screens/services/ServiceVisitScreen";
import ServiceEndScreen from "./screens/services/ServiceEndScreen";
import FinalCheckoutScreen from "./screens/services/FinalCheckoutScreen";

import CategoriesScreen from "./screens/grocery/CategoriesScreen";
import ProductListingScreen from "./screens/grocery/ProductListingScreen";
import CartScreen from "./screens/grocery/CartScreen";
import CartPaymentScreen from "./screens/grocery/CartPaymentScreen";
import UnifiedCartScreen from "./screens/shared/UnifiedCartScreen";
import CartSelectionModal from "./components/CartSelectionModal";
import ServicesUnavailableModal from "./components/ServicesUnavailableModal";
import AreaUnavailableModal from "./components/AreaUnavailableModal";
import RazorpayWebView from "./screens/shared/RazorpayWebView";
import ProfileScreen from "./screens/shared/ProfileScreen";
import LocationSelectorScreen from "./screens/shared/LocationSelectorScreen";
import OrderAllocatingScreen from "./screens/grocery/OrderAllocatingScreen";
import OrderTrackingScreen from "./screens/grocery/OrderTrackingScreen";
import RatingScreen from "./screens/shared/RatingScreen";
import NewOrderCancelledScreen from "./screens/grocery/NewOrderCancelledScreen";
import TermsAndConditionsScreen from "./screens/shared/TermsAndConditionsScreen";
import LoginScreen from "./screens/shared/LoginScreen";
import SearchScreen from "./screens/grocery/SearchScreen";
import ProductDetailsScreen from "./screens/grocery/ProductDetailsScreen";
import QuizScreen from "./screens/gamification/QuizScreen";
import CongratsScreen from "./screens/gamification/CongratsScreen";
import LeaderboardScreen from "./screens/gamification/LeaderBoardScreen";
import AllDiscountedProductsScreen from "./screens/grocery/AllDiscountedProductsScreen";
/* ──────────────────────────────────────────────────────────
   Utilities
   ────────────────────────────────────────────────────────── */
import { ensurePushTokenSynced } from "./utils/PushTokenManager";
import { useOtaUpdate } from "./utils/useOtaUpdate";
import { WeatherProvider } from "./context/WeatherContext";
import { StatusBar } from "expo-status-bar";
import GlobalCongrats from "./components/CongratulationModal ";
import HiddenCouponCard from "./screens/gamification/RewardScreen";
import { Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import WelcomeServicesOnceModal from "@/components/WelcomeServicesOnceModal";

import OrdersScreen from "./screens/shared/OrdersScreen";
import OrderSummaryScreen from "./screens/shared/OrderSummaryScreen";

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


console.log("[RNFB] Native module present? RNFBApp:", !!NativeModules.RNFBAppModule);
console.log("[RNFB] Native module present? RNFBAuth:", !!NativeModules.RNFBAuthModule);



/**
 * Bottom tabs for Ninja Eats:
 * - Home (with its own stack)
 * - Cuisines
 * - Orders
 * - Profile
 */



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
  const { activeMode } = useToggleContext();
  
  const HomeScreenWrapper = () => {
    if (activeMode === "service") {
      return <ServicesScreen />;
    }
    return <ProductsHomeScreen />;
  };
  
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProductsHome" component={HomeScreenWrapper} />

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

      {/* Profile Screen - accessible via profile icon in header */}
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ headerShown: false }}
      />

      {/* Services Screen - accessible via toggle in header */}
      <Stack.Screen
        name="ServicesHome"
        component={ServicesScreen}
        options={{ headerShown: false }}
      />

      {/* Food Screens */}
      <Stack.Screen
        name="RestaurantDetail"
        component={RestaurantDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="FoodCart"
        component={FoodCartScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="FoodCheckout"
        component={FoodCheckoutScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="FoodOrderSuccess"
        component={FoodOrderSuccessScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="FoodTracking"
        component={FoodTrackingScreen}
        options={{ headerShown: false }}
      />

      {/* All Services Screen - accessible via View All button in ServicesScreen */}
      <Stack.Screen
        name="AllServices"
        component={AllServicesScreen}
        options={{ headerShown: false }}
      />

      {/* Service Category Screen */}
      <Stack.Screen
        name="ServiceCategory"
        component={ServiceCategoryScreen}
        options={{ headerShown: false }}
      />

      {/* Package Selection Screen */}
      <Stack.Screen
        name="PackageSelection"
        component={PackageSelectionScreen}
        options={{ headerShown: false }}
      />

      {/* Company Selection Screen */}
      <Stack.Screen
        name="CompanySelection"
        component={CompanySelectionScreen}
        options={{ headerShown: false }}
      />

      {/* Select Date Time Screen */}
      <Stack.Screen
        name="SelectDateTime"
        component={SelectDateTimeScreen}
        options={{ headerShown: false }}
      />

      {/* Payment Screen */}
      <Stack.Screen
        name="Payment"
        component={PaymentScreen}
        options={{ headerShown: false }}
      />

      {/* Booking Details Screen */}
      <Stack.Screen
        name="BookingDetails"
        component={BookingDetailsScreen}
        options={{ headerShown: false }}
      />

      {/* Booking History Screen - accessible via booking history icon in ServicesScreen */}
      <Stack.Screen
        name="BookingHistory"
        component={BookingHistoryScreen}
        options={{ headerShown: false }}
      />

      {/* Booking Confirmation Screen */}
      <Stack.Screen
        name="BookingConfirmation"
        component={BookingConfirmationScreen}
        options={{ headerShown: false }}
      />

      {/* Track Booking Screen */}
      <Stack.Screen
        name="TrackBooking"
        component={TrackBookingScreen}
        options={{ headerShown: false }}
      />

      {/* Service Cart Screen */}
      <Stack.Screen
        name="ServiceCart"
        component={ServiceCartScreen}
        options={{ headerShown: false }}
      />

      {/* Service Checkout Screen */}
      <Stack.Screen
        name="ServiceCheckout"
        component={ServiceCheckoutScreen}
        options={{ headerShown: false }}
      />

      {/* Service Add On Screen */}
      <Stack.Screen
        name="ServiceAddOn"
        component={ServiceAddOnScreen}
        options={{ headerShown: false }}
      />

      {/* Service Calling Screen */}
      <Stack.Screen
        name="ServiceCalling"
        component={ServiceCallingScreen}
        options={{ headerShown: false }}
      />

      {/* Service Visit Screen */}
      <Stack.Screen
        name="ServiceVisit"
        component={ServiceVisitScreen}
        options={{ headerShown: false }}
      />

      {/* Service End Screen */}
      <Stack.Screen
        name="ServiceEnd"
        component={ServiceEndScreen}
        options={{ headerShown: false }}
      />

      {/* Final Checkout Screen */}
      <Stack.Screen
        name="FinalCheckout"
        component={FinalCheckoutScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

function CategoriesStack() {
  const { activeMode } = useToggleContext();
  
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {activeMode === "grocery" ? (
        <>
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
        </>
      ) : activeMode === "service" ? (
        <>
          <Stack.Screen name="CategoriesHome" component={AllServicesScreen} options={{ headerShown: false }} />
          
          {/* Service flow screens - needed for navigation from AllServicesScreen */}
          <Stack.Screen
            name="ServiceCategory"
            component={ServiceCategoryScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="PackageSelection"
            component={PackageSelectionScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="CompanySelection"
            component={CompanySelectionScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="SelectDateTime"
            component={SelectDateTimeScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Payment"
            component={PaymentScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="BookingDetails"
            component={BookingDetailsScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="BookingConfirmation"
            component={BookingConfirmationScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="TrackBooking"
            component={TrackBookingScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ServiceCart"
            component={ServiceCartScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ServiceCheckout"
            component={ServiceCheckoutScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ServiceAddOn"
            component={ServiceAddOnScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ServiceCalling"
            component={ServiceCallingScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ServiceVisit"
            component={ServiceVisitScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ServiceEnd"
            component={ServiceEndScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="FinalCheckout"
            component={FinalCheckoutScreen}
            options={{ headerShown: false }}
          />
        </>
      ) : (
        <Stack.Screen name="CategoriesHome" component={FoodCategoriesScreen} options={{ headerShown: false }} />
      )}
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
   FOOD TAB NAVIGATOR
   ========================================================== */
const FoodTab = createBottomTabNavigator();
const FoodStack = createNativeStackNavigator();

function FoodHomeStack() {
  return (
    <FoodStack.Navigator screenOptions={{ headerShown: false }}>
      <FoodStack.Screen name="FoodHome" component={FoodScreen} />
      <FoodStack.Screen name="RestaurantDetail" component={RestaurantDetailScreen} />
      <FoodStack.Screen name="FoodSearch" component={FoodSearchScreen} />
      <FoodStack.Screen name="Profile" component={ProfileScreen} />
      <FoodStack.Screen name="LoginInHomeStack" component={LoginScreen} />
    </FoodStack.Navigator>
  );
}

function FoodCartStack() {
  return (
    <FoodStack.Navigator screenOptions={{ headerShown: false }}>
      <FoodStack.Screen name="FoodCartHome" component={FoodCartScreen} />
      <FoodStack.Screen name="FoodCheckout" component={FoodCheckoutScreen} />
      <FoodStack.Screen name="FoodOrderSuccess" component={FoodOrderSuccessScreen} />
      <FoodStack.Screen name="FoodTracking" component={FoodTrackingScreen} />
      <FoodStack.Screen name="RazorpayWebView" component={RazorpayWebView} />
    </FoodStack.Navigator>
  );
}

function FoodOrdersStack() {
  return (
    <FoodStack.Navigator screenOptions={{ headerShown: false }}>
      <FoodStack.Screen name="FoodOrdersHome" component={FoodOrdersScreen} />
      <FoodStack.Screen name="FoodCart" component={FoodCartScreen} />
      <FoodStack.Screen name="FoodCheckout" component={FoodCheckoutScreen} />
      <FoodStack.Screen name="LoginInHomeStack" component={LoginScreen} />
    </FoodStack.Navigator>
  );
}

function FoodHistoryStack() {
  return (
    <FoodStack.Navigator screenOptions={{ headerShown: false }}>
      <FoodStack.Screen name="FoodHistoryHome">
        {() => <FoodOrdersScreen mode="history" />}
      </FoodStack.Screen>
      <FoodStack.Screen name="FoodTracking" component={FoodTrackingScreen} />
      <FoodStack.Screen name="LoginInHomeStack" component={LoginScreen} />
    </FoodStack.Navigator>
  );
}

function FoodReorderStack() {
  return (
    <FoodStack.Navigator screenOptions={{ headerShown: false }}>
      <FoodStack.Screen name="FoodReorderHome">
        {() => <FoodOrdersScreen mode="reorder" />}
      </FoodStack.Screen>
      <FoodStack.Screen name="FoodCheckout" component={FoodCheckoutScreen} />
      <FoodStack.Screen name="LoginInHomeStack" component={LoginScreen} />
    </FoodStack.Navigator>
  );
}

function FoodSearchStack() {
  return (
    <FoodStack.Navigator screenOptions={{ headerShown: false }}>
      <FoodStack.Screen name="FoodSearchHome" component={FoodSearchScreen} />
    </FoodStack.Navigator>
  );
}

function FoodAccountStack() {
  return (
    <FoodStack.Navigator screenOptions={{ headerShown: false }}>
      <FoodStack.Screen name="FoodAccountHome" component={ProfileScreen} />
    </FoodStack.Navigator>
  );
}

function FoodMenuStack() {
  return (
    <FoodStack.Navigator screenOptions={{ headerShown: false }}>
      <FoodStack.Screen name="FoodMenuHome" component={FoodCategoriesScreen} />
    </FoodStack.Navigator>
  );
}

function FoodHistoryTabStack() {
  return (
    <FoodStack.Navigator screenOptions={{ headerShown: false }}>
      <FoodStack.Screen name="FoodHistoryTabHome">
        {() => <FoodOrdersScreen mode="history" />}
      </FoodStack.Screen>
      <FoodStack.Screen name="FoodTracking" component={FoodTrackingScreen} />
      <FoodStack.Screen name="LoginInHomeStack" component={LoginScreen} />
    </FoodStack.Navigator>
  );
}

function FoodTabs() {
  const { totalItems } = useFoodCart();

  return (
    <FoodTab.Navigator
      tabBar={props => {
        const state = props.state;
        const activeIndex = state.index;
        const tabs = [
          { name: 'FoodRestaurants', label: 'Home',    icon: 'home-outline' as const,       iconFocused: 'home' as const },
          { name: 'FoodMenu',        label: 'Menu',    icon: 'grid-outline' as const,        iconFocused: 'grid' as const },
          { name: 'FoodCartTab',     label: 'Cart',    icon: 'bag-outline' as const,         iconFocused: 'bag' as const, badge: totalItems },
          { name: 'FoodHistoryTab',  label: 'History', icon: 'receipt-outline' as const,     iconFocused: 'receipt' as const },
        ];
        return (
          <SwiggyTabBar
            tabs={tabs}
            activeIndex={activeIndex}
            onPress={i => {
              const route = state.routes[i];
              props.navigation.dispatch({
                type: 'RESET',
                payload: { index: 0, routes: [{ name: route.name }] },
                target: state.key,
              });
            }}
            activeColor="#FC8019"
          />
        );
      }}
      screenOptions={{ headerShown: false }}
    >
      <FoodTab.Screen name="FoodRestaurants" component={FoodHomeStack} />
      <FoodTab.Screen name="FoodMenu"        component={FoodMenuStack} />
      <FoodTab.Screen name="FoodCartTab"     component={FoodCartStack} />
      <FoodTab.Screen name="FoodHistoryTab"  component={FoodHistoryTabStack} />
    </FoodTab.Navigator>
  );
}

/* ==========================================================
   TAB NAVIGATOR
   ========================================================== */
function AppTabs() {
  const { cart } = useCart();
  const { totalItems: serviceTotalItems, hasServices } = useServiceCart();
  const { location, updateLocation } = useLocationContext();
  const { activeMode, setActiveMode } = useToggleContext();
  const groceryTotalItems = Object.values(cart).reduce((a, q) => a + q, 0);
  const totalItems = groceryTotalItems + serviceTotalItems;
  const { activeOrders } = useOrder();
  const route = useRoute();
  const currentTab = getFocusedRouteNameFromRoute(route) ?? "HomeTab";
  const [groceryTabIndex, setGroceryTabIndex] = React.useState(0);
  const [serviceTabIndex, setServiceTabIndex] = React.useState(0);

  // Get location flags (default to true if not set)
  const showGrocery = location?.grocery !== false;
  const showFood = location?.food !== false;
  const showServices = location?.services !== false;
  
  // Derived: all services off for this area
  const allServicesOff = !showGrocery && !showServices && !showFood;
  
  // Fetch location flags when storeId changes
  useEffect(() => {
    if (!location?.storeId) {
      return;
    }

    console.log('[AppTabs] Setting up real-time listener for storeId:', location.storeId);

    // Real-time listener for location flags
    const unsubscribe = firestore()
      .collection('locations')
      .where('storeId', '==', location.storeId)
      .limit(1)
      .onSnapshot(
        (querySnapshot) => {
          if (!querySnapshot.empty) {
            const data = querySnapshot.docs[0].data();
            console.log('[AppTabs] Real-time update - Document data:', data);
            
            const flags = {
              grocery: data?.grocery ?? true,
              food: data?.food ?? true,
              services: data?.services ?? true,
            };
            
            console.log('[AppTabs] Real-time update - Updating flags:', flags);
            updateLocation(flags);
          } else {
            console.warn('[AppTabs] Real-time update - No document found');
          }
        },
        (error) => {
          console.error('[AppTabs] Real-time listener error:', error);
        }
      );

    // Cleanup listener on unmount or storeId change
    return () => {
      console.log('[AppTabs] Cleaning up real-time listener');
      unsubscribe();
    };
  }, [location?.storeId]);

  // Show modal when ALL services are off for this area
  useEffect(() => {
    if (allServicesOff && location?.storeId) {
      setAreaUnavailableVisible(true);
    } else {
      setAreaUnavailableVisible(false);
    }
  }, [allServicesOff, location?.storeId]);

  // Navigate away if current tab becomes unavailable
  useEffect(() => {
    const navigation = navigationRef.current;
    if (!navigation) return;

    // Check if current tab is still available
    const isHomeAvailable = showGrocery;
    const isCategoriesAvailable = showGrocery;
    const isServicesAvailable = showServices;

    // If on Home or Categories tab and grocery becomes false
    if ((currentTab === 'HomeTab' || currentTab === 'CategoriesTab') && !showGrocery) {
      console.log('[AppTabs] Current tab unavailable, navigating to available tab');
      if (isServicesAvailable) {
        navigation.navigate('CategoriesTab' as never);
      } else {
        navigation.navigate('HomeTab' as never);
      }
    }
    
    // If on Services tab and services becomes false (legacy guard, ServicesTab no longer exists as a tab)
    if (currentTab === 'ServicesTab' && !showServices) {
      console.log('[AppTabs] Services tab unavailable, navigating to available tab');
      if (isHomeAvailable) {
        navigation.navigate('HomeTab' as never);
      } else {
        navigation.navigate('HomeTab' as never);
      }
    }
  }, [showGrocery, showServices, currentTab]);

  // Navigate to HomeTab when grocery becomes true (from false)
  const prevGroceryRef = useRef(showGrocery);
  useEffect(() => {
    const navigation = navigationRef.current;
    if (!navigation) return;

    // Check if grocery flag changed from false to true
    if (!prevGroceryRef.current && showGrocery) {
      console.log('[AppTabs] Grocery enabled, navigating to HomeTab');
      navigation.navigate('HomeTab' as never);
    }

    // Update previous value
    prevGroceryRef.current = showGrocery;
  }, [showGrocery]);

  // Switch from food mode to grocery mode when food becomes unavailable
  useEffect(() => {
    if (activeMode === 'food' && !showFood) {
      console.log('[AppTabs] Food unavailable, switching mode');
      // Switch to first available mode
      if (showGrocery) {
        setActiveMode('grocery');
      } else if (showServices) {
        setActiveMode('service');
      }
    }
  }, [activeMode, showFood, showGrocery, showServices, setActiveMode]);

  // Switch from grocery mode when grocery becomes unavailable
  useEffect(() => {
    if (activeMode === 'grocery' && !showGrocery) {
      console.log('[AppTabs] Grocery unavailable, switching mode');
      // Switch to first available mode
      if (showServices) {
        setActiveMode('service');
      } else if (showFood) {
        setActiveMode('food');
      }
    }
  }, [activeMode, showGrocery, showServices, showFood, setActiveMode]);

  // Switch from service mode when services becomes unavailable
  useEffect(() => {
    if (activeMode === 'service' && !showServices) {
      console.log('[AppTabs] Services unavailable, switching mode');
      // Switch to first available mode
      if (showGrocery) {
        setActiveMode('grocery');
      } else if (showFood) {
        setActiveMode('food');
      }
    }
  }, [activeMode, showServices, showGrocery, showFood, setActiveMode]);
  
  // Debug logging
  if (__DEV__) {
    console.log('[AppTabs] Location flags:', {
      storeId: location?.storeId,
      grocery: location?.grocery,
      food: location?.food,
      services: location?.services,
      showGrocery,
      showFood,
      showServices,
    });
  }
  
  // Cart selection modal state
  const [cartModalVisible, setCartModalVisible] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<any>(null);
  // Service tab loader state (shows ninjaServiceLoader.gif when Services tab is tapped)
  const [serviceLoaderVisible, setServiceLoaderVisible] = useState(false);
  // Services unavailable modal state
  const [servicesUnavailableModalVisible, setServicesUnavailableModalVisible] = useState(false);
  // Area unavailable modal state (all services off)
  const [areaUnavailableVisible, setAreaUnavailableVisible] = useState(false);


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
      // Navigate first, then show loader
      pendingNavigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [
            {
              name: "HomeTab",
              state: { routes: [{ name: "ProductsHome" }, { name: "ServiceCart" }], index: 1 },
            },
          ],
        })
      );
      
      // Show loader immediately
      setServiceLoaderVisible(true);
      
      // Hide loader after animation
      setTimeout(() => {
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
            (navigationRef.navigate as any)("CategoriesTab");
          }
        }}
      />

      {/* ── Grocery + Service: original Tab.Navigator ── */}
      {activeMode !== 'food' && (
        <Tab.Navigator
          initialRouteName={showGrocery ? "HomeTab" : "Profile"}
          screenOptions={({ route }) => ({
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
            tabBarIcon: ({ color, size }) => {
              const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
                HomeTab: "home-outline",
                CategoriesTab: "apps-outline",
                CartFlow: "cart-outline",
                Profile: "person-outline",
              };
              if (route.name === "Profile") return null;
              const iconName = iconMap[route.name];
              return (
                <Animated.View style={{ width: size + 12, height: size + 12, alignItems: "center", justifyContent: "center" }}>
                  {iconName && <Ionicons name={iconName} size={size} color={color} />}
                  {route.name === "CartFlow" && (() => {
                    const activeTotalItems = (showGrocery ? groceryTotalItems : 0) + (showServices ? serviceTotalItems : 0);
                    return activeTotalItems > 0 ? (
                      <View style={styles.badgeContainer}>
                        <Text style={styles.badgeText}>{activeTotalItems}</Text>
                      </View>
                    ) : null;
                  })()}
                </Animated.View>
              );
            },
          })}
        >
          {showGrocery && <Tab.Screen name="HomeTab" component={HomeStack} options={{ title: "Home" }} />}
          {showGrocery && <Tab.Screen name="CategoriesTab" component={CategoriesStack} options={{ title: "Categories" }} />}
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
                  const isGroceryActive = showGrocery && groceryTotalItems > 0;
                  const isServiceActive = showServices && serviceTotalItems > 0;
                  if (isGroceryActive && isServiceActive) {
                    e.preventDefault();
                    setPendingNavigation(navigation);
                    setCartModalVisible(true);
                  } else if (isGroceryActive && !isServiceActive) {
                    e.preventDefault();
                    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "CartFlow", state: { routes: [{ name: "GroceryCart" }] } }] }));
                  } else if (isServiceActive && !isGroceryActive) {
                    e.preventDefault();
                    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "HomeTab", state: { routes: [{ name: "ProductsHome" }, { name: "ServiceCart" }], index: 1 } }] }));
                  } else {
                    const nestedState = (route as any)?.state ?? (route as any)?.params?.state;
                    if (nestedState && typeof nestedState.index === "number" && nestedState.index > 0) {
                      e.preventDefault();
                      navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "CartFlow", state: { routes: [{ name: "CartHome" }] } }] }));
                    }
                  }
                }
              },
            })}
          />
        </Tab.Navigator>
      )}

      {/* ── Food: curved tab bar ── */}
      {activeMode === 'food' && showFood && (
        <View style={{ flex: 1 }}>
          <FoodTabs />
        </View>
      )}

      {/* ── Food unavailable fallback ── */}
      {activeMode === 'food' && !showFood && (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
          <Ionicons name="restaurant-outline" size={80} color="#cbd5e1" />
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#64748b', marginTop: 16 }}>
            Food service unavailable
          </Text>
          <Text style={{ fontSize: 14, color: '#94a3b8', marginTop: 8, textAlign: 'center', paddingHorizontal: 32 }}>
            Food delivery is not available in your area at the moment.
          </Text>
        </View>
      )}
      
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

      {/* Area Unavailable Modal (all services off) */}
      <AreaUnavailableModal
        visible={areaUnavailableVisible}
        onClose={() => setAreaUnavailableVisible(false)}
        onChangeLocation={() => {
          setAreaUnavailableVisible(false);
          if (navigationRef.isReady()) {
            (navigationRef.navigate as any)('LocationSelector');
          }
        }}
      />

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
const getActiveRoutePath = (state: any): string[] => {
  if (!state || !Array.isArray(state.routes) || typeof state.index !== "number") return [];
  const active = state.routes[state.index];
  const childState = (active as any)?.state;
  return [String(active?.name ?? ""), ...(childState ? getActiveRoutePath(childState) : [])].filter(
    Boolean
  );
};

const updateLastNonCartTabFromState = (state: any) => {
  try {
    const path = getActiveRoutePath(state);
    const appTabsIndex = path.indexOf("AppTabs");
    const activeTab = appTabsIndex >= 0 ? path[appTabsIndex + 1] : null;
    if (activeTab && activeTab !== "CartFlow") {
      setLastNonCartTab(activeTab);
    }
  } catch {
    // non-fatal
  }
};

const App: React.FC = () => {
  const [user, setUser] = useState<null | any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState<boolean | null>(null);
  useOtaUpdate();

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

    const unsub = auth().onAuthStateChanged((firebaseUser) => {
      setUser(firebaseUser);
      // Do NOT block app startup on a Firestore round-trip.
      setLoadingAuth(false);

      if (!firebaseUser) {
        setTermsAccepted(null);
        return;
      }

      (async () => {
        try {
          const doc = await firestore().collection('users').doc(firebaseUser.uid).get();
          setTermsAccepted(doc.exists ? doc.data()?.hasAcceptedTerms === true : false);
        } catch (e) {
          console.log('[Auth] termsAccepted fetch failed (non-fatal):', e);
          // Keep as null so we don't accidentally block the user on a transient network error.
          setTermsAccepted(null);
        }
      })();
    });

    return () => unsub();
  }, [firebaseReady]);

  // If we learn later that terms are not accepted, push the user to Terms.
  useEffect(() => {
    if (!user) return;
    if (termsAccepted !== false) return;
    try {
      if ((navigationRef as any)?.isReady?.()) {
        navigationRef.dispatch(
          CommonActions.navigate({ name: 'TermsAndConditions' as never } as any)
        );
      }
    } catch {
      // non-fatal
    }
  }, [user, termsAccepted]);

  /* push-token permission modal */
  const [showNotifModal, setShowNotifModal] = useState(false);
  const NOTIF_MODAL_SNOOZE_UNTIL_KEY = "notif_modal_snooze_until_v1";
  const NOTIF_MODAL_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  useEffect(() => {
    (async () => {
      // (optional) prove the plist is bundled
      if (!__DEV__) return;
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

  // NOTE: auth listener is handled above (gated by firebaseReady)

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


  // IMPORTANT: do not block UI on OTA checks (network can take 10s+).
  // OTA checks run in the background and will reload when an update is fetched.
  if (!firebaseReady || loadingAuth) {
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

        <ToggleProvider>
        <CustomerProvider>
        <CartProvider>
            <FoodCartProvider>
            <ServiceCartProvider>
              <StartupServicePaymentRecovery user={user} firebaseReady={firebaseReady} />
              <LocationProvider>
                <WeatherProvider>
                  <OrderProvider>
                <NavigationContainer
                  ref={navigationRef}
                  onReady={() => {
                    updateLastNonCartTabFromState(
                      navigationRef.getRootState?.() ?? (navigationRef as any).getState?.()
                    );
                  }}
                  onStateChange={(state) => {
                    updateLastNonCartTabFromState(state);
                  }}
                >
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
            </FoodCartProvider>
        </CartProvider>
      </CustomerProvider>
        </ToggleProvider>

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
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  serviceLoaderImage: {
    width: "100%",
    height: "100%",
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
