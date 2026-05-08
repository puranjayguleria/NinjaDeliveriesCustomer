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
  coverImage?: string;          // Cover image for restaurant banner
  description?: string;         // Restaurant description
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

export type MenuPhase = {
  id: string;
  addonIds: string[];
  createdAt: any;
  daysActive: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  };
  enabled: boolean;
  endTime: string;
  startTime?: string;
  menuItemIds?: {
    phase: 'breakfast' | 'lunch' | 'dinner' | 'snacks';
    restaurantId: string;
    startTime: string;
    updatedAt: any;
  };
  items?: MenuItem[];
};

export type RestaurantSuggestion = {
  id: string;
  restaurantId: string;
  itemIds: string[];
  addonIds: string[];
  suggestionMap: Record<string, string[]>;
  updatedAt?: any;
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

// ─── Menu Phases Queries ──────────────────────────────────────────────────────

/** Fetch all menu phases (Live Kitchen data) */
export async function getAllMenuPhases(): Promise<MenuPhase[]> {
  const snap = await firestore()
    .collection('restaurant_menu_phases')
    .get();
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<MenuPhase, 'id'>) }));
}

/** Fetch menu phase for a specific restaurant */
export async function getMenuPhaseByRestaurant(restaurantId: string): Promise<MenuPhase | null> {
  const doc = await firestore()
    .collection('restaurant_menu_phases')
    .doc(restaurantId)
    .get();
  if (!doc.exists) return null;
  return { id: doc.id, ...(doc.data() as Omit<MenuPhase, 'id'>) };
}

/** Real-time listener for all menu phases */
export function listenAllMenuPhases(
  onData: (phases: MenuPhase[]) => void,
  onError?: (e: Error) => void
) {
  return firestore()
    .collection('restaurant_menu_phases')
    .onSnapshot(
      snap => onData(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<MenuPhase, 'id'>) }))),
      onError
    );
}

/** Real-time listener for a specific restaurant's menu phase */
export function listenMenuPhaseByRestaurant(
  restaurantId: string,
  onData: (phase: MenuPhase | null) => void,
  onError?: (e: Error) => void
) {
  return firestore()
    .collection('restaurant_menu_phases')
    .doc(restaurantId)
    .onSnapshot(
      doc => {
        if (!doc.exists) {
          onData(null);
        } else {
          onData({ id: doc.id, ...(doc.data() as Omit<MenuPhase, 'id'>) });
        }
      },
      onError
    );
}

/** Fetch enabled menu phases filtered by meal type */
export async function getMenuPhasesByMealType(
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snacks'
): Promise<MenuPhase[]> {
  const snap = await firestore()
    .collection('restaurant_menu_phases')
    .where('enabled', '==', true)
    .get();
  
  return snap.docs
    .map(d => ({ id: d.id, ...(d.data() as Omit<MenuPhase, 'id'>) }))
    .filter(phase => phase.menuItemIds?.phase === mealType);
}

// ─── Suggestions Queries ──────────────────────────────────────────────────────

/** Fetch suggestions for a specific restaurant */
export async function getSuggestionsByRestaurant(restaurantId: string): Promise<RestaurantSuggestion | null> {
  const doc = await firestore()
    .collection('restaurant_suggestions')
    .doc(restaurantId)
    .get();
  if (!doc.exists) return null;
  return { id: doc.id, ...(doc.data() as Omit<RestaurantSuggestion, 'id'>) };
}

/** Real-time listener for restaurant suggestions */
export function listenSuggestionsByRestaurant(
  restaurantId: string,
  onData: (suggestion: RestaurantSuggestion | null) => void,
  onError?: (e: Error) => void
) {
  return firestore()
    .collection('restaurant_suggestions')
    .doc(restaurantId)
    .onSnapshot(
      doc => {
        if (!doc.exists) {
          onData(null);
        } else {
          onData({ id: doc.id, ...(doc.data() as Omit<RestaurantSuggestion, 'id'>) });
        }
      },
      onError
    );
}

// ─── Enhanced Addon Queries ───────────────────────────────────────────────────

/** Fetch addons by multiple addon IDs */
export async function getAddonsByIds(addonIds: string[]): Promise<MenuAddon[]> {
  if (addonIds.length === 0) return [];
  
  // Firestore 'in' query supports max 10 items, so batch if needed
  const batches: string[][] = [];
  for (let i = 0; i < addonIds.length; i += 10) {
    batches.push(addonIds.slice(i, i + 10));
  }
  
  const results: MenuAddon[] = [];
  for (const batch of batches) {
    const snap = await firestore()
      .collection('restaurant_menuAddons')
      .where(firestore.FieldPath.documentId(), 'in', batch)
      .get();
    
    snap.docs.forEach(d => {
      const data = d.data() as any;
      results.push({
        id: d.id,
        ...data,
        image: data.image || data.imageUrl || data.imageURL || '',
      } as MenuAddon);
    });
  }
  
  return results;
}

