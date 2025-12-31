// @/components/VerticalSwitcher.tsx
import React, { useEffect, useRef } from "react";
import { View, Pressable, Text, StyleSheet, Animated } from "react-native";

type Mode = "grocery" | "restaurants";

type Props = {
  active: Mode;
  onChange?: (next: Mode) => void;
};

export const VerticalSwitcher: React.FC<Props> = ({ active, onChange }) => {
  const translateX = useRef(new Animated.Value(active === "grocery" ? 0 : 1))
    .current;

  useEffect(() => {
    Animated.spring(translateX, {
      toValue: active === "grocery" ? 0 : 1,
      useNativeDriver: true,
      friction: 7,
    }).start();
  }, [active]);

  const thumbTranslate = translateX.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 52], // 👈 thumb positions
  });

  return (
    <View style={styles.container}>
      {/* Sliding thumb */}
      <Animated.View
        style={[
          styles.thumb,
          {
            transform: [{ translateX: thumbTranslate }],
          },
        ]}
      />

      <Pressable
        style={styles.option}
        onPress={() => onChange?.("grocery")}
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

      <Pressable
        style={styles.option}
        onPress={() => onChange?.("restaurants")}
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
    </View>
  );
};
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
