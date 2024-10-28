import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ImageBackground } from 'react-native';
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

  // Ensure that the phone number has the +91 prefix
  const formatPhoneNumber = (number: string) => {
    if (!number.startsWith('+91')) {
      return `+91${number}`;
    }
    return number;
  };

  // Function to send OTP
  const sendOtp = async () => {
    if (!phoneNumber) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return;
    }

    const formattedPhoneNumber = formatPhoneNumber(phoneNumber);

    try {
      const confirmationResult = await auth().signInWithPhoneNumber(formattedPhoneNumber);
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

  // Function to save or update user info (expo push token and phone number)
  const saveUserInfo = async () => {
    try {
      const user = auth().currentUser;
      if (user) {
        const formattedPhoneNumber = formatPhoneNumber(phoneNumber);
        
        // Check if the phone number already exists in the 'users' collection
        const userSnapshot = await firestore()
          .collection('users')
          .where('phoneNumber', '==', formattedPhoneNumber)
          .get();

        if (!userSnapshot.empty) {
          // If the phone number exists, just update the Expo Push Token for the existing user
          const existingUserDoc = userSnapshot.docs[0];
          await existingUserDoc.ref.update({
            expoPushToken: expoPushToken,
          });
          Alert.alert('User info updated successfully.');
        } else {
          // New user, save phone number and token
          await firestore().collection('users').doc(user.uid).set({
            phoneNumber: formattedPhoneNumber,
            expoPushToken: expoPushToken,
          });
          Alert.alert('User info saved successfully.');
        }
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
    <ImageBackground
      source={require('../assets/ninja-deliveries-bg.jpg')} // Custom background
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.container}>
        <Text style={styles.title}>Login</Text>

        {/* Phone Number Input */}
        <TextInput
          style={styles.input}
          placeholder="Enter phone number"
          keyboardType="phone-pad"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          placeholderTextColor="#888"
        />

        {/* Button to send OTP */}
        <Button title="Send OTP" onPress={sendOtp} color="#00C853" />

        {/* OTP Input (Visible only after OTP is sent) */}
        {confirmation && (
          <>
            <TextInput
              style={styles.input}
              placeholder="Enter OTP"
              keyboardType="numeric"
              value={otp}
              onChangeText={setOtp}
              placeholderTextColor="#888"
            />

            {/* Button to confirm OTP */}
            <Button title="Confirm OTP" onPress={confirmOtp} color="#4A90E2" />
          </>
        )}
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.85)', // Transparent background for readability
    borderRadius: 10,
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    height: 50,
    borderColor: '#CCCCCC',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    color: '#333',
    backgroundColor: '#fff',
    marginBottom: 20,
  },
});

export default LoginScreen;
