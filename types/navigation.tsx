// Navigation types for the app

export type LocationData = {
  lat: number | null;
  lng: number | null;
  address: string;
  storeId?: string | null;
  houseNo?: string;
  placeLabel?: string;
  grocery?: boolean;
  services?: boolean;
  food?: boolean;
};

export type RootStackParamList = {
  AppTabs: { screen?: string; params?: any } | undefined;
  LocationSelector: { fromScreen?: string } | undefined;
  ProductsHome: undefined;
  CategoriesTab: { selectedLocation?: LocationData } | undefined;
  CartFlow: {
    screen: string;
    params?: { selectedLocation?: LocationData };
  } | undefined;
  HomeTab: undefined;
  // Add other routes as needed
};
