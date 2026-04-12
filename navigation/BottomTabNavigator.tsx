// navigation/BottomTabNavigator.tsx

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import OrdersStack from './OrdersStack';
import NewOrderStack from './NewOrderStack';
import ProfileScreen from '../screens/shared/ProfileScreen';
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
            case "Profile":
              iconName = "person-outline";
              break;
            default:
              iconName = "home";
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#0d9488",
        tabBarInactiveTintColor: "#64748b",
        headerShown: false,
      })}
    >
      <Tab.Screen name="Orders" component={OrdersStack} />
      {(location?.grocery !== false) && (
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
      )}
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

export default BottomTabNavigator;
