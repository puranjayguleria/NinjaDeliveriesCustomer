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
  enableValentineUI?: boolean;
}

interface ZBanner {
  name: string;
  enabled: boolean;
  imageUrl: string;
}

const BannerSwitcher: React.FC<BannerSwitcherProps> = ({ storeId, enableValentineUI = true }) => {
  const [bannerConfig, setBannerConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // z_banners state
  const [showValentineBanner, setShowValentineBanner] = useState(false);
  const [showRoseBouquetBanner, setShowRoseBouquetBanner] = useState(false);
  const [valentineBannerUrl, setValentineBannerUrl] = useState<string | null>(null);
  const [roseBouquetBannerUrl, setRoseBouquetBannerUrl] = useState<string | null>(null);

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
          let valEnabled = false;
          let valUrl: string | null = null;
          let roseEnabled = false;
          let roseUrl: string | null = null;

          querySnapshot.docs.forEach((doc) => {
            const data = doc.data() as ZBanner;

            if (data.name === "Valentine Sale") {
              valEnabled = data.enabled === true;
              valUrl =
                typeof data.imageUrl === "string"
                  ? data.imageUrl.replace(/`/g, "").trim()
                  : null;
            }
            if (data.name === "Rose Bouquet") {
              roseEnabled = data.enabled === true;
              roseUrl =
                typeof data.imageUrl === "string"
                  ? data.imageUrl.replace(/`/g, "").trim()
                  : null;
            }
          });

          setShowValentineBanner(valEnabled);
          setValentineBannerUrl(valUrl);
          setShowRoseBouquetBanner(roseEnabled);
          setRoseBouquetBannerUrl(roseUrl);
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

  return (
    <View style={styles.container}>
      {/* Valentine sections - controlled by enableValentineUI flag */}
      {enableValentineUI && showValentineBanner && (
        <ValentineBanner imageUrl={valentineBannerUrl} />
      )}
      {enableValentineUI && showRoseBouquetBanner && (
        <RoseBouquetBanner imageUrl={roseBouquetBannerUrl} />
      )}
      {enableValentineUI && <ValentineSpecialSection storeId={storeId} />}

      {/* Other banners */}
      {bannerConfig?.showQuiz && <QuizBanner storeId={storeId} />}
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
