import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import ServicesScreen from "../screens/ServicesScreen";
import AllServicesScreen from "../screens/AllServicesScreen";
import ServiceCategoryScreen from "../screens/ServiceCategoryScreen";
import CompanySelectionScreen from "../screens/CompanySelectionScreen";
import SelectDateTimeScreen from "../screens/SelectDateTimeScreen";
import PaymentScreen from "../screens/PaymentScreen";
import RazorpayWebView from "../screens/RazorpayWebView";
import BookingDetailsScreen from "../screens/BookingDetailsScreen";
import BookingHistoryScreen from "../screens/BookingHistoryScreen";
import TrackBookingScreen from "../screens/TrackBookingScreen";
import BookingConfirmationScreen from "../screens/BookingConfirmationScreen";
import ServiceCartScreen from "../screens/ServiceCartScreen";
import ServiceCheckoutScreen from "../screens/ServiceCheckoutScreen";
import UnifiedCartScreen from "../screens/UnifiedCartScreen";

// ✅ Single-file flows
import DailyWagesCategoryScreen from "../screens/DailyWagesCategoryScreen";
import CleaningCategoryScreen from "../screens/CleaningCategoryScreen";
import HealthCategoryScreen from "../screens/HealthCategoryScreen";
import CarWashCategoryScreen from "../screens/CarWashCategoryScreen";

// ✅ Service workflow screens
import ServiceAddOnScreen from "../screens/ServiceAddOnScreen";
import ServiceCallingScreen from "../screens/ServiceCallingScreen";
import ServiceVisitScreen from "../screens/ServiceVisitScreen";
import ServiceEndScreen from "../screens/ServiceEndScreen";
import FinalCheckoutScreen from "../screens/FinalCheckoutScreen";

const Stack = createNativeStackNavigator();

export default function ServicesStack() {
  return (
    <Stack.Navigator 
      screenOptions={{ headerShown: false }}
      initialRouteName="ServicesHome"
    >
      <Stack.Screen name="ServicesHome" component={ServicesScreen} />
      <Stack.Screen name="AllServices" component={AllServicesScreen} />

      {/* Service Cart */}
      <Stack.Screen name="ServiceCart" component={ServiceCartScreen} />
      <Stack.Screen name="UnifiedCart" component={UnifiedCartScreen} />
      <Stack.Screen name="ServiceCheckout" component={ServiceCheckoutScreen} />

      {/* Electrician / Plumber Flow */}
      <Stack.Screen name="ServiceCategory" component={ServiceCategoryScreen} />
      <Stack.Screen name="CompanySelection" component={CompanySelectionScreen} />
      <Stack.Screen name="SelectDateTime" component={SelectDateTimeScreen} />
      <Stack.Screen name="Payment" component={PaymentScreen} />
      <Stack.Screen name="RazorpayWebView" component={RazorpayWebView} />

      {/* Booking Screens */}
      <Stack.Screen name="BookingDetails" component={BookingDetailsScreen} />
      <Stack.Screen name="BookingHistory" component={BookingHistoryScreen} />
      <Stack.Screen name="BookingConfirmation" component={BookingConfirmationScreen} />
      <Stack.Screen name="TrackBooking" component={TrackBookingScreen} />

      {/* Other Services */}
      <Stack.Screen name="DailyWagesCategory" component={DailyWagesCategoryScreen} />
      <Stack.Screen name="CleaningCategory" component={CleaningCategoryScreen} />
      <Stack.Screen name="HealthCategory" component={HealthCategoryScreen} />
      <Stack.Screen name="CarWashCategory" component={CarWashCategoryScreen} />

      {/* Service Workflow Screens */}
      <Stack.Screen name="ServiceAddOn" component={ServiceAddOnScreen} />
      <Stack.Screen name="ServiceCalling" component={ServiceCallingScreen} />
      <Stack.Screen name="ServiceVisit" component={ServiceVisitScreen} />
      <Stack.Screen name="ServiceEnd" component={ServiceEndScreen} />
      <Stack.Screen name="FinalCheckout" component={FinalCheckoutScreen} />
    </Stack.Navigator>
  );
}
