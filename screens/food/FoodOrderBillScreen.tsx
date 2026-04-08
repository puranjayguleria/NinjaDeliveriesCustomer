import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import firestore from '@react-native-firebase/firestore';
import { Image } from 'expo-image';

const ORANGE = '#FC8019';
const DARK   = '#282C3F';
const GRAY   = '#93959F';
const GREEN  = '#3d9b6d';

export default function FoodOrderBillScreen() {
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const insets     = useSafeAreaInsets();
  const { orderId } = route.params ?? {};

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) return;
    firestore().collection('restaurant_Orders').doc(orderId).get()
      .then(doc => { if (doc.exists) setOrder({ id: doc.id, ...doc.data() }); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [orderId]);

  const handleShare = async () => {};

  if (loading) return (
    <View style={s.loader}>
      <ActivityIndicator size="large" color={ORANGE} />
    </View>
  );

  if (!order) return (
    <View style={s.loader}>
      <Text style={{ color: GRAY }}>Order not found</Text>
    </View>
  );

  const createdDate = order.createdAt?.toDate?.()?.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  }) ?? '';
  const createdTime = order.createdAt?.toDate?.()?.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  }) ?? '';

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={DARK} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Order Bill</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Completed Banner */}
        <View style={s.completedBanner}>
          <View style={s.completedIconCircle}>
            <Ionicons name="checkmark-circle" size={48} color={GREEN} />
          </View>
          <Text style={s.completedTitle}>Order Completed</Text>
          <Text style={s.completedSub}>{order.restaurantName}</Text>
          <Text style={s.completedDate}>{createdDate} · {createdTime}</Text>
          <View style={s.orderIdBadge}>
            <Text style={s.orderIdText}>#{(order.orderId ?? order.id).slice(-8).toUpperCase()}</Text>
          </View>
        </View>

        {/* Items Card */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Ionicons name="restaurant" size={16} color={ORANGE} />
            <Text style={s.cardTitle}>Items Ordered</Text>
          </View>

          {(order.items ?? []).map((item: any, idx: number) => (
            <View key={idx}>
              {idx > 0 && <View style={s.divider} />}
              <View style={s.itemRow}>
                {item.image ? (
                  <Image source={{ uri: item.image }} style={s.itemImg} contentFit="cover" />
                ) : (
                  <View style={[s.itemImg, s.itemImgPlaceholder]}>
                    <Ionicons name="fast-food-outline" size={18} color={ORANGE} />
                  </View>
                )}
                <View style={s.itemInfo}>
                  <Text style={s.itemName}>{item.name}</Text>
                  {!!item.variant && <Text style={s.itemVariant}>{item.variant}</Text>}
                  {!!item.description && <Text style={s.itemDesc} numberOfLines={2}>{item.description}</Text>}
                  {(item.addons ?? []).map((a: any, ai: number) => (
                    <Text key={ai} style={s.addonText}>+ {a.name} · ₹{a.price}</Text>
                  ))}
                </View>
                <View style={s.itemPriceCol}>
                  <Text style={s.itemQty}>×{item.qty}</Text>
                  <Text style={s.itemPrice}>₹{item.price * item.qty}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Bill Card */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Ionicons name="receipt-outline" size={16} color={ORANGE} />
            <Text style={s.cardTitle}>Bill Details</Text>
          </View>

          <View style={s.billRow}>
            <Text style={s.billLabel}>Item Total</Text>
            <Text style={s.billValue}>₹{order.subtotal}</Text>
          </View>
          <View style={s.billRow}>
            <Text style={s.billLabel}>Delivery Fee</Text>
            <Text style={[s.billValue, order.deliveryFee === 0 && { color: GREEN }]}>
              {order.deliveryFee === 0 ? 'FREE' : `₹${order.deliveryFee}`}
            </Text>
          </View>
          <View style={s.billRow}>
            <Text style={s.billLabel}>Taxes & Charges</Text>
            <Text style={s.billValue}>₹{order.taxes}</Text>
          </View>
          <View style={s.billDivider} />
          <View style={s.billRow}>
            <Text style={s.billTotalLabel}>Total Paid</Text>
            <Text style={s.billTotalValue}>₹{order.grandTotal}</Text>
          </View>
          <View style={[s.billRow, { marginTop: 8 }]}>
            <Text style={s.billLabel}>Payment Method</Text>
            <Text style={s.billValue}>{order.paymentMethod}</Text>
          </View>
        </View>

        {/* Delivery Address */}
        {!!order.deliveryAddress && (
          <View style={s.card}>
            <View style={s.cardHeader}>
              <Ionicons name="location-outline" size={16} color={ORANGE} />
              <Text style={s.cardTitle}>Delivered To</Text>
            </View>
            <Text style={s.addressText}>{order.deliveryAddress}</Text>
          </View>
        )}

        {/* Back Button */}
        <TouchableOpacity style={s.shareFullBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
          <Text style={s.shareFullBtnText}>Go Back</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#f8f9fa' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
    elevation: 2,
  },
  backBtn:     { width: 40 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: DARK },
  shareBtn:    { width: 40, alignItems: 'flex-end' },

  completedBanner: {
    backgroundColor: '#fff', margin: 14, borderRadius: 16, padding: 24,
    alignItems: 'center',
    elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8,
  },
  completedIconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#f0fdf4', justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  completedTitle: { fontSize: 20, fontWeight: '800', color: DARK, marginBottom: 4 },
  completedSub:   { fontSize: 14, color: GRAY, marginBottom: 4 },
  completedDate:  { fontSize: 12, color: GRAY },
  orderIdBadge:   { marginTop: 10, backgroundColor: '#f1f5f9', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  orderIdText:    { fontSize: 12, fontWeight: '700', color: '#475569', letterSpacing: 1 },

  card: {
    backgroundColor: '#fff', marginHorizontal: 14, marginTop: 12,
    borderRadius: 16, padding: 16,
    elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  cardTitle:  { fontSize: 14, fontWeight: '700', color: DARK },

  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 10 },

  itemRow:         { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  itemImg:         { width: 52, height: 52, borderRadius: 10 },
  itemImgPlaceholder: { backgroundColor: '#fff5f0', justifyContent: 'center', alignItems: 'center' },
  itemInfo:        { flex: 1 },
  itemName:        { fontSize: 14, fontWeight: '600', color: DARK },
  itemVariant:     { fontSize: 11, color: GRAY, marginTop: 2 },
  itemDesc:        { fontSize: 11, color: GRAY, marginTop: 2, lineHeight: 16 },
  addonText:       { fontSize: 11, color: ORANGE, marginTop: 2 },
  itemPriceCol:    { alignItems: 'flex-end' },
  itemQty:         { fontSize: 12, color: GRAY },
  itemPrice:       { fontSize: 14, fontWeight: '700', color: DARK, marginTop: 2 },

  billRow:         { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  billLabel:       { fontSize: 13, color: GRAY },
  billValue:       { fontSize: 13, fontWeight: '600', color: DARK },
  billDivider:     { height: 1, backgroundColor: '#f0f0f0', marginVertical: 8 },
  billTotalLabel:  { fontSize: 15, fontWeight: '700', color: DARK },
  billTotalValue:  { fontSize: 16, fontWeight: '800', color: ORANGE },

  addressText: { fontSize: 13, color: GRAY, lineHeight: 20 },

  shareFullBtn: {
    margin: 14, marginTop: 20, backgroundColor: ORANGE,
    borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    elevation: 4, shadowColor: ORANGE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
  },
  shareFullBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
