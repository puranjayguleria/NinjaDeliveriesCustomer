import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
} from 'react-native';
import LottieView from 'lottie-react-native';

const { width } = Dimensions.get('window');

interface ServiceAddedModalProps {
  visible: boolean;
  onClose: () => void;
  serviceTitle: string;
  selectedDate: string;
  selectedTime: string;
  onContinueServices: () => void;
  onViewCart: () => void;
}

export default function ServiceAddedModal({
  visible,
  onClose,
  serviceTitle,
  selectedDate,
  selectedTime,
  onContinueServices,
  onViewCart,
}: ServiceAddedModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Success Animation */}
          <View style={styles.animationContainer}>
            <LottieView
              source={require('../assets/confetti.json')}
              autoPlay
              loop={false}
              style={styles.animation}
            />
          </View>

          {/* Success Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.successCircle}>
              <Text style={styles.checkmark}>✓</Text>
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title}>Service Added!</Text>

          {/* Service Details Card */}
          <View style={styles.detailsCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Service</Text>
              <Text style={styles.detailValue}>{serviceTitle}</Text>
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Date & Time</Text>
              <Text style={styles.detailValue}>
                {selectedDate} at {selectedTime}
              </Text>
            </View>
          </View>

          {/* Info Note */}
          <View style={styles.noteContainer}>
            <View style={styles.noteIcon}>
              <Text style={styles.noteIconText}>ℹ</Text>
            </View>
            <Text style={styles.noteText}>
              Only one service can be booked at a time. Previous service (if any) has been replaced.
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={onViewCart}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>View Cart</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onContinueServices}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryButtonText}>Continue Services</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    width: width - 48,
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },

  animationContainer: {
    position: 'absolute',
    top: -40,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },

  animation: {
    width: 200,
    height: 200,
  },

  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },

  successCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },

  checkmark: {
    fontSize: 40,
    color: '#ffffff',
    fontWeight: '700',
  },

  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: -0.5,
  },

  detailsCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  detailLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
    flex: 1,
  },

  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    flex: 2,
    textAlign: 'right',
  },

  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 12,
  },

  noteContainer: {
    flexDirection: 'row',
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },

  noteIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    flexShrink: 0,
  },

  noteIconText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },

  noteText: {
    fontSize: 13,
    color: '#92400e',
    lineHeight: 18,
    flex: 1,
  },

  buttonContainer: {
    gap: 12,
  },

  primaryButton: {
    backgroundColor: '#10b981',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },

  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.3,
  },

  secondaryButton: {
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },

  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
    letterSpacing: 0.3,
  },
});
