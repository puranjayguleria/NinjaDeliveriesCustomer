import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import firestore from '@react-native-firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { useFoodCart } from '@/context/FoodCartContext';

const ORANGE  = '#FC8019';
const DARK    = '#1A1D2E';
const GRAY    = '#8A8FA8';
const GREEN   = '#22C55E';
const WHITE   = '#FFFFFF';
const BG      = '#F4F5F9';
const BORDER  = '#ECEEF5';
const PINK    = '#EC4899';

// ── Types ──────────────────────────────────────────────────────────────────

export type MenuItem = {
  name: string;
  price: number;
  image?: string;
  description?: string;
  available: boolean;
  isVeg?: boolean;
};

export type DailyMenu = {
  id: string;
  date: string;           // "YYYY-MM-DD"
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snacks';
  items: MenuItem[];
  updatedAt: any;
};

export type LiveKitchen = {
  id: string;
  name: string;
  ownerName: string;
  phone?: string;
  photo?: string;
  area: string;
  rating: number;
  totalOrders: number;
  isActive: boolean;
  tags: string[];
  todayMenu?: DailyMenu | null;
};

// ── Helpers ────────────────────────────────────────────────────────────────

const MEAL_CONFIG: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  breakfast: { label: 'Breakfast', icon: 'sunny-outline',    color: '#F59E0B', bg: '#FFFBEB' },
  lunch:     { label: 'Lunch',     icon: 'restaurant-outline', color: ORANGE,  bg: '#FFF7ED' },
  dinner:    { label: 'Dinner',    icon: 'moon-outline',      color: '#6366F1', bg: '#EEF2FF' },
  snacks:    { label: 'Snacks',    icon: 'cafe-outline',      color: PINK,     bg: '#FDF2F8' },
};

function todayDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Pulsing live badge ─────────────────────────────────────────────────────

function LiveBadge() {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.3, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1,   duration: 600, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);
  return (
    <View style={lb.wrap}>
      <Animated.View style={[lb.dot, { opacity }]} />
      <Text style={lb.text}>LIVE</Text>
    </View>
  );
}
const lb = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEF2F2', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  dot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' },
  text: { fontSize: 9, fontWeight: '800', color: '#EF4444', letterSpacing: 0.5 },
});

// ── Kitchen Card ───────────────────────────────────────────────────────────

