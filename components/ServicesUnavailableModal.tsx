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

interface ServicesUnavailableModalProps {
  visible: boolean;
  onClose: () => void;
}

const ServicesUnavailableModal: React.FC<ServicesUnavailableModalProps> = ({
  visible,
  onClose,
}) => {
  const scaleValue = useRef(new Animated.Value(0)).current;
  const fadeValue = useRef(new Animated.Value(0)).current;
  const slideValue = useRef(new Animated.Value(30)).current;
  const floatValue = useRef(new Animated.Value(0)).current;

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

      // Floating animation for the icon
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatValue, {
            toValue: -8,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(floatValue, {
            toValue: 0,
            duration: 2000,
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
              <View style={[styles.patternCircle, styles.circle3]} />
            </View>

            {/* Close Button */}
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={onClose}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.9)', 'rgba(240, 240, 240, 0.8)']}
                style={styles.closeButtonGradient}
              >
                <Ionicons name="close" size={18} color="#9CA3AF" />
              </LinearGradient>
            </TouchableOpacity>

            {/* Header with Icon */}
            <View style={styles.header}>
              <Animated.View 
                style={[
                  styles.iconContainer,
                  { transform: [{ translateY: floatValue }] }
                ]}
              >
                <LinearGradient
                  colors={['rgba(100, 116, 139, 0.15)', 'rgba(100, 116, 139, 0.1)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.iconBackground}
                >
                  <View style={styles.iconInner}>
                    <Ionicons name="construct-outline" size={44} color="#64748B" />
                  </View>
                </LinearGradient>
                
                {/* Floating particles */}
                <Animated.View style={[styles.particle, styles.particle1, { opacity: fadeValue }]} />
                <Animated.View style={[styles.particle, styles.particle2, { opacity: fadeValue }]} />
                <Animated.View style={[styles.particle, styles.particle3, { opacity: fadeValue }]} />
              </Animated.View>
              
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

              {/* Info cards */}
              <View style={styles.infoCards}>
                <View style={styles.infoCard}>
                  <LinearGradient
                    colors={['rgba(59, 130, 246, 0.1)', 'rgba(59, 130, 246, 0.05)']}
                    style={styles.infoCardGradient}
                  >
                    <Ionicons name="location" size={20} color="#3B82F6" />
                    <Text style={styles.infoCardText}>Expanding Coverage</Text>
                  </LinearGradient>
                </View>
                
                <View style={styles.infoCard}>
                  <LinearGradient
                    colors={['rgba(16, 185, 129, 0.1)', 'rgba(16, 185, 129, 0.05)']}
                    style={styles.infoCardGradient}
                  >
                    <Ionicons name="headset" size={20} color="#10B981" />
                    <Text style={styles.infoCardText}>24/7 Support</Text>
                  </LinearGradient>
                </View>
              </View>
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
                <Ionicons name="checkmark-circle" size={20} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.primaryButtonText}>Got it</Text>
              </TouchableOpacity>
            </LinearGradient>
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
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
    borderRadius: 24,
    padding: 32,
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
    opacity: 0.04,
  },
  circle1: {
    width: 120,
    height: 120,
    backgroundColor: '#64748B',
    top: -30,
    right: -30,
  },
  circle2: {
    width: 80,
    height: 80,
    backgroundColor: '#475569',
    bottom: -20,
    left: -20,
  },
  circle3: {
    width: 60,
    height: 60,
    backgroundColor: '#64748B',
    top: '50%',
    left: -30,
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    zIndex: 10,
  },
  closeButtonGradient: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  iconContainer: {
    marginBottom: 20,
    position: 'relative',
  },
  iconBackground: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.2)',
  },
  iconInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#64748B',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  particle: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#64748B',
  },
  particle1: {
    top: 10,
    right: 15,
  },
  particle2: {
    bottom: 15,
    left: 10,
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  particle3: {
    top: 30,
    left: -5,
    width: 2,
    height: 2,
    borderRadius: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#374151',
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  content: {
    marginBottom: 32,
    paddingHorizontal: 4,
  },
  message: {
    fontSize: 17,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 16,
    fontWeight: '600',
  },
  subMessage: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
    marginBottom: 24,
  },
  infoCards: {
    flexDirection: 'row',
    gap: 12,
  },
  infoCard: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  infoCardGradient: {
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  infoCardText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginTop: 8,
    textAlign: 'center',
  },
  primaryButton: {
    borderRadius: 16,
    shadowColor: '#64748B',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  buttonIcon: {
    marginRight: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

export default ServicesUnavailableModal;