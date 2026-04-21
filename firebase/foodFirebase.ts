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
  image?: string;
  createdAt?: any;
  updatedAt?: any;
  profileImage?: string;
  // Extended fields
  rating?: number;
  deliveryTime?: number;       // in minutes
  avgPrice?: number;           // per person in Rs
  freeDelivery?: boolean;
  isVeg?: boolean;
  cuisine?: string[];          // e.g. ["North Indian", "Chinese"]
  cuisineType?: "veg" | "nonveg" | "both"; // Restaurant cuisine type
  isTrending?: boolean;
  hasOffer?: boolean;
  offerPercent?: number;
  mealTimes?: string[];        // e.g. ["breakfast", "lunch", "dinner"]
  // Operating hours
  openingTime?: string;        // e.g. "09:00 AM"
  closingTime?: string;        // e.g. "11:00 PM"
  // Rush hours
  rushHours?: boolean;
  rushHoursUntil?: any;        // Firestore Timestamp
  rushHoursDuration?: number;  // in minutes
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
  image?: string;
  imageUrl?: string;
  imageURL?: string;
  category: string;
  categoryId: string;
  available: boolean;
  restaurantId: string;
  variants: { size: string; price: string }[];
  prepTime?: number; // in minutes
  cookingTimeHours?: string;
  cookingTimeMinutes?: string;
  foodType?: string;
  createdAt?: any;
};

export type FoodBanner = {
  id: string;
  imageUrl: string;
  isActive: boolean;
  type: string[];
  createdAt?: any;
};

export type MenuAddon = {
  id: string;
  name: string;
  description: string;
  price: string;
  image?: string;
  imageUrl?: string;
  imageURL?: string;
  menuItemId: string;
  menuItemName: string;
  restaurantId: string;
  available: boolean;
  createdAt?: any;
  lastUpdated?: any;
};

export type RestaurantOffer = {
  id: string;
  menuItemId: string;
  menuItemName: string;
  restaurantId: string;
  originalPrice: number;
  discountedPrice: number;
  discountPercentage: number;
  description?: string;
  active: boolean;
  createdAt?: any;
};

// ─── Banner Queries ───────────────────────────────────────────────────────────

/** Fetch all active food banners */
export async function getFoodBanners(): Promise<FoodBanner[]> {
  const snap = await firestore()
    .collection('banner')
    .where('isActive', '==', true)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<FoodBanner, 'id'>) }));
}

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
  return snap.docs.map(d => {
    const data = d.data() as any;
    return {
      id: d.id,
      ...data,
      image: data.image || data.imageUrl || data.imageURL || '',
    } as MenuItem;
  });
}

/** Fetch menu items filtered by category */
export async function getMenuByCategory(restaurantId: string, categoryId: string): Promise<MenuItem[]> {
  const snap = await firestore()
    .collection('restaurant_menu')
    .where('restaurantId', '==', restaurantId)
    .where('categoryId', '==', categoryId)
    .where('available', '==', true)
    .get();
  return snap.docs.map(d => {
    const data = d.data() as any;
    return {
      id: d.id,
      ...data,
      image: data.image || data.imageUrl || data.imageURL || '',
    } as MenuItem;
  });
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
      snap => onData(snap.docs.map(d => {
        const data = d.data() as any;
        return { id: d.id, ...data, image: data.image || data.imageUrl || data.imageURL || '' };
      })),
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
  return snap.docs.map(d => {
    const data = d.data() as any;
    return {
      id: d.id,
      ...data,
      image: data.image || data.imageUrl || data.imageURL || '',
    } as MenuAddon;
  });
}

/** Fetch addons for a specific menu item */
export async function getAddonsByMenuItem(menuItemId: string): Promise<MenuAddon[]> {
  const snap = await firestore()
    .collection('restaurant_menuAddons')
    .where('menuItemId', '==', menuItemId)
    .where('available', '==', true)
    .get();
  return snap.docs.map(d => {
    const data = d.data() as any;
    return {
      id: d.id,
      ...data,
      image: data.image || data.imageUrl || data.imageURL || '',
    } as MenuAddon;
  });
}

