import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import firestore from "@react-native-firebase/firestore";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocationContext } from "@/context/LocationContext";
import { firestoreCache, CACHE_KEYS } from "@/utils/firestoreCache";

type CuisineCategory = {
  id: string;
  name: string;
  iconEmoji?: string;
  priority?: number;
};

const CuisinesScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { location, setCityId } = useLocationContext();
  const [cuisines, setCuisines] = useState<CuisineCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize cityId if not set
  useEffect(() => {
    if (!location.cityId) {
      setCityId('dharamshala');
    }
  }, [location.cityId, setCityId]);

  // Optimized Firestore listener with caching and error handling
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

  // Memoized render item for better performance
  const renderItem = useCallback(({ item }: { item: CuisineCategory }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => handleCuisinePress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.iconCircle}>
        <Text style={styles.iconText}>{item.iconEmoji || "🍽️"}</Text>
      </View>
      <Text style={styles.cardTitle} numberOfLines={1}>
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

  // Pull to refresh handler
  const handleRefresh = useCallback(() => {
    firestoreCache.delete(CACHE_KEYS.CUISINES);
    setError(null);
    setLoading(true);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cuisines</Text>
      </View>

      {loading && !cuisines.length ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#00b4a0" />
          <Text style={styles.loadingText}>Loading cuisines...</Text>
        </View>
      ) : (
        <FlatList
          data={cuisines}
          keyExtractor={keyExtractor}
          numColumns={3}
          contentContainerStyle={styles.listContainer}
          columnWrapperStyle={styles.columnWrapper}
          renderItem={renderItem}
          ListEmptyComponent={EmptyComponent}
          removeClippedSubviews={true}
          maxToRenderPerBatch={9}
          windowSize={10}
          initialNumToRender={9}
          refreshing={loading && cuisines.length > 0}
          onRefresh={handleRefresh}
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
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    backgroundColor: "#fff",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#222",
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
    padding: 16,
  },
  columnWrapper: {
    justifyContent: "space-between",
    marginBottom: 14,
  },
  card: {
    width: "31%",
    backgroundColor: "#fff",
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#e0f7f5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  iconText: { 
    fontSize: 22 
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
    textAlign: "center",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#777",
    textAlign: "center",
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: "#00b4a0",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});