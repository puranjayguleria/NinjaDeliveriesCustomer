// context/CustomerContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import auth from "@react-native-firebase/auth";

const CustomerContext = createContext<any>(null);

export const useCustomer = () => useContext(CustomerContext);

export const CustomerProvider = ({ children }) => {
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Automatically detect logged-in user on app launch
  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged((user) => {
      if (user) {
        setCustomerId(user.uid);
      } else {
        setCustomerId(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (phoneNumber: string, confirmationResult: any) => {
    try {
      const user = auth().currentUser;
      if (user) {
        setCustomerId(user.uid);
      }
    } catch (error) {
      console.error("Login Error:", error);
    }
  };

  return (
    <CustomerContext.Provider
      value={{ customerId, setCustomerId, login, loading }}
    >
      {children}
    </CustomerContext.Provider>
  );
};
