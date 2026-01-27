import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function TestPaymentScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const paymentData = route.params?.paymentData || {};
  const onPaymentComplete = route.params?.onPaymentComplete;

  console.log("TestPaymentScreen loaded with:", {
    hasPaymentData: !!paymentData,
    hasCallback: !!onPaymentComplete,
    finalTotal: paymentData.finalTotal,
  });

  const handleCOD = async () => {
    try {
      console.log("COD payment selected");
      if (onPaymentComplete) {
        await onPaymentComplete("cod");
      }
      navigation.goBack();
    } catch (error) {
      console.error("COD payment error:", error);
      Alert.alert("Error", "COD payment failed");
    }
  };

  const handleOnline = () => {
    Alert.alert("Online Payment", "Online payment would be processed here");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Test Payment Screen</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.info}>
          Total: ₹{paymentData.finalTotal || 0}
        </Text>
        <Text style={styles.info}>
          Items: {paymentData.cartItems?.length || 0}
        </Text>
        <Text style={styles.info}>
          Address: {paymentData.selectedLocation?.placeLabel || "Not set"}
        </Text>

        <TouchableOpacity style={styles.button} onPress={handleCOD}>
          <Text style={styles.buttonText}>Pay Cash on Delivery</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.onlineButton]} onPress={handleOnline}>
          <Text style={styles.buttonText}>Pay Online (Test)</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  backButton: {
    fontSize: 16,
    color: "#007AFF",
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginRight: 50,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  info: {
    fontSize: 14,
    marginBottom: 8,
    color: "#333",
  },
  button: {
    backgroundColor: "#007AFF",
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
    alignItems: "center",
  },
  onlineButton: {
    backgroundColor: "#00C853",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});