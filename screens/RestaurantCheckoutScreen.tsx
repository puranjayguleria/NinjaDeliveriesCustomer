// screens/RestaurantCheckoutScreen.tsx

import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Switch,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import firestore, {
  FirebaseFirestoreTypes,
} from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";

import { useRestaurantCart } from "../context/RestaurantCartContext";
import { useLocationContext } from "@/context/LocationContext";

type RouteParams = {
  restaurantId?: string;
  restaurantName?: string;
};

type RestaurantDoc = {
  name: string;
  areaId?: string;
  addressLine?: string;
  deliveryTimeMin?: number;
  deliveryTimeMax?: number;
  isOpen?: boolean;
  minOrderValue?: number;
  packagingChargePerItem?: number; // e.g. 5
  platformFee?: number; // e.g. 0 or 5
  deliveryFee?: number; // e.g. 25
  taxRatePercent?: number; // e.g. 5
};

type RestaurantCartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  isVeg?: boolean;
  imageUrl?: string;
};

type AppliedCoupon = {
  code: string;
  discountAmount: number;
  description?: string;
};

const DEFAULT_PACKAGING_PER_ITEM = 5;
const DEFAULT_PLATFORM_FEE = 0;
const DEFAULT_DELIVERY_FEE = 25;
const DEFAULT_TAX_RATE = 5;

const RestaurantCheckoutScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const {
    restaurantId: routeRestaurantId,
    restaurantName: routeRestaurantName,
  } = (route.params || {}) as RouteParams;

  const { state, clearCart } = useRestaurantCart();
  const { location } = useLocationContext();

  const [restaurant, setRestaurant] = useState<RestaurantDoc | null>(null);
  const [tipAmount, setTipAmount] = useState<number>(0);
  const [placingOrder, setPlacingOrder] = useState(false);

  const [noCutlery, setNoCutlery] = useState<boolean>(true);
  const [specialInstructions, setSpecialInstructions] = useState<string>("");
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(
    null
  );

  const restaurantId = routeRestaurantId || state.restaurantId;
  const restaurantName =
    restaurant?.name ||
    routeRestaurantName ||
    state.restaurantName ||
    "Restaurant";

  // ─────────────────────────────────────────────
  // Fetch restaurant doc (for minOrderValue, fees, ETA, etc.)
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!restaurantId) return;
    const unsub = firestore()
      .collection("restaurants")
      .doc(restaurantId)
      .onSnapshot(
        (snap) => {
          if (snap.exists) setRestaurant(snap.data() as RestaurantDoc);
          else setRestaurant(null);
        },
        (err) => console.warn("[RestaurantCheckout] restaurant error", err)
      );
    return () => unsub();
  }, [restaurantId]);

  const items: RestaurantCartItem[] = useMemo(() => {
    if (!state?.items) return [];
    return Object.values(state.items) as RestaurantCartItem[];
  }, [state?.items]);

  const itemCount = useMemo(
    () => items.reduce((sum, it) => sum + (it.quantity || 0), 0),
    [items]
  );

  const itemTotal = useMemo(
    () => items.reduce((sum, it) => sum + it.price * (it.quantity || 0), 0),
    [items]
  );

  // ─────────────────────────────────────────────
  // Pricing calculation (Swiggy/Zomato-style)
  // ─────────────────────────────────────────────
  const pricing = useMemo(() => {
    const packagingPerItem =
      restaurant?.packagingChargePerItem ?? DEFAULT_PACKAGING_PER_ITEM;
    const platformFee = restaurant?.platformFee ?? DEFAULT_PLATFORM_FEE;
    const deliveryFee = restaurant?.deliveryFee ?? DEFAULT_DELIVERY_FEE;
    const taxRate = restaurant?.taxRatePercent ?? DEFAULT_TAX_RATE;

    const packagingCharges = itemCount * packagingPerItem;

    // Coupon discount (flat demo)
    const couponDiscountRaw = appliedCoupon?.discountAmount ?? 0;
    const couponDiscount = Math.min(couponDiscountRaw, itemTotal);
    const itemTotalAfterDiscount = itemTotal - couponDiscount;

    const taxableBase = itemTotalAfterDiscount + packagingCharges + platformFee;
    const taxes = (taxableBase * taxRate) / 100;

    const subtotalBeforeTip =
      itemTotalAfterDiscount +
      packagingCharges +
      platformFee +
      deliveryFee +
      taxes;

    const grandTotal = Math.max(0, subtotalBeforeTip + tipAmount);

    return {
      packagingCharges,
      platformFee,
      deliveryFee,
      taxes,
      subtotalBeforeTip,
      grandTotal,
      taxRate,
      packagingPerItem,
      couponDiscount,
      itemTotalAfterDiscount,
      savings: couponDiscount,
    };
  }, [itemTotal, itemCount, tipAmount, restaurant, appliedCoupon]);

  const etaLabel =
    restaurant?.deliveryTimeMin && restaurant?.deliveryTimeMax
      ? `${restaurant.deliveryTimeMin}-${restaurant.deliveryTimeMax} mins`
      : "30–40 mins";

  const headerSecondaryLine = `${etaLabel} • ${itemCount} item${
    itemCount > 1 ? "s" : ""
  } • ₹${pricing.grandTotal.toFixed(0)}`;

  // ─────────────────────────────────────────────
  // Address handling
  // ─────────────────────────────────────────────
  const handleChangeAddress = () => {
    navigation.navigate("LocationSelector", {
      fromScreen: "RestaurantCheckout",
    });
  };

  // ─────────────────────────────────────────────
  // Coupon bottom sheet (simplified as Alert)
  // ─────────────────────────────────────────────
  const handleApplyCouponPress = () => {
    if (!items.length) {
      Alert.alert("Cart is empty", "Add items before applying a coupon.");
      return;
    }

    const message = appliedCoupon
      ? `Coupon ${appliedCoupon.code} is already applied.`
      : "Apply NINJA50 to get ₹50 off on food items in this order.";

    const buttons: any[] = [];

    if (appliedCoupon) {
      buttons.push({
        text: "Remove coupon",
        style: "destructive",
        onPress: () => setAppliedCoupon(null),
      });
    }

    buttons.push(
      {
        text: "Apply NINJA50",
        onPress: () =>
          setAppliedCoupon({
            code: "NINJA50",
            discountAmount: 50,
            description: "Flat ₹50 off on this order.",
          }),
      },
      { text: "Cancel", style: "cancel" }
    );

    Alert.alert("Apply coupon", message, buttons);
  };

  // ─────────────────────────────────────────────
  // Place order
  // ─────────────────────────────────────────────
  const handlePlaceOrder = async () => {
    if (placingOrder) return;

    if (!items.length) {
      Alert.alert("Cart is empty", "Add at least one item to place an order.");
      return;
    }
    if (!restaurantId) {
      Alert.alert("Something went wrong", "Missing restaurant information.");
      return;
    }

    if (!location?.address) {
      Alert.alert(
        "Choose delivery address",
        "Select where you want this order delivered.",
        [
          {
            text: "Select address",
            onPress: () =>
              navigation.navigate("LocationSelector", {
                fromScreen: "RestaurantCheckout",
              }),
          },
          { text: "Cancel", style: "cancel" },
        ]
      );
      return;
    }

    if (restaurant && restaurant.isOpen === false) {
      Alert.alert(
        "Restaurant closed",
        "This restaurant is not accepting orders right now."
      );
      return;
    }

    if (restaurant?.minOrderValue && itemTotal < restaurant.minOrderValue) {
      Alert.alert(
        "Minimum order not reached",
        `Add items worth at least ₹${restaurant.minOrderValue} to order from this restaurant.`
      );
      return;
    }

    const user = auth().currentUser;
    if (!user) {
      Alert.alert("Login required", "Please login to place a food order.", [
        {
          text: "Login",
          onPress: () =>
            navigation.navigate("HomeTab", {
              screen: "LoginInHomeStack",
            }),
        },
        { text: "Cancel", style: "cancel" },
      ]);
      return;
    }

    try {
      setPlacingOrder(true);

      const orderItems = items.map((it) => ({
        id: it.id,
        name: it.name,
        price: it.price,
        quantity: it.quantity,
        isVeg: it.isVeg ?? true,
      }));

      const orderDoc = {
        userId: user.uid,
        restaurantId,
        restaurantName,
        items: orderItems,
        itemTotal,
        packagingCharges: pricing.packagingCharges,
        platformFee: pricing.platformFee,
        deliveryFee: pricing.deliveryFee,
        taxes: pricing.taxes,
        taxRatePercent: pricing.taxRate,
        couponCode: appliedCoupon?.code ?? null,
        couponDiscount: pricing.couponDiscount,
        tipAmount,
        grandTotal: pricing.grandTotal,
        noCutlery,
        specialInstructions: specialInstructions.trim() || null,
        deliveryAddress: {
          label: location.placeLabel ?? "",
          address: location.address ?? "",
          lat: location.lat ?? null,
          lng: location.lng ?? null,
        },
        paymentMethod: "COD", // online later
        status: "pending", // pending -> accepted -> preparing -> picked_up -> delivered
        createdAt: firestore.FieldValue.serverTimestamp() as FirebaseFirestoreTypes.FieldValue,
        source: "ninjaEats",
      };

      const ref = await firestore()
        .collection("restaurantOrders")
        .add(orderDoc);

      clearCart();

      const tabNav = navigation.getParent(); // this should be NinjaEatsTabs

      Alert.alert(
        "Order placed",
        "Your food order has been placed successfully.",
        [
          {
            text: "Track order",
            onPress: () => {
              if (tabNav) {
                tabNav.navigate("OrdersTab", {
                  screen: "NinjaEatsOrderDetail",
                  params: { orderId: ref.id },
                });
              } else {
                navigation.navigate("NinjaEatsOrderDetail", {
                  orderId: ref.id,
                });
              }
            },
          },
          {
            text: "OK",
            style: "cancel",
            onPress: () => {
              if (tabNav) {
                tabNav.navigate("NinjaEatsHomeTab");
              } else {
                navigation.popToTop();
              }
            },
          },
        ]
      );
    } catch (err: any) {
      console.error("[RestaurantCheckout] place order error", err);
      Alert.alert(
        "Something went wrong",
        "We could not place your order. Please try again."
      );
    } finally {
      setPlacingOrder(false);
    }
  };

  // ─────────────────────────────────────────────
  // Empty cart state
  // ─────────────────────────────────────────────
  if (!items.length) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#222" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Review & pay</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.emptyText}>Your food cart is empty.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────
  // UI
  // ─────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#222" />
        </TouchableOpacity>
        <View style={{ marginLeft: 10 }}>
          <Text style={styles.headerTitle}>Review & pay</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {restaurantName} • {headerSecondaryLine}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* ADDRESS CARD */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Ionicons
              name="location-outline"
              size={18}
              color="#00b4a0"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.cardTitle}>Delivering to</Text>
          </View>

          {location?.address ? (
            <>
              <Text style={styles.addressLine} numberOfLines={2}>
                {location.placeLabel
                  ? `${location.placeLabel} • ${location.address}`
                  : location.address}
              </Text>
              <TouchableOpacity
                style={styles.changeLink}
                onPress={handleChangeAddress}
              >
                <Text style={styles.changeLinkText}>Change</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={styles.selectAddressBtn}
              onPress={handleChangeAddress}
            >
              <Text style={styles.selectAddressText}>
                Select delivery address
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ITEMS CARD */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <MaterialIcons
              name="restaurant-menu"
              size={18}
              color="#00b4a0"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.cardTitle}>Items in this order</Text>
          </View>

          {items.map((it) => (
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

        {/* ORDER PREFERENCES */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Order preferences</Text>

          <View style={styles.preferenceRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.preferenceLabel}>No cutlery needed</Text>
              <Text style={styles.preferenceSubLabel}>
                Help reduce plastic waste. We’ll skip disposable cutlery.
              </Text>
            </View>
            <Switch
              value={noCutlery}
              onValueChange={setNoCutlery}
              thumbColor={noCutlery ? "#00b4a0" : "#f4f3f4"}
              trackColor={{ false: "#ccc", true: "#b2dfdb" }}
            />
          </View>

          <View style={{ marginTop: 12 }}>
            <Text style={styles.preferenceLabel}>
              Cooking / delivery instructions
            </Text>
            <TextInput
              style={styles.instructionsInput}
              placeholder="Eg. Less spicy, ring the bell once, call on arrival..."
              value={specialInstructions}
              onChangeText={setSpecialInstructions}
              multiline
              numberOfLines={3}
            />
          </View>
        </View>

        {/* OFFERS & COUPONS */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Ionicons
              name="pricetag-outline"
              size={18}
              color="#ff6f00"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.cardTitle}>Offers & coupons</Text>
          </View>
          <TouchableOpacity
            style={styles.applyCouponRow}
            onPress={handleApplyCouponPress}
          >
            <Text style={styles.applyCouponLabel}>
              {appliedCoupon
                ? `${appliedCoupon.code} applied`
                : "Apply coupon"}
            </Text>
            <Text style={styles.applyCouponChange}>
              {appliedCoupon ? "Change" : "View offers"}
            </Text>
          </TouchableOpacity>
          {appliedCoupon?.description ? (
            <Text style={styles.smallNote}>{appliedCoupon.description}</Text>
          ) : null}
        </View>

        {/* BILL DETAILS */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Bill details</Text>

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Item total</Text>
            <Text style={styles.billValue}>₹{itemTotal.toFixed(0)}</Text>
          </View>

          {pricing.couponDiscount > 0 && (
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>
                Coupon discount ({appliedCoupon?.code})
              </Text>
              <Text style={[styles.billValue, styles.negativeValue]}>
                -₹{pricing.couponDiscount.toFixed(0)}
              </Text>
            </View>
          )}

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>
              Packaging charges (₹
              {pricing.packagingPerItem.toFixed(0)} × {itemCount})
            </Text>
            <Text style={styles.billValue}>
              ₹{pricing.packagingCharges.toFixed(0)}
            </Text>
          </View>

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Delivery partner fee</Text>
            <Text style={styles.billValue}>
              ₹{pricing.deliveryFee.toFixed(0)}
            </Text>
          </View>

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Platform fee</Text>
            <Text style={styles.billValue}>
              {pricing.platformFee > 0
                ? `₹${pricing.platformFee.toFixed(0)}`
                : "₹0 (NinjaEats special)"}
            </Text>
          </View>

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>
              Taxes &amp; charges ({pricing.taxRate}%)
            </Text>
            <Text style={styles.billValue}>₹{pricing.taxes.toFixed(0)}</Text>
          </View>

          {tipAmount > 0 && (
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Tip</Text>
              <Text style={styles.billValue}>₹{tipAmount.toFixed(0)}</Text>
            </View>
          )}

          <View style={[styles.billRow, styles.grandTotalRow]}>
            <Text style={styles.grandTotalLabel}>To pay</Text>
            <Text style={styles.grandTotalValue}>
              ₹{pricing.grandTotal.toFixed(0)}
            </Text>
          </View>

          {pricing.savings > 0 && (
            <Text style={styles.savingsText}>
              You save ₹{pricing.savings.toFixed(0)} on this order
            </Text>
          )}
        </View>

        {/* TIP CARD */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Ionicons
              name="heart-outline"
              size={18}
              color="#e91e63"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.cardTitle}>Tip your delivery partner</Text>
          </View>
          <Text style={styles.smallNote}>
            100% of your tip goes to the delivery partner.
          </Text>
          <View style={styles.tipRow}>
            {[0, 10, 20, 30].map((val) => (
              <TouchableOpacity
                key={val}
                style={[
                  styles.tipChip,
                  tipAmount === val && styles.tipChipActive,
                ]}
                onPress={() => setTipAmount(val)}
              >
                <Text
                  style={[
                    styles.tipChipText,
                    tipAmount === val && styles.tipChipTextActive,
                  ]}
                >
                  {val === 0 ? "No tip" : `₹${val}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* PAYMENT INFO */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pay using</Text>
          <Text style={styles.smallNote}>
            Online payments coming soon. For now, pay cash or UPI to the rider
            at the doorstep.
          </Text>
        </View>
      </ScrollView>

      {/* BOTTOM “PLACE ORDER” BAR */}
      <View style={styles.bottomBar}>
        <View>
          <Text style={styles.bottomTotalLabel}>To pay</Text>
          <Text style={styles.bottomTotalValue}>
            ₹{pricing.grandTotal.toFixed(0)}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.placeOrderBtn}
          onPress={handlePlaceOrder}
          disabled={placingOrder}
        >
          <Text style={styles.placeOrderText}>
            {placingOrder ? "Placing..." : "Place order"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default RestaurantCheckoutScreen;

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f5f5f5" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  emptyText: { fontSize: 14, color: "#777" },

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
  changeLink: { marginTop: 6 },
  changeLinkText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#00b4a0",
  },
  selectAddressBtn: {
    marginTop: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#00b4a0",
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "center",
  },
  selectAddressText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#00b4a0",
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

  smallNote: {
    fontSize: 11,
    color: "#777",
    marginTop: 4,
  },

  // Preferences
  preferenceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  preferenceLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#222",
  },
  preferenceSubLabel: {
    fontSize: 11,
    color: "#777",
    marginTop: 2,
  },
  instructionsInput: {
    marginTop: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    textAlignVertical: "top",
    minHeight: 70,
  },

  // Offers / coupons
  applyCouponRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  applyCouponLabel: {
    fontSize: 13,
    color: "#222",
  },
  applyCouponChange: {
    fontSize: 12,
    fontWeight: "600",
    color: "#00b4a0",
  },

  // Tip
  tipRow: {
    flexDirection: "row",
    marginTop: 8,
  },
  tipChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#ccc",
    marginRight: 8,
  },
  tipChipActive: {
    backgroundColor: "#00b4a0",
    borderColor: "#00b4a0",
  },
  tipChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#444",
  },
  tipChipTextActive: {
    color: "#fff",
  },

  // Bill rows
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
  negativeValue: {
    color: "#388e3c",
  },
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
  savingsText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "600",
    color: "#388e3c",
  },

  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#ddd",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bottomTotalLabel: {
    fontSize: 12,
    color: "#777",
  },
  bottomTotalValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#222",
  },
  placeOrderBtn: {
    backgroundColor: "#00b4a0",
    borderRadius: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  placeOrderText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
});
