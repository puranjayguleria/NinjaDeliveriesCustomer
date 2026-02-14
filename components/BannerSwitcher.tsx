// components/BannerSwitcher.tsx

import React, { useEffect, useState } from "react";
import { View, StyleSheet, Text } from "react-native";
import firestore from "@react-native-firebase/firestore";
import SliderBanner from "./SliderBanner";
import SalesBanner from "./SalesBanner";

interface BannerSwitcherProps {
  storeId: string;
}

const BannerSwitcher: React.FC<BannerSwitcherProps> = ({ storeId }) => {
  const [bannerConfig, setBannerConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = firestore()
      .collection("banner")
      .where("storeId", "==", storeId)
      .limit(1)
      .onSnapshot(
        (querySnapshot) => {
          if (!querySnapshot.empty) {
            const doc = querySnapshot.docs[0];
            setBannerConfig(doc.data());
          } else {
            setError("No banner configuration found for this store");
          }
          setLoading(false);
        },
        (err) => {
          setError(err.message);
          setLoading(false);
        }
      );

    return () => unsubscribe();
  }, [storeId]);

  if (loading) {
    return <View style={styles.container}></View>;
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Other banners - always shown */}
      {bannerConfig?.showSliderBanner && <SliderBanner storeId={storeId} />}
      {bannerConfig?.showSales && <SalesBanner storeId={storeId} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 0,
  },
  errorText: {
    color: "red",
    textAlign: "center",
    padding: 8,
  },
});

export default BannerSwitcher;
