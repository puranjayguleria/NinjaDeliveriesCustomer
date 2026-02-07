import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface ServiceAddedSuccessModalProps {
  visible: boolean;
  onClose: () => void;
  serviceCount: number;
  amount: number;
  paymentMethod: "cash" | "online";
}

export default function ServiceAddedSuccessModal({
  visible,
  onClose,
  serviceCount,
  amount,
  paymentMethod,
}: ServiceAddedSuccessModalProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0);
      fadeAnim.setValue(0);
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [{ scale: scaleAnim }],
              opacity: fadeAnim,
            },
          ]}
        >
          {/* Success Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="checkmark-circle" size={80} color="#10B981" />
            </View>
            <View style={styles.celebrationContainer}>
              <Text style={styles.celebrationEmoji}>🎉</Text>
              <Text style={styles.celebrationEmoji}>✨</Text>
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title}>Services Added!</Text>
          
          {/* Service Count Badge */}
          <View style={styles.countBadge}>
            <Ionicons name="add-circle" size={20} color="#F59E0B" />
            <Text style={styles.countText}>
              {serviceCount} service{serviceCount > 1 ? "s" : ""} added
            </Text>
          </View>

          {/* Amount Card */}
          <View style={styles.amountCard}>
            <View style={styles.amountHeader}>
              <Ionicons 
                name={paymentMethod === "cash" ? "cash-outline" : "card-outline"} 
                size={24} 
                color="#10B981" 
              />
              <Text style={styles.amountLabel}>
                {paymentMethod === "cash" ? "Cash Payment" : "Paid Online"}
              </Text>
            </View>
            <Text style={styles.amountValue}>₹{amount}</Text>
          </View>

          {/* Payment Instructions */}
          {paymentMethod === "cash" && (
            <View style={styles.instructionCard}>
              <Ionicons name="information-circle" size={20} color="#3B82F6" />
              <Text style={styles.instructionText}>
                Please pay the technician when the service is completed
              </Text>
            </View>
          )}

          {/* Success Message */}
          <Text style={styles.message}>
            Your booking has been updated successfully. The technician will be notified about the additional services.
          </Text>

          {/* OK Button */}
          <TouchableOpacity style={styles.okButton} onPress={onClose}>
            <Text style={styles.okButtonText}>Got it!</Text>
            <Ionicons name="checkmark" size={20} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 28,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    position: "relative",
    marginBottom: 20,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
  },
  celebrationContainer: {
    position: "absolute",
    top: -10,
    right: -10,
    flexDirection: "row",
    gap: 5,
  },
  celebrationEmoji: {
    fontSize: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 16,
    textAlign: "center",
  },
  countBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 20,
  },
  countText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#92400E",
  },
  amountCard: {
    width: "100%",
    backgroundColor: "#F0FDF4",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "#10B981",
    alignItems: "center",
  },
  amountHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  amountLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#059669",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  amountValue: {
    fontSize: 36,
    fontWeight: "900",
    color: "#10B981",
  },
  instructionCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#EFF6FF",
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#3B82F6",
  },
  instructionText: {
    flex: 1,
    fontSize: 13,
    color: "#1E40AF",
    fontWeight: "500",
    lineHeight: 18,
  },
  message: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  okButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#10B981",
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 12,
    width: "100%",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  okButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
});
