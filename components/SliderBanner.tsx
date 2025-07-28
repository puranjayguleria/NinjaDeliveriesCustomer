import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Image,
  Dimensions,
  Animated,
  Platform,
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import { useNavigation } from "@react-navigation/native";
import Loader from "./VideoLoader";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BANNER_WIDTH = SCREEN_WIDTH - 32;
const BANNER_HEIGHT = BANNER_WIDTH * 0.5;

const SliderBanner: React.FC<{ storeId: string }> = ({ storeId }) => {
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<any>(null);
  const navigation = useNavigation();

  // Debug Firestore data
  useEffect(() => {
    const unsubscribe = firestore()
      .collection("sliderBanner")
      .where("storeId", "==", storeId)
      .onSnapshot(
        (querySnapshot) => {
          const loadedBanners: any[] = [];
          querySnapshot.forEach((doc) => {
            loadedBanners.push({ id: doc.id, ...doc.data() });
          });
          setBanners(loadedBanners);
          setLoading(false);
        },
        (error) => {
          console.error("Firestore error:", error);
          setLoading(false);
        }
      );

    return () => unsubscribe();
  }, [storeId]);

  const handleBannerPress = (banner: any) => {
    if (!banner.clickable) return;

    if (banner.redirectType === "category" && banner.categoryId) {
      navigation.navigate("ProductListingFromHome", {
        categoryId: banner.categoryId,
        categoryName: banner.description || "Category",
      });
    } else if (banner.redirectType === "saleItems") {
      navigation.navigate("AllDiscountedProductsScreen");
    } else {
      navigation.navigate("FeaturedTab");
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <Pressable
      style={styles.bannerContainer}
      onPress={() => handleBannerPress(item)}
    >
      <Image
        source={{ uri: item.image }}
        style={styles.bannerImage}
        resizeMode="cover"
        onError={() => console.log("Failed to load image:", item.image)}
      />
      {item.description && (
        <View style={styles.textContainer}>
          <Text style={styles.bannerText}>{item.description}</Text>
        </View>
      )}
    </Pressable>
  );

  if (loading) {
    return (
      <View style={styles.loadingPlaceholder}>
        <Loader />
      </View>
    );
  }

  if (banners.length === 0) {
    return (
      <View style={styles.emptyPlaceholder}>
        <Text>No banners available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.FlatList
        ref={flatListRef}
        data={banners}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          {
            useNativeDriver: true,
            listener: (e: any) => {
              const offset = e.nativeEvent.contentOffset.x;
              const index = Math.round(offset / BANNER_WIDTH);
              if (index !== currentIndex) {
                setCurrentIndex(index);
              }
            },
          }
        )}
        scrollEventThrottle={16}
      />

      {/* Simplified pagination for debugging */}
      <View style={styles.pagination}>
        {banners.map((_, index) => (
          <View
            key={index}
            style={[styles.dot, index === currentIndex && styles.activeDot]}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  bannerContainer: {
    width: BANNER_WIDTH,
    height: BANNER_HEIGHT,
    borderRadius: 8,
    overflow: "hidden",
    marginHorizontal: 16,
    backgroundColor: "#f0f0f0",
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  textContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 8,
  },
  bannerText: {
    color: "white",
    fontSize: 16,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ccc",
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: "#007AFF",
  },
  loadingPlaceholder: {
    height: BANNER_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyPlaceholder: {
    height: BANNER_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    marginHorizontal: 16,
  },
});

export default SliderBanner;
