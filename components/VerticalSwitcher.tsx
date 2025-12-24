// @/components/VerticalSwitcher.tsx
import React from "react";
import { View, Pressable, Text, StyleSheet } from "react-native";

type Mode = "grocery" | "restaurants";

type Props = {
  active: Mode;
  onChange?: (next: Mode) => void;
};

export const VerticalSwitcher: React.FC<Props> = ({ active, onChange }) => {
  const isGrocery = active === "grocery";
  const isRestaurants = active === "restaurants";

  return (
    <View style={styles.container}>
      <Pressable
        style={[styles.pill, isGrocery && styles.pillActive]}
        onPress={() => onChange?.("grocery")}
      >
        <Text style={[styles.label, isGrocery && styles.labelActive]}>
          Grocery
        </Text>
      </Pressable>

      <Pressable
        style={[styles.pill, isRestaurants && styles.pillActive]}
        onPress={() => onChange?.("restaurants")}
      >
        <Text style={[styles.label, isRestaurants && styles.labelActive]}>
          Ninja Eats
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    // 🔥 Solid, high-contrast pill behind the tabs
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 999,
    padding: 3,
    // Light shadow so it pops over the video
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillActive: {
    backgroundColor: "#00b4a0", // Ninja green accent
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333", // dark text for contrast on white
  },
  labelActive: {
    color: "#fff", // white text on active green
  },
});
