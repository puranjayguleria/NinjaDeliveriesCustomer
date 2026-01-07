// utils/firestoreCache.ts
// Simple in-memory cache for Firestore data to improve performance

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class FirestoreCache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    const now = Date.now();
    const isExpired = (now - entry.timestamp) > entry.ttl;

    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    const now = Date.now();
    const isExpired = (now - entry.timestamp) > entry.ttl;

    if (isExpired) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  clear(): void {
    this.cache.clear();
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  // Clean up expired entries
  cleanup(): void {
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      const isExpired = (now - entry.timestamp) > entry.ttl;
      if (isExpired) {
        this.cache.delete(key);
      }
    }
  }
}

// Singleton instance
export const firestoreCache = new FirestoreCache();

// Auto cleanup every 10 minutes
setInterval(() => {
  firestoreCache.cleanup();
}, 10 * 60 * 1000);

// Cache keys
export const CACHE_KEYS = {
  CUISINES: 'cuisines',
  RESTAURANTS: (cityId: string) => `restaurants_${cityId}`,
  RESTAURANT_DETAILS: (id: string) => `restaurant_${id}`,
  MENU_ITEMS: (restaurantId: string) => `menu_${restaurantId}`,
} as const;