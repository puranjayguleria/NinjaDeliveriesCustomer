// context/LocationContext.tsx
import React, { createContext, useContext, useState } from 'react';
import { findNearestStore } from '../utils/findNearestStore';

export type LocationData = {
  lat: number | null;
  lng: number | null;
  address: string;
  storeId: string | null;
  houseNo?: string;
  placeLabel?: string;
  surge?: {
        active: boolean;
        fee: number;      
      };
};

type LocationContextType = {
  location: LocationData;
  updateLocation: (loc: Partial<LocationData>) => void;
  clearLocation: () => void;
  setStoreId: (id: string) => void;
  setSurge: (s: { active: boolean; fee: number }) => void;
};

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider: React.FC<{children:React.ReactNode}> = ({children})=>{
  const [location, setLocation] = useState<LocationData>({
    lat:null, lng:null, address:'', storeId:null, surge:{ active:false, fee:0 }
  });

  /** called from CategoriesScreen once we know the zone */
  const setStoreId = (id:string)=>{
    setLocation(prev=>({...prev, storeId:id}));
  };

  const updateLocation = (loc: Partial<LocationData>) => {
    setLocation(prev => ({
      ...prev,
      ...loc,
      // preserve current id if caller did not supply one
      storeId: loc.storeId !== undefined ? loc.storeId : prev.storeId,
    }));
  };
  const clearLocation = ()=> setLocation({lat:null,lng:null,address:'',storeId:null});
 /** called by CategoriesScreen after weather evaluation */
   const setSurge = (s:{active:boolean;fee:number}) =>
      setLocation(prev=>({ ...prev, surge:s }));
  return (
  <LocationContext.Provider value={{location,updateLocation,clearLocation,setStoreId,setSurge}}>
    {children}
    </LocationContext.Provider>
  );
};
export const useLocationContext = () => {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('Must be used inside <LocationProvider>');
  return ctx;
};
