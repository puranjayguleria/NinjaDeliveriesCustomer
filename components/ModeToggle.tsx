import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocationContext } from '../context/LocationContext';

type Mode = 'grocery' | 'service' | 'food';

const TABS: { mode: Mode; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; badge?: string; badgeColor?: string }[] = [
  { mode: 'grocery', label: 'Grocery', icon: 'basket' },
  { mode: 'service', label: 'Service',  icon: 'hammer-wrench', badge: 'NEW',  badgeColor: '#ef4444' },
  { mode: 'food',    label: 'Food',     icon: 'food',          badge: 'SOON', badgeColor: '#f59e0b' },
];

type Props = {
  activeMode: Mode;
  onPress: (mode: Mode) => void;
  compact?: boolean;
};

export default function ModeToggle({ activeMode, onPress, compact = false }: Props) {
  const { location } = useLocationContext();

  const showGrocery  = location?.grocery  !== false;
  const showFood     = location?.food     !== false;
  const showServices = location?.services !== false;

  const availableTabs = TABS.filter(tab => {
    if (tab.mode === 'grocery') return showGrocery;
    if (tab.mode === 'service') return showServices;
    if (tab.mode === 'food')    return showFood;
    return true;
  });

  const badgePulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(badgePulse, { toValue: 1.12, duration: 800, useNativeDriver: true }),
        Animated.timing(badgePulse, { toValue: 1,    duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={[s.wrapper, compact && s.wrapperCompact]}>
      {availableTabs.map((tab) => {
        const focused = activeMode === tab.mode;
        return (
          <TouchableOpacity
            key={tab.mode}
            style={[s.tab, compact && s.tabCompact, focused ? s.tabActive : s.tabInactive]}
            onPress={() => onPress(tab.mode)}
            activeOpacity={0.75}
          >
            {/* Badge */}
            {tab.badge && (
              <Animated.View
                style={[s.badge, compact && s.badgeCompact, { backgroundColor: tab.badgeColor }, { transform: [{ scale: badgePulse }] }]}
              >
                <Text style={[s.badgeText, compact && s.badgeTextCompact]}>{tab.badge}</Text>
              </Animated.View>
            )}

            <View style={s.tabContent}>
              <MaterialCommunityIcons
                name={tab.icon}
                size={compact ? 14 : 18}
                color={focused ? '#ffffff' : '#64748b'}
                style={{ marginRight: compact ? 3 : 5 }}
              />
              <Text style={[s.label, compact && s.labelCompact, focused && s.labelActive]}>
                {tab.label}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 10,
    alignItems: 'center',
    gap: 8,
  },
  wrapperCompact: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    gap: 6,
  },
  tab: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
    overflow: 'visible',
  },
  tabCompact: {
    height: 40,
    borderRadius: 24,
  },
  tabActive: {
    backgroundColor: '#00b4a0',
    ...Platform.select({
      ios:     { shadowColor: '#00b4a0', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 8 },
      android: { elevation: 5 },
    }),
  },
  tabInactive: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -4,
    zIndex: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#fff',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 3 },
      android: { elevation: 4 },
    }),
  },
  badgeCompact: {
    top: -6,
    right: -2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.5,
  },
  badgeTextCompact: {
    fontSize: 7,
    letterSpacing: 0.3,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  labelCompact: {
    fontSize: 13,
    fontWeight: '700',
  },
  labelActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
});
