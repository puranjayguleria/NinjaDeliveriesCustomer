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
  StyleSheet,
  Image,
  Alert,
  ScrollView,
  Dimensions,
  Modal,
  Animated,
  InteractionManager,
} from "react-native";
import {
  useFocusEffect,
  useIsFocused,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
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
import { useWeather } from "../context/WeatherContext";




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
  const unseenChangeId = useRef<number | null>(null);
  const lastSeenChangeId = useRef<number>(0);

  const [userLocations, setUserLocations] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);

  const [notificationModalVisible, setNotificationModalVisible] =
    useState(false);
  const [notificationModalMessage, setNotificationModalMessage] = useState("");

  const [showLocationSheet, setShowLocationSheet] = useState<boolean>(false);
  const [showPausedModal, setShowPausedModal] = useState<boolean>(false);

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
      clearCart();
      setSelectedLocation(null);
      setShowLocationSheet(false);
      prevStoreIdRef.current = currentStore;

      if (isFocused) {
        storeChangeSerial += 1;
        unseenChangeId.current = storeChangeSerial;
        setNotificationModalMessage(
          "Looks like you’ve switched to another store. Your cart has been emptied—please add items again."
        );
        maybeShowNotice();
      }
    }
  }, [location.storeId, isFocused, clearCart]);

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
      // Navigate to CartPaymentScreen instead of showing payment modal
      console.log("Navigating to CartPayment with data:", {
        cartItems: cartItems.length,
        finalTotal,
        selectedLocation: selectedLocation?.placeLabel,
        storeId: selectedLocation?.storeId,
      });
      
      navigation.navigate("TestPayment", {
        paymentData: {
          cartItems,
          subtotal,
          discount,
          deliveryCharge,
          platformFee,
          convenienceFee,
          surgeFee: surgeLine,
          finalTotal,
          selectedLocation,
          selectedPromo,
          productCgst,
          productSgst,
          productCess,
          rideCgst,
          rideSgst,
        },
        onPaymentComplete: handlePaymentComplete,
      });
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


 const openRazorpayCheckout = async (
  keyId: string,
  orderId: string,
  amountPaise: number,
  currency: string
) => {
  const user = auth().currentUser;
  if (!user) throw new Error("Not logged in");

  const contact = (user.phoneNumber || "").replace("+91", "");

  const options: any = {
    key: keyId,
    order_id: orderId,
    amount: String(amountPaise),
    currency: currency || "INR",
    name: "Ninja Deliveries",
    description: "Order payment",

    prefill: {
      contact,
      email: "",
      name: "",
      method: "upi", // ✅ this is the correct way on mobile :contentReference[oaicite:1]{index=1}
    },

    theme: { color: "#00C853" },
  };

  return RazorpayCheckout.open(options) as Promise<{
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }>;
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
        clearCart();
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
          <Text style={styles.cartItemName}>{item.name}</Text>
          <Text style={styles.cartItemPrice}>₹{realPrice.toFixed(2)}</Text>

          <View style={styles.quantityControl}>
            <TouchableOpacity
              onPress={() => decreaseQuantity(item.id)}
              style={styles.controlButton}
            >
              <MaterialIcons name="remove" size={18} color="#fff" />
            </TouchableOpacity>

            <Text style={styles.quantityText}>{quantity}</Text>

            <TouchableOpacity
              onPress={() => {
                increaseQuantity(item.id, item.quantity);
                fetchCartItems(false);
              }}
              style={styles.controlButton}
            >
              <MaterialIcons name="add" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          <Text style={styles.cartItemTotal}>
            Item: ₹{totalPrice.toFixed(2)}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => removeFromCart(item.id)}
          style={styles.removeButton}
        >
          <MaterialIcons name="delete" size={22} color="#e74c3c" />
        </TouchableOpacity>
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
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Your cart is empty.</Text>
          </View>
        ) : (
          <>
            {loadingCartUpdate && (
              <View style={styles.loaderOverlay}>
                <Loader />
              </View>
            )}

            <View style={styles.headerBlock}>
              <Text style={styles.cartItemsHeader}>Your Cart</Text>
              <Text style={styles.headerSubtitle}>
                All items you've selected are shown below
              </Text>
            </View>

            <ScrollView
              style={styles.scrollView}
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

            <View style={styles.footerBar}>
              <View style={styles.footerLeft}>
                <Text style={styles.footerTotalLabel}>Total:</Text>
                <Text style={styles.footerTotalValue}>
                  ₹{finalTotal.toFixed(2)}
                </Text>
              </View>

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
                <Ionicons
                  name={selectedLocation ? "cash-outline" : "cart-outline"}
                  size={16}
                  color="#ffffffff"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.footerCheckoutText}>
                  {isOrderAcceptancePaused === null
                    ? "Loading..."
                    : isOrderAcceptancePaused
                    ? "Orders Paused"
                    : selectedLocation
                    ? "Proceed to Payment"
                    : "Checkout"}
                </Text>
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
      </View>
    </SafeAreaView>
  );
};

/**********************************************
 *                   STYLES
 **********************************************/
