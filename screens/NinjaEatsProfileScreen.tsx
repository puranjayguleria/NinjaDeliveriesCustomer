// screens/NinjaEatsProfileScreen.tsx
import React, { memo } from "react";
import ProfileScreen from "./ProfileScreen";

// Lightweight wrapper for NinjaEats profile tab
// Uses memo to prevent unnecessary re-renders when switching tabs
const NinjaEatsProfileScreen = memo(() => {
  return <ProfileScreen />;
});

NinjaEatsProfileScreen.displayName = "NinjaEatsProfileScreen";

export default NinjaEatsProfileScreen;