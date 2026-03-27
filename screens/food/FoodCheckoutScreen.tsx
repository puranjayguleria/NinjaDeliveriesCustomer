import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Platform, StatusBar, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
        paymentMethod,
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

      {/* ── PLACE ORDER FOOTER ── */}
      <View style={[s.footer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 12 }]}>
        <View style={s.footerContent}>
          <View style={s.footerLeft}>
            <Text style={s.footerTotal}>₹{grandTotal}</Text>
            <Text style={s.footerSubtext}>{paymentMethod}</Text>
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
});
