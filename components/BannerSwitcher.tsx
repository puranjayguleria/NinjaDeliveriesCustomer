// components/BannerSwitcher.tsx

import React, { useEffect, useState } from "react";
import { View, StyleSheet, Text } from "react-native";
import firestore from "@react-native-firebase/firestore";
import QuizBanner from "./QuizBanner";
import SliderBanner from "./SliderBanner";
import SalesBanner from "./SalesBanner";
import Loader from "./VideoLoader";

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
    return (
      <View style={styles.container}>
        <Loader />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (
    !bannerConfig ||
    (!bannerConfig.showQuiz &&
      !bannerConfig.showSliderBanner &&
      !bannerConfig.showSales)
  ) {
    return null; // No banners to show, avoid rendering space
  }

  return (
    <View style={styles.container}>
      {bannerConfig.showQuiz && <QuizBanner storeId={storeId} />}
      {bannerConfig.showSliderBanner && <SliderBanner storeId={storeId} />}
      {bannerConfig.showSales && <SalesBanner storeId={storeId} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  errorText: {
    color: "red",
    textAlign: "center",
    padding: 8,
  },
});

export default BannerSwitcher;
