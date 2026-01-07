// navigation/BusinessStack.tsx

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import BusinessDetailScreen from '../screens/BusinessDetailScreen';

const Stack = createStackNavigator();

const BusinessStack: React.FC = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen
      name="BusinessDetail"
      component={BusinessDetailScreen}
    />
  </Stack.Navigator>
);

export default BusinessStack;