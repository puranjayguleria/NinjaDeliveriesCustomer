// ✅ Updated to fetch settings from 'foodOrderSettings' collection (similar to grocery 'orderSetting')
// ✅ Settings are fetched based on restaurantId (where restaurantId == currentRestaurantId)
// ✅ Structure matches grocery orderSetting with fields like: additionalCostPerKm, baseDeliveryCharge, 
//    distanceThreshold, gstPercentage, platformFee, surgeFee, weatherThreshold, fixedPickupLocation, etc.

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, StatusBar, Animated, Modal, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useFoodCart } from '@/context/FoodCartContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useLocationContext } from '@/context/LocationContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import PaymentMethodModal from '@/components/PaymentMethodModal';

type MenuItem = {
  id: string;
  name: string;
  price: number;
  image?: string;
  description?: string;
  category?: string;
  isVeg?: boolean;
  restaurantId?: string;
  restaurantName?: string;
};

const ORANGE    = '#FF6B35';
const ORANGE_LT = '#FFF3EE';
const ORANGE_DK = '#E85A28';
const DARK      = '#1A1D2E';
const DARK2     = '#2D3142';
const GRAY      = '#8A8FA8';
const GRAY_LT   = '#F8F9FC';
const GREEN     = '#22C55E';
const GREEN_LT  = '#F0FDF4';
const RED       = '#EF4444';
const WHITE     = '#FFFFFF';
const BORDER    = '#E8EBF3';
const FOOTER_H  = 76;

type PaymentMethod = 'Cash on Delivery' | 'UPI';

type FoodOrderSettings = {
  additionalCostPerKm: number;
  badWeather: boolean;
  baseDeliveryCharge: number;
  distanceThreshold: number;
  gstPercentage: number;
  platformFee: number;
  restaurantId?: string;
  surgeFee: number;
  weatherFromApi: boolean;
  fixedPickupLocation?: {
    address: string;
    coordinates: {
      latitude: string;
      longitude: string;
    };
    name: string;
  };
  weatherThreshold?: {
    precipMmPerHr: number;
    windSpeedKph: number;
  };
  // Keep some existing fields for backward compatibility
  freeDeliveryAbove?: number;
  packagingFee?: number;
  itemGstDefaultPercent?: number;
  highGstPercent?: number;
  nightSurgeEnabled?: boolean;
  nightSurgePercent?: number;
  nightSurgeFromHour?: number;
  nightSurgeToHour?: number;
};

const DEFAULT_FOOD_ORDER_SETTINGS: FoodOrderSettings = {
  additionalCostPerKm: 8,
  badWeather: false,
  baseDeliveryCharge: 5,
  distanceThreshold: 0,
  gstPercentage: 5,
  platformFee: 1,
  surgeFee: 10,
  weatherFromApi: false,
  // Backward compatibility defaults
  freeDeliveryAbove: 199,
  packagingFee: 20,
  itemGstDefaultPercent: 5,
  highGstPercent: 18,
  nightSurgeEnabled: true,
  nightSurgePercent: 10,
  nightSurgeFromHour: 22,
  nightSurgeToHour: 6,
};

const numberOrDefault = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeFoodOrderSettings = (
  data?: Partial<FoodOrderSettings> | null,
  base: FoodOrderSettings = DEFAULT_FOOD_ORDER_SETTINGS
): FoodOrderSettings => ({
  additionalCostPerKm: numberOrDefault(data?.additionalCostPerKm, base.additionalCostPerKm ?? 8),
  badWeather: typeof data?.badWeather === 'boolean' ? data.badWeather : (base.badWeather ?? false),
  baseDeliveryCharge: numberOrDefault(data?.baseDeliveryCharge, base.baseDeliveryCharge ?? 5),
  distanceThreshold: numberOrDefault(data?.distanceThreshold, base.distanceThreshold ?? 0),
  gstPercentage: numberOrDefault(data?.gstPercentage, base.gstPercentage ?? 5),
  platformFee: numberOrDefault(data?.platformFee, base.platformFee ?? 1),
  restaurantId: data?.restaurantId ?? base.restaurantId,
  surgeFee: numberOrDefault(data?.surgeFee, base.surgeFee ?? 10),
  weatherFromApi: typeof data?.weatherFromApi === 'boolean' ? data.weatherFromApi : (base.weatherFromApi ?? false),
  fixedPickupLocation: data?.fixedPickupLocation ?? base.fixedPickupLocation,
  weatherThreshold: data?.weatherThreshold ?? base.weatherThreshold,
  // Backward compatibility
  freeDeliveryAbove: numberOrDefault(data?.freeDeliveryAbove, base.freeDeliveryAbove ?? 199),
  packagingFee: numberOrDefault(data?.packagingFee, base.packagingFee ?? 20),
  itemGstDefaultPercent: numberOrDefault(data?.itemGstDefaultPercent, base.itemGstDefaultPercent ?? 5),
  highGstPercent: numberOrDefault(data?.highGstPercent, base.highGstPercent ?? 18),
  nightSurgeEnabled: typeof data?.nightSurgeEnabled === 'boolean' ? data.nightSurgeEnabled : (base.nightSurgeEnabled ?? true),
  nightSurgePercent: numberOrDefault(data?.nightSurgePercent, base.nightSurgePercent ?? 10),
  nightSurgeFromHour: numberOrDefault(data?.nightSurgeFromHour, base.nightSurgeFromHour ?? 22),
  nightSurgeToHour: numberOrDefault(data?.nightSurgeToHour, base.nightSurgeToHour ?? 6),
});

const isHourInWindow = (hour: number, fromHour: number, toHour: number) => {
  if (fromHour === toHour) return true;
  if (fromHour < toHour) return hour >= fromHour && hour < toHour;
  return hour >= fromHour || hour < toHour;
};

