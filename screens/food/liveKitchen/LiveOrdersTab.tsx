import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import firestore from '@react-native-firebase/firestore';
import { useNavigation } from '@react-navigation/native';

const ORANGE = '#FC8019';
const DARK   = '#1A1D2E';
const GRAY   = '#8A8FA8';
const GREEN  = '#22C55E';
const RED    = '#EF4444';
const AMBER  = '#F59E0B';
const WHITE  = '#FFFFFF';
const BG     = '#F4F5F9';
const BORDER = '#ECEEF5';

type LiveOrder = {
  id: string;
  restaurantName: string;
  restaurantId: string;
  items: { name: string; qty: number; image?: string }[];
  status: 'pending' | 'accepted' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered' | 'cancelled' | 'scheduled';
  grandTotal: number;
  createdAt: any;
  isScheduled?: boolean;
  deliveryAddress: string;
  paymentMethod: string;
  orderId: string;
};

const STATUS_CONFIG: Record<string, {
  label: string; color: string; bg: string;
  icon: keyof typeof Ionicons.glyphMap; step: number;
}> = {
  pending:          { label: 'Order Placed',  color: AMBER,     bg: '#FFFBEB', icon: 'time-outline',             step: 1 },
  accepted:         { label: 'Accepted',       color: '#6366F1', bg: '#EEF2FF', icon: 'checkmark-circle-outline', step: 2 },
  preparing:        { label: 'Preparing',      color: ORANGE,    bg: '#FFF7ED', icon: 'flame-outline',            step: 3 },
  ready:            { label: 'Ready',          color: GREEN,     bg: '#F0FDF4', icon: 'bag-check-outline',        step: 4 },
  out_for_delivery: { label: 'On the Way',     color: '#0EA5E9', bg: '#F0F9FF', icon: 'bicycle-outline',         step: 5 },
  delivered:        { label: 'Delivered',      color: GREEN,     bg: '#F0FDF4', icon: 'checkmark-done-circle',   step: 6 },
  cancelled:        { label: 'Cancelled',      color: RED,       bg: '#FEF2F2', icon: 'close-circle-outline',    step: 0 },
  scheduled:        { label: 'Scheduled',      color: '#8B5CF6', bg: '#F5F3FF', icon: 'calendar-outline',        step: 1 },
};

