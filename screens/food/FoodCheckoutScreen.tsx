import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Platform, StatusBar, Animated, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useFoodCart } from '@/context/FoodCartContext';
import { useLocationContext } from '@/context/LocationContext';
import { Image } from 'expo-image';
import DateTimePicker from '@react-native-community/datetimepicker';

const ORANGE = '#FC8019';
const DARK   = '#282C3F';
const GRAY   = '#93959F';
const GREEN  = '#3d9b6d';
const BG     = '#f8f9fa';

const PAYMENT_METHODS = [
  { id: 'Cash on Delivery', label: 'Cash on Delivery', sub: 'Pay when your order arrives', icon: 'cash' as const },
  { id: 'UPI',              label: 'UPI',              sub: 'GPay, PhonePe, Paytm & more',  icon: 'phone-portrait' as const },
  { id: 'Card',             label: 'Credit / Debit Card', sub: 'Visa, Mastercard, RuPay',   icon: 'card' as const },
] as const;

type PaymentMethod = 'Cash on Delivery' | 'UPI' | 'Card';

export default function FoodCheckoutScreen() {
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const insets     = useSafeAreaInsets();
  const { clearCart } = useFoodCart();
  const { location } = useLocationContext();

  const { cartItems = [], subtotal = 0, deliveryFee = 0, taxes = 0, grandTotal = 0 } =
    route.params ?? {};

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash on Delivery');
  const [placing, setPlacing] = useState(false);

  const [deliveryAddress, setDeliveryAddress] = useState(location?.address || '');
  
  // Scheduled order states
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Update delivery address when location changes
  useEffect(() => {
    if (location?.address) {
      setDeliveryAddress(location.address);
    }
  }, [location]);

  // Check if address is available on mount
  useEffect(() => {
    if (!location?.address) {
      Alert.alert(
        'Address Required',
        'Please add a delivery address to continue',
        [
          {
            text: 'Add Address',
            onPress: () => navigation.navigate('LocationSelector', {
              fromScreen: 'foodcheckout'
            })
          },
          {
            text: 'Go Back',
            onPress: () => navigation.goBack(),
            style: 'cancel'
          }
        ],
        { cancelable: false }
      );
    }
  }, []);

  const maxCookingMins = cartItems.reduce((max: number, item: any) => {
    const h = Number(item.cookingTimeHours ?? 0);
    const m = Number(item.cookingTimeMinutes ?? 0);
    const total = h * 60 + m;
    return total > max ? total : max;
  }, 0);
  const estimatedDeliveryMins = maxCookingMins > 0 ? maxCookingMins + 10 : null;

  const restaurantName  = cartItems[0]?.restaurantName ?? '';

  const arrowX = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(arrowX, { toValue: 5, duration: 500, useNativeDriver: true }),
        Animated.timing(arrowX, { toValue: 0, duration: 500, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const placeOrder = async () => {
    const user = auth().currentUser;
    if (!user)            { Alert.alert('Login Required', 'Please login to place an order.'); return; }
    if (!deliveryAddress) { Alert.alert('Address Missing', 'Please set a delivery address first.'); return; }
    
    // Validate scheduled time
    if (isScheduled && scheduledDate) {
      const now = new Date();
      const minScheduleTime = new Date(now.getTime() + 30 * 60000); // 30 minutes from now
      
      if (scheduledDate < minScheduleTime) {
        Alert.alert('Invalid Time', 'Scheduled time must be at least 30 minutes from now.');
        return;
      }
    }

    setPlacing(true);
    try {
      const restaurantId = cartItems[0]?.restaurantId ?? '';
      const orderRef = firestore().collection('restaurant_Orders').doc();
      
      console.log('[FoodCheckout] Creating order with ID:', orderRef.id);
      console.log('[FoodCheckout] Restaurant ID:', restaurantId);
      console.log('[FoodCheckout] User ID:', user.uid);
      
      const orderData: any = {
        userId: user.uid, userPhone: user.phoneNumber ?? '',
        restaurantId, restaurantName,
        items: cartItems.map((item: any) => ({
          id: item.id, name: item.name, price: item.price, qty: item.qty,
          variant: item.variant ?? null, addons: item.addons ?? [], image: item.image ?? null,
          description: item.description ?? null,
          cookingTimeHours: item.cookingTimeHours ?? null,
          cookingTimeMinutes: item.cookingTimeMinutes ?? null,
        })),
        subtotal, deliveryFee, taxes, grandTotal,
        paymentMethod,
        deliveryAddress, deliveryLat: location?.lat ?? null, deliveryLng: location?.lng ?? null,
        status: isScheduled ? 'scheduled' : 'pending',
        createdAt: firestore.FieldValue.serverTimestamp(),
        orderId: orderRef.id,
      };
      
      // Add scheduled time if applicable
      if (isScheduled && scheduledDate) {
        orderData.scheduledFor = firestore.Timestamp.fromDate(scheduledDate);
        orderData.isScheduled = true;
      }
      
      console.log('[FoodCheckout] Order data prepared:', JSON.stringify(orderData, null, 2));
      
      await orderRef.set(orderData);
      
      console.log('[FoodCheckout] Order successfully created in restaurant_Orders collection');
      
      clearCart();
      navigation.reset({
        index: 0,
        routes: [{ name: 'FoodOrderSuccess', params: { grandTotal, restaurantName, orderId: orderRef.id, isScheduled } }],
      });
    } catch (err) {
      console.error('[FoodCheckout] order error:', err);
      console.error('[FoodCheckout] error details:', JSON.stringify(err, null, 2));
      Alert.alert('Error', `Failed to place order: ${err.message || 'Please try again.'}`);
    } finally {
      setPlacing(false);
    }
  };
  
  const handleScheduleToggle = () => {
    if (!isScheduled) {
      // Set default to 1 hour from now
      const defaultTime = new Date();
      defaultTime.setHours(defaultTime.getHours() + 1);
      defaultTime.setMinutes(0);
      setScheduledDate(defaultTime);
    }
    setIsScheduled(!isScheduled);
  };
  
  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const newDate = new Date(scheduledDate || new Date());
      newDate.setFullYear(selectedDate.getFullYear());
      newDate.setMonth(selectedDate.getMonth());
      newDate.setDate(selectedDate.getDate());
      setScheduledDate(newDate);
    }
  };
  
  const handleTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const newDate = new Date(scheduledDate || new Date());
      newDate.setHours(selectedTime.getHours());
      newDate.setMinutes(selectedTime.getMinutes());
      setScheduledDate(newDate);
    }
  };
  
  const formatScheduledTime = () => {
    if (!scheduledDate) return '';
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const isToday = scheduledDate.toDateString() === today.toDateString();
    const isTomorrow = scheduledDate.toDateString() === tomorrow.toDateString();
    
    const timeStr = scheduledDate.toLocaleTimeString('en-IN', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
    
    if (isToday) return `Today, ${timeStr}`;
    if (isTomorrow) return `Tomorrow, ${timeStr}`;
    
    const dateStr = scheduledDate.toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'short' 
    });
    return `${dateStr}, ${timeStr}`;
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ── HEADER ── */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={DARK} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Checkout</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        style={{ flex: 1 }} 
        showsVerticalScrollIndicator={false} 
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 20 }}
      >

        {/* ── DELIVERY ADDRESS CARD ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={s.iconCircle}>
              <Ionicons name="location" size={18} color={ORANGE} />
            </View>
            <Text style={s.cardTitle}>Delivery Address</Text>
          </View>
          {deliveryAddress ? (
            <View style={s.addressBox}>
              <View style={s.addressIconBox}>
                <Ionicons name="home" size={16} color={GREEN} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.addressLabel}>Home</Text>
                <Text style={s.addressText}>{deliveryAddress}</Text>
              </View>
              <TouchableOpacity 
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                onPress={() => navigation.navigate('LocationSelector', { 
                  fromScreen: 'foodcheckout'
                })}
              >
                <Ionicons name="create-outline" size={20} color={ORANGE} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity 
              style={s.addAddressBtn} 
              activeOpacity={0.8}
              onPress={() => navigation.navigate('LocationSelector', { 
                fromScreen: 'foodcheckout'
              })}
            >
              <Ionicons name="add-circle" size={20} color={ORANGE} />
              <Text style={s.addAddressText}>Add delivery address</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── ORDER ITEMS CARD ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={s.iconCircle}>
              <Ionicons name="restaurant" size={18} color={ORANGE} />
            </View>
            <Text style={s.cardTitle}>{restaurantName}</Text>
            <View style={s.itemCountBadge}>
              <Text style={s.itemCountText}>{cartItems.length} {cartItems.length === 1 ? 'item' : 'items'}</Text>
            </View>
          </View>

          {cartItems.map((item: any, idx: number) => (
            <View key={item.id}>
              {idx > 0 && <View style={s.itemDivider} />}
              
              <View style={s.orderItem}>
                <View style={s.itemLeft}>
                  <View style={s.vegBox}><View style={s.vegDot} /></View>
                  <View style={s.itemDetails}>
                    <View style={s.itemNameRow}>
                      <Text style={s.qtyBadge}>{item.qty}×</Text>
                      <Text style={s.itemName}>{item.name}</Text>
                    </View>
                    {!!item.variant && (
                      <View style={s.variantBadge}>
                        <Text style={s.variantText}>{item.variant}</Text>
                      </View>
                    )}
                    {!!item.description && (
                      <Text style={s.itemDesc} numberOfLines={2}>{item.description}</Text>
                    )}
                    
                    {/* Add-ons */}
                    {!!item.addons && item.addons.length > 0 && (
                      <View style={s.addonsBox}>
                        <View style={s.addonsHeaderRow}>
                          <Text style={s.addonsLabel}>Add-ons</Text>
                          <Text style={s.addonsTotalPrice}>
                            +₹{(item.addons.reduce((sum, addon) => sum + addon.price, 0) * item.qty)}
                          </Text>
                        </View>
                        {item.addons.map((addon: any, addonIdx: number) => (
                          <View key={addonIdx} style={s.addonRow}>
                            {addon.image ? (
                              <Image source={{ uri: addon.image }} style={s.addonImg} contentFit="cover" />
                            ) : (
                              <View style={s.addonImgPlaceholder}>
                                <Ionicons name="add-circle" size={8} color={ORANGE} />
                              </View>
                            )}
                            <Text style={s.addonName}>{addon.name}</Text>
                            <Text style={s.addonPrice}>₹{addon.price} × {item.qty}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </View>

                <View style={s.itemRight}>
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={s.itemImg} contentFit="cover" />
                  ) : (
                    <View style={[s.itemImg, s.imgPlaceholder]}>
                      <Ionicons name="fast-food-outline" size={20} color="#ddd" />
                    </View>
                  )}
                  <Text style={s.itemPrice}>₹{item.price * item.qty}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* ── SCHEDULE ORDER CARD ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={s.iconCircle}>
              <Ionicons name="time" size={18} color={ORANGE} />
            </View>
            <Text style={s.cardTitle}>Delivery Time</Text>
          </View>

          <TouchableOpacity
            style={[s.scheduleOption, isScheduled && s.scheduleOptionActive]}
            onPress={handleScheduleToggle}
            activeOpacity={0.7}
          >
            <View style={s.scheduleLeft}>
              <View style={[s.scheduleIconBox, isScheduled && s.scheduleIconBoxActive]}>
                <Ionicons name="flash" size={20} color={isScheduled ? GRAY : ORANGE} />
              </View>
              <View style={s.scheduleInfo}>
                <Text style={[s.scheduleLabel, !isScheduled && s.scheduleLabelActive]}>Deliver Now</Text>
                <Text style={s.scheduleSub}>
                  {estimatedDeliveryMins ? `Get it in ~${estimatedDeliveryMins} mins` : 'Get it in 30-40 mins'}
                </Text>
              </View>
            </View>
            <View style={[s.radio, !isScheduled && s.radioSelected]}>
              {!isScheduled && <View style={s.radioDot} />}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.scheduleOption, isScheduled && s.scheduleOptionActive]}
            onPress={handleScheduleToggle}
            activeOpacity={0.7}
          >
            <View style={s.scheduleLeft}>
              <View style={[s.scheduleIconBox, isScheduled && s.scheduleIconBoxActive]}>
                <Ionicons name="calendar" size={20} color={isScheduled ? ORANGE : GRAY} />
              </View>
              <View style={s.scheduleInfo}>
                <Text style={[s.scheduleLabel, isScheduled && s.scheduleLabelActive]}>Schedule Order</Text>
                <Text style={s.scheduleSub}>Choose your delivery time</Text>
              </View>
            </View>
            <View style={[s.radio, isScheduled && s.radioSelected]}>
              {isScheduled && <View style={s.radioDot} />}
            </View>
          </TouchableOpacity>

          {isScheduled && scheduledDate && (
            <View style={s.scheduleTimeBox}>
              <View style={s.scheduleTimeHeader}>
                <Ionicons name="time-outline" size={16} color={ORANGE} />
                <Text style={s.scheduleTimeLabel}>Scheduled for</Text>
              </View>
              <View style={s.scheduleTimeButtons}>
                <TouchableOpacity 
                  style={s.scheduleTimeBtn}
                  onPress={() => setShowDatePicker(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="calendar-outline" size={16} color={ORANGE} />
                  <Text style={s.scheduleTimeBtnText}>
                    {scheduledDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={s.scheduleTimeBtn}
                  onPress={() => setShowTimePicker(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="time-outline" size={16} color={ORANGE} />
                  <Text style={s.scheduleTimeBtnText}>
                    {scheduledDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={s.scheduleTimeSummary}>
                <Text style={s.scheduleTimeSummaryText}>{formatScheduledTime()}</Text>
              </View>
            </View>
          )}
        </View>

        {/* ── PAYMENT METHOD CARD ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={s.iconCircle}>
              <Ionicons name="wallet" size={18} color={ORANGE} />
            </View>
            <Text style={s.cardTitle}>Payment Method</Text>
          </View>

          {PAYMENT_METHODS.map((method, idx) => {
            const selected = paymentMethod === method.id;
            return (
              <TouchableOpacity
                key={method.id}
                style={[s.paymentOption, selected && s.paymentOptionSelected]}
                onPress={() => setPaymentMethod(method.id)}
                activeOpacity={0.7}
              >
                <View style={[s.paymentIconBox, selected && s.paymentIconBoxSelected]}>
                  <Ionicons name={method.icon} size={20} color={selected ? ORANGE : GRAY} />
                </View>
                <View style={s.paymentInfo}>
                  <Text style={[s.paymentLabel, selected && s.paymentLabelSelected]}>{method.label}</Text>
                  <Text style={s.paymentSub}>{method.sub}</Text>
                </View>
                <View style={[s.radio, selected && s.radioSelected]}>
                  {selected && <View style={s.radioDot} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── BILL SUMMARY CARD ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={s.iconCircle}>
              <Ionicons name="receipt" size={18} color={ORANGE} />
            </View>
            <Text style={s.cardTitle}>Bill Summary</Text>
          </View>

          <View style={s.billRow}>
            <Text style={s.billLabel}>Item Total</Text>
            <Text style={s.billValue}>₹{subtotal}</Text>
          </View>
          
          <View style={s.billRow}>
            <View>
              <Text style={s.billLabel}>Delivery Fee</Text>
              {subtotal < 199 && deliveryFee > 0 && (
                <Text style={s.billHint}>Free above ₹199</Text>
              )}
            </View>
            <Text style={[s.billValue, deliveryFee === 0 && { color: GREEN, fontWeight: '700' }]}>
              {deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}
            </Text>
          </View>

          <View style={s.billRow}>
            <Text style={s.billLabel}>Taxes & Charges</Text>
            <Text style={s.billValue}>₹{taxes}</Text>
          </View>

          <View style={s.billDivider} />

          <View style={s.billTotalRow}>
            <Text style={s.billTotalLabel}>Total Amount</Text>
            <Text style={s.billTotalValue}>₹{grandTotal}</Text>
          </View>
        </View>

        {/* ── SAFETY NOTE ── */}
        <View style={s.safetyNote}>
          <Ionicons name="shield-checkmark" size={16} color={GREEN} />
          <Text style={s.safetyText}>100% safe & secure payments</Text>
        </View>

      </ScrollView>

      {/* Date/Time Pickers */}
      {showDatePicker && (
        <DateTimePicker
          value={scheduledDate || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
          minimumDate={new Date()}
          maximumDate={new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)} // 7 days ahead
        />
      )}
      
      {showTimePicker && (
        <DateTimePicker
          value={scheduledDate || new Date()}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleTimeChange}
          minuteInterval={15}
        />
      )}

      {/* ── PLACE ORDER FOOTER ── */}
      <View style={[s.footer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 12 }]}>
        <View style={s.footerContent}>
          <View style={s.footerLeft}>
            <Text style={s.footerTotal}>₹{grandTotal}</Text>
            <Text style={s.footerSubtext}>
              {isScheduled ? `Scheduled • ${paymentMethod}` : paymentMethod}
            </Text>
          </View>
          <TouchableOpacity
            style={[s.placeOrderBtn, placing && { opacity: 0.7 }]}
            onPress={placeOrder}
            disabled={placing}
            activeOpacity={0.88}
          >
            {placing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text style={s.placeOrderText}>Place Order</Text>
                <Animated.View style={{ transform: [{ translateX: arrowX }] }}>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </Animated.View>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  /* header */
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  backBtn:     { width: 40, padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: DARK },

  /* card */
  card: {
    backgroundColor: '#fff', 
    marginHorizontal: 14, 
    marginTop: 12,
    borderRadius: 16, 
    padding: 16,
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, 
    shadowRadius: 8, 
    elevation: 3,
  },

  /* card header */
  cardHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10, 
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  iconCircle: {
    width: 36, 
    height: 36, 
    borderRadius: 18,
    backgroundColor: '#fff5f0', 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  cardTitle: { 
    flex: 1, 
    fontSize: 15, 
    fontWeight: '700', 
    color: DARK,
  },
  itemCountBadge: {
    backgroundColor: '#fff5f0', 
    paddingHorizontal: 10, 
    paddingVertical: 4,
    borderRadius: 12,
  },
  itemCountText: { 
    fontSize: 11, 
    fontWeight: '700', 
    color: ORANGE,
  },

  /* address */
  addressBox: { 
    flexDirection: 'row', 
    alignItems: 'flex-start', 
    gap: 12,
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 12,
  },
  addressIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressLabel: { 
    fontSize: 12, 
    fontWeight: '700', 
    color: DARK, 
    marginBottom: 4,
  },
  addressText: { 
    fontSize: 13, 
    color: GRAY, 
    lineHeight: 19,
  },
  addAddressBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    gap: 8, 
    paddingVertical: 14,
    backgroundColor: '#fff5f0',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: ORANGE,
    borderStyle: 'dashed',
  },
  addAddressText: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: ORANGE,
  },

  /* order items */
  orderItem: { 
    flexDirection: 'row', 
    paddingVertical: 10,
  },
  itemLeft: { 
    flex: 1, 
    flexDirection: 'row', 
    gap: 10, 
    paddingRight: 12,
  },
  vegBox: {
    width: 16, 
    height: 16, 
    borderRadius: 3,
    borderWidth: 1.5, 
    borderColor: GREEN,
    justifyContent: 'center', 
    alignItems: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  vegDot: { 
    width: 8, 
    height: 8, 
    borderRadius: 4, 
    backgroundColor: GREEN,
  },
  itemDetails: { flex: 1 },
  itemNameRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6,
  },
  qtyBadge: { 
    fontSize: 13, 
    fontWeight: '700', 
    color: ORANGE,
  },
  itemName: { 
    flex: 1, 
    fontSize: 14, 
    color: DARK, 
    fontWeight: '600',
    lineHeight: 20,
  },
  itemDesc: { fontSize: 11, color: GRAY, marginTop: 3, lineHeight: 16 },
  itemTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  itemTimeText: { fontSize: 11, color: '#94a3b8' },
  variantBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  variantText: { 
    fontSize: 10, 
    fontWeight: '600', 
    color: GRAY,
  },

  /* addons in checkout */
  addonsBox: { 
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f5f5f5',
  },
  addonsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  addonsLabel: { 
    fontSize: 10, 
    fontWeight: '700', 
    color: ORANGE,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addonsTotalPrice: {
    fontSize: 11,
    fontWeight: '700',
    color: ORANGE,
  },
  addonRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6,
    backgroundColor: '#fafafa',
    padding: 6,
    borderRadius: 6,
    marginTop: 4,
  },
  addonImg: { 
    width: 24, 
    height: 24, 
    borderRadius: 4,
  },
  addonImgPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#fff5f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addonName: { 
    flex: 1, 
    fontSize: 11, 
    color: DARK,
    fontWeight: '500',
  },
  addonPrice: { 
    fontSize: 10, 
    fontWeight: '600', 
    color: GRAY,
  },

  itemRight: { 
    alignItems: 'center',
  },
  itemImg: { 
    width: 56, 
    height: 56, 
    borderRadius: 10,
    marginBottom: 6,
  },
  imgPlaceholder: {
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemPrice: { 
    fontSize: 13, 
    fontWeight: '700', 
    color: DARK,
  },
  itemDivider: { 
    height: 1, 
    backgroundColor: '#f5f5f5', 
    marginVertical: 10,
  },

  /* payment */
  paymentOption: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#fafafa',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  paymentOptionSelected: {
    backgroundColor: '#fff5f0',
    borderColor: ORANGE,
  },
  paymentIconBox: {
    width: 44, 
    height: 44, 
    borderRadius: 12,
    backgroundColor: '#f8f9fa', 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  paymentIconBoxSelected: { 
    backgroundColor: '#fff', 
  },
  paymentInfo: { 
    flex: 1, 
    marginLeft: 12,
  },
  paymentLabel: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: DARK,
  },
  paymentLabelSelected: { 
    color: ORANGE,
  },
  paymentSub: { 
    fontSize: 11, 
    color: GRAY, 
    marginTop: 2,
  },
  radio: {
    width: 22, 
    height: 22, 
    borderRadius: 11,
    borderWidth: 2, 
    borderColor: '#d0d0d0',
    justifyContent: 'center', 
    alignItems: 'center',
  },
  radioSelected: { 
    borderColor: ORANGE,
  },
  radioDot: { 
    width: 12, 
    height: 12, 
    borderRadius: 6, 
    backgroundColor: ORANGE,
  },

  /* bill */
  billRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  billLabel: { 
    fontSize: 13, 
    color: GRAY,
    fontWeight: '500',
  },
  billHint: { 
    fontSize: 10, 
    color: GREEN, 
    marginTop: 2,
  },
  billValue: { 
    fontSize: 13, 
    color: DARK, 
    fontWeight: '600',
  },
  billDivider: { 
    height: 1, 
    backgroundColor: '#f0f0f0', 
    marginVertical: 10,
  },
  billTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
  },
  billTotalLabel: { 
    fontSize: 15, 
    fontWeight: '700', 
    color: DARK,
  },
  billTotalValue: { 
    fontSize: 18, 
    fontWeight: '800', 
    color: ORANGE,
  },

  /* safety */
  safetyNote: {
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    gap: 8, 
    marginTop: 16,
    marginBottom: 8,
  },
  safetyText: { 
    fontSize: 12, 
    color: GREEN, 
    fontWeight: '600',
  },

  /* footer */
  footer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16, 
    paddingTop: 12,
    borderTopWidth: 1, 
    borderTopColor: '#f0f0f0',
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08, 
    shadowRadius: 8, 
    elevation: 12,
  },
  footerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  footerLeft: { flex: 1 },
  footerTotal: { 
    fontSize: 20, 
    fontWeight: '800', 
    color: DARK,
  },
  footerSubtext: { 
    fontSize: 11, 
    color: GRAY, 
    marginTop: 2,
  },
  placeOrderBtn: {
    backgroundColor: ORANGE, 
    borderRadius: 12,
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8,
    paddingHorizontal: 24, 
    paddingVertical: 14,
    shadowColor: ORANGE, 
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, 
    shadowRadius: 8, 
    elevation: 4,
  },
  placeOrderText: { 
    fontSize: 15, 
    fontWeight: '700', 
    color: '#fff',
  },

  /* schedule order */
  scheduleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#fafafa',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  scheduleOptionActive: {
    backgroundColor: '#fff5f0',
    borderColor: ORANGE,
  },
  scheduleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  scheduleIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#fff5f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scheduleIconBoxActive: {
    backgroundColor: '#fff',
  },
  scheduleInfo: {
    flex: 1,
    marginLeft: 12,
  },
  scheduleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: DARK,
  },
  scheduleLabelActive: {
    color: ORANGE,
  },
  scheduleSub: {
    fontSize: 11,
    color: GRAY,
    marginTop: 2,
  },
  scheduleTimeBox: {
    backgroundColor: '#fff5f0',
    padding: 12,
    borderRadius: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: ORANGE,
  },
  scheduleTimeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  scheduleTimeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: ORANGE,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scheduleTimeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  scheduleTimeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: ORANGE,
  },
  scheduleTimeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: DARK,
  },
  scheduleTimeSummary: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(252, 128, 25, 0.2)',
    alignItems: 'center',
  },
  scheduleTimeSummaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: ORANGE,
  },
});
