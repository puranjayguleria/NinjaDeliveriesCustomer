import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, RefreshControl, ActivityIndicator, Dimensions, StatusBar, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { getLiveKitchens, type MenuPhase as FirebaseMenuPhase, type LiveKitchenData } from '@/firebase/foodFirebase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import firestore from '@react-native-firebase/firestore';

const { width } = Dimensions.get('window');

// Modern Color Palette
const PRIMARY = '#7C3AED';      // Purple
const SECONDARY = '#EC4899';    // Pink
const SUCCESS = '#10B981';      // Green
const WARNING = '#F59E0B';      // Amber
const DANGER = '#EF4444';       // Red
const DARK = '#111827';         // Almost black
const GRAY_DARK = '#4B5563';    // Dark gray
const GRAY = '#9CA3AF';         // Medium gray
const GRAY_LIGHT = '#E5E7EB';   // Light gray
const WHITE = '#FFFFFF';
const BG = '#F8FAFC';           // Soft blue-gray background
const CARD_BG = '#FFFFFF';
const ACCENT = '#06B6D4';       // Cyan accent

// ── Types ──────────────────────────────────────────────────────────────────

export type MenuItem = {
  name: string;
  price: number;
  image?: string;
  description?: string;
  available: boolean;
  isVeg?: boolean;
};

export type DaysActive = {
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
};

export type MenuItemIds = {
  phase: 'breakfast' | 'lunch' | 'dinner' | 'snacks';
  restaurantId: string;
  startTime: string;
  updatedAt: any;
};

export type MenuPhase = FirebaseMenuPhase;

export type LiveKitchen = LiveKitchenData & {
  menuPhase?: MenuPhase | null;
};

// ── Helpers ────────────────────────────────────────────────────────────────

const MEAL_CONFIG: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; gradient: string[] }> = {
  breakfast: { label: 'Breakfast', icon: 'sunny',       color: '#F59E0B', gradient: ['#FEF3C7', '#FDE68A'] },
  lunch:     { label: 'Lunch',     icon: 'restaurant',  color: '#7C3AED', gradient: ['#EDE9FE', '#DDD6FE'] },
  dinner:    { label: 'Dinner',    icon: 'moon',        color: '#3B82F6', gradient: ['#DBEAFE', '#BFDBFE'] },
  snacks:    { label: 'Snacks',    icon: 'cafe',        color: '#EC4899', gradient: ['#FCE7F3', '#FBCFE8'] },
};

function getCurrentDay(): keyof DaysActive {
  const days: (keyof DaysActive)[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[new Date().getDay()];
}

function getCurrentTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function isPhaseActiveNow(phase: MenuPhase): boolean {
  if (!phase.enabled) {
    console.log(`❌ Phase ${phase.id} is DISABLED`);
    return false;
  }
  
  const today = getCurrentDay();
  if (!phase.daysActive[today]) {
    console.log(`❌ Phase ${phase.id} not active on ${today}`, phase.daysActive);
    return false;
  }
  
  const currentTime = getCurrentTime();
  const startTime = phase.startTime || phase.menuItemIds?.startTime || '00:00';
  const endTime = phase.endTime;
  
  const isActive = currentTime >= startTime && currentTime <= endTime;
  
  console.log(`⏰ Phase ${phase.id} time check:`, {
    currentTime,
    startTime,
    endTime,
    today,
    isActive: isActive ? '✅ OPEN' : '❌ CLOSED',
    comparison: `${currentTime} >= ${startTime} && ${currentTime} <= ${endTime}`,
  });
  
  return isActive;
}

// ── Pulsing live badge ─────────────────────────────────────────────────────

function LiveBadge() {
  const opacity = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.4, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
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
  wrap: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 5, 
    backgroundColor: '#FEE2E2', 
    paddingHorizontal: 10, 
    paddingVertical: 5, 
    borderRadius: 16,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  dot: { 
    width: 7, 
    height: 7, 
    borderRadius: 4, 
    backgroundColor: '#EF4444',
  },
  text: { 
    fontSize: 10, 
    fontWeight: '800', 
    color: '#EF4444', 
    letterSpacing: 0.8,
  },
});

// ── Kitchen Card ───────────────────────────────────────────────────────────

