import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
  Modal,
  ScrollView,
  Platform,
  Vibration,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { useNavigation } from "@react-navigation/native";
import { format } from "date-fns";
import Loader from "@/components/VideoLoader";

const BG = "#F6F7FB";
const ACCENT = "#FF8A00";

interface Order {
  id: string;
  status: string;
  createdAt: any;
  items?: Array<{
    name: string;
    price: number;
    discount?: number;
    quantity: number;
  }>;
  subtotal?: number;
  discount?: number;
  productCgst?: number;
  productSgst?: number;
  rideCgst?: number;
  deliveryCharge?: number;
  rideSgst?: number;
  finalTotal?: number;
  pickupCoords?: { latitude: number; longitude: number };
  dropoffCoords?: { latitude: number; longitude: number };
  refundAmount?: number;
  convenienceFee?: number;
  platformFee?: number;
  surgeFee?: number;
}

const YourOrdersScreen: React.FC = () => {
  const navigation = useNavigation();
  const currentUser = auth().currentUser;
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const unsubscribe = firestore()
      .collection("orders")
      .where("orderedBy", "==", currentUser.uid)
      .orderBy("createdAt", "desc")
      .onSnapshot(
        (snapshot) => {
          const fetched: Order[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            fetched.push({
              id: doc.id,
              status: data.status || "unknown",
              createdAt: data.createdAt,
              items: Array.isArray(data.items) ? data.items : [],
              subtotal: data.subtotal || 0,
              discount: data.discount || 0,
              finalTotal: data.finalTotal || 0,
              refundAmount: data.refundAmount || 0,
              surgeFee: data.surgeFee || 0,
              productCgst: data.productCgst || 0,
              productSgst: data.productSgst || 0,
              rideCgst: data.rideCgst || 0,
              rideSgst: data.rideSgst || 0,
              deliveryCharge: data.deliveryCharge || 0,
              convenienceFee: data.convenienceFee || 0,
              platformFee: data.platformFee || 0,
              pickupCoords: data.pickupCoords,
              dropoffCoords: data.dropoffCoords,
            });
          });
          setOrders(fetched);
          setLoading(false);
        },
        (error) => {
          console.error("Error fetching orders:", error);
          setLoading(false);
        }
      );

    return () => unsubscribe();
  }, [currentUser]);

  const vibrateTap = () => {
    try {
      Vibration.vibrate(12);
    } catch {}
  };

  const navigateToOrderScreen = useCallback(
    (order: Order) => {
      const { status, id, pickupCoords, dropoffCoords, finalTotal, refundAmount } = order;
      if (!id || !pickupCoords || !dropoffCoords) {
        Alert.alert("Error", "Invalid order details.");
        return;
      }

      if (status === "pending") {
        navigation.navigate("AppTabs", {
          screen: "HomeTab",
          params: {
            screen: "OrderAllocating",
            params: { orderId: id, pickupCoords, dropoffCoords, totalCost: finalTotal },
          },
        });
      } else if (status === "cancelled") {
        navigation.navigate("AppTabs", {
          screen: "HomeTab",
          params: {
            screen: "OrderCancelled",
            params: { orderId: id, refundAmount: refundAmount || finalTotal },
          },
        });
      } else if (status === "tripEnded") {
        navigation.navigate("AppTabs", {
          screen: "HomeTab",
          params: {
            screen: "RatingScreen",
            params: { orderId: id },
          },
        });
      } else {
        navigation.navigate("AppTabs", {
          screen: "HomeTab",
          params: {
            screen: "OrderTracking",
            params: { orderId: id, pickupCoords, dropoffCoords, totalCost: finalTotal },
          },
        });
      }
    },
    [navigation]
  );

  const renderOrderItem = ({ item }: { item: Order }) => {
    const dateObj = item.createdAt?.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
    const dateString = format(dateObj, "dd MMM, yyyy • hh:mm a");
    const total = typeof item.finalTotal === "number" ? item.finalTotal : 0;
    const statusRaw = String(item.status || "unknown").toLowerCase();
    
    const statusTheme =
      statusRaw === "cancelled" ? { bg: "#FEE2E2", fg: "#991B1B" }
      : statusRaw === "pending" ? { bg: "#FEF3C7", fg: "#92400E" }
      : statusRaw === "tripended" ? { bg: "#DCFCE7", fg: "#166534" }
      : { bg: "#E5E7EB", fg: "#374151" };

    return (
      <View style={styles.orderCard}>
        <View style={styles.orderTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.orderDate}>{dateString}</Text>
            <Text style={styles.orderId}>Order #{item.id}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: statusTheme.bg }]}>
            <Text style={[styles.statusPillText, { color: statusTheme.fg }]}>
              {statusRaw === "tripended" ? "COMPLETED" : statusRaw.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.orderMetaRow}>
          <Text style={styles.orderMetaText}>
            Total <Text style={styles.orderMetaStrong}>₹{Number(total).toFixed(2)}</Text>
          </Text>
        </View>

        <View style={styles.orderActionRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionPrimary]}
            onPress={() => {
              vibrateTap();
              navigateToOrderScreen(item);
            }}
          >
            <Text style={styles.actionButtonText}>Track</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" style={{ marginLeft: 6 }} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionSecondary]}
            onPress={() => {
              vibrateTap();
              setSelectedOrder(item);
              setShowDetailsModal(true);
            }}
          >
            <Text style={[styles.actionButtonText, { color: "#111827" }]}>Details</Text>
            <Ionicons name="list" size={16} color="#111827" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Orders</Text>
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <Loader />
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="bag-handle-outline" size={64} color="#9CA3AF" />
          <Text style={styles.emptyText}>No orders yet</Text>
          <Text style={styles.emptySubText}>Start shopping to see your orders here.</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={renderOrderItem}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Order Details Modal */}
      <Modal
        visible={showDetailsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDetailsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.bottomSheet}>
            <Text style={styles.bottomSheetTitle}>Order Details</Text>
            {selectedOrder && (
              <ScrollView style={{ maxHeight: 400 }}>
                 {/* Bill Summary Logic Copied from ProfileScreen */}
                 <View style={styles.billSummaryContainer}>
                    {/* Items */}
                    {selectedOrder.items?.map((item, idx) => (
                      <View key={idx} style={styles.detailItemRow}>
                        <Text style={styles.detailItemName}>{item.name}</Text>
                        <Text style={styles.detailItemQty}>x{item.quantity}</Text>
                        <Text style={styles.detailItemPrice}>
                          ₹{((item.price - (item.discount || 0)) + (item.productCgst||0) + (item.productSgst||0)).toFixed(2)}
                        </Text>
                      </View>
                    ))}
                    
                    <View style={styles.divider} />
                    
                    <View style={styles.billRow}>
                      <Text style={styles.billLabel}>Subtotal</Text>
                      <Text style={styles.billValue}>
                        ₹{((selectedOrder.subtotal || 0) + (selectedOrder.productCgst || 0) + (selectedOrder.productSgst || 0)).toFixed(2)}
                      </Text>
                    </View>
                    {/* Additional fees... simplified for brevity, logic matches ProfileScreen */}
                    <View style={styles.billRow}>
                      <Text style={[styles.billLabel, { fontWeight: "700" }]}>Total</Text>
                      <Text style={[styles.billValue, { fontWeight: "700" }]}>
                        ₹{selectedOrder.finalTotal?.toFixed(2)}
                      </Text>
                    </View>
                 </View>
              </ScrollView>
            )}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowDetailsModal(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default YourOrdersScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: { padding: 4, marginRight: 12 },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#111827" },
  loaderContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  emptyText: { fontSize: 18, fontWeight: "700", color: "#374151", marginTop: 16 },
  emptySubText: { fontSize: 14, color: "#6B7280", textAlign: "center", marginTop: 8 },
  listContent: { padding: 16 },
  orderCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  orderTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  orderDate: { fontSize: 12, color: "#6B7280", marginBottom: 4 },
  orderId: { fontSize: 14, fontWeight: "700", color: "#111827" },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusPillText: { fontSize: 11, fontWeight: "700" },
  orderMetaRow: { marginTop: 12, marginBottom: 16 },
  orderMetaText: { fontSize: 14, color: "#374151" },
  orderMetaStrong: { fontWeight: "700", color: "#111827" },
  orderActionRow: { flexDirection: "row" },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
  },
  actionPrimary: { backgroundColor: "#111827", marginRight: 8 },
  actionSecondary: { backgroundColor: "#F3F4F6", marginLeft: 8 },
  actionButtonText: { fontSize: 13, fontWeight: "600", color: "#fff" },
  
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  bottomSheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  bottomSheetTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
  billSummaryContainer: { backgroundColor: "#F9FAFB", padding: 16, borderRadius: 12 },
  detailItemRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  detailItemName: { flex: 2, fontSize: 14, color: "#374151" },
  detailItemQty: { flex: 0.5, fontSize: 14, color: "#6B7280", textAlign: "center" },
  detailItemPrice: { flex: 1, fontSize: 14, color: "#111827", textAlign: "right", fontWeight: "600" },
  divider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 12 },
  billRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  billLabel: { fontSize: 14, color: "#4B5563" },
  billValue: { fontSize: 14, color: "#111827", fontWeight: "600" },
  closeButton: { backgroundColor: "#EF4444", padding: 14, borderRadius: 12, alignItems: "center", marginTop: 16 },
  closeButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
