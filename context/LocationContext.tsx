import React, { createContext, useState, useContext } from "react";

type LocationData = {
  lat: number | null;
  lng: number | null;
  address: string;
};

// We’ll define the shape of our Context
type LocationContextType = {
  location: LocationData;
  updateLocation: (locationData: LocationData) => void;
  clearLocation: () => void;
};

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // State for location
  const [location, setLocation] = useState<LocationData>({
    lat: null,
    lng: null,
    address: "",
  });

  // Update location
  const updateLocation = (locationData: LocationData) => {
    setLocation(locationData);
  };

  // Clear location if needed
  const clearLocation = () => {
    setLocation({ lat: null, lng: null, address: "" });
  };

  return (
    <LocationContext.Provider value={{ location, updateLocation, clearLocation }}>
      {children}
    </LocationContext.Provider>
  );
};

// Custom hook to use the context
export const useLocationContext = (): LocationContextType => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error("useLocationContext must be used within a LocationProvider");
  }
  return context;
};
