// OrderSummaryScreen.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Alert,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Picker } from "@react-native-picker/picker";

import {
  calculateDistance,
  isWithin10KmOfDharamshala,
} from "../utils/locationUtils";
import {
  fetchFixedPickupLocation,
  PickupLocation,
} from "@/utils/fetchPickUpLocation";
import Loader from "@/components/VideoLoader";

const OrderSummaryScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();

  const {
    pickupCoords,
    dropoffCoords,
    pickupDetails,
    dropoffDetails,
    parcelDetails = {},
  } = route.params || {};

  const {
    senderPhoneNumber = "",
    recipientPhoneNumber = "",
    packageDescription = "",
    promoCode,
    discountApplied,
    discountLabel,
    promoId,
    promoType,
    promoAmount,
  } = parcelDetails;

  // State: Firestore settings
  const [baseDeliveryCharge, setBaseDeliveryCharge] = useState<number>(50);
  const [platformFee, setPlatformFee] = useState<number>(4);
  const [gstPercentage, setGstPercentage] = useState<number>(5);
  const [additionalCostPerKm, setAdditionalCostPerKm] = useState<number>(11);
  const [distanceThreshold, setDistanceThreshold] = useState<number>(2);
  const [loadingSettings, setLoadingSettings] = useState<boolean>(true);

  // State: Distance
  const [distance, setDistance] = useState<number>(0);
  const [isWithin10Km, setIsWithin10Km] = useState<boolean>(false);
  const [loadingDistance, setLoadingDistance] = useState<boolean>(true);

  // State: Price Calculation
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [discount, setDiscount] = useState<number>(0);
  const [gstAmount, setGstAmount] = useState<number>(0);
  const [totalCost, setTotalCost] = useState<number>(0);

  // If you need the fixed pickup location from Firestore
  const [fixedPickupLocation, setFixedPickupLocation] =
    useState<PickupLocation | null>(null);

  // Logged-in user ID
  const userId = auth().currentUser?.uid;

  // 1. Fetch fixed pickup location if needed
  useEffect(() => {
    const getPickupLocation = async () => {
      const location = await fetchFixedPickupLocation();
      setFixedPickupLocation(location);
    };
    getPickupLocation();
  }, []);

  // 2. Fetch fare settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsDoc = await firestore()
          .collection("orderSetting")
          .doc("fare")
          .get();

        if (settingsDoc.exists) {
          const data = settingsDoc.data();
          setBaseDeliveryCharge(data?.baseDeliveryCharge ?? 50);
          setPlatformFee(data?.platformFee ?? 4);
          setGstPercentage(data?.gstPercentage ?? 5);
          setAdditionalCostPerKm(data?.additionalCostPerKm ?? 11);
          setDistanceThreshold(data?.distanceThreshold ?? 2);
        } else {
          console.warn("Settings doc does not exist. Using defaults.");
        }
      } catch (error) {
        Alert.alert("Error", "Failed to fetch settings. Please try again.");
        console.error("Firestore Settings Fetch Error: ", error);
      } finally {
        setLoadingSettings(false);
      }
    };
    fetchSettings();
  }, []);

  // 3. Once we have settings, fetch the distance from Google
  useEffect(() => {
    const fetchDistance = async () => {
      if (!pickupCoords || !dropoffCoords) {
        Alert.alert("Error", "Pickup or dropoff coordinates missing.");
        setLoadingDistance(false);
        return;
      }
      try {
        const calculatedDistance = await calculateDistance(
          pickupCoords,
          dropoffCoords
        );
        if (calculatedDistance === null) {
          Alert.alert("Error", "Failed to calculate distance. Try again.");
          return;
        }
        setDistance(calculatedDistance);

        const within10Km = await isWithin10KmOfDharamshala(dropoffCoords);
        setIsWithin10Km(within10Km);
      } catch (error) {
        Alert.alert("Error", "Unexpected error calculating distance.");
        console.error("Distance Calc Error:", error);
      } finally {
        setLoadingDistance(false);
      }
    };

    if (!loadingSettings) {
      fetchDistance();
    }
  }, [loadingSettings, pickupCoords, dropoffCoords]);

  // 4. Once distance + settings are loaded => finalize cost
  useEffect(() => {
    if (!loadingSettings && !loadingDistance) {
      // Additional cost
      const additionalCost =
        distance > distanceThreshold
          ? (distance - distanceThreshold) * additionalCostPerKm
          : 0;

      const initialTotalCost =
        baseDeliveryCharge + platformFee + additionalCost;

      // Calculate discount from promo
      let calculatedDiscount = 0;
      if (discountApplied && promoType && promoAmount) {
        if (promoType === "flat") {
          calculatedDiscount = promoAmount;
        } else if (promoType === "percent") {
          calculatedDiscount = (promoAmount / 100) * initialTotalCost;
        }
      }

      // Calculate GST
      const subtotal = initialTotalCost - calculatedDiscount;
      const calculatedGst = (gstPercentage / 100) * subtotal;

      const finalTotalCost = subtotal + calculatedGst;

      setDiscount(calculatedDiscount);
      setGstAmount(calculatedGst);
      setTotalCost(finalTotalCost);
    }
  }, [
    loadingSettings,
    loadingDistance,
    distance,
    baseDeliveryCharge,
    platformFee,
    additionalCostPerKm,
    distanceThreshold,
    discountApplied,
    promoType,
    promoAmount,
    gstPercentage,
  ]);

  // 5. Confirm Order => Save doc
  const handleConfirmOrder = async () => {
    if (!paymentMethod) {
      Alert.alert("Error", "Please select a payment method.");
      return;
    }
    if (loadingSettings || loadingDistance) {
      Alert.alert("Please wait", "Calculating distance and costs...");
      return;
    }
    try {
      const user = auth().currentUser;
      if (!user) {
        Alert.alert("Error", "You must be logged in to place an order.");
        return;
      }

      // Re-run cost logic to be safe
      const additionalCost =
        distance > distanceThreshold
          ? (distance - distanceThreshold) * additionalCostPerKm
          : 0;
      const initialTotalCost =
        baseDeliveryCharge + platformFee + additionalCost;
      let discountAmount = 0;
      if (discountApplied && promoType && promoAmount) {
        if (promoType === "flat") {
          discountAmount = promoAmount;
        } else if (promoType === "percent") {
          discountAmount = (promoAmount / 100) * initialTotalCost;
        }
      }
      const subtotal = initialTotalCost - discountAmount;
      const calculatedGst = (gstPercentage / 100) * subtotal;
      const finalTotalCost = subtotal + calculatedGst;

      // Save doc
      const orderRef = await firestore()
        .collection("orders")
        .add({
          pickupCoords,
          dropoffCoords,
          pickupDetails,
          dropoffDetails,
          parcelDetails: {
            ...parcelDetails,
            appliedDiscount: discountAmount,
            finalTotal: finalTotalCost,
          },
          cost: {
            deliveryCharge: baseDeliveryCharge,
            platformFee,
            additionalCost,
            initialTotal: initialTotalCost,
            discount: discountAmount,
            gst: calculatedGst,
            totalCost: finalTotalCost,
          },
          distance,
          orderedBy: user.uid,
          paymentMethod,
          status: "pending",
          createdAt: firestore.FieldValue.serverTimestamp(),
        });

      // If promo used => mark it as used
      if (promoId) {
        await firestore()
          .collection("promoCodes")
          .doc(promoId)
          .update({
            usedBy: firestore.FieldValue.arrayUnion(userId),
          });
      }

      // Navigate to OrderAllocatingScreen
      navigation.navigate("OrderAllocatingScreen", {
        orderId: orderRef.id,
        dropoffCoords,
        pickupCoords,
        totalCost: finalTotalCost,
      });

      Alert.alert(
        "Order Confirmed",
        `Your order has been placed successfully. Total cost: ₹${finalTotalCost.toFixed(
          2
        )}`
      );
    } catch (error) {
      Alert.alert("Error", "Failed to place the order. Please try again.");
      console.error("Firestore Error: ", error);
    }
  };

  // If still loading
  if (loadingSettings || loadingDistance) {
    return (
      <View style={styles.loadingContainer}>
        <Loader />
      </View>
    );
  }

  // For display only
  const additionalCost =
    distance > distanceThreshold
      ? (distance - distanceThreshold) * additionalCostPerKm
      : 0;
  const initialTotalCost = baseDeliveryCharge + platformFee + additionalCost;

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        {/* DETAILS SECTION */}
        <View style={styles.detailsContainer}>
          {/* SENDER / RECIPIENT */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Sender's Phone:</Text>
            <Text style={styles.detailValue}>{senderPhoneNumber}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Recipient's Phone:</Text>
            <Text style={styles.detailValue}>{recipientPhoneNumber}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Package Description:</Text>
            <Text style={styles.detailValue}>{packageDescription}</Text>
          </View>

          {/* DISTANCE + FEES */}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Distance:</Text>
            <Text style={styles.detailValue}>{distance.toFixed(2)} km</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Base Delivery Charge:</Text>
            <Text style={styles.detailValue}>₹{baseDeliveryCharge}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Platform Fee:</Text>
            <Text style={styles.detailValue}>₹{platformFee}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>
              Additional Cost (₹{additionalCostPerKm}/km after{" "}
              {distanceThreshold} km):
            </Text>
            <Text style={styles.detailValue}>₹{additionalCost.toFixed(2)}</Text>
          </View>

          {/* OPTIONAL DIVIDER */}
          <View style={styles.divider} />

          {/* DISCOUNT + GST + TOTAL */}
          {discountApplied && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Promo Discount:</Text>
              <Text style={styles.detailValue}>-₹{discount.toFixed(2)}</Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>GST ({gstPercentage}%):</Text>
            <Text style={styles.detailValue}>₹{gstAmount.toFixed(2)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total:</Text>
            <Text style={styles.totalValue}>₹{totalCost.toFixed(2)}</Text>
          </View>
        </View>

        {/* PAYMENT METHOD PICKER */}
        <View style={styles.paymentContainer}>
          <Text style={styles.paymentLabel}>Select Payment Method:</Text>
          <Picker
            selectedValue={paymentMethod}
            onValueChange={(itemValue) => setPaymentMethod(itemValue)}
            style={styles.picker}
          >
            <Picker.Item label="Select" value="" />
            <Picker.Item label="Pay Weekly" value="PayWeekly" />
            {/* Add more methods if needed */}
          </Picker>
        </View>

        {/* CONFIRM BUTTON */}
        <TouchableOpacity
          style={styles.confirmButton}
          onPress={handleConfirmOrder}
          accessible={true}
          accessibilityLabel="Confirm Order"
        >
          <Text style={styles.confirmButtonText}>Confirm Order</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

// ------------- STYLES -------------
const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
    backgroundColor: "#F5F5F5",
  },
  container: {
    width: "90%",
    padding: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#F5F5F5",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#333",
  },

  detailsContainer: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: 14,
    color: "#333",
    fontWeight: "bold",
    width: "60%",
  },
  detailValue: {
    fontSize: 14,
    color: "#555",
    width: "40%",
    textAlign: "right",
  },
  divider: {
    borderBottomColor: "#C0C0C0",
    borderBottomWidth: 1,
    marginVertical: 15,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  totalLabel: {
    fontSize: 16,
    color: "#333",
    fontWeight: "bold",
    width: "60%",
  },
  totalValue: {
    fontSize: 16,
    color: "#333",
    fontWeight: "bold",
    textAlign: "right",
    width: "40%",
  },

  paymentContainer: {
    marginBottom: 20,
  },
  paymentLabel: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  picker: {
    backgroundColor: "#fff",
    borderRadius: 5,
    height: 50,
    justifyContent: "center",
  },

  confirmButton: {
    backgroundColor: "#00C853",
    padding: 15,
    borderRadius: 5,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  confirmButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
});

export default OrderSummaryScreen;
