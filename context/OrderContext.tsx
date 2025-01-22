// context/OrderContext.tsx
import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface Order {
  id: string;
  items: any[];
  status: string;
  pickupCoords: {
    latitude: number;
    longitude: number;
  };
  dropoffCoords: {
    latitude: number;
    longitude: number;
  };
  totalCost: number;
  riderId: string;
  // Add other relevant fields if necessary
}

interface OrderContextProps {
  activeOrders: Order[];
  setActiveOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  setActiveOrder: (order: Order | null) => void; // New method
}

const OrderContext = createContext<OrderContextProps>({
  activeOrders: [],
  setActiveOrders: () => {},
  setActiveOrder: () => {},
});

export const useOrder = () => useContext(OrderContext);

interface OrderProviderProps {
  children: ReactNode;
}

export const OrderProvider: React.FC<OrderProviderProps> = ({ children }) => {
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const user = auth().currentUser;

  // Load orders from AsyncStorage on mount
  useEffect(() => {
    const loadOrders = async () => {
      try {
        if (user) { // Ensure user is defined
          const storedOrders = await AsyncStorage.getItem(`activeOrders_${user.uid}`);
          if (storedOrders) {
            const parsedOrders: Order[] = JSON.parse(storedOrders);
            setActiveOrders(parsedOrders);
            console.log("Loaded orders from AsyncStorage:", parsedOrders);
          } else {
            console.log("No stored orders found in AsyncStorage.");
          }
        }
      } catch (error) {
        console.error("Failed to load orders from storage:", error);
      }
    };

    if (user) {
      loadOrders();
    }
  }, [user]);

  // Listen to Firestore and update state and AsyncStorage
  useEffect(() => {
    if (!user) return;

    const unsubscribe = firestore()
      .collection("orders")
      .where("orderedBy", "==", user.uid)
      .where("status", "in", ["pending", "active"])
      .onSnapshot(
        (querySnapshot) => {
          const orders: Order[] = [];
          querySnapshot.forEach((doc) => {
            orders.push({ id: doc.id, ...(doc.data() as Order) });
          });
          setActiveOrders(orders);
          console.log("Fetched active orders from Firestore:", orders);
          // Save to AsyncStorage
          AsyncStorage.setItem(`activeOrders_${user.uid}`, JSON.stringify(orders)).catch((error) =>
            console.error("Failed to save orders to storage:", error)
          );
        },
        (error) => {
          console.error("Error fetching active orders: ", error);
        }
      );

    return () => unsubscribe();
  }, [user]);

  // Implement setActiveOrder to manage a single active order
  const setActiveOrder = (order: Order | null) => {
    if (order) {
      setActiveOrders([order]);
      // Save to AsyncStorage
      if (user) {
        AsyncStorage.setItem(`activeOrders_${user.uid}`, JSON.stringify([order])).catch((error) =>
          console.error("Failed to save active order to storage:", error)
        );
      }
    } else {
      setActiveOrders([]);
      // Remove from AsyncStorage
      if (user) {
        AsyncStorage.removeItem(`activeOrders_${user.uid}`).catch((error) =>
          console.error("Failed to remove active order from storage:", error)
        );
      }
    }
  };

  return (
    <OrderContext.Provider value={{ activeOrders, setActiveOrders, setActiveOrder }}>
      {children}
    </OrderContext.Provider>
  );
};
