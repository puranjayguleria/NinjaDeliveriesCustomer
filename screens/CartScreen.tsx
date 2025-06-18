// screens/CartScreen.tsx

import React, { useEffect, useState, useRef } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";
import auth from "@react-native-firebase/auth";
import { LinearGradient } from "expo-linear-gradient";
import firestore, {
  firebase,
  FirebaseFirestoreTypes,
} from "@react-native-firebase/firestore";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import ConfettiCannon from "react-native-confetti-cannon";
import { useCart } from "../context/CartContext";
import {
  CommonActions,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { GOOGLE_PLACES_API_KEY } from "@env";
import ErrorModal from "../components/ErrorModal"; // <-- NEW Import for error modal
import { findNearestStore } from "../utils/findNearestStore";
import { useLocationContext } from "@/context/LocationContext";
import NotificationModal from "../components/NotificationModal";
import RecommendCard from "@/components/RecommendedCard";
import Loader from "@/components/VideoLoader";
import axios from "axios";
import { useWeather } from "../context/WeatherContext"; // adjust path if needed

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

    if (!doc.exists) return true; // no timing data ⇒ allow

    // normalise both fields to 0-23 integers
    const { fromTime, toTime } = doc.data() as {
      fromTime: number | string;
      toTime: number | string;
    };
    const from = Number(fromTime); // "08" ➜ 8
    const to = Number(toTime); // "20" ➜ 20
    const now = new Date().getHours(); // 0-23

    if (Number.isNaN(from) || Number.isNaN(to)) return true;

    if (from === to) return true; // 24 × 7

    // same-day window (e.g. 8 → 20)
    if (from < to) return now >= from && now < to;

    // overnight window (e.g. 22 → 6)
    return now >= from || now < to;
  } catch (e) {
    console.error("[checkDeliveryWindow]", e);
    return true; // fail-open on error
  }
};

/**
 * Firestore product doc now can have CGST, SGST, plus optional 'cess' per product.
 */
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
};

type Hotspot = {
  id: string;
  name: string;
  center: firebase.firestore.GeoPoint; // Firestore GeoPoint
  radiusKm: number; // e.g. 3  (kilometres)
  convenienceCharge: number; // e.g. 25
  reasons: string[]; // UI bullet list
};

type ConvenienceResult = {
  hotspot: Hotspot | null; // null → not in any hotspot
  fee: number; // 0 if not in hotspot
};
type GoogleWeatherData = {
  precipitation?: {
    qpf?: { quantity: number; unit: string };
  };
  wind?: {
    speed?: { value: number; unit: string };
  };
  thunderstormProbability?: number;
  uvIndex?: number;
  weatherCondition?: {
    type: string;
  };
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

  usedBy?: string[];
  usedByIds?: string[];
  usedByPhones?: string[];
};

