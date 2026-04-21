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
  TouchableOpacity,
  Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { useCustomer } from "../../context/CustomerContext";
import ErrorModal from "../../components/ErrorModal";
import { useNavigation, CommonActions } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

  // Format phone number with +91 prefix and ensure E.164 compliance
  const formatPhoneNumber = (number: string) => {
    if (!number) return "";
    
    let clean = number.trim();
    
    // If it already starts with +, just clean non-digits but keep +
    if (clean.startsWith("+")) {
      return "+" + clean.replace(/\D/g, "");
    }

    // Extract all digits
    let digits = clean.replace(/\D/g, "");

    // Handle leading zero (common in some regions)
    if (digits.startsWith("0")) {
      digits = digits.substring(1);
    }

    // Case 1: 10 digits -> Assume India and add +91
    if (digits.length === 10) {
      return `+91${digits}`;
    }

    // Case 2: 12 digits starting with 91 -> Add +
    if (digits.length === 12 && digits.startsWith("91")) {
      return `+${digits}`;
    }

    // Case 3: More than 10 digits -> Assume it already has a country code and add +
    if (digits.length > 10) {
      return `+${digits}`;
    }

    // Default fallback: Prepend +91 to whatever digits we have (sendOtp will validate length)
    return `+91${digits}`;
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

  // Disable app verification for development builds
  if (__DEV__) {
    try {
      auth().settings.appVerificationDisabledForTesting = true;
      console.log("[OTP] appVerificationDisabledForTesting enabled (dev mode)");
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
    });
    
    // Handle specific error codes
    if (error.code === "auth/invalid-phone-number") {
      showErrorModal("The phone number format is incorrect. Please enter a valid 10-digit mobile number.");
    } else if (error.code === "auth/too-many-requests") {
      showErrorModal("Too many attempts. Please try again after some time.");
    } else if (error.code === "auth/network-request-failed") {
      showErrorModal("Network error. Please check your internet connection.");
    } else if (error.code === "auth/missing-client-identifier") {
      // Development build error - provide helpful message
      if (__DEV__) {
        console.warn("[OTP] Development build detected. Phone auth may not work properly.");
        showErrorModal("Development build: Phone authentication requires a production build or Firebase emulator. Please use a test phone number or build for production.");
      } else {
        showErrorModal("App verification failed. Please ensure you're using the latest version of the app.");
      }
    } else {
      showErrorModal("Something went wrong while sending OTP. Please try again.");
    }
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

        // Check if user came from checkout screen
        const checkoutState = await AsyncStorage.getItem('returnToCheckout');
        
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
        
        // If user came from checkout, redirect back to checkout
        if (checkoutState && hasAccepted) {
          console.log("User came from checkout, redirecting back");
          const state = JSON.parse(checkoutState);
          
          // Clear the stored state
          await AsyncStorage.removeItem('returnToCheckout');
          
          // Navigate back to CategoriesTab -> ServiceCheckout
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [
                { 
                  name: "AppTabs",
                  state: {
                    routes: [
                      {
                        name: "CategoriesTab",
                        state: {
                          routes: [
                            { name: "ProductsHome" },
                            { 
                              name: "ServiceCheckout", 
                              params: { 
                                services: state.services,
                                restoreState: state
                              } 
                            }
                          ],
                          index: 1
                        }
                      }
                    ],
                    index: 0
                  }
                }
              ],
            })
          );
          return;
        }
        
        if (hasAccepted) {
          console.log("User has accepted terms, navigating to AppTabs");
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: "AppTabs" }],
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
          source={require("../../assets/ninja-deliveries-bg.jpg")}
          style={styles.background}
          resizeMode="cover"
        >
          <View style={styles.container}>
            <Text style={styles.title}>Login</Text>

            <View style={styles.inputContainer}>
              <Ionicons name="call" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter phone number"
                keyboardType="phone-pad"
                value={phoneNumber}
                onChangeText={(text) => {
                  console.log("Phone number input changed:", text);
                  setPhoneNumber(text);
                }}
                placeholderTextColor="#999"
              />
            </View>

            {isSendingOtp ? (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color="#00C853" />
                <Text style={styles.loaderText}>Sending OTP...</Text>
              </View>
            ) : (
              <Pressable
                onPress={sendOtp}
                disabled={isSendingOtp}
                style={({ pressed }) => [
                  styles.button,
                  pressed && styles.buttonPressed,
                ]}
              >
                <LinearGradient
                  colors={["#00E676", "#00C853", "#00A843"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.gradientButton}
                >
                  <Ionicons name="send" size={20} color="#fff" style={styles.buttonIcon} />
                  <Text style={styles.buttonText}>Send OTP</Text>
                </LinearGradient>
              </Pressable>
            )}

            {confirmation && (
              <>
                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter OTP"
                    keyboardType="numeric"
                    value={otp}
                    onChangeText={(text) => {
                      console.log("OTP input changed:", text);
                      setOtp(text);
                    }}
                    placeholderTextColor="#999"
                    ref={otpInputRef}
                  />
                </View>

                {isConfirmingOtp ? (
                  <View style={styles.loaderContainer}>
                    <ActivityIndicator size="large" color="#4A90E2" />
                    <Text style={styles.loaderText}>Verifying...</Text>
                  </View>
                ) : (
                  <Pressable
                    onPress={confirmOtp}
                    disabled={isConfirmingOtp}
                    style={({ pressed }) => [
                      styles.button,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <LinearGradient
                      colors={["#5BA3F5", "#4A90E2", "#3A7BC8"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.gradientButton}
                    >
                      <Ionicons name="checkmark-circle" size={20} color="#fff" style={styles.buttonIcon} />
                      <Text style={styles.buttonText}>Confirm OTP</Text>
                    </LinearGradient>
                  </Pressable>
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
    padding: 25,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 20,
    alignItems: "center",
    marginVertical: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.37,
    shadowRadius: 7.49,
    elevation: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 25,
    letterSpacing: 0.5,
  },
  inputContainer: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    height: 58,
    borderColor: "#E0E0E0",
    borderWidth: 2,
    borderRadius: 14,
    backgroundColor: "#fff",
    marginBottom: 18,
    marginTop: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 3.84,
    elevation: 3,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: "100%",
    fontSize: 16,
    color: "#1a1a1a",
    paddingVertical: 0,
  },
  loaderContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  loaderText: {
    marginTop: 10,
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  button: {
    width: "100%",
    height: 58,
    borderRadius: 14,
    marginTop: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.35,
    shadowRadius: 5.65,
    elevation: 10,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  gradientButton: {
    width: "100%",
    height: "100%",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  buttonIcon: {
    marginRight: 10,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
});