/** Fetch all category IDs that have at least one available menu item */
export async function getActiveCategoryIds(): Promise<Set<string>> {
  const snap = await firestore()
    .collection('restaurant_menu')
    .where('available', '==', true)
    .get();
  const ids = new Set<string>();
  snap.docs.forEach(d => {
    const catId = d.data().categoryId;
    if (catId) ids.add(catId);
  });
  return ids;
}

/** Real-time listener for all active food categories that have at least one available menu item */
export function listenFoodCategoriesWithItems(
  onData: (categories: FoodCategory[]) => void,
  onError?: (e: Error) => void
) {
  // Listen to menu items to get active category IDs
  let activeCategories: FoodCategory[] = [];
  let activeCategoryIds: Set<string> = new Set();

  const unsubMenu = firestore()
    .collection('restaurant_menu')
    .where('available', '==', true)
    .onSnapshot(menuSnap => {
      activeCategoryIds = new Set<string>();
      menuSnap.docs.forEach(d => {
        const catId = d.data().categoryId;
        if (catId) activeCategoryIds.add(catId);
      });
      // Re-filter categories with updated active IDs
      onData(activeCategories.filter(c => activeCategoryIds.has(c.id)));
    }, onError);

  const unsubCats = firestore()
    .collection('restaurant_categories')
    .where('isActive', '==', true)
    .onSnapshot(catSnap => {
      activeCategories = catSnap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<FoodCategory, 'id'>) }));
      // Filter to only categories that have menu items
      onData(activeCategories.filter(c => activeCategoryIds.has(c.id)));
    }, onError);

  return () => { unsubMenu(); unsubCats(); };
}

// ─── Offer Queries ────────────────────────────────────────────────────────────

/** Fetch all active offers for a specific restaurant */
export async function getOffersByRestaurant(restaurantId: string): Promise<RestaurantOffer[]> {
  const snap = await firestore()
    .collection('restaurant_offers')
    .where('restaurantId', '==', restaurantId)
    .get();
  return snap.docs
    .map(d => ({ id: d.id, ...(d.data() as Omit<RestaurantOffer, 'id'>) }))
    .filter(o => o.active === true);
}

/** Real-time listener for ALL active offers across all restaurants */
export function listenAllOffers(
  onData: (offers: RestaurantOffer[]) => void,
  onError?: (e: Error) => void
) {
  return firestore()
    .collection('restaurant_offers')
    .onSnapshot(
      snap => onData(
        snap.docs
          .map(d => ({ id: d.id, ...(d.data() as Omit<RestaurantOffer, 'id'>) }))
          .filter(o => o.active === true)
      ),
      onError
    );
}

/** Real-time listener for active offers of a restaurant */
export function listenOffersByRestaurant(
  restaurantId: string,
  onData: (offers: RestaurantOffer[]) => void,
  onError?: (e: Error) => void
) {
  return firestore()
    .collection('restaurant_offers')
    .where('restaurantId', '==', restaurantId)
    .onSnapshot(
      snap => onData(
        snap.docs
          .map(d => ({ id: d.id, ...(d.data() as Omit<RestaurantOffer, 'id'>) }))
          .filter(o => o.active === true)
      ),
      onError
    );
}

/** Real-time listener for all available menu items across all restaurants */
export function listenAllMenuItems(
  onData: (items: MenuItem[]) => void,
  onError?: (e: Error) => void
) {
  return firestore()
    .collection('restaurant_menu')
    .where('available', '==', true)
    .onSnapshot(
      snap => onData(snap.docs.map(d => {
        const data = d.data() as any;
        return { id: d.id, ...data, image: data.image || data.imageUrl || data.imageURL || '' };
      })),
      onError
    );
}
