// navigation/NewOrderStack.tsx

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import ProductsHomeScreen from '../screens/grocery/ProductsHomeScreen';
import DropoffLocationScreen from '../screens/shared/DropoffLocationScreen';
import AdditionalInfoScreen from '../screens/services/AdditionalInfoScreen';
import OrderSummaryScreen from '../screens/shared/OrderSummaryScreen';
import OrderAllocatingScreen from '../screens/grocery/OrderAllocatingScreen';
import OrderTrackingScreen from '../screens/grocery/OrderTrackingScreen';
import RatingScreen from '../screens/shared/RatingScreen';
import NewOrderCancelledScreen from '../screens/grocery/NewOrderCancelledScreen';

export type NewOrderStackParamList = {
  GroceryCatalog: undefined;
  DropoffLocation: {
    pickupCoords: {
      latitude: number;
      longitude: number;
    };
    pickupDetails: {
      name: string;
      address: string;
      coordinates: {
        latitude: number;
        longitude: number;
      };
    };
  };
  AdditionalInfo: {
    dropoffCoords: {
      latitude: number;
      longitude: number;
    };
    dropoffDetails: {
      name: string;
      address: string;
    };
  };
  OrderSummary: {
    pickupCoords: {
      latitude: number;
      longitude: number;
    };
    pickupDetails: {
      name: string;
      address: string;
      coordinates: {
        latitude: number;
        longitude: number;
      };
    };
    dropoffCoords: {
      latitude: number;
      longitude: number;
    };
    dropoffDetails: {
      name: string;
      address: string;
    };
    parcelDetails: {
      packageDescription: string;
      packageWeight: string;
      promoCode?: string;
      discountApplied?: boolean;
      discountLabel?: string;
      promoId?: string;
      promoType?: string;
      promoAmount?: number;
    };
  };
  OrderAllocatingScreen: {
    orderId: string;
    dropoffCoords: {
      latitude: number;
      longitude: number;
    };
    pickupCoords: {
      latitude: number;
      longitude: number;
    };
    totalCost: number;
  };
  OrderTrackingScreen: {
    orderId: string;
  };
  RatingScreen: {
    orderId: string;
  };
  NewOrderCancelledScreen: undefined;
};

const Stack = createStackNavigator<NewOrderStackParamList>();

const NewOrderStack: React.FC = () => (
  <Stack.Navigator initialRouteName="GroceryCatalog">
    <Stack.Screen
      name="GroceryCatalog"
      component={ProductsHomeScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="DropoffLocation"
      component={DropoffLocationScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="AdditionalInfo"
      component={AdditionalInfoScreen}
      options={{ title: "Additional Information" }}
    />
    <Stack.Screen
      name="OrderSummary"
      component={OrderSummaryScreen}
      options={{ title: "Order Summary" }}
    />
    <Stack.Screen
      name="OrderAllocatingScreen"
      component={OrderAllocatingScreen}
      options={{
        title: "Order Allocating",
        headerLeft: () => null,
        gestureEnabled: false,
      }}
    />
    <Stack.Screen
      name="OrderTrackingScreen"
      component={OrderTrackingScreen}
      options={{
        title: "Order Tracking",
        headerLeft: () => null,
        gestureEnabled: false,
      }}
    />
    <Stack.Screen
      name="RatingScreen"
      component={RatingScreen}
      options={{ title: "Rating" }}
    />
    <Stack.Screen
      name="NewOrderCancelledScreen"
      component={NewOrderCancelledScreen}
      options={{
        title: "Order Cancelled",
        headerLeft: () => null, // Disables back button
        gestureEnabled: false, // Disables swipe gesture to go back
      }}
    />
  </Stack.Navigator>
);

export default NewOrderStack;
