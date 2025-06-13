import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useMemo,
  useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";

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
  getItemQuantity: (productId: string) => number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);
export const useCartQty = (productId: string) => {
  const { cart } = useCart();
  return cart[productId] ?? 0;
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};

type Props = {
  children: ReactNode;
};

const CART_STORAGE_KEY = "@myapp_cart";

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
        console.error("Failed to load cart:", error);
        Toast.show({
          type: "error",
          text1: "Error",
          text2: "Failed to load your cart",
        });
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
        console.error("Failed to save cart:", error);
      }
    };
    saveCart();
  }, [cart]);

  const getItemQuantity = useCallback(
    (productId: string): number => {
      return cart[productId] || 0;
    },
    [cart]
  );

  // -------------------------------
  //  ADD TO CART
  // -------------------------------
  const addToCart = useCallback(
    (productId: string, availableQuantity: number) => {
      setCart((prevCart) => {
        const currentQty = prevCart[productId] || 0;

        // If already at max quantity
        if (currentQty >= availableQuantity) {
          Toast.show({
            type: "info",
            text1: "Stock limit reached",
            text2: `Only ${availableQuantity} left in stock`,
          });
          return prevCart;
        }

        // Add to cart or increment by 1
        return {
          ...prevCart,
          [productId]: currentQty + 1,
        };
      });
    },
    []
  );

  // -------------------------------
  //  INCREASE QUANTITY
  // -------------------------------
  const increaseQuantity = useCallback(
    (productId: string, availableQuantity: number) => {
      setCart((prevCart) => {
        const currentQty = prevCart[productId] || 0;

        if (currentQty + 1 > availableQuantity) {
          Toast.show({
            type: "info",
            text1: "Not enough stock",
            text2: `Only ${availableQuantity} left in stock`,
          });
          return prevCart;
        }

        return {
          ...prevCart,
          [productId]: currentQty + 1,
        };
      });
    },
    []
  );

  // -------------------------------
  //  DECREASE QUANTITY
  // -------------------------------
  const decreaseQuantity = useCallback((productId: string) => {
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
  }, []);

  // -------------------------------
  //  REMOVE FROM CART
  // -------------------------------
  const removeFromCart = useCallback((productId: string) => {
    setCart((prevCart) => {
      const { [productId]: _, ...rest } = prevCart;
      return rest;
    });
  }, []);

  // -------------------------------
  //  CLEAR CART
  // -------------------------------
  const clearCart = useCallback(() => {
    setCart({});
  }, []);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      cart,
      addToCart,
      increaseQuantity,
      decreaseQuantity,
      removeFromCart,
      clearCart,
      getItemQuantity,
    }),
    [
      cart,
      addToCart,
      increaseQuantity,
      decreaseQuantity,
      removeFromCart,
      clearCart,
      getItemQuantity,
    ]
  );

  return (
    <CartContext.Provider value={contextValue}>{children}</CartContext.Provider>
  );
};
