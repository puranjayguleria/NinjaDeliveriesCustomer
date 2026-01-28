// NewOrderCancelledScreen.tsx

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import {
  useNavigation,
  useRoute,
  RouteProp,
  CommonActions,
} from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import firestore from "@react-native-firebase/firestore";
import Loader from "@/components/VideoLoader";

// Define navigation stack types
type RootStackParamList = {
  OrderCancelled: {
    orderId: string;
    refundAmount: number;
    // paymentMethod no longer strictly required in route params,
    // because we will fetch it from Firestore.
  };
  Orders: undefined;
  Home: undefined; // Ensure 'Home' is defined if not already
  // ... other screens
};

type NewOrderCancelledRouteProp = RouteProp<
  RootStackParamList,
  "OrderCancelled"
>;

const NewOrderCancelledScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<NewOrderCancelledRouteProp>();

  // Extract orderId and refundAmount from params
  let { orderId, refundAmount } = route.params;

  // State to store the order's paymentMethod from Firestore
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  // Track loading (while fetching order doc)
  const [loadingOrder, setLoadingOrder] = useState<boolean>(true);

  // Ensure refundAmount is a valid number
  if (typeof refundAmount !== "number") {
    refundAmount = 0;
    console.warn("refundAmount is not a number. Defaulting to 0.");
  }

  /***************************************
   * Fetch order details from Firestore
   ***************************************/
  useEffect(() => {
    const fetchOrder = async () => {
      try {
        setLoadingOrder(true);
        const docSnap = await firestore()
          .collection("orders")
          .doc(orderId)
          .get();
        if (docSnap.exists) {
          const orderData = docSnap.data();
          // If the Firestore doc has a paymentMethod field, set it
          if (orderData?.paymentMethod) {
            setPaymentMethod(orderData.paymentMethod);
          } else {
            console.warn(
              "paymentMethod not found in order doc. Defaulting to 'online'."
            );
            setPaymentMethod("online");
          }
        } else {
          console.warn(`Order doc with ID ${orderId} does not exist.`);
          // If no doc, assume "online" or fallback
          setPaymentMethod("online");
        }
      } catch (error) {
        console.error("Error fetching order:", error);
        // If error, fallback
        setPaymentMethod("online");
      } finally {
        setLoadingOrder(false);
      }
    };

    if (orderId) fetchOrder();
  }, [orderId]);

  const navigateToHome = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [
          {
            name: "AppTabs",
            state: {
              index: 0,
              routes: [
                {
                  name: "HomeTab",
                  state: {
                    index: 0,
                    routes: [{ name: "ProductsHome" }],
                  },
                },
              ],
            },
          },
        ],
      })
    );
  };

  const renderMessage = () => {
    if (paymentMethod === "cod") {
      return (
        <Text style={styles.message}>
          Your Cash on Delivery order has been cancelled. You can place a new
          order any time.
        </Text>
      );
    } else {
      // For "online" or any other payment method => show refund
      return (
        <Text style={styles.message}>
          Unfortunately, your order has been cancelled. A refund of ₹
          {refundAmount.toFixed(2)} will be processed to your account.
        </Text>
      );
    }
  };

  // If still loading the order doc, show a spinner
  if (loadingOrder) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <Loader />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Red Cross Icon for Order Cancellation */}
      <View style={styles.iconContainer}>
        <Ionicons name="close-circle" size={80} color="red" />
      </View>

      {/* Card Container for Message */}
      <View style={styles.card}>
        <Text style={styles.header}>We’re Sorry!</Text>
        {renderMessage()}
        <Text style={styles.note}>
          If you need any assistance, please feel free to reach out.
        </Text>
      </View>

      {/* Help Button */}
      <TouchableOpacity
        style={styles.helpButton}
        onPress={() => navigation.navigate("Profile")} // Navigate to Profile screen where contact is now located
      >
        <Ionicons name="help-circle-outline" size={24} color="#FFFFFF" />
        <Text style={styles.helpButtonText}>Get Help</Text>
      </TouchableOpacity>

      {/* Back to Home Button */}
      <TouchableOpacity style={styles.homeButton} onPress={navigateToHome}>
        <Text style={styles.homeButtonText}>Back to Home</Text>
      </TouchableOpacity>
    </View>
  );
};

export default NewOrderCancelledScreen;

/******************************************
 *               STYLES
 ******************************************/
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  iconContainer: {
    marginBottom: 20,
    alignItems: "center",
  },
  card: {
    width: "90%",
    padding: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
    alignItems: "center",
    marginBottom: 20,
  },
  header: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333333",
    textAlign: "center",
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    color: "#555555",
    textAlign: "center",
    lineHeight: 22,
    marginVertical: 10,
  },
  note: {
    fontSize: 14,
    color: "#888888",
    textAlign: "center",
    marginTop: 10,
  },
  helpButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#007BFF",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 20,
    elevation: 2,
  },
  helpButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 8,
  },
  homeButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#007BFF",
  },
  homeButtonText: {
    color: "#007BFF",
    fontSize: 16,
    fontWeight: "bold",
  },
});