const STEPS = ['pending', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered'];

function PulsingDot({ color }: { color: string }) {
  const scale   = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale,   { toValue: 1.5, duration: 700, useNativeDriver: true }),
          Animated.timing(scale,   { toValue: 1,   duration: 700, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1,   duration: 700, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);
  return (
    <Animated.View style={{
      width: 8, height: 8, borderRadius: 4,
      backgroundColor: color, transform: [{ scale }], opacity,
    }} />
  );
}

function ProgressBar({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status];
  if (!cfg || status === 'cancelled') return null;
  const currentStep = cfg.step;
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: currentStep / STEPS.length,
      duration: 600, useNativeDriver: false,
    }).start();
  }, [status]);

  return (
    <View style={pb.wrap}>
      <View style={pb.track}>
        <Animated.View style={[pb.fill, {
          width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          backgroundColor: cfg.color,
        }]} />
      </View>
      <View style={pb.stepsRow}>
        {STEPS.map((step, i) => {
          const done   = currentStep > i;
          const active = currentStep === i + 1;
          const sc     = STATUS_CONFIG[step];
          return (
            <View key={step} style={pb.stepItem}>
              <View style={[pb.stepDot,
                done   && { backgroundColor: cfg.color, borderColor: cfg.color },
                active && { borderColor: cfg.color },
              ]}>
                {done   ? <Ionicons name="checkmark" size={8} color={WHITE} />
                : active ? <PulsingDot color={cfg.color} />
                : null}
              </View>
              <Text style={[pb.stepLabel, (done || active) && { color: cfg.color }]} numberOfLines={1}>
                {sc?.label.split(' ')[0]}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function OrderCard({ order, onPress }: { order: LiveOrder; onPress: () => void }) {
  const cfg      = STATUS_CONFIG[order.status] ?? STATUS_CONFIG['pending'];
  const isActive = !['delivered', 'cancelled'].includes(order.status);
  const itemNames = order.items.map(i => `${i.name}${i.qty > 1 ? ` ×${i.qty}` : ''}`).join(', ');
  const firstImg  = order.items.find(i => i.image)?.image;

  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!isActive) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [isActive]);

  return (
    <TouchableOpacity style={[oc.card, isActive && oc.cardActive]} onPress={onPress} activeOpacity={0.88}>
      {isActive && (
        <Animated.View style={[oc.activeBorder, {
          opacity: shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
        }]} />
      )}
      <View style={oc.header}>
        <View style={oc.restaurantRow}>
          {firstImg
            ? <Image source={{ uri: firstImg }} style={oc.restaurantImg} contentFit="cover" />
            : <View style={oc.restaurantImgFallback}><Ionicons name="storefront" size={16} color={ORANGE} /></View>
          }
          <View style={{ flex: 1 }}>
            <Text style={oc.restaurantName} numberOfLines={1}>{order.restaurantName}</Text>
            <Text style={oc.orderId}>#{order.orderId.slice(-6).toUpperCase()}</Text>
          </View>
        </View>
        <View style={[oc.statusBadge, { backgroundColor: cfg.bg }]}>
          {isActive && <PulsingDot color={cfg.color} />}
          <Text style={[oc.statusText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>

      {isActive && order.status !== 'scheduled' && <ProgressBar status={order.status} />}

      <View style={oc.itemsRow}>
        <Ionicons name="restaurant-outline" size={13} color={GRAY} />
        <Text style={oc.itemsText} numberOfLines={2}>{itemNames}</Text>
      </View>

      <View style={oc.footer}>
        <View style={oc.footerLeft}>
          <Text style={oc.amount}>₹{order.grandTotal}</Text>
          <View style={oc.paymentChip}>
            <Ionicons name={order.paymentMethod === 'UPI' ? 'phone-portrait-outline' : 'cash-outline'} size={10} color={GRAY} />
            <Text style={oc.paymentText}>{order.paymentMethod}</Text>
          </View>
        </View>
        <View style={oc.footerRight}>
          <Text style={oc.viewText}>View Details</Text>
          <Ionicons name="chevron-forward" size={14} color={ORANGE} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function LiveOrdersTab() {
  const navigation = useNavigation<any>();
  const [orders, setOrders]       = useState<LiveOrder[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]       = useState<'live' | 'all'>('live');

  useEffect(() => {
    const unsub = firestore()
      .collection('restaurant_Orders')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .onSnapshot(snap => {
        setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as LiveOrder)));
        setLoading(false);
        setRefreshing(false);
      }, () => { setLoading(false); setRefreshing(false); });
    return () => unsub();
  }, []);

  const liveOrders    = orders.filter(o => !['delivered', 'cancelled'].includes(o.status));
  const displayOrders = filter === 'live' ? liveOrders : orders;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {/* Filter row */}
      <View style={s.filterRow}>
        {(['live', 'all'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[s.filterTab, filter === f && s.filterTabActive]}
            onPress={() => setFilter(f)}
            activeOpacity={0.8}
          >
            <View style={s.filterTabInner}>
              {f === 'live' && filter === 'live' && <PulsingDot color={ORANGE} />}
              <Text style={[s.filterTabText, filter === f && s.filterTabTextActive]}>
                {f === 'live' ? 'Live Orders' : 'All Orders'}
              </Text>
              {f === 'live' && liveOrders.length > 0 && (
                <View style={[s.filterBadge, filter === 'live' && { backgroundColor: ORANGE }]}>
                  <Text style={[s.filterBadgeText, filter === 'live' && { color: WHITE }]}>
                    {liveOrders.length}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={ORANGE} />
          <Text style={s.loadingText}>Loading orders...</Text>
        </View>
      ) : displayOrders.length === 0 ? (
        <View style={s.center}>
          <View style={s.emptyCircle}>
            <Ionicons name="receipt-outline" size={44} color={ORANGE} />
          </View>
          <Text style={s.emptyTitle}>{filter === 'live' ? 'No active orders' : 'No orders yet'}</Text>
          <Text style={s.emptySub}>{filter === 'live' ? 'All orders have been delivered' : 'Orders will appear here once placed'}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 14, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => setRefreshing(true)} tintColor={ORANGE} colors={[ORANGE]} />}
        >
          {filter === 'live' && liveOrders.length > 0 && (
            <View style={s.statsRow}>
              {(['pending', 'preparing', 'out_for_delivery'] as const).map(st => {
                const count = liveOrders.filter(o => o.status === st).length;
                const cfg   = STATUS_CONFIG[st];
                return (
                  <View key={st} style={[s.statCard, { borderColor: cfg.color + '30' }]}>
                    <View style={[s.statIcon, { backgroundColor: cfg.bg }]}>
                      <Ionicons name={cfg.icon} size={16} color={cfg.color} />
                    </View>
                    <Text style={[s.statCount, { color: cfg.color }]}>{count}</Text>
                    <Text style={s.statLabel}>{cfg.label}</Text>
                  </View>
                );
              })}
            </View>
          )}
          {displayOrders.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              onPress={() => navigation.navigate('FoodTracking', { orderId: order.orderId || order.id })}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const pb = StyleSheet.create({
  wrap: { paddingHorizontal: 14, paddingBottom: 12 },
  track: { height: 4, backgroundColor: '#F1F5F9', borderRadius: 2, overflow: 'hidden', marginBottom: 8 },
  fill: { height: '100%', borderRadius: 2 },
  stepsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stepItem: { alignItems: 'center', flex: 1 },
  stepDot: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 1.5, borderColor: '#D1D5DB',
    backgroundColor: WHITE, justifyContent: 'center', alignItems: 'center', marginBottom: 3,
  },
  stepLabel: { fontSize: 8, color: GRAY, fontWeight: '500', textAlign: 'center' },
});

const oc = StyleSheet.create({
  card: {
    backgroundColor: WHITE, borderRadius: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 3, overflow: 'hidden',
  },
  cardActive: { shadowColor: ORANGE, shadowOpacity: 0.12, shadowRadius: 14, elevation: 5 },
  activeBorder: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 3,
    backgroundColor: ORANGE, borderTopLeftRadius: 16, borderTopRightRadius: 16,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10,
  },
  restaurantRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  restaurantImg: { width: 40, height: 40, borderRadius: 10 },
  restaurantImgFallback: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#FFF7ED', justifyContent: 'center', alignItems: 'center',
  },
  restaurantName: { fontSize: 14, fontWeight: '700', color: DARK },
  orderId: { fontSize: 11, color: GRAY, marginTop: 1 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  itemsRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    paddingHorizontal: 14, paddingBottom: 10,
  },
  itemsText: { flex: 1, fontSize: 12, color: GRAY, lineHeight: 17 },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: '#F4F5F9',
  },
  footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  amount: { fontSize: 15, fontWeight: '800', color: DARK },
  paymentChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#F4F5F9', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
  },
  paymentText: { fontSize: 10, color: GRAY, fontWeight: '500' },
  footerRight: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  viewText: { fontSize: 12, fontWeight: '600', color: ORANGE },
});

const s = StyleSheet.create({
  filterRow: {
    flexDirection: 'row', backgroundColor: WHITE,
    paddingHorizontal: 14, paddingVertical: 10, gap: 8,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  filterTab: {
    flex: 1, paddingVertical: 9, borderRadius: 10,
    backgroundColor: '#F4F5F9', alignItems: 'center',
  },
  filterTabActive: { backgroundColor: '#FFF7ED' },
  filterTabInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterTabText: { fontSize: 13, fontWeight: '600', color: GRAY },
  filterTabTextActive: { color: ORANGE },
  filterBadge: {
    backgroundColor: '#F4F5F9', paddingHorizontal: 6, paddingVertical: 1,
    borderRadius: 10, minWidth: 18, alignItems: 'center',
  },
  filterBadgeText: { fontSize: 10, fontWeight: '700', color: GRAY },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: GRAY },
  emptyCircle: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: '#FFF7ED', justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: DARK },
  emptySub:   { fontSize: 13, color: GRAY, textAlign: 'center', lineHeight: 20, paddingHorizontal: 32 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statCard: {
    flex: 1, backgroundColor: WHITE, borderRadius: 12, padding: 10,
    alignItems: 'center', borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  statIcon: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  statCount: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 9, color: GRAY, fontWeight: '500', textAlign: 'center', marginTop: 2 },
});
