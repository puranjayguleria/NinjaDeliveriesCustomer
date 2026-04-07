/**
 * foodFirebase.ts
 * Centralized Firebase service for all food-related collections.
 * Collections used:
 *   - registerRestaurant
 *   - restaurant_categories
 *   - restaurant_menu
 *   - restaurant_menuAddons
 */

import firestore from '@react-native-firebase/firestore';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Restaurant = {
  id: string;
  restaurantName: string;
  ownerName: string;
  email: string;
  phone: string;
  address: string;
  isActive: boolean;
  accountEnabled: boolean;
  type: string;
  createdAt?: any;
  updatedAt?: any;
};

export type FoodCategory = {
  id: string;
  name: string;
  image: string;
  isActive: boolean;
  companyIds: string[];
  createdAt?: any;
  updatedAt?: any;
};

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: string;
  image: string;
  category: string;
  categoryId: string;
  available: boolean;
  restaurantId: string;
  variants: { size: string; price: string }[];
  createdAt?: any;
};

export type MenuAddon = {
  id: string;
  name: string;
  description: string;
  price: string;
  image: string;
  menuItemId: string;
  menuItemName: string;
  restaurantId: string;
  available: boolean;
  createdAt?: any;
  lastUpdated?: any;
};

// ─── Restaurant Queries ───────────────────────────────────────────────────────

/** Fetch all active & enabled restaurants */
export async function getActiveRestaurants(): Promise<Restaurant[]> {
  const snap = await firestore()
    .collection('registerRestaurant')
    .where('isActive', '==', true)
    .where('accountEnabled', '==', true)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Restaurant, 'id'>) }));
}

/** Real-time listener for active restaurants */
export function listenActiveRestaurants(
  onData: (restaurants: Restaurant[]) => void,
  onError?: (e: Error) => void
) {
  return firestore()
    .collection('registerRestaurant')
    .where('isActive', '==', true)
    .where('accountEnabled', '==', true)
    .onSnapshot(
      snap => onData(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))),
      onError
    );
}

/** Fetch a single restaurant by ID */
export async function getRestaurantById(restaurantId: string): Promise<Restaurant | null> {
  const doc = await firestore().collection('registerRestaurant').doc(restaurantId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...(doc.data() as Omit<Restaurant, 'id'>) };
}

// ─── Category Queries ─────────────────────────────────────────────────────────

/** Fetch all active food categories */
export async function getFoodCategories(): Promise<FoodCategory[]> {
  const snap = await firestore()
    .collection('restaurant_categories')
    .where('isActive', '==', true)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<FoodCategory, 'id'>) }));
}

/** Fetch categories that belong to a specific restaurant */
export async function getCategoriesForRestaurant(restaurantId: string): Promise<FoodCategory[]> {
  const snap = await firestore()
    .collection('restaurant_categories')
    .where('isActive', '==', true)
    .where('companyIds', 'array-contains', restaurantId)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<FoodCategory, 'id'>) }));
}

// ─── Menu Queries ─────────────────────────────────────────────────────────────

/** Fetch all available menu items for a restaurant */
export async function getMenuByRestaurant(restaurantId: string): Promise<MenuItem[]> {
  const snap = await firestore()
    .collection('restaurant_menu')
    .where('restaurantId', '==', restaurantId)
    .where('available', '==', true)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<MenuItem, 'id'>) }));
}

/** Fetch menu items filtered by category */
export async function getMenuByCategory(restaurantId: string, categoryId: string): Promise<MenuItem[]> {
  const snap = await firestore()
    .collection('restaurant_menu')
    .where('restaurantId', '==', restaurantId)
    .where('categoryId', '==', categoryId)
    .where('available', '==', true)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<MenuItem, 'id'>) }));
}

/** Real-time listener for a restaurant's menu */
export function listenMenuByRestaurant(
  restaurantId: string,
  onData: (items: MenuItem[]) => void,
  onError?: (e: Error) => void
) {
  return firestore()
    .collection('restaurant_menu')
    .where('restaurantId', '==', restaurantId)
    .where('available', '==', true)
    .onSnapshot(
      snap => onData(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))),
      onError
    );
}

// ─── Addon Queries ────────────────────────────────────────────────────────────

/** Fetch all available addons for a restaurant */
export async function getAddonsByRestaurant(restaurantId: string): Promise<MenuAddon[]> {
  const snap = await firestore()
    .collection('restaurant_menuAddons')
    .where('restaurantId', '==', restaurantId)
    .where('available', '==', true)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<MenuAddon, 'id'>) }));
}

/** Fetch addons for a specific menu item */
export async function getAddonsByMenuItem(menuItemId: string): Promise<MenuAddon[]> {
  const snap = await firestore()
    .collection('restaurant_menuAddons')
    .where('menuItemId', '==', menuItemId)
    .where('available', '==', true)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<MenuAddon, 'id'>) }));
}
