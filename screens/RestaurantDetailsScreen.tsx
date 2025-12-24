// screens/RestaurantDetailsScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ScrollView,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import firestore from "@react-native-firebase/firestore";
import { useRestaurantCart } from "@/context/RestaurantCartContext";
import RestaurantMenuItemRow, {
  RestaurantMenuItem as MenuItem,
} from "@/components/RestaurantMenuItemRow";

type RouteParams = {
  restaurantId: string;
  restaurantName?: string;
};

type RestaurantDoc = {
  name: string;
  coverImage?: string;
  rating?: number;
  ratingCount?: number;
  deliveryTimeMinutes?: number;
  cuisines?: string[];
  isPureVeg?: boolean;
  costForTwoMessage?: string; // e.g. "₹200 for two"
};

const RestaurantDetailsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { restaurantId, restaurantName: routeRestaurantName } =
    (route.params || {}) as RouteParams;

  const { state, totalItems, totalAmount } = useRestaurantCart();

  const [restaurant, setRestaurant] = useState<RestaurantDoc | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch restaurant + menu in real time
  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }

    const restUnsub = firestore()
      .collection("restaurants")
      .doc(restaurantId)
      .onSnapshot(
        (snap) => {
          if (snap.exists) {
            setRestaurant(snap.data() as RestaurantDoc);
          } else {
            setRestaurant(null);
          }
        },
        (err) => {
          console.warn("[RestaurantDetails] restaurant error", err);
        }
      );

    const menuUnsub = firestore()
      .collection("restaurants")
      .doc(restaurantId)
      .collection("menuItems")
      .where("isActive", "==", true)
      .onSnapshot(
        (snap) => {
          const list: MenuItem[] = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          }));
          setMenuItems(list);
          setLoading(false);
        },
        (err) => {
          console.warn("[RestaurantDetails] menu error", err);
          setLoading(false);
        }
      );

    return () => {
      restUnsub();
      menuUnsub();
    };
  }, [restaurantId]);

  const effectiveName =
    restaurant?.name || routeRestaurantName || "Restaurant";

  // Only show the bottom bar if cart belongs to this restaurant
  const showCartBar =
    totalItems > 0 && state.restaurantId === restaurantId;

  const handleViewCart = () => {
    navigation.navigate("RestaurantCheckout", {
      restaurantId,
      restaurantName: effectiveName,
    });
  };

  const renderMenuItem = ({ item }: { item: MenuItem }) => (
    <RestaurantMenuItemRow restaurantId={restaurantId} item={item} />
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#00b4a0" />
        </View>
      </SafeAreaView>
    );
  }

  if (!restaurant) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.errorText}>
            Restaurant not found or unavailable.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#222" />
        </TouchableOpacity>
        <View style={{ marginLeft: 10, flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {effectiveName}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {restaurant.cuisines?.join(", ") || "Multiple cuisines"}
          </Text>
        </View>
      </View>

      {/* CONTENT */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* TOP CARD */}
        <View style={styles.restCard}>
          <View style={{ flex: 1 }}>
            <View style={styles.ratingRow}>
              {typeof restaurant.rating === "number" && (
                <View style={styles.ratingPill}>
                  <Ionicons
                    name="star"
                    size={12}
                    color="#fff"
                    style={{ marginRight: 3 }}
                  />
                  <Text style={styles.ratingText}>
                    {restaurant.rating.toFixed(1)}
                  </Text>
                </View>
              )}

              {restaurant.ratingCount ? (
                <Text style={styles.ratingCount}>
                  ({restaurant.ratingCount})
                </Text>
              ) : null}
            </View>

            <Text style={styles.timeCostRow}>
              {restaurant.deliveryTimeMinutes
                ? `${restaurant.deliveryTimeMinutes} mins`
                : "30–40 mins"}{" "}
              •{" "}
              {restaurant.costForTwoMessage
                ? restaurant.costForTwoMessage
                : "₹200 for two"}
            </Text>

            {restaurant.isPureVeg && (
              <View style={styles.pureVegPill}>
                <Text style={styles.pureVegText}>PURE VEG</Text>
              </View>
            )}
          </View>

          {restaurant.coverImage ? (
            <Image
              source={{ uri: restaurant.coverImage }}
              style={styles.coverImage}
            />
          ) : null}
        </View>

        {/* MENU TITLE */}
        <Text style={styles.menuTitle}>Recommended for you</Text>

        {/* MENU LIST */}
        {menuItems.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyMenuText}>
              Menu coming soon. We’re onboarding dishes from this restaurant.
            </Text>
          </View>
        ) : (
          <FlatList
            data={menuItems}
            keyExtractor={(item) => item.id}
            renderItem={renderMenuItem}
            scrollEnabled={false}
            ItemSeparatorComponent={() => (
              <View style={styles.menuSeparator} />
            )}
          />
        )}
      </ScrollView>

      {/* BOTTOM VIEW CART BAR */}
      {showCartBar && (
        <TouchableOpacity style={styles.viewCartBar} onPress={handleViewCart}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons
              name="cart-outline"
              size={18}
              color="#fff"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.viewCartText}>
              View cart • {totalItems} item{totalItems > 1 ? "s" : ""} • ₹
              {totalAmount.toFixed(0)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#fff" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

export default RestaurantDetailsScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f5f5f5" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  errorText: { fontSize: 14, color: "#555", textAlign: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#222" },
  headerSubtitle: { fontSize: 12, color: "#777", marginTop: 2 },

  content: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },

  restCard: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  ratingRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#00b4a0",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ratingText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  ratingCount: { marginLeft: 6, fontSize: 11, color: "#777" },
  timeCostRow: { fontSize: 12, color: "#555", marginBottom: 4 },
  pureVegPill: {
    alignSelf: "flex-start",
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#e8f5e9",
  },
  pureVegText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2e7d32",
  },
  coverImage: { width: 72, height: 72, borderRadius: 8, marginLeft: 10 },

  menuTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#222",
    marginBottom: 8,
  },

  menuSeparator: { height: 14 },

  emptyMenuText: { fontSize: 13, color: "#777", textAlign: "center" },

  viewCartBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#00b4a0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  viewCartText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
});
