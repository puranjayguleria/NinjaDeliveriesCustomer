import React, { useRef, useEffect } from 'react';
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

interface AreaUnavailableModalProps {
  visible: boolean;
  onClose: () => void;
  onChangeLocation?: () => void;
}

const AreaUnavailableModal: React.FC<AreaUnavailableModalProps> = ({
  visible,
  onClose,
  onChangeLocation,
}) => {
  const scaleValue = useRef(new Animated.Value(0)).current;
  const fadeValue = useRef(new Animated.Value(0)).current;
  const slideValue = useRef(new Animated.Value(30)).current;
  const floatValue = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(1)).current;

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

      // Floating animation for the image
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

      // Pulse animation for the expanding badge
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseValue, {
            toValue: 1.08,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseValue, {
            toValue: 1,
            duration: 1200,
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal
      visible
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
                { translateY: slideValue },
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

            {/* Header with Image */}
            <View style={styles.header}>
              <Animated.View
                style={[
                  styles.imageContainer,
                  { transform: [{ translateY: floatValue }] },
                ]}
              >
                <Image
                  source={require('../assets/ninja-logo.jpg')}
                  style={styles.ninjaImage}
                  resizeMode="cover"
                />
              </Animated.View>

              <Text style={styles.title}>We&apos;re On Our Way! 🚀</Text>
            </View>

            {/* Content */}
            <View style={styles.content}>
              <Text style={styles.message}>
                We&apos;re working really hard to reach your area soon!
              </Text>
              <Text style={styles.subMessage}>
                Our team is actively expanding to bring grocery, services, and food delivery
                to your location. Stay tuned — it won&apos;t be long!
              </Text>

              {/* Info cards */}
              <View style={styles.infoCards}>
                <Animated.View style={[styles.infoCard, { transform: [{ scale: pulseValue }] }]}>
                  <LinearGradient
                    colors={['rgba(245, 158, 11, 0.12)', 'rgba(245, 158, 11, 0.05)']}
                    style={styles.infoCardGradient}
                  >
                    <Ionicons name="rocket-outline" size={22} color="#F59E0B" />
                    <Text style={styles.infoCardText}>Expanding Fast</Text>
                  </LinearGradient>
                </Animated.View>

                <View style={styles.infoCard}>
                  <LinearGradient
                    colors={['rgba(16, 185, 129, 0.12)', 'rgba(16, 185, 129, 0.05)']}
                    style={styles.infoCardGradient}
                  >
                    <Ionicons name="notifications-outline" size={22} color="#10B981" />
                    <Text style={styles.infoCardText}>We&apos;ll Notify You</Text>
                  </LinearGradient>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            {onChangeLocation && (
              <LinearGradient
                colors={['#0d9488', '#0f766e']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryButton}
              >
                <TouchableOpacity
                  style={styles.buttonTouchable}
                  onPress={onChangeLocation}
                  activeOpacity={0.8}
                >
                  <Ionicons name="location-outline" size={20} color="#fff" style={styles.buttonIcon} />
                  <Text style={styles.primaryButtonText}>Try Another Location</Text>
                </TouchableOpacity>
              </LinearGradient>
            )}

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryButtonText}>OK, Got It</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalWrapper: {
    width: width * 0.92,
    maxWidth: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
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
    backgroundColor: '#0d9488',
    top: -30,
    right: -30,
  },
  circle2: {
    width: 80,
    height: 80,
    backgroundColor: '#F59E0B',
    bottom: -20,
    left: -20,
  },
  circle3: {
    width: 60,
    height: 60,
    backgroundColor: '#0d9488',
    top: '50%' as any,
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
    marginBottom: 24,
  },
  imageContainer: {
    marginBottom: 18,
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'rgba(13, 148, 136, 0.2)',
    shadowColor: '#0d9488',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  ninjaImage: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 23,
    fontWeight: '800',
    color: '#374151',
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  content: {
    marginBottom: 28,
    paddingHorizontal: 4,
  },
  message: {
    fontSize: 17,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 12,
    fontWeight: '600',
  },
  subMessage: {
    fontSize: 14,
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
    borderRadius: 12,
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
    marginBottom: 12,
    shadowColor: '#0d9488',
    shadowOffset: { width: 0, height: 8 },
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
  secondaryButton: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#6B7280',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default AreaUnavailableModal;
