// navigation/BottomTabNavigator.tsx

import React from 'react';
import { Alert } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import OrdersStack from './OrdersStack';
import NewOrderStack from './NewOrderStack';
import ProfileScreen from '../screens/ProfileScreen';
import ServicesStack from './ServicesStack';
import { useLocationContext } from '../context/LocationContext';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const Tab = createBottomTabNavigator();

const BottomTabNavigator: React.FC = () => {
  const { location } = useLocationContext();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName: IoniconName;

          switch (route.name) {
            case "Orders":
              iconName = "list";
              break;
            case "NewOrder":
              iconName = "add-circle-outline";
              break;
            case "Services":
              iconName = "grid-outline";
              break;
            case "Profile":
              iconName = "person-outline";
              break;
            default:
              iconName = "home";
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
       tabBarActiveTintColor: "#0d9488",     // Professional teal
tabBarInactiveTintColor: "#64748b",   // Slate gray

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
      <Tab.Screen
        name="Services"
        component={ServicesStack}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            // If the current area isn't deliverable (no storeId), block Services entry
            // and prompt the user to select a deliverable location.
            if (!location?.storeId) {
              e.preventDefault();
              Alert.alert(
                "Delivery Unavailable",
                "Sorry, we don’t deliver to this location yet. Please select another location.",
                [
                  {
                    text: "Select Location",
                    onPress: () => {
                      const parentNav: any = (navigation as any).getParent?.();
                      const targetNav: any = parentNav || navigation;
                      try {
                        targetNav.navigate("LocationSelector", { fromScreen: "Services" });
                      } catch {
                        // no-op
                      }
                    },
                  },
                  { text: "Cancel", style: "cancel" },
                ]
              );
            }
          },
        })}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

export default BottomTabNavigator;
