import React, { useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocationContext } from '../context/LocationContext';

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
  const { location } = useLocationContext();
  
  // Get location flags (default to true if not set)
  const showGrocery = location?.grocery !== false;
  const showFood = location?.food !== false;
  const showServices = location?.services !== false;

  // Filter tabs based on availability
  const availableTabs = TABS.filter(tab => {
    if (tab.mode === 'grocery') return showGrocery;
    if (tab.mode === 'service') return showServices;
    if (tab.mode === 'food') return showFood;
    return true;
  });

  const activeIndex = availableTabs.findIndex(t => t.mode === activeMode);
  const slideAnim = useRef(new Animated.Value(activeIndex >= 0 ? activeIndex : 0)).current;
  const [wrapperWidth, setWrapperWidth] = useState(0);

  const tabWidth = wrapperWidth > 0 ? wrapperWidth / availableTabs.length : 0;

  useEffect(() => {
    if (tabWidth === 0) return;
    const newIndex = availableTabs.findIndex(t => t.mode === activeMode);
    if (newIndex >= 0) {
      Animated.spring(slideAnim, {
        toValue: newIndex,
        useNativeDriver: true,
        tension: 180,
        friction: 18,
      }).start();
    }
  }, [activeMode, tabWidth, availableTabs.length]);

  return (
    <View
      style={s.wrapper}
      onLayout={e => setWrapperWidth(e.nativeEvent.layout.width)}
    >
      {/* Sliding pill */}
      {tabWidth > 0 && availableTabs.length > 0 && (
        <Animated.View
          style={[
            s.slider,
            {
              width: tabWidth - 6,
              transform: [
                {
                  translateX: slideAnim.interpolate({
                    inputRange: availableTabs.map((_, i) => i),
                    outputRange: availableTabs.map((_, i) => tabWidth * i + 3),
                  }),
                },
              ],
            },
          ]}
        />
      )}

      {availableTabs.map((tab, i) => {
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
            <Text style={[s.label, focused && s.labelActive]}>
              {tab.label}
            </Text>
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
