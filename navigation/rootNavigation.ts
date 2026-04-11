import { createNavigationContainerRef } from "@react-navigation/native";

// Root navigation ref to allow navigation from places that aren't inside a screen
// (e.g. global modals rendered above navigators).
export const navigationRef = createNavigationContainerRef<any>();

let lastNonCartTabName: string | null = null;

export function setLastNonCartTab(name: string | null) {
  lastNonCartTabName = name;
}

export function getLastNonCartTab() {
  return lastNonCartTabName;
}

export function navigate(name: string, params?: any) {
  if (navigationRef.isReady()) {
    (navigationRef.navigate as any)(name, params);
  }
}

/**
 * Navigate to home safely — uses HomeTab if it exists (grocery enabled),
 * otherwise falls back to CartFlow (services-only mode).
 */
export function navigateHome(params?: { screen?: string; params?: any }) {
  if (!navigationRef.isReady()) return;
  const state = navigationRef.getRootState?.();
  const allRouteNames: string[] = [];
  const collect = (s: any) => {
    if (!s) return;
    (s.routeNames ?? []).forEach((n: string) => allRouteNames.push(n));
    (s.routes ?? []).forEach((r: any) => collect(r.state));
  };
  collect(state);

  if (allRouteNames.includes('HomeTab')) {
    (navigationRef.navigate as any)('HomeTab', params);
  } else {
    // Grocery is off — CartFlow is the root, ServicesHome is inside it
    (navigationRef.navigate as any)('CartFlow', { screen: 'ServicesHome' });
  }
}
