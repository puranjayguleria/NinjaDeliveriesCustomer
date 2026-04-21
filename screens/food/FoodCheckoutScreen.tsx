import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Platform, StatusBar, Animated, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useFoodCart } from '@/context/FoodCartContext';
import { useLocationContext } from '@/context/LocationContext';
import { Image } from 'expo-image';
import DateTimePicker from '@react-native-community/datetimepicker';
import PaymentMethodModal from '@/components/PaymentMethodModal';
import { navigate } from '@/navigation/rootNavigation';

const ORANGE = '#FC8019';
const DARK   = '#282C3F';
const GRAY   = '#666';
const GREEN  = '#3d9b6d';

type PaymentMethod = 'Cash on Delivery' | 'UPI';

export default function FoodCheckoutScreen() {
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const { clearCart } = useFoodCart();
  const { location } = useLocationContext();

  const { cartItems = [], subtotal = 0, deliveryFee = 0, gst = 0, platformFee = 5, packagingFee = 20, grandTotal = 0 } = route.params ?? {};

  const [placing, setPlacing]               = useState(false);
  const [showPayModal, setShowPayModal]      = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showLoginModal, setShowLoginModal]  = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState(location?.address || '');
  const [isScheduled, setIsScheduled]        = useState(false);
  const [scheduledDate, setScheduledDate]    = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker]  = useState(false);
  const [showTimePicker, setShowTimePicker]  = useState(false);

  useEffect(() => { if (location?.address) setDeliveryAddress(location.address); }, [location]);

  useEffect(() => {
    if (!location?.address) {
      setShowAddressModal(true);
    }
  }, []);

  const maxCookingMins = cartItems.reduce((max: number, item: any) => {
    const total = Number(item.cookingTimeHours ?? 0) * 60 + Number(item.cookingTimeMinutes ?? 0);
    return total > max ? total : max;
  }, 0);

  // For multiple items: max cooking time + 5 min per extra item (parallel prep buffer) + 10 min delivery
  const itemCount = cartItems.reduce((sum: number, item: any) => sum + (item.qty ?? 1), 0);
  const extraBuffer = itemCount > 1 ? (itemCount - 1) * 5 : 0;
  const estimatedDeliveryMins = maxCookingMins > 0
    ? maxCookingMins + extraBuffer + 10
    : itemCount > 1 ? 35 + extraBuffer : null;
  const restaurantName = cartItems[0]?.restaurantName ?? '';

  const arrowX = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(arrowX, { toValue: 5, duration: 500, useNativeDriver: true }),
      Animated.timing(arrowX, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, []);

  const placeOrder = async (method: PaymentMethod) => {
    const user = auth().currentUser;
    if (!user) { 
      setShowPayModal(false);
      setShowLoginModal(true); 
      return; 
    }
    if (!deliveryAddress) { Alert.alert('Address Missing', 'Please set a delivery address first.'); return; }
    if (isScheduled && scheduledDate) {
      if (scheduledDate < new Date(Date.now() + 30 * 60000)) {
        Alert.alert('Invalid Time', 'Scheduled time must be at least 30 minutes from now.'); return;
      }
    }
    setShowPayModal(false);
    setPlacing(true);
    try {
      const restaurantId = cartItems[0]?.restaurantId ?? '';
      const orderRef = firestore().collection('restaurant_Orders').doc();
      const orderData: any = {
        userId: user.uid, userPhone: user.phoneNumber ?? '',
        restaurantId, restaurantName,
        items: cartItems.map((item: any) => ({
          id: item.id, name: item.name, price: item.price, qty: item.qty,
          variant: item.variant ?? null, addons: item.addons ?? [],
          image: item.image ?? null, description: item.description ?? null,
          cookingTimeHours: item.cookingTimeHours ?? null,
          cookingTimeMinutes: item.cookingTimeMinutes ?? null,
        })),
        subtotal, deliveryFee, gst, platformFee, packagingFee, grandTotal,
        paymentMethod: method,
        deliveryAddress, deliveryLat: location?.lat ?? null, deliveryLng: location?.lng ?? null,
        status: isScheduled ? 'scheduled' : 'pending',
        createdAt: firestore.FieldValue.serverTimestamp(),
        orderId: orderRef.id,
      };
      if (isScheduled && scheduledDate) {
        orderData.scheduledFor = firestore.Timestamp.fromDate(scheduledDate);
        orderData.isScheduled = true;
      }
      await orderRef.set(orderData);
      clearCart();
      navigation.reset({ index: 0, routes: [{ name: 'FoodOrderSuccess', params: { grandTotal, restaurantName, orderId: orderRef.id, isScheduled } }] });
    } catch (err: any) {
      Alert.alert('Error', `Failed to place order: ${err.message || 'Please try again.'}`);
    } finally {
      setPlacing(false);
    }
  };

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

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ADDRESS REQUIRED MODAL */}
      <Modal
        visible={showAddressModal}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalIconWrap}>
              <Ionicons name="location-outline" size={36} color={ORANGE} />
            </View>
            <Text style={s.modalTitle}>Address Required</Text>
            <Text style={s.modalSubtitle}>
              Please add a delivery address to continue with your order.
            </Text>
            <TouchableOpacity
              style={s.modalPrimaryBtn}
              activeOpacity={0.85}
              onPress={() => {
                setShowAddressModal(false);
                navigation.navigate('LocationSelector', { fromScreen: 'foodcheckout' });
              }}
            >
              <Ionicons name="add-circle-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
              <Text style={s.modalPrimaryText}>Add Address</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.modalSecondaryBtn}
              activeOpacity={0.85}
              onPress={() => {
                setShowAddressModal(false);
                navigation.goBack();
              }}
            >
              <Text style={s.modalSecondaryText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* HEADER */}
      <View style={s.header}>
        <TouchableOpacity style={s.backButton} onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Checkout</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>

        {/* DELIVERY ADDRESS */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Ionicons name="location" size={20} color={ORANGE} />
            <Text style={s.cardTitle}>Delivery Address</Text>
          </View>
          {deliveryAddress ? (
            <View style={s.addressRow}>
              <Text style={[s.addressText, { flex: 1 }]}>{deliveryAddress}</Text>
              <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={() => navigation.navigate('LocationSelector', { fromScreen: 'foodcheckout' })}>
                <Ionicons name="create-outline" size={20} color={ORANGE} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={s.addAddressBtn} onPress={() => navigation.navigate('LocationSelector', { fromScreen: 'foodcheckout' })}>
              <Ionicons name="add-circle" size={18} color={ORANGE} />
              <Text style={s.addAddressText}>Add delivery address</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ORDER SUMMARY */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Ionicons name="receipt" size={20} color={ORANGE} />
            <Text style={s.cardTitle}>Order Summary</Text>
          </View>
          <Text style={s.itemCount}>{cartItems.length} item{cartItems.length > 1 ? 's' : ''} · {restaurantName}</Text>

          {cartItems.map((item: any, idx: number) => (
            <View key={item.id}>
              {idx > 0 && <View style={s.itemDivider} />}
              <View style={s.itemRow}>
                {item.image
                  ? <Image source={{ uri: item.image }} style={s.itemImg} contentFit="cover" />
                  : <View style={[s.itemImg, s.itemImgPlaceholder]}><Ionicons name="fast-food-outline" size={16} color="#ddd" /></View>
                }
                <View style={s.itemInfo}>
                  <Text style={s.itemName} numberOfLines={1}>{item.name}</Text>
                  {!!item.variant && <Text style={s.itemVariant}>{item.variant}</Text>}
                  {!!item.addons?.length && item.addons.map((a: any, ai: number) => (
                    <Text key={ai} style={s.addonLine}>+ {a.name}</Text>
                  ))}
                </View>
                <View style={s.itemRight}>
                  <Text style={s.itemQty}>×{item.qty}</Text>
                  <Text style={s.itemPrice}>₹{item.price * item.qty}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* BILL DETAILS */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Ionicons name="receipt-outline" size={20} color={ORANGE} />
            <Text style={s.cardTitle}>Bill Details</Text>
          </View>

          <View style={s.billRow}>
            <Text style={s.billLabel}>Item Total</Text>
            <Text style={s.billValue}>₹{subtotal}</Text>
          </View>
          <View style={s.billRow}>
            <Text style={s.billLabel}>GST (5%)</Text>
            <Text style={s.billValue}>₹{gst}</Text>
          </View>
          <View style={s.billRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.billLabel}>Delivery Fee</Text>
              {deliveryFee === 0 && <Text style={s.billHint}>Free above ₹199</Text>}
            </View>
            <Text style={[s.billValue, deliveryFee === 0 && { color: GREEN, fontWeight: '700' }]}>
              {deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}
            </Text>
          </View>
          <View style={s.billRow}>
            <Text style={s.billLabel}>Platform Fee</Text>
            <Text style={s.billValue}>₹{platformFee}</Text>
          </View>
          <View style={s.billRow}>
            <Text style={s.billLabel}>Packaging Charges</Text>
            <Text style={s.billValue}>₹{packagingFee}</Text>
          </View>

          <View style={s.billDivider} />

          <View style={s.billTotalRow}>
            <Text style={s.billTotalLabel}>To Pay</Text>
            <Text style={s.billTotalValue}>₹{grandTotal}</Text>
          </View>

          {deliveryFee === 0 && (
            <View style={s.freeDeliveryBanner}>
              <Ionicons name="bicycle" size={14} color={GREEN} />
              <Text style={s.freeDeliveryText}>🎉 Yay! Free delivery on this order</Text>
            </View>
          )}
        </View>

        {/* DELIVERY TIME */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Ionicons name="time" size={20} color={ORANGE} />
            <Text style={s.cardTitle}>Delivery Time</Text>
          </View>

          <TouchableOpacity style={[s.scheduleOption, !isScheduled && s.scheduleOptionActive]} onPress={() => setIsScheduled(false)} activeOpacity={0.7}>
            <View style={s.scheduleLeft}>
              <Ionicons name="flash" size={20} color={!isScheduled ? ORANGE : GRAY} />
              <View style={s.scheduleInfo}>
                <Text style={[s.scheduleLabel, !isScheduled && { color: ORANGE }]}>Deliver Now</Text>
                <Text style={s.scheduleSub}>
                  {estimatedDeliveryMins
                    ? `~${estimatedDeliveryMins} mins${itemCount > 1 ? ` · ${itemCount} items` : ''}`
                    : '30-40 mins'}
                </Text>
              </View>
            </View>
            <Ionicons name={!isScheduled ? 'radio-button-on' : 'radio-button-off'} size={20} color={!isScheduled ? ORANGE : '#ccc'} />
          </TouchableOpacity>

          <TouchableOpacity style={[s.scheduleOption, isScheduled && s.scheduleOptionActive]} onPress={handleScheduleToggle} activeOpacity={0.7}>
            <View style={s.scheduleLeft}>
              <Ionicons name="calendar" size={20} color={isScheduled ? ORANGE : GRAY} />
              <View style={s.scheduleInfo}>
                <Text style={[s.scheduleLabel, isScheduled && { color: ORANGE }]}>Schedule Order</Text>
                <Text style={s.scheduleSub}>Choose your delivery time</Text>
              </View>
            </View>
            <Ionicons name={isScheduled ? 'radio-button-on' : 'radio-button-off'} size={20} color={isScheduled ? ORANGE : '#ccc'} />
          </TouchableOpacity>

          {isScheduled && scheduledDate && (
            <View style={s.scheduleTimeBox}>
              <View style={s.scheduleTimeButtons}>
                <TouchableOpacity style={s.scheduleTimeBtn} onPress={() => setShowDatePicker(true)}>
                  <Ionicons name="calendar-outline" size={14} color={ORANGE} />
                  <Text style={s.scheduleTimeBtnText}>{scheduledDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.scheduleTimeBtn} onPress={() => setShowTimePicker(true)}>
                  <Ionicons name="time-outline" size={14} color={ORANGE} />
                  <Text style={s.scheduleTimeBtnText}>{scheduledDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</Text>
                </TouchableOpacity>
              </View>
              <Text style={s.scheduleTimeSummary}>{formatScheduledTime()}</Text>
            </View>
          )}
        </View>

        {/* NOTE */}
        <View style={s.noteCard}>
          <Ionicons name="information-circle" size={16} color="#00695c" />
          <Text style={s.noteText}>No cash in hand? Our rider carries a QR code — pay instantly with any UPI app at the doorstep.</Text>
        </View>

      </ScrollView>

      {/* PAY NOW BUTTON */}
      <View style={s.footer}>
        <View style={s.footerLeft}>
          <Text style={s.footerTotal}>₹{grandTotal}</Text>
          <Text style={s.footerSub}>Total · {isScheduled ? 'Scheduled' : 'Deliver Now'}</Text>
        </View>
        <TouchableOpacity style={s.payNowBtn} onPress={() => setShowPayModal(true)} activeOpacity={0.88}>
          <Text style={s.payNowText}>Pay Now</Text>
          <Animated.View style={{ transform: [{ translateX: arrowX }] }}>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Animated.View>
        </TouchableOpacity>
      </View>

      {/* DATE / TIME PICKERS */}
      {showDatePicker && (
        <DateTimePicker value={scheduledDate || new Date()} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={handleDateChange} minimumDate={new Date()} maximumDate={new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)} />
      )}
      {showTimePicker && (
        <DateTimePicker value={scheduledDate || new Date()} mode="time" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={handleTimeChange} minuteInterval={15} />
      )}

      {/* LOGIN REQUIRED MODAL */}
      <Modal
        visible={showLoginModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLoginModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={[s.modalIconWrap, { backgroundColor: '#FFF3E0' }]}>
              <Ionicons name="person-outline" size={36} color={ORANGE} />
            </View>
            <Text style={s.modalTitle}>Login Required</Text>
            <Text style={s.modalSubtitle}>
              Please login to place your order and enjoy delicious food delivered to your doorstep.
            </Text>
            <TouchableOpacity
              style={s.modalPrimaryBtn}
              activeOpacity={0.85}
              onPress={() => {
                setShowLoginModal(false);
                navigation.navigate('LoginInHomeStack' as never);
              }}
            >
              <Ionicons name="log-in-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
              <Text style={s.modalPrimaryText}>Login Now</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.modalSecondaryBtn}
              activeOpacity={0.85}
              onPress={() => setShowLoginModal(false)}
            >
              <Text style={s.modalSecondaryText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
          <View style={s.loadingContainer}>
            <ActivityIndicator size="large" color={ORANGE} />
            <Text style={s.loadingText}>Placing your order...</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#f8f9fa' },
  scrollView: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e9ecef',
  },
  backButton:  { padding: 8 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '600', color: '#333', textAlign: 'center', marginRight: 40 },

  card: {
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 10,
    borderRadius: 12, padding: 12,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  cardTitle:  { fontSize: 14, fontWeight: '600', color: '#333', marginLeft: 8 },

  addressRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  addressText:    { fontSize: 13, color: '#555', lineHeight: 19 },
  addAddressBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, backgroundColor: '#fff5f0', borderRadius: 10, borderWidth: 1.5, borderColor: ORANGE, borderStyle: 'dashed' },
  addAddressText: { fontSize: 13, fontWeight: '600', color: ORANGE },

  itemCount:   { fontSize: 11, color: '#666', marginBottom: 6 },
  itemDivider: { height: 1, backgroundColor: '#f5f5f5', marginVertical: 5 },
  itemRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemImg:     { width: 38, height: 38, borderRadius: 7 },
  itemImgPlaceholder: { backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  itemInfo:    { flex: 1 },
  itemName:    { fontSize: 13, fontWeight: '600', color: '#333' },
  itemVariant: { fontSize: 11, color: GRAY, marginTop: 1 },
  addonLine:   { fontSize: 10, color: ORANGE, marginTop: 1 },
  itemRight:   { alignItems: 'flex-end' },
  itemQty:     { fontSize: 12, color: GRAY },
  itemPrice:   { fontSize: 13, fontWeight: '600', color: DARK },

  scheduleOption:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, marginBottom: 6, borderWidth: 1, borderColor: '#e9ecef', backgroundColor: '#fafafa' },
  scheduleOptionActive: { borderColor: ORANGE, backgroundColor: '#fff5f0' },
  scheduleLeft:         { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  scheduleInfo:         { flex: 1 },
  scheduleLabel: { fontSize: 13, fontWeight: '500', color: '#333' },
  scheduleSub:   { fontSize: 10, color: '#666', marginTop: 1 },
  scheduleTimeBox:      { backgroundColor: '#fff5f0', padding: 10, borderRadius: 10, marginTop: 4, borderWidth: 1, borderColor: ORANGE },
  scheduleTimeButtons:  { flexDirection: 'row', gap: 8, marginBottom: 8 },
  scheduleTimeBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#fff', paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: ORANGE },
  scheduleTimeBtnText:  { fontSize: 12, fontWeight: '600', color: DARK },
  scheduleTimeSummary:  { fontSize: 13, fontWeight: '700', color: ORANGE, textAlign: 'center' },

  noteCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e0f2f1', marginHorizontal: 16, marginTop: 10, marginBottom: 4, borderRadius: 8, padding: 10 },
  noteText:  { flex: 1, fontSize: 12, color: '#00695c', marginLeft: 8, lineHeight: 16 },

  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: '#e9ecef',
    elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.08, shadowRadius: 8,
  },
  footerLeft:  { flex: 1 },
  footerTotal: { fontSize: 20, fontWeight: '800', color: DARK },
  footerSub:   { fontSize: 11, color: GRAY, marginTop: 2 },
  payNowBtn:   { backgroundColor: ORANGE, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 14, elevation: 4, shadowColor: ORANGE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  payNowText:  { fontSize: 15, fontWeight: '700', color: '#fff' },

  loadingOverlay:   { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  loadingContainer: { backgroundColor: '#fff', borderRadius: 12, padding: 24, alignItems: 'center' },
  loadingText:      { marginTop: 12, fontSize: 14, color: '#333' },

  /* bill */
  billRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 },
  billLabel:      { fontSize: 12, color: GRAY, fontWeight: '500' },
  billHint:       { fontSize: 10, color: GREEN, marginTop: 1 },
  billValue:      { fontSize: 12, color: DARK, fontWeight: '600' },
  billDivider:    { height: 1, backgroundColor: '#f0f0f0', marginVertical: 6 },
  billTotalRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6 },
  billTotalLabel: { fontSize: 14, fontWeight: '700', color: DARK },
  billTotalValue: { fontSize: 15, fontWeight: '800', color: ORANGE },
  freeDeliveryBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f0fdf4', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, marginTop: 10 },
  freeDeliveryText:   { fontSize: 12, fontWeight: '600', color: GREEN, flex: 1 },

  // Address Required Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28,
  },
  modalCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 28,
    alignItems: 'center', width: '100%',
    elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12,
  },
  modalIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#fff5ec', justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: DARK, marginBottom: 8, textAlign: 'center' },
  modalSubtitle: { fontSize: 14, color: GRAY, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  modalPrimaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: ORANGE, borderRadius: 12, paddingVertical: 14,
    width: '100%', marginBottom: 10,
  },
  modalPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  modalSecondaryBtn: {
    borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 12,
    paddingVertical: 13, width: '100%', alignItems: 'center',
  },
  modalSecondaryText: { color: GRAY, fontSize: 15, fontWeight: '600' },
});