const pastelGreen = "#e7f8f6";
const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f2f2f2" },
  container: { flex: 1, backgroundColor: "#fefefe" },

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
    backgroundColor: "#00C853",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 6,
  },
  recoBadgeTxt: { color: "#fff", fontSize: 10, fontWeight: "700", marginLeft: 2 },
  recoTitle: { fontSize: 14, fontWeight: "700", color: "#333" },
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

  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { fontSize: 16, color: "#999" },

  headerBlock: { backgroundColor: pastelGreen, paddingVertical: 20, paddingHorizontal: 16 },
  cartItemsHeader: { fontSize: 20, fontWeight: "bold", color: "#333", marginBottom: 5 },
  headerSubtitle: { fontSize: 13, color: "#666" },

  scrollView: { flex: 1, marginBottom: 60 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20 },
  itemListContainer: { paddingBottom: 8 },

  cartItemContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginBottom: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#eee",
    padding: 8,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  cartItemImage: { width: 50, height: 50, borderRadius: 6, marginRight: 8, backgroundColor: "#f9f9f9" },
  cartItemDetails: { flex: 1 },
  cartItemName: { fontSize: 14, fontWeight: "700", color: "#333" },
  cartItemPrice: { marginTop: 2, fontSize: 12, color: "#555" },
  cartItemTotal: { marginTop: 4, fontSize: 12, fontWeight: "600", color: "#333" },

  quantityControl: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  controlButton: { backgroundColor: "#E67E22", borderRadius: 8, padding: 5, marginHorizontal: 2 },
  quantityText: { fontSize: 13, fontWeight: "600", marginHorizontal: 4, color: "#333" },

  removeButton: { padding: 5 },

  dottedDivider: { marginVertical: 10, borderWidth: 1, borderColor: "#ccc", borderStyle: "dotted", borderRadius: 1 },

  missedSomethingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  missedText: { fontSize: 14, fontWeight: "600", color: "#333" },
  addMoreRowButton: { flexDirection: "row", alignItems: "center", backgroundColor: "#3498db", borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  addIcon: { marginRight: 4 },
  addMoreRowText: { fontSize: 12, fontWeight: "600", color: "#fff" },

  locationSection: { backgroundColor: "#fff", borderRadius: 6, padding: 10, marginBottom: 20, borderColor: "#eee", borderWidth: 1 },
  locationTitle: { fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 6 },

  selectAddressButton: { backgroundColor: "#FF7043", borderRadius: 8, paddingVertical: 8, alignItems: "center" },
  selectAddressButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  changeLocationButton: { marginTop: 4, alignSelf: "flex-start", backgroundColor: "#f39c12", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  changeLocationText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  selectedLocationHighlight: { backgroundColor: "#e1f8e6", borderColor: "#2ecc71", borderWidth: 1 },

  promoSection: { backgroundColor: "#fff", borderRadius: 6, borderWidth: 1, borderColor: "#eee", padding: 10, marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#333", marginBottom: 6 },
  selectedPromoContainer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#f5f5f5", borderRadius: 6, padding: 8 },
  selectedPromoLabel: { fontSize: 13, fontWeight: "600", color: "#333" },
  selectedPromoDescription: { fontSize: 11, color: "#555", marginTop: 3 },
  promoTypeText: { marginTop: 3, fontSize: 11, color: "#2ecc71" },
  clearPromoText: { fontSize: 12, color: "#e74c3c", fontWeight: "600" },
  promoListWrapper: { marginTop: 4 },
  promoHorizontalList: { paddingRight: 6 },
  promoCard: { width: 120, backgroundColor: "#fafafa", borderRadius: 6, borderWidth: 1, borderColor: "#eee", padding: 6, marginRight: 10, alignItems: "flex-start", shadowColor: "#000", shadowOpacity: 0.02, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  promoHeader: { flexDirection: "row", alignItems: "center", marginBottom: 2, width: "100%" },
  promoIcon: { marginRight: 4 },
  promoLabel: { fontSize: 12, fontWeight: "600", color: "#2c3e50", flexShrink: 1, flexWrap: "wrap" },
  promoDescription: { fontSize: 10, color: "#555", marginTop: 2, flexWrap: "wrap" },
  noPromoText: { fontSize: 12, color: "#999", textAlign: "center" },

  summaryCard: { backgroundColor: "#fff", borderRadius: 6, borderWidth: 1, borderColor: "#eee", padding: 10, marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  summaryTitle: { fontSize: 15, fontWeight: "700", color: "#333", marginBottom: 8 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  summaryLabel: { fontSize: 13, fontWeight: "600", color: "#333" },
  summaryValue: { fontSize: 13, fontWeight: "600", color: "#333" },
  discountValue: { fontSize: 13, fontWeight: "600", color: "#e74c3c" },
  grandTotalRow: { marginTop: 8, paddingTop: 8, borderTopColor: "#ccc", borderTopWidth: 1 },
  grandTotalLabel: { fontSize: 14, color: "#000" },
  grandTotalValue: { fontSize: 15, fontWeight: "bold", color: "#000" },

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
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 4,
  },
  footerLeft: { flexDirection: "row", alignItems: "center" },
  footerTotalLabel: { fontSize: 15, fontWeight: "700", color: "#333", marginRight: 6 },
  footerTotalValue: { fontSize: 16, fontWeight: "700", color: "#16a085" },
  footerCheckoutButton: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 130,
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
  },
  footerCheckoutText: { fontSize: 15, color: "#fff", fontWeight: "700", textAlign: "center" },

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
