import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import * as Notifications from 'expo-notifications';
import { useCustomer } from '../context/CustomerContext'; // Import Customer Context

const LoginScreen: React.FC = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [confirmation, setConfirmation] = useState<any>(null); // To store the confirmation result
  const [otp, setOtp] = useState(''); // OTP entered by the user
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const { setCustomerId } = useCustomer(); // Access the global state to set customerId

  // Function to send OTP
  const sendOtp = async () => {
    if (!phoneNumber) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return;
    }

    try {
      const confirmationResult = await auth().signInWithPhoneNumber(phoneNumber);
      setConfirmation(confirmationResult); // Store the confirmation result for later OTP verification
      Alert.alert('OTP Sent', 'Please check your phone for the OTP.');
    } catch (error) {
      Alert.alert('Error', `Failed to send OTP: ${error.message}`);
    }
  };

  // Function to verify OTP
  const confirmOtp = async () => {
    if (!otp) {
      Alert.alert('Error', 'Please enter the OTP');
      return;
    }

    try {
      await confirmation.confirm(otp); // Confirm the OTP with Firebase
      const user = auth().currentUser;
      if (user) {
        setCustomerId(user.uid); // Set customerId in context
        await saveUserInfo(); // Save user info after login
        Alert.alert('Success', 'You have successfully logged in!');
      }
    } catch (error) {
      Alert.alert('Error', 'Invalid OTP, please try again.');
    }
  };

  // Function to save user info (expo push token and phone number)
  const saveUserInfo = async () => {
    try {
      const user = auth().currentUser;
      if (user) {
        const userDoc = firestore().collection('users').doc(user.uid);
        await userDoc.set({
          phoneNumber: phoneNumber,
          expoPushToken: expoPushToken,
        });
        Alert.alert('User info saved');
      }
    } catch (error) {
      console.error('Error saving user info:', error);
      Alert.alert('Error', 'Failed to save user information');
    }
  };

  // Function to register for push notifications
  const registerForPushNotificationsAsync = async () => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        Alert.alert('Failed to get push token for push notifications!');
        return;
      }

      const token = (await Notifications.getExpoPushTokenAsync()).data;
      console.log('Expo Push Token:', token);
      setExpoPushToken(token);
    } catch (error) {
      console.error('Error during push notification registration:', error);
    }
  };

  // Call registerForPushNotifications when the component mounts
  useEffect(() => {
    registerForPushNotificationsAsync();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login with Phone Number</Text>

      {/* Phone Number Input */}
      <TextInput
        style={styles.input}
        placeholder="Enter phone number"
        keyboardType="phone-pad"
        value={phoneNumber}
        onChangeText={setPhoneNumber}
      />

      {/* Button to send OTP */}
      <Button title="Send OTP" onPress={sendOtp} color="#0066FF" />

      {/* OTP Input (Visible only after OTP is sent) */}
      {confirmation && (
        <>
          <TextInput
            style={styles.input}
            placeholder="Enter OTP"
            keyboardType="numeric"
            value={otp}
            onChangeText={setOtp}
          />

          {/* Button to confirm OTP */}
          <Button title="Confirm OTP" onPress={confirmOtp} color="#0066FF" />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#1C1C1E',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    height: 50,
    borderColor: '#CCCCCC',
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    color: '#FFFFFF',
    backgroundColor: '#333333',
    marginBottom: 20,
  },
});

export default LoginScreen;
