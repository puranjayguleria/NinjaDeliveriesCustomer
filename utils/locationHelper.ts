// utils/locationHelper.ts
import { LocationData } from '../context/LocationContext';

/**
 * Initialize location with default cityId for restaurant functionality
 */
export const initializeLocationForRestaurants = (location: LocationData): LocationData => {
  // If cityId is not set, default to dharamshala for development
  if (!location.cityId) {
    return {
      ...location,
      cityId: 'dharamshala',
    };
  }
  return location;
};

/**
 * Check if location is ready for restaurant queries
 */
export const isLocationReadyForRestaurants = (location: LocationData): boolean => {
  return !!(location.cityId || location.storeId);
};

/**
 * Get effective city ID for restaurant queries
 */
export const getEffectiveCityId = (location: LocationData): string => {
  return location.cityId || 'dharamshala';
};