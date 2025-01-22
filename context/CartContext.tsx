// context/CartContext.tsx

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message'; // <-- import Toast

type Cart = {
  [productId: string]: number;
};

type CartContextType = {
  cart: Cart;
  addToCart: (productId: string, availableQuantity: number) => void;
  increaseQuantity: (productId: string, availableQuantity: number) => void;
  decreaseQuantity: (productId: string) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

type Props = {
  children: ReactNode;
};

const CART_STORAGE_KEY = '@myapp_cart';

export const CartProvider: React.FC<Props> = ({ children }) => {
  const [cart, setCart] = useState<Cart>({});

  // Load cart from AsyncStorage when the provider mounts
  useEffect(() => {
    const loadCart = async () => {
      try {
        const storedCart = await AsyncStorage.getItem(CART_STORAGE_KEY);
        if (storedCart) {
          setCart(JSON.parse(storedCart));
        }
      } catch (error) {
        console.error('Failed to load cart:', error);
      }
    };
    loadCart();
  }, []);

  // Save cart to AsyncStorage whenever it changes
  useEffect(() => {
    const saveCart = async () => {
      try {
        await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
      } catch (error) {
        console.error('Failed to save cart:', error);
      }
    };
    saveCart();
  }, [cart]);

  // -------------------------------
  //  ADD TO CART
  // -------------------------------
  const addToCart = (productId: string, availableQuantity: number) => {
    setCart((prevCart) => {
      const currentQty = prevCart[productId] || 0;

      // If already at max quantity
      if (currentQty >= availableQuantity) {
        Toast.show({
          type: 'info',
          text1: 'Stock limit reached',
          text2: `Only ${availableQuantity} left in stock`,
        });
        return prevCart;
      }

      // Otherwise set to 1 if not in cart, or just use "increase" pattern
      return {
        ...prevCart,
        [productId]: currentQty === 0 ? 1 : currentQty,
      };
    });
  };

  // -------------------------------
  //  INCREASE QUANTITY
  // -------------------------------
  const increaseQuantity = (productId: string, availableQuantity: number) => {
    setCart((prevCart) => {
      const currentQty = prevCart[productId] || 0;

      // If next increment exceeds availableQuantity
      if (currentQty + 1 > availableQuantity) {
        Toast.show({
          type: 'info',
          text1: 'Not enough stock',
          text2: `Only ${availableQuantity} left in stock`,
        });
        return prevCart;
      }

      return {
        ...prevCart,
        [productId]: currentQty + 1,
      };
    });
  };

  // -------------------------------
  //  DECREASE QUANTITY
  // -------------------------------
  const decreaseQuantity = (productId: string) => {
    setCart((prevCart) => {
      const currentQty = prevCart[productId] || 0;
      if (currentQty <= 1) {
        const { [productId]: _, ...rest } = prevCart;
        return rest;
      }
      return {
        ...prevCart,
        [productId]: currentQty - 1,
      };
    });
  };

  // -------------------------------
  //  REMOVE FROM CART
  // -------------------------------
  const removeFromCart = (productId: string) => {
    setCart((prevCart) => {
      const { [productId]: _, ...rest } = prevCart;
      return rest;
    });
  };

  // -------------------------------
  //  CLEAR CART
  // -------------------------------
  const clearCart = () => {
    setCart({});
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        increaseQuantity,
        decreaseQuantity,
        removeFromCart,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
