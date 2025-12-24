import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
  ScrollView,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import firestore from "@react-native-firebase/firestore";
import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";

import { useLocationContext } from "@/context/LocationContext";

const NINJA_ACCENT = "#00b4a0";

/* -------------------------------------------------------------------------- */
/*  TYPES                                                                     */
/* -------------------------------------------------------------------------- */

type Restaurant = {
  id: string;
  name: string;
  heroImageUrl?: string;
  cuisines?: string[];
  rating?: number;
  ratingCount?: number;
  deliveryTimeMin?: number;
  deliveryTimeMax?: number;
  costForTwo?: number;
  isPureVeg?: boolean;
  offerText?: string;
  distanceKm?: number;
  isPromoted?: boolean;
  isActive?: boolean;
  cityId?: string;
};

type SortMode = "relevance" | "rating" | "fast" | "cost_low" | "cost_high";

/* -------------------------------------------------------------------------- */
/*  RESTAURANT TILE (same visual language as home)                            */
/* -------------------------------------------------------------------------- */

const RestaurantTile: React.FC<{ restaurant: Restaurant }> = ({ restaurant }) => {
  const nav = useNavigation<any>();
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      friction: 5,
      tension: 120,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 5,
      tension: 120,
    }).start();
  };

  const onPress = () => {
    nav.navigate("RestaurantDetails", { restaurantId: restaurant.id });
  };

  const {
    name,
    heroImageUrl,
    cuisines = [],
    rating,
    ratingCount,
    deliveryTimeMin,
    deliveryTimeMax,
    costForTwo,
    isPureVeg,
    offerText,
    distanceKm,
    isPromoted,
  } = restaurant;

  const etaLabel =
    deliveryTimeMin && deliveryTimeMax
      ? `${deliveryTimeMin}-${deliveryTimeMax} mins`
      : deliveryTimeMin
      ? `${deliveryTimeMin} mins`
      : "30-40 mins";

  const ratingLabel = rating != null ? rating.toFixed(1) : "NEW";

  const ratingCountLabel =
    ratingCount != null && ratingCount > 0 ? `(${ratingCount})` : "";

  const cuisinesLabel = cuisines.join(", ");
  const costLabel =
    costForTwo != null ? `₹${costForTwo} for two` : "Pocket friendly";

  const distanceLabel =
    distanceKm != null ? `${distanceKm.toFixed(1)} km` : "";

  return (
    <Animated.View
      style={[styles.restaurantCardWrap, { transform: [{ scale }] }]}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={styles.restaurantCard}
      >
        <View style={styles.restaurantImageWrapper}>
          {heroImageUrl ? (
            <Image
              source={{ uri: heroImageUrl }}
              style={styles.restaurantImage}
              contentFit="cover"
              cachePolicy="disk"
              transition={160}
            />
          ) : (
            <View
              style={[
                styles.restaurantImage,
                styles.restaurantImagePlaceholder,
              ]}
            >
              <MaterialIcons name="restaurant-menu" size={40} color="#ccc" />
            </View>
          )}

          {/* Top labels */}
          <View style={styles.restaurantTopLabels}>
            {isPromoted && (
              <View style={styles.promotedTag}>
                <Text style={styles.promotedTagTxt}>PROMOTED</Text>
              </View>
            )}
            {isPureVeg && (
              <View style={styles.vegTag}>
                <Text style={styles.vegTagTxt}>PURE VEG</Text>
              </View>
            )}
          </View>

          {/* Offer ribbon */}
          {!!offerText && (
            <View style={styles.offerRibbon}>
              <MaterialIcons
                name="local-offer"
                size={14}
                color="#fff"
                style={{ marginRight: 4 }}
              />
              <Text numberOfLines={1} style={styles.offerRibbonTxt}>
                {offerText}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.restaurantInfoBlock}>
          <View style={styles.restaurantRowTop}>
            <Text style={styles.restaurantName} numberOfLines={1}>
              {name}
            </Text>
          </View>

          <View style={styles.ratingEtaRow}>
            <View style={styles.ratingPill}>
              <MaterialIcons name="star" size={12} color="#fff" />
              <Text style={styles.ratingPillTxt}>{ratingLabel}</Text>
            </View>
            <View style={styles.dot} />
            <Text style={styles.ratingEtaTxt}>{etaLabel}</Text>
            {ratingCountLabel ? (
              <>
                <View style={styles.dot} />
                <Text style={styles.ratingEtaTxt}>{ratingCountLabel}</Text>
              </>
            ) : null}
          </View>

          <Text style={styles.cuisineLine} numberOfLines={1}>
            {cuisinesLabel || "Multi-cuisine · Himachali · North Indian"}
          </Text>

          <View style={styles.costDistanceRow}>
            <Text style={styles.costDistanceTxt}>{costLabel}</Text>
            {distanceLabel ? (
              <>
                <View style={styles.dot} />
                <Text style={styles.costDistanceTxt}>{distanceLabel}</Text>
              </>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

/* -------------------------------------------------------------------------- */
/*  MAIN SCREEN                                                               */
/* -------------------------------------------------------------------------- */

const RestaurantCategoryListingScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { location } = useLocationContext();

  const { cuisineId, cuisineName: initialCuisineName } = route.params || {};

  const [cuisineName, setCuisineName] = useState<string | undefined>(
    initialCuisineName
  );
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("relevance");

  // Resolve cuisineName if only id was passed
  useEffect(() => {
    if (initialCuisineName) {
      setCuisineName(initialCuisineName);
      return;
    }
    if (!cuisineId) return;

    firestore()
      .collection("cuisines")
      .doc(cuisineId)
      .get()
      .then((doc) => {
        if (doc.exists) {
          const data = doc.data() as any;
          if (data?.name) setCuisineName(data.name);
        }
      })
      .catch((e) => console.warn("[NinjaEats] cuisine fetch error", e));
  }, [cuisineId, initialCuisineName]);

  // Fetch restaurants for this cuisine + city
  useEffect(() => {
    const effectiveCityId = location.cityId || "dharamshala";

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
          setError(null);
        },
        (e) => {
          console.warn("[NinjaEats] category listing error", e);
          setError("Could not load restaurants.");
          setLoading(false);
        }
      );

    return () => unsub();
  }, [cuisineName, location.cityId]);

  const sortedRestaurants = useMemo(() => {
    const list = [...restaurants];

    if (sortMode === "rating") {
      list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    } else if (sortMode === "fast") {
      list.sort(
        (a, b) => (a.deliveryTimeMin ?? 999) - (b.deliveryTimeMin ?? 999)
      );
    } else if (sortMode === "cost_low") {
      list.sort((a, b) => (a.costForTwo ?? 99999) - (b.costForTwo ?? 99999));
    } else if (sortMode === "cost_high") {
      list.sort((a, b) => (b.costForTwo ?? 0) - (a.costForTwo ?? 0));
    }
    // relevance = original order from Firestore
    return list;
  }, [restaurants, sortMode]);

  const sortOptions: { key: SortMode; label: string }[] = [
    { key: "relevance", label: "Relevance" },
    { key: "rating", label: "Rating 4.0+" },
    { key: "fast", label: "Fast delivery" },
    { key: "cost_low", label: "Cost: Low to High" },
    { key: "cost_high", label: "Cost: High to Low" },
  ];

  const title = cuisineName ? `${cuisineName} near you` : "Restaurants";

  const renderItem = ({ item }: { item: Restaurant }) => (
    <RestaurantTile restaurant={item} />
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <MaterialIcons name="arrow-back" size={22} color="#222" />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {location.address || "Dharamshala"}
          </Text>
        </View>
      </View>

      {/* Sort row */}
      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>
          {sortedRestaurants.length} options
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sortChipsContainer}
        >
          {sortOptions.map((opt) => {
            const active = sortMode === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.sortChip, active && styles.sortChipActive]}
                onPress={() => setSortMode(opt.key)}
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

      {/* List / loader / empty */}
      {loading && !sortedRestaurants.length ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={NINJA_ACCENT} />
        </View>
      ) : (
        <>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <FlatList
            data={sortedRestaurants}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 32, paddingTop: 4 }}
            ListEmptyComponent={
              !loading ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>No restaurants found</Text>
                  <Text style={styles.emptySubtitle}>
                    Try changing filters or updating your location.
                  </Text>
                </View>
              ) : null
            }
          />
        </>
      )}
    </View>
  );
};

