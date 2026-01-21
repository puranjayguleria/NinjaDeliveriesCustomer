import React, { useEffect, useState, useCallback } from "react";
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

const { width } = Dimensions.get("window");
const H = 16;

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

const RestaurantListScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { location } = useLocationContext();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch restaurants from Firebase
  useFocusEffect(
    useCallback(() => {
      const effectiveCityId = location.cityId || "dharamshala";
      
      if (!effectiveCityId) {
        setRestaurants([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const unsub = firestore()
        .collection("restaurants")
        .where("isActive", "==", true)
        .where("cityId", "==", effectiveCityId)
        .onSnapshot(
          (snap) => {
            const list: Restaurant[] = snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as any),
            }));
            setRestaurants(list);
            setLoading(false);
          },
          (e) => {
            console.warn("[RestaurantList] restaurants error", e);
            setError("Could not load restaurants.");
            setLoading(false);
          }
        );

      return () => unsub();
    }, [location.cityId])
  );

  const handleRestaurantPress = useCallback((restaurant: Restaurant) => {
    navigation.navigate("RestaurantDetails", { 
      restaurantId: restaurant.id,
      restaurantName: restaurant.name 
    });
  }, [navigation]);

  const renderRestaurant = useCallback(({ item }: { item: Restaurant }) => {
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
      isPromoted,
    } = item;

    const etaLabel =
      deliveryTimeMin && deliveryTimeMax
        ? `${deliveryTimeMin}-${deliveryTimeMax} mins`
        : deliveryTimeMin
        ? `${deliveryTimeMin} mins`
        : "30-40 mins";

    const ratingLabel = rating != null ? rating.toFixed(1) : "NEW";
    const cuisinesLabel = cuisines.join(", ");
    const costLabel = costForTwo != null ? `₹${costForTwo} for two` : "Pocket friendly";

    return (
      <TouchableOpacity
        style={styles.restaurantCard}
        onPress={() => handleRestaurantPress(item)}
        activeOpacity={0.8}
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
            <View style={[styles.restaurantImage, styles.restaurantImagePlaceholder]}>
              <MaterialIcons name="restaurant-menu" size={48} color="#ddd" />
            </View>
          )}

          {/* Top badges */}
          <View style={styles.restaurantTopBadges}>
            {isPromoted && (
              <View style={styles.promotedBadge}>
                <MaterialIcons name="star" size={10} color="#ffd700" />
                <Text style={styles.promotedBadgeTxt}>PROMOTED</Text>
              </View>
            )}
          </View>

          {/* Offer banner */}
          {!!offerText && (
            <View style={styles.offerBanner}>
              <MaterialIcons name="local-offer" size={12} color="#ff6b35" style={{ marginRight: 4 }} />
              <Text numberOfLines={1} style={styles.offerBannerTxt}>
                {offerText}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.restaurantInfo}>
          {/* Restaurant name and veg badge */}
          <View style={styles.restaurantNameRow}>
            <Text style={styles.restaurantName} numberOfLines={1}>
              {name}
            </Text>
            {isPureVeg && (
              <View style={styles.vegBadge}>
                <View style={styles.vegDot} />
              </View>
            )}
          </View>

          {/* Rating, time, cost */}
          <View style={styles.restaurantMetaRow}>
            <View style={styles.ratingBadge}>
              <MaterialIcons name="star" size={13} color="#fff" />
              <Text style={styles.ratingBadgeTxt}>{ratingLabel}</Text>
            </View>
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.metaTxt}>{etaLabel}</Text>
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.metaTxt}>{costLabel}</Text>
          </View>

          {/* Cuisines */}
          <Text style={styles.cuisinesText} numberOfLines={1}>
            {cuisinesLabel || "Multi-cuisine"}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [handleRestaurantPress]);

  const keyExtractor = useCallback((item: Restaurant) => item.id, []);

  const EmptyComponent = () => (
    <View style={styles.emptyState}>
      <MaterialIcons name="restaurant" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>
        {error ? "Error loading restaurants" : "No restaurants found"}
      </Text>
      <Text style={styles.emptySubtitle}>
        {error 
          ? "Please check your connection and try again" 
          : "No restaurants available in your area yet."
        }
      </Text>
      {error && (
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => {
            setError(null);
            setLoading(true);
          }}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={["#ff6b35", "#ff8c42", "#ffa552", "#ffb366", "#ffffff"]}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <View style={styles.headerContent}>
          <MaterialIcons name="restaurant" size={28} color="#fff" />
          <Text style={styles.headerTitle}>All Restaurants</Text>
        </View>
        <Text style={styles.headerSubtitle}>
          Discover delicious food near you
        </Text>
      </LinearGradient>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#ff6b35" />
          <Text style={styles.loadingText}>Loading restaurants...</Text>
        </View>
      ) : (
        <FlatList
          data={restaurants}
          keyExtractor={keyExtractor}
          renderItem={renderRestaurant}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={EmptyComponent}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={10}
          initialNumToRender={8}
        />
      )}
    </View>
  );
};

export default RestaurantListScreen;

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
  restaurantCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  restaurantImageWrapper: {
    position: "relative",
    width: "100%",
    height: 180,
  },
  restaurantImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#f8f8f8",
  },
  restaurantImagePlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  restaurantTopBadges: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    gap: 6,
  },
  promotedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 3,
  },
  promotedBadgeTxt: {
    color: "#333",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  offerBanner: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,107,53,0.1)",
  },
  offerBannerTxt: {
    color: "#ff6b35",
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
  },
  restaurantInfo: {
    padding: 12,
  },
  restaurantNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  restaurantName: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: "#1c1c1c",
    letterSpacing: -0.3,
  },
  vegBadge: {
    width: 18,
    height: 18,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: "#0f8a65",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 6,
  },
  vegDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#0f8a65",
  },
  restaurantMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1c8a5c",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 2,
  },
  ratingBadgeTxt: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  metaDot: {
    color: "#999",
    fontSize: 14,
    marginHorizontal: 6,
    fontWeight: "700",
  },
  metaTxt: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
  },
  cuisinesText: {
    fontSize: 13,
    color: "#888",
    marginBottom: 4,
    lineHeight: 18,
  },
  emptyState: {
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
    marginTop: 16,
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