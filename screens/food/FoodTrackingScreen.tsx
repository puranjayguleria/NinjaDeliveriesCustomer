import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  Linking, Alert, Animated, ScrollView, Modal,
  TextInput, Platform, StatusBar, Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, useNavigation } from "@react-navigation/native";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import MapView, { Marker, Polyline, LatLng } from "react-native-maps";
import Loader from "@/components/VideoLoader";
import riderIcon     from "../../assets/rider-icon-1.png";
import dropoffMarker from "../../assets/dropoff-marker.png";

const { height: SH } = Dimensions.get("window");
const ORANGE = "#FC8019";
const DARK   = "#1C1C1C";
const GRAY   = "#686B78";

type OrderStatus = "preparing" | "ready" | "out_for_delivery" | "scheduled" | "completed" | "cancelled";

const tabs = [
  { key: "preparing", label: "Preparing", icon: "restaurant" },
  { key: "ready", label: "Ready", icon: "checkmark-circle" },
  { key: "out_for_delivery", label: "Out for Delivery", icon: "car" },
  { key: "scheduled", label: "Scheduled", icon: "calendar" },
  { key: "completed", label: "Completed", icon: "checkmark-done" },
];

const getStatusColor = (status: OrderStatus): string => {
  switch (status) {
    case "preparing": return "#FF9500";
    case "ready": return "#34C759";
    case "out_for_delivery": return "#007AFF";
    case "scheduled": return "#9333EA";
    case "completed": return "#10B981";
    case "cancelled": return "#FF3B30";
    default: return "#007AFF";
  }
};

const haversine = (a: LatLng, b: LatLng) => {
  const R = 6371, r = (v: number) => (v * Math.PI) / 180;
  const dLat = r(b.latitude - a.latitude), dLon = r(b.longitude - a.longitude);
  const x = Math.sin(dLat/2)**2 + Math.sin(dLon/2)**2 * Math.cos(r(a.latitude)) * Math.cos(r(b.latitude));
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
};

