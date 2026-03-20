import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, StatusBar, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { CommonActions } from '@react-navigation/native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { useFoodCart } from '@/context/FoodCartContext';

type OrderItem = {
  id: string;
  name: string;
  price: number;
  qty: number;
  image?: string | null;
  variant?: string | null;
  addons?: string[];
};

type FoodOrder = {
  id: string;
  orderId: string;
  restaurantName: string;
  restaurantId: string;
  items: OrderItem[];
  grandTotal: number;
  subtotal: number;
  deliveryFee: number;
  status: string;
  paymentMethod: string;
  createdAt: any;
};

// mode: 'reorder' shows only delivered orders with reorder CTA
//       'history' shows all orders
type Props = { mode?: 'reorder' | 'history' };

export default function FoodOrdersScreen({ mode = 'history' }: Props) {
  const navigation = useNavigation<any>();
  const { addItem, clearCart } = useFoodCart();
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const user = auth().currentUser;

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    setLoading(true);
    setOrders([]);

    let query: any = firestore()
      .collection('restaurant_Orders')
      .where('userId', '==', user.uid)
      .limit(30);

    if (mode === 'reorder') {
      query = firestore()
        .collection('restaurant_Orders')
        .where('userId', '==', user.uid)
        .where('status', '==', 'delivered')
        .limit(20);
    }

    const unsub = query.onSnapshot(
      { includeMetadataChanges: false },
      (snap: any) => {
        const realOrders = snap.docs
          .filter((d: any) => d.exists)
          .map((d: any) => ({ id: d.id, ...(d.data() as any) }))
          .sort((a: any, b: any) => {
            const aTime = a.createdAt?.toDate?.()?.getTime?.() ?? 0;
            const bTime = b.createdAt?.toDate?.()?.getTime?.() ?? 0;
            return bTime - aTime;
          });
        setOrders(realOrders);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsub();
  }, [user?.uid, mode]);

  const handleReorder = (order: FoodOrder) => {
    clearCart();
    order.items.forEach(item => {
      addItem({
        id: item.id,
        name: item.name,
        price: item.price,
        image: item.image ?? undefined,
        restaurantId: order.restaurantId,
        restaurantName: order.restaurantName,
        variant: item.variant ?? undefined,
        addons: item.addons,
      });
    });
    // Navigate to Cart tab in FoodTabs
    navigation.dispatch(
      CommonActions.navigate({ name: 'FoodCartTab' })
    );
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'delivered': return '#16a34a';
      case 'cancelled': return '#dc2626';
      case 'preparing': return '#f59e0b';
      case 'out_for_delivery': return '#3b82f6';
      default: return '#f59e0b';
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'delivered': return 'Delivered';
      case 'cancelled': return 'Cancelled';
      case 'preparing': return 'Preparing';
      case 'out_for_delivery': return 'On the way';
      case 'pending': return 'Pending';
      default: return status;
    }
  };

  const formatDate = (ts: any) => {
    if (!ts) return '';
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  if (!user) {
    return (
      <View style={s.empty}>
        <Ionicons name="person-outline" size={56} color="#e2e8f0" />
        <Text style={s.emptyTitle}>Login required</Text>
        <TouchableOpacity style={s.loginBtn} onPress={() => navigation.navigate('LoginInHomeStack')}>
          <Text style={s.loginBtnText}>Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return <View style={s.loader}><ActivityIndicator size="large" color="#FF6B35" /></View>;
  }

  const emptyText = mode === 'reorder'
    ? 'No delivered orders yet'
    : 'No orders yet';

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={s.header}>
        <Text style={s.headerTitle}>{mode === 'reorder' ? 'Reorder' : 'Order History'}</Text>
        <Text style={s.headerSub}>{orders.length} order{orders.length !== 1 ? 's' : ''}</Text>
      </View>

      {orders.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="receipt-outline" size={56} color="#e2e8f0" />
          <Text style={s.emptyTitle}>{emptyText}</Text>
          <Text style={s.emptySub}>Your food orders will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={o => o.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.card}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('FoodTracking', { orderId: item.orderId ?? item.id })}
            >
              {/* Header */}
              <View style={s.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.restName} numberOfLines={1}>{item.restaurantName}</Text>
                  <Text style={s.date}>{formatDate(item.createdAt)}</Text>
                </View>
                <View style={[s.statusBadge, { backgroundColor: statusColor(item.status) + '18' }]}>
                  <View style={[s.statusDot, { backgroundColor: statusColor(item.status) }]} />
                  <Text style={[s.statusText, { color: statusColor(item.status) }]}>
                    {statusLabel(item.status)}
                  </Text>
                </View>
              </View>

              {/* Items */}
              <View style={s.itemsList}>
                {item.items?.slice(0, 3).map((i, idx) => (
                  <Text key={idx} style={s.itemText} numberOfLines={1}>
                    {i.qty}× {i.name}{i.variant ? ` (${i.variant})` : ''}
                  </Text>
                ))}
                {(item.items?.length ?? 0) > 3 && (
                  <Text style={s.moreText}>+{item.items.length - 3} more items</Text>
                )}
              </View>

              {/* Footer */}
              <View style={s.cardFooter}>
                <View>
                  <Text style={s.total}>₹{item.grandTotal ?? item.subtotal}</Text>
                  {item.deliveryFee === 0
                    ? <Text style={s.freeDelivery}>Free delivery</Text>
                    : <Text style={s.deliveryFee}>+ ₹{item.deliveryFee} delivery</Text>
                  }
                </View>
                {item.status === 'delivered' && (
                  <TouchableOpacity
                    style={s.reorderBtn}
                    onPress={(e) => { e.stopPropagation(); handleReorder(item); }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="refresh-outline" size={14} color="#FF6B35" />
                    <Text style={s.reorderText}>Reorder</Text>
                  </TouchableOpacity>
                )}
                {item.status !== 'delivered' && item.status !== 'cancelled' && (
                  <View style={s.trackBadge}>
                    <Ionicons name="navigate-outline" size={13} color="#3b82f6" />
                    <Text style={s.trackBadgeText}>Tap to track</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 52 : 40,
    paddingBottom: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#1e293b' },
  headerSub: { fontSize: 13, color: '#94a3b8', marginBottom: 2 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 8 },
  restName: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  date: { fontSize: 11, color: '#94a3b8', marginTop: 3 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, gap: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  itemsList: { marginBottom: 12, gap: 3 },
  itemText: { fontSize: 13, color: '#475569' },
  moreText: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 12 },
  total: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  freeDelivery: { fontSize: 11, color: '#16a34a', marginTop: 2 },
  deliveryFee: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  reorderBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff5f0', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#FF6B35' },
  reorderText: { color: '#FF6B35', fontWeight: '700', fontSize: 13 },
  trackBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  trackBadgeText: { color: '#3b82f6', fontWeight: '600', fontSize: 12 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#94a3b8' },
  emptySub: { fontSize: 13, color: '#cbd5e1' },
  loginBtn: { marginTop: 8, backgroundColor: '#FF6B35', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  loginBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