/** Real-time listener for addons by restaurant */
export function listenAddonsByRestaurant(
  restaurantId: string,
  onData: (addons: MenuAddon[]) => void,
  onError?: (e: Error) => void
) {
  return firestore()
    .collection('restaurant_menuAddons')
    .where('restaurantId', '==', restaurantId)
    .where('available', '==', true)
    .onSnapshot(
      snap => onData(snap.docs.map(d => {
        const data = d.data() as any;
        return {
          id: d.id,
          ...data,
          image: data.image || data.imageUrl || data.imageURL || '',
        } as MenuAddon;
      })),
      onError
    );
}

// ─── Enhanced Offer Queries ───────────────────────────────────────────────────

/** Fetch offer for a specific menu item */
export async function getOfferByMenuItem(menuItemId: string): Promise<RestaurantOffer | null> {
  const snap = await firestore()
    .collection('restaurant_offers')
    .where('menuItemId', '==', menuItemId)
    .where('active', '==', true)
    .limit(1)
    .get();
  
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...(doc.data() as Omit<RestaurantOffer, 'id'>) };
}

/** Fetch multiple offers by menu item IDs */
export async function getOffersByMenuItemIds(menuItemIds: string[]): Promise<Map<string, RestaurantOffer>> {
  if (menuItemIds.length === 0) return new Map();
  
  const batches: string[][] = [];
  for (let i = 0; i < menuItemIds.length; i += 10) {
    batches.push(menuItemIds.slice(i, i + 10));
  }
  
  const offerMap = new Map<string, RestaurantOffer>();
  
  for (const batch of batches) {
    const snap = await firestore()
      .collection('restaurant_offers')
      .where('menuItemId', 'in', batch)
      .where('active', '==', true)
      .get();
    
    snap.docs.forEach(d => {
      const offer = { id: d.id, ...(d.data() as Omit<RestaurantOffer, 'id'>) };
      offerMap.set(offer.menuItemId, offer);
    });
  }
  
  return offerMap;
}

// ─── Combined Data Queries ────────────────────────────────────────────────────

/** Fetch complete restaurant data with menu, addons, offers, and phase */
export async function getCompleteRestaurantData(restaurantId: string) {
  const [restaurant, menu, addons, offers, phase, suggestions] = await Promise.all([
    getRestaurantById(restaurantId),
    getMenuByRestaurant(restaurantId),
    getAddonsByRestaurant(restaurantId),
    getOffersByRestaurant(restaurantId),
    getMenuPhaseByRestaurant(restaurantId),
    getSuggestionsByRestaurant(restaurantId),
  ]);
  
  return {
    restaurant,
    menu,
    addons,
    offers,
    phase,
    suggestions,
  };
}

/** Fetch menu items with their associated offers */
export async function getMenuWithOffers(restaurantId: string) {
  const menu = await getMenuByRestaurant(restaurantId);
  const menuItemIds = menu.map(item => item.id);
  const offerMap = await getOffersByMenuItemIds(menuItemIds);
  
  return menu.map(item => ({
    ...item,
    offer: offerMap.get(item.id) || null,
  }));
}

// ─── Live Kitchen Queries ─────────────────────────────────────────────────────

export type LiveKitchenData = {
  id: string;
  name: string;
  restaurantName?: string;
  ownerName?: string;
  phone?: string;
  email?: string;
  photo?: string;
  profileImage?: string;
  coverImage?: string;
  description?: string;
  address?: string;
  area?: string;
  rating?: number;
  totalOrders?: number;
  isActive: boolean;
  access?: boolean;
  accountEnabled?: boolean;
  role?: string;
  type?: string;
  tags?: string[];
  createdAt?: any;
  updatedAt?: any;
  menuPhases: MenuPhase[];
  activePhase?: MenuPhase | null;
};

