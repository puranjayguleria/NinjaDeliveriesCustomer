import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, StatusBar, ActivityIndicator, Modal,
  Animated, TextInput, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled';

const STATUS_STEPS: { key: OrderStatus; label: string; icon: string }[] = [
  { key: 'pending',          label: 'Order Placed',     icon: 'receipt-outline' },
  { key: 'confirmed',        label: 'Order Confirmed',  icon: 'checkmark-circle-outline' },
  { key: 'preparing',        label: 'Preparing Food',   icon: 'restaurant-outline' },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: 'bicycle-outline' },
  { key: 'delivered',        label: 'Delivered',        icon: 'home-outline' },
];

const STATUS_ORDER: OrderStatus[] = [
  'pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered',
];

function getStepIndex(status: OrderStatus) {
  return STATUS_ORDER.indexOf(status);
}

export default function FoodTrackingScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { orderId } = route.params ?? {};

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Review modal state
  const [reviewModal, setReviewModal] = useState(false);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reviewed, setReviewed] = useState(false);

  // Animation for modal
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Track if we already showed the modal for this delivery
  const reviewShownRef = useRef(false);

  useEffect(() => {
    if (!orderId) return;
    const unsub = firestore()
      .collection('restaurant_Orders')
      .doc(orderId)
      .onSnapshot(snap => {
        if (snap.exists) {
          const data = { id: snap.id, ...snap.data() } as any;
          setOrder(data);
          // Auto-show review modal when delivered (only once)
          if (data.status === 'delivered' && !reviewShownRef.current && !data.reviewed) {
            reviewShownRef.current = true;
            setTimeout(() => openReviewModal(), 800);
          }
        }
        setLoading(false);
      });
    return unsub;
  }, [orderId]);

  const openReviewModal = () => {
    setReviewModal(true);
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  };

  const closeReviewModal = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, { toValue: 0.8, duration: 180, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => setReviewModal(false));
  };

  const submitReview = async () => {
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please select a star rating.');
      return;
    }
    setSubmitting(true);
    try {
      const user = auth().currentUser;
      const reviewData = {
        orderId,
        restaurantId: order?.restaurantId ?? '',
        restaurantName: order?.restaurantName ?? '',
        userId: user?.uid ?? '',
        rating,
        review: reviewText.trim(),
        createdAt: firestore.FieldValue.serverTimestamp(),
      };

      // Save review to restaurant_Reviews collection
      await firestore().collection('restaurant_Reviews').add(reviewData);

      // Mark order as reviewed
      await firestore().collection('restaurant_Orders').doc(orderId).update({ reviewed: true });

      setReviewed(true);
      closeReviewModal();
    } catch (e) {
      Alert.alert('Error', 'Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={s.center}>
        <Text style={s.errorText}>Order not found.</Text>
      </View>
    );
  }

  const currentStatus: OrderStatus = order.status ?? 'pending';
  const isCancelled = currentStatus === 'cancelled';
  const isDelivered = currentStatus === 'delivered';
  const currentStep = getStepIndex(currentStatus);

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1e293b" />
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>Track Order</Text>
          <Text style={s.headerSub}>{order.restaurantName}</Text>
        </View>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Status Banner */}
        <View style={[s.banner, isCancelled && s.bannerCancelled, isDelivered && s.bannerDelivered]}>
          <Ionicons
            name={isCancelled ? 'close-circle' : isDelivered ? 'checkmark-circle' : 'time-outline'}
            size={22}
            color={isCancelled ? '#ef4444' : isDelivered ? '#16a34a' : '#FF6B35'}
          />
          <Text style={[s.bannerText, isCancelled && s.bannerTextCancelled, isDelivered && s.bannerTextDelivered]}>
            {isCancelled
              ? 'Your order was cancelled'
              : isDelivered
              ? 'Order Delivered! Enjoy your meal 🎉'
              : 'Your order is being processed'}
          </Text>
        </View>

        {/* Stepper */}
        {!isCancelled && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Order Status</Text>
            {STATUS_STEPS.map((step, idx) => {
              const done = idx <= currentStep;
              const active = idx === currentStep;
              const isLast = idx === STATUS_STEPS.length - 1;
              return (
                <View key={step.key} style={s.stepRow}>
                  <View style={s.stepLeft}>
                    <View style={[s.stepCircle, done && s.stepCircleDone]}>
                      <Ionicons name={step.icon as any} size={16} color={done ? '#fff' : '#cbd5e1'} />
                    </View>
                    {!isLast && <View style={[s.stepLine, done && idx < currentStep && s.stepLineDone]} />}
                  </View>
                  <View style={s.stepContent}>
                    <Text style={[s.stepLabel, done && s.stepLabelDone, active && s.stepLabelActive]}>
                      {step.label}
                    </Text>
                    {active && !isDelivered && <Text style={s.stepSub}>In progress...</Text>}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Rate & Review button (if delivered and not yet reviewed) */}
        {isDelivered && !reviewed && !order.reviewed && (
          <TouchableOpacity style={s.reviewBtn} onPress={openReviewModal} activeOpacity={0.9}>
            <Ionicons name="star" size={18} color="#fff" />
            <Text style={s.reviewBtnText}>Rate Your Experience</Text>
          </TouchableOpacity>
        )}

        {/* Already reviewed */}
        {(reviewed || order.reviewed) && isDelivered && (
          <View style={s.reviewedBadge}>
            <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
            <Text style={s.reviewedText}>Thanks for your feedback!</Text>
          </View>
        )}

        {/* Order Summary */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Order Summary</Text>
          {(order.items ?? []).map((item: any, idx: number) => (
            <View key={idx} style={s.itemRow}>
              <Text style={s.itemQty}>{item.qty}x</Text>
              <Text style={s.itemName} numberOfLines={1}>{item.name}</Text>
              <Text style={s.itemPrice}>₹{item.price * item.qty}</Text>
            </View>
          ))}
        </View>

        {/* Bill */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Bill Details</Text>
          <View style={s.billRow}>
            <Text style={s.billLabel}>Item Total</Text>
            <Text style={s.billValue}>₹{order.subtotal}</Text>
          </View>
          <View style={s.billRow}>
            <Text style={s.billLabel}>Delivery Fee</Text>
            <Text style={[s.billValue, order.deliveryFee === 0 && { color: '#16a34a' }]}>
              {order.deliveryFee === 0 ? 'FREE' : `₹${order.deliveryFee}`}
            </Text>
          </View>
          <View style={s.billRow}>
            <Text style={s.billLabel}>Taxes</Text>
            <Text style={s.billValue}>₹{order.taxes}</Text>
          </View>
          <View style={[s.billRow, s.billTotal]}>
            <Text style={s.billTotalLabel}>Total Paid</Text>
            <Text style={s.billTotalValue}>₹{order.grandTotal}</Text>
          </View>
        </View>

        {/* Delivery Info */}
        <View style={s.card}>
          <View style={s.infoRow}>
            <Ionicons name="location-outline" size={16} color="#FF6B35" />
            <Text style={s.infoText}>{order.deliveryAddress}</Text>
          </View>
          <View style={s.infoRow}>
            <Ionicons name="card-outline" size={16} color="#FF6B35" />
            <Text style={s.infoText}>{order.paymentMethod}</Text>
          </View>
          {!!order.instructions && (
            <View style={s.infoRow}>
              <Ionicons name="chatbubble-outline" size={16} color="#FF6B35" />
              <Text style={s.infoText}>{order.instructions}</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={s.homeBtn}
          onPress={() => navigation.navigate('HomeTab', { screen: 'ProductsHome' })}
          activeOpacity={0.9}
        >
          <Text style={s.homeBtnText}>Back to Restaurants</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Review Modal ── */}
      <Modal visible={reviewModal} transparent animationType="none" onRequestClose={closeReviewModal}>
        <View style={s.modalOverlay}>
          <Animated.View style={[s.modalBox, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>

            {/* Close */}
            <TouchableOpacity style={s.modalClose} onPress={closeReviewModal}>
              <Ionicons name="close" size={20} color="#94a3b8" />
            </TouchableOpacity>

            {/* Icon */}
            <View style={s.modalIconWrap}>
              <Ionicons name="restaurant" size={36} color="#FF6B35" />
            </View>

            <Text style={s.modalTitle}>How was your order?</Text>
            <Text style={s.modalSub}>from {order.restaurantName}</Text>

            {/* Stars */}
            <View style={s.starsRow}>
              {[1, 2, 3, 4, 5].map(star => (
                <TouchableOpacity key={star} onPress={() => setRating(star)} activeOpacity={0.7}>
                  <Ionicons
                    name={star <= rating ? 'star' : 'star-outline'}
                    size={36}
                    color={star <= rating ? '#f59e0b' : '#e2e8f0'}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Rating label */}
            {rating > 0 && (
              <Text style={s.ratingLabel}>
                {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'][rating]}
              </Text>
            )}

            {/* Review input */}
            <TextInput
              style={s.reviewInput}
              placeholder="Tell us more about your experience..."
              placeholderTextColor="#94a3b8"
              value={reviewText}
              onChangeText={setReviewText}
              multiline
              maxLength={300}
            />

            {/* Submit */}
            <TouchableOpacity
              style={[s.submitBtn, submitting && { opacity: 0.7 }]}
              onPress={submitReview}
              disabled={submitting}
              activeOpacity={0.9}
            >
              {submitting
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.submitBtnText}>Submit Review</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity onPress={closeReviewModal} style={{ marginTop: 12 }}>
              <Text style={s.skipText}>Skip for now</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 15, color: '#94a3b8' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : 40,
    paddingBottom: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', textAlign: 'center' },
  headerSub: { fontSize: 12, color: '#94a3b8', textAlign: 'center' },

  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff5f0', marginHorizontal: 16, marginTop: 14,
    borderRadius: 12, padding: 14,
    borderLeftWidth: 3, borderLeftColor: '#FF6B35',
  },
  bannerCancelled: { backgroundColor: '#fef2f2', borderLeftColor: '#ef4444' },
  bannerDelivered: { backgroundColor: '#f0fdf4', borderLeftColor: '#16a34a' },
  bannerText: { fontSize: 14, fontWeight: '600', color: '#FF6B35', flex: 1 },
  bannerTextCancelled: { color: '#ef4444' },
  bannerTextDelivered: { color: '#16a34a' },

  card: {
    backgroundColor: '#fff', marginHorizontal: 16, marginTop: 14,
    borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginBottom: 14 },

  stepRow: { flexDirection: 'row', alignItems: 'flex-start' },
  stepLeft: { alignItems: 'center', width: 36 },
  stepCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#e2e8f0',
  },
  stepCircleDone: { backgroundColor: '#FF6B35', borderColor: '#FF6B35' },
  stepLine: { width: 2, height: 28, backgroundColor: '#e2e8f0', marginVertical: 2 },
  stepLineDone: { backgroundColor: '#FF6B35' },
  stepContent: { flex: 1, paddingLeft: 12, paddingBottom: 20 },
  stepLabel: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },
  stepLabelDone: { color: '#1e293b' },
  stepLabelActive: { color: '#FF6B35', fontWeight: '700' },
  stepSub: { fontSize: 11, color: '#FF6B35', marginTop: 2 },

  reviewBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 14,
    backgroundColor: '#f59e0b', borderRadius: 14, paddingVertical: 14,
  },
  reviewBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  reviewedBadge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 14,
    backgroundColor: '#f0fdf4', borderRadius: 14, paddingVertical: 14,
  },
  reviewedText: { color: '#16a34a', fontWeight: '600', fontSize: 14 },

  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 },
  itemQty: { fontSize: 13, fontWeight: '700', color: '#FF6B35', width: 28 },
  itemName: { flex: 1, fontSize: 13, color: '#1e293b' },
  itemPrice: { fontSize: 13, fontWeight: '600', color: '#1e293b' },

  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  billLabel: { fontSize: 13, color: '#64748b' },
  billValue: { fontSize: 13, color: '#1e293b', fontWeight: '500' },
  billTotal: { borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 12, marginTop: 4, marginBottom: 0 },
  billTotalLabel: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  billTotalValue: { fontSize: 15, fontWeight: '800', color: '#FF6B35' },

  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  infoText: { flex: 1, fontSize: 13, color: '#475569', lineHeight: 20 },

  homeBtn: {
    marginHorizontal: 16, marginTop: 20,
    backgroundColor: '#FF6B35', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  homeBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalBox: {
    backgroundColor: '#fff', borderRadius: 24, padding: 28,
    width: '100%', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 24, elevation: 12,
  },
  modalClose: { position: 'absolute', top: 16, right: 16, padding: 4 },
  modalIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#fff5f0', justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1e293b', marginBottom: 4 },
  modalSub: { fontSize: 13, color: '#94a3b8', marginBottom: 20 },

  starsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  ratingLabel: { fontSize: 14, fontWeight: '700', color: '#f59e0b', marginBottom: 16 },

  reviewInput: {
    width: '100%', borderWidth: 1.5, borderColor: '#e2e8f0',
    borderRadius: 12, padding: 14, fontSize: 13, color: '#1e293b',
    minHeight: 90, textAlignVertical: 'top', marginBottom: 20, marginTop: 8,
  },
  submitBtn: {
    width: '100%', backgroundColor: '#FF6B35',
    borderRadius: 14, paddingVertical: 14, alignItems: 'center',
  },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  skipText: { fontSize: 13, color: '#94a3b8' },
});
