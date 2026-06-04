import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  Linking, Alert, Animated, ScrollView, Modal,
  TextInput, Platform, StatusBar, Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useLocationContext } from "@/context/LocationContext";
import { DHARAMSHALA_CENTER } from "@/utils/locationUtils";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import MapView, { Marker, Polyline, LatLng } from "react-native-maps";
import Loader from "@/components/VideoLoader";
import riderIcon     from "../../assets/rider-icon-1.png";
import dropoffMarker from "../../assets/dropoff-marker.png";

const { height: SH, width: SW } = Dimensions.get("window");
const ORANGE = "#FC8019";
const DARK   = "#1C1C1C";
const GRAY   = "#686B78";

type OrderStatus = "pending" | "accepted" | "preparing" | "ready" | "picked_up" | "out_for_delivery" | "scheduled" | "completed" | "cancelled" | "rejected";

const tabs = [
  { key: "pending",          label: "Order Placed",      icon: "time-outline" },
  { key: "preparing",        label: "Preparing",         icon: "restaurant" },
  { key: "accepted",         label: "Accepted by Rider", icon: "person-circle-outline" },
  { key: "ready",            label: "Ready",             icon: "checkmark-circle" },
  { key: "picked_up",        label: "Picked Up",         icon: "bag-check-outline" },
  { key: "out_for_delivery", label: "Out for Delivery",  icon: "bicycle" },
  { key: "completed",        label: "Delivered",         icon: "checkmark-done" },
];

const STATUS_ORDER = ["pending", "preparing", "accepted", "ready", "picked_up", "out_for_delivery", "completed"];

const normalizeOrderStatus = (rawStatus: string | null | undefined): OrderStatus => {
  const value = (rawStatus ?? "pending").toString().toLowerCase().trim();
  const normalized = value.replace(/[^a-z]/g, "");

  if (normalized === "acceptedbyrider") return "accepted";
  if (normalized === "pickedup") return "picked_up";
  if (normalized === "outfordelivery" || normalized === "outofdelivery" || normalized === "outdelivery") return "out_for_delivery";
  if (normalized === "ready") return "ready";
  if (normalized === "accepted") return "accepted";
  if (normalized === "preparing") return "preparing";
  if (normalized === "scheduled") return "scheduled";
  if (normalized === "completed") return "completed";
  if (normalized === "cancelled" || normalized === "canceled") return "cancelled";
  if (normalized === "rejected") return "rejected";

  return "pending";
};

