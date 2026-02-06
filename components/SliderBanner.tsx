// components/SliderBanner.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  FlatList,
  ActivityIndicator,
  TouchableWithoutFeedback,
} from "react-native";
import { Image } from "expo-image";
import firestore from "@react-native-firebase/firestore";
import Video from "react-native-video";
import { useNavigation } from "@react-navigation/native";
import { useLocationContext } from "@/context/LocationContext";
const PLACEHOLDER_BLURHASH = "LKO2?U%2Tw=w]~RBVZRi};ofM{ay";

const HORIZONTAL_PADDING = 16;
const SLIDE_GAP = 8; // space between slides
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SLIDE_WIDTH = SCREEN_WIDTH - HORIZONTAL_PADDING * 2;
const BANNER_HEIGHT = SCREEN_WIDTH * 0.5;
const AUTO_PLAY_INTERVAL = 4000;

const isMp4 = (url?: string) =>
  !!url &&
  (url.endsWith(".mp4") || url.includes(".mp4?") || /\.mp4(\?|$)/i.test(url));

const isImageLike = (url?: string) =>
  !!url && (/\.(gif|jpe?g|png|webp)(\?|$)/i.test(url) || !isMp4(url));

const SliderBanner: React.FC<{ storeId: string }> = ({ storeId }) => {
  const { location } = useLocationContext();
  const navigation = useNavigation();

  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedMap, setLoadedMap] = useState<Record<string, boolean>>({});

  const flatListRef = useRef<FlatList<any> | null>(null);
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);
  const currentIndexRef = useRef(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const userInteractingRef = useRef(false);
  const resumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Firestore listener
  useEffect(() => {
    setLoading(true);
    const unsubscribe = firestore()
      .collection("sliderBanner")
      .where("storeId", "==", storeId)
      .onSnapshot(
        (querySnapshot) => {
          const loaded: any[] = [];
          querySnapshot.forEach((doc) => {
            loaded.push({ id: doc.id, ...doc.data() });
          });
          setBanners(loaded);
          setLoading(false);

          const initialMap: Record<string, boolean> = {};
          loaded.forEach((b) => (initialMap[b.id] = false));
          setLoadedMap(initialMap);
        },
        (err) => {
          console.error("SliderBanner Firestore error:", err);
          setLoading(false);
        }
      );

    return () => unsubscribe();
  }, [storeId]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    startAutoPlayIfNeeded();
    return () => {
      stopAutoPlay();
      if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
    };
  }, [banners.length]);

  const startAutoPlayIfNeeded = () => {
    stopAutoPlay();
    if (banners.length <= 1) return;
    autoPlayRef.current = setInterval(() => {
      if (userInteractingRef.current) return;
      const next = (currentIndexRef.current + 1) % banners.length;
      scrollToIndex(next);
      setCurrentIndex(next);
    }, AUTO_PLAY_INTERVAL);
  };

  const stopAutoPlay = () => {
    if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current);
      autoPlayRef.current = null;
    }
  };

  const pauseAutoPlayForInteraction = () => {
    userInteractingRef.current = true;
    stopAutoPlay();
    if (resumeTimeoutRef.current) {
      clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = null;
    }
  };

  const resumeAutoPlayAfterDelay = (delay = 2500) => {
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
    resumeTimeoutRef.current = setTimeout(() => {
      userInteractingRef.current = false;
      startAutoPlayIfNeeded();
    }, delay);
  };

  const scrollToIndex = (index: number) => {
    if (!flatListRef.current) return;
    const offset = index * (SLIDE_WIDTH + SLIDE_GAP);
    flatListRef.current.scrollToOffset({ offset, animated: true });
  };

  const handleBannerPress = (banner: any) => {
    if (!banner.clickable) return;

    if (banner.redirectType === "ProductListingPage" && banner.categoryId) {
      navigation.navigate("ProductListingFromHome", {
        categoryId: banner.categoryId,
        categoryName: banner.description || "Category",
      } as never);
    } else if (banner.redirectType === "saleItems") {
      navigation.navigate(
        "HomeTab" as never,
        {
          screen: "AllDiscountedProducts",
          params: { storeId: location?.storeId },
        } as never
      );
    } else {
      navigation.navigate("FeaturedTab" as never);
    }
  };

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const url = item.image || item.mediaUrl || item.introGifUrl;
    const loaded = !!loadedMap[item.id];

    return (
      <TouchableWithoutFeedback
        onPressIn={pauseAutoPlayForInteraction}
        onPressOut={resumeAutoPlayAfterDelay}
      >
        <Pressable
          style={[
            styles.bannerContainer,
            { marginRight: index === banners.length - 1 ? 0 : SLIDE_GAP },
          ]}
          onPress={() => handleBannerPress(item)}
        >
          {isMp4(url) ? (
            <Video
              source={{ uri: url }}
              style={styles.bannerImage}
              resizeMode="cover"
              muted
              repeat
              paused={index !== currentIndex}
              onLoad={() => setLoadedMap((m) => ({ ...m, [item.id]: true }))}
              onError={() => setLoadedMap((m) => ({ ...m, [item.id]: true }))}
            />
          ) : (
           <Image
                source={{ uri: url }}
                style={styles.bannerImage}
                contentFit="cover"
                cachePolicy="disk"
                transition={160}
                placeholder={PLACEHOLDER_BLURHASH}
                onLoad={() =>
                  setLoadedMap((m) => ({ ...m, [item.id]: true }))
                }
                onError={() =>
                  setLoadedMap((m) => ({ ...m, [item.id]: true }))
                }
              />
          )}

          {!loaded && (
            <View style={styles.loaderOverlay}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}

          {item.description && (
            <View style={styles.textContainer}>
              <Text style={styles.bannerText}>{item.description}</Text>
            </View>
          )}
        </Pressable>
      </TouchableWithoutFeedback>
    );
  };

  if (loading) {
    return (
      <View style={[styles.placeholder, { height: BANNER_HEIGHT }]}>
        <ActivityIndicator size="large" color="#999" />
      </View>
    );
  }

  if (!banners || banners.length === 0) {
    return (
      <View style={[styles.emptyPlaceholder, { height: BANNER_HEIGHT }]}>
        <Text>No banners available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={banners}
        horizontal
        pagingEnabled={false}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        getItemLayout={(_, index) => ({
          length: SLIDE_WIDTH + SLIDE_GAP,
          offset: (SLIDE_WIDTH + SLIDE_GAP) * index,
          index,
        })}
        contentContainerStyle={{ paddingHorizontal: HORIZONTAL_PADDING }}
        snapToInterval={SLIDE_WIDTH + SLIDE_GAP}
        decelerationRate="fast"
        onMomentumScrollEnd={(e) => {
          const offset = e.nativeEvent.contentOffset.x;
          const idx = Math.round(offset / (SLIDE_WIDTH + SLIDE_GAP));
          setCurrentIndex(idx);
        }}
        onScrollBeginDrag={pauseAutoPlayForInteraction}
        onScrollEndDrag={resumeAutoPlayAfterDelay}
      />

      <View style={styles.pagination}>
        {banners.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === currentIndex && styles.activeDot]}
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
    width: SLIDE_WIDTH,
    alignItems: "center",
    borderRadius: 8,
    overflow: "hidden",
  },
  bannerImage: {
    width: "100%",
    height: BANNER_HEIGHT,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
  },
  textContainer: {
    position: "absolute",
    bottom: 8,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    padding: 8,
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 8,
  },
  bannerText: {
    color: "white",
    fontSize: 14,
    fontWeight: "700",
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
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  placeholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  emptyPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    marginHorizontal: 16,
  },
});

export default SliderBanner;


