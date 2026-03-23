import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, StatusBar, TextInput, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useFoodCart } from '@/context/FoodCartContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ORANGE     = '#FC8019';
const DARK       = '#282C3F';
const GRAY       = '#93959F';
const GREEN      = '#3d9b6d';
const TAB_BAR_H  = Platform.OS === 'ios' ? 82 : 64;
const FOOTER_H   = 64;

export default function FoodCartScreen() {
  const navigation = useNavigation<any>();
  const insets     = useSafeAreaInsets();
  const { cartItems, addItem, removeItem, totalItems, totalPrice, clearCart } = useFoodCart();
  const [instructions, setInstructions] = useState('');

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

  const deliveryFee = totalPrice >= 199 ? 0 : 30;
  const taxes       = Math.round(totalPrice * 0.05);
  const grandTotal  = totalPrice + deliveryFee + taxes;
  const footerH     = FOOTER_H + (insets.bottom > 0 ? insets.bottom : 12) + 10;
  const bottomPad   = footerH + 16;

  /* ── EMPTY STATE ── */
  if (cartItems.length === 0) {
    return (
      <View style={s.emptyRoot}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={[s.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={22} color={DARK} />
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>Cart</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>
        <View style={s.emptyBody}>
          <Ionicons name="bag-outline" size={72} color="#e8e8e8" />
          <Text style={s.emptyTitle}>Your cart is empty</Text>
          <Text style={s.emptySub}>Add items from a restaurant to start an order</Text>
          <TouchableOpacity style={s.browseBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <Text style={s.browseBtnTxt}>Browse Restaurants</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const restaurantName = cartItems[0]?.restaurantName ?? 'Restaurant';

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ── HEADER ── */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color={DARK} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Cart</Text>
          <Text style={s.headerSub} numberOfLines={1}>{restaurantName}</Text>
        </View>
        <TouchableOpacity onPress={clearCart} hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }}>
          <Text style={s.clearTxt}>Clear</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>

        {/* ══ WHITE BLOCK: items + instructions + bill ══ */}
        <View style={s.block}>

          {/* restaurant label */}
          <Text style={s.blockLabel}>{restaurantName}</Text>

          {/* ── ITEMS ── */}
          {cartItems.map((item, idx) => (
            <View key={item.id}>
              <View style={s.itemRow}>
                <View style={s.vegBox}><View style={s.vegDot} /></View>

                <View style={s.itemInfo}>
                  <Text style={s.itemName} numberOfLines={2}>{item.name}</Text>
                  {!!item.variant && <Text style={s.itemMeta}>{item.variant}</Text>}
                  <Text style={s.itemPrice}>₹{item.price * item.qty}</Text>
                </View>

                <View style={s.itemRight}>
                  {item.image
                    ? <Image source={{ uri: item.image }} style={s.itemImg} contentFit="cover" />
                    : <View style={[s.itemImg, s.imgFallback]}><Ionicons name="fast-food-outline" size={20} color="#ccc" /></View>
                  }
                  <View style={s.stepper}>
                    <TouchableOpacity style={s.stepBtn} onPress={() => removeItem(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="remove" size={13} color={ORANGE} />
                    </TouchableOpacity>
                    <Text style={s.stepQty}>{item.qty}</Text>
                    <TouchableOpacity style={s.stepBtn} onPress={() => addItem({ ...item })} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="add" size={13} color={ORANGE} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
              {idx < cartItems.length - 1 && <View style={s.rowDivider} />}
            </View>
          ))}

          {/* add more */}
          <TouchableOpacity style={s.addMoreRow} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Ionicons name="add-circle-outline" size={16} color={ORANGE} />
            <Text style={s.addMoreTxt}>Add more items</Text>
          </TouchableOpacity>

          <View style={s.blockDivider} />

          {/* ── DELIVERY INFO ── */}
          <View style={s.deliveryRow}>
            <Ionicons
              name={deliveryFee === 0 ? 'bicycle' : 'bicycle-outline'}
              size={16}
              color={deliveryFee === 0 ? GREEN : ORANGE}
            />
            <Text style={[s.deliveryTxt, { color: deliveryFee === 0 ? GREEN : ORANGE }]}>
              {deliveryFee === 0
                ? 'Free delivery on this order 🎉'
                : `Add ₹${199 - totalPrice} more for free delivery`}
            </Text>
          </View>

          <View style={s.blockDivider} />

          {/* ── COOKING INSTRUCTIONS ── */}
          <View style={s.instrRow}>
            <Ionicons name="pencil-outline" size={14} color={GRAY} />
            <Text style={s.instrLabel}>Cooking Instructions</Text>
            <Text style={s.instrOpt}>Optional</Text>
          </View>
          <TextInput
            style={s.instrInput}
            placeholder="e.g. Less spicy, no onions..."
            placeholderTextColor="#c0c0c0"
            value={instructions}
            onChangeText={setInstructions}
            multiline
            maxLength={200}
          />

          <View style={s.blockDivider} />

          {/* ── BILL DETAILS ── */}
          <Text style={s.billTitle}>Bill Details</Text>

          <View style={s.billRow}>
            <Text style={s.billLbl}>Item Total</Text>
            <Text style={s.billVal}>₹{totalPrice}</Text>
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

        </View>
        {/* ══ END WHITE BLOCK ══ */}

      </ScrollView>

      {/* ── FOOTER ── */}
      <View style={[s.footer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 12 }]}>
        <TouchableOpacity
          style={s.checkoutBtn}
          activeOpacity={0.88}
          onPress={() => navigation.navigate('FoodCheckout', { cartItems, subtotal: totalPrice, deliveryFee, taxes, grandTotal })}
        >
          <View style={s.badge}>
            <Text style={s.badgeTxt}>{totalItems}</Text>
          </View>
          <Text style={s.checkoutLbl}>Proceed to Checkout</Text>
          <View style={s.checkoutRight}>
            <Text style={s.checkoutPrice}>₹{grandTotal}</Text>
            <Animated.View style={{ transform: [{ translateX: arrowX }], marginLeft: 3 }}>
              <Ionicons name="chevron-forward" size={16} color="#fff" />
            </Animated.View>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: '#f2f2f7' },
  emptyRoot: { flex: 1, backgroundColor: '#fff' },

  /* header */
  header: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  backBtn:      { width: 36, paddingBottom: 2 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle:  { fontSize: 17, fontWeight: '800', color: DARK },
  headerSub:    { fontSize: 12, color: GRAY, marginTop: 2 },
  clearTxt:     { fontSize: 13, color: '#f44336', fontWeight: '600', paddingBottom: 2, width: 36, textAlign: 'right' },

  /* empty */
  emptyBody:  { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 36 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: DARK, marginTop: 20, marginBottom: 8 },
  emptySub:   { fontSize: 13, color: GRAY, textAlign: 'center', lineHeight: 20 },
  browseBtn:  { marginTop: 28, backgroundColor: ORANGE, paddingHorizontal: 32, paddingVertical: 13, borderRadius: 10 },
  browseBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },

  /* single white block */
  block: {
    backgroundColor: '#fff',
    marginTop: 10,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  blockLabel: { fontSize: 13, fontWeight: '800', color: DARK, marginBottom: 14 },
  blockDivider: { height: 1, backgroundColor: '#f2f2f2', marginVertical: 14 },

  /* item row */
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 2 },
  vegBox: {
    width: 15, height: 15, borderRadius: 3,
    borderWidth: 1.5, borderColor: GREEN,
    justifyContent: 'center', alignItems: 'center',
    marginTop: 3, marginRight: 10, flexShrink: 0,
  },
  vegDot:    { width: 7, height: 7, borderRadius: 4, backgroundColor: GREEN },
  itemInfo:  { flex: 1, paddingRight: 10 },
  itemName:  { fontSize: 13, fontWeight: '600', color: DARK, lineHeight: 19 },
  itemMeta:  { fontSize: 11, color: GRAY, marginTop: 2 },
  itemPrice: { fontSize: 13, fontWeight: '700', color: DARK, marginTop: 5 },

  itemRight:  { alignItems: 'center', width: 76 },
  itemImg:    { width: 76, height: 66, borderRadius: 8 },
  imgFallback: { backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },

  stepper: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: ORANGE, borderRadius: 6,
    marginTop: 6, overflow: 'hidden', alignSelf: 'center', backgroundColor: '#fff',
  },
  stepBtn: { paddingHorizontal: 7, paddingVertical: 4 },
  stepQty: { fontSize: 12, fontWeight: '800', color: DARK, minWidth: 16, textAlign: 'center' },

  rowDivider: { height: 1, backgroundColor: '#f5f5f5', marginVertical: 12 },

  addMoreRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingTop: 12, marginTop: 8,
    borderTopWidth: 1, borderTopColor: '#f5f5f5',
  },
  addMoreTxt: { fontSize: 13, fontWeight: '700', color: ORANGE },

  /* delivery */
  deliveryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deliveryTxt: { fontSize: 12, fontWeight: '600' },

  /* instructions */
  instrRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  instrLabel: { fontSize: 13, fontWeight: '700', color: DARK },
  instrOpt:   { fontSize: 11, color: GRAY, marginLeft: 2 },
  instrInput: {
    borderWidth: 1, borderColor: '#ebebeb', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 13, color: DARK, minHeight: 64,
    textAlignVertical: 'top', backgroundColor: '#fafafa',
  },

  /* bill */
  billTitle:    { fontSize: 13, fontWeight: '800', color: DARK, marginBottom: 14 },
  billRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 11 },
  billLbl:      { fontSize: 13, color: GRAY },
  billVal:      { fontSize: 13, color: DARK },
  billSep:      { height: 1, backgroundColor: '#f0f0f0', marginBottom: 11 },
  billTotalLbl: { fontSize: 14, fontWeight: '800', color: DARK },
  billTotalVal: { fontSize: 14, fontWeight: '800', color: DARK },

  /* footer */
  footer: {
    backgroundColor: '#fff',
    paddingHorizontal: 14, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: '#ebebeb',
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 12,
  },
  checkoutBtn: {
    backgroundColor: ORANGE, borderRadius: 10,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  badge: {
    width: 22, height: 22, borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.18)',
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  badgeTxt:      { fontSize: 11, fontWeight: '800', color: '#fff' },
  checkoutLbl:   { flex: 1, fontSize: 14, fontWeight: '700', color: '#fff' },
  checkoutRight: { flexDirection: 'row', alignItems: 'center' },
  checkoutPrice: { fontSize: 14, fontWeight: '800', color: '#fff' },
});