const getStatusColor = (status: OrderStatus): string => {
  switch (status) {
    case "pending":           return "#f59e0b";
    case "accepted":          return "#FF9500";
    case "preparing":         return "#FF9500";
    case "ready":             return "#34C759";
    case "picked_up":         return "#0ea5e9";
    case "out_for_delivery":  return "#007AFF";
    case "scheduled":         return "#9333EA";
    case "completed":         return "#10B981";
    case "cancelled":         return "#FF3B30";
    case "rejected":          return "#FF3B30";
    default:                  return ORANGE;
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
  const { location } = useLocationContext();

  const [orderDoc,    setOrderDoc]    = useState<any>(null);
  const [status,      setStatus]      = useState<OrderStatus>("preparing");
  const [riderLoc,    setRiderLoc]    = useState<LatLng|null>(null);
  const [riderInfo,   setRiderInfo]   = useState({ name: "", phone: "" });
  const [riderId,     setRiderId]     = useState<string|null>(null);
  const [eta,         setEta]         = useState(0);
  const [path,        setPath]        = useState<LatLng[]>([]);
  const [loading,     setLoading]     = useState(true);
  const orderRef = orderId ? firestore().collection("restaurant_Orders").doc(orderId) : null;
  const [mapReady,    setMapReady]    = useState(false);
  const [showBill,    setShowBill]    = useState(false);
  const [reviewModal, setReviewModal] = useState(false);
  const [rating,      setRating]      = useState(0);
  const [reviewText,  setReviewText]  = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [reviewed,    setReviewed]    = useState(false);

  const mapRef      = useRef<MapView>(null);
  const reviewShown = useRef(false);
  const scaleA      = useRef(new Animated.Value(0.88)).current;
  const opacA       = useRef(new Animated.Value(0)).current;

  const selectedLocation: LatLng | null =
    location?.lat != null && location?.lng != null
      ? { latitude: location.lat, longitude: location.lng }
      : null;

  const dest: LatLng|null =
    orderDoc?.deliveryLat && orderDoc?.deliveryLng
      ? { latitude: orderDoc.deliveryLat, longitude: orderDoc.deliveryLng }
      : orderDoc?.deliveryLocation?.lat != null && orderDoc?.deliveryLocation?.lng != null
        ? { latitude: orderDoc.deliveryLocation.lat, longitude: orderDoc.deliveryLocation.lng }
        : orderDoc?.deliveryCoords ?? selectedLocation;

  const fitMap = (coords: LatLng[]) =>
    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: { top: 80, right: 60, bottom: SH * 0.48 + 20, left: 60 },
      animated: true,
    });

  useEffect(() => {
    setRiderLoc(null); setPath([]); setLoading(true); reviewShown.current = false;
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;
    let riderUnsub: (() => void) | null = null;
    const orderUnsub = firestore().collection("restaurant_Orders").doc(orderId).onSnapshot(snap => {
      const d = snap.data();
      if (!d) { setLoading(false); return; }
      setOrderDoc(d);
      const firebaseStatus = normalizeOrderStatus(
        d.status || d.acceptedByRider || d.acceptedBy || "pending"
      );
      setStatus(firebaseStatus);
      if (firebaseStatus === "rejected") {
        navigation.reset({ index: 0, routes: [{ name: "AppTabs", params: { rejectedBy: d.restaurantName ?? "the restaurant" } }] });
        return;
      }
      if (firebaseStatus === "completed" && !reviewShown.current && !d.reviewed) {
        reviewShown.current = true;
        setTimeout(openReview, 900);
      }
      const rid = d.riderId || d.acceptedBy || null;
      if (rid && rid !== riderId) {
        if (riderUnsub) { riderUnsub(); riderUnsub = null; }
        setRiderId(rid);
        riderUnsub = firestore().collection("riderDetails").doc(rid).onSnapshot(rs => {
          const rd = rs.data();
          if (!rd) return;
          setRiderInfo({ name: rd.name || "Delivery Partner", phone: rd.contactNumber || rd.phone || "" });
          if (rd.location?.latitude && rd.location?.longitude) {
            const loc: LatLng = { latitude: rd.location.latitude, longitude: rd.location.longitude };
            const dCoords: LatLng | null = d.deliveryLat && d.deliveryLng
              ? { latitude: d.deliveryLat, longitude: d.deliveryLng } : d.deliveryCoords ?? null;
            setRiderLoc(loc);
            if (dCoords) { setPath([loc, dCoords]); setEta(Math.round((haversine(loc, dCoords) / 30) * 60)); }
            else { setPath([]); setEta(0); }
          }
          setLoading(false);
        });
      } else if (!rid) { setLoading(false); }
    });
    return () => { orderUnsub(); if (riderUnsub) riderUnsub(); };
  }, [orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!orderId || !orderRef || !orderDoc) return;
    const remoteStatus = normalizeOrderStatus(orderDoc.status);
    if (remoteStatus !== status) {
      orderRef.update({ status }).catch(() => null);
    }
  }, [orderId, orderRef, orderDoc, status]);

  useEffect(() => {
    if (riderLoc && mapReady) fitMap(dest ? [riderLoc, dest] : [riderLoc]);
  }, [riderLoc, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

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
    ]).start(() => setReviewModal(false));
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
      setTimeout(() => {
        navigation.reset({ index: 0, routes: [{ name: "AppTabs", state: { routes: [{ name: "FoodTab", state: { routes: [{ name: "FoodHome" }] } }] } }] });
      }, 2000);
    } catch { Alert.alert("Error", "Failed to submit review."); }
    finally { setSubmitting(false); }
  };

  if (loading) return <View style={s.center}><Loader /></View>;

  const isCompleted = status === "completed";
  const isCancelled = status === "cancelled";
  const isScheduled = status === "scheduled";
  const statusColor = getStatusColor(status);

  const formatScheduledTime = () => {
    if (!orderDoc?.scheduledFor) return '';
    const d = orderDoc.scheduledFor.toDate();
    const today = new Date(); const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    if (d.toDateString() === today.toDateString()) return `Today at ${timeStr}`;
    if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow at ${timeStr}`;
    return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} at ${timeStr}`;
  };

  const headerMsg =
    isCompleted ? "Order Delivered! 🎉" :
    isCancelled ? "Order Cancelled" :
    isScheduled ? "Order Scheduled" :
    status === "out_for_delivery" && eta > 0 ? `Arriving in ${eta} mins` :
    status === "out_for_delivery" ? "Out for Delivery!" :
    status === "picked_up"  ? "Order Picked Up!" :
    status === "ready"      ? "Order is Ready!" :
    status === "accepted"   ? "Rider Accepted!" :
    status === "preparing"  ? "Preparing your order..." :
    "Order Placed!";

  const headerSub =
    isCompleted ? `Delivered from ${orderDoc?.restaurantName}` :
    isCancelled ? "Your order was cancelled" :
    isScheduled ? formatScheduledTime() :
    status === "out_for_delivery" ? `${orderDoc?.restaurantName} · On the way` :
    status === "picked_up"  ? "Rider heading to you" :
    status === "ready"      ? "Waiting for rider pickup" :
    status === "accepted"   ? `${riderInfo.name || "Rider"} is on the way to restaurant` :
    status === "preparing"  ? `${orderDoc?.restaurantName} is cooking` :
    `${orderDoc?.restaurantName} will confirm soon`;

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate("AppTabs" as any, {
      screen: "FoodRestaurants",
      params: { screen: "FoodHome" },
    } as any);
  };

  return (
    <View style={s.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />

      {/* ── FULL SCREEN MAP ── */}
      <MapView
        ref={mapRef}
        style={s.map}
        onMapReady={() => setMapReady(true)}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        initialRegion={{ ...DHARAMSHALA_CENTER, latitudeDelta: 0.04, longitudeDelta: 0.04 }}
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
        {path.length > 1 && <Polyline coordinates={path} strokeColor={statusColor} strokeWidth={4} />}
      </MapView>

      {/* ── TOP BAR (floating over map) ── */}
      <View style={[s.topBar, { paddingTop: (StatusBar.currentHeight ?? 44) + 8 }]}>
        <TouchableOpacity style={s.backBtn} onPress={handleBack}>
          <Ionicons name="arrow-back" size={20} color={DARK} />
        </TouchableOpacity>
        {riderLoc && (
          <TouchableOpacity style={s.locateBtn}
            onPress={() => mapRef.current?.animateToRegion({ ...riderLoc!, latitudeDelta: 0.012, longitudeDelta: 0.012 }, 500)}>
            <Ionicons name="locate" size={20} color={statusColor} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── BOTTOM SHEET ── */}
      <View style={s.sheet}>
        {/* drag handle */}
        <View style={s.handle} />

        {/* Status pill */}
        <View style={[s.statusPill, { backgroundColor: `${statusColor}18` }]}>
          <View style={[s.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[s.statusPillTxt, { color: statusColor }]}>{headerMsg}</Text>
        </View>
        <Text style={s.statusSub} numberOfLines={1}>{headerSub}</Text>

        <ScrollView showsVerticalScrollIndicator={false} bounces={false} style={{ flex: 1 }}>

          {/* ── STEPPER ── */}
          {!isCancelled && !isScheduled && (
            <View style={s.stepperCard}>
              {tabs.map((tab, index) => {
                const isActive  = tab.key === status;
                const tabIndex  = STATUS_ORDER.indexOf(tab.key);
                const currIndex = STATUS_ORDER.indexOf(status);
                const isPassed  = tabIndex < currIndex;
                const isLast    = index === tabs.length - 1;
                const dotBg     = isActive ? statusColor : isPassed ? "#10B981" : "#E5E7EB";
                const lineColor = isPassed ? "#10B981" : "#E5E7EB";
                return (
                  <View key={tab.key} style={s.stepRow}>
                    <View style={s.stepLeft}>
                      <View style={[s.stepDot, { backgroundColor: dotBg }]}>
                        <Ionicons name={tab.icon as any} size={11} color={isActive || isPassed ? "#fff" : "#aaa"} />
                      </View>
                      {!isLast && <View style={[s.stepLine, { backgroundColor: lineColor }]} />}
                    </View>
                    <View style={[s.stepBody, isActive && s.stepBodyActive, isActive && { borderLeftColor: statusColor }]}>
                      <Text style={[s.stepLabel, isPassed && s.stepLabelDone, isActive && { color: statusColor, fontWeight: "700" }]}>
                        {tab.label}
                      </Text>
                      {isActive && (
                        <View style={[s.nowBadge, { backgroundColor: statusColor }]}>
                          <Text style={s.nowBadgeTxt}>NOW</Text>
                        </View>
                      )}
                      {isPassed && <Ionicons name="checkmark-circle" size={15} color="#10B981" />}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {isScheduled && (
            <View style={s.scheduledCard}>
              <Ionicons name="calendar" size={32} color="#9333EA" />
              <Text style={s.scheduledTitle}>Scheduled Order</Text>
              <Text style={s.scheduledTime}>{formatScheduledTime()}</Text>
              <Text style={s.scheduledSub}>We'll start preparing at the scheduled time</Text>
            </View>
          )}

          {isCancelled && (
            <View style={s.cancelledCard}>
              <Ionicons name="close-circle" size={44} color="#FF3B30" />
              <Text style={s.cancelledTitle}>Order Cancelled</Text>
              <Text style={s.cancelledSub}>Your order has been cancelled</Text>
            </View>
          )}

          {/* ── RIDER CARD ── */}
          {!isCompleted && !isCancelled && !isScheduled && (
            <View style={s.riderCard}>
              {riderId ? (
                <View style={s.riderRow}>
                  <View style={s.riderAvatar}>
                    <Image source={riderIcon} style={{ width: 28, height: 28 }} contentFit="contain" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={s.riderName}>{riderInfo.name}</Text>
                    <Text style={s.riderRole}>Delivery Partner</Text>
                  </View>
                  {!!riderInfo.phone && (
                    <TouchableOpacity style={[s.callBtn, { backgroundColor: statusColor }]}
                      onPress={() => Linking.openURL(`tel:${riderInfo.phone}`).catch(() => Alert.alert("Error", "Cannot make call"))}>
                      <Ionicons name="call" size={16} color="#fff" />
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
            </View>
          )}

          {/* ── BILL ── */}
          <TouchableOpacity style={s.billHeader} onPress={() => setShowBill(v => !v)} activeOpacity={0.8}>
            <View style={s.billHeaderLeft}>
              <Ionicons name="receipt-outline" size={18} color={DARK} />
              <View style={{ marginLeft: 10 }}>
                <Text style={s.billRestName} numberOfLines={1}>{orderDoc?.restaurantName}</Text>
                <Text style={s.billMeta}>
                  {(orderDoc?.items?.length ?? 0)} item{(orderDoc?.items?.length ?? 0) !== 1 ? "s" : ""} · ₹{(orderDoc?.grandTotal || 0).toFixed(0)}
                </Text>
              </View>
            </View>
            <View style={s.billChevron}>
              <Ionicons name={showBill ? "chevron-up" : "chevron-down"} size={18} color={GRAY} />
            </View>
          </TouchableOpacity>

          {showBill && (
            <View style={s.billBody}>
              {(orderDoc?.items ?? []).map((item: any, i: number) => (
                <View key={i} style={s.itemRow}>
                  <View style={s.itemQtyBox}><Text style={s.itemQtyTxt}>{item.qty ?? item.quantity ?? 1}</Text></View>
                  <Text style={s.itemName} numberOfLines={1}>{item.name}</Text>
                  <Text style={s.itemPrice}>₹{((item.price ?? 0) * (item.qty ?? item.quantity ?? 1)).toFixed(0)}</Text>
                </View>
              ))}
              <View style={s.billDivider} />
              <View style={s.billRow}><Text style={s.billLbl}>Item Total</Text><Text style={s.billVal}>₹{(orderDoc?.subtotal || 0).toFixed(0)}</Text></View>
              <View style={s.billRow}>
                <Text style={s.billLbl}>Delivery Fee</Text>
                <Text style={[s.billVal, orderDoc?.deliveryFee === 0 && { color: "#10B981" }]}>
                  {orderDoc?.deliveryFee === 0 ? "FREE" : `₹${(orderDoc?.deliveryFee || 0).toFixed(0)}`}
                </Text>
              </View>
              {(orderDoc?.gst > 0 || orderDoc?.taxes > 0) && (
                <View style={s.billRow}><Text style={s.billLbl}>Taxes & Charges</Text><Text style={s.billVal}>₹{(orderDoc?.gst ?? orderDoc?.taxes ?? 0).toFixed(0)}</Text></View>
              )}
              {orderDoc?.platformFee > 0 && <View style={s.billRow}><Text style={s.billLbl}>Platform Fee</Text><Text style={s.billVal}>₹{(orderDoc?.platformFee || 0).toFixed(0)}</Text></View>}
              {orderDoc?.packagingFee > 0 && <View style={s.billRow}><Text style={s.billLbl}>Packaging</Text><Text style={s.billVal}>₹{(orderDoc?.packagingFee || 0).toFixed(0)}</Text></View>}
              {orderDoc?.surgeCharge > 0 && <View style={s.billRow}><Text style={s.billLbl}>Surge Charge</Text><Text style={s.billVal}>₹{(orderDoc?.surgeCharge || 0).toFixed(0)}</Text></View>}
              <View style={s.billTotalRow}>
                <Text style={s.billTotalLbl}>Bill Total</Text>
                <Text style={s.billTotalVal}>₹{(orderDoc?.grandTotal || 0).toFixed(0)}</Text>
              </View>
            </View>
          )}

          {/* Rate CTA */}
          {isCompleted && !reviewed && !orderDoc?.reviewed && (
            <TouchableOpacity style={[s.rateCta, { backgroundColor: statusColor }]} onPress={openReview} activeOpacity={0.9}>
              <Ionicons name="star-outline" size={18} color="#fff" />
              <Text style={s.rateCtaTxt}>Rate your order</Text>
            </TouchableOpacity>
          )}
          {(reviewed || orderDoc?.reviewed) && isCompleted && (
            <View style={s.reviewedRow}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={s.reviewedTxt}>Thanks for your feedback!</Text>
            </View>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      </View>

      {/* ── REVIEW MODAL ── */}
      <Modal visible={reviewModal} transparent animationType="none" onRequestClose={closeReview}>
        <View style={s.overlay}>
          <Animated.View style={[s.modalCard, { transform: [{ scale: scaleA }], opacity: opacA }]}>
            {reviewed ? (
              <View style={s.successWrap}>
                <Ionicons name="checkmark-circle" size={60} color="#10B981" />
                <Text style={s.mTitle}>Thank you!</Text>
                <Text style={s.mSub}>Your feedback has been submitted.</Text>
                <View style={s.starsRow}>
                  {[1,2,3,4,5].map(n => <Ionicons key={n} name={n<=rating?"star":"star-outline"} size={22} color={n<=rating?"#f59e0b":"#e2e8f0"} />)}
                </View>
              </View>
            ) : (
              <>
                <TouchableOpacity style={s.mClose} onPress={closeReview}><Ionicons name="close" size={18} color="#aaa" /></TouchableOpacity>
                <View style={s.mIconWrap}><Ionicons name="restaurant" size={28} color={statusColor} /></View>
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
                  style={s.reviewInput} placeholder="Tell us about your experience..."
                  placeholderTextColor="#bbb" value={reviewText} onChangeText={setReviewText}
                  multiline maxLength={300}
                />
                <TouchableOpacity style={[s.submitBtn, { backgroundColor: statusColor }, submitting && { opacity: 0.65 }]} onPress={submitReview} disabled={submitting} activeOpacity={0.9}>
                  <Text style={s.submitTxt}>{submitting ? "Submitting..." : "Submit Review"}</Text>
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

  // full-screen map
  map: { ...StyleSheet.absoluteFillObject },

  // floating top bar
  topBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", justifyContent: "space-between",
    paddingHorizontal: 16, zIndex: 10,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#fff", justifyContent: "center", alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 6,
  },
  locateBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#fff", justifyContent: "center", alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 6,
  },

  // bottom sheet
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    height: SH * 0.56,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 }, elevation: 20,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "#E0E0E0", alignSelf: "center", marginBottom: 14,
  },

  // status
  statusPill: {
    flexDirection: "row", alignItems: "center", gap: 8,
    alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, marginBottom: 4,
  },
  statusDot:    { width: 8, height: 8, borderRadius: 4 },
  statusPillTxt:{ fontSize: 14, fontWeight: "800" },
  statusSub:    { fontSize: 12, color: GRAY, marginBottom: 14, fontWeight: "500" },

  // stepper card
  stepperCard: {
    backgroundColor: "#FAFAFA", borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1, borderColor: "#F0F0F0",
  },
  stepRow:  { flexDirection: "row", alignItems: "flex-start" },
  stepLeft: { alignItems: "center", width: 30 },
  stepDot:  { width: 26, height: 26, borderRadius: 13, justifyContent: "center", alignItems: "center" },
  stepLine: { width: 2, flex: 1, minHeight: 12, marginVertical: 2 },
  stepBody: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10, paddingVertical: 5,
    marginBottom: 2, minHeight: 34,
    borderLeftWidth: 0,
  },
  stepBodyActive: {
    backgroundColor: "#fff", borderRadius: 10,
    borderLeftWidth: 3,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  stepLabel:     { fontSize: 12, fontWeight: "600", color: "#9CA3AF", flex: 1 },
  stepLabelDone: { color: "#10B981" },
  nowBadge:      { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  nowBadgeTxt:   { color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },

  // scheduled / cancelled
  scheduledCard: {
    alignItems: "center", paddingVertical: 28, backgroundColor: "#FAF5FF",
    borderRadius: 16, marginBottom: 12, gap: 6,
    borderWidth: 1, borderColor: "#E9D5FF",
  },
  scheduledTitle: { fontSize: 16, fontWeight: "700", color: "#9333EA" },
  scheduledTime:  { fontSize: 14, fontWeight: "700", color: DARK },
  scheduledSub:   { fontSize: 12, color: GRAY, textAlign: "center", paddingHorizontal: 20 },
  cancelledCard: {
    alignItems: "center", paddingVertical: 24, backgroundColor: "#FFF5F5",
    borderRadius: 16, marginBottom: 12, gap: 6,
  },
  cancelledTitle: { fontSize: 16, fontWeight: "700", color: "#FF3B30" },
  cancelledSub:   { fontSize: 12, color: GRAY },

  // rider
  riderCard: {
    backgroundColor: "#FAFAFA", borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 12, borderWidth: 1, borderColor: "#F0F0F0",
  },
  riderRow:   { flexDirection: "row", alignItems: "center" },
  riderAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#FFF5EE", justifyContent: "center", alignItems: "center",
    borderWidth: 2, borderColor: "#FFE0C8",
  },
  riderName: { fontSize: 14, fontWeight: "700", color: DARK },
  riderRole: { fontSize: 11, color: GRAY, marginTop: 2 },
  callBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 9, paddingHorizontal: 16, borderRadius: 22,
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  callTxt:    { color: "#fff", fontWeight: "700", fontSize: 13 },
  noRiderRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  noRiderTxt: { fontSize: 12, color: GRAY, fontWeight: "500" },

  // bill
  billHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#FAFAFA", borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 4, borderWidth: 1, borderColor: "#F0F0F0",
  },
  billHeaderLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  billRestName:   { fontSize: 14, fontWeight: "700", color: DARK },
  billMeta:       { fontSize: 11, color: GRAY, marginTop: 2 },
  billChevron:    { marginLeft: 8 },
  billBody: {
    backgroundColor: "#FAFAFA", borderRadius: 16,
    paddingHorizontal: 14, paddingTop: 4, paddingBottom: 12,
    marginBottom: 12, borderWidth: 1, borderColor: "#F0F0F0",
  },
  itemRow:    { flexDirection: "row", alignItems: "center", paddingVertical: 6, gap: 10 },
  itemQtyBox: { width: 22, height: 22, borderWidth: 1.5, borderColor: ORANGE, justifyContent: "center", alignItems: "center", backgroundColor: "#FFF5EE", borderRadius: 4 },
  itemQtyTxt: { fontSize: 10, fontWeight: "700", color: ORANGE },
  itemName:   { flex: 1, fontSize: 13, color: DARK, fontWeight: "500" },
  itemPrice:  { fontSize: 13, fontWeight: "700", color: DARK },
  billDivider:{ height: 1, backgroundColor: "#E5E7EB", marginVertical: 8 },
  billRow:    { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  billLbl:    { fontSize: 12, color: GRAY, fontWeight: "500" },
  billVal:    { fontSize: 12, color: DARK, fontWeight: "600" },
  billTotalRow: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#E5E7EB", paddingTop: 8, marginTop: 4 },
  billTotalLbl: { fontSize: 14, fontWeight: "700", color: DARK },
  billTotalVal: { fontSize: 14, fontWeight: "800", color: DARK },

  // rate
  rateCta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: 4, paddingVertical: 14, borderRadius: 14,
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }, elevation: 5,
  },
  rateCtaTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
  reviewedRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: 4, backgroundColor: "#F0FDF4", paddingVertical: 12, borderRadius: 14,
    borderWidth: 1, borderColor: "#BBF7D0",
  },
  reviewedTxt: { color: "#16A34A", fontWeight: "700", fontSize: 13 },

  // modal
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 24 },
  modalCard: {
    backgroundColor: "#fff", padding: 32, width: "100%", alignItems: "center",
    borderRadius: 24, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 30,
    shadowOffset: { width: 0, height: 10 }, elevation: 20,
  },
  mClose:    { position: "absolute", top: 18, right: 18, padding: 8 },
  mIconWrap: { width: 68, height: 68, borderRadius: 34, backgroundColor: "#FFF5EE", justifyContent: "center", alignItems: "center", marginBottom: 16, borderWidth: 2, borderColor: "#FFE0C8" },
  mTitle:    { fontSize: 22, fontWeight: "800", color: DARK, marginBottom: 6 },
  mSub:      { fontSize: 14, color: GRAY, marginBottom: 24 },
  starsRow:  { flexDirection: "row", gap: 8, marginBottom: 10 },
  ratingLbl: { fontSize: 14, fontWeight: "700", color: "#f59e0b", marginBottom: 16 },
  reviewInput: {
    width: "100%", borderWidth: 1.5, borderColor: "#E5E7EB", padding: 16,
    fontSize: 14, color: DARK, minHeight: 100, textAlignVertical: "top",
    marginBottom: 20, marginTop: 8, backgroundColor: "#FAFAFA", borderRadius: 12,
  },
  submitBtn: {
    width: "100%", paddingVertical: 16, alignItems: "center", borderRadius: 14,
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  submitTxt:   { color: "#fff", fontWeight: "700", fontSize: 16 },
  skipTxt:     { fontSize: 14, color: "#9CA3AF", fontWeight: "500" },
  successWrap: { alignItems: "center", paddingVertical: 24 },
});
