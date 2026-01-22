import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import ServicesScreen from "../screens/ServicesScreen";
import ServiceCategoryScreen from "../screens/ServiceCategoryScreen";
import CompanySelectionScreen from "../screens/CompanySelectionScreen";
import SelectDateTimeScreen from "../screens/SelectDateTimeScreen";
import SelectAgencyScreen from "../screens/SelectAgencyScreen";
import PaymentScreen from "../screens/PaymentScreen";
import BookingDetailsScreen from "../screens/BookingDetailsScreen";
import BookingHistoryScreen from "../screens/BookingHistoryScreen";

// ✅ Single-file flows
import DailyWagesCategoryScreen from "../screens/DailyWagesCategoryScreen";
import CleaningCategoryScreen from "../screens/CleaningCategoryScreen";
import HealthCategoryScreen from "../screens/HealthCategoryScreen";
import CarWashCategoryScreen from "../screens/CarWashCategoryScreen";

const Stack = createNativeStackNavigator();

export default function ServicesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ServicesHome" component={ServicesScreen} />

      {/* Electrician / Plumber Flow */}
      <Stack.Screen name="ServiceCategory" component={ServiceCategoryScreen} />
      <Stack.Screen name="CompanySelection" component={CompanySelectionScreen} />
      <Stack.Screen name="SelectDateTime" component={SelectDateTimeScreen} />
      <Stack.Screen name="SelectAgency" component={SelectAgencyScreen} />
      <Stack.Screen name="Payment" component={PaymentScreen} />

      {/* Booking Screens */}
      <Stack.Screen name="BookingDetails" component={BookingDetailsScreen} />
      <Stack.Screen name="BookingHistory" component={BookingHistoryScreen} />

      {/* Other Services */}
      <Stack.Screen name="DailyWagesCategory" component={DailyWagesCategoryScreen} />
      <Stack.Screen name="CleaningCategory" component={CleaningCategoryScreen} />
      <Stack.Screen name="HealthCategory" component={HealthCategoryScreen} />
      <Stack.Screen name="CarWashCategory" component={CarWashCategoryScreen} />
    </Stack.Navigator>
  );
}
