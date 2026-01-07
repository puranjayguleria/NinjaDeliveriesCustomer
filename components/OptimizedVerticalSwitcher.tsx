// @/components/OptimizedVerticalSwitcher.tsx
import React, { useEffect, useRef, useCallback, memo } from "react";
import { View, Pressable, Text, StyleSheet, Animated, Vibration } from "react-native";

type Mode = "grocery" | "restaurants";

type Props = {
  active: Mode;
  onChange?: (next: Mode) => void;
};

export const OptimizedVerticalSwitcher: React.FC<Props> = memo(({ active, onChange }) => {
  const translateX = useRef(new Animated.Value(active === "grocery" ? 0 : 1)).current;
  const scaleGrocery = useRef(new Animated.Value(active === "grocery" ? 1 : 0.95)).current;
  const scaleEats = useRef(new Animated.Value(active === "restaurants" ? 1 : 0.95)).current;

  useEffect(() => {
    // Optimized spring animation with better performance
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: active === "grocery" ? 0 : 1,
        useNativeDriver: true,
        friction: 8,
        tension: 120,
        restDisplacementThreshold: 0.01,
        restSpeedThreshold: 0.01,
      }),
      Animated.spring(scaleGrocery, {
        toValue: active === "grocery" ? 1 : 0.95,
        useNativeDriver: true,
        friction: 8,
        tension: 120,
      }),
      Animated.spring(scaleEats, {
        toValue: active === "restaurants" ? 1 : 0.95,
        useNativeDriver: true,
        friction: 8,
        tension: 120,
      }),
    ]).start();
  }, [active, translateX, scaleGrocery, scaleEats]);

  const thumbTranslate = translateX.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 52],
  });

  // Safe haptic feedback using Vibration API
  const provideFeedback = useCallback(() => {
    try {
      // Use Vibration API as fal