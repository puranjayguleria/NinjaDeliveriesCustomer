import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Dimensions,
  Platform,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Image } from "expo-image";
import firestore from "@react-native-firebase/firestore";

const { width } = Dimensions.get("window");

type Restaurant = {
  id: string;
  name: string;
  heroImageUrl?: string;
  cuisines?: string[];
  rating?: number;
  deliveryTimeMin?: number;
  deliveryTimeMax?: number;
  costForTwo?: number;
  isPureVeg?: boolean;
  offerText?: string;
  distanceKm?: number;
  isActive?: boolean;
  cityId?: string;
};

const CuisineDetailScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { cuisineId, cuisineName, cuisineImage } = route.params || {};

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch restaurants that serve this cuisine
    const unsubscribe = firestore()
      .collection("restaurants")
      .where("isActive", "==", true)
      .where("cuisines", "array-contains", cuisineName)
      .onSnapshot(
        (snapshot) => {
          const data = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Restaurant[];
          setRestaurants(data);
          setLoading(false);
        },
        (error) => {
          console.error("Error fetching restaurants:", error);
          setLoading(false);
        }
      );

    return () => unsubscribe();
  }, [cuisineName]);

  const handleRestaurantPress = useCallback((restaurantId: string) => {
    navigation.navigate("RestaurantDetails", { restaurantId });
  }, [navigation]);

  return (
    <View style={styles.container}>
      {/* Header with gradient background */}
      <LinearGradient
        colors={["#ff6b35", "#ff8c42", "#ffffff"]}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <View style={styles.headerContent}>
          <Pressable
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </Pressable>

          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{cuisineName}</Text>
            <Text style={styles.headerSubtitle}>
              {restaurants.length} restaurants serving {cuisineName}
            </Text>
          </View>
        </View>

        {/* Cuisine Image */}
        {cuisineImage && (
          <View style={styles.cuisineImageContainer}>
            <Image
              source={{ uri: cuisineImage }}
              style={styles.cuisineImage}
              contentFit="cover"
            />
          </View>
        )}
      </LinearGradient>

      {/* Restaurant List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ff6b35" />
            <Text style={styles.loadingText}>Finding restaurants...</Text>
          </View>
        ) : restaurants.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="restaurant" size={64} color="#ddd" />
            <Text style={styles.emptyTitle}>No restaurants found</Text>
            <Text style={styles.emptySubtitle}>
              We couldn't find any restaurants serving {cuisineName} in your area
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>
              Best places for {cuisineName}
            </Text>
            {restaurants.map((restaurant) => (
              <RestaurantCard
                key={restaurant.id}
                restaurant={restaurant}
                onPress={() => handleRestaurantPress(restaurant.id)}
              />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
};

type RestaurantCardProps = {
  restaurant: Restaurant;
  onPress: () => void;
};

const RestaurantCard: React.FC<RestaurantCardProps> = ({
  restaurant,
  onPress,
}) => {
  const {
    name,
    heroImageUrl,
    cuisines = [],
    rating,
    deliveryTimeMin,
    deliveryTimeMax,
    costForTwo,
    isPureVeg,
    offerText,
    distanceKm,
  } = restaurant;

  const etaLabel =
    deliveryTimeMin && deliveryTimeMax
      ? `${deliveryTimeMin}-${deliveryTimeMax} mins`
      : deliveryTimeMin
      ? `${deliveryTimeMin} mins`
      : "30-40 mins";

  const ratingLabel = rating != null ? rating.toFixed(1) : "NEW";
  const cuisinesLabel = cuisines.join(", ");
  const costLabel =
    costForTwo != null ? `₹${costForTwo} for two` : "Pocket friendly";
  const distanceLabel =
    distanceKm != null ? `${distanceKm.toFixed(1)} km` : "";

  return (
    <Pressable style={styles.restaurantCard} onPress={onPress}>
      <View style={styles.cardImageWrapper}>
        {heroImageUrl ? (
          <Image
            source={{ uri: heroImageUrl }}
            style={styles.cardImage}
            contentFit="cover"
            cachePolicy="disk"
          />
        ) : (
          <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
            <MaterialIcons name="restaurant-menu" size={40} color="#ddd" />
          </View>
        )}

        {/* Gradient overlay */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.1)"]}
          style={styles.cardImageGradient}
        />

        {/* Offer banner */}
        {offerText && (
          <View style={styles.cardOfferBanner}>
            <MaterialIcons name="local-offer" size={11} color="#ff6b35" />
            <Text style={styles.cardOfferText} numberOfLines={1}>
              {offerText}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.cardInfo}>
        <View style={styles.cardNameRow}>
          <Text style={styles.cardName} numberOfLines={1}>
            {name}
          </Text>
          {isPureVeg && (
            <View style={styles.cardVegBadge}>
              <View style={styles.cardVegDot} />
            </View>
          )}
        </View>

        <View style={styles.cardMetaRow}>
          <View style={styles.cardRatingBadge}>
            <MaterialIcons name="star" size={11} color="#fff" />
            <Text style={styles.cardRatingText}>{ratingLabel}</Text>
          </View>
          <Text style={styles.cardMetaDot}>•</Text>
          <Text style={styles.cardMetaText}>{etaLabel}</Text>
          <Text style={styles.cardMetaDot}>•</Text>
          <Text style={styles.cardMetaText}>{costLabel}</Text>
        </View>

        <Text style={styles.cardCuisines} numberOfLines={1}>
          {cuisinesLabel || "Multi-cuisine"}
        </Text>

        {distanceLabel && (
          <View style={styles.cardDistanceRow}>
            <MaterialIcons name="location-on" size={11} color="#999" />
            <Text style={styles.cardDistanceText}>{distanceLabel}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f8f8",
  },
  header: {
    paddingTop: Platform.OS === "ios" ? 50 : 40,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "500",
  },
  cuisineImageContainer: {
    alignItems: "center",
    marginTop: 8,
  },
  cuisineImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.3)",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1c1c1c",
    marginHorizontal: 16,
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
  },
  restaurantCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  cardImageWrapper: {
    position: "relative",
    width: "100%",
    height: 160,
  },
  cardImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#f0f0f0",
  },
  cardImagePlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  cardImageGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 50,
  },
  cardOfferBanner: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,107,53,0.1)",
  },
  cardOfferText: {
    color: "#ff6b35",
    fontSize: 11,
    fontWeight: "700",
    flex: 1,
  },
  cardInfo: {
    padding: 12,
  },
  cardNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  cardName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: "#1c1c1c",
    letterSpacing: -0.3,
  },
  cardVegBadge: {
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: "#0f8a65",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 6,
  },
  cardVegDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#0f8a65",
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  cardRatingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1c8a5c",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
    gap: 2,
  },
  cardRatingText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  cardMetaDot: {
    color: "#999",
    fontSize: 12,
    marginHorizontal: 5,
    fontWeight: "700",
  },
  cardMetaText: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  cardCuisines: {
    fontSize: 12,
    color: "#888",
    marginBottom: 4,
  },
  cardDistanceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  cardDistanceText: {
    fontSize: 11,
    color: "#999",
    marginLeft: 2,
  },
});

export default CuisineDetailScreen;
