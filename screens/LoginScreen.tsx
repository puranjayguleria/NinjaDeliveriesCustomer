import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  ActivityIndicator,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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
    console.log("Registering for push notifications...");
    if (!Device.isDevice) {
      showErrorModal("Push notifications only work on physical devices.");
      return null;
    }
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      console.log("Existing notification permission status:", existingStatus);

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
        console.log("Requested notification permission status:", status);
      }

      if (finalStatus !== "granted") {
        return null;
      }

      const { data } = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      });
      return data;
    } catch (error) {
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
  console.log("sendOtp called with phoneNumber:", phoneNumber);
  if (!phoneNumber || phoneNumber.replace(/\D/g, "").length < 10) {
    showErrorModal("Please enter a valid phone number.");
    return;
  }

  const formattedPhoneNumber = formatPhoneNumber(phoneNumber);
  console.log("[OTP] E.164:", formattedPhoneNumber);
if (__DEV__ && Platform.OS === "ios") {
  try {
    auth().settings.appVerificationDisabledForTesting = true;
    console.log("[OTP] appVerificationDisabledForTesting enabled (iOS dev)");
  } catch (e) {
    console.log("[OTP] could not enable appVerificationDisabledForTesting", e);
  }
}
  try {
    setIsSendingOtp(true);
    console.log("[OTP] Calling RNFB auth().signInWithPhoneNumber...");
    const confirmationResult = await auth().signInWithPhoneNumber(formattedPhoneNumber);
    console.log("[OTP] signInWithPhoneNumber resolved. Keys:", Object.keys(confirmationResult || {}));
    setConfirmation(confirmationResult);

    setTimeout(() => otpInputRef.current?.focus(), 300);
  } catch (error: any) {
    console.error("[OTP] send failed:", {
      name: error?.name,
      code: error?.code,
      message: error?.message,
      stack: error?.stack,
    });
    showErrorModal("Something went wrong while sending OTP. Please try again.");
  } finally {
    setIsSendingOtp(false);
  }
};


  // Function to confirm OTP
  const confirmOtp = async () => {
    console.log("confirmOtp called with OTP:", otp);
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
      console.log("Confirming OTP...");
      await confirmation.confirm(otp);

      const user = auth().currentUser;
      console.log("User after OTP confirmation:", user);
      if (user) {
        setCustomerId(user.uid);
        await saveUserInfo();

        const userDoc = await firestore().collection("users").doc(user.uid).get();
        console.log("User document fetched:", userDoc.exists, userDoc.data());
        if (!userDoc.exists) {
          await firestore().collection("users").doc(user.uid).set({
            phoneNumber: formatPhoneNumber(phoneNumber),
            expoPushToken: expoPushToken,
            hasAcceptedTerms: false,
          });
          console.log("User document created, navigating to TermsAndConditions");
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
          console.log("User has accepted terms, navigating to NinjaEatsTabs");
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: "NinjaEatsTabs" }],
            })
          );
        } else {
          console.log("User has not accepted terms, navigating to TermsAndConditions");
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: "TermsAndConditions" }],
            })
          );
        }
      }
    } catch (error) {
      console.error("Invalid OTP or confirmation error:", error.message, error);
      showErrorModal("The OTP you entered is invalid. Please try again.");
    } finally {
      setIsConfirmingOtp(false);
    }
  };

  // Save or update user info in Firestore (phone + expoPushToken)
  const saveUserInfo = async () => {
    console.log("Saving user info...");
    try {
      const user = auth().currentUser;
      if (user) {
        const formattedPhoneNumber = formatPhoneNumber(phoneNumber);
        console.log("Formatted phone number for saving:", formattedPhoneNumber);

        const userSnapshot = await firestore()
          .collection("users")
          .where("phoneNumber", "==", formattedPhoneNumber)
          .get();

        console.log("User snapshot size:", userSnapshot.size);
        if (!userSnapshot.empty) {
          const existingUserDoc = userSnapshot.docs[0];
          console.log("Updating existing user document:", existingUserDoc.id);
          await existingUserDoc.ref.update({
            expoPushToken: expoPushToken,
          });
        } else {
          console.log("Creating new user document for:", user.uid);
          await firestore().collection("users").doc(user.uid).set({
            phoneNumber: formattedPhoneNumber,
            expoPushToken: expoPushToken,
            hasAcceptedTerms: false,
          });
        }
      }
    } catch (error) {
      console.error("Error saving user info:", error.message, error);
      showErrorModal("Could not save your information. Please try again.");
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <ImageBackground
          source={require("../assets/ninja-deliveries-bg.jpg")}
          style={styles.background}
          resizeMode="cover"
        >
          <View style={styles.container}>
            <Text style={styles.title}>Login</Text>

            <TextInput
              style={styles.input}
              placeholder="Enter phone number"
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={(text) => {
                console.log("Phone number input changed:", text);
                setPhoneNumber(text);
              }}
              placeholderTextColor="#888"
            />

            {isSendingOtp ? (
              <ActivityIndicator
                size="large"
                color="#00C853"
                style={styles.loader}
              />
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
                  onChangeText={(text) => {
                    console.log("OTP input changed:", text);
                    setOtp(text);
                  }}
                  placeholderTextColor="#888"
                  ref={otpInputRef}
                />

                {isConfirmingOtp ? (
                  <ActivityIndicator
                    size="large"
                    color="#4A90E2"
                    style={styles.loader}
                  />
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

          <ErrorModal
            visible={errorModalVisible}
            message={errorModalMessage}
            onClose={closeErrorModal}
          />
        </ImageBackground>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
  },
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
    marginVertical: 20,
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
