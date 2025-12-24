import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import firestore from "@react-native-firebase/firestore";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocationContext } from "@/context/LocationContext";
import RestaurantTile, { Restaurant } from "@/components/RestaurantTile";

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

  const { cuisineName } = route.params || {};
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortKey>("relevance");

  useEffect(() => {
    // Same fallback as NinjaEatsHome
    const effectiveCityId = location.cityId || "dharamshala";

    // If we don't have a cuisineName or city, show empty state, not infinite loader
    if (!cuisineName || !effectiveCityId) {
      setRestaurants([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsub = firestore()
      .collection("restaurants")
      .where("isActive", "==", true)
      .where("cityId", "==", effectiveCityId)
      .where("cuisines", "array-contains", cuisineName)
      .onSnapshot(
        (snap) => {
          const list: Restaurant[] = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          }));
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
  }, [location.cityId, cuisineName]);

  // 🔹 THIS WAS MISSING – derive sorted list from restaurants + sortBy
  const sorted = useMemo(() => {
    const arr = [...restaurants];

    switch (sortBy) {
      case "rating":
        arr.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
        break;
      case "fastest":
        arr.sort(
          (a, b) =>
            (a.deliveryTimeMin ?? 9999) - (b.deliveryTimeMin ?? 9999)
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

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.backBtn}
      >
        <MaterialIcons name="arrow-back" size={22} color="#222" />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {cuisineName || "Restaurants"}
        </Text>
        <Text style={styles.headerSubtitle} numberOfLines={1}>
          {location.address || "Select delivery location"}
        </Text>
      </View>
    </View>
  );

  const renderSortBar = () => (
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
              onPress={() => setSortBy(opt.key)}
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
});
