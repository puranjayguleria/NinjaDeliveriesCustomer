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

const { width } = Dimensions.get("window");
const H = 16;

type CuisineCategory = {
  id: string;
  name: string;
  iconEmoji?: string;
  iconUrl?: string;
  priority?: number;
};

// Demo cuisines with restaurant images
const DEMO_CUISINES: CuisineCategory[] = [
  {
    id: "italian",
    name: "Italian",
    iconUrl: "https://images.unsplash.com/photo-1595295333158-4742f28fbd85?w=400&h=400&fit=crop",
    priority: 1,
  },
  {
    id: "chinese",
    name: "Chinese",
    iconUrl: "https://images.unsplash.com/photo-1525755662778-989d0524087e?w=400&h=400&fit=crop",
    priority: 2,
  },
  {
    id: "indian",
    name: "Indian",
    iconUrl: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&h=400&fit=crop",
    priority: 3,
  },
  {
    id: "mexican",
    name: "Mexican",
    iconUrl: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&h=400&fit=crop",
    priority: 4,
  },
  {
    id: "japanese",
    name: "Japanese",
    iconUrl: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=400&h=400&fit=crop",
    priority: 5,
  },
  {
    id: "thai",
    name: "Thai",
    iconUrl: "https://images.unsplash.com/photo-1559314809-0d155014e29e?w=400&h=400&fit=crop",
    priority: 6,
  },
  {
    id: "american",
    name: "American",
    iconUrl: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400&h=400&fit=crop",
    priority: 7,
  },
  {
    id: "mediterranean",
    name: "Mediterranean",
    iconUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=400&fit=crop",
    priority: 8,
  },
];

const CuisinesScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { location, setCityId } = useLocationContext();
  const [cuisines, setCuisines] = useState<CuisineCategory[]>(DEMO_CUISINES); // Use demo data
  const [loading, setLoading] = useState(false); // Start with demo data loaded
  const [error, setError] = useState<string | null>(null);

  // Initialize cityId if not set
  useEffect(() => {
    if (!location.cityId) {
      setCityId('dharamshala');
    }
  }, [location.cityId, setCityId]);

  // Optimized Firestore listener with caching and error handling
  // Commented out to use demo data
  /*
  useFocusEffect(
    useCallback(() => {
      // Check cache first
      const cachedCuisines = firestoreCache.get<CuisineCategory[]>(CACHE_KEYS.CUISINES);
      
      if (cachedCuisines) {
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
              const list: CuisineCategory[] = snap.docs.map((d) => ({
                id: d.id,
                ...(d.data() as any),
              }));
              
              // Cache the results
              firestoreCache.set(CACHE_KEYS.CUISINES, list, 10 * 60 * 1000); // 10 minutes TTL
              
              setCuisines(list);
              setLoading(false);
            } catch (err) {
              console.error("[CuisinesScreen] Error processing data:", err);
              setError("Failed to load cuisines");
              setLoading(false);
            }
          },
          (err) => {
            console.error("[CuisinesScreen] Firestore error:", err);
            setError("Failed to load cuisines");
            setLoading(false);
          }
        );

      return () => unsub();
    }, [])
  );
  */

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
  const renderItem = useCallback(({ item }: { item: CuisineCategory }) => (
    <TouchableOpacity
      style={styles.cuisineTile}
      onPress={() => handleCuisinePress(item)}
      activeOpacity={0.8}
    >
      {item.iconUrl ? (
        <Image
          source={{ uri: item.iconUrl }}
          style={styles.cuisineTileImage}
          contentFit="cover"
          cachePolicy="disk"
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
  ), [handleCuisinePress]);

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

  // Pull to refresh handler - disabled for demo
  const handleRefresh = useCallback(() => {
    // Demo data doesn't need refresh
    // firestoreCache.delete(CACHE_KEYS.CUISINES);
    // setError(null);
    // setLoading(true);
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