type FareData = {
  additionalCostPerKm: number;
  baseDeliveryCharge: number;
  distanceThreshold: number;
  gstPercentage: number; // ride-level GST
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

const RECO_CARD_WIDTH = 140;
const RECO_GAP = 12;
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const CartScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();

  const { location, updateLocation } = useLocationContext(); // already have this in Categories – add here too
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

  // ----- CART ITEMS / LOADING -----
  const [cartItems, setCartItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true); // for initial screen load
  const [refreshingCartItems, setRefreshingCartItems] = useState(false); // for cart updates

  // ----- PROMO -----
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [selectedPromo, setSelectedPromo] = useState<PromoCode | null>(null);

  // ----- PRICE BREAKDOWN -----
  const [subtotal, setSubtotal] = useState<number>(0); // <-- Renamed from productSubtotal
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

  // Fare data from Firestore
  const [fareData, setFareData] = useState<FareData | null>(null);

  // Confetti
  const [showConfetti, setShowConfetti] = useState<boolean>(false);
  const [pendingNotice, setPendingNotice] = useState(false);

  // Location
  const [userLocations, setUserLocations] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);

  const [notificationModalVisible, setNotificationModalVisible] =
    useState(false);
  const [notificationModalMessage, setNotificationModalMessage] = useState("");

  // Modals
  const [showLocationSheet, setShowLocationSheet] = useState<boolean>(false);
  const [showPaymentSheet, setShowPaymentSheet] = useState<boolean>(false);

  // Navigation
  const [navigating, setNavigating] = useState<boolean>(false);

  // Animations
  const colorAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // --- NEW: Delivery Timing Error Modal State ---
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState("");
  const { isBadWeather, weatherData } = useWeather();
  const [loadingCartUpdate, setLoadingCartUpdate] = useState(false);

  console.log(isBadWeather, weatherData);
  /***************************************
   * Animate Checkout Button
   ***************************************/
  useEffect(() => {
    // Button color animation
    Animated.timing(colorAnim, {
      toValue: selectedLocation ? 1 : 0,
      duration: 600,
      useNativeDriver: false,
    }).start();

    // Shake animation if location is selected
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
  }, [selectedLocation]);

  useEffect(() => {
    const cur = location.storeId ?? null;

    if (prevStoreIdRef.current === null && cur !== null) {
      prevStoreIdRef.current = cur; // first time → just remember
      return;
    }

    if (cur && cur !== prevStoreIdRef.current) {
      clearCart(); // empty the old cart
      setSelectedLocation(null); // ← **reset the address**
      prevStoreIdRef.current = cur;
      setShowLocationSheet(false);
      setShowPaymentSheet(false);
      setNotificationModalMessage(
        "Looks like you’ve switched to another store. " +
          "Your cart has been emptied—please add items again."
      );
      setPendingNotice(true);
    }
  }, [location.storeId]);

  const animatedButtonColor = colorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgb(231,76,60)", "rgb(40,167,69)"], // Red -> Green
  });
  const shakeTranslate = shakeAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: [-10, 10],
  });
  // ⬇ paste just ABOVE the big “Fetch Data On Mount” useEffect
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
    console.log(list);

    setHotspots(list);
  };

  /***************************************
   * Fetch Data On Mount
   ***************************************/
  useEffect(() => {
    fetchFareData(location.storeId ?? null);
    fetchHotspots(location.storeId ?? null);
    fetchCartItems();
    watchPromos();
    const unsubscribe = watchUserLocations();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);
  useEffect(() => {
    fetchCartItems(false);
  }, [cart]);

  // If user selected location
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
        // clear the param so it doesn’t fire again
        navigation.setParams({ selectedLocation: null });
      })();
    }
  }, [route.params?.selectedLocation]);

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
      // if we don’t know the store yet
      setFareData(null);
      return;
    }

    try {
      // ❶  *If doc-ID == storeId*   (simplest)
      // const snap = await firestore()
      //   .collection("orderSetting")
      //   .doc(storeId)
      //   .get();

      // ❷  *If you kept a normal collection with a storeId field*:
      const snap = await firestore()
        .collection("orderSetting")
        .where("storeId", "==", storeId)
        .limit(1)
        .get();

      if (!snap.empty /* use branch ❷ */ && snap.docs[0].exists) {
        setFareData(snap.docs[0].data() as FareData);
      } else if (snap.exists) {
        setFareData(snap.data() as unknown as FareData);
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
  }, [
    cartItems,
    cart,
    selectedPromo,
    selectedLocation,
    fareData,
    convenienceFee,
  ]);

  const n = (x: any, dflt = 0) => {
    const v = Number(x);
    return Number.isFinite(v) ? v : dflt;
  };
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
      }

      const snapshots = await Promise.all(batchPromises);
      const productsData: Product[] = [];
      snapshots.forEach((snap) => {
        snap.forEach((doc) => {
          productsData.push({ id: doc.id, ...(doc.data() as Product) });
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
        setLoading(false); // ← NEW
      }
    }
  };

  /**
   * Pull “people also bought” items into state.recommended
   * – only if they’re in-stock for the current store.
   */
  /**
   * Pull up to 10 “people also ordered” products that are:
   *   • referenced in the current cart items’ matchingProducts[]
   *   • belong to the same store as the cart
   *   • have quantity > 0   (filtered client-side to avoid composite-index errors)
   */
  const fetchRecommended = async (baseItems: Product[]) => {
    try {
      /* ---------- 1. Collect candidate IDs, skip bad values ---------- */
      const wanted = new Set<string>();

      baseItems.forEach((p) => {
        (p.matchingProducts ?? []).forEach((id) => wanted.add(id));
        wanted.delete(p.id); // don’t recommend what’s already in the cart
      });

      const idList = Array.from(wanted).filter(
        (id) => typeof id === "string" && id.trim() !== "" && !id.includes("/")
      );

      if (idList.length === 0 || !location.storeId) {
        setRecommended([]); // nothing to fetch
        return;
      }

      /* ---------- 2. Fetch in chunks of ≤10 IDs (Firestore limit) ----- */
      const reads: Promise<firebase.firestore.QuerySnapshot>[] = [];

      for (let i = 0; i < idList.length; i += 10) {
        const chunk = idList.slice(i, i + 10);
        console.log(chunk);
        reads.push(
          firestore()
            .collection("products")
            .where(firestore.FieldPath.documentId(), "in", chunk)
            .where("storeId", "==", location.storeId) // stay inside the same store
            /* 🔸 NO quantity filter here – avoid “range + in” restriction */
            .get()
        );
      }

      const snapshots = await Promise.all(reads);

      /* ---------- 3. Merge & client-side filter for stock ------------ */
      const recs: Product[] = [];

      snapshots.forEach((snap) =>
        snap.forEach((doc) => {
          const data = doc.data() as Product;
          if ((data.quantity ?? 0) > 0) {
            // only keep in-stock items
            recs.push({ id: doc.id, ...data });
          }
        })
      );

      setRecommended(recs.slice(0, 10)); // cap UI to 10 items
    } catch (err) {
      console.error("[fetchRecommended]", err);
      setRecommended([]); // silent fallback
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
        (snapshot) => {
          const raw = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...(doc.data() as Omit<PromoCode, "id">),
          }));

          const phone = currentUser.phoneNumber ?? "";
          const uid = currentUser.uid;

          const filtered = raw.filter((promo) => {
            const byId = promo.usedByIds ?? promo.usedBy ?? [];
            const byPhone = promo.usedByPhones ?? [];
            return !byId.includes(uid) && !byPhone.includes(phone);
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

    // create “lat,lng|lat,lng|…” list for Google
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

    // 2) Promo discount
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

    // 3) Distance
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

    // 4) Delivery
    let _deliveryCharge = 0;
    if (distanceInKm <= n(fareData.distanceThreshold)) {
      _deliveryCharge = n(fareData.baseDeliveryCharge);
    } else {
      const extraKms = distanceInKm - n(fareData.distanceThreshold);
      _deliveryCharge =
        n(fareData.baseDeliveryCharge) +
        extraKms * n(fareData.additionalCostPerKm);
    }

    // 5) Ride CGST/SGST
    const totalGstOnDelivery =
      (_deliveryCharge * n(fareData.gstPercentage)) / 100;
    const _rideCgst = totalGstOnDelivery / 2;
    const _rideSgst = totalGstOnDelivery / 2;

    // 6) Platform fee
    const _platformFee = n(fareData.platformFee);

    // 7) Bad Weather SurgeFee
    let surgeFee = 0;

    surgeFee = isBadWeather ? fareData?.surgeFee ?? 0 : 0;

    // if (
    //   selectedLocation?.lat &&
    //   selectedLocation?.lng &&
    //   fareData?.weatherThreshold
    // ) {
    //   const weatherData = await getGoogleWeatherData(
    //     selectedLocation.lat,
    //     selectedLocation.lng,
    //     GOOGLE_PLACES_API_KEY
    //   );

    //   const isBad = weatherData
    //     ? isBadWeather(weatherData, fareData.weatherThreshold)
    //     : false;

    //   surgeFee = isBad ? fareData.surgeFee ?? 0 : 0;
    // }

    // 7) Final total
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
    // Update states
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

  // Reset totals if cart is empty
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
  const clearPromo = () => {
    setSelectedPromo(null);
  };

  /***************************************
   * CART ACTIONS
   ***************************************/
  const handleCheckout = async () => {
    // NEW: Delivery timing check
    try {
      const timingDoc = await firestore()
        .collection("delivery_timing")
        .doc("timingData") // or whichever doc name you use
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
      // If doc doesn't exist or any error, we won't block the user.
      // Or handle as needed
    }

    // Existing flow
    if (cartItems.length === 0) {
      Alert.alert("Cart is Empty", "Please add some products to your cart.");
      return;
    }
    if (!selectedLocation && userLocations.length === 0) {
      navigation.navigate("LocationSelector", { fromScreen: "Cart" });
    } else if (!selectedLocation && userLocations.length > 0) {
      setShowLocationSheet(true);
    } else {
      setShowPaymentSheet(true);
    }
  };

  /***************************************
   * PAYMENT
   ***************************************/
  const handlePaymentOption = async (option: "cod" | "online") => {
    setShowPaymentSheet(false);
    if (option === "cod") {
      try {
        setNavigating(true);
        const result = await handleCreateOrder("cod");
        if (result) {
          if (selectedPromo) {
            setPromos((prev) => prev.filter((p) => p.id !== selectedPromo.id));
            setSelectedPromo(null);
          }
          const { orderId, pickupCoords } = result;
          clearCart();
          setSelectedLocation(null);
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
      } finally {
        setNavigating(false);
      }
    }
    // else if (option === "online") { ... }
  };

  /***************************************
   * CREATE ORDER
   ***************************************/
  const handleCreateOrder = async (paymentMethod: "cod" | "online") => {
    try {
      const user = auth().currentUser;
      if (!user || !selectedLocation || !fareData) return null;

      // Build items array
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

      // Check & update product quantity via batch
      const batch = firestore().batch();
      for (let i = 0; i < items.length; i++) {
        const { productId, quantity } = items[i];
        const productRef = firestore().collection("products").doc(productId);
        const productSnap = await productRef.get();

        if (!productSnap.exists) {
          throw new Error("Some products are no longer available.");
        }
        const currentQty = productSnap.data()?.quantity || 0;
        if (currentQty < quantity) {
          throw new Error(
            `Not enough stock for product: ${productSnap.data()?.name}`
          );
        } else {
          const newQty = currentQty - quantity;
          batch.update(productRef, { quantity: newQty < 0 ? 0 : newQty });
        }
      }
      await batch.commit();

      // Build pickup coords from fareData
      let usedPickupCoords = null;
      if (fareData.fixedPickupLocation) {
        usedPickupCoords = {
          latitude: Number(fareData.fixedPickupLocation.coordinates.latitude),
          longitude: Number(fareData.fixedPickupLocation.coordinates.longitude),
        };
      }

      // Create order data in Firestore
      const orderData = {
        orderedBy: user.uid,
        pickupCoords: usedPickupCoords,
        dropoffCoords: {
          latitude: Number(selectedLocation.lat),
          longitude: Number(selectedLocation.lng),
        },
        items,
        distance,
        subtotal, // <-- renamed from productSubtotal
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

        convenienceFee, // new field
        hotspotId: activeHotspot?.id || null,
      };

      const orderRef = await firestore().collection("orders").add(orderData);
      console.log("Order created with ID:", orderRef.id);

      // Mark promo as used if applicable
      // Mark promo as used if applicable
      if (selectedPromo) {
        const updates: Record<string, any> = {
          // keep legacy field so old docs still work
          usedBy: firestore.FieldValue.arrayUnion(user.uid),
          // new explicit fields
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
      Alert.alert("Stock Error", err.message);
      return null;
    }
  };

  /***************************************
   * RENDER
   ***************************************/
  const renderCartItem = ({ item }: { item: Product }) => {
    const quantity = cart[item.id] || 0;
    if (quantity == 0) {
      return;
    }

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
    return (
      <TouchableOpacity
        style={styles.promoCard}
        onPress={() => selectPromo(item)}
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
      </TouchableOpacity>
    );
  };

  const renderSavedAddressItem = ({ item }: { item: any }) => (
    <View style={styles.addressItemRow}>
      <TouchableOpacity
        style={styles.addressItemLeft}
        onPress={async () => {
          try {
            /* 1️⃣  Block if we’re outside the delivery window */
            const ok = await checkDeliveryWindow();
            if (!ok) {
              Alert.alert(
                "Closed for deliveries",
                "Sorry, we’re not delivering right now. Please try again during our next delivery window."
              );
              return; // don’t close the sheet, don’t change the address
            }

            /* 2️⃣  Continue with the existing nearest-store logic */
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
            setShowLocationSheet(false); // close the bottom sheet
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

  const handleAddMoreItems = () => {
    navigation.navigate("HomeTab", { screen: "ProductsHome" });
  };
  //REMOVE CGST AND SGST
  const updatedProductSubtotal = subtotal + productCgst + productSgst;
  const updatedDeliveryCharge = deliveryCharge + rideCgst + rideSgst;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Confetti Cannon */}
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

        {/* Loader or empty cart check */}
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

            {/* HEADER */}
            <View style={styles.headerBlock}>
              <Text style={styles.cartItemsHeader}>Your Cart</Text>
              <Text style={styles.headerSubtitle}>
                All items you've selected are shown below
              </Text>
            </View>

            {/* MAIN CONTENT */}
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

              {/* LOCATION SECTION */}
              {userLocations.length === 0 ? (
                <View style={styles.locationSection}>
                  <Text style={styles.locationTitle}>
                    No saved addresses yet.
                  </Text>
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

              {/* PROMO SECTION */}
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

              {/* SUMMARY */}
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Summary</Text>

                {/* Product Subtotal (incl. CGST + SGST) */}
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Product Subtotal</Text>
                  <Text style={styles.summaryValue}>
                    ₹{updatedProductSubtotal.toFixed(2)}
                  </Text>
                </View>

                {/* Discount */}
                {discount > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Discount</Text>
                    <Text style={styles.discountValue}>
                      -₹{discount.toFixed(2)}
                    </Text>
                  </View>
                )}

                {/* Product CESS */}
                {productCess > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Product CESS</Text>
                    <Text style={styles.summaryValue}>
                      ₹{productCess.toFixed(2)}
                    </Text>
                  </View>
                )}

                {/* Distance */}
                {distance > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Distance (KM)</Text>
                    <Text style={styles.summaryValue}>
                      {distance.toFixed(2)}
                    </Text>
                  </View>
                )}

                {/* Delivery Charge (incl. Ride CGST + SGST) */}
                {updatedDeliveryCharge > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Delivery Charge</Text>
                    <Text style={styles.summaryValue}>
                      ₹{updatedDeliveryCharge.toFixed(2)}
                    </Text>
                  </View>
                )}

                {/* Convenience Fee */}
                {convenienceFee > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Convenience Fee</Text>
                    <Text style={styles.summaryValue}>
                      ₹{convenienceFee.toFixed(2)}
                    </Text>
                  </View>
                )}

                {/* Platform Fee */}
                {platformFee > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Platform Fee</Text>
                    <Text style={styles.summaryValue}>
                      ₹{platformFee.toFixed(2)}
                    </Text>
                  </View>
                )}

                {/* Surge Fee */}
                {surgeLine > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel]}>Weather Surge</Text>
                    <Text style={[styles.summaryValue]}>
                      ₹{surgeLine.toFixed(2)}
                    </Text>
                  </View>
                )}

                {/* Promo Type */}
                {selectedPromo && (
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Promo Type</Text>
                    <Text style={styles.summaryValue}>
                      {selectedPromo.discountType.toUpperCase()}
                    </Text>
                  </View>
                )}

                {/* GRAND TOTAL (highlighted) */}
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

            {/* FOOTER */}
            <View style={styles.footerBar}>
              <View style={styles.footerLeft}>
                <Text style={styles.footerTotalLabel}>Total:</Text>
                <Text style={styles.footerTotalValue}>
                  ₹{finalTotal.toFixed(2)}
                </Text>
              </View>

              <AnimatedTouchable
                style={[
                  styles.footerCheckoutButton,
                  {
                    backgroundColor: animatedButtonColor,
                    transform: [{ translateX: shakeTranslate }],
                  },
                ]}
                onPress={handleCheckout}
              >
                <Ionicons
                  name={selectedLocation ? "cash-outline" : "cart-outline"}
                  size={16}
                  color="#fff"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.footerCheckoutText}>
                  {selectedLocation ? "Pay Now" : "Checkout"}
                </Text>
              </AnimatedTouchable>
            </View>
          </>
        )}

        {/* LOCATION PICKER MODAL */}
        <Modal
          visible={showLocationSheet}
          transparent
          animationType="slide"
          onDismiss={() => {
            if (pendingNotice) {
              setNotificationModalVisible(true);
              setPendingNotice(false);
            }
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.bottomSheet}>
              <Text style={styles.bottomSheetTitle}>Choose Address</Text>
              <FlatList
                data={userLocations}
                keyExtractor={(_, idx) => String(idx)}
                renderItem={renderSavedAddressItem}
                style={{ maxHeight: 200 }}
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
                <Text style={styles.addNewLocationText}>
                  + Add New Location
                </Text>
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

        {/* PAYMENT OPTIONS MODAL */}
        <Modal visible={showPaymentSheet} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.bottomSheet}>
              <Text style={styles.bottomSheetTitle}>Payment Options</Text>

              {/* COD */}
              <TouchableOpacity
                style={[
                  styles.paymentOptionButton,
                  { backgroundColor: "#6fdccf" },
                ]}
                onPress={() => handlePaymentOption("cod")}
              >
                <Text style={styles.paymentOptionText}>Pay on Delivery</Text>
              </TouchableOpacity>

              {/* If you add online payment, uncomment this:
            <TouchableOpacity
              style={[styles.paymentOptionButton, { backgroundColor: "#6fdccf" }]}
              onPress={() => handlePaymentOption("online")}
            >
              <Text style={styles.paymentOptionText}>Pay Online</Text>
            </TouchableOpacity>
            */}

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowPaymentSheet(false)}
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

        {/* NEW: Delivery Timing Error Modal */}
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
  safeArea: {
    flex: 1,
    backgroundColor: "#f2f2f2",
  },
  container: {
    flex: 1,
    backgroundColor: "#fefefe",
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",

    backgroundColor: "#e0f2f1", // light teal
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,

    alignSelf: "center",
    marginTop: 8,
    marginBottom: 14,
    maxWidth: "90%",
  },
  infoIcon: {
    marginRight: 6,
  },
  infoText: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 16,
    color: "#00695c",
  },
  recoHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },

  /* badge —  subtle Blinkit-green pill */
  recoBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#00C853", // Blinkit green
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 6,
  },
  recoBadgeTxt: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    marginLeft: 2,
  },

  /* title text that follows the badge */
  recoTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
  },

  /* --- new: list container gives left padding & gap between cards --- */
  recoList: {
    paddingVertical: 6,
    paddingLeft: 2, // align with other content
    columnGap: RECO_GAP,
  },
  confettiContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    justifyContent: "center",
    alignItems: "center",
    pointerEvents: "none",
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#999",
  },
  headerBlock: {
    backgroundColor: pastelGreen,
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  cartItemsHeader: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#666",
  },
  codNote: {
    marginTop: 8,
    marginBottom: 20,
    fontSize: 14,
    lineHeight: 20,
    color: "#1f4f4f",
    textAlign: "center",
    alignSelf: "center",
    maxWidth: "90%",
  },
  scrollView: {
    flex: 1,
    marginBottom: 60,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  itemListContainer: {
    paddingBottom: 8,
  },

  /** CART ITEM **/
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
  cartItemImage: {
    width: 50,
    height: 50,
    borderRadius: 6,
    marginRight: 8,
    backgroundColor: "#f9f9f9",
  },
  cartItemDetails: {
    flex: 1,
  },
  cartItemName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
  },
  cartItemPrice: {
    marginTop: 2,
    fontSize: 12,
    color: "#555",
  },
  cartItemTotal: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
  },
  quantityControl: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  controlButton: {
    backgroundColor: "#E67E22",
    borderRadius: 8,
    padding: 5,
    marginHorizontal: 2,
  },
  quantityText: {
    fontSize: 13,
    fontWeight: "600",
    marginHorizontal: 4,
    color: "#333",
  },
  removeButton: {
    padding: 5,
  },

  /** DIVIDER **/
  dottedDivider: {
    marginVertical: 10,
    borderWidth: 1,
    borderColor: "#ccc",
    borderStyle: "dotted",
    borderRadius: 1,
  },

  missedSomethingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  missedText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  addMoreRowButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3498db",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addIcon: {
    marginRight: 4,
  },
  addMoreRowText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
  },

  /** LOCATION SECTION **/
  locationSection: {
    backgroundColor: "#fff",
    borderRadius: 6,
    padding: 10,
    marginBottom: 20,
    borderColor: "#eee",
    borderWidth: 1,
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
  },
  loaderOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.5)", // optional dim
    zIndex: 10,
  },

  selectAddressButton: {
    backgroundColor: "#FF7043",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  selectAddressButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  changeLocationButton: {
    marginTop: 4,
    alignSelf: "flex-start",
    backgroundColor: "#f39c12",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  changeLocationText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  selectedLocationHighlight: {
    backgroundColor: "#e1f8e6",
    borderColor: "#2ecc71",
    borderWidth: 1,
  },

  /** PROMO SECTION **/
  promoSection: {
    backgroundColor: "#fff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#eee",
    padding: 10,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
    marginBottom: 6,
  },
  selectedPromoContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f5f5f5",
    borderRadius: 6,
    padding: 8,
  },
  selectedPromoLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
  },
  selectedPromoDescription: {
    fontSize: 11,
    color: "#555",
    marginTop: 3,
  },
  promoTypeText: {
    marginTop: 3,
    fontSize: 11,
    color: "#2ecc71",
  },
  clearPromoText: {
    fontSize: 12,
    color: "#e74c3c",
    fontWeight: "600",
  },
  promoListWrapper: {
    marginTop: 4,
  },
  promoHorizontalList: {
    paddingRight: 6,
  },
  promoCard: {
    width: 120,
    backgroundColor: "#fafafa",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#eee",
    padding: 6,
    marginRight: 10,
    alignItems: "flex-start",
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  promoHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
    width: "100%",
  },
  promoIcon: {
    marginRight: 4,
  },
  promoLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2c3e50",
    flexShrink: 1,
    flexWrap: "wrap",
  },
  promoDescription: {
    fontSize: 10,
    color: "#555",
    marginTop: 2,
    flexWrap: "wrap",
  },
  noPromoText: {
    fontSize: 12,
    color: "#999",
    textAlign: "center",
  },

  /** SUMMARY CARD **/
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#eee",
    padding: 10,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
  },
  discountValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#e74c3c",
  },
  grandTotalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopColor: "#ccc",
    borderTopWidth: 1,
  },
  grandTotalLabel: {
    fontSize: 14,
    color: "#000",
  },
  grandTotalValue: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#000",
  },

  /** FOOTER BAR **/
  footerBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 4,
  },
  footerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  footerTotalLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
    marginRight: 6,
  },
  footerTotalValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#16a085",
  },
  footerCheckoutButton: {
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  footerCheckoutText: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "600",
  },
  recoTitleLight: { fontWeight: "400" },

  /** MODAL OVERLAYS **/
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  bottomSheet: {
    backgroundColor: pastelGreen,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  bottomSheetTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
    color: "#333",
  },
  addNewLocationButton: {
    backgroundColor: "#3498db",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 10,
  },
  addNewLocationText: {
    color: "#fff",
    fontWeight: "600",
  },
  cancelButton: {
    backgroundColor: "#fff",
    borderColor: "#ccc",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 12,
  },
  cancelButtonText: {
    color: "#333",
    fontWeight: "600",
  },
  addressItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: "#eee",
    marginBottom: 6,
  },
  addressItemLeft: {
    flex: 1,
  },
  deleteLocationButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  addressItemLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#333",
  },
  addressItemAddress: {
    fontSize: 12,
    color: "#777",
    marginTop: 2,
  },
  paymentOptionButton: {
    backgroundColor: "#6fdccf",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 8,
  },
  paymentOptionText: {
    color: "#1f4f4f",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default CartScreen;
