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
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface ServicesUnavailableModalProps {
  visible: boolean;
  onClose: () => void;
}

const ServicesUnavailableModal: React.FC<ServicesUnavailableModalProps> = ({
  visible,
  onClose,
}) => {
  const scaleValue = React.useRef(new Animated.Value(0)).current;
  const fadeValue = React.useRef(new Animated.Value(0)).current;

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
            colors={['#FFFFFF', '#F0F9FF', '#E0F2FE']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.modalContainer}
          >
            {/* Header with Icon */}
            <View style={styles.header}>
              <LinearGradient
                colors={['#F0F9FF', '#DBEAFE']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconContainer}
              >
                <Ionicons name="construct-outline" size={52} color="#6B7280" />
              </LinearGradient>
              <Text style={styles.title}>Services Not Available</Text>
            </View>

            {/* Content */}
            <View style={styles.content}>
              <Text style={styles.message}>
                We're sorry, but services are currently not available in your location.
              </Text>
              <Text style={styles.subMessage}>
                We're working hard to expand our service areas. Please check back later or contact support for more information.
              </Text>
            </View>

            {/* Action Button */}
            <LinearGradient
              colors={['#64748B', '#475569']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryButton}
            >
              <TouchableOpacity 
                style={styles.buttonTouchable}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>Got it</Text>
              </TouchableOpacity>
            </LinearGradient>

            {/* Close Button */}
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={onClose}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#F0F9FF', '#DBEAFE']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.closeButtonGradient}
              >
                <Ionicons name="close" size={22} color="#9CA3AF" />
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalWrapper: {
    width: width * 0.90,
    maxWidth: 440,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 20,
    },
    shadowOpacity: 0.35,
    shadowRadius: 30,
    elevation: 20,
  },
  modalContainer: {
    borderRadius: 28,
    padding: 32,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#374151',
    textAlign: 'center',
    letterSpacing: -0.8,
    lineHeight: 32,
  },
  content: {
    marginBottom: 32,
    paddingHorizontal: 4,
  },
  message: {
    fontSize: 18,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 18,
    fontWeight: '500',
  },
  subMessage: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '400',
  },
  primaryButton: {
    borderRadius: 20,
    shadowColor: '#64748B',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#475569',
  },
  buttonTouchable: {
    paddingVertical: 18,
    paddingHorizontal: 36,
    alignItems: 'center',
    borderRadius: 20,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  closeButton: {
    position: 'absolute',
    top: 24,
    right: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    shadowColor: '#64748B',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  closeButtonGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
});

export default ServicesUnavailableModal;