import React, { useEffect, useState, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import auth from '@react-native-firebase/auth';

import OrdersScreen from './screens/OrdersScreen';
import ContactUsScreen from './screens/ContactUsScreen';
import ProfileScreen from './screens/ProfileScreen';
import PickupLocationScreen from './screens/PickupLocationScreen';
import DropoffLocationScreen from './screens/DropoffLocationScreen';
import OrderSummaryScreen from './screens/OrderSummaryScreen';
import AdditionalInfoScreen from './screens/AdditionalInfoScreen';
import LoginScreen from './screens/LoginScreen';
import OrderTrackingScreen from './screens/OrderTrackingScreen';
import OrderAllocatingScreen from './screens/OrderAllocatingScreen';
import { CustomerProvider, useCustomer } from './context/CustomerContext';  // Import Customer Context
import RatingScreen from './screens/RatingScreen';

// Create navigators
const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Stack for the "New Order" process
const NewOrderStack = () => (
  <Stack.Navigator initialRouteName="PickupLocation">
    <Stack.Screen name="PickupLocation" component={PickupLocationScreen} />
    <Stack.Screen name="DropoffLocation" component={DropoffLocationScreen} />
    <Stack.Screen name="AdditionalInfo" component={AdditionalInfoScreen} />
    <Stack.Screen name="OrderSummary" component={OrderSummaryScreen} />
    <Stack.Screen name="OrderAllocatingScreen" component={OrderAllocatingScreen} />
    <Stack.Screen name="OrderTrackingScreen" component={OrderTrackingScreen} />
    <Stack.Screen name="RatingScreen" component={RatingScreen} />

  </Stack.Navigator>
);

// Main stack to include orders and login
const OrdersStack = () => {
  const [user, setUser] = useState<any>(null);
  const { setCustomerId } = useCustomer();  // Get the customer setter from context

  useEffect(() => {
    // Listen to authentication state changes
    const unsubscribe = auth().onAuthStateChanged((user) => {
      if (user) {
        setUser(user); // User is logged in
        setCustomerId(user.uid);  // Set the customer ID globally in the context
      } else {
        setUser(null); // No user logged in
        setCustomerId(null);  // Clear customer ID
      }
    });
    return unsubscribe;
  }, []);

  return (
    <Stack.Navigator>
      {!user ? (
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      ) : (
        <Stack.Screen name="Orders" component={OrdersScreen} options={{ headerShown: false }} />
      )}
    </Stack.Navigator>
  );
};

const App: React.FC = () => {
  const navigationRef = useRef(null);

  // Listen to incoming notifications
  useEffect(() => {
    const handleNotificationResponse = (response) => {
      const { orderId, pickupCoords, dropoffCoords } = response.notification.request.content.data;
      if (orderId) {
        // Navigate to OrderTrackingScreen with orderId, pickupCoords, and dropoffCoords
        navigationRef.current?.navigate('OrderTrackingScreen', { orderId, pickupCoords, dropoffCoords });
      }
    };

    // Listener for foreground notifications
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification Received:', notification);
    });

    // Listener for when the user taps the notification
    const responseListener = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

    return () => {
      Notifications.removeNotificationSubscription(notificationListener);
      Notifications.removeNotificationSubscription(responseListener);
    };
  }, []);

  return (
    <CustomerProvider> 
      <NavigationContainer ref={navigationRef}>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ color, size }) => {
              let iconName;
              if (route.name === 'Orders') iconName = 'list';
              else if (route.name === 'NewOrder') iconName = 'add-circle-outline';
              else if (route.name === 'ContactUs') iconName = 'call-outline';
              else if (route.name === 'Profile') iconName = 'person-outline';
              return <Ionicons name={iconName} size={size} color={color} />;
            },
            tabBarActiveTintColor: 'blue',
            tabBarInactiveTintColor: 'gray',
          })}
        >
          <Tab.Screen name="Orders" component={OrdersStack} />
          <Tab.Screen name="NewOrder" component={NewOrderStack} />
          <Tab.Screen name="ContactUs" component={ContactUsScreen} />
          <Tab.Screen name="Profile" component={ProfileScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </CustomerProvider>
  );
};

export default App;
