import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Dimensions,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

interface CartSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectGrocery: () => void;
  onSelectServices: () => void;
  onSelectUnified?: () => void;
  groceryItemCount: number;
  serviceItemCount: number;
}

const CartSelectionModal: React.FC<CartSelectionModalProps> = ({
  visible,
  onClose,
  onSelectGrocery,
  onSelectServices,
  onSelectUnified,
  groceryItemCount,
  serviceItemCount,
}) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 30,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, scaleAnim, fadeAnim, slideAnim]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity 
          style={styles.backdrop} 
          activeOpacity={1} 
          onPress={onClose}
        />
        
        <Animated.View 
          style={[
            styles.modalWrapper,
            {
              transform: [
                { scale: scaleAnim },
                { translateY: slideAnim }
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
              <View style={styles.headerIconContainer}>
                <LinearGradient
                  colors={['#667eea', '#764ba2']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.headerIcon}
                >
                  <Ionicons name="basket" size={24} color="#fff" />
                </LinearGradient>
              </View>
              <Text style={styles.title}>Select Cart Type</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.9)', 'rgba(240, 240, 240, 0.8)']}
                  style={styles.closeButtonGradient}
                >
                  <Ionicons name="close" size={20} color="#666" />
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <Text style={styles.subtitle}>
              Choose which cart you'd like to view
            </Text>

            {/* Options Container */}
            <View style={styles.optionsContainer}>
              <TouchableOpacity
                style={[
                  styles.optionCard,
                  groceryItemCount === 0 && styles.disabledCard
                ]}
                onPress={groceryItemCount > 0 ? onSelectGrocery : undefined}
                disabled={groceryItemCount === 0}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={groceryItemCount > 0 ? 
                    ['rgba(76, 175, 80, 0.1)', 'rgba(76, 175, 80, 0.05)'] : 
                    ['rgba(200, 200, 200, 0.1)', 'rgba(200, 200, 200, 0.05)']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.optionGradient}
                >
                  <View style={styles.optionHeader}>
                    <View style={[
                      styles.iconContainer, 
                      { backgroundColor: groceryItemCount > 0 ? '#4CAF50' : '#ccc' }
                    ]}>
                      <Ionicons name="basket" size={24} color="#fff" />
                    </View>
                    {groceryItemCount > 0 && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{groceryItemCount}</Text>
                      </View>
                    )}
                  </View>
                  
                  <Text style={[
                    styles.optionTitle,
                    groceryItemCount === 0 && styles.disabledText
                  ]}>
                    Grocery Cart
                  </Text>
                  
                  <Text style={[
                    styles.optionDescription,
                    groceryItemCount === 0 && styles.disabledText
                  ]}>
                    {groceryItemCount > 0 
                      ? `${groceryItemCount} item${groceryItemCount > 1 ? 's' : ''} in cart`
                      : 'No items in grocery cart'
                    }
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.optionCard,
                  serviceItemCount === 0 && styles.disabledCard
                ]}
                onPress={serviceItemCount > 0 ? onSelectServices : undefined}
                disabled={serviceItemCount === 0}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={serviceItemCount > 0 ? 
                    ['rgba(33, 150, 243, 0.1)', 'rgba(33, 150, 243, 0.05)'] : 
                    ['rgba(200, 200, 200, 0.1)', 'rgba(200, 200, 200, 0.05)']
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.optionGradient}
                >
                  <View style={styles.optionHeader}>
                    <View style={[
                      styles.iconContainer, 
                      { backgroundColor: serviceItemCount > 0 ? '#2196F3' : '#ccc' }
                    ]}>
                      <Ionicons name="construct" size={24} color="#fff" />
                    </View>
                    {serviceItemCount > 0 && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{serviceItemCount}</Text>
                      </View>
                    )}
                  </View>
                  
                  <Text style={[
                    styles.optionTitle,
                    serviceItemCount === 0 && styles.disabledText
                  ]}>
                    Services Cart
                  </Text>
                  
                  <Text style={[
                    styles.optionDescription,
                    serviceItemCount === 0 && styles.disabledText
                  ]}>
                    {serviceItemCount > 0 
                      ? `${serviceItemCount} service${serviceItemCount > 1 ? 's' : ''} booked`
                      : 'No services in cart'
                    }
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Unified Cart Option */}
            {(groceryItemCount > 0 && serviceItemCount > 0) && (
              <>
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>OR</Text>
                  <View style={styles.dividerLine} />
                </View>

                <LinearGradient
                  colors={['#667eea', '#764ba2']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.unifiedButton}
                >
                  <TouchableOpacity
                    style={styles.unifiedButtonTouchable}
                    onPress={() => {
                      onClose();
                      onSelectUnified?.();
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="layers" size={20} color="#fff" />
                    <Text style={styles.unifiedButtonText}>
                      View Combined Cart ({groceryItemCount + serviceItemCount} items)
                    </Text>
                  </TouchableOpacity>
                </LinearGradient>
              </>
            )}

            {/* Empty State */}
            {groceryItemCount === 0 && serviceItemCount === 0 && (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconContainer}>
                  <LinearGradient
                    colors={['rgba(156, 163, 175, 0.2)', 'rgba(156, 163, 175, 0.1)']}
                    style={styles.emptyIconGradient}
                  >
                    <Ionicons name="cart-outline" size={40} color="#9ca3af" />
                  </LinearGradient>
                </View>
                <Text style={styles.emptyTitle}>Your cart is empty</Text>
                <Text style={styles.emptySubtitle}>
                  Add some items or book services to get started
                </Text>
              </View>
            )}
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
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
    padding: 28,
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
    backgroundColor: '#667eea',
    top: -30,
    right: -30,
  },
  circle2: {
    width: 80,
    height: 80,
    backgroundColor: '#764ba2',
    bottom: -20,
    left: -20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerIconContainer: {
    width: 40,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: -0.5,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  closeButtonGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
    textAlign: 'center',
    fontWeight: '500',
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  optionCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  disabledCard: {
    opacity: 0.6,
  },
  optionGradient: {
    padding: 20,
    alignItems: 'center',
    minHeight: 140,
    justifyContent: 'center',
  },
  optionHeader: {
    position: 'relative',
    marginBottom: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#ff6b6b',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 6,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  optionDescription: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    fontWeight: '500',
  },
  disabledText: {
    color: '#9ca3af',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '600',
    letterSpacing: 1,
  },
  unifiedButton: {
    borderRadius: 16,
    shadowColor: '#667eea',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 8,
  },
  unifiedButtonTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  unifiedButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
    letterSpacing: 0.3,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIconContainer: {
    marginBottom: 20,
  },
  emptyIconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
  },
});

export default CartSelectionModal;