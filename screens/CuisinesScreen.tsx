import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Dimensions,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import firestore from "@react-native-firebase/firestore";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { useLocationContext } from "@/context/LocationContext";
import { firestoreCache, CACHE_KEYS } from "@/utils/firestoreCache";

// Helper function to validate image URL
const isValidImageUrl = (url: string): boolean => {
  if (!url || typeof url !== 'string') return false;
  
  // Check if it's a valid URL format
  try {
    new URL(url);
  } catch {
    return false;
  }
  
  // Check if it's likely an image (not SVG which causes issues)
  const lowercaseUrl = url.toLowerCase();
  const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  const hasValidExtension = validExtensions.some(ext => lowercaseUrl.includes(ext));
  const isSvg = lowercaseUrl.includes('.svg') || lowercaseUrl.includes('svg');
  
  // Allow if it has valid extension or if it's from a known image service (even without extension)
  const isImageService = lowercaseUrl.includes('unsplash.com') || 
                         lowercaseUrl.includes('cloudinary.com') || 
                         lowercaseUrl.includes('firebase') ||
                         lowercaseUrl.includes('googleapis.com');
  
  return !isSvg && (hasValidExtension || isImageService);
};

const { width } = Dimensions.get("window");
const H = 16;

type CuisineCategory = {
  id: string;
  name: string;
  iconEmoji?: string;
  imageurl?: string; // Match Firebase field name
  priority?: number;
};

const CuisinesScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { location, setCityId } = useLocationContext();
  const [cuisines, setCuisines] = useState<CuisineCategory[]>([]); // Start empty, fetch from Firebase
  const [loading, setLoading] = useState(true); // Start loading
  const [error, setError] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set()); // Track failed image URLs

  // Initialize cityId if not set
  useEffect(() => {
    if (!location.cityId) {
      setCityId('dharamshala');
    }
  }, [location.cityId, setCityId]);

  // Fetch cuisines from Firebase with caching and error handling
  useFocusEffect(
    useCallback(() => {
      console.log('[CuisinesScreen] Fetching cuisines from Firebase...');
      
      // Check cache first
      const cachedCuisines = firestoreCache.get<CuisineCategory[]>(CACHE_KEYS.CUISINES);
      
      if (cachedCuisines) {
        console.log('[CuisinesScreen] Using cached cuisines:', cachedCuisines.length);
        setCuisines(cachedCuisines);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      const unsub = firestore()
        .collection("cuisines")
        .orderBy("priority", "asc")
        .onSnapshot(
          (snap) => {
            try {
              const list: CuisineCategory[] = snap.docs.map((d) => {
                const data = d.data();
                console.log('[CuisinesScreen] Cuisine data:', {
                  id: d.id,
                  name: data.name,
                  imageurl: data.imageurl,
                  isValidUrl: data.imageurl ? isValidImageUrl(data.imageurl) : false,
                  priority: data.priority
                });
                return {
                  id: d.id,
                  ...(data as any),
                };
              });
              
              console.log('[CuisinesScreen] Loaded cuisines from Firebase:', list.length);
              
              // Cache the results
              firestoreCache.set(CACHE_KEYS.CUISINES, list, 10 * 60 * 1000); // 10 minutes TTL
              
              setCuisines(list);
              setLoading(false);
            } catch (err) {
              console.error("[CuisinesScreen] Error processing data:", err);
              setError("Failed to load cuisines");
              setCuisines([]); // No fallback data
              setLoading(false);
            }
          },
          (err) => {
            console.error("[CuisinesScreen] Firestore error:", err);
            setError("Failed to load cuisines");
            setCuisines([]); // No fallback data
            setLoading(false);
          }
        );

      return () => unsub();
    }, [])
  );

  // Optimized navigation handler with immediate feedback
  const handleCuisinePress = useCallback((item: CuisineCategory) => {
    // Provide immediate visual feedback
    const startTime = performance.now();
    
    try {
      // Navigate within the same stack
      navigation.navigate("RestaurantCategoryListing", {
        categoryId: item.id,
        categoryName: item.name,
        cuisineName: item.name, // Support both parameter names
      });
      
      // Log navigation performance
      const endTime = performance.now();
      console.log(`[CuisinesScreen] Navigation took ${(endTime - startTime).toFixed(2)}ms`);
    } catch (err) {
      console.error("[CuisinesScreen] Navigation error:", err);
    }
  }, [navigation]);

  // Memoized render item for better performance - Swiggy Style
  const renderItem = useCallback(({ item }: { item: CuisineCategory }) => {
    const shouldShowImage = item.imageurl && 
                           isValidImageUrl(item.imageurl) && 
                           !failedImages.has(item.imageurl);
    
    return (
      <TouchableOpacity
        style={styles.cuisineTile}
        onPress={() => handleCuisinePress(item)}
        activeOpacity={0.8}
      >
        {shouldShowImage ? (
          <Image
            source={{ uri: item.imageurl }}
            style={styles.cuisineTileImage}
            contentFit="cover"
            cachePolicy="disk"
            onError={() => {
              console.error('[CuisinesScreen] Failed to load image for:', item.name, 'URL:', item.imageurl);
              // Add to failed images set to show placeholder next time
              setFailedImages(prev => new Set(prev).add(item.imageurl!));
            }}
          />
        ) : (
          <View style={[styles.cuisineTileImage, styles.cuisineTilePlaceholder]}>
            <Text style={styles.cuisineEmoji}>{item.iconEmoji || "🍽️"}</Text>
          </View>
        )}
        <Text style={styles.cuisineTileName} numberOfLines={2}>
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  }, [handleCuisinePress, failedImages]);

  // Memoized key extractor
  const keyExtractor = useCallback((item: CuisineCategory) => item.id, []);

  // Memoized empty component
  const EmptyComponent = useMemo(() => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>
        {error ? "Error loading cuisines" : "No cuisines yet"}
      </Text>
      <Text style={styles.emptySubtitle}>
        {error 
          ? "Please check your connection and try again" 
          : "Once partners go live, you'll see cuisines here."
        }
      </Text>
      {error && (
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => {
            // Clear cache and retry
            firestoreCache.delete(CACHE_KEYS.CUISINES);
            setError(null);
            setLoading(true);
          }}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  ), [error]);

  // Pull to refresh handler
  const handleRefresh = useCallback(() => {
    console.log('[CuisinesScreen] Refreshing cuisines...');
    firestoreCache.delete(CACHE_KEYS.CUISINES);
    setError(null);
    setLoading(true);
  }, []);

  return (
    <View style={styles.container}>
      {/* Header with gradient background */}
      <LinearGradient
        colors={["#ff6b35", "#ff8c42", "#ffa552", "#ffb366", "#ffffff"]}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <View style={styles.headerContent}>
          <MaterialIcons name="restaurant-menu" size={28} color="#fff" />
          <Text style={styles.headerTitle}>Explore Cuisines</Text>
        </View>
        <Text style={styles.headerSubtitle}>
          Discover restaurants by your favorite cuisine
        </Text>
      </LinearGradient>

      {loading && !cuisines.length ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#ff6b35" />
          <Text style={styles.loadingText}>Loading cuisines...</Text>
        </View>
      ) : (
        <FlatList
          data={cuisines}
          keyExtractor={keyExtractor}
          numColumns={2}
          contentContainerStyle={styles.listContainer}
          columnWrapperStyle={styles.columnWrapper}
          renderItem={renderItem}
          ListEmptyComponent={EmptyComponent}
          removeClippedSubviews={true}
          maxToRenderPerBatch={6}
          windowSize={10}
          initialNumToRender={6}
          refreshing={loading && cuisines.length > 0}
          onRefresh={handleRefresh}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

export default CuisinesScreen;

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#fdfdfd" 
  },
  header: {
    paddingTop: Platform.OS === "ios" ? 50 : 40,
    paddingBottom: 20,
    paddingHorizontal: H,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    marginLeft: 8,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.95)",
    fontWeight: "500",
    marginLeft: 36,
  },
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
  },
  listContainer: {
    padding: H,
    paddingBottom: 32,
  },
  columnWrapper: {
    justifyContent: "space-between",
    marginBottom: 16,
  },
  cuisineTile: {
    width: (width - H * 3) / 2, // 2 columns with spacing
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  cuisineTileImage: {
    width: "100%",
    height: 160,
    backgroundColor: "#f5f5f5",
  },
  cuisineTilePlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  cuisineEmoji: {
    fontSize: 48,
  },
  cuisineTileName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1c1c1c",
    textAlign: "center",
    paddingHorizontal: 8,
    paddingVertical: 12,
    lineHeight: 20,
    letterSpacing: -0.3,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#777",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  retryButton: {
    backgroundColor: "#ff6b35",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: "#ff6b35",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  retryText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});