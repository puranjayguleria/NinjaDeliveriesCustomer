// screens/LoginScreen.tsx

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  ActivityIndicator,
  ImageBackground,
} from "react-native";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { useCustomer } from "../context/CustomerContext";
import ErrorModal from "../components/ErrorModal"; 
import { useNavigation, CommonActions } from "@react-navigation/native";

const LoginScreen: React.FC = () => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [confirmation, setConfirmation] = useState<any>(null);
  const [otp, setOtp] = useState("");
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isConfirmingOtp, setIsConfirmingOtp] = useState(false);

  const { setCustomerId } = useCustomer();
  const otpInputRef = useRef<TextInput>(null);
  const navigation = useNavigation();

  // ---- ErrorModal State ----
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState("");

  const showErrorModal = (message: string) => {
    setErrorModalMessage(message);
    setErrorModalVisible(true);
  };

  const closeErrorModal = () => {
    setErrorModalVisible(false);
  };

  // Format phone number with +91 prefix
  const formatPhoneNumber = (number: string) => {
    if (!number.startsWith("+91")) {
      return `+91${number}`;
    }
    return number;
  };

  // Register for push notifications
  const registerForPushNotificationsAsync = async () => {
    if (!Device.isDevice) {
      showErrorModal("Push notifications only work on physical devices.");
      return null;
    }
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        showErrorModal("Push notifications permission not granted.");
        return null;
      }

      const { data } = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      });
      console.log("Expo Push Token:", data);
      return data;
    } catch (error) {
      console.error("Error registering for push notifications:", error);
      showErrorModal("Failed to enable push notifications. Please try again.");
      return null;
    }
  };

  useEffect(() => {
    const fetchPushToken = async () => {
      const token = await registerForPushNotificationsAsync();
      if (token) {
        setExpoPushToken(token);
      }
    };
    fetchPushToken();
  }, []);

  // Function to send OTP
  const sendOtp = async () => {
    if (!phoneNumber) {
      showErrorModal("Please enter a valid phone number.");
      return;
    }

    const formattedPhoneNumber = formatPhoneNumber(phoneNumber);
    try {
      setIsSendingOtp(true);
      const confirmationResult = await auth().signInWithPhoneNumber(formattedPhoneNumber);
      setConfirmation(confirmationResult);

      // Optionally show success toast "OTP Sent"
      setTimeout(() => {
        otpInputRef.current?.focus();
      }, 500);
    } catch (error: any) {
      console.error("Failed to send OTP:", error);
      showErrorModal("Something went wrong while sending OTP. Please try again.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Function to confirm OTP
  const confirmOtp = async () => {
    if (!otp) {
      showErrorModal("Please enter the OTP.");
      return;
    }
    if (!confirmation) {
      showErrorModal("No OTP request found. Please send OTP again.");
      return;
    }
    try {
      setIsConfirmingOtp(true);
      await confirmation.confirm(otp);  // Actually sign in

      const user = auth().currentUser;
      if (user) {
        setCustomerId(user.uid);
        // Save user info (phone/ push token)
        await saveUserInfo();
        
        // After we confirm OTP => check T&C acceptance
        const userDoc = await firestore().collection("users").doc(user.uid).get();
        if (!userDoc.exists) {
          // If doc doesn't exist, create. 
          // But typically at this point it does, due to 'saveUserInfo()' 
          await firestore().collection("users").doc(user.uid).set({
            phoneNumber: formatPhoneNumber(phoneNumber),
            expoPushToken: expoPushToken,
            hasAcceptedTerms: false,
          });
          // Navigate to Terms
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: "TermsAndConditions" }],
            })
          );
          return;
        }

        const hasAccepted = userDoc.data()?.hasAcceptedTerms === true;
        if (hasAccepted) {
          // T&C accepted => go straight to AppTabs (Categories)
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: "AppTabs" }],
            })
          );
        } else {
          // T&C not accepted => go to TermsAndConditions
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: "TermsAndConditions" }],
            })
          );
        }
      }
    } catch (error) {
      console.error("Invalid OTP or confirmation error:", error);
      showErrorModal("The OTP you entered is invalid. Please try again.");
    } finally {
      setIsConfirmingOtp(false);
    }
  };

  // Save or update user info in Firestore (phone + expoPushToken)
  const saveUserInfo = async () => {
    try {
      const user = auth().currentUser;
      if (user) {
        const formattedPhoneNumber = formatPhoneNumber(phoneNumber);
        // Check if phone already exists
        const userSnapshot = await firestore()
          .collection("users")
          .where("phoneNumber", "==", formattedPhoneNumber)
          .get();

        if (!userSnapshot.empty) {
          const existingUserDoc = userSnapshot.docs[0];
          await existingUserDoc.ref.update({
            expoPushToken: expoPushToken,
          });
        } else {
          // New user
          await firestore().collection("users").doc(user.uid).set({
            phoneNumber: formattedPhoneNumber,
            expoPushToken: expoPushToken,
            hasAcceptedTerms: false,
          });
        }
      }
    } catch (error) {
      console.error("Error saving user info:", error);
      showErrorModal("Could not save your information. Please try again.");
    }
  };

  return (
    <ImageBackground
      source={require("../assets/ninja-deliveries-bg.jpg")}
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

        {isSendingOtp ? (
          <ActivityIndicator size="large" color="#00C853" style={styles.loader} />
        ) : (
          <Button
            title="Send OTP"
            onPress={sendOtp}
            color="#00C853"
            disabled={isSendingOtp}
          />
        )}

        {confirmation && (
          <>
            <TextInput
              style={styles.input}
              placeholder="Enter OTP"
              keyboardType="numeric"
              value={otp}
              onChangeText={setOtp}
              placeholderTextColor="#888"
              ref={otpInputRef}
            />

            {isConfirmingOtp ? (
              <ActivityIndicator size="large" color="#4A90E2" style={styles.loader} />
            ) : (
              <Button
                title="Confirm OTP"
                onPress={confirmOtp}
                color="#4A90E2"
                disabled={isConfirmingOtp}
              />
            )}
          </>
        )}
      </View>

      {/* ERROR MODAL */}
      <ErrorModal
        visible={errorModalVisible}
        message={errorModalMessage}
        onClose={closeErrorModal}
      />
    </ImageBackground>
  );
};

export default LoginScreen;

/********************************************
 *                 STYLES
 ********************************************/
const styles = StyleSheet.create({
  background: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    width: "90%",
    padding: 20,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    borderRadius: 10,
    alignItems: "center",
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 20,
  },
  input: {
    width: "100%",
    height: 50,
    borderColor: "#CCCCCC",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    color: "#333",
    backgroundColor: "#fff",
    marginBottom: 20,
    marginTop: 20,
  },
  loader: {
    marginVertical: 10,
  },
});
