/**
 * CartClearListener Component
 * 
 * Listens to user document for clearGroceryCart and clearRecoverySnapshot flags
 * When flags are true, clears the cart, recovery snapshot, and removes the flags
 */

import { useEffect } from 'react';
import { auth } from '../firebase.native';
import { useCart } from '../context/CartContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GROCERY_PAYMENT_RECOVERY_KEY = 'grocery_payment_recovery';
const GROCERY_CONFIRMED_BANNER_KEY = 'grocery_confirmed_banner';

export const CartClearListener = () => {
  const { clearCart } = useCart();
  const user = auth().currentUser;

  useEffect(() => {
    if (!user) return;

    console.log('[CartClearListener] Setting up listener for user:', user.uid);

    // Listen to user document for clear flags
    const { default: firestoreDb } = require('@react-native-firebase/firestore'); // eslint-disable-line @typescript-eslint/no-require-imports
    
    const unsubscribe = firestoreDb()
      .collection('users')
      .doc(user.uid)
      .onSnapshot(
        async (snapshot: any) => {
          if (!snapshot.exists) return;

          const data = snapshot.data();
          
          // Check if cart should be cleared
          if (data?.clearGroceryCart === true || data?.clearRecoverySnapshot === true) {
            console.log('[CartClearListener] 🧹 Clear flags detected!');
            
            if (data?.clearGroceryCart === true) {
              console.log('[CartClearListener] Clearing cart...');
              clearCart();
            }
            
            if (data?.clearRecoverySnapshot === true) {
              console.log('[CartClearListener] Clearing recovery snapshot...');
              await AsyncStorage.removeItem(GROCERY_PAYMENT_RECOVERY_KEY);
              await AsyncStorage.removeItem(GROCERY_CONFIRMED_BANNER_KEY);
            }
            
            // Remove the flags from Firestore
            try {
              const updates: any = {};
              if (data?.clearGroceryCart === true) {
                updates.clearGroceryCart = false;
              }
              if (data?.clearRecoverySnapshot === true) {
                updates.clearRecoverySnapshot = false;
              }
              
              await firestoreDb()
                .collection('users')
                .doc(user.uid)
                .update(updates);
              
              console.log('[CartClearListener] ✅ Cart and recovery cleared, flags removed');
            } catch (error) {
              console.error('[CartClearListener] Failed to remove flags:', error);
            }
          }
        },
        (error: any) => {
          console.error('[CartClearListener] Listener error:', error);
        }
      );

    return () => {
      console.log('[CartClearListener] Cleaning up listener');
      unsubscribe();
    };
  }, [user, clearCart]);

  return null; // This is a listener component, no UI
};
