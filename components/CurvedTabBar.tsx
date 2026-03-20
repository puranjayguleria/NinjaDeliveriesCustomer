import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Dimensions, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 60 : 54;
const BUBBLE_SIZE = 50;

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
  bubbleColor?: string;
};

export default function CurvedTabBar({
  tabs,
  activeIndex,
  onPress,
  activeColor = '#fff',
  inactiveColor = '#9ca3af',
  bubbleColor = '#FF6B35',
}: Props) {
  const tabWidth = SCREEN_WIDTH / tabs.length;

  const bubbleAnim = useRef(
    new Animated.Value(activeIndex * tabWidth + tabWidth / 2 - BUBBLE_SIZE / 2)
  ).current;

  useEffect(() => {
    Animated.spring(bubbleAnim, {
      toValue: activeIndex * tabWidth + tabWidth / 2 - BUBBLE_SIZE / 2,
      useNativeDriver: true,
      tension: 68,
      friction: 10,
    }).start();
  }, [activeIndex, tabWidth]);

  return (
    <View style={styles.container}>
      {/* Gray bar */}
      <View style={styles.bar}>
        {tabs.map((tab, index) => {
          const focused = index === activeIndex;
          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.tabBtn}
              onPress={() => onPress(index)}
              activeOpacity={0.7}
            >
              {focused ? (
                <View style={{ height: 24 }} />
              ) : (
                <View>
                  <Ionicons name={tab.icon} size={22} color={inactiveColor} />
                  {tab.badge != null && tab.badge > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{tab.badge}</Text>
                    </View>
                  )}
                </View>
              )}
              <Text style={[styles.label, { color: focused ? bubbleColor : inactiveColor }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Orange floating bubble */}
      <Animated.View
        style={[
          styles.bubble,
          {
            backgroundColor: bubbleColor,
            width: BUBBLE_SIZE,
            height: BUBBLE_SIZE,
            borderRadius: BUBBLE_SIZE / 2,
            transform: [{ translateX: bubbleAnim }],
          },
        ]}
      >
        <Ionicons
          name={tabs[activeIndex]?.iconFocused ?? tabs[activeIndex]?.icon}
          size={24}
          color={activeColor}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: TAB_BAR_HEIGHT + BUBBLE_SIZE / 2,
    backgroundColor: 'transparent',
  },
  bar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: TAB_BAR_HEIGHT,
    backgroundColor: '#f3f4f6',
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: Platform.OS === 'ios' ? 12 : 6,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 8,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
  },
  bubble: {
    position: 'absolute',
    top: 0,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 20,
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -7,
    backgroundColor: '#ef4444',
    borderRadius: 7,
    minWidth: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
});