function KitchenCard({ kitchen, onPress }: { kitchen: LiveKitchen; onPress: () => void }) {
  const menuCfg = kitchen.todayMenu ? MEAL_CONFIG[kitchen.todayMenu.mealType] : null;
  const availableItems = kitchen.todayMenu?.items.filter(i => i.available).length ?? 0;

  return (
    <TouchableOpacity style={kc.card} onPress={onPress} activeOpacity={0.88}>
      {/* Top: chef photo + info */}
      <View style={kc.top}>
        <View style={kc.photoWrap}>
          {kitchen.photo
            ? <Image source={{ uri: kitchen.photo }} style={kc.photo} contentFit="cover" />
            : (
              <View style={kc.photoFallback}>
                <Ionicons name="person" size={28} color={ORANGE} />
              </View>
            )
          }
          {kitchen.isActive && (
            <View style={kc.activeDot} />
          )}
        </View>

        <View style={kc.info}>
          <View style={kc.nameRow}>
            <Text style={kc.name} numberOfLines={1}>{kitchen.name}</Text>
            {kitchen.isActive && <LiveBadge />}
          </View>
          <Text style={kc.ownerName}>by {kitchen.ownerName}</Text>
          <View style={kc.metaRow}>
            <Ionicons name="location-outline" size={11} color={GRAY} />
            <Text style={kc.metaText} numberOfLines={1}>{kitchen.area}</Text>
          </View>
          <View style={kc.statsRow}>
            <View style={kc.statItem}>
              <Ionicons name="star" size={11} color="#F59E0B" />
              <Text style={kc.statText}>{kitchen.rating.toFixed(1)}</Text>
            </View>
            <View style={kc.dot} />
            <Text style={kc.statText}>{kitchen.totalOrders}+ orders</Text>
          </View>
        </View>
      </View>

      {/* Tags */}
      {kitchen.tags.length > 0 && (
        <View style={kc.tagsRow}>
          {kitchen.tags.slice(0, 3).map(tag => (
            <View key={tag} style={kc.tag}>
              <Text style={kc.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Today's menu preview */}
      {kitchen.todayMenu && menuCfg ? (
        <View style={[kc.menuPreview, { backgroundColor: menuCfg.bg, borderColor: menuCfg.color + '30' }]}>
          <View style={kc.menuPreviewHeader}>
            <View style={[kc.menuTypeIcon, { backgroundColor: menuCfg.color + '20' }]}>
              <Ionicons name={menuCfg.icon} size={13} color={menuCfg.color} />
            </View>
            <Text style={[kc.menuTypeLabel, { color: menuCfg.color }]}>Today's {menuCfg.label}</Text>
            <Text style={kc.menuItemCount}>{availableItems} items</Text>
          </View>
          <Text style={kc.menuItemNames} numberOfLines={1}>
            {kitchen.todayMenu.items.filter(i => i.available).map(i => i.name).join(' · ')}
          </Text>
        </View>
      ) : (
        <View style={kc.noMenuBanner}>
          <Ionicons name="time-outline" size={13} color={GRAY} />
          <Text style={kc.noMenuText}>Menu not updated yet for today</Text>
        </View>
      )}

      {/* Footer */}
      <View style={kc.footer}>
        <Text style={kc.viewMenuText}>View Menu & Order</Text>
        <Ionicons name="arrow-forward" size={14} color={ORANGE} />
      </View>
    </TouchableOpacity>
  );
}

const kc = StyleSheet.create({
  card: {
    backgroundColor: WHITE, borderRadius: 16, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 12, elevation: 4,
    overflow: 'hidden',
  },
  top: { flexDirection: 'row', padding: 14, gap: 12 },
  photoWrap: { position: 'relative' },
  photo: { width: 64, height: 64, borderRadius: 32 },
  photoFallback: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#FFF7ED', justifyContent: 'center', alignItems: 'center',
  },
  activeDot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: GREEN, borderWidth: 2, borderColor: WHITE,
  },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  name: { fontSize: 15, fontWeight: '700', color: DARK, flex: 1 },
  ownerName: { fontSize: 11, color: GRAY, marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 4 },
  metaText: { fontSize: 11, color: GRAY, flex: 1 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  statText: { fontSize: 11, color: GRAY, fontWeight: '500' },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: GRAY },
  tagsRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingBottom: 10, flexWrap: 'wrap' },
  tag: { backgroundColor: '#F4F5F9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  tagText: { fontSize: 10, fontWeight: '600', color: GRAY },
  menuPreview: {
    marginHorizontal: 14, marginBottom: 10,
    borderRadius: 10, padding: 10, borderWidth: 1,
  },
  menuPreviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  menuTypeIcon: { width: 22, height: 22, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  menuTypeLabel: { flex: 1, fontSize: 11, fontWeight: '700' },
  menuItemCount: { fontSize: 10, color: GRAY, fontWeight: '500' },
  menuItemNames: { fontSize: 12, color: DARK, lineHeight: 17 },
  noMenuBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginHorizontal: 14, marginBottom: 10,
    backgroundColor: '#F4F5F9', borderRadius: 8, padding: 8,
  },
  noMenuText: { fontSize: 11, color: GRAY },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: BORDER,
  },
  viewMenuText: { fontSize: 13, fontWeight: '700', color: ORANGE },
});

// ── Main Tab ───────────────────────────────────────────────────────────────

type MealFilter = 'all' | 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export default function LiveFoodTab() {
  const navigation  = useNavigation<any>();
  const [kitchens, setKitchens]     = useState<LiveKitchen[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mealFilter, setMealFilter] = useState<MealFilter>('all');
  const today = todayDateStr();

  const fetchKitchens = async () => {
    try {
      const snap = await firestore()
        .collection('live_kitchens')
        .where('isActive', '==', true)
        .get();

      const kitchenList: LiveKitchen[] = await Promise.all(
        snap.docs.map(async doc => {
          const data = doc.data() as Omit<LiveKitchen, 'id' | 'todayMenu'>;
          // Fetch today's menu
          const menuSnap = await firestore()
            .collection('live_kitchens')
            .doc(doc.id)
            .collection('menu')
            .where('date', '==', today)
            .limit(1)
            .get();

          const todayMenu = menuSnap.empty
            ? null
            : ({ id: menuSnap.docs[0].id, ...menuSnap.docs[0].data() } as DailyMenu);

          return { id: doc.id, ...data, todayMenu };
        })
      );

      setKitchens(kitchenList);
    } catch (e) {
      // silently fail — show empty state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchKitchens(); }, []);

  useEffect(() => {
    if (refreshing) fetchKitchens();
  }, [refreshing]);

  const filtered = mealFilter === 'all'
    ? kitchens
    : kitchens.filter(k => k.todayMenu?.mealType === mealFilter);

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {/* Meal type filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.chipScroll}
        contentContainerStyle={s.chipRow}
      >
        <TouchableOpacity
          style={[s.chip, mealFilter === 'all' && s.chipActive]}
          onPress={() => setMealFilter('all')}
          activeOpacity={0.8}
        >
          <Text style={[s.chipText, mealFilter === 'all' && s.chipTextActive]}>All</Text>
        </TouchableOpacity>
        {(Object.keys(MEAL_CONFIG) as MealFilter[]).map(type => {
          const cfg = MEAL_CONFIG[type];
          return (
            <TouchableOpacity
              key={type}
              style={[s.chip, mealFilter === type && s.chipActive, mealFilter === type && { borderColor: cfg.color }]}
              onPress={() => setMealFilter(type)}
              activeOpacity={0.8}
            >
              <Ionicons name={cfg.icon} size={13} color={mealFilter === type ? cfg.color : GRAY} />
              <Text style={[s.chipText, mealFilter === type && { color: cfg.color }]}>{cfg.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Today's date banner */}
      <View style={s.dateBanner}>
        <Ionicons name="calendar-outline" size={13} color={ORANGE} />
        <Text style={s.dateBannerText}>
          Today's Menu — {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={ORANGE} />
          <Text style={s.loadingText}>Finding home kitchens...</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={s.center}>
          <View style={s.emptyCircle}>
            <Ionicons name="storefront-outline" size={44} color={ORANGE} />
          </View>
          <Text style={s.emptyTitle}>No kitchens available</Text>
          <Text style={s.emptySub}>
            {mealFilter !== 'all'
              ? `No ${MEAL_CONFIG[mealFilter]?.label} menu today.\nTry a different meal type.`
              : 'No home kitchens are active right now.\nCheck back later!'}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 14, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => setRefreshing(true)}
              tintColor={ORANGE}
              colors={[ORANGE]}
            />
          }
        >
          {/* Stats */}
          <View style={s.statsRow}>
            <View style={s.statPill}>
              <Ionicons name="storefront" size={13} color={ORANGE} />
              <Text style={s.statPillText}>{kitchens.length} kitchens active</Text>
            </View>
            <View style={s.statPill}>
              <Ionicons name="restaurant" size={13} color={GREEN} />
              <Text style={s.statPillText}>
                {kitchens.reduce((sum, k) => sum + (k.todayMenu?.items.filter(i => i.available).length ?? 0), 0)} dishes today
              </Text>
            </View>
          </View>

          {filtered.map(kitchen => (
            <KitchenCard
              key={kitchen.id}
              kitchen={kitchen}
              onPress={() => navigation.navigate('LiveKitchenDetail', { kitchenId: kitchen.id })}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  chipScroll: { backgroundColor: WHITE, maxHeight: 52 },
  chipRow: { paddingHorizontal: 14, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, backgroundColor: '#F4F5F9',
    borderWidth: 1.5, borderColor: 'transparent',
  },
  chipActive: { backgroundColor: '#FFF7ED', borderColor: ORANGE },
  chipText: { fontSize: 12, fontWeight: '600', color: GRAY },
  chipTextActive: { color: ORANGE },

  dateBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFF7ED', paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  dateBannerText: { fontSize: 12, fontWeight: '600', color: ORANGE },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: GRAY },
  emptyCircle: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: '#FFF7ED', justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: DARK },
  emptySub: { fontSize: 13, color: GRAY, textAlign: 'center', lineHeight: 20, paddingHorizontal: 32 },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: WHITE, borderRadius: 10, paddingVertical: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  statPillText: { fontSize: 12, fontWeight: '600', color: DARK },
});
