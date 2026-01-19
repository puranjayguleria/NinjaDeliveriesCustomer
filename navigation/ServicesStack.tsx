import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import ServicesScreen from "../screens/ServicesScreen";
import ServiceCategoryScreen from "../screens/ServiceCategoryScreen";
import SelectDateTimeScreen from "../screens/SelectDateTimeScreen";
import SelectAgencyScreen from "../screens/SelectAgencyScreen";
import PaymentScreen from "../screens/PaymentScreen";
import BookingDetailsScreen from "../screens/BookingDetailsScreen";
import BookingHistoryScreen from "../screens/BookingHistoryScreen";

const Stack = createNativeStackNavigator();

export default function ServicesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ServicesHome" component={ServicesScreen} />
      <Stack.Screen name="ServiceCategory" component={ServiceCategoryScreen} />
      <Stack.Screen name="SelectDateTime" component={SelectDateTimeScreen} />
      <Stack.Screen name="SelectAgency" component={SelectAgencyScreen} />
      <Stack.Screen name="Payment" component={PaymentScreen} />
      <Stack.Screen name="BookingDetails" component={BookingDetailsScreen} />
      <Stack.Screen name="BookingHistory" component={BookingHistoryScreen} />
    </Stack.Navigator>
  );
}
