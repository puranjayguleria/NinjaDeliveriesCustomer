import React, { createContext, useContext, useState, useCallback } from 'react';

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
  totalItems: number;
  totalPrice: number;
  restaurantId: string | null;
};

const FoodCartContext = createContext<FoodCartContextType | undefined>(undefined);

export const FoodCartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cartItems, setCartItems] = useState<FoodCartItem[]>([]);

  const restaurantId = cartItems.length > 0 ? cartItems[0].restaurantId : null;

  const addItem = useCallback((item: Omit<FoodCartItem, 'qty'>) => {
    setCartItems(prev => {
      // If different restaurant, clear cart first
      if (prev.length > 0 && prev[0].restaurantId !== item.restaurantId) {
        return [{ ...item, qty: 1 }];
      }
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...item, qty: 1 }];
    });
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

  const totalItems = cartItems.reduce((sum, i) => sum + i.qty, 0);
  
  // Calculate total price including addons
  const totalPrice = cartItems.reduce((sum, item) => {
    const itemPrice = item.price * item.qty;
    const addonsPrice = (item.addons || []).reduce((addonSum, addon) => addonSum + addon.price, 0) * item.qty;
    return sum + itemPrice + addonsPrice;
  }, 0);

  return (
    <FoodCartContext.Provider value={{
      cartItems, addItem, removeItem, getItemQty,
      clearCart, totalItems, totalPrice, restaurantId,
    }}>
      {children}
    </FoodCartContext.Provider>
  );
};

export const useFoodCart = () => {
  const ctx = useContext(FoodCartContext);
  if (!ctx) throw new Error('useFoodCart must be used within FoodCartProvider');
  return ctx;
};