/** Fetch all restaurants with menu_phases role and their phases */
export async function getLiveKitchens(): Promise<LiveKitchenData[]> {
  try {
    // Fetch restaurants with menu_phases role
    const restaurantsSnapshot = await firestore()
      .collection('registerRestaurant')
      .where('role', '==', 'menu_phases')
      .where('isActive', '==', true)
      .where('accountEnabled', '==', true)
      .get();

    if (restaurantsSnapshot.empty) {
      return [];
    }

    // Fetch all menu phases
    const allPhases = await getAllMenuPhases();

    // Map restaurants with their phases
    const kitchens: LiveKitchenData[] = [];

    for (const doc of restaurantsSnapshot.docs) {
      const restaurantId = doc.id;
      const restaurant = doc.data();

      // Filter phases that belong to this restaurant
      const restaurantPhases = allPhases.filter(phase => {
        const phaseId = phase.id;
        const phaseRestaurantId = phase.menuItemIds?.restaurantId;
        
        return (
          phaseId === restaurantId || 
          phaseId.startsWith(`${restaurantId}_`) ||
          phaseRestaurantId === restaurantId ||
          (phase as any).restaurantId === restaurantId
        );
      });

      // Only include restaurants that have at least one phase
      if (restaurantPhases.length > 0) {
        kitchens.push({
          id: restaurantId,
          name: restaurant.restaurantName || 'Restaurant',
          restaurantName: restaurant.restaurantName,
          ownerName: restaurant.ownerName,
          phone: restaurant.phone,
          email: restaurant.email,
          address: restaurant.address,
          area: restaurant.area,
          photo: restaurant.image,
          profileImage: restaurant.profileImage || restaurant.image,
          coverImage: restaurant.coverImage,
          description: restaurant.description,
          isActive: restaurant.isActive,
          access: restaurant.access,
          accountEnabled: restaurant.accountEnabled,
          role: restaurant.role,
          type: restaurant.type || 'restaurant',
          rating: restaurant.rating || 4.0,
          totalOrders: restaurant.totalOrders || 0,
          tags: restaurant.tags || [],
          createdAt: restaurant.createdAt,
          updatedAt: restaurant.updatedAt,
          menuPhases: restaurantPhases,
          activePhase: null, // Will be set by the caller based on current time
        });
      }
    }

    return kitchens;
  } catch (error) {
    console.error('[foodFirebase] Error fetching live kitchens:', error);
    return [];
  }
}

/** Real-time listener for live kitchens */
export function listenLiveKitchens(
  onData: (kitchens: LiveKitchenData[]) => void,
  onError?: (e: Error) => void
) {
  // Listen to restaurants
  const unsubRestaurants = firestore()
    .collection('registerRestaurant')
    .where('role', '==', 'menu_phases')
    .where('isActive', '==', true)
    .where('accountEnabled', '==', true)
    .onSnapshot(
      async (restaurantsSnapshot) => {
        try {
          if (restaurantsSnapshot.empty) {
            onData([]);
            return;
          }

          // Fetch all menu phases
          const allPhases = await getAllMenuPhases();

          // Map restaurants with their phases
          const kitchens: LiveKitchenData[] = [];

          for (const doc of restaurantsSnapshot.docs) {
            const restaurantId = doc.id;
            const restaurant = doc.data();

            // Filter phases that belong to this restaurant
            const restaurantPhases = allPhases.filter(phase => {
              const phaseId = phase.id;
              const phaseRestaurantId = phase.menuItemIds?.restaurantId;
              
              return (
                phaseId === restaurantId || 
                phaseId.startsWith(`${restaurantId}_`) ||
                phaseRestaurantId === restaurantId ||
                (phase as any).restaurantId === restaurantId
              );
            });

            // Only include restaurants that have at least one phase
            if (restaurantPhases.length > 0) {
              kitchens.push({
                id: restaurantId,
                name: restaurant.restaurantName || 'Restaurant',
                restaurantName: restaurant.restaurantName,
                ownerName: restaurant.ownerName,
                phone: restaurant.phone,
                email: restaurant.email,
                address: restaurant.address,
                area: restaurant.area,
                photo: restaurant.image,
                profileImage: restaurant.profileImage || restaurant.image,
                coverImage: restaurant.coverImage,
                description: restaurant.description,
                isActive: restaurant.isActive,
                access: restaurant.access,
                accountEnabled: restaurant.accountEnabled,
                role: restaurant.role,
                type: restaurant.type || 'restaurant',
                rating: restaurant.rating || 4.0,
                totalOrders: restaurant.totalOrders || 0,
                tags: restaurant.tags || [],
                createdAt: restaurant.createdAt,
                updatedAt: restaurant.updatedAt,
                menuPhases: restaurantPhases,
                activePhase: null,
              });
            }
          }

          onData(kitchens);
        } catch (error) {
          if (onError) onError(error as Error);
        }
      },
      onError
    );

  return unsubRestaurants;
}
