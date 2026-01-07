// @/components/RestaurantTile.tsx
import React, { useEffect, useRef, memo } from "react";
import { View, Text, StyleSheet, Pressable, Animated } from "react-native";
import { Image } from "expo-image";
import { MaterialIcons } from "@expo/vector-icons";

export type Restaurant = {
  id: string;
  name: string;
  coverImageUrl?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  cuisines?: string[];
  avgRating?: number;
  ratingCount?: number;
  deliveryTimeMins?: number;
  costForTwo?: number;
  distanceKm?: number;
  offerShortText?: string;
  isVegOnly?: boolean;
  isPromoted?: boolean;
};

type Props = {
  restaurant: Restaurant;
  onPress?: () => void;
};

const RestaurantTile: React.FC<Props> = ({ restaurant, onPress }) => {
  const scale = useRef(new Animated.Value(0.95)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scale, opacity]);

  const img =
    restaurant.coverImageUrl ||
    restaurant.imageUrl ||
    restaurant.thumbnailUrl ||
    "";

  const cuisines = restaurant.cuisines?.join(", ");
  const rating = restaurant.avgRating ?? null;

  const time = restaurant.deliveryTimeMins
    ? `${restaurant.deliveryTimeMins} mins`
    : null;
  const cost = restaurant.costForTwo
    ? `₹${restaurant.costForTwo} for two`
    : null;
  const metaLine = [time, cost].filter(Boolean).join(" • ");

  return (
    <Animated.View
      style={[styles.cardWrapper, { opacity, transform: [{ scale }] }]}
    >
      <Pressable style={styles.card} onPress={onPress}>
        <View style={styles.imageWrapper}>
          {img ? (
            <Image source={{ uri: img }} style={styles.image} contentFit="cover" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <MaterialIcons name="restaurant" size={28} color="#888" />
            </View>
          )}

          {restaurant.offerShortText ? (
            <View style={styles.offerPill}>
              <Text style={styles.offerText}>{restaurant.offerShortText}</Text>
            </View>
          ) : null}

          {restaurant.isPromoted ? (
            <View style={styles.promotedTag}>
              <Text style={styles.promotedText}>PROMOTED</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {restaurant.name}
          </Text>

          <View style={styles.ratingRow}>
            {rating !== null ? (
              <View style={styles.ratingPill}>
                <MaterialIcons
                  name="star"
                  size={12}
                  color="#fff"
                  style={{ marginRight: 2 }}
                />
                <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
              </View>
            ) : null}

            {metaLine ? (
              <Text style={styles.metaText} numberOfLines={1}>
                {metaLine}
              </Text>
            ) : null}
          </View>

          {cuisines ? (
            <Text style={styles.cuisines} numberOfLines={1}>
              {cuisines}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
};

export default memo(RestaurantTile, (prevProps, nextProps) => {
  // Only re-render if restaurant data actually changed
  return (
    prevProps.restaurant.id === nextProps.restaurant.id &&
    prevProps.restaurant.name === nextProps.restaurant.name &&
    prevProps.restaurant.avgRating === nextProps.restaurant.avgRating &&
    prevProps.restaurant.deliveryTimeMins === nextProps.restaurant.deliveryTimeMins &&
    prevProps.restaurant.costForTwo === nextProps.restaurant.costForTwo
  );
});

const styles = StyleSheet.create({
  cardWrapper: {
    marginRight: 12,
  },
  card: {
    width: 260,
    borderRadius: 14,
    backgroundColor: "#fff",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  imageWrapper: {
    width: "100%",
    height: 140,
    backgroundColor: "#f2f2f2",
  },
  image: { width: "100%", height: "100%" },
  imagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  name: { fontSize: 15, fontWeight: "700", color: "#222" },
  ratingRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#00b4a0",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ratingText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  metaText: { fontSize: 11, color: "#555", flexShrink: 1 },
  cuisines: { marginTop: 4, fontSize: 11, color: "#777" },
  offerPill: {
    position: "absolute",
    left: 8,
    bottom: 8,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  offerText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  promotedTag: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  promotedText: { fontSize: 10, color: "#444", fontWeight: "600" },
});