function KitchenCard({ kitchen, onPress }: { kitchen: LiveKitchen; onPress: () => void }) {
  const phase = kitchen.menuPhase;
  const isActiveNow = phase ? isPhaseActiveNow(phase) : false;
  const availableItems = phase?.items?.filter(i => i.available).length ?? 0;
  const mealType = phase?.menuItemIds?.phase;
  const mealConfig = mealType ? MEAL_CONFIG[mealType] : null;
  
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableOpacity 
      onPress={onPress} 
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      <Animated.View style={[kc.card, { transform: [{ scale: scaleAnim }] }]}>
        {/* Gradient Accent Bar */}
        {mealConfig && (
          <View style={[kc.accentBar, { backgroundColor: mealConfig.color }]} />
        )}

        {/* Header Section */}
        <View style={kc.headerSection}>
          {/* Profile Photo with enhanced styling */}
          <View style={kc.photoWrap}>
            <View style={[kc.photoRing, isActiveNow && kc.photoRingActive]}>
              {(kitchen.profileImage || kitchen.photo) ? (
                <Image source={{ uri: kitchen.profileImage || kitchen.photo }} style={kc.photo} contentFit="cover" />
              ) : (
                <View style={kc.photoPlaceholder}>
                  <Ionicons name="restaurant" size={36} color={PRIMARY} />
                </View>
              )}
            </View>
            {isActiveNow && (
              <View style={kc.liveIndicator}>
                <View style={kc.liveIndicatorInner} />
              </View>
            )}
          </View>

          {/* Info */}
          <View style={kc.infoWrap}>
            <View style={kc.nameContainer}>
              <Text style={kc.ownerName} numberOfLines={1}>
                {kitchen.ownerName || 'Chef'}
              </Text>
              {isActiveNow && <LiveBadge />}
            </View>
            
            {kitchen.restaurantName && (
              <View style={kc.restaurantBadge}>
                <Ionicons name="storefront" size={13} color={GRAY_DARK} />
                <Text style={kc.restaurantText} numberOfLines={1}>{kitchen.restaurantName}</Text>
              </View>
            )}

            {(kitchen.address || kitchen.area) && (
              <View style={kc.addressRow}>
                <Ionicons name="location" size={13} color={GRAY} />
                <Text style={kc.addressText} numberOfLines={1}>
                  {kitchen.address || kitchen.area}
                </Text>
              </View>
            )}
          </View>

          {/* Meal Badge with gradient effect */}
          {mealConfig && (
            <View style={[kc.mealBadge, { backgroundColor: mealConfig.color }]}>
              <Ionicons name={mealConfig.icon} size={18} color={WHITE} />
            </View>
          )}
        </View>

        {/* Enhanced Stats Section */}
        <View style={kc.statsSection}>
          <View style={kc.statBox}>
            <View style={kc.statIconWrap}>
              <Ionicons name="star" size={16} color="#F59E0B" />
            </View>
            <View>
              <Text style={kc.statValue}>{kitchen.rating?.toFixed(1) || '4.0'}</Text>
              <Text style={kc.statLabel}>Rating</Text>
            </View>
          </View>
          
          <View style={kc.statDivider} />
          
          <View style={kc.statBox}>
            <View style={[kc.statIconWrap, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="bag-check" size={16} color={SUCCESS} />
            </View>
            <View>
              <Text style={kc.statValue}>{kitchen.totalOrders || 0}+</Text>
              <Text style={kc.statLabel}>Orders</Text>
            </View>
          </View>
          
          {availableItems > 0 && (
            <>
              <View style={kc.statDivider} />
              <View style={kc.statBox}>
                <View style={[kc.statIconWrap, { backgroundColor: '#F3E8FF' }]}>
                  <Ionicons name="restaurant" size={16} color={PRIMARY} />
                </View>
                <View>
                  <Text style={kc.statValue}>{availableItems}</Text>
                  <Text style={kc.statLabel}>Items</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* Time & Status Section */}
        {phase && phase.enabled ? (
          <View style={kc.timeSection}>
            <View style={kc.statusTimeRow}>
              <View style={[kc.statusBadge, isActiveNow ? kc.statusBadgeOpen : kc.statusBadgeClosed]}>
                <View style={[kc.statusDot, { backgroundColor: isActiveNow ? SUCCESS : DANGER }]} />
                <Text style={[kc.statusText, { color: isActiveNow ? SUCCESS : DANGER }]}>
                  {isActiveNow ? 'Open Now' : 'Closed'}
                </Text>
              </View>
              
              <View style={kc.timeBadge}>
                <Ionicons name="time" size={14} color={GRAY_DARK} />
                <Text style={kc.timeText}>
                  {phase.startTime || phase.menuItemIds?.startTime || '00:00'} - {phase.endTime}
                </Text>
              </View>
            </View>
            
            {/* Days with better styling */}
            <View style={kc.daysRow}>
              {(['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const).map((day, i) => {
                const dayKey = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'][i] as keyof DaysActive;
                const isActive = phase.daysActive[dayKey];
                return (
                  <View key={`${day}-${i}`} style={[kc.dayChip, isActive && kc.dayChipActive]}>
                    <Text style={[kc.dayText, isActive && kc.dayTextActive]}>{day}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={kc.unavailableBox}>
            <Ionicons name="alert-circle" size={18} color={WARNING} />
            <Text style={kc.unavailableText}>Currently Unavailable</Text>
          </View>
        )}

        {/* Enhanced Footer */}
        <View style={kc.footer}>
          <Text style={kc.footerText}>View Full Menu</Text>
          <Ionicons name="arrow-forward" size={18} color={PRIMARY} />
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

const kc = StyleSheet.create({
  card: {
    backgroundColor: WHITE,
    borderRadius: 24,
    marginBottom: 20,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 0,
    overflow: 'hidden',
  },
  
  accentBar: {
    height: 4,
    width: '100%',
  },
  
  // Header
  headerSection: {
    flexDirection: 'row',
    padding: 20,
    gap: 14,
    alignItems: 'flex-start',
  },
  photoWrap: {
    position: 'relative',
  },
  photoRing: {
    padding: 3,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  photoRingActive: {
    backgroundColor: '#DCFCE7',
  },
  photo: {
    width: 70,
    height: 70,
    borderRadius: 17,
    backgroundColor: '#F9FAFB',
  },
  photoPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 17,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: WHITE,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: SUCCESS,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 2,
    borderColor: WHITE,
  },
  liveIndicatorInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: SUCCESS,
  },
  infoWrap: {
    flex: 1,
    gap: 7,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ownerName: {
    fontSize: 19,
    fontWeight: '900',
    color: DARK,
    flex: 1,
    letterSpacing: -0.5,
  },
  restaurantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  restaurantText: {
    fontSize: 13,
    color: GRAY_DARK,
    fontWeight: '700',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  addressText: {
    fontSize: 12,
    color: GRAY,
    fontWeight: '600',
    flex: 1,
  },
  mealBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  
  // Stats
  statsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FAFBFC',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F3F4F6',
  },
  statBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '900',
    color: DARK,
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: GRAY,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 8,
  },
  
  // Time Section
  timeSection: {
    padding: 20,
    gap: 14,
  },
  statusTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  statusBadgeOpen: {
    backgroundColor: '#DCFCE7',
    borderColor: SUCCESS,
  },
  statusBadgeClosed: {
    backgroundColor: '#FEE2E2',
    borderColor: DANGER,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#F9FAFB',
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  timeText: {
    fontSize: 12,
    fontWeight: '800',
    color: GRAY_DARK,
  },
  daysRow: {
    flexDirection: 'row',
    gap: 5,
  },
  dayChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  dayChipActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  dayText: {
    fontSize: 10,
    fontWeight: '900',
    color: GRAY,
    letterSpacing: 0.5,
  },
  dayTextActive: {
    color: WHITE,
  },
  
  // Unavailable
  unavailableBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 18,
    backgroundColor: '#FEF3C7',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#FDE68A',
  },
  unavailableText: {
    fontSize: 14,
    color: '#92400E',
    fontWeight: '800',
  },
  
  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    backgroundColor: '#FAFBFC',
  },
  footerText: {
    fontSize: 14,
    fontWeight: '800',
    color: PRIMARY,
    letterSpacing: -0.3,
  },
});

// ── Main Tab ───────────────────────────────────────────────────────────────

type MealFilter = 'all' | 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export default function LiveKitchenTab() {
  const navigation  = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [kitchens, setKitchens]     = useState<LiveKitchen[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mealFilter, setMealFilter] = useState<MealFilter>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open'>('all');

  const fetchKitchens = async () => {
    try {
      // Fetch all live kitchens from foodFirebase
      const liveKitchensData = await getLiveKitchens();

      // Map to LiveKitchen type and determine active phase
      const kitchens: LiveKitchen[] = liveKitchensData.map(kitchen => {
        // Find the currently active phase or use the first one
        const activePhase = kitchen.menuPhases.find(p => isPhaseActiveNow(p)) || kitchen.menuPhases[0];
        const isActiveNow = isPhaseActiveNow(activePhase);

        return {
          ...kitchen,
          isActive: isActiveNow,
          menuPhase: activePhase,
        };
      });

      // Sort by active status and then by owner name
      kitchens.sort((a, b) => {
        if (a.isActive && !b.isActive) return -1;
        if (!a.isActive && b.isActive) return 1;
        return (a.ownerName || a.name || '').localeCompare(b.ownerName || b.name || '');
      });

      setKitchens(kitchens);
    } catch (e) {
      console.error('[LiveKitchen] Error fetching kitchens:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 🔧 DEV ONLY: Fix menu phases in Firebase
  const fixMenuPhases = async () => {
    try {
      Alert.alert(
        'Fix Menu Phases',
        'This will update all menu phases to:\n\n• Enable all days\n• Set proper time ranges\n• Enable all phases\n\nContinue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Fix Now',
            onPress: async () => {
              setLoading(true);
              
              const phasesSnapshot = await firestore()
                .collection('restaurant_menu_phases')
                .get();

              const batch = firestore().batch();

              for (const doc of phasesSnapshot.docs) {
                const phaseData = doc.data();
                const phaseId = doc.id;

                // Determine meal type
                let mealType = phaseData.menuItemIds?.phase;
                if (!mealType) {
                  if (phaseId.includes('breakfast')) mealType = 'breakfast';
                  else if (phaseId.includes('lunch')) mealType = 'lunch';
                  else if (phaseId.includes('dinner')) mealType = 'dinner';
                  else if (phaseId.includes('snacks')) mealType = 'snacks';
                }

                // Set time ranges
                let startTime = '00:00';
                let endTime = '23:59';

                if (mealType === 'breakfast') {
                  startTime = '06:00';
                  endTime = '11:00';
                } else if (mealType === 'lunch') {
                  startTime = '11:00';
                  endTime = '16:00';
                } else if (mealType === 'dinner') {
                  startTime = '18:00';
                  endTime = '23:00';
                } else if (mealType === 'snacks') {
                  startTime = '14:00';
                  endTime = '20:00';
                }

                batch.update(doc.ref, {
                  enabled: true,
                  startTime,
                  endTime,
                  daysActive: {
                    monday: true,
                    tuesday: true,
                    wednesday: true,
                    thursday: true,
                    friday: true,
                    saturday: true,
                    sunday: true,
                  },
                });
              }

              await batch.commit();
              
              Alert.alert('Success', `Updated ${phasesSnapshot.size} phases!`);
              fetchKitchens();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error fixing phases:', error);
      Alert.alert('Error', 'Failed to fix phases');
      setLoading(false);
    }
  };

  useEffect(() => { fetchKitchens(); }, []);

  useEffect(() => {
    if (refreshing) fetchKitchens();
  }, [refreshing]);

  // Apply filters
  let filtered = kitchens;
  
  // Status filter
  if (statusFilter === 'open') {
    filtered = filtered.filter(k => k.menuPhase && isPhaseActiveNow(k.menuPhase));
  }
  
  // Meal type filter
  if (mealFilter !== 'all') {
    filtered = filtered.filter(k => k.menuPhase?.menuItemIds?.phase === mealFilter);
  }

  const openCount = kitchens.filter(k => k.menuPhase && isPhaseActiveNow(k.menuPhase)).length;
  const mealCounts = {
    breakfast: kitchens.filter(k => k.menuPhase?.menuItemIds?.phase === 'breakfast').length,
    lunch: kitchens.filter(k => k.menuPhase?.menuItemIds?.phase === 'lunch').length,
    dinner: kitchens.filter(k => k.menuPhase?.menuItemIds?.phase === 'dinner').length,
    snacks: kitchens.filter(k => k.menuPhase?.menuItemIds?.phase === 'snacks').length,
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar barStyle="dark-content" backgroundColor={WHITE} />
      
      {/* Clean Header */}
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <View style={s.headerContent}>
          <View style={s.headerLeft}>
            <View style={s.iconCircle}>
              <Ionicons name="flame" size={24} color={SECONDARY} />
            </View>
            <View>
              <Text style={s.headerTitle}>Live Kitchens</Text>
              <Text style={s.headerSubtitle}>
                {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </Text>
            </View>
          </View>
          
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            {/* 🔧 DEV: Fix Button */}
            <TouchableOpacity
              onPress={fixMenuPhases}
              style={{
                backgroundColor: WARNING,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 10,
              }}
            >
              <Ionicons name="construct" size={18} color={WHITE} />
            </TouchableOpacity>
            
            <View style={s.statsBox}>
              <View style={s.statItem}>
                <Text style={s.statNumber}>{kitchens.length}</Text>
                <Text style={s.statLabel}>Total</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statItem}>
                <Text style={[s.statNumber, { color: SUCCESS }]}>{openCount}</Text>
                <Text style={s.statLabel}>Open</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Filters */}
      <View style={s.filtersContainer}>
        {/* Status Filters Row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filtersRow}
        >
          <TouchableOpacity
            style={[s.filterBtn, statusFilter === 'all' && s.filterBtnActive]}
            onPress={() => setStatusFilter('all')}
            activeOpacity={0.7}
          >
            <Ionicons 
              name="grid-outline" 
              size={14} 
              color={statusFilter === 'all' ? WHITE : GRAY_DARK} 
            />
            <Text style={[s.filterBtnText, statusFilter === 'all' && s.filterBtnTextActive]}>
              All ({kitchens.length})
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[s.filterBtn, statusFilter === 'open' && s.filterBtnActive]}
            onPress={() => setStatusFilter('open')}
            activeOpacity={0.7}
          >
            <Ionicons 
              name="flame-outline" 
              size={14} 
              color={statusFilter === 'open' ? WHITE : GRAY_DARK} 
            />
            <Text style={[s.filterBtnText, statusFilter === 'open' && s.filterBtnTextActive]}>
              Open ({openCount})
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Meal Type Filters Row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filtersRow}
        >
          <TouchableOpacity
            style={[s.filterBtn, mealFilter === 'all' && s.filterBtnActive]}
            onPress={() => setMealFilter('all')}
            activeOpacity={0.7}
          >
            <Text style={[s.filterBtnText, mealFilter === 'all' && s.filterBtnTextActive]}>
              All Meals
            </Text>
          </TouchableOpacity>
          
          {(Object.keys(MEAL_CONFIG) as MealFilter[]).map(type => {
            const cfg = MEAL_CONFIG[type];
            const count = mealCounts[type as keyof typeof mealCounts];
            const isActive = mealFilter === type;
            return (
              <TouchableOpacity
                key={type}
                style={[s.filterBtn, isActive && s.filterBtnActive]}
                onPress={() => setMealFilter(type)}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name={cfg.icon} 
                  size={14} 
                  color={isActive ? WHITE : GRAY_DARK} 
                />
                <Text style={[s.filterBtnText, isActive && s.filterBtnTextActive]}>
                  {cfg.label} {count > 0 && `(${count})`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={s.centerText}>Loading kitchens...</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={s.center}>
          <View style={s.emptyCircle}>
            <Ionicons name="restaurant-outline" size={48} color={PRIMARY} />
          </View>
          <Text style={s.emptyTitle}>No kitchens found</Text>
          <Text style={s.emptySub}>
            {statusFilter === 'open'
              ? 'All kitchens are closed right now'
              : mealFilter !== 'all'
              ? `No ${MEAL_CONFIG[mealFilter]?.label} available`
              : 'No kitchens available'}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => setRefreshing(true)}
              tintColor={PRIMARY}
              colors={[PRIMARY]}
            />
          }
        >
          {filtered.map(kitchen => (
            <KitchenCard
              key={kitchen.id}
              kitchen={kitchen}
              onPress={() => navigation.navigate('RestaurantDetail', { 
                restaurantId: kitchen.id,
                restaurantName: kitchen.name || kitchen.restaurantName,
                profileImage: kitchen.profileImage || kitchen.photo,
                coverImage: kitchen.coverImage,
                description: kitchen.description,
              })}
            />
          ))}
          
          <View style={{ height: 20 }} />
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  // Header
  header: {
    backgroundColor: WHITE,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: DARK,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: GRAY,
    fontWeight: '600',
    marginTop: 2,
  },
  statsBox: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '900',
    color: PRIMARY,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: GRAY,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
  },

  // Filters
  filtersContainer: {
    backgroundColor: WHITE,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  filtersRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    flexDirection: 'row',
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterBtnActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  filterBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: GRAY_DARK,
  },
  filterBtnTextActive: {
    color: WHITE,
  },
  filterDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 4,
  },

  // Center States
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 32,
  },
  centerText: {
    fontSize: 14,
    color: GRAY,
    fontWeight: '600',
  },
  emptyCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: WHITE,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: DARK,
    letterSpacing: -0.3,
  },
  emptySub: {
    fontSize: 14,
    color: GRAY,
    textAlign: 'center',
    lineHeight: 20,
  },
});