export default function FoodTrackingScreen() {
  const navigation = useNavigation<any>();
  const { orderId } = useRoute<any>().params ?? {};

  const [orderDoc,    setOrderDoc]    = useState<any>(null);
  const [status,      setStatus]      = useState<OrderStatus>("preparing");
  const [riderLoc,    setRiderLoc]    = useState<LatLng|null>(null);
  const [riderInfo,   setRiderInfo]   = useState({ name: "", phone: "" });
  const [riderId,     setRiderId]     = useState<string|null>(null);
  const [eta,         setEta]         = useState(0);
  const [path,        setPath]        = useState<LatLng[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [mapReady,    setMapReady]    = useState(false);
  const [showBill,    setShowBill]    = useState(false);

  // review
  const [reviewModal, setReviewModal] = useState(false);
  const [rating,      setRating]      = useState(0);
  const [reviewText,  setReviewText]  = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [reviewed,    setReviewed]    = useState(false);

  const mapRef      = useRef<MapView>(null);
  const reviewShown = useRef(false);
  const scaleA      = useRef(new Animated.Value(0.88)).current;
  const opacA       = useRef(new Animated.Value(0)).current;

  const dest: LatLng|null =
    orderDoc?.deliveryLat && orderDoc?.deliveryLng
      ? { latitude: orderDoc.deliveryLat, longitude: orderDoc.deliveryLng }
      : orderDoc?.deliveryCoords ?? null;

  const fitMap = (coords: LatLng[]) =>
    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: { top: 160, right: 60, bottom: SH * 0.38 + 40, left: 60 },
      animated: true,
    });

  useEffect(() => {
    setRiderLoc(null); setPath([]); setLoading(true); reviewShown.current = false;
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;
    return firestore().collection("restaurant_Orders").doc(orderId).onSnapshot(snap => {
      const d = snap.data();
      if (!d) { setLoading(false); return; }
      setOrderDoc(d); 
      // Get status from Firebase and normalize to lowercase
      const firebaseStatus = (d.status || "preparing").toLowerCase().trim();
      setStatus(firebaseStatus as OrderStatus);
      
      if (firebaseStatus === "completed" && !reviewShown.current && !d.reviewed) {
        reviewShown.current = true;
        setTimeout(openReview, 900);
      }
      const rid = d.riderId || d.acceptedBy || null;
      if (rid) {
        setRiderId(rid);
        const u = firestore().collection("riderDetails").doc(rid).onSnapshot(rs => {
          const rd = rs.data();
          if (!rd) return;
          setRiderInfo({ name: rd.name || "Delivery Partner", phone: rd.contactNumber || "" });
          if (rd.location?.latitude && rd.location?.longitude) {
            const loc: LatLng = { latitude: rd.location.latitude, longitude: rd.location.longitude };
            const dCoords: LatLng|null =
              d.deliveryLat && d.deliveryLng
                ? { latitude: d.deliveryLat, longitude: d.deliveryLng }
                : d.deliveryCoords ?? null;
            setRiderLoc(loc);
            if (dCoords) { setPath([loc, dCoords]); setEta(Math.round((haversine(loc, dCoords)/30)*60)); }
            else { setPath([]); setEta(0); }
          }
          setLoading(false);
        });
        return u;
      } else { setLoading(false); }
    });
  }, [orderId]);

  useEffect(() => {
    if (riderLoc && mapReady) fitMap(dest ? [riderLoc, dest] : [riderLoc]);
  }, [riderLoc, mapReady]);

  const openReview = () => {
    setReviewModal(true);
    Animated.parallel([
      Animated.spring(scaleA, { toValue: 1, useNativeDriver: true, tension: 65, friction: 8 }),
      Animated.timing(opacA,  { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  };
  const closeReview = () => {
    Animated.parallel([
      Animated.timing(scaleA, { toValue: 0.88, duration: 180, useNativeDriver: true }),
      Animated.timing(opacA,  { toValue: 0,    duration: 180, useNativeDriver: true }),
    ]).start(() => {
      setReviewModal(false);
    });
  };
  const submitReview = async () => {
    if (!rating) { Alert.alert("Rating Required", "Please select a star rating."); return; }
    setSubmitting(true);
    try {
      await firestore().collection("restaurant_Reviews").add({
        orderId, restaurantId: orderDoc?.restaurantId ?? "",
        restaurantName: orderDoc?.restaurantName ?? "",
        userId: auth().currentUser?.uid ?? "",
        rating, review: reviewText.trim(),
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
      await firestore().collection("restaurant_Orders").doc(orderId).update({ reviewed: true });
      setReviewed(true);
      
      // Navigate to food home after 2 seconds
      setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [
            {
              name: 'AppTabs',
              state: {
                routes: [
                  {
                    name: 'FoodTab',
                    state: {
                      routes: [{ name: 'FoodHome' }],
                    },
                  },
                ],
              },
            },
          ],
        });
      }, 2000);
    } catch { Alert.alert("Error", "Failed to submit review."); }
    finally { setSubmitting(false); }
  };

  if (loading) return <View style={s.center}><Loader /></View>;

  const isCompleted = status === "completed";
  const isCancelled = status === "cancelled";
  const isScheduled = status === "scheduled";
  const statusColor = getStatusColor(status);

  console.log("Current status:", status, "isCompleted:", isCompleted, "isCancelled:", isCancelled, "isScheduled:", isScheduled);

  // Format scheduled time
  const formatScheduledTime = () => {
    if (!orderDoc?.scheduledFor) return '';
    const scheduledDate = orderDoc.scheduledFor.toDate();
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const isToday = scheduledDate.toDateString() === today.toDateString();
    const isTomorrow = scheduledDate.toDateString() === tomorrow.toDateString();
    
    const timeStr = scheduledDate.toLocaleTimeString('en-IN', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
    
    if (isToday) return `Today at ${timeStr}`;
    if (isTomorrow) return `Tomorrow at ${timeStr}`;
    
    const dateStr = scheduledDate.toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'short',
      year: 'numeric'
    });
    return `${dateStr} at ${timeStr}`;
  };

  // Header messages based on status
  const headerMsg =
    isCompleted ? "Order Completed!" :
    isCancelled ? "Order Cancelled"  :
    isScheduled ? "Order Scheduled" :
    status === "out_for_delivery" && eta > 0 ? `Arriving in ${eta} mins` :
    status === "out_for_delivery" ? "Out for delivery!" :
    status === "ready" ? "Order is ready!" :
    status === "preparing" ? "Preparing your order" :
    "Order Placed";

  const headerSub =
    isCompleted ? `Your order from ${orderDoc?.restaurantName} has been completed` :
    isCancelled ? "Your order was cancelled" :
    isScheduled ? formatScheduledTime() :
    status === "out_for_delivery" ? `Your order is on the way` :
    status === "ready" ? `Your order is ready for pickup by delivery partner` :
    status === "preparing" ? `${orderDoc?.restaurantName} is preparing your food` :
    `${orderDoc?.restaurantName} will start preparing your order soon`;

  return (
    <View style={s.root}>
      <StatusBar backgroundColor={statusColor} barStyle="light-content" />

      {/* ─── HEADER ─── */}
      <View style={[s.header, { backgroundColor: statusColor }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerBack}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>{headerMsg}</Text>
          <Text style={s.headerSub} numberOfLines={1}>{headerSub}</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* ─── MAP ─── */}
      <View style={s.mapWrap}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          onMapReady={() => setMapReady(true)}
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsCompass={false}
          toolbarEnabled={false}
          initialRegion={
            dest ? { ...dest, latitudeDelta: 0.04, longitudeDelta: 0.04 }
            : riderLoc ? { ...riderLoc, latitudeDelta: 0.04, longitudeDelta: 0.04 }
            : { latitude: 28.6139, longitude: 77.2090, latitudeDelta: 0.04, longitudeDelta: 0.04 }
          }
        >
          {riderLoc && (
            <Marker coordinate={riderLoc} anchor={{ x: 0.5, y: 0.5 }}>
              <Image source={riderIcon} style={{ width: 36, height: 52 }} />
            </Marker>
          )}
          {dest && (
            <Marker coordinate={dest} anchor={{ x: 0.5, y: 1 }}>
              <Image source={dropoffMarker} style={{ width: 36, height: 52 }} />
            </Marker>
          )}
          {path.length > 1 && (
            <Polyline coordinates={path} strokeColor={statusColor} strokeWidth={4} />
          )}
        </MapView>

        {/* locate button */}
        {riderLoc && (
          <TouchableOpacity style={s.locateBtn}
            onPress={() => mapRef.current?.animateToRegion({ ...riderLoc, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 500)}>
            <Ionicons name="locate" size={20} color={statusColor} />
          </TouchableOpacity>
        )}
      </View>

      {/* ─── BOTTOM CARD ─── */}
      <View style={s.card}>

        {/* ── HORIZONTAL TABS ── */}
        {!isCancelled && !isScheduled && (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={s.tabsScroll}
            contentContainerStyle={s.tabsContent}
          >
            {tabs.filter(tab => tab.key !== 'scheduled').map((tab, index) => {
              const isActive = tab.key === status;
              const tabIndex = tabs.findIndex(t => t.key === tab.key);
              const currentIndex = tabs.findIndex(t => t.key === status);
              const isPassed = tabIndex < currentIndex;
              const tabColor = isActive ? statusColor : isPassed ? "#10B981" : "#E5E7EB";
              const isLast = index === tabs.filter(t => t.key !== 'scheduled').length - 1;
              
              return (
                <React.Fragment key={tab.key}>
                  <View style={s.tabItem}>
                    <View style={[s.tabIconWrap, { backgroundColor: tabColor }]}>
                      <Ionicons 
                        name={tab.icon as any} 
                        size={14} 
                        color="#fff" 
                      />
                    </View>
                    <Text style={[
                      s.tabLabel, 
                      isActive && { color: statusColor, fontWeight: "700" },
                      isPassed && { color: "#10B981", fontWeight: "600" }
                    ]}>
                      {tab.label}
                    </Text>
                    {isActive && <View style={[s.tabIndicator, { backgroundColor: statusColor }]} />}
                  </View>
                  {!isLast && (
                    <View style={[
                      s.tabConnector,
                      isPassed && { backgroundColor: "#10B981" }
                    ]} />
                  )}
                </React.Fragment>
              );
            })}
          </ScrollView>
        )}

        {isScheduled && (
          <View style={s.scheduledBox}>
            <View style={s.scheduledIconWrap}>
              <Ionicons name="calendar" size={32} color="#9333EA" />
            </View>
            <Text style={s.scheduledTitle}>Order Scheduled</Text>
            <Text style={s.scheduledTime}>{formatScheduledTime()}</Text>
            <Text style={s.scheduledSub}>
              We'll start preparing your order at the scheduled time
            </Text>
          </View>
        )}

        {isCancelled && (
          <View style={s.cancelledBox}>
            <Ionicons name="close-circle" size={48} color="#FF3B30" />
            <Text style={s.cancelledTitle}>Order Cancelled</Text>
            <Text style={s.cancelledSub}>Your order has been cancelled</Text>
          </View>
        )}

        <View style={s.sep} />

        {/* ── RIDER ROW ── */}
        {!isCompleted && !isCancelled && !isScheduled && (
          <>
            {riderId ? (
              <View style={s.riderRow}>
                <View style={s.riderLeft}>
                  <View style={s.riderImgWrap}>
                    <Image source={riderIcon} style={{ width: 32, height: 32 }} resizeMode="contain" />
                  </View>
                  <View>
                    <Text style={s.riderName}>{riderInfo.name}</Text>
                    <Text style={s.riderSub}>Delivery Partner</Text>
                  </View>
                </View>
                {!!riderInfo.phone && (
                  <TouchableOpacity style={[s.callBtn, { backgroundColor: statusColor }]}
                    onPress={() => Linking.openURL(`tel:${riderInfo.phone}`).catch(() => Alert.alert("Error","Cannot make call"))}>
                    <Ionicons name="call" size={15} color="#fff" />
                    <Text style={s.callTxt}>Call</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={s.noRiderRow}>
                <Ionicons name="bicycle-outline" size={18} color={GRAY} />
                <Text style={s.noRiderTxt}>Assigning a delivery partner...</Text>
              </View>
            )}
            <View style={s.sep} />
          </>
        )}

        {/* ── ORDER SUMMARY ── */}
        <TouchableOpacity style={s.billToggle} onPress={() => setShowBill(v => !v)} activeOpacity={0.8}>
          <View style={s.billToggleLeft}>
            <Ionicons name="receipt-outline" size={16} color={DARK} />
            <View style={{ marginLeft: 10 }}>
              <Text style={s.billToggleTitle}>{orderDoc?.restaurantName}</Text>
              <Text style={s.billToggleSub}>
                {(orderDoc?.items?.length ?? 0)} item{(orderDoc?.items?.length ?? 0) !== 1 ? "s" : ""} · ₹{(orderDoc?.grandTotal || 0).toFixed(0)}
              </Text>
            </View>
          </View>
          <Ionicons name={showBill ? "chevron-up" : "chevron-down"} size={18} color={GRAY} />
        </TouchableOpacity>

        {showBill && (
          <ScrollView style={s.billBox} showsVerticalScrollIndicator={false} nestedScrollEnabled>
            {(orderDoc?.items ?? []).map((item: any, i: number) => (
              <View key={i} style={s.itemRow}>
                <View style={s.itemQtyBox}>
                  <Text style={s.itemQtyTxt}>{item.qty ?? item.quantity}</Text>
                </View>
                <Text style={s.itemName} numberOfLines={1}>{item.name}</Text>
                <Text style={s.itemPrice}>₹{((item.price ?? 0) * (item.qty ?? item.quantity ?? 1)).toFixed(0)}</Text>
              </View>
            ))}
            <View style={s.billSep} />
            <View style={s.billRow}><Text style={s.billLbl}>Item Total</Text><Text style={s.billVal}>₹{(orderDoc?.subtotal||0).toFixed(0)}</Text></View>
            <View style={s.billRow}>
              <Text style={s.billLbl}>Delivery Fee</Text>
              <Text style={[s.billVal, orderDoc?.deliveryFee===0 && {color:"#60b246"}]}>
                {orderDoc?.deliveryFee===0 ? "FREE" : `₹${(orderDoc?.deliveryFee||0).toFixed(0)}`}
              </Text>
            </View>
            <View style={s.billRow}><Text style={s.billLbl}>Taxes & Charges</Text><Text style={s.billVal}>₹{(orderDoc?.taxes||0).toFixed(0)}</Text></View>
            <View style={[s.billRow, s.billTotalRow]}>
              <Text style={s.billTotalLbl}>Bill Total</Text>
              <Text style={s.billTotalVal}>₹{(orderDoc?.grandTotal||0).toFixed(0)}</Text>
            </View>
          </ScrollView>
        )}

        {/* ── RATE CTA ── */}
        {isCompleted && !reviewed && !orderDoc?.reviewed && (
          <TouchableOpacity style={[s.rateCta, { backgroundColor: statusColor }]} onPress={openReview} activeOpacity={0.9}>
            <Text style={s.rateCtaTxt}>Rate your order</Text>
          </TouchableOpacity>
        )}
        {(reviewed || orderDoc?.reviewed) && isCompleted && (
          <View style={s.reviewedRow}>
            <Ionicons name="checkmark-circle" size={16} color="#60b246" />
            <Text style={s.reviewedTxt}>Thanks for your feedback!</Text>
          </View>
        )}
      </View>

      {/* ─── REVIEW MODAL ─── */}
      <Modal visible={reviewModal} transparent animationType="none" onRequestClose={closeReview}>
        <View style={s.overlay}>
          <Animated.View style={[s.modalCard, { transform: [{ scale: scaleA }], opacity: opacA }]}>
            {reviewed ? (
              <View style={s.successWrap}>
                <Ionicons name="checkmark-circle" size={60} color="#60b246" />
                <Text style={s.mTitle}>Thank you!</Text>
                <Text style={s.mSub}>Your feedback has been submitted.</Text>
                <View style={s.starsRow}>
                  {[1,2,3,4,5].map(n => (
                    <Ionicons key={n} name={n<=rating?"star":"star-outline"} size={22} color={n<=rating?"#f59e0b":"#e2e8f0"} />
                  ))}
                </View>
              </View>
            ) : (
              <>
                <TouchableOpacity style={s.mClose} onPress={closeReview}>
                  <Ionicons name="close" size={18} color="#aaa" />
                </TouchableOpacity>
                <View style={s.mIconWrap}>
                  <Ionicons name="restaurant" size={28} color={statusColor} />
                </View>
                <Text style={s.mTitle}>Rate your order</Text>
                <Text style={s.mSub}>from {orderDoc?.restaurantName}</Text>
                <View style={s.starsRow}>
                  {[1,2,3,4,5].map(n => (
                    <TouchableOpacity key={n} onPress={() => setRating(n)} activeOpacity={0.7}>
                      <Ionicons name={n<=rating?"star":"star-outline"} size={38} color={n<=rating?"#f59e0b":"#e2e8f0"} />
                    </TouchableOpacity>
                  ))}
                </View>
                {rating > 0 && <Text style={s.ratingLbl}>{["","Poor","Fair","Good","Great","Excellent!"][rating]}</Text>}
                <TextInput
                  style={s.reviewInput}
                  placeholder="Tell us about your experience..."
                  placeholderTextColor="#bbb"
                  value={reviewText} onChangeText={setReviewText}
                  multiline maxLength={300}
                />
                <TouchableOpacity style={[s.submitBtn, { backgroundColor: statusColor }, submitting && {opacity:0.65}]} onPress={submitReview} disabled={submitting} activeOpacity={0.9}>
                  <Text style={s.submitTxt}>{submitting ? "Submitting..." : "Submit"}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={closeReview} style={{ marginTop: 14 }}>
                  <Text style={s.skipTxt}>Skip for now</Text>
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  // ── header ──
  header: {
    backgroundColor: ORANGE,
    paddingTop: Platform.OS === "ios" ? 52 : (StatusBar.currentHeight ?? 24) + 8,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  headerBack: { padding: 4, marginRight: 8 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#fff" },
  headerSub:   { fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 2 },

  // ── map ──
  mapWrap: { height: SH * 0.42, backgroundColor: "#e8e8e8" },
  locateBtn: {
    position: "absolute", bottom: 16, right: 16,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#fff",
    justifyContent: "center", alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 8,
  },

  // ── bottom card ──
  card: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 30 : 16,
  },

  sep: { height: 1, backgroundColor: "#f0f0f0", marginVertical: 12 },

  // tabs
  tabsScroll: {
    marginBottom: 6,
    marginTop: 6,
  },
  tabsContent: {
    paddingHorizontal: 2,
    alignItems: "center",
  },
  tabItem: {
    alignItems: "center",
    minWidth: 68,
    paddingVertical: 6,
  },
  tabIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  tabLabel: {
    fontSize: 9.5,
    color: "#9CA3AF",
    textAlign: "center",
    fontWeight: "600",
    lineHeight: 12,
  },
  tabIndicator: {
    width: 22,
    height: 3,
    borderRadius: 2,
    marginTop: 5,
  },
  tabConnector: {
    width: 28,
    height: 2.5,
    backgroundColor: "#E5E7EB",
    marginTop: 25,
    borderRadius: 2,
  },

  // cancelled
  cancelledBox: {
    alignItems: "center",
    paddingVertical: 28,
    backgroundColor: "#FFF5F5",
    marginVertical: 8,
  },
  cancelledTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FF3B30",
    marginTop: 12,
  },
  cancelledSub: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 6,
  },

  // scheduled
  scheduledBox: {
    alignItems: "center",
    paddingVertical: 32,
    backgroundColor: "#FAF5FF",
    marginVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E9D5FF",
  },
  scheduledIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#F3E8FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "#E9D5FF",
  },
  scheduledTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#9333EA",
    marginBottom: 8,
  },
  scheduledTime: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 8,
  },
  scheduledSub: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    paddingHorizontal: 24,
    lineHeight: 19,
  },

  // rider
  riderRow: {
    flexDirection: "row", 
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FAFAFA",
    padding: 14,
    marginVertical: 4,
  },
  riderLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  riderImgWrap: {
    width: 52, 
    height: 52, 
    borderRadius: 26,
    backgroundColor: "#FFF5EE",
    justifyContent: "center", 
    alignItems: "center",
    borderWidth: 2, 
    borderColor: "#FFE0C8",
  },
  riderName: { fontSize: 15, fontWeight: "700", color: DARK },
  riderSub:  { fontSize: 12, color: "#6B7280", marginTop: 2 },
  callBtn: {
    flexDirection: "row", 
    alignItems: "center", 
    gap: 6,
    paddingVertical: 10, 
    paddingHorizontal: 20, 
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  callTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },

  noRiderRow: {
    flexDirection: "row", 
    alignItems: "center", 
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#F9FAFB",
    marginVertical: 4,
  },
  noRiderTxt: { fontSize: 13, color: "#6B7280", fontWeight: "500" },

  // bill toggle
  billToggle: {
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  billToggleLeft: { flexDirection: "row", alignItems: "center" },
  billToggleTitle: { fontSize: 15, fontWeight: "700", color: DARK },
  billToggleSub:   { fontSize: 12, color: "#6B7280", marginTop: 2 },

  billBox: { maxHeight: 220, marginTop: 12, paddingHorizontal: 4 },
  itemRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 10 },
  itemQtyBox: {
    width: 24, 
    height: 24, 
    borderWidth: 1.5, 
    borderColor: ORANGE,
    justifyContent: "center", 
    alignItems: "center",
    backgroundColor: "#FFF5EE",
  },
  itemQtyTxt: { fontSize: 11, fontWeight: "700", color: ORANGE },
  itemName:   { flex: 1, fontSize: 13, color: DARK, fontWeight: "500" },
  itemPrice:  { fontSize: 13, fontWeight: "700", color: DARK },
  billSep:    { height: 1, backgroundColor: "#E5E7EB", marginVertical: 10 },
  billRow:    { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  billLbl:    { fontSize: 13, color: "#6B7280", fontWeight: "500" },
  billVal:    { fontSize: 13, color: DARK, fontWeight: "600" },
  billTotalRow: { 
    borderTopWidth: 1.5, 
    borderTopColor: "#E5E7EB", 
    paddingTop: 10, 
    backgroundColor: "#FAFAFA",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  billTotalLbl: { fontSize: 15, fontWeight: "700", color: DARK },
  billTotalVal: { fontSize: 15, fontWeight: "800", color: DARK },

  // rate cta
  rateCta: {
    marginTop: 16,
    paddingVertical: 15, 
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  rateCtaTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
  reviewedRow: {
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "center", 
    gap: 8,
    marginTop: 16, 
    backgroundColor: "#F0FDF4", 
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  reviewedTxt: { color: "#16A34A", fontWeight: "700", fontSize: 14 },

  // modal
  overlay: {
    flex: 1, 
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center", 
    alignItems: "center", 
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#fff", 
    padding: 32,
    width: "100%", 
    alignItems: "center",
    shadowColor: "#000", 
    shadowOpacity: 0.25, 
    shadowRadius: 30, 
    shadowOffset: { width: 0, height: 10 }, 
    elevation: 20,
  },
  mClose: { position: "absolute", top: 18, right: 18, padding: 8 },
  mIconWrap: {
    width: 68, 
    height: 68, 
    borderRadius: 34,
    backgroundColor: "#FFF5EE", 
    justifyContent: "center", 
    alignItems: "center", 
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "#FFE0C8",
  },
  mTitle: { fontSize: 22, fontWeight: "800", color: DARK, marginBottom: 6 },
  mSub:   { fontSize: 14, color: "#6B7280", marginBottom: 24 },
  starsRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  ratingLbl: { fontSize: 14, fontWeight: "700", color: "#f59e0b", marginBottom: 16 },
  reviewInput: {
    width: "100%", 
    borderWidth: 1.5, 
    borderColor: "#E5E7EB",
    padding: 16, 
    fontSize: 14, 
    color: DARK,
    minHeight: 100, 
    textAlignVertical: "top", 
    marginBottom: 20, 
    marginTop: 8,
    backgroundColor: "#FAFAFA",
  },
  submitBtn: {
    width: "100%",
    paddingVertical: 16, 
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  submitTxt: { color: "#fff", fontWeight: "700", fontSize: 16 },
  skipTxt:   { fontSize: 14, color: "#9CA3AF", fontWeight: "500" },
  successWrap: { alignItems: "center", paddingVertical: 24 },
});
