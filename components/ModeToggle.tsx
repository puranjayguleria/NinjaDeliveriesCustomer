import React, { useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Mode = 'grocery' | 'service' | 'food';

const TABS: { mode: Mode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { mode: 'grocery', label: 'Grocery', icon: 'basket-outline' },
  { mode: 'service', label: 'Services', icon: 'construct-outline' },
  { mode: 'food',    label: 'Food',     icon: 'restaurant-outline' },
];

type Props = {
  activeMode: Mode;
  onPress: (mode: Mode) => void;
};

export default function ModeToggle({ activeMode, onPress }: Props) {
  const activeIndex = TABS.findIndex(t => t.mode === activeMode);
  const slideAnim = useRef(new Animated.Value(activeIndex)).current;
  const [wrapperWidth, setWrapperWidth] = useState(0);

  const tabWidth = wrapperWidth > 0 ? wrapperWidth / TABS.length : 0;

  useEffect(() => {
    if (tabWidth === 0) return;
    Animated.spring(slideAnim, {
      toValue: activeIndex,
      useNativeDriver: true,
      tension: 180,
      friction: 18,
    }).start();
  }, [activeIndex, tabWidth]);

  return (
    <View
      style={s.wrapper}
      onLayout={e => setWrapperWidth(e.nativeEvent.layout.width)}
    >
      {/* Sliding pill */}
      {tabWidth > 0 && (
        <Animated.View
          style={[
            s.slider,
            {
              width: tabWidth - 6,
              transform: [
                {
                  translateX: slideAnim.interpolate({
                    inputRange: [0, 1, 2],
                    outputRange: [3, tabWidth + 3, tabWidth * 2 + 3],
                  }),
                },
              ],
            },
          ]}
        />
      )}

      {TABS.map((tab, i) => {
        const focused = activeMode === tab.mode;
        return (
          <TouchableOpacity
            key={tab.mode}
            style={s.tab}
            onPress={() => onPress(tab.mode)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={tab.icon}
              size={15}
              color={focused ? '#fff' : '#64748b'}
              style={{ marginBottom: 1 }}
            />
            <Text style={[s.label, focused && s.labelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 12,
    height: 44,
    alignItems: 'center',
    position: 'relative',
  },
  slider: {
    position: 'absolute',
    height: 38,
    borderRadius: 11,
    backgroundColor: '#00b4a0',
    top: 3,
    shadowColor: '#00b4a0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
    zIndex: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  labelActive: {
    color: '#fff',
  },
});
