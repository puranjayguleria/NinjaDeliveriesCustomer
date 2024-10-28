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
import { CustomerProvider, useCustomer } from './context/CustomerContext';
import RatingScreen from './screens/RatingScreen';
import BusinessDirectoryScreen from './screens/BusinessDirectoryScreen';
import NewOrderCancelledScreen from './screens/NewOrderCancelledScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// New Order Stack Navigator
const NewOrderStack = () => (
  <Stack.Navigator initialRouteName="PickupLocation">
    <Stack.Screen 
      name="PickupLocation" 
      component={PickupLocationScreen} 
      options={{ title: 'Pickup Location' }} 
    />
    <Stack.Screen 
      name="DropoffLocation" 
      component={DropoffLocationScreen} 
      options={{ title: 'Dropoff Location' }} 
    />
    <Stack.Screen 
      name="AdditionalInfo" 
      component={AdditionalInfoScreen} 
      options={{ title: 'Additional Information' }} 
    />
    <Stack.Screen 
      name="OrderSummary" 
      component={OrderSummaryScreen} 
      options={{ title: 'Order Summary' }} 
    />
    <Stack.Screen 
      name="OrderAllocatingScreen" 
      component={OrderAllocatingScreen} 
      options={{ title: 'Order Allocating' }} 
    />
    <Stack.Screen 
      name="OrderTrackingScreen" 
      component={OrderTrackingScreen} 
      options={{ title: 'Order Tracking' }} 
    />
    <Stack.Screen 
      name="RatingScreen" 
      component={RatingScreen} 
      options={{ title: 'Rating' }} 
    />
    <Stack.Screen 
    name="NewOrderCancelledScreen" 
    component={NewOrderCancelledScreen} 
    options={{ title: 'Order Cancelled' }} />

  </Stack.Navigator>
);


const OrdersStack = () => {
  const [user, setUser] = useState<any>(null);
  const { setCustomerId } = useCustomer();

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged((user) => {
      if (user) {
        setUser(user);
        setCustomerId(user.uid);
      } else {
        setUser(null);
        setCustomerId(null);
      }
    });

    return unsubscribe;
  }, []);

  return (
    <Stack.Navigator>
      {!user ? (
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      ) : (
        <>
          <Stack.Screen name="Orders" component={OrdersScreen} options={{ headerShown: false }} />
          <Stack.Screen name="OrderAllocatingScreen" component={OrderAllocatingScreen} />
          <Stack.Screen 
            name="OrderTrackingScreen" 
            component={OrderTrackingScreen} 
            options={{ headerLeft: () => null }} 
          />
          <Stack.Screen 
            name="RatingScreen" 
            component={RatingScreen} 
            options={{ headerLeft: () => null }} 
          />
          <Stack.Screen name="NewOrderCancelledScreen" component={NewOrderCancelledScreen} options={{ title: 'Order Cancelled' }} />

        </>
      )}
    </Stack.Navigator>
  );
};

const App: React.FC = () => {
  const navigationRef = useRef(null);

  // Handle notifications
  useEffect(() => {
    const handleNotificationResponse = (response) => {
      const { orderId, pickupCoords, dropoffCoords, status } = response.notification.request.content.data;

      if (orderId) {
        if (status === 'pending') {
          navigationRef.current?.navigate('OrderAllocatingScreen', { orderId, pickupCoords, dropoffCoords });
        } else {
          navigationRef.current?.navigate('OrderTrackingScreen', { orderId, pickupCoords, dropoffCoords });
        }
      }
    };

    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification Received:', notification);
    });

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
      switch (route.name) {
        case 'Orders':
          iconName = 'list';
          break;
        case 'NewOrder':
          iconName = 'add-circle-outline';
          break;
        case 'ContactUs':
          iconName = 'call-outline';
          break;
        case 'Profile':
          iconName = 'person-outline';
          break;
        case 'Business':
          iconName = 'briefcase-outline';
          break;
        default:
          iconName = 'home';
      }
      return <Ionicons name={iconName} size={size} color={color} />;
    },
    tabBarActiveTintColor: 'blue',
    tabBarInactiveTintColor: 'gray',
    headerShown: false, // Hides headers for all tab screens
  })}
>
  <Tab.Screen name="Orders" component={OrdersStack} />
  <Tab.Screen 
    name="NewOrder" 
    component={NewOrderStack}
    listeners={({ navigation }) => ({
      tabPress: (e) => {
        e.preventDefault();
        navigation.navigate('NewOrder', { screen: 'PickupLocation' });
      },
    })}
  />
  <Tab.Screen name="ContactUs" component={ContactUsScreen} />
  <Tab.Screen name="Business" component={BusinessDirectoryScreen} />
  <Tab.Screen name="Profile" component={ProfileScreen} />
</Tab.Navigator>

      </NavigationContainer>
    </CustomerProvider>
  );
};

export default App;
