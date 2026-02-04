import React, { useEffect, useState } from "react";
import { View, Pressable, StyleSheet, Dimensions, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import firestore from '@react-native-firebase/firestore';

const { width } = Dimensions.get("window");
const H = 16;
const PLACEHOLDER_BLURHASH = "LKO2?U%2Tw=w]~RBVZRi};ofM{ay";

interface RoseBouquetBannerProps {
  storeId: string;
}

const RoseBouquetBanner: React.FC<RoseBouquetBannerProps> = ({ storeId }) => {
  const navigation = useNavigation<any>();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeId) {
      setLoading(false);
      return;
    }

    const fetchBanner = async () => {
      try {
        const snapshot = await firestore()
          .collection('z_banners')
          .where('name', '==', 'Rose Bouquet')
          .where('enabled', '==', true)
          .where('storeId', '==', storeId)
          .limit(1)
          .get();

        if (!snapshot.empty) {
          const data = snapshot.docs[0].data();
          setImageUrl(data.imageUrl);
        }
      } catch (error) {
        console.error('Error fetching bouquet banner:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBanner();
  }, [storeId]);

  const handlePress = () => {
    navigation.navigate("MakeBouquetScreen");
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#E91E63" />
      </View>
    );
  }

  if (!imageUrl) return null;

  return (
    <View style={styles.container}>
      <Pressable onPress={handlePress} style={styles.pressable}>
        <Image
          source={{ uri: imageUrl }}
          style={styles.banner}
          contentFit="cover"
          placeholder={{ blurhash: PLACEHOLDER_BLURHASH }}
          cachePolicy="disk"
          transition={200}
        />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: H,
    marginBottom: 16,
    alignItems: "center",
  },
  loadingContainer: {
    paddingVertical: 30,
    alignItems: "center",
  },
  pressable: {
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
  },
  banner: {
    width: "100%",
    height: width * 0.30,
    borderRadius: 12,
  },
});

export default RoseBouquetBanner;