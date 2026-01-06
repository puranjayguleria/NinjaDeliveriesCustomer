// navigation/BottomTabNavigator.tsx

import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import OrdersStack from "./OrdersStack";
import NewOrderStack from "./NewOrderStack";
import ContactUsScreen from "../screens/ContactUsScreen";
import BusinessStack from "./BusinessStack";
import ProfileScreen from "../screens/ProfileScreen";

const Tab = createBottomTabNavigator();

const BottomTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,

        // 🔥 PERFORMANCE FIXES
        unmountOnBlur: false,
        lazy: false,
        detachInactiveScreens: false,

        tabBarIcon: ({ color, size }) => {
          let iconName: any = "home";

          if (route.name === "Orders") iconName = "list";
          if (route.name === "NewOrder") iconName = "add-circle-outline";
          if (route.name === "ContactUs") iconName = "call-outline";
          if (route.name === "Business") iconName = "briefcase-outline";
          if (route.name === "Profile") iconName = "person-outline";

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#007AFF",
        tabBarInactiveTintColor: "#888",
      })}
    >
      <Tab.Screen name="Orders" component={OrdersStack} />
      <Tab.Screen name="NewOrder" component={NewOrderStack} />
      <Tab.Screen name="ContactUs" component={ContactUsScreen} />
      <Tab.Screen name="Business" component={BusinessStack} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

export default BottomTabNavigator;
