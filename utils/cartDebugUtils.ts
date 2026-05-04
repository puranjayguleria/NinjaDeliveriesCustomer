/**
 * Cart Debug Utilities
 * Helper functions to debug and fix cart badge issues
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const GROCERY_CART_KEY = '@myapp_cart';
const SERVICE_CART_KEY = '@service_cart_data';

/**
 * Force clear all cart data from AsyncStorage
 * Use this when cart badge shows incorrect count
 */
export const forceResetAllCarts = async (): Promise<void> => {
  try {
    console.log('[CartDebug] Force clearing all carts from AsyncStorage...');
    
    await Promise.all([
      AsyncStorage.removeItem(GROCERY_CART_KEY),
      AsyncStorage.removeItem(SERVICE_CART_KEY),
    ]);
    
    console.log('[CartDebug] ✅ All carts cleared from AsyncStorage');
    console.log('[CartDebug] Please restart the app to see changes');
  } catch (error) {
    console.error('[CartDebug] ❌ Failed to clear carts:', error);
    throw error;
  }
};

/**
 * Get current cart state from AsyncStorage
 * Use this to debug what's stored
 */
export const debugCartState = async (): Promise<void> => {
  try {
    const [groceryCart, serviceCart] = await Promise.all([
      AsyncStorage.getItem(GROCERY_CART_KEY),
      AsyncStorage.getItem(SERVICE_CART_KEY),
    ]);

    console.log('[CartDebug] Current cart state in AsyncStorage:');
    console.log('[CartDebug] Grocery Cart:', groceryCart ? JSON.parse(groceryCart) : 'empty');
    console.log('[CartDebug] Service Cart:', serviceCart ? JSON.parse(serviceCart) : 'empty');

    if (groceryCart) {
      const parsed = JSON.parse(groceryCart);
      const count = Object.values(parsed).reduce((sum: number, qty: any) => sum + Number(qty), 0);
      console.log('[CartDebug] Grocery items count:', count);
      console.log('[CartDebug] Grocery product IDs:', Object.keys(parsed));
    }

    if (serviceCart) {
      const parsed = JSON.parse(serviceCart);
      const count = Object.keys(parsed.items || {}).length;
      console.log('[CartDebug] Service items count:', count);
    }
  } catch (error) {
    console.error('[CartDebug] Failed to read cart state:', error);
  }
};

/**
 * Clear only grocery cart
 */
export const clearGroceryCart = async (): Promise<void> => {
  try {
    console.log('[CartDebug] Clearing grocery cart...');
    await AsyncStorage.removeItem(GROCERY_CART_KEY);
    console.log('[CartDebug] ✅ Grocery cart cleared');
  } catch (error) {
    console.error('[CartDebug] ❌ Failed to clear grocery cart:', error);
    throw error;
  }
};

/**
 * Clear only service cart
 */
export const clearServiceCart = async (): Promise<void> => {
  try {
    console.log('[CartDebug] Clearing service cart...');
    await AsyncStorage.removeItem(SERVICE_CART_KEY);
    console.log('[CartDebug] ✅ Service cart cleared');
  } catch (error) {
    console.error('[CartDebug] ❌ Failed to clear service cart:', error);
    throw error;
  }
};

/**
 * QUICK FIX: Run this in console to clear the stuck cart item
 * Usage in React Native Debugger:
 * 
 * import { quickFixStuckCart } from './utils/cartDebugUtils';
 * quickFixStuckCart();
 */
export const quickFixStuckCart = async (): Promise<void> => {
  try {
    console.log('🔧 [QuickFix] Clearing stuck cart item...');
    await forceResetAllCarts();
    console.log('✅ [QuickFix] Done! Reload the app now.');
    console.log('💡 [QuickFix] Run: DevSettings.reload() or shake device and tap "Reload"');
  } catch (error) {
    console.error('❌ [QuickFix] Failed:', error);
  }
};

