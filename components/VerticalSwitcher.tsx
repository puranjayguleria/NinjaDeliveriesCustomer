// @/components/VerticalSwitcher.tsx
import React, { useCallback, memo, useState, useEffect } from "react";
import { View, Pressable, Text, StyleSheet, ActivityIndicator } from "react-native";

type Mode = "grocery" | "restaurants";

type Props = {
  active: Mode;
  onChange?: (next: Mode) => void;
};

export const VerticalSwitcher: React.FC<Props> = memo(({ active, onChange }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [pendingMode, setPendingMode] = useState<Mode | null>(null);

  // Reset loading state when active mode changes
  useEffect(() => {
    if (pendingMode && active === pendingMode) {
      // Keep loader visible for a bit longer to ensure smooth transition
      setTimeout(() => {
        setIsLoading(false);
        setPendingMode(null);
      }, 300);
    }
  }, [active, pendingMode]);

  // Optimized press handlers with loading state
  const handleEatsPress = useCallback(() => {
    if (active !== "restaurants" && !isLoading) {
      setIsLoading(true);
      setPendingMode("restaurants");
      // Add a small delay to show the loader before navigation
      setTimeout(() => {
        onChange?.("restaurants");
      }, 150);
    }
  }, [active, onChange, isLoading]);

  const handleGroceryPress = useCallback(() => {
    if (active !== "grocery" && !isLoading) {
      setIsLoading(true);
      setPendingMode("grocery");
      // Add a small delay to show the loader before navigation
      setTimeout(() => {
        onChange?.("grocery");
      }, 150);
    }
  }, [active, onChange, isLoading]);

  return (
    <View style={styles.container}>
      {/* Loading Overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator 
            size="small" 
            color={pendingMode === "restaurants" ? "#2196F3" : "#4CAF50"} 
          />
          <Text style={styles.loadingText}>
            Switching to {pendingMode === "restaurants" ? "Eats" : "Grocery"}...
          </Text>
        </View>
      )}

      {/* Eats Tab - First */}
      <View style={[
        styles.option, 
        styles.eatsTab,
        active === "restaurants" ? styles.eatsActive : styles.eatsInactive,
        isLoading && styles.optionDisabled
      ]}>
        <Pressable
          style={styles.pressable}
          onPress={handleEatsPress}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          disabled={isLoading}
        >
          <Text
            style={[
              styles.label,
              active === "restaurants" && styles.eatsLabelActive,
              isLoading && styles.labelDisabled,
            ]}
          >
            Eats
          </Text>
        </Pressable>
      </View>

      {/* Grocery Tab - Second */}
      <View style={[
        styles.option, 
        styles.groceryTab,
        active === "grocery" ? styles.groceryActive : styles.groceryInactive,
        isLoading && styles.optionDisabled
      ]}>
        <Pressable
          style={styles.pressable}
          onPress={handleGroceryPress}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          disabled={isLoading}
        >
          <Text
            style={[
              styles.label,
              active === "grocery" && styles.groceryLabelActive,
              isLoading && styles.labelDisabled,
            ]}
          >
            Grocery
          </Text>
        </Pressable>
      </View>
    </View>
  );
});

VerticalSwitcher.displayName = "VerticalSwitcher";

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    width: 150,              // slightly wider for better spacing
    height: 40,              // more touch-friendly
    borderRadius: 10,         // box-like appearance
    backgroundColor: "#f5f5f5",
    padding: 4,              // minimal padding for box effect
    marginTop: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    position: "relative",    // For loading overlay positioning
  },

  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    flexDirection: "row",
    paddingHorizontal: 8,
  },

  loadingText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#666",
    marginLeft: 6,
  },

  option: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 6,         // slightly rounded corners for box tabs
    marginHorizontal: 1,     // small gap between tabs
  },

  optionDisabled: {
    opacity: 0.6,
  },

  // Eats tab styles (Blue)
  eatsTab: {
    // Base eats tab styling
  },

  eatsActive: {
    backgroundColor: "#2196F3", // Blue color for active Eats
    shadowColor: "#2196F3",
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },

  eatsInactive: {
    backgroundColor: "transparent",
  },

  // Grocery tab styles (Green)
  groceryTab: {
    // Base grocery tab styling
  },

  groceryActive: {
    backgroundColor: "#4CAF50", // Green color for active Grocery
    shadowColor: "#4CAF50",
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },

  groceryInactive: {
    backgroundColor: "transparent",
  },

  pressable: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 6,      // better tap target
    borderRadius: 6,
  },

  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
  },

  labelDisabled: {
    opacity: 0.5,
  },

  eatsLabelActive: {
    color: "#fff",           // White text for active blue tab
    fontWeight: "700",
  },

  groceryLabelActive: {
    color: "#fff",           // White text for active green tab
    fontWeight: "700",
  },
});
