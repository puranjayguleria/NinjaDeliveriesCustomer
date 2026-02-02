import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

interface ServiceCancellationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirmCancel: () => void;
  totalAmount: number;
  deductionPercentage?: number;
}

const ServiceCancellationModal: React.FC<ServiceCancellationModalProps> = ({
  visible,
  onClose,
  onConfirmCancel,
  totalAmount,
  deductionPercentage = 25,
}) => {
  const scaleValue = React.useRef(new Animated.Value(0)).current;
  const fadeValue = React.useRef(new Animated.Value(0)).current;

  const deductionAmount = (totalAmount * deductionPercentage) / 100;
  const refundAmount = totalAmount - deductionAmount;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleValue, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(fadeValue, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleValue, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeValue, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.overlay, { opacity: fadeValue }]}>
        <Animated.View 
          style={[
            styles.modalWrapper,
            {
              transform: [{ scale: scaleValue }],
            },
          ]}
        >
          <LinearGradient
            colors={['#FFFFFF', '#FFF5F5', '#FFEBEE']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.modalContainer}
          >
            {/* Header with Warning Icon */}
            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <Ionicons name="warning" size={48} color="#FF6B6B" />
              </View>
              <Text style={styles.title}>Cancel Service</Text>
            </View>

            {/* Content */}
            <View style={styles.content}>
              <Text style={styles.message}>
                Are you sure you want to cancel this service?
              </Text>
              
              <View style={styles.deductionInfo}>
                <View style={styles.amountRow}>
                  <Text style={styles.amountLabel}>Total Amount:</Text>
                  <Text style={styles.totalAmount}>₹{totalAmount}</Text>
                </View>
                
                <View style={styles.deductionRow}>
                  <Text style={styles.deductionLabel}>
                    Cancellation Fee ({deductionPercentage}%):
                  </Text>
                  <Text style={styles.deductionAmount}>-₹{deductionAmount}</Text>
                </View>
                
                <View style={styles.divider} />
                
                <View style={styles.refundRow}>
                  <Text style={styles.refundLabel}>Refund Amount:</Text>
                  <Text style={styles.refundAmount}>₹{refundAmount}</Text>
                </View>
              </View>

              <View style={styles.warningBox}>
                <Ionicons name="information-circle" size={20} color="#FF8A00" />
                <Text style={styles.warningText}>
                  {deductionPercentage}% of the total amount will be deducted as cancellation charges.
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.keepBookingButton]}
                onPress={onClose}
              >
                <Text style={styles.keepBookingText}>Keep Booking</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={onConfirmCancel}
              >
                <Text style={styles.cancelButtonText}>Cancel Service</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalWrapper: {
    width: width * 0.9,
    maxWidth: 400,
  },
  modalContainer: {
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFE5E5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  content: {
    marginBottom: 24,
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  deductionInfo: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  amountLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  totalAmount: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  deductionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  deductionLabel: {
    fontSize: 14,
    color: '#FF6B6B',
    fontWeight: '500',
  },
  deductionAmount: {
    fontSize: 14,
    color: '#FF6B6B',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginBottom: 12,
  },
  refundRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  refundLabel: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '600',
  },
  refundAmount: {
    fontSize: 18,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF8A00',
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#F57C00',
    marginLeft: 8,
    lineHeight: 18,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keepBookingButton: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  keepBookingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  cancelButton: {
    backgroundColor: '#FF6B6B',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default ServiceCancellationModal;