/**
 * Check if a specific product exists in Firestore
 */
export const checkProductExists = async (productId: string): Promise<void> => {
  try {
    console.log(`[CartDebug] Checking product: ${productId}`);
    
    // Check in products collection
    const { default: firestoreDb } = require('@react-native-firebase/firestore');
    
    const productDoc = await firestoreDb().collection('products').doc(productId).get();
    const saleProductDoc = await firestoreDb().collection('saleProducts').doc(productId).get();
    
    console.log('[CartDebug] Product in "products":', productDoc.exists ? productDoc.data() : 'NOT FOUND');
    console.log('[CartDebug] Product in "saleProducts":', saleProductDoc.exists ? saleProductDoc.data() : 'NOT FOUND');
    
    if (!productDoc.exists && !saleProductDoc.exists) {
      console.warn(`⚠️ [CartDebug] Product ${productId} does not exist in Firestore!`);
      console.log('💡 [CartDebug] This product should be removed from cart.');
    } else {
      const data = productDoc.exists ? productDoc.data() : saleProductDoc.data();
      console.log('[CartDebug] Product details:', {
        name: data?.name,
        quantity: data?.quantity,
        storeId: data?.storeId,
        price: data?.price,
      });
      
      if ((data?.quantity ?? 0) <= 0) {
        console.warn('⚠️ [CartDebug] Product is OUT OF STOCK!');
      }
    }
  } catch (error) {
    console.error('[CartDebug] Failed to check product:', error);
  }
};

/**
 * Test the grocery payment recovery modal
 * This will manually trigger the modal to test if it's working
 */
export const testGroceryRecoveryModal = async (): Promise<void> => {
  try {
    console.log('🧪 [Test] Triggering grocery recovery modal...');
    
    // Save a test banner key
    await AsyncStorage.setItem(
      'grocery_confirmed_banner',
      JSON.stringify({ orderId: 'test_order_123', createdAt: Date.now() })
    );
    
    console.log('✅ [Test] Banner key saved!');
    console.log('💡 [Test] Reload the app to see the modal');
    console.log('💡 [Test] Or navigate away and back to trigger the check');
  } catch (error) {
    console.error('❌ [Test] Failed:', error);
  }
};

/**
 * Check recovery state - see if there's any pending recovery
 */
export const checkRecoveryState = async (): Promise<void> => {
  try {
    console.log('[RecoveryDebug] Checking recovery state...');
    
    const [recoveryKey, bannerKey] = await Promise.all([
      AsyncStorage.getItem('grocery_payment_recovery'),
      AsyncStorage.getItem('grocery_confirmed_banner'),
    ]);
    
    console.log('[RecoveryDebug] Recovery snapshot:', recoveryKey ? JSON.parse(recoveryKey) : 'NONE');
    console.log('[RecoveryDebug] Banner key:', bannerKey ? JSON.parse(bannerKey) : 'NONE');
    
    if (!recoveryKey && !bannerKey) {
      console.log('✅ [RecoveryDebug] No pending recovery');
    }
  } catch (error) {
    console.error('[RecoveryDebug] Failed:', error);
  }
};

// Make it globally accessible for easy debugging
if (__DEV__) {
  (global as any).clearCarts = forceResetAllCarts;
  (global as any).debugCarts = debugCartState;
  (global as any).quickFix = quickFixStuckCart;
  (global as any).checkProduct = checkProductExists;
  (global as any).testModal = testGroceryRecoveryModal;
  (global as any).checkRecovery = checkRecoveryState;
  console.log('🛠️ [CartDebug] Global helpers available:');
  console.log('   - clearCarts()           : Clear all carts');
  console.log('   - debugCarts()           : Show cart state');
  console.log('   - quickFix()             : Quick fix stuck cart');
  console.log('   - checkProduct(id)       : Check if product exists in Firestore');
  console.log('   - testModal()            : Test recovery modal');
  console.log('   - checkRecovery()        : Check recovery state');
}
