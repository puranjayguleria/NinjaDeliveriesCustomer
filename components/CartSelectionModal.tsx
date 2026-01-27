import React from 'react';
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
  const scaleAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else {
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, scaleAnim]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity 
          style={styles.backdrop} 
          activeOpacity={1} 
          onPress={onClose}
        />
        
        <Animated.View 
          style={[
            styles.modalContainer,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Select Cart Type</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Choose which cart you'd like to view
          </Text>

          <View style={styles.optionsContainer}>
            <TouchableOpacity
              style={[
                styles.optionCard,
                groceryItemCount === 0 && styles.disabledCard
              ]}
              onPress={groceryItemCount > 0 ? onSelectGrocery : undefined}
              disabled={groceryItemCount === 0}
            >
              <View style={styles.optionHeader}>
                <View style={[styles.iconContainer, { backgroundColor: '#4CAF50' }]}>
                  <Ionicons name="basket" size={28} color="#fff" />
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
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.optionCard,
                serviceItemCount === 0 && styles.disabledCard
              ]}
              onPress={serviceItemCount > 0 ? onSelectServices : undefined}
              disabled={serviceItemCount === 0}
            >
              <View style={styles.optionHeader}>
                <View style={[styles.iconContainer, { backgroundColor: '#2196F3' }]}>
                  <Ionicons name="construct" size={28} color="#fff" />
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
            </TouchableOpacity>
          </View>

          {(groceryItemCount > 0 && serviceItemCount > 0) && (
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>
          )}

          {(groceryItemCount > 0 && serviceItemCount > 0) && (
            <TouchableOpacity
              style={styles.unifiedButton}
              onPress={() => {
                onClose();
                onSelectUnified?.();
              }}
            >
              <Ionicons name="layers" size={20} color="#fff" />
              <Text style={styles.unifiedButtonText}>
                View Combined Cart ({groceryItemCount + serviceItemCount} items)
              </Text>
            </TouchableOpacity>
          )}

          {groceryItemCount === 0 && serviceItemCount === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="cart-outline" size={48} color="#ccc" />
              <Text style={styles.emptyTitle}>Your cart is empty</Text>
              <Text style={styles.emptySubtitle}>
                Add some items or book services to get started
              </Text>
            </View>
          )}
        </Animated.View>
      </View>
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
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: width * 0.9,
    maxWidth: 400,
    maxHeight: height * 0.8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  optionCard: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 6,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  disabledCard: {
    opacity: 0.5,
    backgroundColor: '#f0f0f0',
  },
  optionHeader: {
    position: 'relative',
    marginBottom: 12,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF6B6B',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    textAlign: 'center',
  },
  optionDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  disabledText: {
    color: '#999',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  unifiedButton: {
    backgroundColor: '#6C63FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  unifiedButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default CartSelectionModal;