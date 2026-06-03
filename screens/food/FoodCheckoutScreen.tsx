import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView, StatusBar, FlatList, TextInput, Modal } from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { openRazorpayNative } from '@/utils/razorpayNative';
import { useFoodCart } from '@/context/FoodCartContext';
import { useLocationContext } from '@/context/LocationContext';
import { FirestoreService } from '@/services/firestoreService';
import { findNearestStore } from '@/utils/findNearestStore';
import PaymentMethodModal from '@/components/PaymentMethodModal';
import { Ionicons } from '@expo/vector-icons';

const RECOVERY_KEY = 'food_payment_recovery';
const FOOD_CART_STORAGE_KEY = '@food_cart_items';

const DEFAULT_FOOD_SETTINGS = {
  baseDeliveryCharge: 0,
  freeDeliveryAbove: 0,
  gstPercentage: 0,
  itemGstDefaultPercent: 0,
  packagingFee: 0,
  platformFee: 1,
  nightSurgeEnabled: true,
  nightSurgePercent: 0,
  nightSurgeFromHour: 0,
  nightSurgeToHour: 0,
};

// Set to true for internal test mode: everything zero except ₹1 platform fee.
// Disable this to validate the real online payment flow.
const TEST_MODE_ZERO_CHECKOUT = false;

