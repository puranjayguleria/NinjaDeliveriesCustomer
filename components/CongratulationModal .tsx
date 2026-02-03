import React, { useEffect, useState, useRef } from "react";
import { 
  Modal, 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Animated, 
  Dimensions 
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import { useCustomer } from "../context/CustomerContext";
import LottieView from "lottie-react-native";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const GlobalCongrats = () => {
  const navigation = useNavigation();
  const { customerId } = useCustomer();
  const [visible, setVisible] = useState(false);
  
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const sparkleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!customerId) return;

    const unsubscribe = firestore()
      .collection("users")
      .doc(customerId)
      .onSnapshot(async (snapshot) => {
        if (!snapshot.exists) return;

        const userData = snapshot.data() || {};
        const coupons = userData.coupons || [];

        const couponIndex = coupons.findIndex((c) => c.notifyUser === false);

        if (couponIndex !== -1) {
          setVisible(true);

          const updatedCoupons = [...coupons];
          updatedCoupons[couponIndex] = {
            ...updatedCoupons[couponIndex],
            notifyUser: true,
          };

          await firestore().collection("users").doc(customerId).update({
            coupons: updatedCoupons,
          });

          console.log("✅ notifyUser updated successfully");
        }
      });

    return () => unsubscribe();
  }, [customerId]);

  useEffect(() => {
    if (visible) {
      // Start animations when modal becomes visible
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(bounceAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.spring(bounceAnim, {
            toValue: 0.95,
            useNativeDriver: true,
            tension: 100,
            friction: 8,
          }),
        ]),
      ]).start();

      // Continuous sparkle animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(sparkleAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(sparkleAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleClose = () => {
    setVisible(false);
  };

  const handleClaim = () => {
    setVisible(false);
    navigation.navigate("RewardScreen");
  };

  return (
    <Modal
      animationType="none"
      transparent
      visible={visible}
      onRequestClose={handleClose}
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Animated.View 
          style={[
            styles.modalWrapper,
            {
              transform: [
                { scale: scaleAnim },
                { scale: bounceAnim }
              ],
            },
          ]}
        >
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.98)', 'rgba(255, 250, 240, 0.95)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
          >
            {/* Decorative background elements */}
            <View style={styles.backgroundDecoration}>
              <Animated.View 
                style={[
                  styles.sparkle, 
                  styles.sparkle1,
                  { opacity: sparkleAnim }
                ]} 
              />
              <Animated.View 
                style={[
                  styles.sparkle, 
                  styles.sparkle2,
                  { 
                    opacity: sparkleAnim,
                    transform: [{ rotate: '45deg' }]
                  }
                ]} 
              />
              <Animated.View 
                style={[
                  styles.sparkle, 
                  styles.sparkle3,
                  { opacity: sparkleAnim }
                ]} 
              />
            </View>

            {/* Close Button */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.9)', 'rgba(240, 240, 240, 0.8)']}
                style={styles.closeButtonGradient}
              >
                <Ionicons name="close" size={20} color="#666" />
              </LinearGradient>
            </TouchableOpacity>

            {/* Lottie Animation */}
            <View style={styles.animationContainer}>
              <LottieView
                source={require("../assets/Coupon.json")}
                autoPlay
                loop={false}
                style={styles.lottieAnimation}
              />
            </View>

            {/* Content */}
            <View style={styles.content}>
              <Text style={styles.title}>🎉 Congratulations! 🎉</Text>
              <Text style={styles.subtitle}>You've won a new coupon!</Text>
              <Text style={styles.subtitle1}>Check the rewards to claim it!</Text>
            </View>

            {/* Action Button */}
            <LinearGradient
              colors={['#00d4aa', '#00b4a0']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.button}
            >
              <TouchableOpacity
                style={styles.buttonTouchable}
                onPress={handleClaim}
                activeOpacity={0.8}
              >
                <Ionicons name="gift" size={20} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.buttonText}>Claim Reward!</Text>
              </TouchableOpacity>
            </LinearGradient>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

export default GlobalCongrats;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalWrapper: {
    width: width * 0.9,
    maxWidth: 380,
    shadowColor: '#00d4aa',
    shadowOffset: {
      width: 0,
      height: 20,
    },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 20,
  },
  card: {
    borderRadius: 28,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 170, 0.2)',
    overflow: 'hidden',
  },
  backgroundDecoration: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sparkle: {
    position: 'absolute',
    width: 8,
    height: 8,
    backgroundColor: '#ffd700',
    borderRadius: 4,
  },
  sparkle1: {
    top: 30,
    right: 40,
  },
  sparkle2: {
    top: 60,
    left: 30,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sparkle3: {
    bottom: 80,
    right: 30,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  closeButton: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  closeButtonGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  animationContainer: {
    marginBottom: 20,
  },
  lottieAnimation: {
    width: 180,
    height: 180,
  },
  content: {
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 12,
    textAlign: "center",
    color: "#1a1a1a",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 17,
    color: "#4a5568",
    marginBottom: 6,
    textAlign: "center",
    fontWeight: "600",
  },
  subtitle1: {
    fontSize: 16,
    color: "#00b4a0",
    fontWeight: "700",
    textAlign: "center",
  },
  button: {
    borderRadius: 20,
    shadowColor: '#00d4aa',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    minWidth: 200,
  },
  buttonTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});