export default RestaurantCategoryListingScreen;

/* -------------------------------------------------------------------------- */
/*  STYLES                                                                    */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fdfdfd" },

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
    marginTop: 1,
  },

  sortRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
  },
  sortLabel: {
    fontSize: 12,
    color: "#555",
  },
  sortChipsContainer: {
    paddingLeft: 12,
  },
  sortChip: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ddd",
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 8,
    backgroundColor: "#fff",
  },
  sortChipActive: {
    borderColor: NINJA_ACCENT,
    backgroundColor: "#e0f7f5",
  },
  sortChipText: {
    fontSize: 12,
    color: "#444",
  },
  sortChipTextActive: {
    color: "#00786f",
    fontWeight: "600",
  },

  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    textAlign: "center",
    color: "#c62828",
    marginTop: 16,
  },

  emptyState: {
    marginTop: 40,
    alignItems: "center",
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

  /* Restaurant card styles (same vibe as home) */
  restaurantCardWrap: {
    marginHorizontal: 16,
    marginTop: 12,
  },
  restaurantCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  restaurantImageWrapper: {
    position: "relative",
  },
  restaurantImage: {
    width: "100%",
    height: 170,
    backgroundColor: "#f5f5f5",
  },
  restaurantImagePlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  restaurantTopLabels: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
  },
  promotedTag: {
    backgroundColor: "rgba(0,0,0,0.75)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  promotedTagTxt: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  vegTag: {
    backgroundColor: "#e8f5e9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  vegTagTxt: {
    color: "#2e7d32",
    fontSize: 10,
    fontWeight: "700",
  },
  offerRibbon: {
    position: "absolute",
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  offerRibbonTxt: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },

  restaurantInfoBlock: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
  },
  restaurantRowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  restaurantName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: "#222",
  },

  ratingEtaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1b5e20",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ratingPillTxt: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    marginLeft: 3,
  },
  ratingEtaTxt: {
    fontSize: 11,
    color: "#555",
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#777",
    marginHorizontal: 5,
  },

  cuisineLine: {
    marginTop: 4,
    fontSize: 12,
    color: "#777",
  },
  costDistanceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  costDistanceTxt: {
    fontSize: 12,
    color: "#555",
  },
});
