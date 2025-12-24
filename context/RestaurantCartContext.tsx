// context/RestaurantCartContext.tsx

import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from "react";

export type RestaurantCartItem = {
  id: string;
  name: string;
  price: number;
  isVeg?: boolean;
  imageUrl?: string;
  quantity: number;
};

type RestaurantCartState = {
  restaurantId: string | null; // which restaurant this cart belongs to
  items: Record<string, RestaurantCartItem>; // key = menuItemId
};

type RestaurantCartContextType = {
  state: RestaurantCartState;
  addItem: (
    restaurantId: string,
    item: Omit<RestaurantCartItem, "quantity">
  ) => void;
  increase: (menuItemId: string) => void;
  decrease: (menuItemId: string) => void;
  clearCart: () => void;
  getItemQty: (menuItemId: string) => number;
  totalItems: number;
  totalAmount: number;
};

const RestaurantCartContext = createContext<
  RestaurantCartContextType | undefined
>(undefined);

export const useRestaurantCart = (): RestaurantCartContextType => {
  const ctx = useContext(RestaurantCartContext);
  if (!ctx) {
    throw new Error(
      "useRestaurantCart must be used within a RestaurantCartProvider"
    );
  }
  return ctx;
};

export const RestaurantCartProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<RestaurantCartState>({
    restaurantId: null,
    items: {},
  });

  /**
   * Swiggy-style behaviour:
   * - If you add from a different restaurant, old restaurant cart is cleared.
   * - Otherwise, item quantity just increments.
   */
  const addItem: RestaurantCartContextType["addItem"] = (
    restaurantId,
    item
  ) => {
    setState((prev) => {
      // If different restaurant, reset cart
      if (prev.restaurantId && prev.restaurantId !== restaurantId) {
        return {
          restaurantId,
          items: {
            [item.id]: { ...item, quantity: 1 },
          },
        };
      }

      const existing = prev.items[item.id];
      return {
        restaurantId,
        items: {
          ...prev.items,
          [item.id]: {
            ...item,
            quantity: existing ? existing.quantity + 1 : 1,
          },
        },
      };
    });
  };

  const increase = (menuItemId: string) => {
    setState((prev) => {
      const existing = prev.items[menuItemId];
      if (!existing) return prev;
      return {
        ...prev,
        items: {
          ...prev.items,
          [menuItemId]: {
            ...existing,
            quantity: existing.quantity + 1,
          },
        },
      };
    });
  };

  const decrease = (menuItemId: string) => {
    setState((prev) => {
      const existing = prev.items[menuItemId];
      if (!existing) return prev;

      // if going to 0 → remove from cart
      if (existing.quantity <= 1) {
        const cloned = { ...prev.items };
        delete cloned[menuItemId];
        return {
          ...prev,
          items: cloned,
        };
      }

      return {
        ...prev,
        items: {
          ...prev.items,
          [menuItemId]: {
            ...existing,
            quantity: existing.quantity - 1,
          },
        },
      };
    });
  };

  const clearCart = () => {
    setState({
      restaurantId: null,
      items: {},
    });
  };

  const getItemQty = (menuItemId: string) =>
    state.items[menuItemId]?.quantity ?? 0;

  const totalItems = useMemo(
    () => Object.values(state.items).reduce((sum, it) => sum + it.quantity, 0),
    [state.items]
  );

  const totalAmount = useMemo(
    () =>
      Object.values(state.items).reduce(
        (sum, it) => sum + it.quantity * it.price,
        0
      ),
    [state.items]
  );

  const value: RestaurantCartContextType = useMemo(
    () => ({
      state,
      addItem,
      increase,
      decrease,
      clearCart,
      getItemQty,
      totalItems,
      totalAmount,
    }),
    [state, totalItems, totalAmount]
  );

  return (
    <RestaurantCartContext.Provider value={value}>
      {children}
    </RestaurantCartContext.Provider>
  );
};
