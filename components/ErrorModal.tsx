import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  Easing,
} from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

type ErrorModalProps = {
  visible: boolean;
  title?: string;
  message: string;
  onClose: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
};

const ErrorModal: React.FC<ErrorModalProps> = ({
  visible,
  title,
  message,
  onClose,
  onCancel,
  confirmText = "Okay",
  cancelText = "Cancel",
}) => {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
      ]).start();

      // Pulse animation for icon
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.ease),
          }),
        ])
      ).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal transparent animationType="none" visible={visible}>
      <Animated.View style={[styles.modalBackground, { opacity: fadeAnim }]}>
        <Animated.View 
          style={[
            styles.modalWrapper,
            {
              transform: [
                { scale: scaleAnim },
                { translateY: slideAnim }
              ],
              opacity: fadeAnim,
            },
          ]}
        >
          <View style={styles.card}>
            <LinearGradient
              colors={['#ffffff', '#fafafa']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.cardGradient}
            >
              {/* Animated Icon */}
              <Animated.View 
                style={[
                  styles.iconWrapper,
                  { transform: [{ scale: pulseAnim }] }
                ]}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="location-outline" size={36} color="#fff" />
                </View>
              </Animated.View>

              {/* Content */}
              <View style={styles.textContent}>
                {title && <Text style={styles.titleText}>{title}</Text>}
                <Text style={styles.messageText}>{message}</Text>
              </View>

              {/* Buttons */}
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={onClose}
                  activeOpacity={0.9}
                >
                  <View style={styles.primaryButtonGradient}>
                    <Text style={styles.primaryButtonText}>{confirmText}</Text>
                  </View>
                </TouchableOpacity>

                {onCancel && (
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={onCancel}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.secondaryButtonText}>{cancelText}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </LinearGradient>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

export default ErrorModal;

const styles = StyleSheet.create({
  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  modalWrapper: {
    width: '100%',
    maxWidth: 360,
  },
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 20,
    },
    shadowOpacity: 0.25,
    shadowRadius: 25,
    elevation: 20,
  },
  cardGradient: {
    padding: 32,
    alignItems: 'center',
  },
  iconWrapper: {
    marginBottom: 24,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  textContent: {
    alignItems: 'center',
    marginBottom: 28,
    width: '100%',
  },
  titleText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a202c',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  messageText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#718096',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#14b8a6',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 2,
    borderColor: '#0d9488',
  },
  primaryButtonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#14b8a6',
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  secondaryButton: {
    width: '100%',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#a0aec0',
  },
});
