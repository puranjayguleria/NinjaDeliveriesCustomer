import React, { useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
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
  const scaleValue = useRef(new Animated.Value(0)).current;
  const fadeValue = useRef(new Animated.Value(0)).current;
  const slideValue = useRef(new Animated.Value(50)).current;
  const pulseValue = useRef(new Animated.Value(1)).current;

  const deductionAmount = (totalAmount * deductionPercentage) / 100;
  const refundAmount = totalAmount - deductionAmount;

  useEffect(() => {
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
        Animated.timing(slideValue, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Pulsing animation for warning icon
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseValue, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseValue, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
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
        Animated.timing(slideValue, {
          toValue: 50,
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
              transform: [
                { scale: scaleValue },
                { translateY: slideValue }
              ],
            },
          ]}
        >
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.98)', 'rgba(255, 248, 248, 0.95)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.modalContainer}
          >
            {/* Background decoration */}
            <View style={styles.backgroundPattern}>
              <View style={[styles.patternCircle, styles.circle1]} />
              <View style={[styles.patternCircle, styles.circle2]} />
            </View>

            {/* Header with Warning Icon */}
            <View style={styles.header}>
              <Animated.View 
                style={[
                  styles.iconContainer,
                  { transform: [{ scale: pulseValue }] }
                ]}
              >
                <LinearGradient
                  colors={['#ff6b6b', '#ee5a52']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.iconGradient}
                >
                  <Ionicons name="warning" size={40} color="#fff" />
                </LinearGradient>
              </Animated.View>
              <Text style={styles.title}>Cancel Service</Text>
              <Text style={styles.subtitle}>
                Are you sure you want to cancel this service?
              </Text>
            </View>

            {/* Content */}
            <View style={styles.content}>
              <View style={styles.deductionInfo}>
                <View style={styles.amountRow}>
                  <Text style={styles.amountLabel}>Total Amount:</Text>
                  <Text style={styles.totalAmount}>₹{totalAmount}</Text>
                </View>
                
                <View style={styles.deductionRow}>
                  <View style={styles.deductionLabelContainer}>
                    <Ionicons name="remove-circle" size={16} color="#ff6b6b" />
                    <Text style={styles.deductionLabel}>
                      Cancellation Fee ({deductionPercentage}%):
                    </Text>
                  </View>
                  <Text style={styles.deductionAmount}>-₹{deductionAmount}</Text>
                </View>
                
                <View style={styles.divider} />
                
                <View style={styles.refundRow}>
                  <View style={styles.refundLabelContainer}>
                    <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                    <Text style={styles.refundLabel}>Refund Amount:</Text>
                  </View>
                  <Text style={styles.refundAmount}>₹{refundAmount}</Text>
                </View>
              </View>

              <LinearGradient
                colors={['rgba(255, 138, 0, 0.1)', 'rgba(255, 138, 0, 0.05)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.warningBox}
              >
                <View style={styles.warningIconContainer}>
                  <Ionicons name="information-circle" size={20} color="#ff8a00" />
                </View>
                <Text style={styles.warningText}>
                  {deductionPercentage}% of the total amount will be deducted as cancellation charges. This action cannot be undone.
                </Text>
              </LinearGradient>
            </View>

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.keepBookingButton]}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Ionicons name="shield-checkmark" size={18} color="#4a5568" style={styles.buttonIcon} />
                <Text style={styles.keepBookingText}>Keep Booking</Text>
              </TouchableOpacity>
              
              <LinearGradient
                colors={['#ff6b6b', '#ee5a52']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.button, styles.cancelButton]}
              >
                <TouchableOpacity
                  style={styles.cancelButtonTouchable}
                  onPress={onConfirmCancel}
                  activeOpacity={0.8}
                >
                  <Ionicons name="close-circle" size={18} color="#fff" style={styles.buttonIcon} />
                  <Text style={styles.cancelButtonText}>Cancel Service</Text>
                </TouchableOpacity>
              </LinearGradient>
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalWrapper: {
    width: width * 0.92,
    maxWidth: 420,
    shadowColor: '#ff6b6b',
    shadowOffset: {
      width: 0,
      height: 20,
    },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 20,
  },
  modalContainer: {
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.2)',
    overflow: 'hidden',
  },
  backgroundPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  patternCircle: {
    position: 'absolute',
    borderRadius: 50,
    opacity: 0.06,
  },
  circle1: {
    width: 150,
    height: 150,
    backgroundColor: '#ff6b6b',
    top: -40,
    right: -40,
  },
  circle2: {
    width: 100,
    height: 100,
    backgroundColor: '#ee5a52',
    bottom: -30,
    left: -30,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    marginBottom: 16,
  },
  iconGradient: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ff6b6b',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#4a5568',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 22,
  },
  content: {
    marginBottom: 28,
  },
  deductionInfo: {
    backgroundColor: 'rgba(248, 250, 252, 0.8)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  amountLabel: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '600',
  },
  totalAmount: {
    fontSize: 18,
    color: '#374151',
    fontWeight: '700',
  },
  deductionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  deductionLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deductionLabel: {
    fontSize: 14,
    color: '#dc2626',
    fontWeight: '600',
  },
  deductionAmount: {
    fontSize: 16,
    color: '#dc2626',
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginBottom: 16,
  },
  refundRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  refundLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  refundLabel: {
    fontSize: 16,
    color: '#059669',
    fontWeight: '700',
  },
  refundAmount: {
    fontSize: 20,
    color: '#059669',
    fontWeight: '800',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ff8a00',
  },
  warningIconContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#92400e',
    lineHeight: 20,
    fontWeight: '500',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buttonIcon: {
    marginRight: 6,
  },
  keepBookingButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  keepBookingText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4a5568',
    letterSpacing: 0.3,
  },
  cancelButton: {
    shadowColor: '#ff6b6b',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  cancelButtonTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 2,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});

export default ServiceCancellationModal;