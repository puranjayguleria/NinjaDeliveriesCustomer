// screens/NinjaEatsOrderDetailScreen.tsx

import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import firestore, {
  FirebaseFirestoreTypes,
} from "@react-native-firebase/firestore";

type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  price: number;
  isVeg?: boolean;
};

type RestaurantOrderDoc = {
  restaurantName: string;
  grandTotal: number;
  status: string;
  itemTotal: number;
  packagingCharges: number;
  platformFee: number;
  deliveryFee: number;
  taxes: number;
  taxRatePercent?: number;
  couponCode?: string | null;
  couponDiscount?: number;
  tipAmount?: number;
  deliveryAddress?: {
    label?: string;
    address?: string;
  };
  createdAt?: FirebaseFirestoreTypes.Timestamp | null;
  items: OrderItem[];
};

type RouteParams = {
  orderId: string;
};

const statusSteps = [
  "pending",
  "accepted",
  "preparing",
  "picked_up",
  "delivered",
] as const;
type OrderStatus = (typeof statusSteps)[number];

const statusLabelMap: Record<OrderStatus, string> = {
  pending: "Order placed",
  accepted: "Restaurant accepted",
  preparing: "Being prepared",
  picked_up: "Picked up",
  delivered: "Delivered",
};

const statusColorMap: Record<OrderStatus, string> = {
  pending: "#ff9800",
  accepted: "#1976d2",
  preparing: "#1976d2",
  picked_up: "#512da8",
  delivered: "#388e3c",
};

const NinjaEatsOrderDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { orderId } = (route.params || {}) as RouteParams;

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<RestaurantOrderDoc | null>(null);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    const unsub = firestore()
      .collection("restaurantOrders")
      .doc(orderId)
      .onSnapshot(
        (snap) => {
          if (snap.exists) {
            setOrder(snap.data() as RestaurantOrderDoc);
          } else {
            setOrder(null);
          }
          setLoading(false);
        },
        (err) => {
          console.warn("[OrderDetail] error", err);
          setLoading(false);
        }
      );

    return () => unsub();
  }, [orderId]);

  const currentStatus: OrderStatus = useMemo(() => {
    if (!order?.status) return "pending";
    if (statusSteps.includes(order.status as OrderStatus)) {
      return order.status as OrderStatus;
    }
    return "pending";
  }, [order?.status]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#00b4a0" />
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#222" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { marginLeft: 8 }]}>
            Order details
          </Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.emptyText}>Order not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const createdAtLabel = order.createdAt
    ? order.createdAt.toDate().toLocaleString()
    : "";

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#222" />
        </TouchableOpacity>
        <View style={{ marginLeft: 10 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {order.restaurantName || "Order details"}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            Order placed on {createdAtLabel}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* STATUS TIMELINE */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Order status</Text>
          <View style={styles.timeline}>
            {statusSteps.map((step, index) => {
              const color = statusColorMap[step];
              const stepIndex = statusSteps.indexOf(step);
              const currentIndex = statusSteps.indexOf(currentStatus);
              const isDone = stepIndex <= currentIndex;

              return (
                <View key={step} style={styles.timelineRow}>
                  <View style={styles.timelineIconCol}>
                    <View
                      style={[
                        styles.timelineDot,
                        { borderColor: color, backgroundColor: isDone ? color : "#fff" },
                      ]}
                    >
                      {isDone && (
                        <Ionicons name="checkmark" size={12} color="#fff" />
                      )}
                    </View>
                    {index < statusSteps.length - 1 && (
                      <View
                        style={[
                          styles.timelineLine,
                          { backgroundColor: isDone ? color : "#ddd" },
                        ]}
                      />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.timelineLabel,
                        { color: isDone ? "#222" : "#777" },
                      ]}
                    >
                      {statusLabelMap[step]}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* DELIVERY ADDRESS */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Ionicons
              name="location-outline"
              size={18}
              color="#00b4a0"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.cardTitle}>Delivery address</Text>
          </View>
          <Text style={styles.addressLine} numberOfLines={2}>
            {order.deliveryAddress?.label
              ? `${order.deliveryAddress.label} • ${order.deliveryAddress.address}`
              : order.deliveryAddress?.address || "—"}
          </Text>
        </View>

        {/* ITEMS */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <MaterialIcons
              name="restaurant-menu"
              size={18}
              color="#00b4a0"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.cardTitle}>Items</Text>
          </View>

          {order.items?.map((it) => (
            <View key={it.id} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {it.name}
                </Text>
                <Text style={styles.itemQty}>Qty: {it.quantity}</Text>
              </View>
              <Text style={styles.itemPrice}>
                ₹{(it.price * it.quantity).toFixed(0)}
              </Text>
            </View>
          ))}
        </View>

        {/* BILL DETAILS */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Bill details</Text>

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Item total</Text>
            <Text style={styles.billValue}>
              ₹{(order.itemTotal ?? 0).toFixed(0)}
            </Text>
          </View>

          {order.couponDiscount && order.couponDiscount > 0 && (
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>
                Coupon discount {order.couponCode ? `(${order.couponCode})` : ""}
              </Text>
              <Text style={[styles.billValue, styles.negativeValue]}>
                -₹{order.couponDiscount.toFixed(0)}
              </Text>
            </View>
          )}

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Packaging charges</Text>
            <Text style={styles.billValue}>
              ₹{(order.packagingCharges ?? 0).toFixed(0)}
            </Text>
          </View>

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Delivery partner fee</Text>
            <Text style={styles.billValue}>
              ₹{(order.deliveryFee ?? 0).toFixed(0)}
            </Text>
          </View>

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Platform fee</Text>
            <Text style={styles.billValue}>
              ₹{(order.platformFee ?? 0).toFixed(0)}
            </Text>
          </View>

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>
              Taxes &amp; charges
              {order.taxRatePercent
                ? ` (${order.taxRatePercent.toFixed(0)}%)`
                : ""}
            </Text>
            <Text style={styles.billValue}>
              ₹{(order.taxes ?? 0).toFixed(0)}
            </Text>
          </View>

          {order.tipAmount && order.tipAmount > 0 && (
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Tip</Text>
              <Text style={styles.billValue}>
                ₹{order.tipAmount.toFixed(0)}
              </Text>
            </View>
          )}

          <View style={[styles.billRow, styles.grandTotalRow]}>
            <Text style={styles.grandTotalLabel}>Total paid</Text>
            <Text style={styles.grandTotalValue}>
              ₹{(order.grandTotal ?? 0).toFixed(0)}
            </Text>
          </View>
        </View>

        {/* SUPPORT */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Need help?</Text>
          <Text style={styles.smallNote}>
            Something not right with your order? You can contact the store or
            Ninja support from the Contact Us section.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default NinjaEatsOrderDetailScreen;

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
  headerSubtitle: { fontSize: 11, color: "#777", marginTop: 2 },

  content: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },

  card: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#222",
  },
  addressLine: {
    fontSize: 13,
    color: "#444",
    marginTop: 4,
  },

  // Timeline
  timeline: {
    marginTop: 8,
  },
  timelineRow: {
    flexDirection: "row",
    marginBottom: 10,
  },
  timelineIconCol: {
    alignItems: "center",
    marginRight: 10,
  },
  timelineDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 2,
  },
  timelineLabel: {
    fontSize: 13,
    fontWeight: "600",
  },

  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  itemName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#222",
  },
  itemQty: { fontSize: 12, color: "#777", marginTop: 2 },
  itemPrice: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
    marginLeft: 8,
  },

  billRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  billLabel: {
    fontSize: 13,
    color: "#444",
  },
  billValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
  },
  negativeValue: { color: "#388e3c" },
  grandTotalRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#ddd",
  },
  grandTotalLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#000",
  },
  grandTotalValue: {
    fontSize: 15,
    fontWeight: "800",
    color: "#000",
  },

  smallNote: {
    fontSize: 11,
    color: "#777",
    marginTop: 4,
  },
});
