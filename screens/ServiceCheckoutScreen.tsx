import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ScrollView,
  Alert,
  TextInput,
  ActivityIndicator,
  Modal,
  StatusBar,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useServiceCart, ServiceCartItem } from "../context/ServiceCartContext";
import { useLocationContext } from "../context/LocationContext";
import { FirestoreService } from "../services/firestoreService";
import { formatDateToDDMMYYYY } from "../utils/dateUtils";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { openRazorpayNative } from "../utils/razorpayNative";
import { registerRazorpayWebViewCallbacks } from "../utils/razorpayWebViewCallbacks";
import auth from "@react-native-firebase/auth";
import axios from "axios";

const LOG_PREFIX = "🧾[SvcPay]";
const log = (...args: any[]) => {
  if (__DEV__) console.log(LOG_PREFIX, ...args);
};
const warn = (...args: any[]) => {
  if (__DEV__) console.warn(LOG_PREFIX, ...args);
};
const errorLog = (...args: any[]) => {
  if (__DEV__) console.error(LOG_PREFIX, ...args);
};

export default function ServiceCheckoutScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { clearCart, state } = useServiceCart();
  const { location } = useLocationContext();
  
  const routeServices = route.params?.services;
  // Backward/forward compatible: some entry points (e.g., services search/banner deep-links)
  // may navigate here without passing `services`. In that case, use the current cart.
  const services = Array.isArray(routeServices)
    ? routeServices
    : Object.values(state?.items || {});
  // Ensure displayed total comes from the actual services (preserve package/company prices)
  const computedTotalAmount = (services || []).reduce((sum: number, s: ServiceCartItem) => sum + (Number(s.totalPrice) || 0), 0);
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("online");
  const [loading, setLoading] = useState(false);
  // const [showConfirmModal, setShowConfirmModal] = useState(false);
  // Legacy state (kept to avoid risky refactors). Online flow now uses a server-side intent
  // so we do NOT create pending bookings before payment.
  // const [pendingBookingIds, setPendingBookingIds] = useState<string[] | null>(null);

  // Persist the last service Razorpay attempt so we can reconcile after app restart.
  const SERVICE_PAYMENT_RECOVERY_KEY = "service_payment_recovery";
  
  // Address management states
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showAddAddressModal, setShowAddAddressModal] = useState(false);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  
  // New address form states
  const [newAddress, setNewAddress] = useState({
    fullAddress: "",
    houseNo: "",
    landmark: "",
    addressType: "Home", // Home, Office, Other
    isDefault: false
  });

  // Load saved addresses on component mount
  useEffect(() => {
    loadSavedAddresses();
    
    // Check if returning from login with saved state
    const restoreCheckoutState = async () => {
      try {
        const restoreState = route.params?.restoreState;
        if (restoreState) {
          console.log('Restoring checkout state after login:', restoreState);
          
          // Restore form state
          if (restoreState.notes) setNotes(restoreState.notes);
          if (restoreState.paymentMethod) setPaymentMethod(restoreState.paymentMethod);
          
          // If there was a pending address, restore it and show the modal
          if (restoreState.pendingAddress) {
            setNewAddress(restoreState.pendingAddress);
            setShowAddAddressModal(true);
          }
        }
      } catch (e) {
        console.error('Error restoring checkout state:', e);
      }
    };
    
    restoreCheckoutState();
  }, []);

  // On screen mount, try to reconcile any previously paid-but-not-finalized service payments.
  useEffect(() => {
    const runRecovery = async () => {
      try {
        const raw = await AsyncStorage.getItem(SERVICE_PAYMENT_RECOVERY_KEY);
        if (!raw) return;

        const recovery = JSON.parse(raw);
        const razorpayOrderId = String(recovery?.razorpayOrderId || "");
        if (!razorpayOrderId) return;

  log("recovery_found", { razorpayOrderId, recovery });

        const api = axios.create({
          timeout: 20000,
          headers: { "Content-Type": "application/json" },
        });

  const user = auth().currentUser;
        if (!user) return;

        const token = await user.getIdToken(true);
        const headers = { Authorization: `Bearer ${token}` };

        const CLOUD_FUNCTIONS_BASE_URL = "https://asia-south1-ninjadeliveries-91007.cloudfunctions.net";
        const RECOVER_URL = `${CLOUD_FUNCTIONS_BASE_URL}/servicePaymentsReconcile`;

        const { data } = await api.post(
          RECOVER_URL,
          { orderIds: [razorpayOrderId] },
          { headers }
        );

  log("recovery_response", data);

        const createdBookings = Number(data?.createdBookings || 0);
        if (data?.ok && (createdBookings > 0 || data?.updatedBookings > 0 || data?.alreadyFinalized || data?.finalizedIntents > 0)) {
          log("recovery_finalized_clear_cart", {
            createdBookings,
            updatedBookings: data?.updatedBookings,
            alreadyFinalized: data?.alreadyFinalized,
          });
          clearCart();
          await AsyncStorage.removeItem(SERVICE_PAYMENT_RECOVERY_KEY);
        }
      } catch (e) {
        warn("recovery_failed_nonfatal", e);
      }
    };

    runRecovery();
  }, [clearCart]);

  const loadSavedAddresses = async () => {
    try {
      setLoadingAddresses(true);
      
      // Check if user is logged in
      const user = auth().currentUser;
      if (!user) {
        console.log('User not logged in, skipping address load');
        setSavedAddresses([]);
        setLoadingAddresses(false);
        return;
      }
      
      // Load from dedicated user_addresses collection
      const savedAddrs = await FirestoreService.getUserSavedAddresses();
      
      // Also load from bookings for backward compatibility
      const bookingAddrs = await FirestoreService.getUserSavedAddressesFromBookings();
      
      // Merge both sources, prioritizing saved addresses
      const allAddresses = [...savedAddrs];
      
      // Add booking addresses that don't exist in saved addresses
      bookingAddrs.forEach(bookingAddr => {
        const exists = allAddresses.some(addr => 
          addr.fullAddress.toLowerCase().trim() === bookingAddr.fullAddress.toLowerCase().trim()
        );
        if (!exists) {
          allAddresses.push(bookingAddr);
        }
      });
      
      setSavedAddresses(allAddresses);
      
      // Auto-select default address if available
      const defaultAddress = allAddresses.find(addr => addr.isDefault);
      if (defaultAddress) {
        setSelectedAddressId(defaultAddress.id);
      } else if (allAddresses.length > 0) {
        setSelectedAddressId(allAddresses[0].id);
      }
      
      console.log(`📍 Loaded ${allAddresses.length} total addresses (${savedAddrs.length} saved + ${bookingAddrs.length} from bookings)`);
    } catch (error) {
      console.error('❌ Error loading saved addresses:', error);
      setSavedAddresses([]);
    } finally {
      setLoadingAddresses(false);
    }
  };

  const saveNewAddress = async () => {
    if (!newAddress.fullAddress.trim()) {
      Alert.alert("Address Required", "Please enter a complete address");
      return;
    }

    // Check if user is logged in
    const user = auth().currentUser;
    if (!user) {
      // Close the modal first
      setShowAddAddressModal(false);
      
      // Save the current screen state to AsyncStorage for return after login
      try {
        await AsyncStorage.setItem('returnToCheckout', JSON.stringify({
          services,
          notes,
          paymentMethod,
          pendingAddress: newAddress
        }));
      } catch (e) {
        console.error('Error saving checkout state:', e);
      }
      
      // Navigate to login screen in HomeTab
      navigation.navigate('HomeTab', {
        screen: 'LoginInHomeStack'
      });
      return;
    }

    try {
      setLoading(true);
      
      // Save to Firestore user_addresses collection
      const addressId = await FirestoreService.saveUserAddress({
        fullAddress: newAddress.fullAddress.trim(),
        houseNo: newAddress.houseNo.trim(),
        landmark: newAddress.landmark.trim(),
        addressType: newAddress.addressType,
        isDefault: newAddress.isDefault || savedAddresses.length === 0, // First address is default
      });

      // Reload addresses to get the saved one
      await loadSavedAddresses();
      setSelectedAddressId(addressId);
      
      // Reset form and close modal
      setNewAddress({
        fullAddress: "",
        houseNo: "",
        landmark: "",
        addressType: "Home",
        isDefault: false
      });
      setShowAddAddressModal(false);
      
      Alert.alert("Success", "Address saved successfully!");
    } catch (error) {
      console.error('❌ Error adding address:', error);
      Alert.alert("Error", "Failed to save address. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getSelectedAddress = () => {
    return savedAddresses.find(addr => addr.id === selectedAddressId);
  };

  const handleProceedToPayment = async () => {
    if (__DEV__) {
      console.log(`🔘 BUTTON PRESSED: handleProceedToPayment called`);
      console.log(`📊 Current state:`, {
        selectedAddressId,
        paymentMethod,
        servicesCount: services.length,
        totalAmount: computedTotalAmount,
        loading,
      });
    }
    
    // Validate that user has selected an address
    if (!selectedAddressId || !getSelectedAddress()) {
      if (__DEV__) console.log(`❌ Address validation failed - no address selected`);
      Alert.alert(
        "Address Required",
        "Please select or add a service address before proceeding with the booking.",
        [
          {
            text: "Add Address",
            onPress: () => setShowAddAddressModal(true)
          },
          {
            text: "Cancel",
            style: "cancel"
          }
        ]
      );
      return;
    }

    const selectedAddress = getSelectedAddress();
  if (__DEV__) console.log(`✅ Address validation passed:`, selectedAddress);
    
    // Handle payment based on selected method
    if (paymentMethod === 'online') {
      if (__DEV__) console.log(`💳 Processing online payment...`);
      await handleRazorpayPayment();
    } else if (paymentMethod === 'cash') {
      if (__DEV__) console.log(`💵 Processing cash on service booking...`);
      // For cash payment, create bookings directly with pending payment status
      const bookingIds = await createBookings("pending");
      
      // Clear cart immediately after successful booking creation
      if (__DEV__) console.log("🧹 Clearing service cart after successful cash booking...");
      clearCart();
      
      // Navigate to booking confirmation screen with first booking ID
      if (bookingIds && bookingIds.length > 0) {
        if (__DEV__) console.log(`🧭 Navigating to BookingConfirmation screen with booking ID: ${bookingIds[0]}`);
        navigation.reset({
          index: 0,
          routes: [
            { name: 'ServicesHome' },
            { 
              name: 'BookingConfirmation', 
              params: { bookingId: bookingIds[0] } 
            }
          ],
        });
      }
    }
  };

  const handleRazorpayPayment = async () => {
    log("razorpay_start", { computedTotalAmount, servicesCount: services?.length ?? 0 });
    setLoading(true);
    try {
      // API Configuration for Razorpay
      const api = axios.create({
        timeout: 20000,
        headers: { "Content-Type": "application/json" },
      });

  const CLOUD_FUNCTIONS_BASE_URL = "https://asia-south1-ninjadeliveries-91007.cloudfunctions.net";
  // Some functions might still be deployed to the default region.
  const CLOUD_FUNCTIONS_BASE_URL_USC1 = "https://us-central1-ninjadeliveries-91007.cloudfunctions.net";

  const callableUrl = (fnName: string, baseUrl = CLOUD_FUNCTIONS_BASE_URL) => `${baseUrl}/${fnName}:call`;
  const httpUrl = (fnName: string, baseUrl = CLOUD_FUNCTIONS_BASE_URL) => `${baseUrl}/${fnName}`;

      const postWith404Fallback = async (fnName: string, body: any, headers: any) => {
        try {
          // Prefer plain HTTP endpoint first
          if (__DEV__) {
            log("fn_post_attempt", { fnName, url: httpUrl(fnName), mode: "http" });
          }
          return await api.post(httpUrl(fnName), body, { headers });
        } catch (e: any) {
          const status = e?.response?.status;

          // Explicitly one of our HTTPS-only functions (not callable).
          const httpsOnly = fnName === "servicePaymentsCreateIntent" || fnName === "createRazorpayOrder" || fnName === "servicePaymentsReconcile" || fnName === "servicePaymentsVerifyAndFinalize";

          // Region mismatch fallback: try us-central1 if the asia-south1 URL 404s.
          if (status === 404) {
            if (__DEV__) {
              log("fn_post_attempt", { fnName, url: httpUrl(fnName, CLOUD_FUNCTIONS_BASE_URL_USC1), mode: "http_us_central1" });
            }
            return await api.post(httpUrl(fnName, CLOUD_FUNCTIONS_BASE_URL_USC1), body, { headers });
          }

          // Some deployments might expose callable endpoints, or enforce auth via callable middleware.
          // Only retry callable for functions that are NOT known HTTPS-only.
          if (!httpsOnly && (status === 401 || status === 403)) {
            if (__DEV__) {
              log("fn_post_attempt", { fnName, url: callableUrl(fnName), mode: "callable" });
            }

            // Callable endpoints expect { data: ... } and respond with { result: ... }.
            const resp = await api.post(callableUrl(fnName), { data: body }, { headers });
            const unwrapped = resp?.data?.result ?? resp?.data;
            return { ...resp, data: unwrapped };
          }

          throw e;
        }
      };

      const CREATE_RZP_ORDER_URL = httpUrl('createRazorpayOrder');

      const getAuthHeaders = async (opts?: { forceRefresh?: boolean }) => {
        const user = auth().currentUser;
        if (!user) throw new Error("Not logged in");
        const token = await user.getIdToken(!!opts?.forceRefresh);
        return {
          Authorization: `Bearer ${token}`,
          // Some backends/middleware read auth from "__session" (common in Firebase Hosting + Functions setups).
          // Sending it here is harmless and fixes 401s when Authorization isn't being read.
          __session: token,
          "Content-Type": "application/json",
        };
      };

      // Remove undefined recursively so backend Firestore writes never fail.
      const stripUndefinedDeep = (value: any): any => {
        if (Array.isArray(value)) {
          return value
            .map(stripUndefinedDeep)
            .filter((v) => v !== undefined);
        }
        if (value && typeof value === "object") {
          const out: any = {};
          Object.keys(value).forEach((k) => {
            const v = stripUndefinedDeep(value[k]);
            if (v !== undefined) out[k] = v;
          });
          return out;
        }
        return value === undefined ? undefined : value;
      };

      const toPaise = (amountRupees: number) => Math.round(Number(amountRupees) * 100);

      // IMPORTANT:
      // Do NOT create service bookings before payment.
      // We only create bookings after payment is verified.
      // This avoids cluttering history with pending bookings when users cancel.

    // Create Razorpay order
    log("rzp_order_create_start", { amountRupees: computedTotalAmount });
      const user = auth().currentUser;
      if (!user) throw new Error("Not logged in");

      const amountPaise = toPaise(computedTotalAmount);
      const headers = await getAuthHeaders();

      const requestData = {
        amountPaise,
        currency: "INR",
        // Include booking ids so backend/webhooks can reconcile if needed.
        receipt: `service_${user.uid}_${Date.now()}`,
        notes: { uid: user.uid, type: "service_booking" },
      };

  log("rzp_order_request", requestData);
      const { data } = await api.post(CREATE_RZP_ORDER_URL, requestData, { headers });

      if (!data?.orderId || !data?.keyId) {
        throw new Error(data?.error || "Failed to create Razorpay order");
      }

  log("rzp_order_created", { orderId: data.orderId, keyId: data.keyId, currency: data.currency });

      // Create server-side payment intent (stores booking draft) so app-kill can still finalize.
      // IMPORTANT: This does NOT create bookings yet.
      let intentCreated = false;
      try {
        const selectedAddress = getSelectedAddress();

        const draftRaw = {
          // Keep as plain JSON (no functions / class instances)
          customerId: user.uid,
          customerName: selectedAddress?.userName || undefined,
          customerPhone: selectedAddress?.userPhone || user.phoneNumber || undefined,
          customerAddress: selectedAddress?.fullAddress || location.address || "",
          // Store cart snapshot for server-side booking creation
          services: (services || []).map((service: any) => ({
            serviceId: service?.id,
            serviceName: service?.serviceTitle,
            workName: Array.isArray(service?.issues) && service.issues.length
              ? service.issues.join(", ")
              : service?.serviceTitle,
            totalPrice: service?.totalPrice ?? 0,
            addOns: service?.addOns ?? [],
            selectedDate: service?.selectedDate,
            selectedTime: service?.selectedTime,
            companyId: service?.company?.companyId || service?.company?.id,
            companyName: service?.company?.name,
            bookingType: service?.bookingType,
            additionalInfo: service?.additionalInfo,
          })),
          // location data (optional)
          location: {
            lat: location.lat ?? null,
            lng: location.lng ?? null,
            address: selectedAddress?.fullAddress || location.address || "",
            houseNo: selectedAddress?.houseNo || "",
            placeLabel: selectedAddress?.addressType || "Home",
          },
          serviceAddress: {
            id: selectedAddress?.id || "",
            fullAddress: selectedAddress?.fullAddress || "",
            houseNo: selectedAddress?.houseNo || "",
            landmark: selectedAddress?.landmark || "",
            addressType: selectedAddress?.addressType || "Home",
            lat: location.lat ?? null,
            lng: location.lng ?? null,
          },
          notes: notes || "",
          // convenience
          totalAmount: computedTotalAmount,
          // Helpful for backend writes
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        const draft = stripUndefinedDeep(draftRaw);

  // Force refresh here because 401s usually mean the ID token is stale/expired.
  const intentHeaders = await getAuthHeaders({ forceRefresh: true });
        if (__DEV__) {
          log("intent_headers_debug", {
            hasAuthorization: !!intentHeaders?.Authorization,
            authorizationPrefix: String(intentHeaders?.Authorization || "").slice(0, 12),
          });
        }
        log("intent_create_start", {
          orderId: String(data.orderId),
          amountPaise,
          currency: String(data.currency ?? "INR"),
          servicesCount: (services || []).length,
        });
        const { data: intentResp } = await postWith404Fallback(
          "servicePaymentsCreateIntent",
          {
            orderId: String(data.orderId),
            amountPaise,
            currency: String(data.currency ?? "INR"),
            draft,
          },
          intentHeaders
        );

        intentCreated = !!intentResp?.ok;
        log("intent_create_done", { ok: intentResp?.ok, orderId: String(data.orderId) });

        if (!intentCreated) {
          throw new Error(intentResp?.error || "Intent creation failed");
        }
      } catch (intentErr: any) {
        // If intent can't be created, we lose crash-safe finalization.
        // Fail fast so we don't take payment without ability to finalize later.
        warn("intent_create_failed", intentErr);
        throw new Error(intentErr?.message || "Failed to initialize payment intent");
      }

      // Persist recovery info for crash-safe verification/reconcile.
      await AsyncStorage.setItem(
        SERVICE_PAYMENT_RECOVERY_KEY,
        JSON.stringify({
          razorpayOrderId: String(data.orderId),
          createdAt: Date.now(),
          intentCreated,
        })
      );

      log("recovery_saved", { razorpayOrderId: String(data.orderId) });

      const contact = (user.phoneNumber || "").replace("+91", "");

      // --- Try Native Razorpay Checkout first ---
      try {
        log("native_checkout_attempt", { orderId: String(data.orderId), amountPaise });
        const nativeResult = await openRazorpayNative({
          key: String(data.keyId),
          order_id: String(data.orderId),
          amount: String(amountPaise),
          currency: String(data.currency ?? "INR"),
          name: "Ninja Services",
          description: "Service booking payment",
          prefill: {
            contact,
            email: "",
            name: "",
          },
          notes: { uid: user.uid, type: "service_booking" },
          theme: { color: "#059669" },
        });

        log("native_checkout_success", nativeResult);

          // Verify payment + finalize bookings on server (crash-safe)
          const verifyHeaders = await getAuthHeaders();
          log("verify_and_finalize_start", {
            razorpayOrderId: nativeResult?.razorpay_order_id,
          });
          const { data: verifyData } = await postWith404Fallback(
            'servicePaymentsVerifyAndFinalize',
            { ...nativeResult },
            verifyHeaders
          );

          log("verify_and_finalize_response", verifyData);

          if (!verifyData?.verified) {
            throw new Error(verifyData?.error || "Payment verification failed");
          }

          log("verify_and_finalize_verified");

          await AsyncStorage.removeItem(SERVICE_PAYMENT_RECOVERY_KEY);
          log("recovery_cleared_after_verify");

          // Create bookings only after verified payment
          log("create_paid_bookings_after_verify_start");
          const createdBookingIds = await createBookings("paid", nativeResult);
          log("create_paid_bookings_after_verify_done", { bookingIds: createdBookingIds });

          log("clear_cart_after_verify");
          clearCart();

          if (createdBookingIds.length > 0) {
            log("navigate_to_booking_confirmation", { bookingId: createdBookingIds[0] });
            navigation.reset({
              index: 0,
              routes: [
                { name: "ServicesHome" },
                { name: "BookingConfirmation", params: { bookingId: createdBookingIds[0] } },
              ],
            });
          }
          return; // Don't fall through to WebView
      } catch (nativeErr: any) {
        // Includes both "unavailable" and actual SDK failures
        warn("native_checkout_failed_fallback_to_webview", nativeErr);
        // fall through to WebView
      }

  // Navigate directly to Razorpay WebView.
  // Keep `loading=true` so the user doesn't see the Pay button again before WebView appears.
  log("navigate_to_webview", { orderId: String(data.orderId) });
  const sessionId = registerRazorpayWebViewCallbacks({
    onSuccess: async (response: any) => {
      try {
        log("webview_success_callback", response);
        
        // Verify payment + finalize bookings on server (crash-safe)
        const verifyHeaders = await getAuthHeaders();
        log("verify_and_finalize_start", {
          razorpayOrderId: response?.razorpay_order_id,
        });
        const { data: verifyData } = await postWith404Fallback(
          'servicePaymentsVerifyAndFinalize',
          { ...response },
          verifyHeaders
        );

        log("verify_and_finalize_response", verifyData);

        if (!verifyData?.verified) {
          throw new Error(verifyData?.error || "Payment verification failed");
        }
        
        log("verify_and_finalize_verified");

        // Clear recovery state now that backend confirmed.
        await AsyncStorage.removeItem(SERVICE_PAYMENT_RECOVERY_KEY);
        log("recovery_cleared_after_verify");

        // Create bookings only after verified payment
        log("create_paid_bookings_after_verify_start");
        const createdBookingIds = await createBookings("paid", response);
        log("create_paid_bookings_after_verify_done", { bookingIds: createdBookingIds });
        
        // Clear cart immediately after successful booking creation
        log("clear_cart_after_verify");
        clearCart();
        
        // Navigate to booking confirmation screen with first booking ID
        if (createdBookingIds && createdBookingIds.length > 0) {
          log("navigate_to_booking_confirmation", { bookingId: createdBookingIds[0] });
          navigation.reset({
            index: 0,
            routes: [
              { name: 'ServicesHome' },
              { 
                name: 'BookingConfirmation', 
                params: { bookingId: createdBookingIds[0] } 
              }
            ],
          });
        }
        
      } catch (error) {
        errorLog("verify_and_finalize_failed", error);
        Alert.alert("Payment Verification Failed", "Please contact support.");
      } finally {
        // WebView flow has finished (success path attempted). Stop showing loading on this screen.
        setLoading(false);
      }
    },
    onFailure: (error: any) => {
      warn("webview_failure_callback", error);
      Alert.alert("Payment Failed", error?.description || "Payment was not completed.");
      setLoading(false);
    },
  });

  navigation.navigate("RazorpayWebView", {
        orderId: String(data.orderId),
        amount: computedTotalAmount,
        keyId: String(data.keyId),
        currency: String(data.currency ?? "INR"),
        name: "Ninja Services",
        description: "Service booking payment",
        prefill: {
          contact,
          email: "",
          name: "",
        },
        sessionId,
  });

      // NOTE: Do not setLoading(false) here — we want the button to stay in "Processing" state
      // until either native SDK finishes or WebView callbacks fire.

    } catch (error: any) {
      errorLog("razorpay_flow_error", error);
      let message = "Payment failed. Please try again.";
      
      if (error?.description) {
        message = error.description;
      } else if (error?.message) {
        message = error.message;
      }
      
      Alert.alert("Payment Failed", message, [
        { text: "OK" },
        {
          text: "Use Cash Payment",
          onPress: () => {
            setPaymentMethod("cash");
          }
        }
      ]);
      setLoading(false);
    }
  };

  const createBookings = async (paymentStatus: string = "pending", razorpayResponse?: any): Promise<string[]> => {
    setLoading(true);
    try {
      if (__DEV__) {
        console.log(`🔍 Starting booking creation process...`);
        console.log(` Payment status: ${paymentStatus}, method: ${paymentMethod}`);
        console.log(`🛒 Services to book: ${services.length}`);
        // Avoid dumping full location JSON each time (very noisy)
        console.log(`📍 Location:`, {
          hasAddress: !!location?.address,
          lat: location?.lat,
          lng: location?.lng,
        });
      }
      
      // Validate services array first
      if (!services || services.length === 0) {
        throw new Error('No services to book');
      }
      
      // Log each service for debugging
      if (__DEV__) {
        services.forEach((service: ServiceCartItem, index: number) => {
          console.log(`🔧 Service ${index + 1}:`, {
            id: service.id,
            title: service.serviceTitle,
            issues: service.issues,
            company: {
              id: service.company?.id,
              companyId: service.company?.companyId,
              name: service.company?.name
            },
            date: service.selectedDate,
            time: service.selectedTime,
            price: service.totalPrice,
            addOns: service.addOns
          });
        });
      }
      
      // Get actual customer information from Firebase
      let customerData = {
        name: "Customer",
        phone: "",
        address: location.address || "" // Use address from LocationContext
      };

      try {
        const currentUser = await FirestoreService.getCurrentUser();
        if (currentUser) {
          customerData = {
            name: currentUser.name || currentUser.displayName || `Customer ${currentUser.phone?.slice(-4) || ''}`,
            phone: currentUser.phone || currentUser.phoneNumber || "",
            address: location.address || currentUser.address || currentUser.location || currentUser.fullAddress || ""
          };
        }
        if (__DEV__) {
          console.log(`📱 Retrieved customer data: ${customerData.name}, ${customerData.phone}`);
          console.log(`📍 Using service address: ${customerData.address}`);
        }
      } catch (userError) {
        console.error("Error fetching user data:", userError);
        // Continue with location address from context
        customerData.address = location.address || "";
      }

      // Create bookings in Firebase service_bookings collection
      const bookingPromises = services.flatMap((service: ServiceCartItem, index: number) => {
        if (__DEV__) {
          console.log(`\n🔄 Processing service ${index + 1}/${services.length}: ${service.serviceTitle}`);
        }

        // Package debug (keep minimal and dev-only)
        if (__DEV__) {
          const pkg = service.additionalInfo?.package;
          console.log('📦 Package:', {
            hasPackage: !!pkg,
            id: pkg?.id,
            name: pkg?.name,
            unit: pkg?.unit,
            frequency: (pkg as any)?.frequency,
          });
        }
        
        const selectedAddress = getSelectedAddress();
        if (__DEV__) {
          console.log(`📍 Selected address for service ${index + 1}:`, selectedAddress);
        }

        const currentAuthUser = auth().currentUser;
        const customerId = String(currentAuthUser?.uid || "");

        const occurrences: { date: string; time: string }[] = Array.isArray((service as any)?.additionalInfo?.occurrences)
          ? (service as any).additionalInfo.occurrences
          : [];

        // Safety guard:
        // Day-unit packages in our UX are single-day bookings (pick exactly 1 day within next 7 days).
        // If an old/stale cart item still contains an expanded occurrences array (e.g. 28 days),
        // collapse it here so we never create month-long bookings by mistake.
        const rawUnitForGuard = String(
          service?.additionalInfo?.package?.unit ||
          service?.additionalInfo?.package?.frequency ||
          service?.additionalInfo?.package?.type ||
          ''
        ).toLowerCase().trim();
        const isDayUnitPackage = rawUnitForGuard === 'day' || rawUnitForGuard === 'daily';
        const normalizedOccurrences = isDayUnitPackage
          ? (occurrences.length > 0
              ? [occurrences[0]]
              : [{ date: service.selectedDate || new Date().toISOString().split('T')[0], time: service.selectedTime || '10:00 AM' }])
          : occurrences;

        const expandedOccurrences = (normalizedOccurrences.length > 0)
          ? normalizedOccurrences
          : [{ date: service.selectedDate || new Date().toISOString().split('T')[0], time: service.selectedTime || "10:00 AM" }];

        // If the client is creating recurrence bookings, we must stamp a stable planGroupId
        // so Booking History can group them into one card.
        const packageObj = service.additionalInfo?.package;
        const rawUnit = String(packageObj?.unit || packageObj?.frequency || packageObj?.type || '').toLowerCase().trim();
        const packageUnit = rawUnit === 'monthly' ? 'month' : rawUnit === 'weekly' ? 'week' : rawUnit === 'daily' ? 'day' : rawUnit;
        const isPlanUnit = ['day', 'week', 'month'].includes(packageUnit);
        const isPlanBooking = !!packageObj && isPlanUnit && expandedOccurrences.length > 1;

        // Deterministic-ish group id per plan purchase from the context we have.
        // (If you have a real orderId/payment sessionId available, pass that instead.)
        const planGroupId = isPlanBooking
          ? `plan:${customerId}:${service.id || service.serviceTitle || 'service'}:${service.company?.companyId || service.company?.id || 'company'}:${String(expandedOccurrences[0]?.date || '')}:${String(expandedOccurrences[0]?.time || '')}`
          : '';

        if (__DEV__ && isPlanBooking) {
          console.log(`📅 Plan booking detected`, {
            serviceTitle: service.serviceTitle,
            occurrences: expandedOccurrences.length,
            packageUnit,
            planGroupId,
          });
        }

        return expandedOccurrences.map(async (occ, occIndex) => {
          const toLocalISODate = (dt: Date) => {
            const y = dt.getFullYear();
            const m = String(dt.getMonth() + 1).padStart(2, '0');
            const d = String(dt.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
          };
          const normalizeWorkName = (raw: any, fallback: string) => {
            if (raw == null) return fallback;
            if (typeof raw === 'string') {
              const s = raw.trim();
              return s.length > 0 ? s : fallback;
            }
            if (Array.isArray(raw)) {
              const parts = raw
                .map((x) => {
                  if (typeof x === 'string') return x;
                  if (x && typeof x === 'object') return (x as any).name || (x as any).title || '';
                  return '';
                })
                .filter(Boolean);
              return parts.length > 0 ? parts.join(', ') : fallback;
            }
            if (typeof raw === 'object') {
              const n = (raw as any).name || (raw as any).title;
              if (typeof n === 'string' && n.trim().length > 0) return n.trim();
            }
            return fallback;
          };

          // Ensure all required fields have valid values
          const bookingData = {
          // Ownership field used by BookingHistory queries
          customerId,
          serviceName: service.serviceTitle || "Service",
          workName: normalizeWorkName(
            (service as any)?.issues,
            String(service.serviceTitle || 'Service')
          ),
          customerName: customerData.name || "Customer",
          customerPhone: customerData.phone || "+91-0000000000", // Fallback phone for users without phone
          customerAddress: selectedAddress?.fullAddress || "", // Use saved address
          date: occ.date || service.selectedDate || toLocalISODate(new Date()),
          time: occ.time || service.selectedTime || "10:00 AM",
          status: 'pending' as const,
          companyId: service.company?.companyId || service.company?.id || "",
          companyName: service.company?.name || "Service Provider", // Add company name for website
          totalPrice: service.totalPrice || 0,
          addOns: service.addOns || [],
          // Package information (if this is a package booking)
          ...(service.additionalInfo?.package ? {
            isPackage: true,
            isPackageBooking: true,
            planGroupId: isPlanBooking ? planGroupId : undefined,
            packageUnit: isPlanBooking ? packageUnit : undefined,
            selectedPackage: service.additionalInfo.package,
            packageId: service.additionalInfo.package.id || "",
            packageName: service.additionalInfo.package.name || "",
            packageType: (
              // First check explicit unit/frequency fields
              service.additionalInfo.package.unit === 'month' || service.additionalInfo.package.frequency === 'monthly' ? 'monthly' :
              service.additionalInfo.package.unit === 'week' || service.additionalInfo.package.frequency === 'weekly' ? 'weekly' :
              // Fallback to name-based detection
              service.additionalInfo.package.name?.toLowerCase().includes('monthly') || service.additionalInfo.package.name?.toLowerCase().includes('month') ? 'monthly' : 
              service.additionalInfo.package.name?.toLowerCase().includes('weekly') || service.additionalInfo.package.name?.toLowerCase().includes('week') ? 'weekly' : 
              'custom'
            ) as 'monthly' | 'weekly' | 'custom',
            packagePrice: service.additionalInfo.package.price || service.totalPrice || 0,
            packageDuration: service.additionalInfo.package.duration || "",
            packageDescription: service.additionalInfo.package.description || "",
          } : {
            isPackage: false, // Explicitly set to false for non-package bookings
            isPackageBooking: false,
          }),
          // Add location data for website access (CRITICAL for website integration)
          location: {
            lat: (location.lat !== null && location.lat !== undefined) ? location.lat : null,
            lng: (location.lng !== null && location.lng !== undefined) ? location.lng : null,
            address: selectedAddress?.fullAddress || "",
            houseNo: selectedAddress?.houseNo || "",
            placeLabel: selectedAddress?.addressType || "Home",
          },
          // Keep serviceAddress for backward compatibility
          serviceAddress: {
            id: selectedAddress?.id || "",
            fullAddress: selectedAddress?.fullAddress || "",
            houseNo: selectedAddress?.houseNo || "",
            landmark: selectedAddress?.landmark || "",
            addressType: selectedAddress?.addressType || "Home",
            // Include location coordinates if available
            lat: (location.lat !== null && location.lat !== undefined) ? location.lat : null,
            lng: (location.lng !== null && location.lng !== undefined) ? location.lng : null,
          },
          paymentMethod: paymentMethod || "cash",
          paymentStatus: paymentStatus || "pending",
          notes: notes || "",
          // Add additional fields that website might expect
          bookingType: service.bookingType || 'service',
          category: service.serviceTitle || "Service",
          subcategory: (service.issues && service.issues.length > 0) 
            ? (typeof service.issues[0] === 'object' ? service.issues[0].name : service.issues[0])
            : "",
        };

          if (__DEV__) {
            // Keep a tiny, useful summary only (avoid dumping full bookingData JSON)
            console.log(`📋 Creating booking`, {
              idx: `${index + 1}${occurrences.length > 0 ? `.${occIndex + 1}` : ''}`,
              date: bookingData.date,
              time: bookingData.time,
              companyId: bookingData.companyId,
              hasLocation: !!bookingData.location,
              isPackageBooking: !!(bookingData as any).isPackageBooking,
              planGroupId: (bookingData as any).planGroupId,
            });
          }
          try {
            const bookingId = await FirestoreService.createServiceBooking(bookingData);
            if (__DEV__) console.log(`✅ Created booking ${bookingId} for ${service.serviceTitle}`);
          
            // Create payment record in service_payments collection
            if (!bookingId) {
              throw new Error('Failed to create booking - no booking ID returned');
            }
          
            const paymentData = {
              bookingId,
              amount: service.totalPrice || 0,
              paymentMethod: paymentMethod as 'cash' | 'online',
              paymentStatus: paymentStatus as 'pending' | 'paid',
              serviceName: service.serviceTitle || 'Service',
              companyName: service.company?.name || 'Service Provider',
              companyId: service.company?.companyId || service.company?.id || '',
              paymentGateway: paymentMethod === 'online' ? 'razorpay' as const : 'cash' as const,
              // Add Razorpay details if payment was successful
              ...(razorpayResponse && paymentStatus === 'paid' && {
                transactionId: razorpayResponse.razorpay_payment_id || '',
                razorpayOrderId: razorpayResponse.razorpay_order_id || '',
                razorpaySignature: razorpayResponse.razorpay_signature || '',
              }),
            };

            if (__DEV__) {
              console.log(`💳 Creating payment record`, {
                idx: `${index + 1}${occurrences.length > 0 ? `.${occIndex + 1}` : ''}`,
                bookingId,
                amount: paymentData.amount,
                paymentMethod: paymentData.paymentMethod,
                paymentStatus: paymentData.paymentStatus,
              });
            }
            const paymentId = await FirestoreService.createServicePayment(paymentData);
            if (__DEV__) console.log(`✅ Created payment record ${paymentId} for booking ${bookingId}`);
            
            return bookingId;
          } catch (serviceError: any) {
            console.error(`❌ Error creating booking ${index + 1}${occurrences.length > 0 ? `.${occIndex + 1}` : ''} for service ${service.serviceTitle}:`, serviceError);
            throw serviceError;
          }
        });
      });

  const allPromises = bookingPromises.flat();
  if (__DEV__) console.log(`\n🔄 Creating ${allPromises.length} bookings simultaneously...`);
  const bookingIds = await Promise.all(allPromises);
  if (__DEV__) console.log(`✅ All ${bookingIds.length} bookings created successfully!`);
      
      return bookingIds;

    } catch (error: any) {
      console.error('❌ Error creating bookings:', error);
      console.error('❌ Error stack:', error.stack);
      
      // Show user-friendly error message
      Alert.alert(
        "Booking Failed",
        `Failed to create your bookings: ${error.message || 'Unknown error'}\n\nPlease try again or contact support if the issue persists.`,
        [{ text: "OK" }]
      );
      
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const renderServiceItem = ({ item }: { item: ServiceCartItem }) => (
    <View style={styles.serviceCard}>
      <View style={styles.serviceHeader}>
        <Text style={styles.serviceTitle}>{item.serviceTitle}</Text>
        <Text style={styles.servicePrice}>₹{item.totalPrice}</Text>
      </View>

      <View style={styles.serviceDetails}>
        <Text style={styles.companyName}>{item.company.name}</Text>
        <View style={styles.ratingContainer}>
          <Text style={styles.rating}>{item.company.rating}</Text>
          <Text style={styles.experience}>{item.company.experience}</Text>
          {item.company.verified && (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}></Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.bookingInfo}>
        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={16} color="#666" />
          <Text style={styles.infoText}>{formatDateToDDMMYYYY(item.selectedDate)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={16} color="#666" />
          <Text style={styles.infoText}>{item.selectedTime}</Text>
        </View>
      </View>

      <View style={styles.issuesContainer}>
        <Text style={styles.issuesTitle}>Issues:</Text>
        <View style={styles.issuesList}>
            {item.issues.map((issue: any, index: number) => {
              const issueText =
                typeof issue === "string"
                  ? issue
                  : String(issue?.name || "");

              return (
                <View key={index} style={styles.issueTag}>
                  <Text style={styles.issueText}>
                    {issueText}
                  </Text>
                </View>
              );
            })}
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={false} />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Service Checkout</Text>
        <View style={styles.backButton} />
      </View>
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Services ({services.length})</Text>
        
        <FlatList
          data={services}
          renderItem={renderServiceItem}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          contentContainerStyle={styles.servicesList}
        />

        {/* Service Address Section */}
        <View style={styles.addressSection}>
          <View style={styles.addressHeader}>
            <Text style={styles.sectionTitle}>Service Address</Text>
            <TouchableOpacity 
              style={styles.addAddressButton}
              onPress={() => setShowAddAddressModal(true)}
            >
              <Ionicons name="add-circle-outline" size={20} color="#4CAF50" />
              <Text style={styles.addAddressText}>Add New</Text>
            </TouchableOpacity>
          </View>

          {loadingAddresses ? (
            <View style={styles.loadingAddressContainer}>
              <ActivityIndicator size="small" color="#4CAF50" />
              <Text style={styles.loadingAddressText}>Loading addresses...</Text>
            </View>
          ) : savedAddresses.length === 0 ? (
            <View style={styles.noAddressContainer}>
              <Ionicons name="location-outline" size={48} color="#ccc" />
              <Text style={styles.noAddressTitle}>No Saved Addresses</Text>
              <Text style={styles.noAddressText}>Add your first address to continue</Text>
              <TouchableOpacity 
                style={styles.addFirstAddressButton}
                onPress={() => setShowAddAddressModal(true)}
              >
                <Ionicons name="add-circle" size={16} color="#fff" />
                <Text style={styles.addFirstAddressText}>Add Address</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={savedAddresses}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.addressCard,
                    selectedAddressId === item.id && styles.addressCardSelected
                  ]}
                  onPress={() => setSelectedAddressId(item.id)}
                >
                  <View style={styles.addressCardHeader}>
                    <View style={styles.addressTypeContainer}>
                      <Ionicons 
                        name={item.addressType === 'Home' ? 'home' : item.addressType === 'Office' ? 'business' : 'location'} 
                        size={16} 
                        color="#4CAF50" 
                      />
                      <Text style={styles.addressType}>{item.addressType}</Text>
                      {item.isDefault && (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultText}>Default</Text>
                        </View>
                      )}
                    </View>
                    {selectedAddressId === item.id && (
                      <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                    )}
                  </View>
                  
                  <Text style={styles.addressText}>{item.fullAddress}</Text>
                  
                  {item.houseNo && (
                    <Text style={styles.addressDetail}>House/Flat: {item.houseNo}</Text>
                  )}
                  
                  {item.landmark && (
                    <Text style={styles.addressDetail}>Landmark: {item.landmark}</Text>
                  )}
                </TouchableOpacity>
              )}
              scrollEnabled={false}
            />
          )}
        </View>

        <View style={styles.notesSection}>
          <Text style={styles.sectionTitle}>Additional Notes (Optional)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Any special instructions or requirements..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.paymentSection}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          
          {/* Online Payment Option */}
          <TouchableOpacity
            style={[
              styles.paymentOption,
              paymentMethod === 'online' && styles.paymentOptionSelected
            ]}
            onPress={() => setPaymentMethod('online')}
          >
            <View style={styles.paymentOptionContent}>
              <View style={styles.onlineIconContainer}>
                <Ionicons name="card-outline" size={24} color="#4CAF50" />
              </View>
              <View style={styles.paymentOptionTextContainer}>
                <Text style={styles.paymentOptionText}>Pay Online</Text>
                <Text style={styles.paymentOptionSubtext}>UPI, Cards, Net Banking via Razorpay</Text>
              </View>
            </View>
            {paymentMethod === 'online' && (
              <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            )}
          </TouchableOpacity>

          {/* Cash on Service Option */}
          <TouchableOpacity
            style={[
              styles.paymentOption,
              paymentMethod === 'cash' && styles.paymentOptionSelected
            ]}
            onPress={() => setPaymentMethod('cash')}
          >
            <View style={styles.paymentOptionContent}>
              <View style={styles.cashIconContainer}>
                <Ionicons name="cash-outline" size={24} color="#FF9800" />
              </View>
              <View style={styles.paymentOptionTextContainer}>
                <Text style={styles.paymentOptionText}>Cash on Service</Text>
                <Text style={styles.paymentOptionSubtext}>Pay after service completion</Text>
              </View>
            </View>
            {paymentMethod === 'cash' && (
              <Ionicons name="checkmark-circle" size={24} color="#FF9800" />
            )}
          </TouchableOpacity>

          {paymentMethod === 'online' && (
            <View style={styles.paymentNote}>
              <Ionicons name="information-circle-outline" size={16} color="#2563eb" />
              <Text style={styles.paymentNoteText}>
                Secure payment via Razorpay. Supports UPI (Google Pay, PhonePe, Paytm), Credit/Debit Cards, and Net Banking.
              </Text>
            </View>
          )}

          {paymentMethod === 'cash' && (
            <View style={styles.cashPaymentNote}>
              <Ionicons name="information-circle-outline" size={16} color="#FF9800" />
              <Text style={styles.cashPaymentNoteText}>
                Pay in cash to the service provider after the service is completed. Please keep exact change ready.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>Booking Summary</Text>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Services ({services.length})</Text>
            <Text style={styles.summaryValue}>₹{computedTotalAmount}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Service Address</Text>
            <Text style={[styles.summaryValue, styles.summaryAddressValue]}>
              {(() => {
                const selectedAddress = getSelectedAddress();
                if (selectedAddress) {
                  const address = selectedAddress.fullAddress;
                  return address.length > 30 ? 
                    `${address.substring(0, 30)}...` : 
                    address;
                } else {
                  return "Not selected";
                }
              })()}
            </Text>
          </View>
          
          <View style={styles.summaryDivider} />

          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>₹{computedTotalAmount}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.totalContainer}>
          <Text style={styles.footerTotalLabel}>Total: ₹{computedTotalAmount}</Text>
          <Text style={styles.footerServiceCount}>{services.length} service{services.length > 1 ? 's' : ''}</Text>
        </View>
        
        <TouchableOpacity
          style={[
            paymentMethod === 'cash' ? styles.cashPayButton : styles.proceedButton,
            loading && styles.proceedButtonDisabled
          ]}
          onPress={handleProceedToPayment}
          disabled={loading}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.proceedButtonText}>
                {paymentMethod === 'cash' ? 'Creating Booking...' : 'Processing Payment...'}
              </Text>
            </View>
          ) : paymentMethod === 'cash' ? (
            <View style={styles.cashPayButtonContent}>
              <Ionicons name="cash-outline" size={20} color="#fff" />
              <Text style={styles.proceedButtonText}>Confirm Booking</Text>
            </View>
          ) : (
            <View style={styles.onlinePayButtonContent}>
              <Ionicons name="card-outline" size={20} color="#fff" />
              <Text style={styles.proceedButtonText}>Pay ₹{computedTotalAmount} Online</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Add Address Modal */}
      <Modal
        visible={showAddAddressModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddAddressModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setShowAddAddressModal(false)}
            >
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add New Address</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Complete Address *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Enter your complete address..."
                placeholderTextColor="#999"
                value={newAddress.fullAddress}
                onChangeText={(text) => setNewAddress(prev => ({ ...prev, fullAddress: text }))}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>House/Flat/Building No.</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g., 123, Apartment Name"
                placeholderTextColor="#999"
                value={newAddress.houseNo}
                onChangeText={(text) => setNewAddress(prev => ({ ...prev, houseNo: text }))}
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Landmark (Optional)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g., Near Metro Station, Mall"
                placeholderTextColor="#999"
                value={newAddress.landmark}
                onChangeText={(text) => setNewAddress(prev => ({ ...prev, landmark: text }))}
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Address Type</Text>
              <View style={styles.addressTypeOptions}>
                {['Home', 'Office', 'Other'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.addressTypeOption,
                      newAddress.addressType === type && styles.addressTypeOptionSelected
                    ]}
                    onPress={() => setNewAddress(prev => ({ ...prev, addressType: type }))}
                  >
                    <Ionicons 
                      name={type === 'Home' ? 'home' : type === 'Office' ? 'business' : 'location'} 
                      size={16} 
                      color={newAddress.addressType === type ? "#fff" : "#666"} 
                    />
                    <Text style={[
                      styles.addressTypeOptionText,
                      newAddress.addressType === type && styles.addressTypeOptionTextSelected
                    ]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={styles.defaultAddressOption}
              onPress={() => setNewAddress(prev => ({ ...prev, isDefault: !prev.isDefault }))}
            >
              <Ionicons 
                name={newAddress.isDefault ? "checkbox" : "checkbox-outline"} 
                size={20} 
                color="#4CAF50" 
              />
              <Text style={styles.defaultAddressText}>Set as default address</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowAddAddressModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.saveAddressButton, loading && styles.saveAddressButtonDisabled]}
              onPress={saveNewAddress}
              disabled={loading || !newAddress.fullAddress.trim()}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveAddressButtonText}>Save Address</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 16,
    marginTop: 8,
  },
  servicesList: {
    marginBottom: 24,
  },
  serviceCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  serviceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  serviceTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    flex: 1,
  },
  servicePrice: {
    fontSize: 16,
    fontWeight: "600",
    color: "#4CAF50",
  },
  serviceDetails: {
    marginBottom: 12,
  },
  companyName: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  rating: {
    fontSize: 14,
    color: "#333",
    marginLeft: 4,
  },
  experience: {
    fontSize: 14,
    color: "#666",
    marginLeft: 4,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
  },
  verifiedText: {
    fontSize: 12,
    color: "#4CAF50",
    marginLeft: 2,
  },
  bookingInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  infoText: {
    fontSize: 14,
    color: "#666",
    marginLeft: 4,
  },
  issuesContainer: {
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    paddingTop: 12,
  },
  issuesTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
    marginBottom: 8,
  },
  issuesList: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  issueTag: {
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
    marginBottom: 4,
  },
  issueText: {
    fontSize: 12,
    color: "#666",
  },
  addOnButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#f0f9ff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#4CAF50",
    borderStyle: "dashed",
  },
  addOnButtonText: {
    fontSize: 13,
    color: "#4CAF50",
    fontWeight: "500",
    marginLeft: 6,
  },
  // Address Section Styles
  addressSection: {
    marginBottom: 24,
  },
  addressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  addAddressButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#f0f9ff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#4CAF50",
  },
  addAddressText: {
    fontSize: 14,
    color: "#4CAF50",
    fontWeight: "500",
    marginLeft: 4,
  },
  loadingAddressContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    backgroundColor: "#fff",
    borderRadius: 12,
  },
  loadingAddressText: {
    fontSize: 14,
    color: "#666",
    marginLeft: 8,
  },
  noAddressContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderStyle: "dashed",
  },
  noAddressTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginTop: 12,
    marginBottom: 4,
  },
  noAddressText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 16,
  },
  addFirstAddressButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4CAF50",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  addFirstAddressText: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "600",
    marginLeft: 4,
  },
  addressCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  addressCardSelected: {
    borderColor: "#4CAF50",
    backgroundColor: "#f8fff8",
  },
  addressCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  addressTypeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  addressType: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginLeft: 6,
  },
  defaultBadge: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  defaultText: {
    fontSize: 10,
    color: "#fff",
    fontWeight: "600",
  },
  addressText: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
    marginBottom: 4,
  },
  addressDetail: {
    fontSize: 12,
    color: "#666",
    marginBottom: 2,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    paddingTop: 50,
  },
  modalCloseButton: {
    padding: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formSection: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#333",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    minHeight: 44,
  },
  addressTypeOptions: {
    flexDirection: "row",
    gap: 12,
  },
  addressTypeOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    backgroundColor: "#fff",
  },
  addressTypeOptionSelected: {
    backgroundColor: "#4CAF50",
    borderColor: "#4CAF50",
  },
  addressTypeOptionText: {
    fontSize: 14,
    color: "#666",
    marginLeft: 6,
    fontWeight: "500",
  },
  addressTypeOptionTextSelected: {
    color: "#fff",
  },
  defaultAddressOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  defaultAddressText: {
    fontSize: 14,
    color: "#333",
    marginLeft: 8,
    fontWeight: "500",
  },
  modalFooter: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    backgroundColor: "#fff",
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    color: "#666",
    fontWeight: "500",
  },
  saveAddressButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#4CAF50",
    alignItems: "center",
  },
  saveAddressButtonDisabled: {
    backgroundColor: "#A5D6A7",
  },
  saveAddressButtonText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
  },
  summaryAddressValue: {
    fontSize: 12,
    color: "#666",
    textAlign: "right",
    flex: 1,
    marginLeft: 8,
  },
  notesSection: {
    marginBottom: 24,
  },
  notesInput: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#333",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    minHeight: 80,
  },
  paymentSection: {
    marginBottom: 24,
  },
  paymentOption: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  paymentOptionSelected: {
    borderColor: "#4CAF50",
    backgroundColor: "#f8fff8",
  },
  paymentOptionContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  cashIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFF3E0",
    justifyContent: "center",
    alignItems: "center",
  },
  onlineIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E8F5E8",
    justifyContent: "center",
    alignItems: "center",
  },
  paymentOptionTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  paymentOptionText: {
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
  paymentOptionSubtext: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  paymentNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#f0f9ff",
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#e0f2fe",
  },
  paymentNoteText: {
    fontSize: 12,
    color: "#2563eb",
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },
  cashPaymentNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFF8E1",
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#FFE0B2",
  },
  cashPaymentNoteText: {
    fontSize: 12,
    color: "#FF9800",
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },
  summarySection: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 100,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: "#666",
  },
  summaryValue: {
    fontSize: 14,
    color: "#333",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "#e0e0e0",
    marginVertical: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  totalValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  totalContainer: {
    flex: 1,
  },
  footerTotalLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  footerServiceCount: {
    fontSize: 14,
    color: "#666",
  },
  proceedButton: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  cashPayButton: {
    backgroundColor: "#FF9800",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  cashPayButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  onlinePayButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  proceedButtonDisabled: {
    backgroundColor: "#A5D6A7",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  proceedButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});