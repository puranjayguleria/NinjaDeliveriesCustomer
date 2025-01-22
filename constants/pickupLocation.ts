// constants/pickupLocation.ts

export interface Coordinates {
    latitude: number;
    longitude: number;
  }
  
  export interface PickupLocation {
    name: string;
    address: string;
    coordinates: Coordinates;
  }
  
  export const FIXED_PICKUP_LOCATION: PickupLocation = {
    name: "Central Cold Storage",
    address: "123 Main Street, City, Country",
    coordinates: {
      latitude: 31.1048, // Replace with actual latitude
      longitude: 77.1734, // Replace with actual longitude
    },
  };
  