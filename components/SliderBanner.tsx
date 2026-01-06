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
const SLIDE_GAP = 8;
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SLIDE_WIDTH = SCREEN_WIDTH - HORIZONTAL_PADDING * 2;
const BANNER_HEIGHT = SCREEN_WIDTH * 0.5;
const AUTO_PLAY_INTERVAL = 4000;

// 🔥 CACHE (per store)
const bannerCache: Record<string, any[]> = {};

const isMp4 = (url?: string) =>
  !!url && (url.endsWith(".mp4") || url.includes(".mp4?"));

const SliderBanner: React.FC<{ storeId: string }> = ({ storeId }) => {
  const navigation = useNavigation();
  const { location } = useLocationContext();

  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedMap, setLoadedMap] = useState<Record<string, boolean>>({});

  const flatListRef = useRef<FlatList<any>>(null);
  const currentIndexRef = useRef(0);
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);

  // 🔥 Firestore + Cache
  useEffect(() => {
    if (bannerCache[storeId]) {
      setBanners(bannerCache[storeId]);
      setLoading(false);
    } else {
      setLoading(true);
    }

    const unsubscribe = firestore()
      .collection("sliderBanner")
      .where("storeId", "==", storeId)
      .onSnapshot((snapshot) => {
        const loaded: any[] = [];
        snapshot.forEach((doc) =>
          loaded.push({ id: doc.id, ...doc.data() })
        );

        bannerCache[storeId] = loaded;
        setBanners(loaded);
        setLoading(false);

        const map: Record<string, boolean> = {};
        loaded.forEach((b) => (map[b.id] = false));
        setLoadedMap(map);
      });

    return () => unsubscribe();
  }, [storeId]);

  // 🔥 Autoplay
  useEffect(() => {
    if (banners.length <= 1) return;

    autoPlayRef.current = setInterval(() => {
      const next = (currentIndexRef.current + 1) % banners.length;
      flatListRef.current?.scrollToIndex({
        index: next,
        animated: true,
      });
      currentIndexRef.current = next;
    }, AUTO_PLAY_INTERVAL);

    return () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    };
  }, [banners]);

  if (loading && !bannerCache[storeId]) {
    return null;
  }

  const renderItem = ({ item }: any) => {
    const url = item.image || item.mediaUrl;

    return (
      <TouchableWithoutFeedback>
        <Pressable style={styles.bannerContainer}>
          {isMp4(url) ? (
            <Video
              source={{ uri: url }}
              style={styles.bannerImage}
              resizeMode="cover"
              muted
              repeat
              paused={false}
              onLoad={() =>
                setLoadedMap((m) => ({ ...m, [item.id]: true }))
              }
            />
          ) : (
            <Image
              source={{ uri: url }}
              style={styles.bannerImage}
              contentFit="cover"
              cachePolicy="disk"
              placeholder={PLACEHOLDER_BLURHASH}
              onLoad={() =>
                setLoadedMap((m) => ({ ...m, [item.id]: true }))
              }
            />
          )}

          {!loadedMap[item.id] && (
            <View style={styles.loaderOverlay}>
              <ActivityIndicator color="#fff" />
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

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={banners}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        snapToInterval={SLIDE_WIDTH + SLIDE_GAP}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: HORIZONTAL_PADDING }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginVertical: 16 },
  bannerContainer: {
    width: SLIDE_WIDTH,
    borderRadius: 8,
    overflow: "hidden",
    marginRight: SLIDE_GAP,
  },
  bannerImage: {
    width: "100%",
    height: BANNER_HEIGHT,
  },
  textContainer: {
    position: "absolute",
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.45)",
    padding: 6,
    borderRadius: 6,
  },
  bannerText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
});

export default React.memo(SliderBanner);
