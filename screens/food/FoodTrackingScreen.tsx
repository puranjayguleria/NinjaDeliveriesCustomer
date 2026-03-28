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

type OrderStatus = "Preparing" | "Ready" | "Delivered" | "Cancelled";

const getStepsForStatus = (status: OrderStatus): { key: OrderStatus; label: string; icon: keyof typeof Ionicons.glyphMap }[] => {
  if (status === "Cancelled") {
    return [
      { key: "Preparing",  label: "Order\nPlaced",     icon: "receipt-outline" },
      { key: "Cancelled",  label: "Order\nCancelled",  icon: "close-circle-outline" },
    ];
  }
  
  return [
    { key: "Preparing", label: "Preparing",            icon: "restaurant-outline" },
    { key: "Ready",     label: "Ready for\nPickup",    icon: "checkmark-done-outline" },
    { key: "Delivered", label: "Delivered",            icon: "home-outline" },
  ];
};

const getIdx = (s: OrderStatus, steps: any[]) => steps.findIndex(step => step.key === s);

const getStatusColor = (status: OrderStatus): string => {
  switch (status) {
    case "Preparing": return "#FF9500";
    case "Ready": return "#34C759";
    case "Delivered": return "#10B981";
    case "Cancelled": return "#FF3B30";
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
  const [status,      setStatus]      = useState<OrderStatus>("Preparing");
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
      // Normalize status to match our type
      const normalizedStatus = d.status.charAt(0).toUpperCase() + d.status.slice(1).toLowerCase();
      setStatus(normalizedStatus as OrderStatus);
      if (normalizedStatus === "Delivered" && !reviewShown.current && !d.reviewed) {
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

  const STEPS = getStepsForStatus(status);
  const stepIdx = getIdx(status, STEPS);
  const isDelivered = status === "Delivered";
  const isCancelled = status === "Cancelled";
  const isOnWay     = status === "Ready" || status === "Delivered";
  const statusColor = getStatusColor(status);

  console.log("Current status:", status, "isDelivered:", isDelivered, "isCancelled:", isCancelled);

  // Swiggy header color: orange always
  const headerMsg =
    isDelivered ? "Order Delivered!" :
    isCancelled ? "Order Cancelled"  :
    status === "Ready" && eta > 0 ? `Arriving in ${eta} mins` :
    status === "Ready" ? "Order is ready!" :
    status === "Preparing" ? "Preparing your order" :
    "Order Placed";

  const headerSub =
    isDelivered ? `Your order from ${orderDoc?.restaurantName} has been delivered` :
    isCancelled ? "Your order was cancelled" :
    status === "Ready" ? `Your order is ready for pickup by delivery partner` :
    status === "Preparing" ? `${orderDoc?.restaurantName} is preparing your food` :
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

        {/* ── STEPPER ── */}
        <View style={s.stepperBox}>
          {STEPS.map((step, i) => {
            const done   = i <= stepIdx;
            const active = i === stepIdx;
            const last   = i === STEPS.length - 1;
            const isCancelStep = step.key === "Cancelled";
            return (
              <React.Fragment key={step.key}>
                <View style={s.stepCol}>
                  {/* circle */}
                  <View style={[
                    s.stepCircle,
                    done && !isCancelStep && { backgroundColor: statusColor, borderColor: statusColor },
                    isCancelStep && done && { backgroundColor: "#FF3B30", borderColor: "#FF3B30" },
                    active && { shadowColor: isCancelStep ? "#FF3B30" : statusColor, shadowOpacity: 0.5, shadowRadius: 6, elevation: 4 },
                  ]}>
                    {done
                      ? <Ionicons name={step.icon} size={14} color="#fff" />
                      : <View style={s.stepDotInner} />
                    }
                  </View>
                  <Text style={[s.stepLbl, done && !isCancelStep && { color: statusColor }, isCancelStep && done && { color: "#FF3B30" }]} numberOfLines={2}>
                    {step.label}
                  </Text>
                </View>
                {!last && (
                  <View style={[
                    s.stepConnector, 
                    done && i < stepIdx && !isCancelStep && { backgroundColor: statusColor },
                    isCancelStep && { backgroundColor: "#FF3B30" }
                  ]} />
                )}
              </React.Fragment>
            );
          })}
        </View>

        <View style={s.sep} />

        {/* ── RIDER ROW ── */}
        {!isDelivered && !isCancelled && (
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
        {isDelivered && !reviewed && !orderDoc?.reviewed && (
          <TouchableOpacity style={[s.rateCta, { backgroundColor: statusColor }]} onPress={openReview} activeOpacity={0.9}>
            <Text style={s.rateCtaTxt}>Rate your order</Text>
          </TouchableOpacity>
        )}
        {(reviewed || orderDoc?.reviewed) && isDelivered && (
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
  mapWrap: { height: SH * 0.38, backgroundColor: "#e8e8e8" },
  locateBtn: {
    position: "absolute", bottom: 14, right: 14,
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "#fff",
    justifyContent: "center", alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 6,
  },

  // ── bottom card ──
  card: {
    flex: 1,
    backgroundColor: "#fff",
    borderTopWidth: 1, borderTopColor: "#f0f0f0",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: Platform.OS === "ios" ? 30 : 12,
  },

  // stepper
  stepperBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  stepCol: { alignItems: "center", width: 58 },
  stepCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#f0f0f0", borderWidth: 1.5, borderColor: "#ddd",
    justifyContent: "center", alignItems: "center",
  },
  stepDotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#ccc" },
  stepLbl: {
    fontSize: 9, color: "#aaa", marginTop: 5,
    textAlign: "center", lineHeight: 13, fontWeight: "500",
  },
  stepConnector: {
    flex: 1, height: 2, backgroundColor: "#e8e8e8",
    marginTop: 15, // align with circle center
  },

  sep: { height: 1, backgroundColor: "#f5f5f5", marginVertical: 12 },

  // rider
  riderRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
  },
  riderLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  riderImgWrap: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: "#fff5ee",
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: "#ffe0c8",
  },
  riderName: { fontSize: 14, fontWeight: "700", color: DARK },
  riderSub:  { fontSize: 12, color: GRAY, marginTop: 1 },
  callBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 9, paddingHorizontal: 18, borderRadius: 8,
  },
  callTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },

  noRiderRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 6,
  },
  noRiderTxt: { fontSize: 13, color: GRAY },

  // bill toggle
  billToggle: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  billToggleLeft: { flexDirection: "row", alignItems: "center" },
  billToggleTitle: { fontSize: 14, fontWeight: "700", color: DARK },
  billToggleSub:   { fontSize: 12, color: GRAY, marginTop: 1 },

  billBox: { maxHeight: 200, marginTop: 10 },
  itemRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6, gap: 10 },
  itemQtyBox: {
    width: 22, height: 22, borderRadius: 4,
    borderWidth: 1.5, borderColor: ORANGE,
    justifyContent: "center", alignItems: "center",
  },
  itemQtyTxt: { fontSize: 11, fontWeight: "700", color: ORANGE },
  itemName:   { flex: 1, fontSize: 13, color: DARK },
  itemPrice:  { fontSize: 13, fontWeight: "600", color: DARK },
  billSep:    { height: 1, backgroundColor: "#f0f0f0", marginVertical: 8 },
  billRow:    { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  billLbl:    { fontSize: 13, color: GRAY },
  billVal:    { fontSize: 13, color: DARK },
  billTotalRow: { borderTopWidth: 1, borderTopColor: "#f0f0f0", paddingTop: 8, marginTop: 2 },
  billTotalLbl: { fontSize: 14, fontWeight: "700", color: DARK },
  billTotalVal: { fontSize: 14, fontWeight: "800", color: DARK },

  // rate cta
  rateCta: {
    marginTop: 12,
    borderRadius: 8, paddingVertical: 14, alignItems: "center",
  },
  rateCtaTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
  reviewedRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: 12, backgroundColor: "#f1faf1", borderRadius: 8, paddingVertical: 12,
  },
  reviewedTxt: { color: "#60b246", fontWeight: "600", fontSize: 14 },

  // modal
  overlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center", alignItems: "center", padding: 20,
  },
  modalCard: {
    backgroundColor: "#fff", borderRadius: 20, padding: 28,
    width: "100%", alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 14,
  },
  mClose: { position: "absolute", top: 16, right: 16, padding: 6 },
  mIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: "#fff5ee", justifyContent: "center", alignItems: "center", marginBottom: 12,
  },
  mTitle: { fontSize: 20, fontWeight: "800", color: DARK, marginBottom: 4 },
  mSub:   { fontSize: 13, color: GRAY, marginBottom: 20 },
  starsRow: { flexDirection: "row", gap: 6, marginBottom: 8 },
  ratingLbl: { fontSize: 13, fontWeight: "700", color: "#f59e0b", marginBottom: 14 },
  reviewInput: {
    width: "100%", borderWidth: 1, borderColor: "#e8e8e8",
    borderRadius: 10, padding: 14, fontSize: 13, color: DARK,
    minHeight: 88, textAlignVertical: "top", marginBottom: 18, marginTop: 6,
    backgroundColor: "#fafafa",
  },
  submitBtn: {
    width: "100%",
    borderRadius: 10, paddingVertical: 14, alignItems: "center",
  },
  submitTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
  skipTxt:   { fontSize: 13, color: "#aaa" },
  successWrap: { alignItems: "center", paddingVertical: 20 },
});
