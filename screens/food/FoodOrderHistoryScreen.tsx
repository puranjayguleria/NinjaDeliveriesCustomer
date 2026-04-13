import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { CommonActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { Alert } from 'react-native';
import { useFoodCart } from '@/context/FoodCartContext';

type OrderItem = {
  id: string; name: string; price: number; qty: number;
  image?: string | null; variant?: string | null; addons?: string[];
};

type FoodOrder = {
  id: string; orderId: string; restaurantName: string; restaurantId: string;
  items: OrderItem[]; grandTotal: number; subtotal: number; deliveryFee: number;
  status: string; paymentMethod: string; createdAt: any;
  scheduledFor?: any; isScheduled?: boolean;
};

type Props = { mode?: 'reorder' | 'history' };

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS: Record<string, { label: string; color: string; bg: string; border: string; icon: string }> = {
  pending:          { label: 'Pending',      color: '#b45309', bg: '#fffbeb', border: '#fcd34d', icon: 'time-outline'            },
  preparing:        { label: 'Preparing',    color: '#c2410c', bg: '#fff7ed', border: '#fdba74', icon: 'restaurant-outline'      },
  ready:            { label: 'Ready',        color: '#0e7490', bg: '#ecfeff', border: '#67e8f9', icon: 'checkmark-circle-outline' },
  out_for_delivery: { label: 'On the way',   color: '#1d4ed8', bg: '#eff6ff', border: '#93c5fd', icon: 'bicycle-outline'         },
  scheduled:        { label: 'Scheduled',    color: '#6d28d9', bg: '#f5f3ff', border: '#c4b5fd', icon: 'calendar-outline'        },
  delivered:        { label: 'Delivered',    color: '#15803d', bg: '#f0fdf4', border: '#86efac', icon: 'checkmark-done-outline'  },
  completed:        { label: 'Completed',    color: '#15803d', bg: '#f0fdf4', border: '#86efac', icon: 'checkmark-circle-outline' },
  cancelled:        { label: 'Cancelled',    color: '#b91c1c', bg: '#fef2f2', border: '#fca5a5', icon: 'close-circle-outline'    },
  rejected:         { label: 'Rejected',     color: '#b91c1c', bg: '#fef2f2', border: '#fca5a5', icon: 'ban-outline'             },
};

const getStatus = (s: string, isScheduled?: boolean) => {
  // If order is scheduled and still in initial state, show scheduled status
  if (isScheduled && (s === 'pending' || s === 'scheduled')) {
    return STATUS['scheduled'];
  }
  return STATUS[s] ?? { label: s, color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', icon: 'ellipse-outline' };
};

export default function FoodOrderHistoryScreen({ mode = 'history' }: Props) {
  const navigation = useNavigation<any>();
  const insets     = useSafeAreaInsets();
  const { addItem, clearCart } = useFoodCart();
  const [orders, setOrders]   = useState<FoodOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const user = auth().currentUser;

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    setLoading(true); setOrders([]);
    let query: any = firestore().collection('restaurant_Orders').where('userId', '==', user.uid).limit(30);
    if (mode === 'reorder') {
      query = firestore().collection('restaurant_Orders')
        .where('userId', '==', user.uid).where('status', '==', 'delivered').limit(20);
    }
    const unsub = query.onSnapshot(
      { includeMetadataChanges: false },
      (snap: any) => {
        const list = snap.docs.filter((d: any) => d.exists)
          .map((d: any) => ({ id: d.id, ...(d.data() as any) }))
          .sort((a: any, b: any) => (b.createdAt?.toDate?.()?.getTime?.() ?? 0) - (a.createdAt?.toDate?.()?.getTime?.() ?? 0));
        setOrders(list); setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [user?.uid, mode]);

  const handleDeleteOrder = (order: FoodOrder) => {
    Alert.alert('Delete Order', 'Delete this order? (Testing only)', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await firestore().collection('restaurant_Orders').doc(order.orderId ?? order.id).delete();
          } catch (e) {
            Alert.alert('Error', 'Failed to delete order');
          }
        },
      },
    ]);
  };

  const handleReorder = (order: FoodOrder) => {
    clearCart();
    order.items.forEach(item => addItem({
      id: item.id, name: item.name, price: item.price,
      image: item.image ?? undefined, restaurantId: order.restaurantId,
      restaurantName: order.restaurantName, variant: item.variant ?? undefined, addons: item.addons,
    }));
    navigation.dispatch(CommonActions.navigate({ name: 'FoodCartTab' }));
  };

  const formatDate = (ts: any) => {
    if (!ts) return '';
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  const formatScheduled = (order: FoodOrder) => {
    if (!order.scheduledFor) return '';
    try {
      const d = order.scheduledFor.toDate();
      const today = new Date(); const tmr = new Date(today); tmr.setDate(tmr.getDate() + 1);
      const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
      if (d.toDateString() === today.toDateString()) return `Today, ${time}`;
      if (d.toDateString() === tmr.toDateString()) return `Tomorrow, ${time}`;
      return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${time}`;
    } catch { return ''; }
  };

  if (!user) return (
    <View style={s.empty}>
      <Ionicons name="person-outline" size={56} color="#e2e8f0" />
      <Text style={s.emptyTitle}>Login required</Text>
      <TouchableOpacity style={s.loginBtn} onPress={() => navigation.navigate('LoginInHomeStack')}>
        <Text style={s.loginBtnText}>Login</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) return <View style={s.loader}><ActivityIndicator size="large" color="#FC8019" /></View>;

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color="#1e293b" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>{mode === 'reorder' ? 'Reorder' : 'Order History'}</Text>
          <Text style={s.headerSub}>{orders.length} order{orders.length !== 1 ? 's' : ''}</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {orders.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="receipt-outline" size={56} color="#e2e8f0" />
          <Text style={s.emptyTitle}>{mode === 'reorder' ? 'No delivered orders yet' : 'No orders yet'}</Text>
          <Text style={s.emptySub}>Your food orders will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={o => o.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const st = getStatus(item.status, item.isScheduled);
            const isActive = !['delivered', 'cancelled', 'rejected', 'completed'].includes(item.status);
            const isScheduledPending = item.isScheduled && (item.status === 'pending' || item.status === 'scheduled');
            const isCancelled = item.status === 'cancelled' || item.status === 'rejected';
            const isDelivered = item.status === 'delivered';
            return (
              <TouchableOpacity
                style={[
                  s.card,
                  {
                    backgroundColor: st.bg,
                    borderColor: st.border,
                    borderLeftColor: st.color,
                  },
                ]}
                activeOpacity={0.85}
                onPress={() => {
                  const status = (item.status ?? '').toLowerCase().trim();
                  const isCompleted = status === 'completed' || status === 'delivered';
                  console.log('[FoodOrders] clicked status:', item.status, '→ isCompleted:', isCompleted);
                  if (isCompleted) {
                    navigation.navigate('FoodOrderBill', { orderId: item.orderId ?? item.id });
                  } else if (!isCancelled) {
                    navigation.navigate('FoodTracking', { orderId: item.orderId ?? item.id });
                  }
                }}
              >
                {/* Status strip top */}
                <View style={[s.cardStrip, { backgroundColor: st.color }]} />

                <View style={s.cardInner}>
                  {/* Header row */}
                  <View style={s.cardHeader}>
                    <View style={[s.statusIconWrap, { backgroundColor: st.bg }]}>
                      <Ionicons name={st.icon as any} size={18} color={st.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.restName} numberOfLines={1}>{item.restaurantName}</Text>
                      {item.isScheduled && item.scheduledFor && (item.status === 'pending' || item.status === 'scheduled')
                        ? <Text style={[s.dateText, { color: '#7c3aed' }]}>🗓 {formatScheduled(item)}</Text>
                        : <Text style={s.dateText}>{formatDate(item.createdAt)}</Text>
                      }
                    </View>
                    <View style={[s.statusPill, { backgroundColor: st.bg, borderColor: st.border }]}>
                      <Text style={[s.statusPillText, { color: st.color }]}>{st.label}</Text>
                    </View>
                  </View>

                  {/* Divider */}
                  <View style={s.divider} />

                  {/* Items */}
                  <View style={s.itemsWrap}>
                    {item.items?.slice(0, 3).map((i, idx) => (
                      <View key={idx} style={s.itemRow}>
                        <View style={s.qtyBadge}><Text style={s.qtyText}>{i.qty}</Text></View>
                        <Text style={s.itemName} numberOfLines={1}>
                          {i.name}{i.variant ? ` · ${i.variant}` : ''}
                        </Text>
                      </View>
                    ))}
                    {(item.items?.length ?? 0) > 3 && (
                      <Text style={s.moreText}>+{item.items.length - 3} more items</Text>
                    )}
                  </View>

                  {/* Footer */}
                  <View style={s.cardFooter}>
                    <View>
                      <Text style={s.totalAmt}>₹{item.grandTotal ?? item.subtotal}</Text>
                      {item.deliveryFee === 0
                        ? <Text style={s.freeDelivery}>🎉 Free delivery</Text>
                        : <Text style={s.deliveryFee}>+ ₹{item.deliveryFee} delivery</Text>
                      }
                    </View>

                    {isDelivered && (
                      <TouchableOpacity
                        style={s.reorderBtn}
                        onPress={(e) => { e.stopPropagation(); handleReorder(item); }}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="refresh-outline" size={14} color="#fff" />
                        <Text style={s.reorderText}>Reorder</Text>
                      </TouchableOpacity>
                    )}

                    {isActive && !isScheduledPending && (
                      <View style={s.trackBtn}>
                        <Ionicons name="navigate-outline" size={13} color="#2563eb" />
                        <Text style={s.trackBtnText}>Track order</Text>
                      </View>
                    )}

                    {/* 🧪 Testing only */}
                    <TouchableOpacity
                      style={s.deleteBtn}
                      onPress={(e) => { e.stopPropagation(); handleDeleteOrder(item); }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="trash-outline" size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#fff' },
  loader:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: '#fff', paddingBottom: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
    flexDirection: 'row', alignItems: 'center',
  },
  backBtn:      { width: 36 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle:  { fontSize: 17, fontWeight: '800', color: '#1e293b' },
  headerSub:    { fontSize: 12, color: '#94a3b8', marginTop: 2 },

  card: {
    borderRadius: 16, marginBottom: 14, overflow: 'hidden',
    borderWidth: 1, borderLeftWidth: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  cardStrip:   { height: 5 },
  cardInner:   { padding: 14 },
  cardHeader:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  statusIconWrap: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  restName:    { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  dateText:    { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  statusPill: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1,
  },
  statusPillText: { fontSize: 11, fontWeight: '700' },

  divider:     { height: 1, backgroundColor: '#f1f5f9', marginBottom: 10 },

  itemsWrap:   { gap: 6, marginBottom: 10 },
  itemRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBadge:    { width: 22, height: 22, borderRadius: 6, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  qtyText:     { fontSize: 11, fontWeight: '700', color: '#475569' },
  itemName:    { fontSize: 13, color: '#475569', flex: 1 },
  moreText:    { fontSize: 12, color: '#94a3b8', marginLeft: 30 },

  cancelledByRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10, backgroundColor: '#fef2f2', padding: 8, borderRadius: 8 },
  cancelledByText: { fontSize: 12, color: '#dc2626', fontWeight: '500' },

  cardFooter:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 12 },
  totalAmt:    { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  freeDelivery:{ fontSize: 11, color: '#16a34a', marginTop: 2 },
  deliveryFee: { fontSize: 11, color: '#94a3b8', marginTop: 2 },

  reorderBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FC8019', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20 },
  reorderText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  trackBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#eff6ff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  trackBtnText:{ color: '#2563eb', fontWeight: '600', fontSize: 12 },

  empty:       { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyTitle:  { fontSize: 16, fontWeight: '600', color: '#94a3b8' },
  emptySub:    { fontSize: 13, color: '#cbd5e1' },
  loginBtn:    { marginTop: 8, backgroundColor: '#FC8019', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  loginBtnText:{ color: '#fff', fontWeight: '700', fontSize: 14 },
  deleteBtn:   { width: 32, height: 32, borderRadius: 8, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' },
});