export default function FoodCartScreen() {
  const navigation = useNavigation<any>();
  const insets     = useSafeAreaInsets();
  const { cartItems, addItem, removeItem, totalItems, totalPrice, clearCart } = useFoodCart();
  const { location } = useLocationContext();

  const [placing, setPlacing]                  = useState(false);
  const [showPayModal, setShowPayModal]         = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showLoginModal, setShowLoginModal]     = useState(false);
  const [deliveryAddress, setDeliveryAddress]   = useState(location?.address || '');
  const [isScheduled, setIsScheduled]           = useState(false);
  const [scheduledDate, setScheduledDate]       = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker]     = useState(false);
  const [showTimePicker, setShowTimePicker]     = useState(false);
  const [relatedItems, setRelatedItems]         = useState<MenuItem[]>([]);
  const [loadingRelated, setLoadingRelated]     = useState(false);
  const [foodSettings, setFoodSettings]         = useState<FoodOrderSettings>(DEFAULT_FOOD_ORDER_SETTINGS);

  useEffect(() => { if (location?.address) setDeliveryAddress(location.address); }, [location]);

  const currentRestaurantId = cartItems[0]?.restaurantId ?? null;

  useEffect(() => {
    if (!currentRestaurantId) {
      setFoodSettings(DEFAULT_FOOD_ORDER_SETTINGS);
      return;
    }

    // ✅ Real-time listener for foodOrderSettings (updates automatically without reload)
    console.log(`🔥 Setting up real-time listener for restaurant: ${currentRestaurantId}`);
    
    const unsubscribe = firestore()
      .collection('foodOrderSettings')
      .where('restaurantId', '==', currentRestaurantId)
      .limit(1)
      .onSnapshot(
        (snapshot) => {
          if (!snapshot.empty && snapshot.docs[0].exists) {
            const data = snapshot.docs[0].data() as Partial<FoodOrderSettings>;
            const nextSettings = normalizeFoodOrderSettings(data);
            setFoodSettings(nextSettings);
            console.log(`✅ Real-time update: Settings loaded for ${currentRestaurantId}`);
          } else {
            console.warn('No foodOrderSettings found for restaurant', currentRestaurantId);
            setFoodSettings(DEFAULT_FOOD_ORDER_SETTINGS);
          }
        },
        (error) => {
          console.error('Error in foodOrderSettings listener:', error);
          setFoodSettings(DEFAULT_FOOD_ORDER_SETTINGS);
        }
      );

    // Cleanup listener when component unmounts or restaurantId changes
    return () => {
      console.log(`🔥 Cleaning up listener for restaurant: ${currentRestaurantId}`);
      unsubscribe();
    };
  }, [currentRestaurantId]);

  // Fetch related items from the same restaurant
  useEffect(() => {
    const fetchRelatedItems = async () => {
      if (cartItems.length === 0) return;
      const restaurantId = cartItems[0]?.restaurantId;
      if (!restaurantId) return;

      setLoadingRelated(true);
      try {
        const snapshot = await firestore()
          .collection('restaurants')
          .doc(restaurantId)
          .collection('menuItems')
          .limit(6)
          .get();

        const items: MenuItem[] = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          // Exclude items already in cart
          const inCart = cartItems.some(ci => ci.id === doc.id);
          if (!inCart) {
            items.push({
              id: doc.id,
              name: data.name || '',
              price: data.price || 0,
              image: data.image || null,
              description: data.description || null,
              category: data.category || null,
              isVeg: data.isVeg ?? true,
              restaurantId: restaurantId,
              restaurantName: cartItems[0]?.restaurantName || '',
            });
          }
        });
        setRelatedItems(items.slice(0, 4));
      } catch (err) {
        console.error('Error fetching related items:', err);
      } finally {
        setLoadingRelated(false);
      }
    };

    fetchRelatedItems();
  }, [cartItems]);

  const arrowAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(arrowAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(arrowAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const arrowTranslateX = arrowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 4],
  });

  // Bill calculations
  const itemsSubtotal  = cartItems.reduce((sum, item) => sum + item.price * item.qty, 0);
  const addonsSubtotal = cartItems.reduce((sum, item) =>
    sum + (item.addons || []).reduce((a, addon) => a + addon.price, 0) * item.qty, 0);
  
  // Surge charges from foodSetting
  const surgeCharge = foodSettings.surgeFee;
  
  // Delivery fee calculation (can be enhanced with distance-based calculation later)
  const deliveryFee = (foodSettings.freeDeliveryAbove ?? 0) > 0 && totalPrice >= (foodSettings.freeDeliveryAbove ?? 0)
    ? 0 
    : foodSettings.baseDeliveryCharge;
  
  // GST calculation using gstPercentage from foodSetting
  const gstRatePercent = (foodSettings.itemGstDefaultPercent ?? foodSettings.gstPercentage);
  const gstRate = gstRatePercent / 100;
  const itemsGST = Math.round(totalPrice * gstRate);
  const deliveryGST = deliveryFee > 0 ? Math.round((deliveryFee * foodSettings.gstPercentage) / 100) : 0;
  const totalGST = itemsGST + deliveryGST;
  
  const platformFee  = foodSettings.platformFee;
  const packagingFee = foodSettings.packagingFee ?? 0;
  const grandTotal   = totalPrice + surgeCharge + deliveryFee + totalGST + platformFee + packagingFee;
  const footerH      = FOOTER_H + (insets.bottom > 0 ? insets.bottom : 16);

  // Delivery time estimate
  const maxCookingMins = cartItems.reduce((max, item) => {
    const total = Number((item as any).cookingTimeHours ?? 0) * 60 + Number((item as any).cookingTimeMinutes ?? 0);
    return total > max ? total : max;
  }, 0);
  const itemCount = cartItems.reduce((sum, item) => sum + (item.qty ?? 1), 0);
  const extraBuffer = itemCount > 1 ? (itemCount - 1) * 5 : 0;
  const estimatedDeliveryMins = maxCookingMins > 0
    ? maxCookingMins + extraBuffer + 10
    : itemCount > 1 ? 35 + extraBuffer : null;

  const restaurantName = cartItems[0]?.restaurantName ?? 'Restaurant';

  // Schedule helpers
  const handleScheduleToggle = () => {
    if (!isScheduled) {
      const d = new Date(); d.setHours(d.getHours() + 1); d.setMinutes(0);
      setScheduledDate(d);
    }
    setIsScheduled(!isScheduled);
  };
  const handleDateChange = (_: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      const d = new Date(scheduledDate || new Date());
      d.setFullYear(date.getFullYear()); d.setMonth(date.getMonth()); d.setDate(date.getDate());
      setScheduledDate(d);
    }
  };
  const handleTimeChange = (_: any, time?: Date) => {
    setShowTimePicker(false);
    if (time) {
      const d = new Date(scheduledDate || new Date());
      d.setHours(time.getHours()); d.setMinutes(time.getMinutes());
      setScheduledDate(d);
    }
  };
  const formatScheduledTime = () => {
    if (!scheduledDate) return '';
    const today = new Date(); const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const timeStr = scheduledDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    if (scheduledDate.toDateString() === today.toDateString())    return `Today, ${timeStr}`;
    if (scheduledDate.toDateString() === tomorrow.toDateString()) return `Tomorrow, ${timeStr}`;
    return `${scheduledDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${timeStr}`;
  };

  // Place order
  const placeOrder = async (method: PaymentMethod) => {
    const user = auth().currentUser;
    if (!user) { 
      setShowPayModal(false); 
      setShowLoginModal(true); 
      console.log('❌ Order failed: User not logged in');
      return; 
    }
    
    if (!deliveryAddress) { 
      Alert.alert('Address Missing', 'Please set a delivery address first.'); 
      console.log('❌ Order failed: No delivery address');
      return; 
    }
    
    if (isScheduled && scheduledDate) {
      if (scheduledDate < new Date(Date.now() + 30 * 60000)) {
        Alert.alert('Invalid Time', 'Scheduled time must be at least 30 minutes from now.'); 
        console.log('❌ Order failed: Invalid scheduled time');
        return;
      }
    }
    
    setShowPayModal(false);
    setPlacing(true);
    
    try {
      const restaurantId = cartItems[0]?.restaurantId ?? '';
      
      if (!restaurantId) {
        throw new Error('Restaurant ID is missing');
      }
      
      console.log('📝 Creating order for restaurant:', restaurantId);
      console.log('💳 Payment method:', method);
      console.log('📍 Delivery address:', deliveryAddress);
      
      // Helper function to remove undefined values (Firestore doesn't accept undefined)
      const cleanObject = (obj: any): any => {
        if (obj === null || obj === undefined) return null;
        if (typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(cleanObject);
        
        const cleaned: any = {};
        for (const key in obj) {
          const value = obj[key];
          if (value !== undefined) {
            cleaned[key] = cleanObject(value);
          }
        }
        return cleaned;
      };
      
      const orderRef = firestore().collection('restaurant_Orders').doc();
      const orderData: any = {
        userId: user.uid, 
        userPhone: user.phoneNumber || '',
        restaurantId, 
        restaurantName,
        items: cartItems.map(item => ({
          id: item.id, 
          name: item.name, 
          price: item.price, 
          qty: item.qty,
          variant: item.variant || null, 
          addons: item.addons || [],
          image: item.image || null, 
          description: item.description || null,
          cookingTimeHours: (item as any).cookingTimeHours || null,
          cookingTimeMinutes: (item as any).cookingTimeMinutes || null,
        })),
        subtotal: totalPrice,
        surgeCharge,
        deliveryFee,
        gst: totalGST,
        gstRate: gstRatePercent,
        platformFee,
        packagingFee,
        grandTotal,
        foodOrderSettings: cleanObject(foodSettings),
        paymentMethod: method,
        deliveryAddress, 
        deliveryLat: location?.lat || null, 
        deliveryLng: location?.lng || null,
        status: isScheduled ? 'scheduled' : 'pending',
        createdAt: firestore.FieldValue.serverTimestamp(),
        orderId: orderRef.id,
      };
      
      if (isScheduled && scheduledDate) {
        orderData.scheduledFor = firestore.Timestamp.fromDate(scheduledDate);
        orderData.isScheduled = true;
        console.log('📅 Scheduled order for:', scheduledDate);
      }
      
      console.log('💾 Saving order to restaurant_Orders collection...');
      await orderRef.set(orderData);
      console.log('✅ Order created successfully! Order ID:', orderRef.id);
      
      clearCart();
      console.log('🛒 Cart cleared');
      
      navigation.reset({ 
        index: 0, 
        routes: [{ 
          name: 'FoodOrderSuccess', 
          params: { 
            grandTotal, 
            restaurantName, 
            orderId: orderRef.id, 
            isScheduled 
          } 
        }] 
      });
      console.log('🎉 Navigating to success screen');
      
    } catch (err: any) {
      console.error('❌ Order placement error:', err);
      console.error('Error details:', {
        message: err.message,
        code: err.code,
        stack: err.stack,
      });
      Alert.alert('Error', `Failed to place order: ${err.message || 'Please try again.'}`);
    } finally {
      setPlacing(false);
    }
  };

  /* ── EMPTY STATE ── */
  if (cartItems.length === 0) {
    return (
      <View style={s.emptyRoot}>
        <StatusBar barStyle="dark-content" backgroundColor={WHITE} />
        <View style={[s.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={22} color={DARK} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>My Cart</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.emptyBody}>
          <View style={s.emptyIllustration}>
            <View style={s.emptyCircleOuter}>
              <View style={s.emptyCircleInner}>
                <Ionicons name="bag-outline" size={52} color={ORANGE} />
              </View>
            </View>
          </View>
          <Text style={s.emptyTitle}>Your bag is empty</Text>
          <Text style={s.emptySub}>Add items from a restaurant{'\n'}to get started</Text>
          <TouchableOpacity style={s.browseBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <Text style={s.browseBtnTxt}>Explore Restaurants</Text>
            <Ionicons name="arrow-forward" size={16} color={WHITE} style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={WHITE} />

      {/* ADDRESS REQUIRED MODAL */}
      <Modal visible={showAddressModal} transparent animationType="fade" onRequestClose={() => setShowAddressModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <TouchableOpacity 
              style={s.modalCloseBtn} 
              onPress={() => setShowAddressModal(false)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={22} color={GRAY} />
            </TouchableOpacity>
            <View style={[s.modalIconWrap, { backgroundColor: ORANGE_LT }]}>
              <Ionicons name="location" size={32} color={ORANGE} />
            </View>
            <Text style={s.modalTitle}>Add Delivery Address</Text>
            <Text style={s.modalSubtitle}>We need your location to deliver your order to the right place.</Text>
            <TouchableOpacity style={s.modalPrimaryBtn} activeOpacity={0.85} onPress={() => {
              setShowAddressModal(false);
              navigation.navigate('LocationSelector', { fromScreen: 'foodcheckout' });
            }}>
              <Text style={s.modalPrimaryText}>Set Address</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.modalSecondaryBtn} activeOpacity={0.85} onPress={() => {
              setShowAddressModal(false);
            }}>
              <Text style={s.modalSecondaryText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* LOGIN REQUIRED MODAL */}
      <Modal visible={showLoginModal} transparent animationType="fade" onRequestClose={() => setShowLoginModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={[s.modalIconWrap, { backgroundColor: '#EEF2FF' }]}>
              <Ionicons name="person" size={32} color="#6366F1" />
            </View>
            <Text style={s.modalTitle}>Login to Continue</Text>
            <Text style={s.modalSubtitle}>Sign in to place your order and track it in real time.</Text>
            <TouchableOpacity style={s.modalPrimaryBtn} activeOpacity={0.85} onPress={() => {
              setShowLoginModal(false);
              navigation.navigate('LoginInHomeStack' as never);
            }}>
              <Text style={s.modalPrimaryText}>Login Now</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.modalSecondaryBtn} activeOpacity={0.85} onPress={() => setShowLoginModal(false)}>
              <Text style={s.modalSecondaryText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* HEADER */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color={DARK} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Your Order</Text>
          <View style={s.headerRestaurantRow}>
            <Ionicons name="storefront-outline" size={11} color={GRAY} />
            <Text style={s.headerSub} numberOfLines={1}>{restaurantName}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={clearCart} style={s.iconBtn} hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }}>
          <Ionicons name="trash-outline" size={20} color={RED} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: footerH + 20, paddingTop: 8 }}
      >

        {/* ITEMS SECTION */}
        <View style={s.section}>
          <View style={s.sectionLabelRow}>
            <View style={s.sectionDot} />
            <Text style={s.sectionLabel}>ORDER ITEMS</Text>
            <View style={s.pill}>
              <Text style={s.pillText}>{totalItems} {totalItems === 1 ? 'item' : 'items'}</Text>
            </View>
          </View>

          <View style={s.card}>
            {cartItems.map((item, idx) => (
              <View key={item.id}>
                {idx > 0 && <View style={s.divider} />}
                <View style={s.itemRow}>
                  {/* Left: image */}
                  <View style={s.itemImgWrap}>
                    {item.image
                      ? <Image source={{ uri: item.image }} style={s.itemImg} contentFit="cover" />
                      : (
                        <View style={[s.itemImg, s.imgFallback]}>
                          <Ionicons name="fast-food-outline" size={22} color="#CBD5E1" />
                        </View>
                      )
                    }
                    {/* veg indicator */}
                    <View style={s.vegBadge}>
                      <View style={s.vegDot} />
                    </View>
                  </View>

                  {/* Middle: details */}
                  <View style={s.itemDetails}>
                    <Text style={s.itemName} numberOfLines={2}>{item.name}</Text>
                    {!!item.variant && (
                      <View style={s.variantChip}>
                        <Text style={s.variantChipText}>{item.variant}</Text>
                      </View>
                    )}
                    {(() => {
                      const h = Number((item as any).cookingTimeHours ?? 0);
                      const m = Number((item as any).cookingTimeMinutes ?? 0);
                      if (h === 0 && m === 0) return null;
                      const timeStr = h > 0 && m > 0 ? `${h}h ${m}m` : h > 0 ? `${h}h` : `${m}m`;
                      return (
                        <View style={s.timeChip}>
                          <Ionicons name="time-outline" size={10} color={GRAY} />
                          <Text style={s.timeChipText}>{timeStr}</Text>
                        </View>
                      );
                    })()}
                    <Text style={s.itemPrice}>₹{item.price * item.qty}</Text>
                  </View>

                  {/* Right: stepper */}
                  <View style={s.stepperWrap}>
                    <TouchableOpacity
                      style={s.stepMinus}
                      onPress={() => removeItem(item.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="remove" size={14} color={ORANGE} />
                    </TouchableOpacity>
                    <Text style={s.stepQty}>{item.qty}</Text>
                    <TouchableOpacity
                      style={s.stepPlus}
                      onPress={() => addItem({ ...item })}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="add" size={14} color={WHITE} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Addons */}
                {!!item.addons && item.addons.length > 0 && (
                  <View style={s.addonsBox}>
                    <View style={s.addonsTitleRow}>
                      <Ionicons name="add-circle-outline" size={12} color={ORANGE} />
                      <Text style={s.addonsLabel}>Add-ons</Text>
                      <Text style={s.addonsTotalText}>+₹{item.addons.reduce((sum, a) => sum + a.price, 0) * item.qty}</Text>
                    </View>
                    {item.addons.map((addon, ai) => (
                      <View key={ai} style={s.addonItem}>
                        <View style={s.addonDot} />
                        <Text style={s.addonName}>{addon.name}</Text>
                        <Text style={s.addonPrice}>₹{addon.price} × {item.qty}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}

            <TouchableOpacity style={s.addMoreRow} onPress={() => navigation.goBack()} activeOpacity={0.7}>
              <View style={s.addMoreIcon}>
                <Ionicons name="add" size={14} color={ORANGE} />
              </View>
              <Text style={s.addMoreText}>Add more items</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* DELIVERY ADDRESS */}
        <View style={s.section}>
          <View style={s.sectionLabelRow}>
            <View style={s.sectionDot} />
            <Text style={s.sectionLabel}>DELIVERY TO</Text>
          </View>
          <View style={s.card}>
            {deliveryAddress ? (
              <View style={s.addressRow}>
                <View style={s.addressIconWrap}>
                  <Ionicons name="location" size={18} color={ORANGE} />
                </View>
                <Text style={s.addressText} numberOfLines={3}>{deliveryAddress}</Text>
                <TouchableOpacity
                  style={s.editBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={() => navigation.navigate('LocationSelector', { fromScreen: 'foodcheckout' })}
                >
                  <Ionicons name="pencil" size={14} color={ORANGE} />
                  <Text style={s.editBtnText}>Edit</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={s.addAddressBtn}
                onPress={() => navigation.navigate('LocationSelector', { fromScreen: 'foodcheckout' })}
                activeOpacity={0.8}
              >
                <View style={s.addAddressIcon}>
                  <Ionicons name="add" size={18} color={ORANGE} />
                </View>
                <Text style={s.addAddressText}>Add delivery address</Text>
                <Ionicons name="chevron-forward" size={16} color={GRAY} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* DELIVERY TIME */}
        <View style={s.section}>
          <View style={s.sectionLabelRow}>
            <View style={s.sectionDot} />
            <Text style={s.sectionLabel}>DELIVERY TIME</Text>
          </View>
          <View style={s.card}>
            <View style={s.deliveryOptions}>
              <TouchableOpacity
                style={[s.deliveryOption, !isScheduled && s.deliveryOptionActive]}
                onPress={() => setIsScheduled(false)}
                activeOpacity={0.8}
              >
                <View style={[s.deliveryOptionIcon, !isScheduled && { backgroundColor: ORANGE_LT }]}>
                  <Ionicons name="flash" size={18} color={!isScheduled ? ORANGE : GRAY} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.deliveryOptionTitle, !isScheduled && { color: ORANGE }]}>Now</Text>
                  <Text style={s.deliveryOptionSub}>
                    {estimatedDeliveryMins ? `~${estimatedDeliveryMins} min` : '30–40 min'}
                  </Text>
                </View>
                {!isScheduled && <View style={s.radioActive}><View style={s.radioDot} /></View>}
                {isScheduled && <View style={s.radioInactive} />}
              </TouchableOpacity>

              <View style={s.deliveryOptionDivider} />

              <TouchableOpacity
                style={[s.deliveryOption, isScheduled && s.deliveryOptionActive]}
                onPress={handleScheduleToggle}
                activeOpacity={0.8}
              >
                <View style={[s.deliveryOptionIcon, isScheduled && { backgroundColor: ORANGE_LT }]}>
                  <Ionicons name="calendar" size={18} color={isScheduled ? ORANGE : GRAY} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.deliveryOptionTitle, isScheduled && { color: ORANGE }]}>Schedule</Text>
                  <Text style={s.deliveryOptionSub}>Pick date & time</Text>
                </View>
                {isScheduled && <View style={s.radioActive}><View style={s.radioDot} /></View>}
                {!isScheduled && <View style={s.radioInactive} />}
              </TouchableOpacity>
            </View>

            {isScheduled && scheduledDate && (
              <View style={s.scheduleBox}>
                <Text style={s.scheduleBoxLabel}>Scheduled for</Text>
                <Text style={s.scheduleBoxTime}>{formatScheduledTime()}</Text>
                <View style={s.schedulePickerRow}>
                  <TouchableOpacity style={s.schedulePickerBtn} onPress={() => setShowDatePicker(true)}>
                    <Ionicons name="calendar-outline" size={13} color={ORANGE} />
                    <Text style={s.schedulePickerText}>
                      {scheduledDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.schedulePickerBtn} onPress={() => setShowTimePicker(true)}>
                    <Ionicons name="time-outline" size={13} color={ORANGE} />
                    <Text style={s.schedulePickerText}>
                      {scheduledDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* BILL DETAILS */}
        <View style={s.section}>
          <View style={s.sectionLabelRow}>
            <View style={s.sectionDot} />
            <Text style={s.sectionLabel}>BILL SUMMARY</Text>
          </View>
          <View style={s.card}>
            <View style={s.billRow}>
              <Text style={s.billLabel}>Item Total</Text>
              <Text style={s.billValue}>₹{itemsSubtotal}</Text>
            </View>
            {addonsSubtotal > 0 && (
              <View style={s.billRow}>
                <Text style={s.billLabel}>Add-ons</Text>
                <Text style={s.billValue}>₹{addonsSubtotal}</Text>
              </View>
            )}
            {surgeCharge > 0 && (
              <View style={s.billRow}>
                <View>
                  <Text style={s.billLabel}>🌙 Night Surge Charge</Text>
                  <Text style={s.billHint}>
                    {foodSettings.nightSurgePercent}% extra ({foodSettings.nightSurgeFromHour}:00 - {foodSettings.nightSurgeToHour}:00)
                  </Text>
                </View>
                <Text style={s.billValue}>₹{surgeCharge}</Text>
              </View>
            )}
            <View style={s.billRow}>
              <View>
                <Text style={s.billLabel}>Delivery Fee</Text>
                {(foodSettings.freeDeliveryAbove ?? 0) > 0 && totalPrice < (foodSettings.freeDeliveryAbove ?? 0) && (
                  <Text style={s.billHint}>Free above ₹{foodSettings.freeDeliveryAbove}</Text>
                )}
              </View>
              <Text style={[s.billValue, deliveryFee === 0 && s.billFree]}>
                {deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}
              </Text>
            </View>
            <View style={s.billRow}>
              <View>
                <Text style={s.billLabel}>GST ({gstRatePercent}%)</Text>
                {deliveryGST > 0 && (
                  <Text style={s.billHint}>Items: ₹{itemsGST} + Delivery: ₹{deliveryGST}</Text>
                )}
              </View>
              <Text style={s.billValue}>₹{totalGST}</Text>
            </View>
            <View style={s.billRow}>
              <Text style={s.billLabel}>Platform Fee</Text>
              <Text style={s.billValue}>₹{platformFee}</Text>
            </View>
            <View style={s.billRow}>
              <Text style={s.billLabel}>Packaging</Text>
              <Text style={s.billValue}>₹{packagingFee}</Text>
            </View>

            <View style={s.billTotalBox}>
              <Text style={s.billTotalLabel}>Total Payable</Text>
              <Text style={s.billTotalValue}>₹{grandTotal}</Text>
            </View>

            {deliveryFee === 0 ? (
              <View style={s.savingsBanner}>
                <Text style={s.savingsText}>🎉 You saved ₹{foodSettings.baseDeliveryCharge} on delivery!</Text>
              </View>
            ) : (
              <View style={[s.savingsBanner, { backgroundColor: ORANGE_LT }]}>
                <Ionicons name="bicycle-outline" size={13} color={ORANGE} />
                <Text style={[s.savingsText, { color: ORANGE, marginLeft: 5 }]}>
                  Add ₹{Math.max((foodSettings.freeDeliveryAbove ?? 0) - totalPrice, 0)} more for free delivery
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* UPI NOTE */}
        <View style={s.upiNote}>
          <Ionicons name="shield-checkmark" size={15} color="#6366F1" />
          <Text style={s.upiNoteText}>Rider carries a QR code for instant UPI payment at doorstep</Text>
        </View>

        {/* YOU MAY ALSO LIKE */}
        {relatedItems.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionLabelRow}>
              <View style={s.sectionDot} />
              <Text style={s.sectionLabel}>YOU MAY ALSO LIKE</Text>
            </View>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.relatedScroll}
            >
              {relatedItems.map((item) => (
                <View key={item.id} style={s.relatedCard}>
                  <View style={s.relatedImgWrap}>
                    {item.image ? (
                      <Image source={{ uri: item.image }} style={s.relatedImg} contentFit="cover" />
                    ) : (
                      <View style={[s.relatedImg, s.relatedImgFallback]}>
                        <Ionicons name="fast-food-outline" size={28} color="#CBD5E1" />
                      </View>
                    )}
                    <View style={s.relatedVegBadge}>
                      <View style={[s.vegDot, !item.isVeg && { backgroundColor: RED }]} />
                    </View>
                  </View>
                  <View style={s.relatedInfo}>
                    <Text style={s.relatedName} numberOfLines={2}>{item.name}</Text>
                    <Text style={s.relatedPrice}>₹{item.price}</Text>
                  </View>
                  <TouchableOpacity
                    style={s.relatedAddBtn}
                    onPress={() => {
                      if (item.restaurantId) {
                        addItem(item as any);
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add" size={16} color={WHITE} />
                    <Text style={s.relatedAddText}>Add</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

      </ScrollView>

      {/* FOOTER */}
      <View style={[s.footer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 16 }]}>
        <View style={s.footerInner}>
          <View>
            <Text style={s.footerAmount}>₹{grandTotal}</Text>
            <Text style={s.footerLabel}>{isScheduled ? '📅 Scheduled' : '⚡ Deliver Now'}</Text>
          </View>
          <TouchableOpacity
            style={s.payBtn}
            activeOpacity={0.88}
            onPress={() => {
              if (!deliveryAddress) { setShowAddressModal(true); return; }
              setShowPayModal(true);
            }}
          >
            <Text style={s.payBtnText}>{!deliveryAddress ? 'Checkout' : 'Proceed to Pay'}</Text>
            <Animated.View style={{ transform: [{ translateX: arrowTranslateX }] }}>
              <Ionicons name="arrow-forward-circle" size={20} color={WHITE} />
            </Animated.View>
          </TouchableOpacity>
        </View>
      </View>

      {/* DATE / TIME PICKERS */}
      {showDatePicker && (
        <DateTimePicker
          value={scheduledDate || new Date()} mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange} minimumDate={new Date()}
          maximumDate={new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)}
        />
      )}
      {showTimePicker && (
        <DateTimePicker
          value={scheduledDate || new Date()} mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleTimeChange} minuteInterval={15}
        />
      )}

      {/* PAYMENT MODAL */}
      <PaymentMethodModal
        visible={showPayModal}
        onClose={() => setShowPayModal(false)}
        onSelectOnline={() => placeOrder('UPI')}
        onSelectCOD={() => placeOrder('Cash on Delivery')}
        totalAmount={grandTotal}
        loading={placing}
      />

      {/* LOADING OVERLAY */}
      {placing && (
        <View style={s.loadingOverlay}>
          <View style={s.loadingBox}>
            <ActivityIndicator size="large" color={ORANGE} />
            <Text style={s.loadingText}>Placing your order...</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: GRAY_LT },
  emptyRoot: { flex: 1, backgroundColor: WHITE },

  /* ── HEADER ── */
  header: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    backgroundColor: WHITE,
    paddingHorizontal: 18, paddingBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 4,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: GRAY_LT,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle:  { fontSize: 18, fontWeight: '800', color: DARK, letterSpacing: -0.4 },
  headerRestaurantRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  headerSub:    { fontSize: 11, color: GRAY, fontWeight: '500' },

  /* ── EMPTY STATE ── */
  emptyBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyIllustration: { marginBottom: 36 },
  emptyCircleOuter: {
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: '#FFF8F5',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  emptyCircleInner: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: ORANGE_LT,
    justifyContent: 'center', alignItems: 'center',
  },
  emptyTitle: { fontSize: 24, fontWeight: '800', color: DARK, marginBottom: 10, letterSpacing: -0.5 },
  emptySub:   { fontSize: 15, color: GRAY, textAlign: 'center', lineHeight: 24, fontWeight: '500' },
  browseBtn:  {
    marginTop: 36, backgroundColor: ORANGE,
    paddingHorizontal: 32, paddingVertical: 16, borderRadius: 16,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: ORANGE, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
  browseBtnTxt: { color: WHITE, fontWeight: '800', fontSize: 16, letterSpacing: 0.3 },

  /* ── SECTION ── */
  section: { marginHorizontal: 16, marginTop: 16 },
  sectionLabelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10,
  },
  sectionDot: {
    width: 5, height: 16, borderRadius: 2.5, backgroundColor: ORANGE,
  },
  sectionLabel: {
    fontSize: 11, fontWeight: '800', color: GRAY, letterSpacing: 1.4,
  },
  pill: {
    backgroundColor: ORANGE_LT, paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 20, marginLeft: 5,
  },
  pillText: { fontSize: 10, fontWeight: '800', color: ORANGE, letterSpacing: 0.3 },

  /* ── CARD ── */
  card: {
    backgroundColor: WHITE, borderRadius: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
    overflow: 'hidden',
  },

  /* ── ITEM ROW ── */
  itemRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 16, paddingVertical: 16, gap: 14,
  },
  itemImgWrap: { position: 'relative' },
  itemImg: { width: 80, height: 80, borderRadius: 14 },
  imgFallback: { backgroundColor: GRAY_LT, justifyContent: 'center', alignItems: 'center' },
  vegBadge: {
    position: 'absolute', bottom: -5, left: -5,
    width: 16, height: 16, borderRadius: 4,
    backgroundColor: WHITE, borderWidth: 2, borderColor: GREEN,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  vegDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN },

  itemDetails: { flex: 1, paddingTop: 2 },
  itemName: { fontSize: 15, fontWeight: '700', color: DARK, lineHeight: 21, letterSpacing: -0.3 },
  variantChip: {
    alignSelf: 'flex-start', marginTop: 5,
    backgroundColor: GRAY_LT, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7,
    borderWidth: 1, borderColor: BORDER,
  },
  variantChipText: { fontSize: 10, fontWeight: '700', color: GRAY, letterSpacing: 0.2 },
  timeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5,
  },
  timeChipText: { fontSize: 10, color: GRAY, fontWeight: '600' },
  itemPrice: { fontSize: 15, fontWeight: '800', color: DARK, marginTop: 7 },

  /* ── STEPPER ── */
  stepperWrap: { alignItems: 'center', gap: 6, paddingTop: 4 },
  stepMinus: {
    width: 32, height: 32, borderRadius: 10,
    borderWidth: 2, borderColor: ORANGE,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: WHITE,
  },
  stepQty: { fontSize: 15, fontWeight: '900', color: DARK, minWidth: 22, textAlign: 'center' },
  stepPlus: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: ORANGE,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },

  divider: { height: 1, backgroundColor: BORDER, marginHorizontal: 16 },

  /* ── ADDONS ── */
  addonsBox: {
    marginHorizontal: 16, marginBottom: 14,
    backgroundColor: '#FAFBFF', borderRadius: 12,
    padding: 12, borderWidth: 1, borderColor: BORDER,
  },
  addonsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  addonsLabel: { flex: 1, fontSize: 11, fontWeight: '800', color: ORANGE, letterSpacing: 0.6 },
  addonsTotalText: { fontSize: 12, fontWeight: '800', color: ORANGE },
  addonItem: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 5 },
  addonDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: ORANGE },
  addonName: { flex: 1, fontSize: 13, color: DARK2, fontWeight: '500' },
  addonPrice: { fontSize: 12, color: GRAY, fontWeight: '600' },

  /* ── ADD MORE ── */
  addMoreRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: BORDER,
    backgroundColor: '#FAFBFF',
  },
  addMoreIcon: {
    width: 24, height: 24, borderRadius: 7,
    backgroundColor: ORANGE_LT, justifyContent: 'center', alignItems: 'center',
  },
  addMoreText: { fontSize: 14, fontWeight: '700', color: ORANGE, letterSpacing: 0.1 },

  /* ── ADDRESS ── */
  addressRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16,
  },
  addressIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: ORANGE_LT, justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  addressText: { flex: 1, fontSize: 14, color: DARK2, lineHeight: 22, fontWeight: '500' },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: ORANGE_LT, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
    borderWidth: 1, borderColor: '#FFD4BC',
  },
  editBtnText: { fontSize: 12, fontWeight: '700', color: ORANGE },
  addAddressBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16,
  },
  addAddressIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: ORANGE_LT, justifyContent: 'center', alignItems: 'center',
  },
  addAddressText: { flex: 1, fontSize: 14, fontWeight: '700', color: DARK2 },

  /* ── DELIVERY OPTIONS ── */
  deliveryOptions: { flexDirection: 'row' },
  deliveryOption: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16,
  },
  deliveryOptionActive: { backgroundColor: '#FFFAF7' },
  deliveryOptionDivider: { width: 1, backgroundColor: BORDER, marginVertical: 12 },
  deliveryOptionIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: GRAY_LT, justifyContent: 'center', alignItems: 'center',
  },
  deliveryOptionTitle: { fontSize: 14, fontWeight: '800', color: DARK, letterSpacing: -0.2 },
  deliveryOptionSub:   { fontSize: 12, color: GRAY, marginTop: 2, fontWeight: '500' },
  radioActive: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: ORANGE,
    justifyContent: 'center', alignItems: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: ORANGE },
  radioInactive: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: '#D1D5DB',
  },

  /* ── SCHEDULE BOX ── */
  scheduleBox: {
    margin: 14, marginTop: 0,
    backgroundColor: ORANGE_LT, borderRadius: 14,
    padding: 14, borderWidth: 1.5, borderColor: '#FFD4BC',
  },
  scheduleBoxLabel: { fontSize: 11, fontWeight: '700', color: GRAY, letterSpacing: 0.6 },
  scheduleBoxTime:  { fontSize: 16, fontWeight: '800', color: ORANGE, marginTop: 3, marginBottom: 12, letterSpacing: -0.2 },
  schedulePickerRow: { flexDirection: 'row', gap: 10 },
  schedulePickerBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: WHITE, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#FFD4BC',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  schedulePickerText: { fontSize: 13, fontWeight: '700', color: DARK },

  /* ── BILL ── */
  billRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 16, paddingVertical: 10,
  },
  billLabel: { fontSize: 14, color: GRAY, fontWeight: '600' },
  billHint:  { fontSize: 10, color: GREEN, marginTop: 3, fontWeight: '600' },
  billValue: { fontSize: 14, color: DARK, fontWeight: '700' },
  billFree:  { color: GREEN, fontWeight: '800' },
  billTotalBox: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 16, marginTop: 6, marginBottom: 14,
    paddingTop: 14, borderTopWidth: 2, borderTopColor: BORDER,
    borderStyle: 'dashed',
  },
  billTotalLabel: { fontSize: 16, fontWeight: '800', color: DARK, letterSpacing: -0.2 },
  billTotalValue: { fontSize: 20, fontWeight: '900', color: ORANGE, letterSpacing: -0.3 },
  savingsBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: GREEN_LT, marginHorizontal: 16, marginBottom: 16,
    paddingVertical: 10, borderRadius: 12,
    borderWidth: 1, borderColor: '#D1FAE5',
  },
  savingsText: { fontSize: 13, fontWeight: '700', color: GREEN, letterSpacing: 0.1 },

  /* ── UPI NOTE ── */
  upiNote: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 12, marginBottom: 6,
    backgroundColor: '#EEF2FF', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#DDD6FE',
  },
  upiNoteText: { flex: 1, fontSize: 13, color: '#4F46E5', lineHeight: 19, fontWeight: '600' },

  /* ── FOOTER ── */
  footer: {
    backgroundColor: WHITE,
    paddingHorizontal: 18, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: BORDER,
    shadowColor: '#000', shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.1, shadowRadius: 16, elevation: 20,
  },
  footerInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  footerAmount: { fontSize: 24, fontWeight: '900', color: DARK, letterSpacing: -0.6 },
  footerLabel:  { fontSize: 12, color: GRAY, marginTop: 3, fontWeight: '600' },
  payBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: ORANGE, paddingHorizontal: 26, paddingVertical: 16,
    borderRadius: 16,
    shadowColor: ORANGE, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45, shadowRadius: 16, elevation: 8,
  },
  payBtnText: { fontSize: 16, fontWeight: '800', color: WHITE, letterSpacing: 0.3 },

  /* ── MODALS ── */
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30,
  },
  modalCard: {
    backgroundColor: WHITE, borderRadius: 26, padding: 30,
    alignItems: 'center', width: '100%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2, shadowRadius: 24, elevation: 12,
    position: 'relative',
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 18,
    right: 18,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: GRAY_LT,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  modalIconWrap: {
    width: 72, height: 72, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center', marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  modalTitle:    { fontSize: 20, fontWeight: '800', color: DARK, marginBottom: 8, textAlign: 'center', letterSpacing: -0.3 },
  modalSubtitle: { fontSize: 14, color: GRAY, textAlign: 'center', lineHeight: 22, marginBottom: 26, fontWeight: '500' },
  modalPrimaryBtn: {
    backgroundColor: ORANGE, borderRadius: 14,
    paddingVertical: 16, width: '100%', alignItems: 'center', marginBottom: 12,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  modalPrimaryText:  { color: WHITE, fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  modalSecondaryBtn: {
    borderWidth: 2, borderColor: BORDER, borderRadius: 14,
    paddingVertical: 15, width: '100%', alignItems: 'center',
  },
  modalSecondaryText: { color: GRAY, fontSize: 15, fontWeight: '700' },

  /* ── LOADING ── */
  loadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center',
  },
  loadingBox: {
    backgroundColor: WHITE, borderRadius: 18, padding: 32,
    alignItems: 'center', gap: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15, shadowRadius: 16, elevation: 10,
  },
  loadingText: { fontSize: 15, fontWeight: '700', color: DARK, letterSpacing: -0.2 },

  /* ── RELATED ITEMS ── */
  relatedScroll: { paddingHorizontal: 16, gap: 14 },
  relatedCard: {
    width: 150,
    backgroundColor: WHITE,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  relatedImgWrap: { position: 'relative' },
  relatedImg: { width: '100%', height: 110 },
  relatedImgFallback: {
    backgroundColor: GRAY_LT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  relatedVegBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 18,
    height: 18,
    borderRadius: 5,
    backgroundColor: WHITE,
    borderWidth: 2,
    borderColor: GREEN,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  relatedInfo: { padding: 12, paddingBottom: 10 },
  relatedName: {
    fontSize: 14,
    fontWeight: '700',
    color: DARK,
    lineHeight: 20,
    marginBottom: 5,
    letterSpacing: -0.2,
  },
  relatedPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: DARK,
  },
  relatedAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: ORANGE,
    marginHorizontal: 12,
    marginBottom: 12,
    paddingVertical: 10,
    borderRadius: 10,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  relatedAddText: {
    fontSize: 14,
    fontWeight: '800',
    color: WHITE,
    letterSpacing: 0.2,
  },
});
