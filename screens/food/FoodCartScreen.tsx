import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, StatusBar, Animated,
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

  /* ── EMPTY STATE ── */
  if (cartItems.length === 0) {
    return (
      <View style={s.emptyRoot}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={[s.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={24} color={DARK} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>My Cart</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.emptyBody}>
          <View style={s.emptyIconCircle}>
            <Ionicons name="cart-outline" size={64} color={ORANGE} />
          </View>
          <Text style={s.emptyTitle}>Your cart is empty</Text>
          <Text style={s.emptySub}>Looks like you haven't added{'\n'}anything to your cart yet</Text>
          <TouchableOpacity style={s.browseBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <Ionicons name="restaurant" size={18} color="#fff" style={{ marginRight: 6 }} />
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
          <Ionicons name="arrow-back" size={24} color={DARK} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>My Cart</Text>
          <Text style={s.headerSub} numberOfLines={1}>{restaurantName}</Text>
        </View>
        <TouchableOpacity onPress={clearCart} style={s.clearBtn} hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }}>
          <Ionicons name="trash-outline" size={20} color="#f44336" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={{ flex: 1 }} 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingBottom: footerH + 16 }}
      >
        {/* ── ITEMS CARD ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Ionicons name="restaurant" size={18} color={ORANGE} />
            <Text style={s.cardTitle}>{restaurantName}</Text>
            <View style={s.itemCountBadge}>
              <Text style={s.itemCountText}>{totalItems} {totalItems === 1 ? 'item' : 'items'}</Text>
            </View>
          </View>

          {/* ── ITEMS LIST ── */}
          {cartItems.map((item, idx) => (
            <View key={item.id}>
              {idx > 0 && <View style={s.itemDivider} />}
              
              <View style={s.itemCard}>
                <View style={s.itemMain}>
                  <View style={s.itemLeft}>
                    <View style={s.vegBox}><View style={s.vegDot} /></View>
                    <View style={s.itemDetails}>
                      <Text style={s.itemName}>{item.name}</Text>
                      {!!item.variant && (
                        <View style={s.variantBadge}>
                          <Text style={s.variantText}>{item.variant}</Text>
                        </View>
                      )}
                      {!!item.description && (
                        <Text style={s.itemDesc} numberOfLines={2}>{item.description}</Text>
                      )}
                      {(() => {
                        const h = Number(item.cookingTimeHours ?? 0);
                        const m = Number(item.cookingTimeMinutes ?? 0);
                        if (h === 0 && m === 0) return null;
                        const timeStr = h > 0 && m > 0 ? `${h}h ${m}m` : h > 0 ? `${h} hr` : `${m} mins`;
                        return (
                          <View style={s.itemTimeRow}>
                            <Ionicons name="time-outline" size={11} color="#94a3b8" />
                            <Text style={s.itemTimeText}>{timeStr}</Text>
                          </View>
                        );
                      })()}
                      <Text style={s.itemPrice}>₹{item.price * item.qty}</Text>
                    </View>
                  </View>

                  <View style={s.itemRight}>
                    {item.image ? (
                      <Image source={{ uri: item.image }} style={s.itemImg} contentFit="cover" />
                    ) : (
                      <View style={[s.itemImg, s.imgFallback]}>
                        <Ionicons name="fast-food-outline" size={24} color="#ddd" />
                      </View>
                    )}
                    <View style={s.stepper}>
                      <TouchableOpacity 
                        style={s.stepBtn} 
                        onPress={() => removeItem(item.id)} 
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="remove" size={16} color={ORANGE} />
                      </TouchableOpacity>
                      <Text style={s.stepQty}>{item.qty}</Text>
                      <TouchableOpacity 
                        style={s.stepBtn} 
                        onPress={() => addItem({ ...item })} 
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="add" size={16} color={ORANGE} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* Add-ons */}
                {!!item.addons && item.addons.length > 0 && (
                  <View style={s.addonsSection}>
                    <View style={s.addonsDivider} />
                    <View style={s.addonsTitleRow}>
                      <Text style={s.addonsTitle}>Add-ons</Text>
                      <Text style={s.addonsTotalPrice}>
                        +₹{(item.addons.reduce((sum, addon) => sum + addon.price, 0) * item.qty)}
                      </Text>
                    </View>
                    {item.addons.map((addon, addonIdx) => (
                      <View key={addonIdx} style={s.addonRow}>
                        {addon.image ? (
                          <Image source={{ uri: addon.image }} style={s.addonImg} contentFit="cover" />
                        ) : (
                          <View style={s.addonImgPlaceholder}>
                            <Ionicons name="add-circle" size={12} color={ORANGE} />
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
          ))}

          {/* Add More Button */}
          <TouchableOpacity style={s.addMoreBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Ionicons name="add-circle" size={20} color={ORANGE} />
            <Text style={s.addMoreText}>Add more items</Text>
          </TouchableOpacity>
        </View>

        {/* ── DELIVERY INFO CARD ── */}
        <View style={s.card}>
          <View style={s.deliveryInfo}>
            <Ionicons 
              name={deliveryFee === 0 ? 'bicycle' : 'bicycle-outline'} 
              size={20} 
              color={deliveryFee === 0 ? GREEN : ORANGE} 
            />
            <Text style={[s.deliveryText, { color: deliveryFee === 0 ? GREEN : ORANGE }]}>
              {deliveryFee === 0
                ? '🎉 Yay! Free delivery on this order'
                : `Add ₹${199 - totalPrice} more for free delivery`}
            </Text>
          </View>
        </View>

        {/* ── BILL DETAILS CARD ── */}
        <View style={s.card}>
          <View style={s.billHeader}>
            <Ionicons name="receipt-outline" size={18} color={DARK} />
            <Text style={s.billTitle}>Bill Details</Text>
          </View>

          <View style={s.billRow}>
            <Text style={s.billLabel}>Item Total</Text>
            <Text style={s.billValue}>₹{totalPrice}</Text>
          </View>
          
          <View style={s.billRow}>
            <View style={s.billLabelRow}>
              <Text style={s.billLabel}>Delivery Fee</Text>
              {totalPrice < 199 && (
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
            <Text style={s.billTotalLabel}>To Pay</Text>
            <Text style={s.billTotalValue}>₹{grandTotal}</Text>
          </View>
        </View>

      </ScrollView>

      {/* ── CHECKOUT FOOTER ── */}
      <View style={[s.footer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 12 }]}>
        <View style={s.footerContent}>
          <View style={s.footerLeft}>
            <Text style={s.footerTotal}>₹{grandTotal}</Text>
            <Text style={s.footerSubtext}>Total amount</Text>
          </View>
          <TouchableOpacity
            style={s.checkoutBtn}
            activeOpacity={0.88}
            onPress={() => navigation.navigate('FoodCheckout', { 
              cartItems, subtotal: totalPrice, deliveryFee, taxes, grandTotal 
            })}
          >
            <Text style={s.checkoutText}>Proceed to Checkout</Text>
            <Animated.View style={{ transform: [{ translateX: arrowX }] }}>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </Animated.View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: '#f8f9fa' },
  emptyRoot: { flex: 1, backgroundColor: '#fff' },

  /* header */
  header: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  backBtn:      { width: 40, paddingBottom: 2 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle:  { fontSize: 18, fontWeight: '800', color: DARK },
  headerSub:    { fontSize: 12, color: GRAY, marginTop: 2 },
  clearBtn:     { width: 40, alignItems: 'flex-end', paddingBottom: 2 },

  /* empty */
  emptyBody:  { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 36 },
  emptyIconCircle: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: '#fff5f0', justifyContent: 'center', alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: DARK, marginBottom: 8 },
  emptySub:   { fontSize: 14, color: GRAY, textAlign: 'center', lineHeight: 22 },
  browseBtn:  { 
    marginTop: 32, backgroundColor: ORANGE, 
    paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: ORANGE, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  browseBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },

  /* card */
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 14,
    marginTop: 12,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },

  /* card header */
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingBottom: 12, marginBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: DARK },
  itemCountBadge: {
    backgroundColor: '#fff5f0', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12,
  },
  itemCountText: { fontSize: 11, fontWeight: '700', color: ORANGE },

  /* item card */
  itemCard: { paddingVertical: 8 },
  itemMain: { flexDirection: 'row', justifyContent: 'space-between' },
  itemLeft: { flex: 1, flexDirection: 'row', gap: 10, paddingRight: 12 },
  vegBox: {
    width: 16, height: 16, borderRadius: 3,
    borderWidth: 1.5, borderColor: GREEN,
    justifyContent: 'center', alignItems: 'center',
    marginTop: 2, flexShrink: 0,
  },
  vegDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN },
  itemDetails: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '600', color: DARK, lineHeight: 20 },
  itemDesc: { fontSize: 11, color: GRAY, marginTop: 3, lineHeight: 16 },
  itemTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  itemTimeText: { fontSize: 11, color: '#94a3b8' },
  variantBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#f8f9fa', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, marginTop: 4,
  },
  variantText: { fontSize: 10, fontWeight: '600', color: GRAY },
  itemPrice: { fontSize: 14, fontWeight: '700', color: DARK, marginTop: 6 },

  itemRight: { alignItems: 'center', width: 80 },
  itemImg: { width: 80, height: 72, borderRadius: 10 },
  imgFallback: { backgroundColor: '#f8f9fa', justifyContent: 'center', alignItems: 'center' },

  stepper: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: ORANGE, borderRadius: 8,
    marginTop: 8, overflow: 'hidden', backgroundColor: '#fff',
  },
  stepBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  stepQty: { fontSize: 14, fontWeight: '800', color: DARK, minWidth: 20, textAlign: 'center' },

  itemDivider: { height: 1, backgroundColor: '#f5f5f5', marginVertical: 12 },

  /* addons */
  addonsSection: { marginTop: 12 },
  addonsDivider: { height: 1, backgroundColor: '#f0f0f0', marginBottom: 10 },
  addonsTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addonsTitle: {
    fontSize: 11, fontWeight: '700', color: ORANGE,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  addonsTotalPrice: {
    fontSize: 12, fontWeight: '700', color: ORANGE,
  },
  addonRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fafafa', padding: 8, borderRadius: 8, marginTop: 6,
  },
  addonImg: { width: 32, height: 32, borderRadius: 6 },
  addonImgPlaceholder: {
    width: 32, height: 32, borderRadius: 6,
    backgroundColor: '#fff5f0', justifyContent: 'center', alignItems: 'center',
  },
  addonName: { flex: 1, fontSize: 12, fontWeight: '500', color: DARK },
  addonPrice: { fontSize: 11, fontWeight: '600', color: GRAY },

  /* add more */
  addMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, marginTop: 8,
    borderTopWidth: 1, borderTopColor: '#f5f5f5',
  },
  addMoreText: { fontSize: 14, fontWeight: '600', color: ORANGE },

  /* delivery info */
  deliveryInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  deliveryText: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 19 },

  /* bill */
  billHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingBottom: 12, marginBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  billTitle: { fontSize: 15, fontWeight: '700', color: DARK },
  billRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10,
  },
  billLabelRow: { flex: 1 },
  billLabel: { fontSize: 13, color: GRAY, fontWeight: '500' },
  billHint: { fontSize: 10, color: GREEN, marginTop: 2 },
  billValue: { fontSize: 13, color: DARK, fontWeight: '600' },
  billDivider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 8 },
  billTotalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 8,
  },
  billTotalLabel: { fontSize: 15, fontWeight: '700', color: DARK },
  billTotalValue: { fontSize: 16, fontWeight: '800', color: ORANGE },

  /* footer */
  footer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#f0f0f0',
    shadowColor: '#000', shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 12,
  },
  footerContent: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  footerLeft: { flex: 1 },
  footerTotal: { fontSize: 20, fontWeight: '800', color: DARK },
  footerSubtext: { fontSize: 11, color: GRAY, marginTop: 2 },
  checkoutBtn: {
    backgroundColor: ORANGE, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 14,
    shadowColor: ORANGE, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  checkoutText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
