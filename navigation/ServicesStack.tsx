import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import ServicesScreen from "../screens/ServicesScreen";
import AllServicesScreen from "../screens/AllServicesScreen";
import ServiceCategoryScreen from "../screens/ServiceCategoryScreen";
import PackageSelectionScreen from "../screens/PackageSelectionScreen";
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
      screenOptions={{
        headerShown: true,
        headerTitleAlign: "center",
        headerShadowVisible: false,
        headerStyle: { backgroundColor: "#ffffff" },
        headerTintColor: "#0f172a",
      }}
      initialRouteName="ServicesHome"
    >
      <Stack.Screen name="ServicesHome" component={ServicesScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AllServices" component={AllServicesScreen} options={{ headerShown: false }} />

      {/* Service Cart */}
      <Stack.Screen name="ServiceCart" component={ServiceCartScreen} options={{ headerShown: false }} />
      <Stack.Screen name="UnifiedCart" component={UnifiedCartScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ServiceCheckout" component={ServiceCheckoutScreen} options={{ headerShown: false }} />

      {/* Electrician / Plumber Flow */}
      <Stack.Screen name="PackageSelection" component={PackageSelectionScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ServiceCategory" component={ServiceCategoryScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CompanySelection" component={CompanySelectionScreen} options={{ headerShown: false }} />
      <Stack.Screen name="SelectDateTime" component={SelectDateTimeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Payment" component={PaymentScreen} options={{ headerShown: false }} />
      <Stack.Screen name="RazorpayWebView" component={RazorpayWebView} options={{ headerShown: false }} />

      {/* Booking Screens */}
      <Stack.Screen name="BookingDetails" component={BookingDetailsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="BookingHistory" component={BookingHistoryScreen} options={{ headerShown: false }} />
      <Stack.Screen name="BookingConfirmation" component={BookingConfirmationScreen} options={{ headerShown: false }} />
      <Stack.Screen name="TrackBooking" component={TrackBookingScreen} options={{ headerShown: false }} />

      {/* Other Services */}
      <Stack.Screen name="DailyWagesCategory" component={DailyWagesCategoryScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CleaningCategory" component={CleaningCategoryScreen} options={{ headerShown: false }} />
      <Stack.Screen name="HealthCategory" component={HealthCategoryScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CarWashCategory" component={CarWashCategoryScreen} options={{ headerShown: false }} />

      {/* Service Workflow Screens */}
      <Stack.Screen name="ServiceAddOn" component={ServiceAddOnScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ServiceCalling" component={ServiceCallingScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ServiceVisit" component={ServiceVisitScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ServiceEnd" component={ServiceEndScreen} options={{ headerShown: false }} />
      <Stack.Screen name="FinalCheckout" component={FinalCheckoutScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
