// context/WeatherContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { getGoogleWeatherData } from "../utils/weatherApi";
import { isBadWeather } from "../utils/weatherLogic";
import { useLocationContext } from "./LocationContext";
import firestore from "@react-native-firebase/firestore";
import { GOOGLE_PLACES_API_KEY } from "@env";

type WeatherContextType = {
  weatherData: any | null;
  isBadWeather: boolean;
  weatherFromApi : boolean;
  refreshWeather: () => Promise<void>;
};

const WeatherContext = createContext<WeatherContextType>({
  weatherData: null,
  isBadWeather: false,
  refreshWeather: async () => {},
});

export const useWeather = () => useContext(WeatherContext);

export const WeatherProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { location } = useLocationContext();
  const [weatherData, setWeatherData] = useState<any | null>(null);
  const [isBad, setIsBad] = useState(false);

  const refreshWeather = async () => {
    try {
      if (!location.lat || !location.lng || !location.storeId) return;

      // 1️⃣ Get weather from Google API
      const data = await getGoogleWeatherData(
        location.lat,
        location.lng,
        GOOGLE_PLACES_API_KEY
      );

      // 2️⃣ Query Firestore orderSetting where storeId == current storeId
      const querySnap = await firestore()
        .collection("orderSetting")
        .where("storeId", "==", location.storeId)
        .limit(1)
        .get();

   let threshold = false;
let weatherFromApi = true;

if (!querySnap.empty && querySnap.docs[0].exists) {
  const setting = querySnap.docs[0].data();
  threshold = setting?.badWeather === true;
  weatherFromApi = setting?.weatherFromApi ?? false;
}

// 3️⃣ Check if it's bad weather (with extra param)
const bad = isBadWeather(data, threshold, weatherFromApi);

      setWeatherData(data);
      setIsBad(bad);
    } catch (err) {
      console.error("[WeatherContext]", err);
    }
  };

  useEffect(() => {
    refreshWeather();
  }, [location.lat, location.lng, location.storeId]);

  return (
    <WeatherContext.Provider
      value={{ weatherData, isBadWeather: isBad, refreshWeather }}
    >
      {children}
    </WeatherContext.Provider>
  );
};
