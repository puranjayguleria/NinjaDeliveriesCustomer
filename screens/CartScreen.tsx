// screens/CartScreen.tsx
// ✅ ONLINE payment (Razorpay TEST) added using hardcoded Cloud Function URLs (change later to ENV in prod)
// ✅ Existing functionality preserved: delivery window checks, store-change clears cart, hotspots fee,
//    promos, weather surge, stock batch update, orders paused modal, etc.
// ✅ Safe payment flow: create Razorpay order (server) -> open Razorpay -> verify (server) -> create Firestore order
// ✅ COD flow unchanged (still creates order directly)
// ✅ Fixed: "Pay Now" button is truly disabled when paused/loading (disabled + onPress no-op guard)

import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Image,
  Alert,
  ScrollView,
  Dimensions,
  Modal,
  Animated,
  InteractionManager,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import {
  useFocusEffect,
  useIsFocused,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { getLastNonCartTab, navigationRef } from "../navigation/rootNavigation";
import auth from "@react-native-firebase/auth";
import firestore, { firebase } from "@react-native-firebase/firestore";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import ConfettiCannon from "react-native-confetti-cannon";
import { useCart } from "../context/CartContext";
import { GOOGLE_PLACES_API_KEY } from "@env";
import ErrorModal from "../components/ErrorModal";
import { findNearestStore } from "../utils/findNearestStore";
import { useLocationContext } from "@/context/LocationContext";
import NotificationModal from "../components/NotificationModal";
import RecommendCard from "@/components/RecommendedCard";
import Loader from "@/components/VideoLoader";
import axios from "axios";
import { openRazorpayNative } from "../utils/razorpayNative";
import { registerRazorpayWebViewCallbacks } from "../utils/razorpayWebViewCallbacks";
import { useWeather } from "../context/WeatherContext";
import { useRestaurantCart } from "../context/RestaurantCartContext";
import { useServiceCart } from "../context/ServiceCartContext";
import PaymentMethodModal from "../components/PaymentMethodModal";




// ✅ WebView Razorpay Integration - No native module needed
console.log("🚀 Cart system initialized - WebView Razorpay Integration");
const api = axios.create({
  timeout: 20000,
  headers: { "Content-Type": "application/json" },
});

const getAuthHeaders = async () => {
  const user = auth().currentUser;
  if (!user) throw new Error("Not logged in");
  const token = await user.getIdToken(true);
  return { Authorization: `Bearer ${token}` };
};
/** -------------------------
 *  HARD-CODED (TESTING ONLY)
 *  -------------------------
 *  Later in production: move to @env
 */
const CLOUD_FUNCTIONS_BASE_URL =
  "https://asia-south1-ninjadeliveries-91007.cloudfunctions.net"; // <-- change if region/project differs
const CREATE_RZP_ORDER_URL = `${CLOUD_FUNCTIONS_BASE_URL}/createRazorpayOrder`;
const VERIFY_RZP_PAYMENT_URL = `${CLOUD_FUNCTIONS_BASE_URL}/verifyRazorpayPayment`;


/**
 * Returns true if the current time is inside the delivery window.
 * Reads the window from delivery_timing/timingData in Firestore.
 */
const checkDeliveryWindow = async (): Promise<boolean> => {
  try {
    const doc = await firestore()
      .collection("delivery_timing")
      .doc("timingData")
      .get();

    if (!doc.exists) return true;

    const { fromTime, toTime } = doc.data() as {
      fromTime: number | string;
      toTime: number | string;
    };

    const from = Number(fromTime);
    const to = Number(toTime);
    const now = new Date().getHours();

    if (Number.isNaN(from) || Number.isNaN(to)) return true;
    if (from === to) return true;

    if (from < to) return now >= from && now < to;
    return now >= from || now < to;
  } catch (e) {
    console.error("[checkDeliveryWindow]", e);
    return true;
  }
};

let storeChangeSerial = 0;

type Product = {
  id: string;
  name: string;
  description?: string;
  price: number;
  discount?: number;
  image: string;
  quantity: number;
  CGST?: number;
  SGST?: number;
  cess?: number;

  // ✅ you already use matchingProducts in fetchRecommended
  matchingProducts?: string[];
  storeId?: string;
};

type Hotspot = {
  id: string;
  name: string;
  center: firebase.firestore.GeoPoint;
  radiusKm: number;
  convenienceCharge: number;
  reasons: string[];
};

type ConvenienceResult = {
  hotspot: Hotspot | null;
  fee: number;
};

type WeatherThreshold = {
  precipMmPerHr: number;
  windSpeedKph: number;
};

type PromoCode = {
  id: string;
  code: string;
  discountType: "flat" | "percent";
  discountValue: number;
  label?: string;
  description?: string;
  isActive: boolean;

  // NOTE: your UI uses minValue; include it so TS doesn’t break
  minValue?: number;

  storeId?: string;
  usedBy?: string[];
  usedByIds?: string[];
  usedByPhones?: string[];
};

type FareData = {
  additionalCostPerKm: number;
  baseDeliveryCharge: number;
  distanceThreshold: number;
  gstPercentage: number;
  platformFee: number;
  surgeFee?: number;
  fixedPickupLocation?: {
    address: string;
    coordinates: {
      latitude: string;
      longitude: string;
    };
    name: string;
  };
  weatherThreshold?: WeatherThreshold;
};

type RazorpayPaymentMeta = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

const RECO_CARD_WIDTH = 140;
const RECO_GAP = 12;
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const toPaise = (amountRupees: number) => Math.round(Number(amountRupees) * 100);

const CartScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const footerLift = tabBarHeight;
  const scrollViewBottomGap = 84 + footerLift;

  useEffect(() => {
    if (
      Platform.OS === "android" &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const animateNext = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, []);

  const handleBackPress = () => {
    if (navigation.canGoBack?.()) {
      navigation.goBack();
      return;
    }

    const lastTab = getLastNonCartTab();
    if (navigationRef.isReady?.() && lastTab) {
      try {
        if (lastTab === "ServicesTab") {
          navigationRef.navigate(
            "ServicesTab" as never,
            { screen: "ServicesHome" } as never
          );
          return;
        }
        navigationRef.navigate(lastTab as never);
        return;
      } catch {
        // fall through
      }
    }

    const availableRoutes = new Set<string>();
    const collect = (state: any) => {
      if (!state) return;
      (state.routeNames ?? []).forEach((n: string) => availableRoutes.add(n));
      (state.routes ?? []).forEach((r: any) => collect(r.state));
    };
    collect(navigationRef.getRootState?.() ?? (navigationRef as any).getState?.());

    if (navigationRef.isReady?.()) {
      if (availableRoutes.size === 0) {
        try {
          navigationRef.navigate("HomeTab" as never);
          return;
        } catch {}
      }
      if (availableRoutes.has("HomeTab")) {
        navigationRef.navigate("HomeTab" as never);
        return;
      }
      if (availableRoutes.has("NinjaEatsHomeTab")) {
        navigationRef.navigate("NinjaEatsHomeTab" as never);
        return;
      }
      if (availableRoutes.has("ServicesTab")) {
        navigationRef.navigate("ServicesTab" as never, { screen: "ServicesHome" } as never);
        return;
      }
    }
  };

  const { location, updateLocation } = useLocationContext();
  const prevStoreIdRef = useRef<string | null>(location.storeId ?? null);

  const [recommended, setRecommended] = useState<Product[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [convenienceFee, setConvenienceFee] = useState<number>(0);
  const [activeHotspot, setActiveHotspot] = useState<Hotspot | null>(null);

  const {
    cart,
    increaseQuantity,
    decreaseQuantity,
    removeFromCart,
    clearCart,
    addToCart,
  } = useCart();

  const restaurantCart = useRestaurantCart();
  const serviceCart = useServiceCart();

  const [cartItems, setCartItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOrderAcceptancePaused, setIsOrderAcceptancePaused] = useState<
    boolean | null
  >(null);
  const [refreshingCartItems, setRefreshingCartItems] = useState(false);

  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [selectedPromo, setSelectedPromo] = useState<PromoCode | null>(null);

  const [subtotal, setSubtotal] = useState<number>(0);
  const [productCgst, setProductCgst] = useState<number>(0);
  const [productSgst, setProductSgst] = useState<number>(0);
  const [productCess, setProductCess] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [surgeLine, setSurgeLine] = useState<number>(0);

  const [distance, setDistance] = useState<number>(0);
  const [deliveryCharge, setDeliveryCharge] = useState<number>(0);
  const [rideCgst, setRideCgst] = useState<number>(0);
  const [rideSgst, setRideSgst] = useState<number>(0);

  const [platformFee, setPlatformFee] = useState<number>(0);
  const [finalTotal, setFinalTotal] = useState<number>(0);

  const [fareData, setFareData] = useState<FareData | null>(null);

  const [showConfetti, setShowConfetti] = useState<boolean>(false);
  const lastOfferKeyRef = useRef<Record<string, string | null>>({});

  // Confetti when a quantity offer becomes applied (transition from none -> some).
  useEffect(() => {
    const items = (serviceCart as any)?.state?.items || {};
    const nextMap: Record<string, string | null> = { ...lastOfferKeyRef.current };
    let shouldCelebrate = false;

    Object.entries(items).forEach(([serviceId, item]: any) => {
      const offer = item?.additionalInfo?.appliedQuantityOffer;
      const offerKey = offer
        ? `${offer.discountType || ''}|${offer.minQuantity || ''}|${offer.newPricePerUnit || offer.discountValue || ''}`
        : null;

      const prevKey = lastOfferKeyRef.current?.[serviceId] ?? null;
      nextMap[serviceId] = offerKey;
      if (!prevKey && offerKey) {
        shouldCelebrate = true;
      }
    });

    lastOfferKeyRef.current = nextMap;

    if (shouldCelebrate) {
      setShowConfetti(true);
    }
  }, [serviceCart, serviceCart?.state?.items]);
  const unseenChangeId = useRef<number | null>(null);
  const lastSeenChangeId = useRef<number>(0);

  const [userLocations, setUserLocations] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);

  const [notificationModalVisible, setNotificationModalVisible] =
    useState(false);
  const [notificationModalMessage, setNotificationModalMessage] = useState("");

  const [showLocationSheet, setShowLocationSheet] = useState<boolean>(false);
  const [showPausedModal, setShowPausedModal] = useState<boolean>(false);
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);

  const [navigating, setNavigating] = useState<boolean>(false);

  const colorAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState("");

  const { isBadWeather } = useWeather();
  const [loadingCartUpdate, setLoadingCartUpdate] = useState(false);

  const n = (x: any, dflt = 0) => {
    const v = Number(x);
    return Number.isFinite(v) ? v : dflt;
  };

  const maybeShowNotice = () => {
    if (
      unseenChangeId.current !== null &&
      unseenChangeId.current > lastSeenChangeId.current &&
      !showLocationSheet &&
      isFocused
    ) {
      lastSeenChangeId.current = unseenChangeId.current;
      unseenChangeId.current = null;
      InteractionManager.runAfterInteractions(() =>
        setNotificationModalVisible(true)
      );
    }
  };

  /***************************************
   * Animate Checkout Button
   ***************************************/
  useEffect(() => {
    Animated.timing(colorAnim, {
      toValue: selectedLocation ? 1 : 0,
      duration: 600,
      useNativeDriver: false,
    }).start();

    if (selectedLocation) {
      Animated.sequence([
        Animated.timing(shakeAnim, {
          toValue: 1,
          duration: 70,
          useNativeDriver: false,
        }),
        Animated.timing(shakeAnim, {
          toValue: -1,
          duration: 70,
          useNativeDriver: false,
        }),
        Animated.timing(shakeAnim, {
          toValue: 1,
          duration: 70,
          useNativeDriver: false,
        }),
        Animated.timing(shakeAnim, {
          toValue: -1,
          duration: 70,
          useNativeDriver: false,
        }),
        Animated.timing(shakeAnim, {
          toValue: 0,
          duration: 70,
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      shakeAnim.setValue(0);
    }
  }, [selectedLocation, colorAnim, shakeAnim]);

  useEffect(() => {
    const currentStore = location.storeId ?? null;

    if (prevStoreIdRef.current === null && currentStore !== null) {
      prevStoreIdRef.current = currentStore;
      return;
    }

    if (currentStore && currentStore !== prevStoreIdRef.current) {
      const allCartsEmpty = isAllCartsEmpty();
      
      // Only clear cart if switching to a different store that can't deliver to current location
      // Allow location changes within the same delivery area without clearing cart
      const shouldClearCart = false; // Changed: Don't automatically clear cart on location change
      
      if (!allCartsEmpty && shouldClearCart) {
        // Clear all carts when store location changes and carts have items
        clearAllCarts();
      }
      setSelectedLocation(null);
      setShowLocationSheet(false);
      prevStoreIdRef.current = currentStore;

      if (isFocused) {
        if (allCartsEmpty) {
          // Navigate directly to location selector for empty cart
          navigation.navigate("LocationSelector", {
            fromScreen: "Cart",
          });
        } else if (shouldClearCart) {
          storeChangeSerial += 1;
        unseenChangeId.current = storeChangeSerial;
        setNotificationModalMessage(
          "Looks like you’ve switched to another store. Your cart has been emptied—please add items again."
        );
        maybeShowNotice();
        }
      }
    }
  }, [location.storeId, isFocused, clearCart, navigation]);

  const animatedButtonColor = colorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgb(231,76,60)", "rgb(40,167,69)"],
  });
  const shakeTranslate = shakeAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: [-10, 10],
  });

  /***************************************
   * Hotspots
   ***************************************/
  const fetchHotspots = async (storeId: string | null) => {
    if (!storeId) {
      setHotspots([]);
      return;
    }

    const snap = await firestore()
      .collection("hotspots")
      .where("storeId", "==", storeId)
      .get();

    const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Hotspot) }));
    setHotspots(list);
  };

  /***************************************
   * Fetch Data On Mount
   ***************************************/
  useEffect(() => {
    fetchFareData(location.storeId ?? null);
    fetchHotspots(location.storeId ?? null);
    fetchCartItems(true);
    watchPromos();
    const unsubscribe = watchUserLocations();
    setLoading(false);
    return () => {
      if (unsubscribe) unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchCartItems(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart]);

  // ✅ paused orders watcher (kept)
  useEffect(() => {
    if (!location?.storeId) return;

    const unsubscribe = firestore()
      .collection("delivery_zones")
      .doc(location.storeId)
      .onSnapshot((doc) => {
        if (doc.exists) {
          const data = doc.data();
          const isActive = data?.isActive ?? true;
          setIsOrderAcceptancePaused(!isActive);
        } else {
          setIsOrderAcceptancePaused(false);
        }
      });

    return () => unsubscribe();
  }, [location?.storeId]);

  // location param (kept)
  useEffect(() => {
    if (route.params?.selectedLocation) {
      (async () => {
        const ok = await checkDeliveryWindow();
        if (!ok) {
          Alert.alert(
            "Closed for deliveries",
            "Sorry, we’re not delivering right now. Please try again during our next delivery window."
          );
        } else {
          const allCartsEmpty = isAllCartsEmpty();
          
          // Only clear carts if they have items
          if (!allCartsEmpty) {
            clearAllCarts();
          }
          setSelectedLocation(route.params.selectedLocation);
        }
        navigation.setParams({ selectedLocation: null });
      })();
    }
  }, [route.params?.selectedLocation, navigation]);

  useEffect(() => {
    fetchFareData(location.storeId ?? null);
    fetchHotspots(location.storeId ?? null);
  }, [location.storeId]);

  useEffect(() => {
    (async () => {
      if (selectedLocation && hotspots.length) {
        const res = await checkHotspot(
          selectedLocation.lat,
          selectedLocation.lng,
          hotspots
        );
        setConvenienceFee(res.fee);
        setActiveHotspot(res.hotspot);
      } else {
        setConvenienceFee(0);
        setActiveHotspot(null);
      }
    })();
  }, [selectedLocation, hotspots]);

  /***************************************
   * Firestore Data
   ***************************************/
  const fetchFareData = async (storeId: string | null) => {
    if (!storeId) {
      setFareData(null);
      return;
    }

    try {
      const snap = await firestore()
        .collection("orderSetting")
        .where("storeId", "==", storeId)
        .limit(1)
        .get();

      if (!snap.empty && snap.docs[0].exists) {
        setFareData(snap.docs[0].data() as FareData);
      } else {
        console.warn("No orderSetting found for store", storeId);
        setFareData(null);
      }
    } catch (err) {
      console.error("fetchFareData:", err);
      setFareData(null);
    }
  };

  useEffect(() => {
    if (cartItems.length > 0) calculateTotals();
    else resetTotals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartItems, cart, selectedPromo, selectedLocation, fareData, convenienceFee]);

  const fetchCartItems = async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
        setRefreshingCartItems(true);
      }

      const productIds = Object.keys(cart);
      if (productIds.length === 0) {
        setCartItems([]);
        return;
      }

      const batchPromises: Promise<firebase.firestore.QuerySnapshot>[] = [];
      const tempIds = [...productIds];

      while (tempIds.length > 0) {
        const batchIds = tempIds.splice(0, 10);

        batchPromises.push(
          firestore()
            .collection("products")
            .where(firestore.FieldPath.documentId(), "in", batchIds)
            .get()
        );

        batchPromises.push(
          firestore()
            .collection("saleProducts")
            .where(firestore.FieldPath.documentId(), "in", batchIds)
            .get()
        );
      }

      const snapshots = await Promise.all(batchPromises);

      const productsData: Product[] = [];
      snapshots.forEach((snap) => {
        snap.forEach((doc) => {
          const data = doc.data() as Product;
          if ((data.quantity ?? 0) > 0) {
            const existing = productsData.find((p) => p.id === doc.id);
            if (!existing) {
              productsData.push({ id: doc.id, ...data });
            } else {
              if (doc.ref.parent.path.includes("saleProducts") && data.discount) {
                productsData[productsData.indexOf(existing)] = {
                  id: doc.id,
                  ...data,
                };
              }
            }
          }
        });
      });

      const visible = productsData.filter((p) => (cart[p.id] ?? 0) > 0);
      setCartItems(visible);

      await fetchRecommended(visible);
    } catch (error) {
      console.error("Error fetching cart items:", error);
      Alert.alert("Error", "Failed to fetch cart items.");
    } finally {
      if (showLoader) {
        setRefreshingCartItems(false);
        setLoading(false);
      }
    }
  };

  useFocusEffect(
    useCallback(() => {
      maybeShowNotice();
      return () => setNotificationModalVisible(false);
    }, [showLocationSheet])
  );

  // Note: Removed automatic redirect for empty cart to allow manual location selection

  const fetchRecommended = async (baseItems: Product[]) => {
    try {
      const wanted = new Set<string>();

      baseItems.forEach((p) => {
        (p.matchingProducts ?? []).forEach((id) => wanted.add(id));
        wanted.delete(p.id);
      });

      const idList = Array.from(wanted).filter(
        (id) => typeof id === "string" && id.trim() !== "" && !id.includes("/")
      );

      if (idList.length === 0 || !location.storeId) {
        setRecommended([]);
        return;
      }

      const reads: Promise<firebase.firestore.QuerySnapshot>[] = [];
      for (let i = 0; i < idList.length; i += 10) {
        const chunk = idList.slice(i, i + 10);
        reads.push(
          firestore()
            .collection("products")
            .where(firestore.FieldPath.documentId(), "in", chunk)
            .where("storeId", "==", location.storeId)
            .get()
        );
      }

      const snapshots = await Promise.all(reads);

      const recs: Product[] = [];
      snapshots.forEach((snap) =>
        snap.forEach((doc) => {
          const data = doc.data() as Product;
          if ((data.quantity ?? 0) > 0) recs.push({ id: doc.id, ...data });
        })
      );

      setRecommended(recs.slice(0, 10));
    } catch (err) {
      console.error("[fetchRecommended]", err);
      setRecommended([]);
    }
  };

  const watchUserLocations = () => {
    const currentUser = auth().currentUser;
    if (!currentUser) return null;

    const userDocRef = firestore().collection("users").doc(currentUser.uid);
    return userDocRef.onSnapshot(
      (docSnap) => {
        if (docSnap.exists) {
          const userData = docSnap.data();
          setUserLocations(userData?.locations || []);
        }
      },
      (err) => console.error("Error watching user locations:", err)
    );
  };

  const watchPromos = () => {
    const currentUser = auth().currentUser;
    if (!currentUser) return () => {};

    return firestore()
      .collection("promoCodes")
      .where("isActive", "==", true)
      .onSnapshot(
        async (snapshot) => {
          const raw = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...(doc.data() as Omit<PromoCode, "id">),
          }));

          const phone = currentUser.phoneNumber ?? "";
          const uid = currentUser.uid;
          const userStoreId = location.storeId ?? null;

          const filtered = raw.filter((promo) => {
            const byId = promo.usedByIds ?? promo.usedBy ?? [];
            const byPhone = promo.usedByPhones ?? [];
            const promoStoreId = promo?.storeId;

            return (
              !byId.includes(uid) &&
              !byPhone.includes(phone) &&
              promoStoreId &&
              userStoreId &&
              promoStoreId === userStoreId
            );
          });

          setPromos(filtered);
        },
        (err) => console.error("Error listening to promos:", err)
      );
  };

  /***************************************
   * Distance from Google
   ***************************************/
  const fetchDistanceFromGoogle = async (
    pickupLat: string,
    pickupLng: string,
    dropoffLat: string,
    dropoffLng: string
  ): Promise<number> => {
    try {
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?units=metric&origins=${pickupLat},${pickupLng}&destinations=${dropoffLat},${dropoffLng}&key=${GOOGLE_PLACES_API_KEY.replace(
        /\s+/g,
        ""
      )}`;
      const response = await fetch(url);
      const data = await response.json();
      if (
        data.status === "OK" &&
        data.rows?.length > 0 &&
        data.rows[0].elements?.length > 0 &&
        data.rows[0].elements[0].distance
      ) {
        const distMeters = data.rows[0].elements[0].distance.value;
        return distMeters / 1000.0;
      }
      return 0;
    } catch (err) {
      console.error("Error from Google Distance API:", err);
      return 0;
    }
  };

  const checkHotspot = async (
    dropLat: number,
    dropLng: number,
    spots: Hotspot[]
  ): Promise<ConvenienceResult> => {
    if (!spots.length) return { hotspot: null, fee: 0 };

    const destinations = spots
      .map((h) => `${h.center.latitude},${h.center.longitude}`)
      .join("|");

    try {
      const { data } = await axios.get(
        "https://maps.googleapis.com/maps/api/distancematrix/json",
        {
          params: {
            origins: `${dropLat},${dropLng}`,
            destinations,
            key: GOOGLE_PLACES_API_KEY.replace(/\s+/g, ""),
            units: "metric",
          },
        }
      );

      if (data.status !== "OK") return { hotspot: null, fee: 0 };

      let winner: { spot: Hotspot; distKm: number } | null = null;
      data.rows[0].elements.forEach((el: any, idx: number) => {
        if (el.status !== "OK") return;
        const km = n(el.distance.value) / 1000;
        const spot = spots[idx];
        if (km <= spot.radiusKm && (!winner || km < winner.distKm))
          winner = { spot, distKm: km };
      });

      return winner
        ? { hotspot: winner.spot, fee: n(winner.spot.convenienceCharge) }
        : { hotspot: null, fee: 0 };
    } catch (e) {
      console.error("[checkHotspot]", e);
      return { hotspot: null, fee: 0 };
    }
  };

  /***************************************
   * Calculate Totals
   ***************************************/
  const calculateTotals = async () => {
    if (!fareData) return;

    let _subtotal = 0;
    let _productCgst = 0;
    let _productSgst = 0;
    let _productCess = 0;

    cartItems.forEach((item) => {
      const qty = cart[item.id] || 0;
      const realPrice = item.discount ? item.price - item.discount : item.price;

      _subtotal += realPrice * qty;
      if (item.CGST) _productCgst += item.CGST * qty;
      if (item.SGST) _productSgst += item.SGST * qty;
      if (item.cess) _productCess += item.cess * qty;
    });

    let _discount = 0;
    if (selectedPromo) {
      if (selectedPromo.discountType === "flat") {
        _discount = selectedPromo.discountValue;
      } else {
        _discount = (_subtotal * selectedPromo.discountValue) / 100;
      }
      if (_discount > _subtotal) _discount = _subtotal;
    }

    const itemsTotal = _subtotal - _discount;

    let distanceInKm = 0;
    if (selectedLocation?.lat && selectedLocation?.lng) {
      const pickupLat =
        fareData.fixedPickupLocation?.coordinates.latitude || "0";
      const pickupLng =
        fareData.fixedPickupLocation?.coordinates.longitude || "0";
      distanceInKm = await fetchDistanceFromGoogle(
        pickupLat,
        pickupLng,
        String(selectedLocation.lat),
        String(selectedLocation.lng)
      );
    }

    let _deliveryCharge = 0;
    if (distanceInKm <= n(fareData.distanceThreshold)) {
      _deliveryCharge = n(fareData.baseDeliveryCharge);
    } else {
      const extraKms = distanceInKm - n(fareData.distanceThreshold);
      _deliveryCharge =
        n(fareData.baseDeliveryCharge) +
        extraKms * n(fareData.additionalCostPerKm);
    }

    const totalGstOnDelivery =
      (_deliveryCharge * n(fareData.gstPercentage)) / 100;
    const _rideCgst = totalGstOnDelivery / 2;
    const _rideSgst = totalGstOnDelivery / 2;

    const _platformFee = n(fareData.platformFee);

    const surgeFee = isBadWeather ? fareData?.surgeFee ?? 0 : 0;

    const _conFee = n(convenienceFee);

    const _final =
      itemsTotal +
      _productCgst +
      _productSgst +
      _productCess +
      _deliveryCharge +
      _rideCgst +
      _rideSgst +
      _platformFee +
      surgeFee +
      _conFee;

    setSubtotal(_subtotal);
    setProductCgst(_productCgst);
    setProductSgst(_productSgst);
    setProductCess(_productCess);
    setDiscount(_discount);

    setDistance(distanceInKm);
    setDeliveryCharge(_deliveryCharge);
    setRideCgst(_rideCgst);
    setRideSgst(_rideSgst);
    setPlatformFee(_platformFee);
    setSurgeLine(surgeFee);
    setFinalTotal(_final);
  };

  const resetTotals = () => {
    setSubtotal(0);
    setProductCgst(0);
    setProductSgst(0);
    setProductCess(0);
    setDiscount(0);
    setDistance(0);
    setDeliveryCharge(0);
    setRideCgst(0);
    setRideSgst(0);
    setPlatformFee(0);
    setSurgeLine(0);
    setFinalTotal(0);
    setConvenienceFee(0);
    setActiveHotspot(null);
  };

  /***************************************
   * PROMO
   ***************************************/
  const selectPromo = (promo: PromoCode) => {
    setSelectedPromo(promo);
    setShowConfetti(true);
  };
  const clearPromo = () => setSelectedPromo(null);

  /***************************************
   * CHECKOUT
   ***************************************/
  const handleCheckout = async () => {
    // ✅ block while paused status unknown
    if (isOrderAcceptancePaused === null) {
      Alert.alert("Please wait", "Checking store availability...");
      return;
    }

    if (isOrderAcceptancePaused === true) {
      setShowPausedModal(true);
      return;
    }

    // delivery timing check (kept)
    try {
      const timingDoc = await firestore()
        .collection("delivery_timing")
        .doc("timingData")
        .get();

      if (timingDoc.exists) {
        const { fromTime, toTime } = timingDoc.data() as {
          fromTime: number;
          toTime: number;
        };
        const currentHour = new Date().getHours();
        if (currentHour < fromTime || currentHour >= toTime) {
          setErrorModalMessage(
            "Sorry this is out of my delivering hours. How about you try tomorrow morning?"
          );
          setErrorModalVisible(true);
          return;
        }
      }
    } catch (err) {
      console.error("Error checking delivery timing:", err);
    }

    if (cartItems.length === 0) {
      Alert.alert("Cart is Empty", "Please add some products to your cart.");
      return;
    }

    if (!selectedLocation && userLocations.length === 0) {
      navigation.navigate("LocationSelector", { fromScreen: "Cart" });
    } else if (!selectedLocation && userLocations.length > 0) {
      setShowLocationSheet(true);
    } else {
      // Show payment method selection modal
      setShowPaymentModal(true);
    }
  };

  /***************************************
   * PAYMENT METHOD HANDLERS
   ***************************************/
  const handleCODPayment = async () => {
    try {
      setShowPaymentModal(false);
      await handlePaymentComplete("cod");
    } catch (error) {
      console.error("COD payment error:", error);
      Alert.alert("Error", "COD payment failed. Please try again.");
    }
  };

  const handleOnlinePayment = async () => {
    try {
      setShowPaymentModal(false);
      
      // Show loading immediately
      setNavigating(true);

      // Create Razorpay order on server
      const serverOrder = await createRazorpayOrderOnServer(finalTotal);
      
      // Navigate directly to RazorpayWebView for immediate payment
      const user = auth().currentUser;
      if (!user) throw new Error("Not logged in");

      const contact = (user.phoneNumber || "").replace("+91", "");

      // --- Try Native Razorpay Checkout first (better UPI app redirection) ---
      try {
        const amountPaise = Math.round(finalTotal * 100);
        const nativeRes = await openRazorpayNative({
          key: String(serverOrder.keyId),
          order_id: String(serverOrder.orderId),
          amount: String(amountPaise),
          currency: String(serverOrder.currency || "INR"),
          name: "Ninja Deliveries",
          description: "Grocery Order Payment",
          prefill: { contact, email: "", name: "" },
          // Keep notes minimal for grocery flow. (Services uses bookingIds etc.)
          notes: { type: "grocery_order" },
          theme: { color: "#059669" },
        });

        const razorpayMeta = {
          razorpay_order_id: nativeRes.razorpay_order_id,
          razorpay_payment_id: nativeRes.razorpay_payment_id,
          razorpay_signature: nativeRes.razorpay_signature,
        };

        await verifyRazorpayPaymentOnServer(razorpayMeta);
        await handlePaymentComplete("online", razorpayMeta, serverOrder);
        setNavigating(false);
        return; // don't fall through to WebView
      } catch (nativeErr: any) {
        // If native isn't available / fails, fall back to WebView.
        if (__DEV__) {
          console.warn("\uD83D\uDCB3[RZPNative] grocery_fallback_to_webview", nativeErr);
          Alert.alert(
            "Native UPI fallback",
            "Native Razorpay didn't open. Using WebView fallback. Check console logs for details."
          );
        }
      }

      // Navigate immediately to Razorpay WebView
      const sessionId = registerRazorpayWebViewCallbacks({
        onSuccess: async (response: any) => {
          try {
            console.log('Payment successful:', response);
            const razorpayMeta = {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            };

            // Verify payment on server
            await verifyRazorpayPaymentOnServer(razorpayMeta);

            // Complete the order
            await handlePaymentComplete("online", razorpayMeta, serverOrder);
          } catch (error) {
            console.error("Payment completion error:", error);
            Alert.alert("Error", "Payment verification failed. Please contact support.");
          } finally {
            setNavigating(false);
          }
        },
        onFailure: (error: any) => {
          console.error("Payment failed:", error);
          Alert.alert(
            "Payment Failed",
            error.description || "Payment was not completed. Please try again."
          );
          setNavigating(false);
        },
      });

      navigation.navigate('RazorpayWebView', {
        orderId: serverOrder.orderId,
        amount: finalTotal,
        keyId: serverOrder.keyId,
        currency: serverOrder.currency || 'INR',
        name: 'Ninja Deliveries',
        description: 'Grocery Order Payment',
        prefill: {
          contact,
          email: '',
          name: '',
        },
        sessionId,
      });
    } catch (error: any) {
      console.error("Online payment error:", error);
      
      if (error.code === "payment_cancelled") {
        Alert.alert("Payment Cancelled", "You cancelled the payment. Please try again.");
      } else {
        Alert.alert("Payment Failed", error.message || "Failed to initiate payment. Please try again.");
      }
      setNavigating(false);
    }
  };

  /***************************************
   * RAZORPAY (TEST) - helpers
   ***************************************/
 const createRazorpayOrderOnServer = async (amountRupees: number) => {
  const user = auth().currentUser;
  if (!user) throw new Error("Not logged in");

  const amountPaise = toPaise(amountRupees);
  const headers = await getAuthHeaders();

  const { data } = await api.post(
    CREATE_RZP_ORDER_URL,
    {
      amountPaise,
      currency: "INR",
      receipt: `rcpt_${user.uid}_${Date.now()}`,
      notes: { uid: user.uid, storeId: location.storeId || "" },
    },
    { headers }
  );

  // ✅ these keys match the function response
  if (!data?.orderId || !data?.keyId) {
    throw new Error(data?.error || "Failed to create Razorpay order");
  }

  return {
    orderId: String(data.orderId),
    keyId: String(data.keyId),
    amountPaise: Number(data.amountPaise ?? amountPaise),
    currency: String(data.currency ?? "INR"),
  };
};



 const verifyRazorpayPaymentOnServer = async (meta: RazorpayPaymentMeta) => {
  const headers = await getAuthHeaders();

  const { data } = await api.post(VERIFY_RZP_PAYMENT_URL, meta, { headers });

  if (!data?.verified) throw new Error(data?.error || "Payment verification failed");
  return true;
};

  /***************************************
   * PAYMENT COMPLETION HANDLER
   ***************************************/
  const handlePaymentComplete = async (
    paymentMethod: "cod" | "online",
    razorpayMeta?: RazorpayPaymentMeta,
    serverOrder?: { orderId: string; amountPaise: number; currency: string; keyId: string }
  ) => {
    console.log("Payment completion handler called:", { paymentMethod, razorpayMeta, serverOrder });
    try {
      setNavigating(true);
      const result = await handleCreateOrder(paymentMethod, razorpayMeta, serverOrder);
      console.log("Order creation result:", result);
      
      if (result) {
        if (selectedPromo) {
          setPromos((prev) => prev.filter((p) => p.id !== selectedPromo.id));
          setSelectedPromo(null);
        }
        
        const { orderId, pickupCoords } = result;
        // Clear all carts after successful order
        clearAllCarts();
        setSelectedLocation(null);

        console.log("Navigating to OrderAllocating with:", {
          orderId,
          pickupCoords,
          dropoffCoords: {
            latitude: Number(selectedLocation?.lat) || 0,
            longitude: Number(selectedLocation?.lng) || 0,
          },
          totalCost: finalTotal,
        });

        navigation.navigate("OrderAllocating", {
          orderId,
          pickupCoords: {
            latitude: Number(pickupCoords?.latitude) || 0,
            longitude: Number(pickupCoords?.longitude) || 0,
          },
          dropoffCoords: {
            latitude: Number(selectedLocation?.lat) || 0,
            longitude: Number(selectedLocation?.lng) || 0,
          },
          totalCost: finalTotal,
        });
      }
    } catch (error) {
      console.error("Error during checkout:", error);
      Alert.alert("Error", "Unable to complete checkout. Please try again.");
      throw error; // Re-throw to let CartPaymentScreen handle the error display
    } finally {
      setNavigating(false);
    }
  };

  /***************************************
   * CREATE ORDER
   ***************************************/
  const handleCreateOrder = async (
  paymentMethod: "cod" | "online",
  razorpayMeta?: RazorpayPaymentMeta,
  serverOrder?: { orderId: string; amountPaise: number; currency: string; keyId: string }
) => {
    try {
      const user = auth().currentUser;
      if (!user || !selectedLocation || !fareData) return null;

      const items = cartItems.map((item) => {
        const qty = cart[item.id] || 0;
        return {
          productId: item.id,
          name: item.name,
          price: item.price,
          discount: item.discount || 0,
          quantity: qty,
          CGST: item.CGST || 0,
          SGST: item.SGST || 0,
          cess: item.cess || 0,
        };
      });

      // stock batch (kept)
      const batch = firestore().batch();
      for (let i = 0; i < items.length; i++) {
        const { productId, quantity } = items[i];

        let productRef = firestore().collection("saleProducts").doc(productId);
        let productSnap = await productRef.get();

        if (!productSnap.exists) {
          productRef = firestore().collection("products").doc(productId);
          productSnap = await productRef.get();
          if (!productSnap.exists) {
            throw new Error("Some products are no longer available.");
          }
        }

        const data = productSnap.data() as Product | undefined;
        if (!data || typeof data.quantity !== "number") {
          throw new Error(`Invalid product data for ID ${productId}`);
        }

        const currentQty = data.quantity || 0;
        if (currentQty < quantity) {
          throw new Error(
            `Not enough stock for product: ${data.name || `ID` + productId}`
          );
        }

        const newQty = currentQty - quantity;
        batch.update(productRef, { quantity: newQty < 0 ? 0 : newQty });
      }

      await batch.commit();

      let usedPickupCoords: any = null;
      if (fareData.fixedPickupLocation) {
        usedPickupCoords = {
          latitude: Number(fareData.fixedPickupLocation.coordinates.latitude),
          longitude: Number(fareData.fixedPickupLocation.coordinates.longitude),
        };
      }

      const orderData: any = {
        orderedBy: user.uid,
        pickupCoords: usedPickupCoords,
        dropoffCoords: {
          latitude: Number(selectedLocation.lat),
          longitude: Number(selectedLocation.lng),
        },
        items,
        distance,
        subtotal,
        productCgst,
        productSgst,
        productCess,
        discount,
        deliveryCharge,
        rideCgst,
        rideSgst,
        platformFee,
        finalTotal,
        paymentMethod,
        status: "pending",
        surgeFee: surgeLine,
        createdAt: firestore.FieldValue.serverTimestamp(),
        usedPromo: selectedPromo ? selectedPromo.id : null,
        storeId: location.storeId,
        convenienceFee,
        hotspotId: activeHotspot?.id || null,

        // ✅ online metadata
       payment: {
  method: paymentMethod,
  status: paymentMethod === "online" ? "paid" : "pending",
  amountPaise: toPaise(finalTotal),
  currency: "INR",
  ...(paymentMethod === "online"
    ? {
        razorpay: {
          orderId: razorpayMeta?.razorpay_order_id, // or serverOrder.orderId if you pass it in
          paymentId: razorpayMeta?.razorpay_payment_id,
          signature: razorpayMeta?.razorpay_signature,
        },
      }
    : {}),
},

      };

      const orderRef = await firestore().collection("orders").add(orderData);

      // promo usage (kept)
      if (selectedPromo) {
        const updates: Record<string, any> = {
          usedBy: firestore.FieldValue.arrayUnion(user.uid),
          usedByIds: firestore.FieldValue.arrayUnion(user.uid),
        };
        if (user.phoneNumber) {
          updates.usedByPhones = firestore.FieldValue.arrayUnion(
            user.phoneNumber
          );
        }
        await firestore()
          .collection("promoCodes")
          .doc(selectedPromo.id)
          .set(updates, { merge: true });
      }

      return { orderId: orderRef.id, pickupCoords: usedPickupCoords };
    } catch (err: any) {
      console.error("Error creating order:", err);
      Alert.alert("Stock Error", err.message || "Unable to create order.");
      return null;
    }
  };

  /***************************************
   * RENDER HELPERS
   ***************************************/
  const renderCartItem = ({ item }: { item: Product }) => {
    const quantity = cart[item.id] || 0;
    if (quantity === 0) return null as any;

    const itemPrice = Number(item.discount)
      ? Number(item.price) - Number(item.discount)
      : Number(item.price);

    const cgstRate = Number(item.CGST ?? 0);
    const sgstRate = Number(item.SGST ?? 0);

    const realPrice = itemPrice + cgstRate + sgstRate;
    const totalPrice = realPrice * quantity;

    return (
      <View style={styles.cartItemContainer}>
        <Image source={{ uri: item.image }} style={styles.cartItemImage} />

        <View style={styles.cartItemDetails}>
          <View style={styles.cartItemTopRow}>
            <View style={styles.cartItemTextCol}>
              <Text style={styles.cartItemName} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={styles.cartItemPrice}>₹{realPrice.toFixed(2)}</Text>
            </View>

            <Pressable
              onPress={() => {
                animateNext();
                removeFromCart(item.id);
              }}
              style={styles.removeButton}
              android_ripple={{ color: "rgba(0,0,0,0.08)", borderless: true }}
              hitSlop={10}
            >
              <MaterialIcons name="delete" size={16} color="#e74c3c" />
            </Pressable>
          </View>

          <View style={styles.cartItemBottomRow}>
            <View style={styles.quantityControl}>
              <Pressable
                onPress={() => {
                  animateNext();
                  decreaseQuantity(item.id);
                }}
                style={({ pressed }) => [
                  styles.controlButton,
                  pressed && styles.controlButtonPressed,
                ]}
                android_ripple={{
                  color: "rgba(255,107,0,0.18)",
                  borderless: false,
                }}
                hitSlop={8}
              >
                <MaterialIcons name="remove" size={14} color={PRIMARY} />
              </Pressable>

              <View style={styles.quantityPill}>
                <Text style={styles.quantityText}>{quantity}</Text>
              </View>

              <Pressable
                onPress={() => {
                  animateNext();
                  increaseQuantity(item.id, item.quantity);
                  fetchCartItems(false);
                }}
                style={({ pressed }) => [
                  styles.controlButton,
                  pressed && styles.controlButtonPressed,
                ]}
                android_ripple={{
                  color: "rgba(255,107,0,0.18)",
                  borderless: false,
                }}
                hitSlop={8}
              >
                <MaterialIcons name="add" size={14} color={PRIMARY} />
              </Pressable>
            </View>

            <Text style={styles.cartItemTotal}>₹{totalPrice.toFixed(2)}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderPromoItem = ({ item }: { item: PromoCode }) => {
    const promoIcon =
      item.discountType === "flat" ? "pricetag-outline" : "gift-outline";
    const minValue = n(item.minValue);

    return (
      <TouchableOpacity
        style={styles.promoCard}
        onPress={() => subtotal >= minValue && selectPromo(item)}
        disabled={subtotal < minValue}
      >
        <View style={styles.promoHeader}>
          <Ionicons
            name={promoIcon}
            size={18}
            color="#2ecc71"
            style={styles.promoIcon}
          />
          <Text style={styles.promoLabel} numberOfLines={1}>
            {item.label || item.code}
          </Text>
        </View>

        {item.description && (
          <Text style={styles.promoDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        {subtotal < minValue && (
          <View style={styles.promoOverlay}>
            <View style={styles.lockContainer}>
              <View style={styles.lockIcon}>
                <Ionicons
                  name="lock-closed-outline"
                  size={12}
                  color="#ffffff"
                />
              </View>
              <Text style={styles.lockText}>Min ₹{minValue}</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  /**
   * Clear grocery and services carts when location changes
   * Keep restaurant cart as it's independent of location
   */
  const clearAllCarts = () => {
    clearCart(); // Clear grocery cart
    serviceCart.clearCart(); // Clear services cart
  };

  /**
   * Check if all carts are empty
   */
  const isAllCartsEmpty = () => {
    const groceryItemsCount = Object.keys(cart).length;
    const serviceItemsCount = serviceCart.totalItems;
    const restaurantItemsCount = restaurantCart.totalItems;
    return groceryItemsCount === 0 && serviceItemsCount === 0 && restaurantItemsCount === 0;
  };

  const handleDeleteLocation = async (locToDelete: any) => {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) return;

      await firestore()
        .collection("users")
        .doc(currentUser.uid)
        .update({
          locations: firestore.FieldValue.arrayRemove(locToDelete),
        });
    } catch (err) {
      console.error("Error deleting location:", err);
      Alert.alert("Error", "Failed to delete this location. Please try again.");
    }
  };

  const renderSavedAddressItem = ({ item }: { item: any }) => (
    <View style={styles.addressItemRow}>
      <TouchableOpacity
        style={styles.addressItemLeft}
        onPress={async () => {
          try {
            const ok = await checkDeliveryWindow();
            if (!ok) {
              Alert.alert(
                "Closed for deliveries",
                "Sorry, we’re not delivering right now. Please try again during our next delivery window."
              );
              return;
            }

            const nearest = await findNearestStore(item.lat, item.lng);
            if (!nearest) {
              Alert.alert(
                "Unavailable",
                "We don’t deliver to that address yet – try another address."
              );
              return;
            }

            const fullLocation = {
              ...item,
              lat: item.lat,
              lng: item.lng,
              storeId: nearest.id,
            };

            const allCartsEmpty = isAllCartsEmpty();
            
            // Don't clear carts when changing location - allow delivery to new address
            // Only clear if explicitly switching to incompatible store
            const shouldClearCart = false; // Changed: Don't clear cart on location change
            
            if (!allCartsEmpty && shouldClearCart) {
              clearAllCarts();
            }

            setSelectedLocation(fullLocation);
            updateLocation(fullLocation);
            setShowLocationSheet(false);
          } catch (e) {
            console.error("[findNearestStore]", e);
            Alert.alert("Error", "Couldn’t validate that address.");
          }
        }}
      >
        <Text style={styles.addressItemLabel}>
          {item.placeLabel} - {item.houseNo}
        </Text>
        <Text style={styles.addressItemAddress}>{item.address}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.deleteLocationButton}
        onPress={() => handleDeleteLocation(item)}
      >
        <Ionicons name="trash" size={20} color="#e74c3c" />
      </TouchableOpacity>
    </View>
  );

  const handleAddMoreItems = () => {
    navigation.navigate("HomeTab", { screen: "ProductsHome" });
  };

  const updatedProductSubtotal = subtotal + productCgst + productSgst;
  const updatedDeliveryCharge = deliveryCharge + rideCgst + rideSgst;

  const checkoutDisabled =
    isOrderAcceptancePaused === null || isOrderAcceptancePaused === true;

  const checkoutLabel =
    isOrderAcceptancePaused === null
      ? "Loading..."
      : isOrderAcceptancePaused
      ? "Orders Paused"
      : selectedLocation
      ? "Proceed to Payment"
      : "Proceed to Checkout";

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {showConfetti && (
          <View style={styles.confettiContainer}>
            <ConfettiCannon
              count={100}
              origin={{ x: width / 2, y: 0 }}
              fadeOut
              autoStart
              explosionSpeed={1000}
              fallSpeed={1500}
              onAnimationEnd={() => setShowConfetti(false)}
            />
          </View>
        )}

        {loading || navigating ? (
          <View style={styles.loaderContainer}>
            <Loader />
          </View>
        ) : Object.keys(cart).length === 0 ? (
          <>
            <SafeAreaView edges={["top", "left", "right"]} style={styles.headerSafeArea}>
              <View style={styles.headerBlock}>
                <View style={styles.headerRow}>
                  <TouchableOpacity
                    style={styles.headerBackButton}
                    onPress={handleBackPress}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="arrow-back" size={24} color="#333" />
                  </TouchableOpacity>
                  <View style={styles.headerTextWrap}>
                    <Text style={styles.cartItemsHeader}>Your Cart</Text>
                    <Text style={styles.headerSubtitle}>
                      {"Add items to place an order"}
                    </Text>
                  </View>
                  <View style={styles.headerBackButton} />
                </View>
              </View>
            </SafeAreaView>

            <View style={styles.emptyContainer}>
              <Ionicons name="cart-outline" size={80} color="#c6c6c6" />
              <Text style={styles.emptyTitle}>Your cart is empty</Text>
              <Text style={styles.emptySubtitle}>
                Start shopping and your items will show up here.
              </Text>
              <TouchableOpacity
                style={styles.emptyCta}
                onPress={handleAddMoreItems}
                activeOpacity={0.85}
              >
                <Text style={styles.emptyCtaText}>Start Shopping</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            {loadingCartUpdate && (
              <View style={styles.loaderOverlay}>
                <Loader />
              </View>
            )}

            <SafeAreaView edges={["top", "left", "right"]} style={styles.headerSafeArea}>
              <View style={styles.headerBlock}>
                <View style={styles.headerRow}>
                  <TouchableOpacity
                    style={styles.headerBackButton}
                    onPress={handleBackPress}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="arrow-back" size={24} color="#333" />
                  </TouchableOpacity>
                  <View style={styles.headerTextWrap}>
                    <Text style={styles.cartItemsHeader}>Your Cart</Text>
                    <Text style={styles.headerSubtitle}>
                      {"All items you've selected are shown below"}
                    </Text>
                  </View>
                  <View style={styles.headerBackButton} />
                </View>
              </View>
            </SafeAreaView>

            <ScrollView
              style={[styles.scrollView, { marginBottom: scrollViewBottomGap }]}
              contentContainerStyle={styles.scrollContent}
            >
              <FlatList
                data={cartItems}
                keyExtractor={(item) => item.id}
                renderItem={renderCartItem}
                scrollEnabled={false}
                contentContainerStyle={styles.itemListContainer}
              />

              <View style={styles.dottedDivider} />

              <View style={styles.missedSomethingRow}>
                <Text style={styles.missedText}>Missed something?</Text>
                <TouchableOpacity
                  style={styles.addMoreRowButton}
                  onPress={handleAddMoreItems}
                >
                  <Ionicons
                    name="add"
                    size={16}
                    color="#fff"
                    style={styles.addIcon}
                  />
                  <Text style={styles.addMoreRowText}>Add More Items</Text>
                </TouchableOpacity>
              </View>

              {recommended.length > 0 && (
                <>
                  <View style={styles.recoHeader}>
                    <View style={styles.recoBadge}>
                      <MaterialIcons name="flash-on" size={12} color="#fff" />
                      <Text style={styles.recoBadgeTxt}>POPULAR</Text>
                    </View>

                    <Text style={styles.recoTitle}>Complements your cart</Text>
                  </View>

                  <FlatList
                    data={recommended}
                    keyExtractor={(i) => i.id}
                    horizontal
                    snapToInterval={RECO_CARD_WIDTH + RECO_GAP}
                    decelerationRate="fast"
                    contentContainerStyle={styles.recoList}
                    showsHorizontalScrollIndicator={false}
                    renderItem={({ item }) => (
                      <RecommendCard
                        item={item}
                        qtyInCart={cart[item.id] ?? 0}
                        onAdd={() => {
                          addToCart(item.id, item.quantity);
                          setLoadingCartUpdate(true);
                          fetchCartItems(false).finally(() =>
                            setLoadingCartUpdate(false)
                          );
                        }}
                        onInc={() => {
                          increaseQuantity(item.id, item.quantity);
                          setLoadingCartUpdate(true);
                          fetchCartItems(false).finally(() =>
                            setLoadingCartUpdate(false)
                          );
                        }}
                        onDec={() => {
                          decreaseQuantity(item.id);
                          setLoadingCartUpdate(true);
                          fetchCartItems(false).finally(() =>
                            setLoadingCartUpdate(false)
                          );
                        }}
                        width={RECO_CARD_WIDTH}
                      />
                    )}
                  />
                </>
              )}

              {userLocations.length === 0 ? (
                <View style={styles.locationSection}>
                  <Text style={styles.locationTitle}>No saved addresses yet.</Text>
                  <TouchableOpacity
                    style={styles.selectAddressButton}
                    onPress={() =>
                      navigation.navigate("LocationSelector", {
                        fromScreen: "Cart",
                      })
                    }
                  >
                    <Text style={styles.selectAddressButtonText}>
                      Select Address
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View
                  style={[
                    styles.locationSection,
                    selectedLocation ? styles.selectedLocationHighlight : null,
                  ]}
                >
                  <Text style={styles.locationTitle}>
                    Delivering to:{" "}
                    {selectedLocation
                      ? `${selectedLocation.placeLabel} - ${selectedLocation.houseNo}`
                      : "Tap 'Change' to pick an address"}
                  </Text>
                  <TouchableOpacity
                    style={styles.changeLocationButton}
                    onPress={() => setShowLocationSheet(true)}
                  >
                    <Text style={styles.changeLocationText}>
                      Change Location
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.promoSection}>
                <Text style={styles.sectionTitle}>Promotions & Offers</Text>
                {selectedPromo ? (
                  <View style={styles.selectedPromoContainer}>
                    <View>
                      <Text style={styles.selectedPromoLabel}>
                        {selectedPromo.label || selectedPromo.code}
                      </Text>
                      {selectedPromo.description && (
                        <Text style={styles.selectedPromoDescription}>
                          {selectedPromo.description}
                        </Text>
                      )}
                      <Text style={styles.promoTypeText}>
                        Type: {selectedPromo.discountType.toUpperCase()}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={clearPromo}>
                      <Text style={styles.clearPromoText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.promoListWrapper}>
                    <FlatList
                      data={promos}
                      keyExtractor={(item) => item.id}
                      renderItem={renderPromoItem}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.promoHorizontalList}
                      ListEmptyComponent={
                        <Text style={styles.noPromoText}>No promos.</Text>
                      }
                    />
                  </View>
                )}
              </View>

              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Summary</Text>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Product Subtotal</Text>
                  <Text style={styles.summaryValue}>
                    ₹{updatedProductSubtotal.toFixed(2)}
                  </Text>
                </View>

                {discount > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Discount</Text>
                    <Text style={styles.discountValue}>
                      -₹{discount.toFixed(2)}
                    </Text>
                  </View>
                )}

                {productCess > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Product CESS</Text>
                    <Text style={styles.summaryValue}>
                      ₹{productCess.toFixed(2)}
                    </Text>
                  </View>
                )}

                {distance > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Distance (KM)</Text>
                    <Text style={styles.summaryValue}>
                      {distance.toFixed(2)}
                    </Text>
                  </View>
                )}

                {updatedDeliveryCharge > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Delivery Charge</Text>
                    <Text style={styles.summaryValue}>
                      ₹{updatedDeliveryCharge.toFixed(2)}
                    </Text>
                  </View>
                )}

                {convenienceFee > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Convenience Fee</Text>
                    <Text style={styles.summaryValue}>
                      ₹{convenienceFee.toFixed(2)}
                    </Text>
                  </View>
                )}

                {platformFee > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Platform Fee</Text>
                    <Text style={styles.summaryValue}>
                      ₹{platformFee.toFixed(2)}
                    </Text>
                  </View>
                )}

                {surgeLine > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Weather Surge</Text>
                    <Text style={styles.summaryValue}>
                      ₹{surgeLine.toFixed(2)}
                    </Text>
                  </View>
                )}

                {selectedPromo && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Promo Type</Text>
                    <Text style={styles.summaryValue}>
                      {selectedPromo.discountType.toUpperCase()}
                    </Text>
                  </View>
                )}

                <View style={[styles.summaryRow, styles.grandTotalRow]}>
                  <Text style={[styles.summaryLabel, styles.grandTotalLabel]}>
                    Grand Total
                  </Text>
                  <Text style={[styles.summaryValue, styles.grandTotalValue]}>
                    ₹{finalTotal.toFixed(2)}
                  </Text>
                </View>
              </View>

              <View style={styles.infoBanner}>
                <Ionicons
                  name="information-circle"
                  size={16}
                  color="#00695c"
                  style={styles.infoIcon}
                />
                <Text style={styles.infoText}>
                  No cash in hand? Our rider carries a QR code — pay instantly
                  with any UPI app at the doorstep.
                </Text>
              </View>
            </ScrollView>

            <View
              style={[
                styles.footerBar,
                { bottom: footerLift, paddingBottom: 14 + insets.bottom },
              ]}
            >
              <AnimatedTouchable
                disabled={checkoutDisabled} // ✅ REAL disable
                style={[
                  styles.footerCheckoutButton,
                  {
                    backgroundColor: checkoutDisabled
                      ? "#95a5a6"
                      : (animatedButtonColor as any),
                    transform: [{ translateX: shakeTranslate }],
                    opacity: checkoutDisabled ? 0.6 : 1,
                  },
                  checkoutDisabled && styles.disabledButton,
                ]}
                onPress={checkoutDisabled ? undefined : handleCheckout} // ✅ no-op when disabled
              >
                <View style={styles.footerButtonContent}>
                  <View style={styles.footerButtonLeft}>
                    <Ionicons
                      name={selectedLocation ? "cash-outline" : "cart-outline"}
                      size={18}
                      color="#ffffffff"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.footerCheckoutText}>{checkoutLabel}</Text>
                  </View>
                  <Text style={styles.footerCheckoutAmount}>
                    ₹{finalTotal.toFixed(2)}
                  </Text>
                </View>
              </AnimatedTouchable>
            </View>
          </>
        )}

        {/* PAUSED ORDERS MODAL */}
        <Modal
          visible={showPausedModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowPausedModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.pausedModalBox}>
              <Text style={styles.pausedModalTitle}>
                Orders Temporarily Paused
              </Text>
              <Text style={styles.pausedModalMessage}>
                We’re not accepting new orders right now. You can change your
                location or try again later.
              </Text>

              <TouchableOpacity
                style={styles.pausedModalButton}
                onPress={() => {
                  setShowPausedModal(false);
                  setShowLocationSheet(true);
                }}
              >
                <Text style={styles.pausedModalButtonText}>Change Location</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.pausedModalButton, styles.pausedModalClose]}
                onPress={() => setShowPausedModal(false)}
              >
                <Text
                  style={[
                    styles.pausedModalButtonText,
                    styles.pausedModalCloseText,
                  ]}
                >
                  Close
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* LOCATION PICKER MODAL */}
        <Modal
          visible={showLocationSheet}
          transparent
          animationType="slide"
          onDismiss={maybeShowNotice}
          onRequestClose={() => setShowLocationSheet(false)}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.bottomSheet,
                showLocationSheet && styles.bottomSheetOpen,
              ]}
            >
              <Text style={styles.bottomSheetTitle}>Choose Address</Text>
              <FlatList
                data={userLocations}
                keyExtractor={(_, idx) => String(idx)}
                renderItem={renderSavedAddressItem}
                style={{ maxHeight: Dimensions.get("window").height * 0.4 }}
                ListEmptyComponent={
                  <Text style={{ textAlign: "center" }}>No addresses.</Text>
                }
              />

              <TouchableOpacity
                style={styles.addNewLocationButton}
                onPress={() => {
                  setShowLocationSheet(false);
                  navigation.navigate("LocationSelector", {
                    fromScreen: "Cart",
                  });
                }}
              >
                <Text style={styles.addNewLocationText}>+ Add New Location</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowLocationSheet(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <NotificationModal
          visible={notificationModalVisible}
          message={notificationModalMessage}
          onClose={() => setNotificationModalVisible(false)}
        />

        <ErrorModal
          visible={errorModalVisible}
          message={errorModalMessage}
          onClose={() => setErrorModalVisible(false)}
        />

        <PaymentMethodModal
          visible={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          onSelectCOD={handleCODPayment}
          onSelectOnline={handleOnlinePayment}
          totalAmount={finalTotal}
          loading={navigating}
        />
      </View>
    </SafeAreaView>
  );
};

/**********************************************
 *                   STYLES
 **********************************************/
const pastelGreen = "#e7f8f6";
const PRIMARY = "#FF6B00";
const SECONDARY = "#4CAF50";
const BG = "#F7F7F7";
const TEXT_PRIMARY = "#222222";
const BORDER_CLR = "#EEEEEE";
const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: BG },
  container: { flex: 1, backgroundColor: BG },

  headerSafeArea: { backgroundColor: "#fff" },

  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e0f2f1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "center",
    marginTop: 8,
    marginBottom: 14,
    maxWidth: "90%",
  },
  infoIcon: { marginRight: 6 },
  infoText: { flexShrink: 1, fontSize: 12, lineHeight: 16, color: "#00695c" },

  recoHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  recoBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: SECONDARY,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 6,
  },
  recoBadgeTxt: { color: "#fff", fontSize: 10, fontWeight: "700", marginLeft: 2 },
  recoTitle: { fontSize: 14, fontWeight: "700", color: TEXT_PRIMARY },
  recoList: { paddingVertical: 6, paddingLeft: 2, columnGap: RECO_GAP },

  confettiContainer: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 1000,
    justifyContent: "center",
    alignItems: "center",
    pointerEvents: "none",
  },

  loaderContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loaderOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    zIndex: 10,
  },

  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 18 },
  emptyTitle: { marginTop: 12, fontSize: 18, fontWeight: "800", color: TEXT_PRIMARY, textAlign: "center" },
  emptySubtitle: { marginTop: 6, fontSize: 13, fontWeight: "600", color: "#666", textAlign: "center", lineHeight: 18 },
  emptyCta: { marginTop: 16, backgroundColor: PRIMARY, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 999 },
  emptyCtaText: { color: "#fff", fontSize: 14, fontWeight: "800" },

  headerBlock: {
    backgroundColor: "#fff",
    paddingTop: 10,
    paddingBottom: 1,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_CLR,
  },
  cartItemsHeader: { fontSize: 20, fontWeight: "800", color: TEXT_PRIMARY, marginBottom: 5 },
  headerSubtitle: { fontSize: 13, color: "#666" },

  headerRow: { flexDirection: "row", alignItems: "center" },
  headerBackButton: { padding: 4, width: 44, alignItems: "flex-start" },
  headerTextWrap: { flex: 1 },

  scrollView: { flex: 1, marginBottom: 84 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },
  itemListContainer: { paddingBottom: 12 },

  cartItemContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#fff",
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_CLR,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  cartItemImage: { width: 60, height: 60, borderRadius: 12, marginRight: 10, backgroundColor: "#f3f3f3" },
  cartItemDetails: { flex: 1 },
  cartItemTopRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  cartItemTextCol: { flex: 1, paddingRight: 10 },
  cartItemBottomRow: { marginTop: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cartItemName: { fontSize: 16, fontWeight: "800", color: TEXT_PRIMARY },
  cartItemPrice: { marginTop: 4, fontSize: 14, fontWeight: "800", color: PRIMARY },
  cartItemTotal: { fontSize: 13, fontWeight: "800", color: TEXT_PRIMARY },

  quantityControl: { flexDirection: "row", alignItems: "center" },
  controlButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  controlButtonPressed: { opacity: 0.6 },
  quantityPill: {
    minWidth: 34,
    height: 28,
    borderRadius: 999,
    paddingHorizontal: 8,
    marginHorizontal: 6,
    backgroundColor: "#f1f3f5",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  quantityText: { fontSize: 13, fontWeight: "900", color: TEXT_PRIMARY },

  removeButton: { padding: 6, borderRadius: 999, overflow: "hidden" },

  dottedDivider: { marginVertical: 24, borderWidth: 1, borderColor: "#e2e2e2", borderStyle: "dotted", borderRadius: 1 },

  missedSomethingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  missedText: { fontSize: 14, fontWeight: "800", color: TEXT_PRIMARY },
  addMoreRowButton: { flexDirection: "row", alignItems: "center", backgroundColor: PRIMARY, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 },
  addIcon: { marginRight: 4 },
  addMoreRowText: { fontSize: 12, fontWeight: "800", color: "#fff" },

  locationSection: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 24, borderColor: BORDER_CLR, borderWidth: 1, elevation: 3, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  locationTitle: { fontSize: 14, fontWeight: "800", color: TEXT_PRIMARY, marginBottom: 10 },

  selectAddressButton: { backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 12, alignItems: "center" },
  selectAddressButtonText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  changeLocationButton: { marginTop: 6, alignSelf: "flex-start", backgroundColor: PRIMARY, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14 },
  changeLocationText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  selectedLocationHighlight: { backgroundColor: "rgba(76, 175, 80, 0.10)", borderColor: "rgba(76, 175, 80, 0.30)", borderWidth: 1 },

  promoSection: { backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: BORDER_CLR, padding: 16, marginBottom: 24, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: TEXT_PRIMARY, marginBottom: 10 },
  selectedPromoContainer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#f5f5f5", borderRadius: 6, padding: 8 },
  selectedPromoLabel: { fontSize: 13, fontWeight: "800", color: TEXT_PRIMARY },
  selectedPromoDescription: { fontSize: 11, color: "#555", marginTop: 3 },
  promoTypeText: { marginTop: 3, fontSize: 11, color: SECONDARY },
  clearPromoText: { fontSize: 12, color: "#e74c3c", fontWeight: "600" },
  promoListWrapper: { marginTop: 4 },
  promoHorizontalList: { paddingRight: 6 },
  promoCard: { width: 140, backgroundColor: "#fafafa", borderRadius: 14, borderWidth: 1, borderColor: BORDER_CLR, padding: 10, marginRight: 10, alignItems: "flex-start", shadowColor: "#000", shadowOpacity: 0.02, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  promoHeader: { flexDirection: "row", alignItems: "center", marginBottom: 2, width: "100%" },
  promoIcon: { marginRight: 4 },
  promoLabel: { fontSize: 12, fontWeight: "800", color: TEXT_PRIMARY, flexShrink: 1, flexWrap: "wrap" },
  promoDescription: { fontSize: 10, color: "#555", marginTop: 2, flexWrap: "wrap" },
  noPromoText: { fontSize: 12, color: "#999", textAlign: "center" },

  summaryCard: { backgroundColor: "#fff", borderRadius: 20, borderWidth: 1, borderColor: BORDER_CLR, padding: 16, marginBottom: 24, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 8 },
  summaryTitle: { fontSize: 16, fontWeight: "900", color: TEXT_PRIMARY, marginBottom: 12 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  summaryLabel: { fontSize: 13, fontWeight: "700", color: "#555" },
  summaryValue: { fontSize: 13, fontWeight: "800", color: TEXT_PRIMARY },
  discountValue: { fontSize: 13, fontWeight: "600", color: "#e74c3c" },
  grandTotalRow: { marginTop: 12, paddingTop: 12, borderTopColor: "#e9ecef", borderTopWidth: 1 },
  grandTotalLabel: { fontSize: 14, fontWeight: "900", color: TEXT_PRIMARY },
  grandTotalValue: { fontSize: 20, fontWeight: "900", color: PRIMARY },

  disabledButton: {
    backgroundColor: "#95a5a6",
    opacity: 0.85,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 0,
  },

  footerBar: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    backgroundColor: BG,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#e9ecef",
    elevation: 4,
  },
  footerCheckoutButton: {
    borderRadius: 30,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
  },
  footerButtonContent: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%" },
  footerButtonLeft: { flexDirection: "row", alignItems: "center", flex: 1, paddingRight: 10 },
  footerCheckoutText: { fontSize: 15, color: "#fff", fontWeight: "900" },
  footerCheckoutAmount: { fontSize: 16, color: "#fff", fontWeight: "900" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center" },
  bottomSheet: {
    backgroundColor: pastelGreen,
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    borderBottomLeftRadius: 50,
    borderBottomRightRadius: 50,
    paddingHorizontal: 18,
    paddingVertical: 22,
  },
  bottomSheetOpen: {
    paddingHorizontal: 28,
    paddingVertical: 32,
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    borderBottomLeftRadius: 50,
    borderBottomRightRadius: 50,
  },
  bottomSheetTitle: { fontSize: 16, fontWeight: "700", marginBottom: 10, color: "#333" },

  pausedModalBox: {
    marginHorizontal: 28,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 18,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 10,
  },
  pausedModalTitle: { fontSize: 16, fontWeight: "700", color: "#111", marginBottom: 8, textAlign: "center" },
  pausedModalMessage: { fontSize: 14, color: "#444", textAlign: "center", marginBottom: 14, lineHeight: 20 },
  pausedModalButton: {
    backgroundColor: "#2310ccff",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    minWidth: 160,
    alignItems: "center",
    marginBottom: 8,
  },
  pausedModalButtonText: { color: "#fff", fontWeight: "700" },
  pausedModalClose: { backgroundColor: "#eef0f1" },
  pausedModalCloseText: { color: "#333" },

  addNewLocationButton: { backgroundColor: "#3498db", borderRadius: 8, paddingVertical: 10, alignItems: "center", marginTop: 10 },
  addNewLocationText: { color: "#fff", fontWeight: "600" },
  cancelButton: { backgroundColor: "#fff", borderColor: "#ccc", borderWidth: 1, borderRadius: 8, paddingVertical: 10, alignItems: "center", marginTop: 12 },
  cancelButtonText: { color: "#333", fontWeight: "600" },

  addressItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    padding: 5,
    borderWidth: 1,
    borderColor: "#eee",
    borderBottomWidth: 3,
    borderBottomColor: "#FF7043",
    marginBottom: 10,
  },
  addressItemLeft: { flex: 1 },
  deleteLocationButton: { paddingHorizontal: 8, paddingVertical: 4 },
  addressItemLabel: { fontSize: 13, fontWeight: "700", color: "#333" },
  addressItemAddress: { fontSize: 12, color: "#777" },

  promoOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 8, justifyContent: "center", alignItems: "center", zIndex: 10 },
  lockContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255, 251, 251, 0.63)", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 4 },
  lockIcon: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#d5470fff", justifyContent: "center", alignItems: "center", marginRight: 8 },
  lockText: { fontSize: 11, fontWeight: "600", color: "#d5470fff", letterSpacing: 0.5, textTransform: "uppercase" },
});

export default CartScreen;

/**
 * NOTE (for later):
 * - Replace hardcoded CLOUD_FUNCTIONS_BASE_URL + RAZORPAY_KEY_ID with @env
 * - Keep server-side order creation + signature verification in Cloud Functions only
 */
