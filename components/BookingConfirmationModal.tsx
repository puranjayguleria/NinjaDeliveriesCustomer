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

interface BookingConfirmationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  serviceName: string;
  amount: number;
  location: string;
  date: string;
  time: string;
  issues?: string[];
}

const BookingConfirmationModal: React.FC<BookingConfirmationModalProps> = ({
  visible,
  onClose,
  onConfirm,
  serviceName,
  amount,
  location,
  date,
  time,
  issues = [],
}) => {
  const scaleValue = useRef(new Animated.Value(0)).current;
  const fadeValue = useRef(new Animated.Value(0)).current;
  const slideValue = useRef(new Animated.Value(30)).current;

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
          toValue: 30,
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
            colors={['rgba(255, 255, 255, 0.98)', 'rgba(248, 250, 252, 0.95)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.modalContainer}
          >
            {/* Background decoration */}
            <View style={styles.backgroundPattern}>
              <View style={[styles.patternCircle, styles.circle1]} />
              <View style={[styles.patternCircle, styles.circle2]} />
            </View>

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <LinearGradient
                  colors={['#3b82f6', '#2563eb']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.iconGradient}
                >
                  <Ionicons name="calendar-check" size={32} color="#fff" />
                </LinearGradient>
              </View>
              <Text style={styles.title}>Confirm Booking</Text>
              <Text style={styles.subtitle}>
                You are about to book 1 service for ₹{amount}.
              </Text>
            </View>

            {/* Booking Details */}
            <View style={styles.bookingDetails}>
              <Text style={styles.sectionTitle}>Booking Details</Text>
              
              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <Ionicons name="construct" size={16} color="#6b7280" />
                </View>
                <Text style={styles.detailText}>{serviceName}</Text>
              </View>

              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <Ionicons name="calendar" size={16} color="#6b7280" />
                </View>
                <Text style={styles.detailText}>{date} at {time}</Text>
              </View>

              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <Ionicons name="location" size={16} color="#6b7280" />
                </View>
                <Text style={styles.detailText} numberOfLines={2}>
                  {location}
                </Text>
              </View>

              {issues.length > 0 && (
                <View style={styles.issuesContainer}>
                  <Text style={styles.issuesTitle}>Selected Issues:</Text>
                  <Text style={styles.issuesText}>
                    {issues.join(', ')}
                  </Text>
                </View>
              )}

              {/* Price Summary */}
              <View style={styles.priceContainer}>
                <LinearGradient
                  colors={['rgba(59, 130, 246, 0.1)', 'rgba(59, 130, 246, 0.05)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.priceGradient}
                >
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Service will be provided at:</Text>
                  </View>
                  <View style={styles.priceRow}>
                    <Text style={styles.locationText}>{location.split(',')[0]}</Text>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.priceRow}>
                    <Text style={styles.continueText}>Continue?</Text>
                  </View>
                </LinearGradient>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <LinearGradient
                colors={['#10b981', '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.button, styles.confirmButton]}
              >
                <TouchableOpacity
                  style={styles.confirmButtonTouchable}
                  onPress={onConfirm}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark-circle" size={18} color="#fff" style={styles.buttonIcon} />
                  <Text style={styles.confirmButtonText}>Confirm Cash Booking</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalWrapper: {
    width: width * 0.92,
    maxWidth: 420,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 20,
    },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 20,
  },
  modalContainer: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
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
    width: 120,
    height: 120,
    backgroundColor: '#3b82f6',
    top: -30,
    right: -30,
  },
  circle2: {
    width: 80,
    height: 80,
    backgroundColor: '#2563eb',
    bottom: -20,
    left: -20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    marginBottom: 16,
  },
  iconGradient: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3b82f6',
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
    color: '#1a1a1a',
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
  bookingDetails: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  detailIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(107, 114, 128, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  detailText: {
    flex: 1,
    fontSize: 14,
    color: '#4a5568',
    fontWeight: '500',
    lineHeight: 20,
  },
  issuesContainer: {
    backgroundColor: 'rgba(248, 250, 252, 0.8)',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  issuesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  issuesText: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
    fontWeight: '500',
  },
  priceContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  priceGradient: {
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  priceRow: {
    alignItems: 'center',
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 14,
    color: '#1e40af',
    fontWeight: '600',
  },
  locationText: {
    fontSize: 16,
    color: '#1e40af',
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    marginVertical: 12,
  },
  continueText: {
    fontSize: 16,
    color: '#1e40af',
    fontWeight: '700',
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
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4a5568',
    letterSpacing: 0.3,
  },
  confirmButton: {
    shadowColor: '#10b981',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  confirmButtonTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 2,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});

export default BookingConfirmationModal;