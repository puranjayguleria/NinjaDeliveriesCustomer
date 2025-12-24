import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import { useNavigation } from "@react-navigation/native";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import { useLocationContext } from "@/context/LocationContext";

type Restaurant = {
  id: string;
  name: string;
  heroImageUrl?: string;
  thumbnailUrl?: string;
  cuisines?: string[];
  rating?: number;
  avgDeliveryTimeMins?: number;
  minOrderValue?: number;
  priceLevel?: number; // 1–4
  offerText?: string; // e.g. "20% OFF above ₹300"
  isPureVeg?: boolean;
  city?: string;
  zoneId?: string;
  isActive?: boolean;
};

const PLACEHOLDER_BLURHASH = "LKO2?U%2Tw=w]~RBVZRi};ofM{ay";

const FoodHomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { location } = useLocationContext();

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRestaurants = useCallback(() => {
    setLoading(true);
    setError(null);

    let q: FirebaseFirestoreTypes.Query = firestore()
      .collection("restaurants")
      .where("isActive", "==", true);

    // Optional filters – adjust to your schema:
    // if (location.city) q = q.where("city", "==", location.city);
    // if (location.zoneId) q = q.where("zoneId", "==", location.zoneId);

    const unsub = q.onSnapshot(
      (snap) => {
        const list: Restaurant[] = snap.docs.map((doc) => {
          const data = doc.data() as any;
          return {
            id: doc.id,
            name: data.name,
            heroImageUrl: data.heroImageUrl,
            thumbnailUrl: data.thumbnailUrl,
            cuisines: data.cuisines || [],
            rating: data.rating,
            avgDeliveryTimeMins: data.avgDeliveryTimeMins,
            minOrderValue: data.minOrderValue,
            priceLevel: data.priceLevel,
            offerText: data.offerText,
            isPureVeg: data.isPureVeg,
            city: data.city,
            zoneId: data.zoneId,
            isActive: data.isActive,
          };
        });
        setRestaurants(list);
        setLoading(false);
      },
      (err) => {
        console.warn("[restaurants] error", err);
        setError("Could not load restaurants. Please try again.");
        setLoading(false);
      }
    );

    return unsub;
  }, [location]);

  useEffect(() => {
    const unsub = fetchRestaurants();
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [fetchRestaurants]);

  const renderHeader = () => {
    return (
      <View style={styles.headerWrapper}>
        <LinearGradient
          colors={["#00b4a0", "#00d2c7"]}
          style={styles.headerGradient}
        >
          <Pressable
            style={styles.locationRow}
            onPress={() =>
              navigation.navigate("LocationSelector", { fromScreen: "FoodHome" })
            }
          >
            <MaterialIcons
              name="place"
              size={20}
              color="#fff"
              style={{ marginRight: 4 }}
            />
            <Text style={styles.locationTxt} numberOfLines={1}>
              {location.address
                ? `Delivering to ${location.address}`
                : "Set delivery location"}
            </Text>
            <MaterialIcons
              name="keyboard-arrow-down"
              size={18}
              color="#fff"
            />
          </Pressable>

          <Text style={styles.headerTitle}>Order from Dharamshala’s favourites</Text>
          <Text style={styles.headerSubtitle}>
            Ninja Food • Same as restaurant prices • Low delivery fee
          </Text>
        </LinearGradient>
      </View>
    );
  };

  const renderRestaurant = ({ item }: { item: Restaurant }) => {
    const img =
      item.heroImageUrl ||
      item.thumbnailUrl ||
      "https://via.placeholder.com/400x300.png?text=Restaurant";

    const cuisineLabel = item.cuisines?.join(" • ");
    const priceLabel =
      typeof item.priceLevel === "number"
        ? "₹".repeat(item.priceLevel)
        : undefined;

    return (
      <Pressable
        style={styles.card}
        onPress={() =>
          navigation.navigate("RestaurantMenu", {
            restaurantId: item.id,
            restaurantName: item.name,
            heroImageUrl: item.heroImageUrl || item.thumbnailUrl || null,
            offerText: item.offerText || null,
          })
        }
      >
        <View style={styles.imageWrapper}>
          <Image
            source={{ uri: img }}
            style={styles.image}
            placeholder={{ blurhash: PLACEHOLDER_BLURHASH }}
            contentFit="cover"
          />
          {item.offerText ? (
            <View style={styles.offerPill}>
              <Text style={styles.offerText}>{item.offerText}</Text>
            </View>
          ) : null}
          <View style={styles.ninjaPill}>
            <Text style={styles.ninjaText}>Ninja Price Match</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardRowTop}>
            <Text style={styles.name} numberOfLines={1}>
              {item.name}
            </Text>
            {typeof item.rating === "number" && (
              <View style={styles.ratingChip}>
                <Ionicons name="star" size={12} color="#fff" />
                <Text style={styles.ratingTxt}>
                  {item.rating.toFixed(1)}
                </Text>
              </View>
            )}
          </View>

          {cuisineLabel ? (
            <Text style={styles.cuisineTxt} numberOfLines={1}>
              {cuisineLabel}
            </Text>
          ) : null}

          <View style={styles.metaRow}>
            {typeof item.avgDeliveryTimeMins === "number" && (
              <Text style={styles.metaTxt}>
                {item.avgDeliveryTimeMins} mins
              </Text>
            )}
            {item.minOrderValue ? (
              <Text style={styles.metaDot}>•</Text>
            ) : null}
            {item.minOrderValue ? (
              <Text style={styles.metaTxt}>
                Min ₹{Math.round(item.minOrderValue)}
              </Text>
            ) : null}
            {priceLabel ? (
              <>
                <Text style={styles.metaDot}>•</Text>
                <Text style={styles.metaTxt}>{priceLabel}</Text>
              </>
            ) : null}
          </View>

          <Text style={styles.subNote}>
            Same as restaurant menu • Lower delivery fee than others
          </Text>
        </View>
      </Pressable>
    );
  };

  if (loading && !restaurants.length) {
    return (
      <View style={styles.center}>
        {renderHeader()}
        <ActivityIndicator size="large" color="#00b4a0" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader()}

      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : null}

      <FlatList
        data={restaurants}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.listContent}
        renderItem={renderRestaurant}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>No restaurants yet</Text>
              <Text style={styles.emptySub}>
                We’re onboarding partners in Dharamshala. Check back soon!
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
};

export default FoodHomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fdfdfd",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerWrapper: {
    width: "100%",
  },
  headerGradient: {
    paddingTop: 60,
    paddingBottom: 18,
    paddingHorizontal: 16,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  locationTxt: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginTop: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#e0f7fa",
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  imageWrapper: {
    position: "relative",
    height: 170,
    backgroundColor: "#eee",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  offerPill: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "#e53935",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  offerText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  ninjaPill: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 16,
  },
  ninjaText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },
  cardBody: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  cardRowTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#222",
  },
  ratingChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#388e3c",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ratingTxt: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    marginLeft: 3,
  },
  cuisineTxt: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  metaTxt: {
    fontSize: 11,
    color: "#555",
    fontWeight: "600",
  },
  metaDot: {
    fontSize: 11,
    color: "#999",
    marginHorizontal: 4,
  },
  subNote: {
    marginTop: 4,
    fontSize: 11,
    color: "#777",
  },
  error: {
    textAlign: "center",
    color: "#c62828",
    marginTop: 8,
  },
  emptyBox: {
    marginTop: 40,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
    color: "#333",
  },
  emptySub: {
    fontSize: 13,
    color: "#777",
    textAlign: "center",
  },
});
