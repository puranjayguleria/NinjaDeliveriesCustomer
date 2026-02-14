// components/BlinkingInProgressBar.tsx
import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from "react-native";
import { useNavigation, CommonActions } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

interface ActiveOrder {
  id: string;
  status: string;
  // Add any other fields as needed
}

interface BlinkingInProgressBarProps {
  orders: ActiveOrder[];
  currentRouteName?: string;
}

const BlinkingInProgressBar: React.FC<BlinkingInProgressBarProps> = ({
  orders,
  currentRouteName,
}) => {
  const navigation = useNavigation();
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Count orders with status "pending" or "active"
  const inProgressCount = orders.filter(
    (order) => order.status === "pending" || order.status === "active"
  ).length;

  // Start pulsing animation
  useEffect(() => {
    const shouldRender = inProgressCount > 0 && currentRouteName !== "Profile";
    if (!shouldRender) {
      fadeAnim.setValue(1);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0.85,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [currentRouteName, fadeAnim, inProgressCount]);

  if (inProgressCount === 0 || currentRouteName === "Profile") return null;

  const handlePress = () => {
    console.log("[BlinkingInProgressBar] Bar tapped");
    // Dispatch a reset action for demonstration.
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "Profile" }],
      })
    );
    console.log("[BlinkingInProgressBar] Reset action dispatched");
  };

  return (
    <Animated.View
      style={[styles.inProgressBar, { opacity: fadeAnim }]}
      pointerEvents="box-none" // Allow touches to propagate to children.
    >
      <TouchableOpacity
        onPress={handlePress}
        style={styles.touchableArea}
        activeOpacity={0.8}
      >
        <Text style={styles.messageText}>
          You have {inProgressCount} pending order
          {inProgressCount > 1 ? "s" : ""}. Tap to view.
        </Text>
        <Ionicons name="chevron-forward" size={20} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  inProgressBar: {
    position: "absolute",
    bottom: 70, // Adjust based on your tab bar height
    left: 20,
    right: 20,
    backgroundColor: "#f39c12",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 25,
    flexDirection: "row",
    alignItems: "center",
    elevation: 10, // Increase elevation to make sure it's on top
    zIndex: 1000,
  },
  touchableArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  messageText: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "600",
  },
});

export default BlinkingInProgressBar;
