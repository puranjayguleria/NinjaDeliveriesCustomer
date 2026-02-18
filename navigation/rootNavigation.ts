import { createNavigationContainerRef } from "@react-navigation/native";

// Root navigation ref to allow navigation from places that aren't inside a screen
// (e.g. global modals rendered above navigators).
export const navigationRef = createNavigationContainerRef<any>();

export function navigate(name: string, params?: any) {
  if (navigationRef.isReady()) {
    (navigationRef.navigate as any)(name, params);
  }
}
