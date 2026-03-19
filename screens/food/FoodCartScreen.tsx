import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useFoodCart } from '@/context/FoodCartContext';

export default function FoodCartScreen() {
  const navigation = useNavigation<any>();
  const { cartItems, addItem, removeItem, totalItems, totalPrice, clearCart } = useFoodCart();

  const deliveryFee = totalPrice >= 199 ? 0 : 30;
  const taxes = Math.round(totalPrice * 0.05);
  const grandTotal = totalPrice + deliveryFee + taxes;

  if (cartItems.length === 0) {
    return (
      <View style={s.empty}>
        <Ionicons name="cart-outline" size={72} color="#e2e8f0" />
        <Text style={s.emptyTitle}>Your cart is empty</Text>
        <Text style={s.emptySub}>Add items from a restaurant to get started</Text>
        <TouchableOpacity style={s.browseBtn} onPress={() => navigation.goBack()}>
          <Text style={s.browseBtnText}>Browse Restaurants</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1e293b" />
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>Your Cart</Text>
          <Text style={s.headerSub}>{cartItems[0]?.restaurantName}</Text>
        </View>
        <TouchableOpacity onPress={clearCart}>
          <Text style={s.clearText}>Clear</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Items */}
        <View style={s.card}>
          {cartItems.map(item => (
            <View key={item.id} style={s.itemRow}>
              {item.image ? (
                <Image source={{ uri: item.image }} style={s.itemImg} contentFit="cover" />
              ) : (
                <View style={[s.itemImg, s.itemImgPlaceholder]}>
                  <Ionicons name="fast-food-outline" size={20} color="#FF6B35" />
                </View>
              )}

              <View style={s.itemInfo}>
                <Text style={s.itemName} numberOfLines={1}>{item.name}</Text>
                {item.variant && <Text style={s.itemMeta}>{item.variant}</Text>}
                {item.addons && item.addons.length > 0 && (
                  <Text style={s.itemMeta}>+ {item.addons.join(', ')}</Text>
                )}
                <Text style={s.itemPrice}>₹{item.price * item.qty}</Text>
              </View>

              <View style={s.qtyControl}>
                <TouchableOpacity style={s.qtyBtn} onPress={() => removeItem(item.id)}>
                  <Ionicons name="remove" size={16} color="#FF6B35" />
                </TouchableOpacity>
                <Text style={s.qtyText}>{item.qty}</Text>
                <TouchableOpacity
                  style={s.qtyBtn}
                  onPress={() => addItem({ ...item })}
                >
                  <Ionicons name="add" size={16} color="#FF6B35" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* Delivery note */}
        {deliveryFee === 0 && (
          <View style={s.freeDeliveryBanner}>
            <Ionicons name="bicycle-outline" size={16} color="#16a34a" />
            <Text style={s.freeDeliveryText}>You get FREE delivery on this order!</Text>
          </View>
        )}

        {/* Bill Summary */}
        <View style={s.card}>
          <Text style={s.billTitle}>Bill Details</Text>
          <View style={s.billRow}>
            <Text style={s.billLabel}>Item Total</Text>
            <Text style={s.billValue}>₹{totalPrice}</Text>
          </View>
          <View style={s.billRow}>
            <Text style={s.billLabel}>Delivery Fee</Text>
            <Text style={[s.billValue, deliveryFee === 0 && { color: '#16a34a' }]}>
              {deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}
            </Text>
          </View>
          <View style={s.billRow}>
            <Text style={s.billLabel}>Taxes & Charges</Text>
            <Text style={s.billValue}>₹{taxes}</Text>
          </View>
          <View style={[s.billRow, s.billTotal]}>
            <Text style={s.billTotalLabel}>To Pay</Text>
            <Text style={s.billTotalValue}>₹{grandTotal}</Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Checkout Button */}
      <View style={s.checkoutWrap}>
        <TouchableOpacity
          style={s.checkoutBtn}
          activeOpacity={0.9}
          onPress={() =>
            navigation.navigate('FoodCheckout', {
              cartItems,
              subtotal: totalPrice,
              deliveryFee,
              taxes,
              grandTotal,
            })
          }
        >
          <View>
            <Text style={s.checkoutItems}>{totalItems} item{totalItems > 1 ? 's' : ''}</Text>
            <Text style={s.checkoutLabel}>Proceed to Checkout</Text>
          </View>
          <View style={s.checkoutRight}>
            <Text style={s.checkoutPrice}>₹{grandTotal}</Text>
            <Ionicons name="chevron-forward" size={18} color="#fff" />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginTop: 16 },
  emptySub: { fontSize: 13, color: '#94a3b8', marginTop: 6, textAlign: 'center' },
  browseBtn: {
    marginTop: 24, backgroundColor: '#FF6B35',
    paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12,
  },
  browseBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : 40,
    paddingBottom: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  headerSub: { fontSize: 12, color: '#94a3b8', marginTop: 1 },
  clearText: { fontSize: 13, color: '#ef4444', fontWeight: '600' },

  card: {
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 14,
    borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },

  itemRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f8fafc', gap: 12,
  },
  itemImg: { width: 52, height: 52, borderRadius: 8 },
  itemImgPlaceholder: { backgroundColor: '#fff5f0', justifyContent: 'center', alignItems: 'center' },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  itemMeta: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  itemPrice: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginTop: 4 },

  qtyControl: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#FF6B35', borderRadius: 8, overflow: 'hidden',
  },
  qtyBtn: { paddingHorizontal: 8, paddingVertical: 6, backgroundColor: '#fff5f0' },
  qtyText: { paddingHorizontal: 10, fontSize: 14, fontWeight: '700', color: '#1e293b' },

  freeDeliveryBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#f0fdf4', marginHorizontal: 16, marginTop: 10,
    borderRadius: 10, padding: 12,
  },
  freeDeliveryText: { fontSize: 13, color: '#16a34a', fontWeight: '600' },

  billTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 14 },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  billLabel: { fontSize: 13, color: '#64748b' },
  billValue: { fontSize: 13, color: '#1e293b', fontWeight: '500' },
  billTotal: {
    borderTopWidth: 1, borderTopColor: '#f1f5f9',
    paddingTop: 12, marginTop: 4, marginBottom: 0,
  },
  billTotalLabel: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  billTotalValue: { fontSize: 15, fontWeight: '800', color: '#FF6B35' },

  checkoutWrap: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', padding: 16,
    borderTopWidth: 1, borderTopColor: '#f1f5f9',
  },
  checkoutBtn: {
    backgroundColor: '#FF6B35', borderRadius: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  checkoutItems: { fontSize: 11, color: 'rgba(255,255,255,0.8)' },
  checkoutLabel: { fontSize: 15, fontWeight: '700', color: '#fff' },
  checkoutRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  checkoutPrice: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
