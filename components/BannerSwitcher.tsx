// components/BannerSwitcher.tsx

import React, { useEffect, useState } from "react";
import { View, StyleSheet, Text } from "react-native";
import firestore from "@react-native-firebase/firestore";
import QuizBanner from "./QuizBanner";
import SliderBanner from "./SliderBanner";
import SalesBanner from "./SalesBanner";
import Loader from "./VideoLoader";
import ValentineBanner from "./ValentineBanner";
import RoseBouquetBanner from "./RoseBouquetBanner";
import ValentineSpecialSection from "./ValentineSpecialSection";

interface BannerSwitcherProps {
  storeId: string;
}

interface ZBanner {
  name: string;
  enabled: boolean;
  imageUrl: string;
}

const BannerSwitcher: React.FC<BannerSwitcherProps> = ({ storeId }) => {
  const [bannerConfig, setBannerConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // z_banners state
  const [showValentineBanner, setShowValentineBanner] = useState(false);
  const [showRoseBouquetBanner, setShowRoseBouquetBanner] = useState(false);

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

  // Fetch z_banners to check enabled status
  useEffect(() => {
    const unsubscribe = firestore()
      .collection("z_banners")
      .where("storeId", "==", storeId)
      .onSnapshot(
        (querySnapshot) => {
          querySnapshot.docs.forEach((doc) => {
            const data = doc.data() as ZBanner;
            
            if (data.name === "Valentine Sale") {
              setShowValentineBanner(data.enabled === true);
            }
            if (data.name === "Rose Bouquet") {
              setShowRoseBouquetBanner(data.enabled === true);
            }
          });
        },
        (err) => {
          console.error("Error fetching z_banners:", err);
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

  const showOthers = bannerConfig && (bannerConfig.showQuiz || bannerConfig.showSliderBanner || bannerConfig.showSales);

  return (
    <View style={styles.container}>
      {showValentineBanner && <ValentineBanner storeId={storeId} />}
      {showRoseBouquetBanner && <RoseBouquetBanner storeId={storeId} />}
      {/* {bannerConfig?.showQuiz && <QuizBanner storeId={storeId} />} */}
      {bannerConfig?.showSliderBanner && <SliderBanner storeId={storeId} />}
      <ValentineSpecialSection storeId={storeId} />
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
