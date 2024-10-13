// context/CustomerContext.tsx
import React, { createContext, useContext, useState } from 'react';
import auth from '@react-native-firebase/auth';

// Define a context for holding customer information
const CustomerContext = createContext<any>(null);

export const useCustomer = () => useContext(CustomerContext);

export const CustomerProvider = ({ children }) => {
  const [customerId, setCustomerId] = useState<string | null>(null);

  const login = async (phoneNumber: string, confirmationResult: any) => {
    try {
      const user = auth().currentUser;
      if (user) {
        setCustomerId(user.uid);
      }
    } catch (error) {
      console.error('Login Error:', error);
    }
  };

  return (
    <CustomerContext.Provider value={{ customerId, setCustomerId, login }}>
      {children}
    </CustomerContext.Provider>
  );
};
