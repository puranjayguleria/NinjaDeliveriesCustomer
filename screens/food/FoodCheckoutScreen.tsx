import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Platform, StatusBar, Animated,
} from 'react-native';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useFoodCart } from '@/context/FoodCartContext';
import { useLocationContext } from '@/context/LocationContext';
import { Image } from 'expo-image';

const ORANGE = '#FC8019';
const DARK   = '#282C3F';
const GRAY   = '#93959F';
const GREEN  = '#3d9b6d';
const BG     = '#f2f2f7';

const PAYMENT_METHODS = [
  { id: 'Cash on Delivery', label: 'Cash on Delivery', sub: 'Pay when your order arrives', icon: 'cash-outline' as const },
  { id: 'UPI',              label: 'UPI',              sub: 'GPay, PhonePe, Paytm & more',  icon: 'phone-portrait-outline' as const },
  { id: 'Card',             label: 'Credit / Debit Card', sub: 'Visa, Mastercard, RuPay',   icon: 'card-outline' as const },
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
  const [instructions, setInstructions] = useState('');
  const [placing, setPlacing] = useState(false);

  const deliveryAddress = location?.address || '';
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

    setPlacing(true);
    try {
      const restaurantId = cartItems[0]?.restaurantId ?? '';
      const orderRef = firestore().collection('restaurant_Orders').doc();
      await orderRef.set({
        userId: user.uid, userPhone: user.phoneNumber ?? '',
        restaurantId, restaurantName,
        items: cartItems.map((item: any) => ({
          id: item.id, name: item.name, price: item.price, qty: item.qty,
          variant: item.variant ?? null, addons: item.addons ?? [], image: item.image ?? null,
        })),
        subtotal, deliveryFee, taxes, grandTotal,
        paymentMethod, instructions: instructions.trim(),
        deliveryAddress, deliveryLat: location?.lat ?? null, deliveryLng: location?.lng ?? null,
        status: 'pending',
        createdAt: firestore.FieldValue.serverTimestamp(),
        orderId: orderRef.id,
      });
      clearCart();
      navigation.reset({
        index: 0,
        routes: [{ name: 'FoodOrderSuccess', params: { grandTotal, restaurantName, orderId: orderRef.id } }],
      });
    } catch (err) {
      console.error('[FoodCheckout] order error:', err);
      Alert.alert('Error', 'Failed to place order. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ── HEADER ── */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color={DARK} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Checkout</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── DELIVERY ADDRESS ── */}
        <SectionCard>
          <View style={s.sectionHeader}>
            <View style={s.sectionIconWrap}>
              <Ionicons name="location" size={16} color={ORANGE} />
            </View>
            <Text style={s.sectionTitle}>Delivery Address</Text>
          </View>
          {deliveryAddress ? (
            <View style={s.addressBlock}>
              <View style={s.addressDot} />
              <View style={{ flex: 1 }}>
                <Text style={s.addressType}>Home</Text>
                <Text style={s.addressText}>{deliveryAddress}</Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={s.addAddressBtn} activeOpacity={0.8}>
              <Ionicons name="add-circle-outline" size={18} color={ORANGE} />
              <Text style={s.addAddressTxt}>Add delivery address</Text>
            </TouchableOpacity>
          )}
        </SectionCard>

        {/* ── ORDER ITEMS ── */}
        <SectionCard>
          <View style={s.sectionHeader}>
            <View style={s.sectionIconWrap}>
              <Ionicons name="restaurant" size={16} color={ORANGE} />
            </View>
            <Text style={s.sectionTitle}>{restaurantName || 'Your Order'}</Text>
            <Text style={s.itemCount}>{cartItems.length} item{cartItems.length !== 1 ? 's' : ''}</Text>
          </View>

          {cartItems.map((item: any, idx: number) => (
            <View key={item.id}>
              <View style={s.orderItem}>
                <View style={s.vegIndicator}>
                  <View style={s.vegDot} />
                </View>
                <Text style={s.orderItemQty}>{item.qty}×</Text>
                <Text style={s.orderItemName} numberOfLines={1}>{item.name}</Text>
                {item.image ? (
                  <Image source={{ uri: item.image }} style={s.orderItemImg} contentFit="cover" />
                ) : null}
                <Text style={s.orderItemPrice}>₹{item.price * item.qty}</Text>
              </View>
              {idx < cartItems.length - 1 && <View style={s.itemDivider} />}
            </View>
          ))}
        </SectionCard>

        {/* ── COOKING INSTRUCTIONS ── */}
        <SectionCard>
          <View style={s.sectionHeader}>
            <View style={s.sectionIconWrap}>
              <Ionicons name="pencil" size={15} color={ORANGE} />
            </View>
            <Text style={s.sectionTitle}>Cooking Instructions</Text>
            <Text style={s.optionalTag}>Optional</Text>
          </View>
          <TextInput
            style={s.instrInput}
            placeholder="e.g. Less spicy, no onions, extra sauce..."
            placeholderTextColor="#c0c0c0"
            value={instructions}
            onChangeText={setInstructions}
            multiline
            maxLength={200}
          />
        </SectionCard>

        {/* ── PAYMENT METHOD ── */}
        <SectionCard>
          <View style={s.sectionHeader}>
            <View style={s.sectionIconWrap}>
              <Ionicons name="wallet" size={16} color={ORANGE} />
            </View>
            <Text style={s.sectionTitle}>Payment Method</Text>
          </View>

          {PAYMENT_METHODS.map((method, idx) => {
            const selected = paymentMethod === method.id;
            return (
              <TouchableOpacity
                key={method.id}
                style={[s.payRow, idx < PAYMENT_METHODS.length - 1 && s.payRowBorder]}
                onPress={() => setPaymentMethod(method.id)}
                activeOpacity={0.75}
              >
                <View style={[s.payIconBox, selected && s.payIconBoxActive]}>
                  <Ionicons name={method.icon} size={18} color={selected ? ORANGE : GRAY} />
                </View>
                <View style={s.payInfo}>
                  <Text style={[s.payLabel, selected && s.payLabelActive]}>{method.label}</Text>
                  <Text style={s.paySub}>{method.sub}</Text>
                </View>
                <View style={[s.radio, selected && s.radioActive]}>
                  {selected && <View style={s.radioDot} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </SectionCard>

        {/* ── BILL SUMMARY ── */}
        <SectionCard>
          <View style={s.sectionHeader}>
            <View style={s.sectionIconWrap}>
              <Ionicons name="receipt" size={15} color={ORANGE} />
            </View>
            <Text style={s.sectionTitle}>Bill Details</Text>
          </View>

          <View style={s.billRow}>
            <Text style={s.billLbl}>Item Total</Text>
            <Text style={s.billVal}>₹{subtotal}</Text>
          </View>
          <View style={s.billRow}>
            <Text style={s.billLbl}>Delivery Fee</Text>
            <Text style={[s.billVal, deliveryFee === 0 && { color: GREEN, fontWeight: '700' }]}>
              {deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}
            </Text>
          </View>
          <View style={s.billRow}>
            <Text style={s.billLbl}>Taxes & Charges</Text>
            <Text style={s.billVal}>₹{taxes}</Text>
          </View>
          <View style={s.billSep} />
          <View style={s.billRow}>
            <Text style={s.billTotalLbl}>To Pay</Text>
            <Text style={s.billTotalVal}>₹{grandTotal}</Text>
          </View>
        </SectionCard>

        {/* ── SAFETY NOTE ── */}
        <View style={s.safetyNote}>
          <Ionicons name="shield-checkmark" size={14} color={GREEN} />
          <Text style={s.safetyTxt}>100% safe & secure payments</Text>
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>

      {/* ── PLACE ORDER FOOTER ── */}
      <View style={[s.footer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 16 }]}>
        <View style={s.footerTop}>
          <Text style={s.footerPayMode}>{paymentMethod}</Text>
          <Text style={s.footerTotal}>₹{grandTotal}</Text>
        </View>
        <TouchableOpacity
          style={[s.placeBtn, placing && { opacity: 0.7 }]}
          onPress={placeOrder}
          disabled={placing}
          activeOpacity={0.88}
        >
          {placing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <View style={s.placeBtnLeft}>
                <View style={s.placeBtnBadge}>
                  <Text style={s.placeBtnBadgeTxt}>{cartItems.length}</Text>
                </View>
                <Text style={s.placeBtnLabel}>Place Order</Text>
              </View>
              <View style={s.placeBtnRight}>
                <Text style={s.placeBtnPrice}>₹{grandTotal}</Text>
                <Animated.View style={{ transform: [{ translateX: arrowX }], marginLeft: 2 }}>
                  <Ionicons name="chevron-forward" size={16} color="#fff" />
                </Animated.View>
              </View>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ── Small helper wrapper ── */
function SectionCard({ children }: { children: React.ReactNode }) {
  return <View style={s.card}>{children}</View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  /* header */
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  backBtn:     { width: 36, padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: DARK },

  /* card */
  card: {
    backgroundColor: '#fff', marginHorizontal: 12, marginTop: 10,
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },

  /* section header */
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  sectionIconWrap: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: '#fff5f0', justifyContent: 'center', alignItems: 'center',
    marginRight: 10,
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: DARK, flex: 1 },
  itemCount:    { fontSize: 12, color: GRAY, fontWeight: '500' },
  optionalTag:  { fontSize: 11, color: GRAY, fontStyle: 'italic' },

  /* address */
  addressBlock: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  addressDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: GREEN, marginTop: 4, flexShrink: 0,
  },
  addressType: { fontSize: 13, fontWeight: '700', color: DARK, marginBottom: 3 },
  addressText: { fontSize: 13, color: GRAY, lineHeight: 19 },
  addAddressBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  addAddressTxt: { fontSize: 13, fontWeight: '600', color: ORANGE },

  /* order items */
  orderItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 },
  vegIndicator: {
    width: 14, height: 14, borderRadius: 3,
    borderWidth: 1.5, borderColor: GREEN,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  vegDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GREEN },
  orderItemQty:  { fontSize: 13, fontWeight: '700', color: ORANGE, width: 24 },
  orderItemName: { flex: 1, fontSize: 13, color: DARK, fontWeight: '500' },
  orderItemImg:  { width: 40, height: 36, borderRadius: 6 },
  orderItemPrice: { fontSize: 13, fontWeight: '700', color: DARK, marginLeft: 8 },
  itemDivider: { height: 1, backgroundColor: '#f5f5f5', marginVertical: 2 },

  /* instructions */
  instrInput: {
    borderWidth: 1, borderColor: '#ebebeb', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 13, color: DARK, minHeight: 70,
    textAlignVertical: 'top', backgroundColor: '#fafafa',
  },

  /* payment */
  payRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  payRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  payIconBox: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#ebebeb',
  },
  payIconBoxActive: { backgroundColor: '#fff5f0', borderColor: '#ffd4b3' },
  payInfo:      { flex: 1 },
  payLabel:     { fontSize: 14, fontWeight: '600', color: DARK },
  payLabelActive: { color: ORANGE },
  paySub:       { fontSize: 11, color: GRAY, marginTop: 2 },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: '#d0d0d0',
    justifyContent: 'center', alignItems: 'center',
  },
  radioActive: { borderColor: ORANGE },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: ORANGE },

  /* bill */
  billRow:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  billLbl:      { fontSize: 13, color: GRAY },
  billVal:      { fontSize: 13, color: DARK, fontWeight: '500' },
  billSep:      { height: 1, backgroundColor: '#f0f0f0', marginBottom: 10 },
  billTotalLbl: { fontSize: 14, fontWeight: '800', color: DARK },
  billTotalVal: { fontSize: 14, fontWeight: '800', color: ORANGE },

  /* safety */
  safetyNote: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 14,
  },
  safetyTxt: { fontSize: 12, color: GREEN, fontWeight: '500' },

  /* footer */
  footer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#ebebeb',
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 12,
  },
  footerTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10,
  },
  footerPayMode: { fontSize: 12, color: GRAY, fontWeight: '500' },
  footerTotal:   { fontSize: 13, fontWeight: '800', color: DARK },

  placeBtn: {
    backgroundColor: ORANGE, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  placeBtnLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  placeBtnBadge: {
    width: 22, height: 22, borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.18)',
    justifyContent: 'center', alignItems: 'center',
  },
  placeBtnBadgeTxt: { fontSize: 11, fontWeight: '800', color: '#fff' },
  placeBtnLabel:    { fontSize: 15, fontWeight: '700', color: '#fff' },
  placeBtnRight:    { flexDirection: 'row', alignItems: 'center' },
  placeBtnPrice:    { fontSize: 15, fontWeight: '800', color: '#fff' },
});
