import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Dimensions, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_H = Platform.OS === 'ios' ? 82 : 64;

type TabItem = {
  name: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconFocused: keyof typeof Ionicons.glyphMap;
  badge?: number;
};

type Props = {
  tabs: TabItem[];
  activeIndex: number;
  onPress: (index: number) => void;
  activeColor?: string;
  inactiveColor?: string;
};

export default function SwiggyTabBar({
  tabs,
  activeIndex,
  onPress,
  activeColor = '#FC8019',
  inactiveColor = '#93959F',
}: Props) {
  const tabWidth = SCREEN_WIDTH / tabs.length;

  // Animated scale for active tab icon
  const scales = useRef(tabs.map((_, i) => new Animated.Value(i === activeIndex ? 1.15 : 1))).current;

  useEffect(() => {
    tabs.forEach((_, i) => {
      Animated.spring(scales[i], {
        toValue: i === activeIndex ? 1.15 : 1,
        useNativeDriver: true,
        tension: 120,
        friction: 10,
      }).start();
    });
  }, [activeIndex]);

  return (
    <View style={s.container}>
      {/* Top orange line indicator */}
      <View style={s.topLine} />

      <View style={s.tabRow}>
        {tabs.map((tab, i) => {
          const focused = i === activeIndex;
          return (
            <TouchableOpacity
              key={tab.name}
              style={[s.tab, { width: tabWidth }]}
              onPress={() => onPress(i)}
              activeOpacity={0.7}
            >
              <Animated.View style={{ transform: [{ scale: scales[i] }], alignItems: 'center' }}>
                <View style={s.iconWrap}>
                  <Ionicons
                    name={focused ? tab.iconFocused : tab.icon}
                    size={22}
                    color={focused ? activeColor : inactiveColor}
                  />
                  {/* Badge */}
                  {tab.badge != null && tab.badge > 0 && (
                    <View style={s.badge}>
                      <Text style={s.badgeText}>{tab.badge > 99 ? '99+' : tab.badge}</Text>
                    </View>
                  )}
                </View>
                <Text style={[s.label, { color: focused ? activeColor : inactiveColor }]}>
                  {tab.label}
                </Text>
              </Animated.View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    height: TAB_H,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 12,
  },
  topLine: {
    height: 1,
    backgroundColor: '#f1f5f9',
  },
  tabRow: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'center',
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: Platform.OS === 'ios' ? 16 : 4,
    paddingTop: 8,
  },
  iconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#FC8019',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 3,
  },
});