export default function FoodCheckoutScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { clearCart } = useFoodCart();
  const { location, updateLocation } = useLocationContext();

  const params = route.params || {};
  const restaurantId = String(params.restaurantId || '');
  const items: any[] = params.items || [];
  const restaurantName: string = params.restaurantName || '';
  const restaurantImage = items[0]?.image || null;

  const [foodSettings, setFoodSettings] = useState<any | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);

  // Address management states
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [loadingAddresses, setLoadingAddresses] = useState(true);

  const [showPayModal, setShowPayModal] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paymentOverlayText, setPaymentOverlayText] = useState<string | null>(null);
  const [paymentVerifySlow, setPaymentVerifySlow] = useState(false);
  const paymentVerifySlowTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const itemCount = items.reduce((sum, item) => sum + (item.qty || 0), 0);
  const itemSubtotal = items.reduce((sum, item) => sum + (item.price || 0) * (item.qty || 0), 0);
  const addonsTotal = items.reduce((sum, item) => sum + ((item.addons || []).reduce((acc: number, addon: any) => acc + (addon.price ?? 0), 0) * (item.qty || 0)), 0);

  const bill = useMemo(() => {
    if (TEST_MODE_ZERO_CHECKOUT) {
      return { itemTotal: 0, addonsTotal: 0, totalGST: 0, deliveryFee: 0, packagingFee: 0, platformFee: 1, grandTotal: 1, baseDelivery: 0, nightSurge: 0, isNight: false };
    }
    const settings = foodSettings || DEFAULT_FOOD_SETTINGS;
    const itemTotal = itemSubtotal + addonsTotal;
    const baseDelivery = (settings.freeDeliveryAbove ?? 0) > 0 && itemTotal >= (settings.freeDeliveryAbove ?? 0)
      ? 0
      : (settings.baseDeliveryCharge ?? 0);
    const now = new Date();
    const isNight = settings.nightSurgeEnabled && (now.getHours() > (settings.nightSurgeFromHour ?? 22) || now.getHours() < (settings.nightSurgeToHour ?? 6));
    const nightSurge = isNight ? Math.round(baseDelivery * ((settings.nightSurgePercent ?? 0) / 100)) : 0;
    const deliveryFee = baseDelivery + nightSurge;
    const gstRate = ((settings.itemGstDefaultPercent ?? settings.gstPercentage ?? 5) / 100);
    const totalGST = Math.round(itemTotal * gstRate);
    const packagingFee = settings.packagingFee ?? 0;
    const platformFee = settings.platformFee ?? 0;
    const grandTotal = itemTotal + deliveryFee + totalGST + packagingFee + platformFee;
    return { itemTotal, addonsTotal, totalGST, deliveryFee, packagingFee, platformFee, grandTotal, baseDelivery, nightSurge, isNight };
  }, [foodSettings, itemSubtotal, addonsTotal]);

  const computedTotalAmount = TEST_MODE_ZERO_CHECKOUT ? 1 : bill.grandTotal;

  const LOG_PREFIX = '🧾[FoodPay]';
  const log = (...a: any[]) => { if (__DEV__) console.log(LOG_PREFIX, ...a); };
  const warn = (...a: any[]) => { if (__DEV__) console.warn(LOG_PREFIX, ...a); };

  useEffect(() => {
    const t = String(paymentOverlayText || '').toLowerCase();
    const isVerifyingPayment = t.includes('verifying payment');

    if (paymentVerifySlowTimerRef.current) {
      clearTimeout(paymentVerifySlowTimerRef.current);
      paymentVerifySlowTimerRef.current = null;
    }

    if (!isVerifyingPayment) {
      if (paymentVerifySlow) setPaymentVerifySlow(false);
      return;
    }

    setPaymentVerifySlow(false);
    paymentVerifySlowTimerRef.current = setTimeout(() => {
      setPaymentVerifySlow(true);
    }, 5000);

    return () => {
      if (paymentVerifySlowTimerRef.current) {
        clearTimeout(paymentVerifySlowTimerRef.current);
        paymentVerifySlowTimerRef.current = null;
      }
    };
  }, [paymentOverlayText]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadSavedAddresses();
    runRecoveryIfAny();
    fetchFoodOrderSettings();
  }, [restaurantId]);

  // Reload addresses whenever screen is focused (e.g., when returning from LocationSelector)
  useFocusEffect(
    React.useCallback(() => {
      loadSavedAddresses();
    }, [])
  );

  const fetchFoodOrderSettings = async () => {
    if (!restaurantId) {
      setFoodSettings(DEFAULT_FOOD_SETTINGS);
      setSettingsLoading(false);
      return;
    }
    try {
      const snapshot = await firestore().collection('foodOrderSettings').where('restaurantId', '==', restaurantId).limit(1).get();
      if (!snapshot.empty) {
        setFoodSettings(snapshot.docs[0].data());
      } else {
        setFoodSettings(DEFAULT_FOOD_SETTINGS);
      }
    } catch {
      console.warn('fetchFoodOrderSettings error');
      setFoodSettings(DEFAULT_FOOD_SETTINGS);
    } finally {
      setSettingsLoading(false);
    }
  };

  const loadSavedAddresses = async () => {
    try {
      setLoadingAddresses(true);
      const user = auth().currentUser;
      if (!user) {
        setSavedAddresses([]);
        setLoadingAddresses(false);
        return;
      }
      const addrs = await FirestoreService.getUserSavedAddresses();
      setSavedAddresses(addrs || []);
      
      // Auto-select logic:
      // 1. If there's a default address, select it
      // 2. Otherwise select the first address
      // 3. If no address was previously selected, select the first one
      const defaultAddr = (addrs || []).find((a: any) => a.isDefault);
      const firstAddr = addrs?.[0];
      
      // If we already have a selected address and it still exists, keep it
      if (selectedAddressId && (addrs || []).find((a: any) => a.id === selectedAddressId)) {
        // Keep current selection
        return;
      }
      
      // Otherwise select default or first
      if (defaultAddr) {
        setSelectedAddressId(defaultAddr.id);
      } else if (firstAddr) {
        setSelectedAddressId(firstAddr.id);
      } else {
        setSelectedAddressId(null);
      }
    } catch (e) {
      console.warn('loadSavedAddresses', e);
      setSavedAddresses([]);
    } finally {
      setLoadingAddresses(false);
    }
  };

  const getSelectedAddress = () => savedAddresses.find(a => a.id === selectedAddressId) ?? null;

  const deleteAddress = async (addressId: string) => {
    try {
      await FirestoreService.deleteUserAddress(addressId);
      await loadSavedAddresses();
      
      // If we deleted the selected address, select another one
      if (selectedAddressId === addressId) {
        const remainingAddresses = await FirestoreService.getUserSavedAddresses();
        if (remainingAddresses.length > 0) {
          setSelectedAddressId(remainingAddresses[0].id);
        } else {
          setSelectedAddressId(null);
        }
      }
    } catch (error) {
      console.error('Error deleting address:', error);
      Alert.alert('Error', 'Failed to delete address');
    }
  };

  // Geocoding removed: use LocationSelector screen to obtain coordinates directly.

  const ensureDeliverableOrAlert = async (): Promise<boolean> => {
    let lat = Number(location?.lat);
    let lng = Number(location?.lng);
    
    // Require explicit location selection via LocationSelector when coordinates are missing.
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      Alert.alert('Location Required', 'Please select your location before checkout.', [
        { text: 'Select', onPress: () => navigation.navigate('LocationSelector', { fromScreen: 'FoodCheckout', isSelectingDeliveryAddress: true }) },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return false;
    }
    try {
      const nearest = await findNearestStore(lat, lng);
      if (!nearest) {
        Alert.alert('Unavailable', 'We don\'t deliver to this location yet. Please try another address.');
        return false;
      }
      if (location?.storeId !== nearest.id) {
        updateLocation({ storeId: nearest.id, lat, lng, grocery: nearest.grocery, food: nearest.food, services: nearest.services });
      }
      return true;
    } catch (error) {
      console.error('Store availability check failed:', error);
      Alert.alert('Error', 'Couldn\'t validate location. Please try again.');
      return false;
    }
  };

  // Recovery flow: reconcile any previously created Razorpay order using Firestore only.
  const runRecoveryIfAny = async () => {
    try {
      const raw = await AsyncStorage.getItem(RECOVERY_KEY);
      if (!raw) return;
      const recovery = JSON.parse(raw);
      if (!recovery?.firestoreOrderId) return;
      const firestoreOrderId = String(recovery.firestoreOrderId);
      log('recovery_found', { firestoreOrderId, recovery });

      const docRef = firestore().collection('restaurant_Orders').doc(firestoreOrderId);
      const snap = await docRef.get();
      const docData = snap.exists ? (snap.data() as any) : null;
      const docPaid = !!(
        docData &&
        (
          (docData.payment && docData.payment.status === 'paid') ||
          docData.paymentStatus === 'paid'
        )
      );

      if (docPaid) {
        log('recovery_doc_already_paid', { firestoreOrderId });
        await AsyncStorage.removeItem(RECOVERY_KEY);
        await AsyncStorage.removeItem(FOOD_CART_STORAGE_KEY).catch(() => { });
        clearCart();
        const grandTotal = docData?.grandTotal ?? docData?.subtotal ?? null;
        const restaurantName = docData?.restaurantName ?? null;
        if (grandTotal != null) {
          navigation.reset({ index: 0, routes: [{ name: 'FoodOrderSuccess', params: { grandTotal, restaurantName, orderId: firestoreOrderId } }] });
        } else {
          navigation.reset({ index: 0, routes: [{ name: 'FoodOrderHistory' }] });
        }
      }
    } catch (e) {
      warn('recovery_failed', e);
    }
  };

  const getRestaurantLocationFromRegister = async () => {
    if (!restaurantId) return null;
    try {
      const doc = await firestore().collection('registerRestaurant').doc(restaurantId).get();
      if (!doc.exists) return null;
      const data = doc.data() as any;
      return {
        restaurantId,
        restaurantName: data?.restaurantName || restaurantName || null,
        address: data?.address || null,
        latitude: data?.lat ?? data?.latitude ?? null,
        longitude: data?.lng ?? data?.longitude ?? null,
      };
    } catch (e) {
      console.warn('fetchRegisterRestaurantLocation', e);
      return null;
    }
  };

  const onSelectOnline = async () => {
    const selectedAddress = getSelectedAddress();
    if (!selectedAddress?.fullAddress) {
      setShowAddressModal(true);
      return;
    }
    const ok = await ensureDeliverableOrAlert();
    if (!ok) return;
    setShowPayModal(false);
    await handleRazorpayPayment();
  };

  const handleRazorpayPayment = async () => {
    log('razorpay_start', { computedTotalAmount, itemsCount: items.length });
    setPaymentOverlayText('Initializing payment…');
    setLoading(true);
    try {
      const api = axios.create({ timeout: 20000, headers: { 'Content-Type': 'application/json' } });
      const CLOUD_FUNCTIONS_BASE_URL = 'https://asia-south1-ninjadeliveries-91007.cloudfunctions.net';
      const CLOUD_FUNCTIONS_BASE_URL_USC1 = 'https://us-central1-ninjadeliveries-91007.cloudfunctions.net';
      const httpUrl = (fn: string, base = CLOUD_FUNCTIONS_BASE_URL) => `${base}/${fn}`;

      const callableUrl = (fnName: string, base = CLOUD_FUNCTIONS_BASE_URL) => `${base}/${fnName}:call`;
      const postWith404Fallback = async (fnName: string, body: any, headers: any) => {
        try {
          return await api.post(httpUrl(fnName), body, { headers });
        } catch (e: any) {
          const status = e?.response?.status;
          const httpsOnly = fnName === 'createRazorpayOrder' || fnName === 'verifyRazorpayPayment' || fnName === 'updateOrderAfterPayment' || fnName === 'checkPaymentStatus';

          if (status === 404) {
            return await api.post(httpUrl(fnName, CLOUD_FUNCTIONS_BASE_URL_USC1), body, { headers });
          }

          if (!httpsOnly && (status === 401 || status === 403)) {
            const resp = await api.post(callableUrl(fnName), { data: body }, { headers });
            const unwrapped = resp?.data?.result ?? resp?.data;
            return { ...resp, data: unwrapped };
          }

          throw e;
        }
      };

      const getAuthHeaders = async (opts?: { forceRefresh?: boolean }) => {
        const user = auth().currentUser;
        if (!user) throw new Error('Not logged in');
        const token = await user.getIdToken(!!opts?.forceRefresh);
        return { Authorization: `Bearer ${token}`, __session: token, 'Content-Type': 'application/json' };
      };

      const stripUndefinedDeep = (value: any): any => {
        if (Array.isArray(value)) return value.map(stripUndefinedDeep).filter(v => v !== undefined);
        if (value && typeof value === 'object') {
          const out: any = {};
          Object.keys(value).forEach(k => {
            const v = stripUndefinedDeep(value[k]);
            if (v !== undefined) out[k] = v;
          });
          return out;
        }
        return value === undefined ? undefined : value;
      };

      const toPaise = (amt: number) => Math.round(Number(amt) * 100);

      // Create Razorpay order via backend and persist a recovery snapshot.
      setPaymentOverlayText('Creating payment order…');
      const user = auth().currentUser;
      if (!user) throw new Error('Not logged in');
      const amountPaise = toPaise(computedTotalAmount);
      if (amountPaise <= 0) {
        warn('payment_amount_zero', { amountPaise, computedTotalAmount, TEST_MODE_ZERO_CHECKOUT });
      }
      const headers = await getAuthHeaders();
      const selectedAddress = getSelectedAddress();
      const restaurantLocation = await getRestaurantLocationFromRegister();
      const orderData: any = stripUndefinedDeep({
        orderedBy: user.uid,
        userId: user.uid,
        userPhone: user.phoneNumber || '',
        restaurantId,
        restaurantName,
        restaurantLocation,
        items: items.map(it => ({ id: it.id, name: it.name, qty: it.qty, price: it.price, addons: it.addons || [] })),
        subtotal: bill.itemTotal,
        grandTotal: bill.grandTotal,
        paymentMethod: 'online',
        deliveryAddress: selectedAddress?.fullAddress || location.address || '',
        deliveryLocation: { lat: location.lat ?? null, lng: location.lng ?? null },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const rzpReq = {
        amountPaise,
        currency: 'INR',
        receipt: `food_${user.uid}_${Date.now()}`,
        notes: { uid: user.uid, type: 'food_order' },
        orderData,
      };
      log('rzp_order_request', rzpReq);
      const { data } = await postWith404Fallback('createRazorpayOrder', rzpReq, headers);
      if (!data?.orderId || !data?.keyId) throw new Error(data?.error || 'Failed to create Razorpay order');
      const firestoreOrderId = String(data.firestoreOrderId || '');
      if (!firestoreOrderId) {
        throw new Error('Backend order creation failed');
      }
      await firestore()
        .collection('restaurant_Orders')
        .doc(firestoreOrderId)
        .set({
          orderId: firestoreOrderId,
          status: 'pending',
          paymentStatus: 'pending',
          paymentMethod: 'online',
          suppressNotifications: true,
          notificationReady: false,
        }, { merge: true });
      await AsyncStorage.setItem(RECOVERY_KEY, JSON.stringify({ razorpayOrderId: String(data.orderId), firestoreOrderId, createdAt: Date.now() }));

      // Open native Razorpay checkout
      setPaymentOverlayText('Opening payment gateway…');
      try {
        const nativeRes = await openRazorpayNative({ key: data.keyId, order_id: String(data.orderId), amount: String(amountPaise), currency: 'INR', name: restaurantName || 'Ninja', description: 'Food Order', prefill: { contact: user.phoneNumber || undefined } });
        log('razorpay_native_success', nativeRes);

        // Verify payment signature
        setPaymentOverlayText('Verifying payment…');
        const verifyResp = await postWith404Fallback(
          'verifyRazorpayPayment',
          { ...nativeRes },
          headers
        );
        const verifyData = verifyResp?.data ?? verifyResp;
        if (!verifyData?.verified) {
          throw new Error(verifyData?.error || 'Payment verification failed');
        }
        // Mandatory: remove recovery snapshot and clear cart immediately after successful verification.
        try {
          await AsyncStorage.removeItem(RECOVERY_KEY);
          await AsyncStorage.removeItem(FOOD_CART_STORAGE_KEY).catch(() => { });
        } catch (e) {
          warn('remove_recovery_failed', e);
        }
        clearCart();

        if (firestoreOrderId) {
          await postWith404Fallback(
            'updateOrderAfterPayment',
            {
              firestoreOrderId,
              razorpay_order_id: nativeRes.razorpay_order_id,
              razorpay_payment_id: nativeRes.razorpay_payment_id,
              razorpay_signature: nativeRes.razorpay_signature,
            },
            headers
          );
        }

        await firestore().collection('restaurant_Orders').doc(firestoreOrderId).set({
          status: 'paid',
          paymentStatus: 'paid',
          razorpayOrderId: String(data.orderId),
          razorpayPaymentId: nativeRes.razorpay_payment_id,
          razorpaySignature: nativeRes.razorpay_signature,
          // remove suppression so notifications can be sent now
          suppressNotifications: firestore.FieldValue.delete(),
          notificationReady: true,
          paidAt: firestore.FieldValue.serverTimestamp(),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        navigation.reset({ index: 0, routes: [{ name: 'FoodOrderSuccess', params: { grandTotal: computedTotalAmount, restaurantName, orderId: firestoreOrderId } }] });
      } catch (nativeErr: any) {
        // Native checkout failed or unavailable — leave recovery in place and show error
        warn('razorpay_native_failed', nativeErr);
        Alert.alert('Payment Failed', nativeErr?.message || 'Payment was not completed. Please try again.');
      }

    } catch (e: any) {
      console.error('PaymentError', e);
      Alert.alert('Payment Error', e?.message || 'Unable to complete payment.');
    } finally {
      setPaymentOverlayText(null);
      setLoading(false);
    }
  };

  const placeCashOrder = async () => {
    try {
      const user = auth().currentUser;
      if (!user) {
        setShowPayModal(false);
        navigation.navigate('LoginInHomeStack' as never);
        return;
      }
      const selectedAddress = getSelectedAddress();
      if (!selectedAddress?.fullAddress) {
        setShowAddressModal(true);
        return;
      }
      const ok = await ensureDeliverableOrAlert();
      if (!ok) return;
      setLoading(true);
      const orderRef = firestore().collection('restaurant_Orders').doc();
      const restaurantLocation = await getRestaurantLocationFromRegister();
      const orderData: any = {
        orderedBy: user.uid,
        userId: user.uid,
        userPhone: user.phoneNumber || '',
        restaurantId,
        restaurantName,
        restaurantLocation,
        items,
        subtotal: computedTotalAmount,
        grandTotal: computedTotalAmount,
        paymentMethod: 'Cash on Delivery',
        paymentStatus: 'pending',
        deliveryAddress: selectedAddress.fullAddress,
        deliveryLocation: { lat: location.lat ?? null, lng: location.lng ?? null },
        status: 'pending',
        createdAt: firestore.FieldValue.serverTimestamp(),
        orderId: orderRef.id,
      };
      await orderRef.set(orderData);
      await AsyncStorage.removeItem(FOOD_CART_STORAGE_KEY).catch(() => { });
      clearCart();
      navigation.reset({ index: 0, routes: [{ name: 'FoodOrderSuccess', params: { grandTotal: computedTotalAmount, restaurantName, orderId: orderRef.id } }] });
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={false} />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButtonAbsolute}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Food Checkout</Text>
          <Text style={styles.headerSubtitle}>Review and pay for your order</Text>
        </View>
        <View style={styles.rightPlaceholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.orderHeader}>
          <View style={styles.orderImageWrap}>
            {restaurantImage ? (
              <Image source={{ uri: restaurantImage }} style={styles.orderImage} contentFit="cover" />
            ) : (
              <View style={styles.placeholderImage}>
                <Ionicons name="fast-food-outline" size={28} color="#fff" />
              </View>
            )}
          </View>
          <View style={styles.orderInfo}>
            <Text style={styles.orderTitle}>{restaurantName}</Text>
            <Text style={styles.orderSubtitle}>{itemCount} item{itemCount === 1 ? '' : 's'}</Text>
            <Text style={styles.orderSubtitle}>Estimated total ₹{bill.grandTotal}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Items</Text>
        <View style={styles.itemsSection}>
          {items.map(i => (
            <View key={i.id} style={styles.itemRow}>
              <Text style={styles.itemName}>{i.name} × {i.qty}</Text>
              <Text style={styles.itemPrice}>₹{(i.price || 0) * (i.qty || 0)}</Text>
            </View>
          ))}
        </View>

        {/* Delivery Address Section */}
        <View style={styles.addressSection}>
          <View style={styles.addressHeader}>
            <Text style={styles.sectionTitle}>Delivery Address</Text>
            <TouchableOpacity
              style={styles.addAddressButton}
              onPress={() => navigation.navigate('LocationSelector' as never, { fromScreen: 'FoodCheckout', isSelectingDeliveryAddress: true } as never)}
            >
              <Ionicons name="add-circle-outline" size={20} color="#FF6B35" />
              <Text style={styles.addAddressText}>Add New</Text>
            </TouchableOpacity>
          </View>

          {loadingAddresses ? (
            <View style={styles.loadingAddressContainer}>
              <ActivityIndicator size="small" color="#FF6B35" />
              <Text style={styles.loadingAddressText}>Loading addresses...</Text>
            </View>
          ) : savedAddresses.length === 0 ? (
            <View style={styles.noAddressContainer}>
              <Ionicons name="location-outline" size={48} color="#ccc" />
              <Text style={styles.noAddressTitle}>No Saved Addresses</Text>
              <Text style={styles.noAddressText}>Add your first address to continue</Text>
              <TouchableOpacity
                style={styles.addFirstAddressButton}
                onPress={() => navigation.navigate('LocationSelector' as never, { fromScreen: 'FoodCheckout', isSelectingDeliveryAddress: true } as never)}
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
                        color="#FF6B35"
                      />
                      <Text style={styles.addressType}>{item.addressType}</Text>
                      {item.isDefault && (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultText}>Default</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.addressCardActions}>
                      {selectedAddressId === item.id && (
                        <Ionicons name="checkmark-circle" size={20} color="#FF6B35" />
                      )}
                      <TouchableOpacity
                        onPress={() => deleteAddress(item.id)}
                        style={styles.deleteAddressButton}
                      >
                        <Ionicons name="trash-outline" size={18} color="#FF6B35" />
                      </TouchableOpacity>
                    </View>
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

        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>Order Summary</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Items ({itemCount})</Text>
            <Text style={styles.summaryValue}>₹{bill.itemTotal}</Text>
          </View>

          {bill.addonsTotal > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Add-ons</Text>
              <Text style={styles.summaryValue}>₹{bill.addonsTotal}</Text>
            </View>
          )}

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>GST</Text>
            <Text style={styles.summaryValue}>₹{bill.totalGST}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery</Text>
            <Text style={styles.summaryValue}>{bill.deliveryFee === 0 ? 'FREE' : `₹${bill.deliveryFee}`}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Packaging</Text>
            <Text style={styles.summaryValue}>₹{bill.packagingFee}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Platform Fee</Text>
            <Text style={styles.summaryValue}>₹{bill.platformFee}</Text>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>₹{bill.grandTotal}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.totalContainer}>
          <Text style={styles.footerTotalLabel}>Total: ₹{computedTotalAmount}</Text>
          <Text style={styles.footerItemCount}>{itemCount} item{itemCount > 1 ? 's' : ''}</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.proceedButton,
            (settingsLoading || loading) && styles.proceedButtonDisabled
          ]}
          onPress={() => setShowPayModal(true)}
          disabled={settingsLoading || loading}
        >
          {settingsLoading || loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.proceedButtonText}>
                Processing...
              </Text>
            </View>
          ) : (
            <View style={styles.payButtonContent}>
              <Ionicons name="card-outline" size={20} color="#fff" />
              <Text style={styles.proceedButtonText}>Place Order</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <PaymentMethodModal
        visible={showPayModal}
        onClose={() => setShowPayModal(false)}
        onSelectOnline={onSelectOnline}
        onSelectCOD={async () => {
          setShowPayModal(false);
          await placeCashOrder();
        }}
        totalAmount={computedTotalAmount}
        loading={loading}
      />

      {/* Address Required Modal */}
      <Modal
        visible={showAddressModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowAddressModal(false)}
      >
        <View style={styles.addressModalOverlay}>
          <View style={styles.addressModalContent}>
            <View style={styles.addressModalIconContainer}>
              <Ionicons name="location-outline" size={48} color="#FF6B35" />
            </View>
            <Text style={styles.addressModalTitle}>Address Required</Text>
            <Text style={styles.addressModalText}>
              Please select or add a delivery address to continue with your order
            </Text>
            <View style={styles.addressModalButtons}>
              <TouchableOpacity
                style={styles.addressModalCancelBtn}
                onPress={() => setShowAddressModal(false)}
              >
                <Text style={styles.addressModalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addressModalAddBtn}
                onPress={() => {
                  setShowAddressModal(false);
                  navigation.navigate('LocationSelector' as never, { fromScreen: 'FoodCheckout', isSelectingDeliveryAddress: true } as never);
                }}
              >
                <Text style={styles.addressModalAddBtnText}>Add Address</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Full-screen payment loader */}
      {!!paymentOverlayText && (
        <View style={styles.paymentOverlay}>
          <View style={styles.paymentOverlayCard}>
            <ActivityIndicator size="large" color="#FF6B35" />
            <Text style={styles.paymentOverlayText}>
              {paymentVerifySlow
                ? 'It is taking longer than expected please wait.'
                : paymentOverlayText}
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
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
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    position: 'relative',
  },
  backButton: {
    padding: 8,
  },
  backButtonAbsolute: {
    position: 'absolute',
    left: 12,
    padding: 8,
    zIndex: 2,
  },
  rightPlaceholder: {
    position: 'absolute',
    right: 12,
    width: 44,
    height: 44,
  },
  headerTextContainer: {
    alignItems: 'center',
    paddingHorizontal: 56,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111",
    textAlign: 'center',
    marginHorizontal: 8,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },

  paymentOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    elevation: 999,
    backgroundColor: 'rgba(0,0,0,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  paymentOverlayCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  paymentOverlayText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111",
    marginBottom: 12,
    marginTop: 8,
  },

  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  orderImageWrap: {
    width: 88,
    height: 88,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#FF6B35',
  },
  orderImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FF6B35',
  },
  orderInfo: {
    flex: 1,
    marginLeft: 14,
  },
  orderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  orderSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },

  itemsSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  itemName: {
    flex: 1,
    fontSize: 14,
    color: '#1A1A1A',
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
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
    paddingHorizontal: 2,
  },
  addAddressButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: "#FF6B35",
    borderRadius: 8,
    gap: 6,
    shadowColor: "#FF6B35",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  addAddressText: {
    fontSize: 13,
    color: "#fff",
    fontWeight: "600",
  },
  loadingAddressContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  loadingAddressText: {
    fontSize: 14,
    color: "#999",
    marginLeft: 10,
    fontWeight: "500",
  },
  noAddressContainer: {
    backgroundColor: "#fafafa",
    borderRadius: 12,
    padding: 28,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#ffe4d6",
    borderStyle: "dashed",
  },
  noAddressTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginTop: 12,
    marginBottom: 6,
  },
  noAddressText: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 18,
  },
  addFirstAddressButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF6B35",
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 8,
    gap: 6,
    shadowColor: "#FF6B35",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  addFirstAddressText: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "600",
  },
  addressCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#f0f0f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  addressCardSelected: {
    borderColor: "#FF6B35",
    backgroundColor: "#fffbf8",
    shadowColor: "#FF6B35",
    shadowOpacity: 0.12,
  },
  addressCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  addressCardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  deleteAddressButton: {
    padding: 6,
    marginLeft: 4,
  },
  addressTypeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  addressType: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FF6B35",
  },
  defaultBadge: {
    backgroundColor: "#FFF5F0",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#FFD4BE",
  },
  defaultText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FF6B35",
    letterSpacing: 0.3,
  },
  addressText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1A1A1A",
    lineHeight: 20,
    marginBottom: 8,
  },
  addressDetail: {
    fontSize: 12,
    color: "#666",
    marginTop: 3,
    lineHeight: 18,
  },

  summarySection: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: "#666",
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "#f0f0f0",
    marginVertical: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FF6B35",
  },

  footer: {
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: "#eef1f5",
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalContainer: { marginBottom: 0, flex: 1 },
  footerTotalLabel: { fontSize: 16, fontWeight: '700', color: '#111' },
  footerItemCount: { fontSize: 11, color: '#666', marginTop: 2 },
  proceedButton: { backgroundColor: '#FF6B35', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', minWidth: 140, shadowColor: '#FF6B35', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.22, shadowRadius: 10, elevation: 6 },
  proceedButtonDisabled: { backgroundColor: '#FBBF93' },
  loadingContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  payButtonContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  proceedButtonText: { fontSize: 15, fontWeight: '700', color: '#fff' },

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
  },
  modalCloseButton: {
    padding: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 16,
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
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#333",
  },
  addressTypeOptions: {
    flexDirection: "row",
    gap: 12,
  },
  addressTypeOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  addressTypeOptionSelected: {
    backgroundColor: "#FF6B35",
    borderColor: "#FF6B35",
  },
  addressTypeOptionText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  addressTypeOptionTextSelected: {
    color: "#fff",
  },
  defaultAddressOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  defaultAddressText: {
    fontSize: 14,
    color: "#333",
  },
  modalFooter: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    paddingBottom: 24,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  cancelButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  saveAddressButton: {
    flex: 2,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    backgroundColor: "#FF6B35",
    borderRadius: 8,
  },
  saveAddressButtonDisabled: {
    backgroundColor: "#FBBF93",
  },
  saveAddressButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  addressModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  addressModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  addressModalIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff5f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  addressModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 10,
    textAlign: 'center',
  },
  addressModalText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  addressModalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  addressModalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    alignItems: 'center',
  },
  addressModalCancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  addressModalAddBtn: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    alignItems: 'center',
  },
  addressModalAddBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  addressSuccessModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  addressSuccessModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  addressSuccessModalIconContainer: {
    marginBottom: 20,
  },
  addressSuccessModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
    textAlign: 'center',
  },
  addressSuccessModalText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 22,
  },
  addressSuccessModalBtn: {
    width: '100%',
    paddingVertical: 14,
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    alignItems: 'center',
  },
  addressSuccessModalBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
