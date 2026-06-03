import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CART_STORAGE_KEY = '@food_cart_items';

export type AddonItem = {
  name: string;
  price: number;
  image?: string;
};

export type FoodCartItem = {
  id: string;
  name: string;
  price: number;
  image?: string;
  restaurantId: string;
  restaurantName: string;
  variant?: string;
  addons?: AddonItem[];
  qty: number;
  description?: string;
  cookingTimeHours?: string;
  cookingTimeMinutes?: string;
};

type FoodCartContextType = {
  cartItems: FoodCartItem[];
  addItem: (item: Omit<FoodCartItem, 'qty'>) => void;
  removeItem: (id: string) => void;
  getItemQty: (id: string) => number;
  clearCart: () => void;
  clearRestaurantItems: (restaurantId: string) => void;
  totalItems: number;
  totalPrice: number;
  restaurantId: string | null;
  restaurantIds: string[];
  crossRestaurantModalVisible: boolean;
  crossRestaurantRestaurantName: string | null;
  confirmCrossRestaurantAdd: () => void;
  cancelCrossRestaurantAdd: () => void;
};

const FoodCartContext = createContext<FoodCartContextType | undefined>(undefined);

export const FoodCartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cartItems, setCartItems] = useState<FoodCartItem[]>([]);

  // Load cart from storage on mount
  useEffect(() => {
    AsyncStorage.getItem(CART_STORAGE_KEY)
      .then(data => { if (data) setCartItems(JSON.parse(data)); })
      .catch(() => {});
  }, []);

  // Save cart to storage whenever it changes
  useEffect(() => {
    AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems)).catch(() => {});
  }, [cartItems]);

  // First restaurant id (for backward compat)
  const restaurantId = cartItems.length > 0 ? cartItems[0].restaurantId : null;

  // All unique restaurant ids in cart
  const restaurantIds = Array.from(new Set(cartItems.map(i => i.restaurantId)));
  const [pendingCrossRestaurantItem, setPendingCrossRestaurantItem] = useState<Omit<FoodCartItem, 'qty'> | null>(null);

  const addItem = useCallback((item: Omit<FoodCartItem, 'qty'>) => {
    setCartItems(prev => {
      if (prev.length > 0 && prev[0].restaurantId !== item.restaurantId) {
        setPendingCrossRestaurantItem(item);
        return prev;
      }

      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...item, qty: 1 }];
    });
  }, []);

  const confirmCrossRestaurantAdd = useCallback(() => {
    if (!pendingCrossRestaurantItem) return;
    setCartItems([{ ...pendingCrossRestaurantItem, qty: 1 }]);
    setPendingCrossRestaurantItem(null);
  }, [pendingCrossRestaurantItem]);

  const cancelCrossRestaurantAdd = useCallback(() => {
    setPendingCrossRestaurantItem(null);
  }, []);

  const removeItem = useCallback((id: string) => {
    setCartItems(prev => {
      const existing = prev.find(i => i.id === id);
      if (!existing) return prev;
      if (existing.qty <= 1) return prev.filter(i => i.id !== id);
      return prev.map(i => i.id === id ? { ...i, qty: i.qty - 1 } : i);
    });
  }, []);

  const getItemQty = useCallback((id: string) => {
    return cartItems.find(i => i.id === id)?.qty ?? 0;
  }, [cartItems]);

  const clearCart = useCallback(() => setCartItems([]), []);

  const clearRestaurantItems = useCallback((restaurantId: string) => {
    setCartItems(prev => prev.filter(i => i.restaurantId !== restaurantId));
  }, []);

  const totalItems = cartItems.reduce((sum, i) => sum + i.qty, 0);

  // Total price including addons
  const totalPrice = cartItems.reduce((sum, item) => {
    const itemPrice = item.price * item.qty;
    const addonsPrice = (item.addons || []).reduce((a, addon) => a + addon.price, 0) * item.qty;
    return sum + itemPrice + addonsPrice;
  }, 0);

  return (
    <FoodCartContext.Provider value={{
      cartItems, addItem, removeItem, getItemQty,
      clearCart, clearRestaurantItems,
      totalItems, totalPrice, restaurantId, restaurantIds,
      crossRestaurantModalVisible: pendingCrossRestaurantItem !== null,
      crossRestaurantRestaurantName: pendingCrossRestaurantItem?.restaurantName ?? null,
      confirmCrossRestaurantAdd,
      cancelCrossRestaurantAdd,
    }}>
      {children}
      <Modal
        visible={pendingCrossRestaurantItem !== null}
        transparent
        animationType="fade"
        onRequestClose={cancelCrossRestaurantAdd}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Different Restaurant</Text>
            <Text style={styles.modalMessage} numberOfLines={3}>
              Your cart already contains items from another restaurant.
              Clear the cart and add this item from {pendingCrossRestaurantItem?.restaurantName}?
            </Text>
            <View style={styles.modalActionRow}>
              <TouchableOpacity style={styles.modalButtonSecondary} onPress={cancelCrossRestaurantAdd}>
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButtonPrimary} onPress={confirmCrossRestaurantAdd}>
                <Text style={styles.modalButtonPrimaryText}>Clear & Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </FoodCartContext.Provider>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1D2E',
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 22,
  },
  modalActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButtonSecondary: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  modalButtonSecondaryText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 14,
  },
  modalButtonPrimary: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: '#FF6B35',
  },
  modalButtonPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});

export const useFoodCart = () => {
  const ctx = useContext(FoodCartContext);
  if (!ctx) throw new Error('useFoodCart must be used within FoodCartProvider');
  return ctx;
};
