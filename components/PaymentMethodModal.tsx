import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Dimensions,
  ActivityIndicator,
  Image,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";

interface PaymentMethodModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectCOD: () => void;
  onSelectOnline: () => void;
  totalAmount: number;
  loading?: boolean;
}

const PaymentMethodModal: React.FC<PaymentMethodModalProps> = ({
  visible,
  onClose,
  onSelectCOD,
  onSelectOnline,
  totalAmount,
  loading = false,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<'cod' | 'online' | null>(null);

  const handleCODSelect = () => {
    setSelectedMethod('cod');
    setTimeout(() => {
      onSelectCOD();
      setSelectedMethod(null);
    }, 200);
  };

  const handleOnlineSelect = () => {
    setSelectedMethod('online');
    setTimeout(() => {
      onSelectOnline();
      setSelectedMethod(null);
    }, 200);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <View style={styles.headerIcon}>
                <MaterialIcons name="payment" size={24} color="#059669" />
              </View>
              <Text style={styles.title}>Choose Payment Method</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Amount Section */}
          <View style={styles.amountSection}>
            <Text style={styles.amountLabel}>Total Amount to Pay</Text>
            <Text style={styles.amountValue}>₹{totalAmount.toFixed(2)}</Text>
            <View style={styles.savingsTag}>
              <Ionicons name="checkmark-circle" size={16} color="#059669" />
              <Text style={styles.savingsText}>Best prices guaranteed</Text>
            </View>
          </View>

          {/* Payment Options */}
          <View style={styles.paymentOptions}>
            {/* Online Payment Option */}
            <TouchableOpacity 
              style={[
                styles.paymentOption, 
                styles.recommendedOption,
                selectedMethod === 'online' && styles.selectedOption
              ]} 
              onPress={handleOnlineSelect}
              disabled={loading}
            >
              <View style={styles.recommendedBadge}>
                <Text style={styles.recommendedText}>RECOMMENDED</Text>
              </View>
              
              <View style={styles.optionContent}>
                <View style={styles.optionLeft}>
                  <View style={[styles.iconContainer, styles.onlineIconContainer]}>
                    <MaterialIcons name="account-balance-wallet" size={24} color="#fff" />
                  </View>
                  <View style={styles.optionText}>
                    <Text style={styles.optionTitle}>Pay Online</Text>
                    <Text style={styles.optionDescription}>
                      UPI • Cards • Net Banking • Wallets
                    </Text>
                    <View style={styles.benefitsContainer}>
                      <View style={styles.benefit}>
                        <Ionicons name="flash" size={12} color="#f59e0b" />
                        <Text style={styles.benefitText}>Instant</Text>
                      </View>
                      <View style={styles.benefit}>
                        <Ionicons name="shield-checkmark" size={12} color="#059669" />
                        <Text style={styles.benefitText}>Secure</Text>
                      </View>
                    </View>
                  </View>
                </View>
                
                <View style={styles.optionRight}>
                  {selectedMethod === 'online' && loading ? (
                    <ActivityIndicator size="small" color="#059669" />
                  ) : (
                    <Ionicons name="chevron-forward" size={20} color="#059669" />
                  )}
                </View>
              </View>

              {/* Payment Methods Icons */}
              <View style={styles.paymentMethodsIcons}>
                <View style={styles.paymentIcon}>
                  <Text style={styles.paymentIconText}>UPI</Text>
                </View>
                <View style={styles.paymentIcon}>
                  <MaterialIcons name="credit-card" size={16} color="#666" />
                </View>
                <View style={styles.paymentIcon}>
                  <MaterialIcons name="account-balance" size={16} color="#666" />
                </View>
                <View style={styles.paymentIcon}>
                  <MaterialIcons name="account-balance-wallet" size={16} color="#666" />
                </View>
              </View>
            </TouchableOpacity>

            {/* COD Option */}
            <TouchableOpacity 
              style={[
                styles.paymentOption,
                selectedMethod === 'cod' && styles.selectedOption
              ]} 
              onPress={handleCODSelect}
              disabled={loading}
            >
              <View style={styles.optionContent}>
                <View style={styles.optionLeft}>
                  <View style={[styles.iconContainer, styles.codIconContainer]}>
                    <MaterialIcons name="local-shipping" size={24} color="#fff" />
                  </View>
                  <View style={styles.optionText}>
                    <Text style={styles.optionTitle}>Cash on Delivery</Text>
                    <Text style={styles.optionDescription}>
                      Pay with cash when order arrives
                    </Text>
                    <View style={styles.benefitsContainer}>
                      <View style={styles.benefit}>
                        <Ionicons name="hand-left" size={12} color="#2563eb" />
                        <Text style={styles.benefitText}>Pay later</Text>
                      </View>
                    </View>
                  </View>
                </View>
                
                <View style={styles.optionRight}>
                  {selectedMethod === 'cod' && loading ? (
                    <ActivityIndicator size="small" color="#2563eb" />
                  ) : (
                    <Ionicons name="chevron-forward" size={20} color="#666" />
                  )}
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <View style={styles.securityInfo}>
              <Ionicons name="shield-checkmark" size={16} color="#059669" />
              <Text style={styles.securityText}>
                256-bit SSL encrypted • PCI DSS compliant
              </Text>
            </View>
            <Text style={styles.footerNote}>
              Powered by Razorpay • Trusted by millions
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const { height, width } = Dimensions.get("window");

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.75,
    paddingBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f0fdf4",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#f8fafc",
  },
  amountSection: {
    alignItems: "center",
    paddingVertical: 24,
    backgroundColor: "#f8fafc",
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  amountLabel: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 6,
    fontWeight: "500",
  },
  amountValue: {
    fontSize: 28,
    fontWeight: "800",
    color: "#059669",
    marginBottom: 8,
  },
  savingsTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  savingsText: {
    fontSize: 12,
    color: "#059669",
    fontWeight: "600",
    marginLeft: 4,
  },
  paymentOptions: {
    padding: 20,
    paddingTop: 24,
  },
  paymentOption: {
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  recommendedOption: {
    borderColor: "#059669",
    backgroundColor: "#fefffe",
  },
  selectedOption: {
    borderColor: "#059669",
    backgroundColor: "#f0fdf4",
    transform: [{ scale: 0.98 }],
  },
  recommendedBadge: {
    backgroundColor: "#059669",
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  recommendedText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    paddingTop: 0,
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  onlineIconContainer: {
    backgroundColor: "#059669",
  },
  codIconContainer: {
    backgroundColor: "#2563eb",
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 8,
    lineHeight: 20,
  },
  benefitsContainer: {
    flexDirection: "row",
    gap: 12,
  },
  benefit: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  benefitText: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "600",
    marginLeft: 3,
  },
  optionRight: {
    marginLeft: 12,
  },
  paymentMethodsIcons: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  paymentIcon: {
    width: 32,
    height: 24,
    backgroundColor: "#f8fafc",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  paymentIconText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#475569",
  },
  footer: {
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 8,
  },
  securityInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  securityText: {
    fontSize: 12,
    color: "#059669",
    fontWeight: "600",
    marginLeft: 6,
  },
  footerNote: {
    fontSize: 11,
    color: "#94a3b8",
    textAlign: "center",
  },
});

export default PaymentMethodModal;