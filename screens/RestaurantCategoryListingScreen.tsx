import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRoute, useNavigation, useFocusEffect } from "@react-navigation/native";
import firestore from "@react-native-firebase/firestore";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocationContext } from "@/context/LocationContext";
import RestaurantTile, { Restaurant } from "@/components/RestaurantTile";
import { getEffectiveCityId } from "@/utils/locationHelper";
import { firestoreCache, CACHE_KEYS } from "@/utils/firestoreCache";

type SortKey = "relevance" | "rating" | "fastest" | "costLowHigh" | "costHighLow";

const sortOptions: { key: SortKey; label: string }[] = [
  { key: "relevance", label: "Relevance" },
  { key: "rating", label: "Rating" },
  { key: "fastest", label: "Fastest" },
  { key: "costLowHigh", label: "Cost: Low to High" },
  { key: "costHighLow", label: "Cost: High to Low" },
];

const RestaurantCategoryListingScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { location } = useLocationContext();

  const { cuisineName, categoryName } = route.params || {};
  const displayName = cuisineName || categoryName; // Support both parameter names
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortKey>("relevance");

  // Optimized Firestore listener with caching
  useFocusEffect(
    useCallback(() => {
      const effectiveCityId = getEffectiveCityId(location);

      // If we don't have a displayName, show empty state
      if (!displayName) {
        setRestaurants([]);
        setLoading(false);
        return;
      }

      // Check cache first
      const cacheKey = `${CACHE_KEYS.RESTAURANTS(effectiveCityId)}_${displayName}`;
      const cachedRestaurants = firestoreCache.get<Restaurant[]>(cacheKey);
      
      if (cachedRestaurants) {
        setRestaurants(cachedRestaurants);
        setLoading(false);
        return;
      }

      setLoading(true);

      const unsub = firestore()
        .collection("restaurants")
        .where("isActive", "==", true)
        .where("cityId", "==", effectiveCityId)
        .where("cuisines", "array-contains", displayName)
        .onSnapshot(
          (snap) => {
            const list: Restaurant[] = snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as any),
            }));
            
            // Cache the results for 5 minutes
            firestoreCache.set(cacheKey, list, 5 * 60 * 1000);
            
            setRestaurants(list);
            setLoading(false);
          },
          (err) => {
            console.warn("[NinjaEats] category listing error", err);
            setRestaurants([]);
            setLoading(false);
          }
        );

      return unsub;
    }, [location.cityId, displayName])
  );

  // Optimized sorting with memoization
  const sorted = useMemo(() => {
    if (!restaurants.length) return [];
    
    const arr = [...restaurants];

    switch (sortBy) {
      case "rating":
        arr.sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0));
        break;
      case "fastest":
        arr.sort(
          (a, b) =>
            (a.deliveryTimeMins ?? 9999) - (b.deliveryTimeMins ?? 9999)
        );
        break;
      case "costLowHigh":
        arr.sort((a, b) => (a.costForTwo ?? 0) - (b.costForTwo ?? 0));
        break;
      case "costHighLow":
        arr.sort((a, b) => (b.costForTwo ?? 0) - (a.costForTwo ?? 0));
        break;
      case "relevance":
      default:
        // keep Firestore order
        break;
    }

    return arr;
  }, [restaurants, sortBy]);

  // Memoized navigation handlers
  const handleBackPress = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleRestaurantPress = useCallback((restaurantId: string) => {
    navigation.navigate("RestaurantDetails", {
      restaurantId,
    });
  }, [navigation]);

  const handleSortChange = useCallback((newSortBy: SortKey) => {
    setSortBy(newSortBy);
  }, []);

  // Memoized render functions
  const renderRestaurantItem = useCallback(({ item }: { item: Restaurant }) => (
    <RestaurantTile
      restaurant={item}
      onPress={() => handleRestaurantPress(item.id)}
    />
  ), [handleRestaurantPress]);

  const keyExtractor = useCallback((item: Restaurant) => item.id, []);

  const ItemSeparator = useCallback(() => <View style={{ height: 14 }} />, []);

  const renderHeader = useCallback(() => (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={handleBackPress}
        style={styles.backBtn}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <MaterialIcons name="arrow-back" size={22} color="#222" />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {displayName || "Restaurants"}
        </Text>
        <Text style={styles.headerSubtitle} numberOfLines={1}>
          {location.address || "Select delivery location"}
        </Text>
      </View>
    </View>
  ), [handleBackPress, displayName, location.address]);

  const renderSortBar = useCallback(() => (
    <View style={styles.sortRow}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        {sortOptions.map((opt) => {
          const active = sortBy === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              onPress={() => handleSortChange(opt.key)}
              style={[styles.sortChip, active && styles.sortChipActive]}
            >
              <Text
                style={[
                  styles.sortChipText,
                  active && styles.sortChipTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  ), [sortBy, handleSortChange]);

  if (loading && !restaurants.length) {
    return (
      <View style={styles.loadingContainer}>
        {renderHeader()}
        <ActivityIndicator size="large" color="#00b4a0" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader()}
      {renderSortBar()}
      {sorted.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No restaurants yet</Text>
          <Text style={styles.emptySubtitle}>
            We're onboarding partners in this category. Check back soon!
          </Text>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={ItemSeparator}
          renderItem={renderRestaurantItem}
          // 🔥 PERFORMANCE OPTIMIZATIONS
          removeClippedSubviews={true}
          maxToRenderPerBatch={8}
          windowSize={8}
          initialNumToRender={6}
          updateCellsBatchingPeriod={50}
          getItemLayout={(data, index) => ({
            length: 180, // Approximate item height including separator
            offset: 180 * index,
            index,
          })}
        />
      )}
    </View>
  );

  if (loading && !restaurants.length) {
    return (
      <View style={styles.loadingContainer}>
        {renderHeader()}
        <ActivityIndicator size="large" color="#00b4a0" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader()}
      {renderSortBar()}
      {sorted.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No restaurants yet</Text>
          <Text style={styles.emptySubtitle}>
            We’re onboarding partners in this category. Check back soon!
          </Text>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 24,
            paddingTop: 10,
          }}
          ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
          renderItem={({ item }) => (
            <RestaurantTile
              restaurant={item}
              onPress={() =>
                navigation.navigate("RestaurantDetails", {
                  restaurantId: item.id,
                })
              }
            />
          )}
        />
      )}
    </View>
  );
};

export default RestaurantCategoryListingScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fdfdfd" },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#fdfdfd",
    justifyContent: "center",
    alignItems: "center",
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
    zIndex: 10,
  },
  backBtn: {
    marginRight: 8,
    padding: 4,
    borderRadius: 999,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#222",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#777",
    marginTop: 2,
  },
  sortRow: {
    backgroundColor: "#fff",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#ddd",
    marginRight: 8,
  },
  sortChipActive: {
    backgroundColor: "#00b4a0",
    borderColor: "#00b4a0",
  },
  sortChipText: {
    fontSize: 12,
    color: "#555",
    fontWeight: "500",
  },
  sortChipTextActive: {
    color: "#fff",
    fontWeight: "700",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
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
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 10,
  },
});
