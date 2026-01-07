// screens/NinjaEatsOrdersScreen.tsx

import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import firestore, {
  FirebaseFirestoreTypes,
} from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { useNavigation } from "@react-navigation/native";

type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  price: number;
  isVeg?: boolean;
};

type RestaurantOrder = {
  id: string;
  restaurantName: string;
  grandTotal: number;
  status: string; // pending / accepted / preparing / picked_up / delivered / cancelled
  createdAt?: FirebaseFirestoreTypes.Timestamp | null;
  items: OrderItem[];
};

const statusLabelMap: Record<string, string> = {
  pending: "Waiting for confirmation",
  accepted: "Restaurant accepted",
  preparing: "Being prepared",
  picked_up: "On the way",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const statusColorMap: Record<string, string> = {
  pending: "#ff9800",
  accepted: "#1976d2",
  preparing: "#1976d2",
  picked_up: "#512da8",
  delivered: "#388e3c",
  cancelled: "#d32f2f",
};

const NinjaEatsOrdersScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<RestaurantOrder[]>([]);

  useEffect(() => {
    const user = auth().currentUser;
    if (!user) {
      setLoading(false);
      setOrders([]);
      return;
    }

    const unsub = firestore()
      .collection("restaurantOrders")
      .where("userId", "==", user.uid)
      .orderBy("createdAt", "desc")
      .onSnapshot(
        (snap) => {
          const list: RestaurantOrder[] = snap.docs.map((d) => {
            const data = d.data() as any;
            return {
              id: d.id,
              restaurantName: data.restaurantName ?? "Restaurant",
              grandTotal: data.grandTotal ?? 0,
              status: data.status ?? "pending",
              createdAt: data.createdAt ?? null,
              items: (data.items ?? []) as OrderItem[],
            };
          });
          setOrders(list);
          setLoading(false);
        },
        (err) => {
          console.warn("[NinjaEatsOrders] error", err);
          setLoading(false);
        }
      );

    return () => unsub();
  }, []);

  const ongoingOrders = useMemo(
    () =>
      orders.filter((o) =>
        ["pending", "accepted", "preparing", "picked_up"].includes(o.status)
      ),
    [orders]
  );
  const pastOrders = useMemo(
    () =>
      orders.filter((o) =>
        ["delivered", "cancelled"].includes(o.status)
      ),
    [orders]
  );

  const renderOrderCard = useCallback(({ item }: { item: RestaurantOrder }) => {
    const label = statusLabelMap[item.status] ?? item.status;
    const color = statusColorMap[item.status] ?? "#555";

    const firstThree = item.items.slice(0, 3).map((it) => it.name).join(", ");
    const remainingCount = Math.max(0, item.items.length - 3);
    const itemsSummary =
      remainingCount > 0
        ? `${firstThree} +${remainingCount} more`
        : firstThree || `${item.items.length} item(s)`;

    let timeLabel = "";
    if (item.createdAt) {
      const date = item.createdAt.toDate();
      timeLabel = date.toLocaleString();
    }

    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() =>
          navigation.navigate("NinjaEatsOrderDetail", {
            orderId: item.id,
          })
        }
      >
        <View style={styles.orderHeaderRow}>
          <Text style={styles.restaurantName} numberOfLines={1}>
            {item.restaurantName}
          </Text>
          <View style={[styles.statusPill, { backgroundColor: `${color}20` }]}>
            <View
              style={[styles.statusDot, { backgroundColor: color }]}
            />
            <Text style={[styles.statusText, { color }]} numberOfLines={1}>
              {label}
            </Text>
          </View>
        </View>

        <Text style={styles.itemsSummary} numberOfLines={1}>
          {itemsSummary}
        </Text>

        <View style={styles.orderBottomRow}>
          <Text style={styles.amountText}>
            ₹{item.grandTotal.toFixed(0)}
          </Text>
          <View style={styles.timeRow}>
            <Ionicons
              name="time-outline"
              size={12}
              color="#777"
              style={{ marginRight: 4 }}
            />
            <Text style={styles.timeText} numberOfLines={1}>
              {timeLabel}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [navigation]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#00b4a0" />
        </View>
      </SafeAreaView>
    );
  }

  if (!orders.length) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Orders</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.emptyText}>
            You haven&apos;t ordered food yet.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Orders</Text>
      </View>

      <FlatList
        ListHeaderComponent={
          <>
            {ongoingOrders.length > 0 && (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Ongoing</Text>
              </View>
            )}
          </>
        }
        data={ongoingOrders}
        keyExtractor={(item) => `ongoing-${item.id}`}
        renderItem={renderOrderCard}
        // 🔥 PERFORMANCE OPTIMIZATIONS
        removeClippedSubviews={true}
        maxToRenderPerBatch={8}
        windowSize={8}
        initialNumToRender={6}
        updateCellsBatchingPeriod={50}
        getItemLayout={(data, index) => ({
          length: 120, // Approximate item height
          offset: 120 * index,
          index,
        })}
        ListFooterComponent={
          <>
            {pastOrders.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Past orders</Text>
                </View>
                {pastOrders.map((o) => (
                  <View key={`past-${o.id}`}>{renderOrderCard({ item: o })}</View>
                ))}
              </>
            )}
          </>
        }
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
};

export default NinjaEatsOrdersScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f5f5f5" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  emptyText: { fontSize: 14, color: "#777", textAlign: "center" },

  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#222" },

  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },

  sectionHeader: {
    marginTop: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#555",
  },

  orderCard: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
  orderHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  restaurantName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: "#222",
    marginRight: 8,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },

  itemsSummary: {
    fontSize: 12,
    color: "#555",
    marginTop: 2,
    marginBottom: 8,
  },

  orderBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  amountText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#222",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeText: {
    fontSize: 11,
    color: "#777",
    maxWidth: 150,
  },
});
