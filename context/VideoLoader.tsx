// VideoLoaderContext.tsx
import React, { createContext, useContext, useState, useEffect } from "react";
import firestore from "@react-native-firebase/firestore";

const VideoLoaderContext = createContext<string | null>(null);

export const VideoLoaderProvider = ({ children }) => {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const doc = await firestore()
        .collection("company")
        .doc("cgwqfmBd4GDEFv4lUsHX")
        .get();
      const url = doc.data()?.loader;
      if (url) setVideoUrl(url);
    };
    fetch();
  }, []);

  return (
    <VideoLoaderContext.Provider value={videoUrl}>
      {children}
    </VideoLoaderContext.Provider>
  );
};

export const useVideoLoader = () => useContext(VideoLoaderContext);
