import React, { useEffect, useState } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import firestore from "@react-native-firebase/firestore";
import { useCustomer } from "../context/CustomerContext";
import LottieView from "lottie-react-native";
import { useNavigation } from "@react-navigation/native";
const GlobalCongrats = () => {
  const navigation = useNavigation();

  const { customerId } = useCustomer();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!customerId) return;

    const fetchAndUpdateCoupon = async () => {
      try {
        const userRef = firestore().collection("users").doc(customerId);
        const snapshot = await userRef.get();

        if (!snapshot.exists) return;

        const userData = snapshot.data() || {};
        const coupons = userData.coupons || [];

        // Find the first coupon with notifyUser == false
        const couponIndex = coupons.findIndex(
          (c: any) => c.notifyUser === false
        );

        if (couponIndex !== -1) {
          setVisible(true);

          // 🔹 Update notifyUser to true for that coupon
          const updatedCoupons = [...coupons];
          updatedCoupons[couponIndex] = {
            ...updatedCoupons[couponIndex],
            notifyUser: true,
          };

          await userRef.update({ coupons: updatedCoupons });
          console.log("✅ notifyUser updated successfully");
        } else {
          console.log("ℹ️ No new coupons to notify");
        }
      } catch (error) {
        console.error("❌ Error fetching or updating coupon:", error);
      }
    };

    fetchAndUpdateCoupon();
  }, [customerId]);

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={() => setVisible(false)}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <LottieView
            source={require("../assets/Coupon.json")}
            autoPlay
            loop={false}
            style={{ width: 200, height: 200 }}
          />
          <Text style={styles.title}>🎉 Congratulations! 🎉</Text>
          <Text style={styles.subtitle}>You’ve won a new coupon! </Text>
          <Text style={styles.subtitle1}>Check the rewards to claim it!. </Text>

          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              setVisible(false);
              navigation.navigate("RewardScreen");
            }}
          >
            <Text style={styles.buttonText}>Claim!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default GlobalCongrats;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    width: "80%",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#555",
    marginTop: 5,
    textAlign: "center",
  },
  subtitle1: {
    fontSize: 16,
    color: "#555",
    fontWeight: "bold",
    marginTop: 5,
    textAlign: "center",
  },
  button: {
    marginTop: 20,
    backgroundColor: "#00b4a0",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
