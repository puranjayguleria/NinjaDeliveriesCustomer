// @/components/VerticalSwitcher.tsx
import React, { useEffect, useRef, useCallback, memo } from "react";
import { View, Pressable, Text, StyleSheet, Animated } from "react-native";

type Mode = "grocery" | "restaurants";

type Props = {
  active: Mode;
  onChange?: (next: Mode) => void;
};

export const VerticalSwitcher: React.FC<Props> = memo(({ active, onChange }) => {
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
    outputRange: [2, 52], // 👈 thumb positions
  });

  // Optimized press handlers
  const handleGroceryPress = useCallback(() => {
    if (active !== "grocery") {
      onChange?.("grocery");
    }
  }, [active, onChange]);

  const handleEatsPress = useCallback(() => {
    if (active !== "restaurants") {
      onChange?.("restaurants");
    }
  }, [active, onChange]);

  return (
    <View style={styles.container}>
      {/* Sliding thumb with optimized animation */}
      <Animated.View
        style={[
          styles.thumb,
          {
            transform: [{ translateX: thumbTranslate }],
          },
        ]}
      />

      <Animated.View style={[styles.option, { transform: [{ scale: scaleGrocery }] }]}>
        <Pressable
          style={styles.pressable}
          onPress={handleGroceryPress}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text
            style={[
              styles.label,
              active === "grocery" && styles.labelActive,
            ]}
          >
            Grocery
          </Text>
        </Pressable>
      </Animated.View>

      <Animated.View style={[styles.option, { transform: [{ scale: scaleEats }] }]}>
        <Pressable
          style={styles.pressable}
          onPress={handleEatsPress}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text
            style={[
              styles.label,
              active === "restaurants" && styles.labelActive,
            ]}
          >
            Eats
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
});

VerticalSwitcher.displayName = "VerticalSwitcher";
const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    width: 120,              // slightly wider
    height: 36,              // more touch-friendly
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.95)",
    padding: 4,              // proper inner spacing
    marginTop: 6,            // spacing from elements above
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },

  thumb: {
    position: "absolute",
    width: 56,               // matches half of container minus padding
    height: 28,
    borderRadius: 14,
    backgroundColor: "#00b4a0",
    top: 4,                  // centers thumb vertically
    left: 4,                 // default (animated horizontally)
  },

  option: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },

  pressable: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 4,      // better tap target
  },

  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#555",
  },

  labelActive: {
    color: "#fff",
  },
});
