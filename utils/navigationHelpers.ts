/**
 * Navigation Helper Utilities
 * 
 * These helpers ensure safe navigation when HomeTab may not be available
 * (e.g., when grocery service is disabled for a location)
 */

import { navigationRef } from '../navigation/rootNavigation';

/**
 * Check if a specific route exists in the navigation tree
 */
export function isRouteAvailable(routeName: string): boolean {
  if (!navigationRef.isReady()) return false;
  
  const state = navigationRef.getRootState?.();
  const allRouteNames: string[] = [];
  
  const collect = (s: any) => {
    if (!s) return;
    (s.routeNames ?? []).forEach((n: string) => allRouteNames.push(n));
    (s.routes ?? []).forEach((r: any) => collect(r.state));
  };
  
  collect(state);
  return allRouteNames.includes(routeName);
}

/**
 * Safely navigate to HomeTab or fallback to ServicesHome
 */
export function safeNavigateToHome(navigation: any, params?: any) {
  if (isRouteAvailable('HomeTab')) {
    try {
      navigation.navigate('HomeTab', params);
    } catch (error) {
      console.warn('[Navigation] Failed to navigate to HomeTab:', error);
      navigation.navigate('CartFlow', { screen: 'ServicesHome' });
    }
  } else {
    // HomeTab doesn't exist (grocery disabled), go to services
    navigation.navigate('CartFlow', { screen: 'ServicesHome' });
  }
}

/**
 * Safely navigate to HomeTab using root navigation ref
 */
export function safeNavigateToHomeRoot(params?: any) {
  if (!navigationRef.isReady()) return;
  
  if (isRouteAvailable('HomeTab')) {
    try {
      (navigationRef.navigate as any)('HomeTab', params);
    } catch (error) {
      console.warn('[Navigation] Failed to navigate to HomeTab:', error);
      (navigationRef.navigate as any)('CartFlow', { screen: 'ServicesHome' });
    }
  } else {
    // HomeTab doesn't exist (grocery disabled), go to services
    (navigationRef.navigate as any)('CartFlow', { screen: 'ServicesHome' });
  }
}

/**
 * Safely navigate to AppTabs with HomeTab screen
 */
export function safeNavigateToAppTabsHome(navigation: any, params?: any) {
  if (isRouteAvailable('HomeTab')) {
    try {
      navigation.navigate('AppTabs', { screen: 'HomeTab', params });
    } catch (error) {
      console.warn('[Navigation] Failed to navigate to AppTabs > HomeTab:', error);
      navigation.navigate('CartFlow', { screen: 'ServicesHome' });
    }
  } else {
    // HomeTab doesn't exist (grocery disabled), go to services
    navigation.navigate('CartFlow', { screen: 'ServicesHome' });
  }
}
