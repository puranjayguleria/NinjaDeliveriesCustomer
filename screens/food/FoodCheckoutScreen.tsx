import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Platform, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useFoodCart } from '@/context/FoodCartContext';
import { useLocationContext } from '@/context/LocationContext';

const PAYMENT_METHODS = ['Cash on Delivery', 'UPI', 'Card'] as const;
type PaymentMethod = typeof PAYMENT_METHODS[number];

export default function FoodCheckoutScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { clearCart } = useFoodCart();
  const { location } = useLocationContext();

  const { cartItems = [], subtotal = 0, deliveryFee = 0, taxes = 0, grandTotal = 0 } =
    route.params ?? {};

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash on Delivery');
  const [instructions, setInstructions] = useState('');
  const [placing, setPlacing] = useState(false);

  const deliveryAddress = location?.address || '';

  const placeOrder = async () => {
    const user = auth().currentUser;
    if (!user) {
      Alert.alert('Login Required', 'Please login to place an order.');
      return;
    }
    if (!deliveryAddress) {
      Alert.alert('Address Missing', 'Please set a delivery address first.');
      return;
    }

    setPlacing(true);
    try {
      const restaurantId = cartItems[0]?.restaurantId ?? '';
      const restaurantName = cartItems[0]?.restaurantName ?? '';

      const orderData = {
        userId: user.uid,
        userPhone: user.phoneNumber ?? '',
        restaurantId,
        restaurantName,
        items: cartItems.map((item: any) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          qty: item.qty,
          variant: item.variant ?? null,
          addons: item.addons ?? [],
          image: item.image ?? null,
        })),
        subtotal,
        deliveryFee,
        taxes,
        grandTotal,
        paymentMethod,
        instructions: instructions.trim(),
        deliveryAddress,
        deliveryLat: location?.lat ?? null,
        deliveryLng: location?.lng ?? null,
        status: 'pending',
        createdAt: firestore.FieldValue.serverTimestamp(),
      };

      // Save order to restaurant_Orders collection
      const orderRef = firestore().collection('restaurant_Orders').doc();
      await orderRef.set({ ...orderData, orderId: orderRef.id });

      const docRef = orderRef;

      clearCart();
      navigation.reset({
        index: 0,
        routes: [{ name: 'FoodOrderSuccess', params: { grandTotal, restaurantName, orderId: docRef.id } }],
      });
    } catch (err) {
      console.error('[FoodCheckout] order error:', err);
      Alert.alert('Error', 'Failed to place order. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1e293b" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Checkout</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* Delivery Address */}
        <View style={s.card}>
          <View style={s.sectionRow}>
            <Ionicons name="location-sharp" size={18} color="#FF6B35" />
            <Text style={s.sectionTitle}>Delivery Address</Text>
          </View>
          <Text style={s.addressText}>
            {deliveryAddress || 'No address selected'}
          </Text>
        </View>

        {/* Order Summary */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Order Summary</Text>
          {cartItems.map((item: any) => (
            <View key={item.id} style={s.itemRow}>
              <Text style={s.itemQty}>{item.qty}x</Text>
              <Text style={s.itemName} numberOfLines={1}>{item.name}</Text>
              <Text style={s.itemPrice}>₹{item.price * item.qty}</Text>
            </View>
          ))}
        </View>

        {/* Bill Details */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Bill Details</Text>
          <View style={s.billRow}>
            <Text style={s.billLabel}>Item Total</Text>
            <Text style={s.billValue}>₹{subtotal}</Text>
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

        {/* Payment Method */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Payment Method</Text>
          {PAYMENT_METHODS.map(method => (
            <TouchableOpacity
              key={method}
              style={s.paymentRow}
              onPress={() => setPaymentMethod(method)}
              activeOpacity={0.7}
            >
              <View style={[s.radio, paymentMethod === method && s.radioSelected]}>
                {paymentMethod === method && <View style={s.radioDot} />}
              </View>
              <Text style={s.paymentLabel}>{method}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Special Instructions */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Special Instructions</Text>
          <TextInput
            style={s.instructionsInput}
            placeholder="E.g. No onions, extra spicy..."
            placeholderTextColor="#94a3b8"
            value={instructions}
            onChangeText={setInstructions}
            multiline
            maxLength={200}
          />
        </View>
      </ScrollView>

      {/* Place Order Button */}
      <View style={s.footer}>
        <TouchableOpacity
          style={[s.placeBtn, placing && { opacity: 0.7 }]}
          onPress={placeOrder}
          disabled={placing}
          activeOpacity={0.9}
        >
          {placing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={s.placeBtnLabel}>Place Order</Text>
              <Text style={s.placeBtnPrice}>₹{grandTotal}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : 40,
    paddingBottom: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1e293b' },

  card: {
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 14,
    borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginBottom: 10 },
  addressText: { fontSize: 13, color: '#475569', lineHeight: 20 },

  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 },
  itemQty: { fontSize: 13, fontWeight: '700', color: '#FF6B35', width: 28 },
  itemName: { flex: 1, fontSize: 13, color: '#1e293b' },
  itemPrice: { fontSize: 13, fontWeight: '600', color: '#1e293b' },

  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  billLabel: { fontSize: 13, color: '#64748b' },
  billValue: { fontSize: 13, color: '#1e293b', fontWeight: '500' },
  billTotal: {
    borderTopWidth: 1, borderTopColor: '#f1f5f9',
    paddingTop: 12, marginTop: 4, marginBottom: 0,
  },
  billTotalLabel: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  billTotalValue: { fontSize: 15, fontWeight: '800', color: '#FF6B35' },

  paymentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: '#cbd5e1',
    justifyContent: 'center', alignItems: 'center',
  },
  radioSelected: { borderColor: '#FF6B35' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF6B35' },
  paymentLabel: { fontSize: 14, color: '#1e293b' },

  instructionsInput: {
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10,
    padding: 12, fontSize: 13, color: '#1e293b',
    minHeight: 72, textAlignVertical: 'top',
  },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', padding: 16,
    borderTopWidth: 1, borderTopColor: '#f1f5f9',
  },
  placeBtn: {
    backgroundColor: '#FF6B35', borderRadius: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 16,
  },
  placeBtnLabel: { fontSize: 16, fontWeight: '700', color: '#fff' },
  placeBtnPrice: { fontSize: 16, fontWeight: '800', color: '#fff' },
});
