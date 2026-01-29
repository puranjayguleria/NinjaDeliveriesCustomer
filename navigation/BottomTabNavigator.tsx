// navigation/BottomTabNavigator.tsx

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import OrdersStack from './OrdersStack';
import NewOrderStack from './NewOrderStack';
import ContactUsScreen from '../screens/ContactUsScreen';
import BusinessStack from './BusinessStack';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

const BottomTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName: string;

          switch (route.name) {
            case "Orders":
              iconName = "list";
              break;
            case "NewOrder":
              iconName = "add-circle-outline";
              break;
            case "ContactUs":
              iconName = "call-outline";
              break;
            case "Business":
              iconName = "briefcase-outline";
              break;
            case "Profile":
              iconName = "person-outline";
              break;
            default:
              iconName = "home";
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "blue",
        tabBarInactiveTintColor: "gray",
        headerShown: false,
      })}
    >
      <Tab.Screen name="Orders" component={OrdersStack} />
      <Tab.Screen
        name="NewOrder"
        component={NewOrderStack}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate("NewOrder", { screen: "GroceryCatalog" });
          },
        })}
      />
      <Tab.Screen name="Business" component={BusinessStack} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

export default BottomTabNavigator;
