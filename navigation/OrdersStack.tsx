
import React, { useEffect, useState } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { ActivityIndicator, View, StyleSheet, Alert } from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useCustomer } from '../context/CustomerContext';
import OrdersScreen from '../screens/OrdersScreen';
import OrderAllocatingScreen from '../screens/OrderAllocatingScreen';
import OrderTrackingScreen from '../screens/OrderTrackingScreen';
import RatingScreen from '../screens/RatingScreen';
import NewOrderCancelledScreen from '../screens/NewOrderCancelledScreen';
import LoginScreen from '../screens/LoginScreen';
import TermsAndConditionsScreen from '../screens/TermsAndConditionsScreen';

const Stack = createStackNavigator();

const OrdersStack: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const { setCustomerId } = useCustomer();

  useEffect(() => {
    const unsubscribeAuth = auth().onAuthStateChanged(async (user) => {
      if (user) {
        setUser(user);
        setCustomerId(user.uid);

        try {
          const userDoc = await firestore().collection('users').doc(user.uid).get();
          if (userDoc.exists) {
            const data = userDoc.data();
            setHasAcceptedTerms(data?.hasAcceptedTerms ?? false);
          } else {
            await firestore().collection('users').doc(user.uid).set({
              phoneNumber: user.phoneNumber,
              expoPushToken: null, 
              hasAcceptedTerms: false,
            });
            setHasAcceptedTerms(false);
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          Alert.alert("Error", "Failed to fetch user data.");
          setHasAcceptedTerms(false);
        } finally {
          setLoading(false);
        }
      } else {
        setUser(null);
        setCustomerId(null);
        setHasAcceptedTerms(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  if (loading) {
    
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00C853" />
      </View>
    );
  }

  return (
    <Stack.Navigator>
      {!user ? (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
      ) : hasAcceptedTerms === false ? (
        <Stack.Screen
          name="TermsAndConditions"
          component={TermsAndConditionsScreen}
          options={{ headerShown: false }}
        />
      ) : (
        <Stack.Group>
          <Stack.Screen
            name="Orders"
            component={OrdersScreen}
            options={{ headerShown: false }}
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
              headerLeft: () => null, 
              gestureEnabled: false, 
            }}
          />
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default OrdersStack;
