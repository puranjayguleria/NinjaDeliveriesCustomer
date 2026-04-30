import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, StatusBar, Animated, Modal, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useFoodCart } from '@/context/FoodCartContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useLocationContext } from '@/context/LocationContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import PaymentMethodModal from '@/components/PaymentMethodModal';

const ORANGE    = '#FF6B35';
const ORANGE_LT = '#FFF3EE';
const DARK      = '#1A1D2E';
const DARK2     = '#2D3142';
const GRAY      = '#8A8FA8';
const GRAY_LT   = '#F4F5F9';
const GREEN     = '#22C55E';
const GREEN_LT  = '#F0FDF4';
const RED       = '#EF4444';
const WHITE     = '#FFFFFF';
const BORDER    = '#ECEEF5';
const FOOTER_H  = 72;

type PaymentMethod = 'Cash on Delivery' | 'UPI';

export default function FoodCartScreen() {
  const navigation = useNavigation<any>();
  const insets     = useSafeAreaInsets();
  const { cartItems, addItem, removeItem, totalItems, totalPrice, clearCart } = useFoodCart();
  const { location } = useLocationContext();

  const [placing, setPlacing]                  = useState(false);
  const [showPayModal, setShowPayModal]         = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showLoginModal, setShowLoginModal]     = useState(false);
  const [deliveryAddress, setDeliveryAddress]   = useState(location?.address || '');
  const [isScheduled, setIsScheduled]           = useState(false);
  const [scheduledDate, setScheduledDate]       = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker]     = useState(false);
  const [showTimePicker, setShowTimePicker]     = useState(false);

  useEffect(() => { if (location?.address) setDeliveryAddress(location.address); }, [location]);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  // Bill calculations
  const itemsSubtotal  = cartItems.reduce((sum, item) => sum + item.price * item.qty, 0);
  const addonsSubtotal = cartItems.reduce((sum, item) =>
    sum + (item.addons || []).reduce((a, addon) => a + addon.price, 0) * item.qty, 0);
  const deliveryFee  = totalPrice >= 199 ? 0 : 40;
  const gst          = Math.round(totalPrice * 0.05);
  const platformFee  = 5;
  const packagingFee = 20;
  const grandTotal   = totalPrice + deliveryFee + gst + platformFee + packagingFee;
  const footerH      = FOOTER_H + (insets.bottom > 0 ? insets.bottom : 16);

  // Delivery time estimate
  const maxCookingMins = cartItems.reduce((max, item) => {
    const total = Number((item as any).cookingTimeHours ?? 0) * 60 + Number((item as any).cookingTimeMinutes ?? 0);
    return total > max ? total : max;
  }, 0);
  const itemCount = cartItems.reduce((sum, item) => sum + (item.qty ?? 1), 0);
  const extraBuffer = itemCount > 1 ? (itemCount - 1) * 5 : 0;
  const estimatedDeliveryMins = maxCookingMins > 0
    ? maxCookingMins + extraBuffer + 10
    : itemCount > 1 ? 35 + extraBuffer : null;

  const restaurantName = cartItems[0]?.restaurantName ?? 'Restaurant';

  // Schedule helpers
  const handleScheduleToggle = () => {
    if (!isScheduled) {
      const d = new Date(); d.setHours(d.getHours() + 1); d.setMinutes(0);
      setScheduledDate(d);
    }
    setIsScheduled(!isScheduled);
  };
  const handleDateChange = (_: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      const d = new Date(scheduledDate || new Date());
      d.setFullYear(date.getFullYear()); d.setMonth(date.getMonth()); d.setDate(date.getDate());
      setScheduledDate(d);
    }
  };
  const handleTimeChange = (_: any, time?: Date) => {
    setShowTimePicker(false);
    if (time) {
      const d = new Date(scheduledDate || new Date());
      d.setHours(time.getHours()); d.setMinutes(time.getMinutes());
      setScheduledDate(d);
    }
  };
  const formatScheduledTime = () => {
    if (!scheduledDate) return '';
    const today = new Date(); const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const timeStr = scheduledDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    if (scheduledDate.toDateString() === today.toDateString())    return `Today, ${timeStr}`;
    if (scheduledDate.toDateString() === tomorrow.toDateString()) return `Tomorrow, ${timeStr}`;
    return `${scheduledDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${timeStr}`;
  };

  // Place order
  const placeOrder = async (method: PaymentMethod) => {
    const user = auth().currentUser;
    if (!user) { setShowPayModal(false); setShowLoginModal(true); return; }
    if (!deliveryAddress) { Alert.alert('Address Missing', 'Please set a delivery address first.'); return; }
    if (isScheduled && scheduledDate) {
      if (scheduledDate < new Date(Date.now() + 30 * 60000)) {
        Alert.alert('Invalid Time', 'Scheduled time must be at least 30 minutes from now.'); return;
      }
    }
    setShowPayModal(false);
    setPlacing(true);
    try {
      const restaurantId = cartItems[0]?.restaurantId ?? '';
      const orderRef = firestore().collection('restaurant_Orders').doc();
      const orderData: any = {
        userId: user.uid, userPhone: user.phoneNumber ?? '',
        restaurantId, restaurantName,
        items: cartItems.map(item => ({
          id: item.id, name: item.name, price: item.price, qty: item.qty,
          variant: item.variant ?? null, addons: item.addons ?? [],
          image: item.image ?? null, description: item.description ?? null,
          cookingTimeHours: (item as any).cookingTimeHours ?? null,
          cookingTimeMinutes: (item as any).cookingTimeMinutes ?? null,
        })),
        subtotal: totalPrice, deliveryFee, gst, platformFee, packagingFee, grandTotal,
        paymentMethod: method,
        deliveryAddress, deliveryLat: location?.lat ?? null, deliveryLng: location?.lng ?? null,
        status: isScheduled ? 'scheduled' : 'pending',
        createdAt: firestore.FieldValue.serverTimestamp(),
        orderId: orderRef.id,
      };
      if (isScheduled && scheduledDate) {
        orderData.scheduledFor = firestore.Timestamp.fromDate(scheduledDate);
        orderData.isScheduled = true;
      }
      await orderRef.set(orderData);
      clearCart();
      navigation.reset({ index: 0, routes: [{ name: 'FoodOrderSuccess', params: { grandTotal, restaurantName, orderId: orderRef.id, isScheduled } }] });
    } catch (err: any) {
      Alert.alert('Error', `Failed to place order: ${err.message || 'Please try again.'}`);
    } finally {
      setPlacing(false);
    }
  };

  /* ── EMPTY STATE ── */
  if (cartItems.length === 0) {
    return (
      <View style={s.emptyRoot}>
        <StatusBar barStyle="dark-content" backgroundColor={WHITE} />
        <View style={[s.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={22} color={DARK} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>My Cart</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.emptyBody}>
          <View style={s.emptyIllustration}>
            <View style={s.emptyCircleOuter}>
              <View style={s.emptyCircleInner}>
                <Ionicons name="bag-outline" size={52} color={ORANGE} />
              </View>
            </View>
          </View>
          <Text style={s.emptyTitle}>Your bag is empty</Text>
          <Text style={s.emptySub}>Add items from a restaurant{'\n'}to get started</Text>
          <TouchableOpacity style={s.browseBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <Text style={s.browseBtnTxt}>Explore Restaurants</Text>
            <Ionicons name="arrow-forward" size={16} color={WHITE} style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={WHITE} />

      {/* ADDRESS REQUIRED MODAL */}
      <Modal visible={showAddressModal} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={[s.modalIconWrap, { backgroundColor: ORANGE_LT }]}>
              <Ionicons name="location" size={32} color={ORANGE} />
            </View>
            <Text style={s.modalTitle}>Add Delivery Address</Text>
            <Text style={s.modalSubtitle}>We need your location to deliver your order to the right place.</Text>
            <TouchableOpacity style={s.modalPrimaryBtn} activeOpacity={0.85} onPress={() => {
              setShowAddressModal(false);
              navigation.navigate('LocationSelector', { fromScreen: 'foodcheckout' });
            }}>
              <Text style={s.modalPrimaryText}>Set Address</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.modalSecondaryBtn} activeOpacity={0.85} onPress={() => {
              setShowAddressModal(false); navigation.goBack();
            }}>
              <Text style={s.modalSecondaryText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* LOGIN REQUIRED MODAL */}
      <Modal visible={showLoginModal} transparent animationType="fade" onRequestClose={() => setShowLoginModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={[s.modalIconWrap, { backgroundColor: '#EEF2FF' }]}>
              <Ionicons name="person" size={32} color="#6366F1" />
            </View>
            <Text style={s.modalTitle}>Login to Continue</Text>
            <Text style={s.modalSubtitle}>Sign in to place your order and track it in real time.</Text>
            <TouchableOpacity style={s.modalPrimaryBtn} activeOpacity={0.85} onPress={() => {
              setShowLoginModal(false);
              navigation.navigate('LoginInHomeStack' as never);
            }}>
              <Text style={s.modalPrimaryText}>Login Now</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.modalSecondaryBtn} activeOpacity={0.85} onPress={() => setShowLoginModal(false)}>
              <Text style={s.modalSecondaryText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* HEADER */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color={DARK} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Your Order</Text>
          <View style={s.headerRestaurantRow}>
            <Ionicons name="storefront-outline" size={11} color={GRAY} />
            <Text style={s.headerSub} numberOfLines={1}>{restaurantName}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={clearCart} style={s.iconBtn} hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }}>
          <Ionicons name="trash-outline" size={20} color={RED} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: footerH + 20, paddingTop: 8 }}
      >

        {/* ITEMS SECTION */}
        <View style={s.section}>
          <View style={s.sectionLabelRow}>
            <View style={s.sectionDot} />
            <Text style={s.sectionLabel}>ORDER ITEMS</Text>
            <View style={s.pill}>
              <Text style={s.pillText}>{totalItems} {totalItems === 1 ? 'item' : 'items'}</Text>
            </View>
          </View>

          <View style={s.card}>
            {cartItems.map((item, idx) => (
              <View key={item.id}>
                {idx > 0 && <View style={s.divider} />}
                <View style={s.itemRow}>
                  {/* Left: image */}
                  <View style={s.itemImgWrap}>
                    {item.image
                      ? <Image source={{ uri: item.image }} style={s.itemImg} contentFit="cover" />
                      : (
                        <View style={[s.itemImg, s.imgFallback]}>
                          <Ionicons name="fast-food-outline" size={22} color="#CBD5E1" />
                        </View>
                      )
                    }
                    {/* veg indicator */}
                    <View style={s.vegBadge}>
                      <View style={s.vegDot} />
                    </View>
                  </View>

                  {/* Middle: details */}
                  <View style={s.itemDetails}>
                    <Text style={s.itemName} numberOfLines={2}>{item.name}</Text>
                    {!!item.variant && (
                      <View style={s.variantChip}>
                        <Text style={s.variantChipText}>{item.variant}</Text>
                      </View>
                    )}
                    {(() => {
                      const h = Number((item as any).cookingTimeHours ?? 0);
                      const m = Number((item as any).cookingTimeMinutes ?? 0);
                      if (h === 0 && m === 0) return null;
                      const timeStr = h > 0 && m > 0 ? `${h}h ${m}m` : h > 0 ? `${h}h` : `${m}m`;
                      return (
                        <View style={s.timeChip}>
                          <Ionicons name="time-outline" size={10} color={GRAY} />
                          <Text style={s.timeChipText}>{timeStr}</Text>
                        </View>
                      );
                    })()}
                    <Text style={s.itemPrice}>₹{item.price * item.qty}</Text>
                  </View>

                  {/* Right: stepper */}
                  <View style={s.stepperWrap}>
                    <TouchableOpacity
                      style={s.stepMinus}
                      onPress={() => removeItem(item.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="remove" size={14} color={ORANGE} />
                    </TouchableOpacity>
                    <Text style={s.stepQty}>{item.qty}</Text>
                    <TouchableOpacity
                      style={s.stepPlus}
                      onPress={() => addItem({ ...item })}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="add" size={14} color={WHITE} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Addons */}
                {!!item.addons && item.addons.length > 0 && (
                  <View style={s.addonsBox}>
                    <View style={s.addonsTitleRow}>
                      <Ionicons name="add-circle-outline" size={12} color={ORANGE} />
                      <Text style={s.addonsLabel}>Add-ons</Text>
                      <Text style={s.addonsTotalText}>+₹{item.addons.reduce((sum, a) => sum + a.price, 0) * item.qty}</Text>
                    </View>
                    {item.addons.map((addon, ai) => (
                      <View key={ai} style={s.addonItem}>
                        <View style={s.addonDot} />
                        <Text style={s.addonName}>{addon.name}</Text>
                        <Text style={s.addonPrice}>₹{addon.price} × {item.qty}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}

            <TouchableOpacity style={s.addMoreRow} onPress={() => navigation.goBack()} activeOpacity={0.7}>
              <View style={s.addMoreIcon}>
                <Ionicons name="add" size={14} color={ORANGE} />
              </View>
              <Text style={s.addMoreText}>Add more items</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* DELIVERY ADDRESS */}
        <View style={s.section}>
          <View style={s.sectionLabelRow}>
            <View style={s.sectionDot} />
            <Text style={s.sectionLabel}>DELIVERY TO</Text>
          </View>
          <View style={s.card}>
            {deliveryAddress ? (
              <View style={s.addressRow}>
                <View style={s.addressIconWrap}>
                  <Ionicons name="location" size={18} color={ORANGE} />
                </View>
                <Text style={s.addressText} numberOfLines={3}>{deliveryAddress}</Text>
                <TouchableOpacity
                  style={s.editBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={() => navigation.navigate('LocationSelector', { fromScreen: 'foodcheckout' })}
                >
                  <Ionicons name="pencil" size={14} color={ORANGE} />
                  <Text style={s.editBtnText}>Edit</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={s.addAddressBtn}
                onPress={() => navigation.navigate('LocationSelector', { fromScreen: 'foodcheckout' })}
                activeOpacity={0.8}
              >
                <View style={s.addAddressIcon}>
                  <Ionicons name="add" size={18} color={ORANGE} />
                </View>
                <Text style={s.addAddressText}>Add delivery address</Text>
                <Ionicons name="chevron-forward" size={16} color={GRAY} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* DELIVERY TIME */}
        <View style={s.section}>
          <View style={s.sectionLabelRow}>
            <View style={s.sectionDot} />
            <Text style={s.sectionLabel}>DELIVERY TIME</Text>
          </View>
          <View style={s.card}>
            <View style={s.deliveryOptions}>
              <TouchableOpacity
                style={[s.deliveryOption, !isScheduled && s.deliveryOptionActive]}
                onPress={() => setIsScheduled(false)}
                activeOpacity={0.8}
              >
                <View style={[s.deliveryOptionIcon, !isScheduled && { backgroundColor: ORANGE_LT }]}>
                  <Ionicons name="flash" size={18} color={!isScheduled ? ORANGE : GRAY} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.deliveryOptionTitle, !isScheduled && { color: ORANGE }]}>Now</Text>
                  <Text style={s.deliveryOptionSub}>
                    {estimatedDeliveryMins ? `~${estimatedDeliveryMins} min` : '30–40 min'}
                  </Text>
                </View>
                {!isScheduled && <View style={s.radioActive}><View style={s.radioDot} /></View>}
                {isScheduled && <View style={s.radioInactive} />}
              </TouchableOpacity>

              <View style={s.deliveryOptionDivider} />

              <TouchableOpacity
                style={[s.deliveryOption, isScheduled && s.deliveryOptionActive]}
                onPress={handleScheduleToggle}
                activeOpacity={0.8}
              >
                <View style={[s.deliveryOptionIcon, isScheduled && { backgroundColor: ORANGE_LT }]}>
                  <Ionicons name="calendar" size={18} color={isScheduled ? ORANGE : GRAY} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.deliveryOptionTitle, isScheduled && { color: ORANGE }]}>Schedule</Text>
                  <Text style={s.deliveryOptionSub}>Pick date & time</Text>
                </View>
                {isScheduled && <View style={s.radioActive}><View style={s.radioDot} /></View>}
                {!isScheduled && <View style={s.radioInactive} />}
              </TouchableOpacity>
            </View>

            {isScheduled && scheduledDate && (
              <View style={s.scheduleBox}>
                <Text style={s.scheduleBoxLabel}>Scheduled for</Text>
                <Text style={s.scheduleBoxTime}>{formatScheduledTime()}</Text>
                <View style={s.schedulePickerRow}>
                  <TouchableOpacity style={s.schedulePickerBtn} onPress={() => setShowDatePicker(true)}>
                    <Ionicons name="calendar-outline" size={13} color={ORANGE} />
                    <Text style={s.schedulePickerText}>
                      {scheduledDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.schedulePickerBtn} onPress={() => setShowTimePicker(true)}>
                    <Ionicons name="time-outline" size={13} color={ORANGE} />
                    <Text style={s.schedulePickerText}>
                      {scheduledDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* BILL DETAILS */}
        <View style={s.section}>
          <View style={s.sectionLabelRow}>
            <View style={s.sectionDot} />
            <Text style={s.sectionLabel}>BILL SUMMARY</Text>
          </View>
          <View style={s.card}>
            <View style={s.billRow}>
              <Text style={s.billLabel}>Item Total</Text>
              <Text style={s.billValue}>₹{itemsSubtotal}</Text>
            </View>
            {addonsSubtotal > 0 && (
              <View style={s.billRow}>
                <Text style={s.billLabel}>Add-ons</Text>
                <Text style={s.billValue}>₹{addonsSubtotal}</Text>
              </View>
            )}
            <View style={s.billRow}>
              <Text style={s.billLabel}>GST (5%)</Text>
              <Text style={s.billValue}>₹{gst}</Text>
            </View>
            <View style={s.billRow}>
              <View>
                <Text style={s.billLabel}>Delivery Fee</Text>
                {totalPrice < 199 && <Text style={s.billHint}>Free above ₹199</Text>}
              </View>
              <Text style={[s.billValue, deliveryFee === 0 && s.billFree]}>
                {deliveryFee === 0 ? 'FREE' : `₹${deliveryFee}`}
              </Text>
            </View>
            <View style={s.billRow}>
              <Text style={s.billLabel}>Platform Fee</Text>
              <Text style={s.billValue}>₹{platformFee}</Text>
            </View>
            <View style={s.billRow}>
              <Text style={s.billLabel}>Packaging</Text>
              <Text style={s.billValue}>₹{packagingFee}</Text>
            </View>

            <View style={s.billTotalBox}>
              <Text style={s.billTotalLabel}>Total Payable</Text>
              <Text style={s.billTotalValue}>₹{grandTotal}</Text>
            </View>

            {deliveryFee === 0 ? (
              <View style={s.savingsBanner}>
                <Text style={s.savingsText}>🎉 You saved ₹40 on delivery!</Text>
              </View>
            ) : (
              <View style={[s.savingsBanner, { backgroundColor: ORANGE_LT }]}>
                <Ionicons name="bicycle-outline" size={13} color={ORANGE} />
                <Text style={[s.savingsText, { color: ORANGE, marginLeft: 5 }]}>
                  Add ₹{199 - totalPrice} more for free delivery
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* UPI NOTE */}
        <View style={s.upiNote}>
          <Ionicons name="shield-checkmark" size={15} color="#6366F1" />
          <Text style={s.upiNoteText}>Rider carries a QR code for instant UPI payment at doorstep</Text>
        </View>

      </ScrollView>

      {/* FOOTER */}
      <View style={[s.footer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 16 }]}>
        <View style={s.footerInner}>
          <View>
            <Text style={s.footerAmount}>₹{grandTotal}</Text>
            <Text style={s.footerLabel}>{isScheduled ? '📅 Scheduled' : '⚡ Deliver Now'}</Text>
          </View>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              style={s.payBtn}
              activeOpacity={0.88}
              onPress={() => {
                if (!deliveryAddress) { setShowAddressModal(true); return; }
                setShowPayModal(true);
              }}
            >
              <Text style={s.payBtnText}>Proceed to Pay</Text>
              <Ionicons name="arrow-forward-circle" size={20} color={WHITE} />
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>

      {/* DATE / TIME PICKERS */}
      {showDatePicker && (
        <DateTimePicker
          value={scheduledDate || new Date()} mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange} minimumDate={new Date()}
          maximumDate={new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)}
        />
      )}
      {showTimePicker && (
        <DateTimePicker
          value={scheduledDate || new Date()} mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleTimeChange} minuteInterval={15}
        />
      )}

      {/* PAYMENT MODAL */}
      <PaymentMethodModal
        visible={showPayModal}
        onClose={() => setShowPayModal(false)}
        onSelectOnline={() => placeOrder('UPI')}
        onSelectCOD={() => placeOrder('Cash on Delivery')}
        totalAmount={grandTotal}
        loading={placing}
      />

      {/* LOADING OVERLAY */}
      {placing && (
        <View style={s.loadingOverlay}>
          <View style={s.loadingBox}>
            <ActivityIndicator size="large" color={ORANGE} />
            <Text style={s.loadingText}>Placing your order...</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: '#F4F5F9' },
  emptyRoot: { flex: 1, backgroundColor: WHITE },

  /* ── HEADER ── */
  header: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    backgroundColor: WHITE,
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: GRAY_LT,
    justifyContent: 'center', alignItems: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle:  { fontSize: 17, fontWeight: '700', color: DARK, letterSpacing: -0.3 },
  headerRestaurantRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  headerSub:    { fontSize: 11, color: GRAY },

  /* ── EMPTY STATE ── */
  emptyBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyIllustration: { marginBottom: 32 },
  emptyCircleOuter: {
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: '#FFF3EE',
    justifyContent: 'center', alignItems: 'center',
  },
  emptyCircleInner: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: ORANGE_LT,
    justifyContent: 'center', alignItems: 'center',
  },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: DARK, marginBottom: 8, letterSpacing: -0.4 },
  emptySub:   { fontSize: 14, color: GRAY, textAlign: 'center', lineHeight: 22 },
  browseBtn:  {
    marginTop: 32, backgroundColor: ORANGE,
    paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: ORANGE, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  browseBtnTxt: { color: WHITE, fontWeight: '700', fontSize: 15, letterSpacing: 0.2 },

  /* ── SECTION ── */
  section: { marginHorizontal: 14, marginTop: 14 },
  sectionLabelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8,
  },
  sectionDot: {
    width: 4, height: 14, borderRadius: 2, backgroundColor: ORANGE,
  },
  sectionLabel: {
    fontSize: 10, fontWeight: '700', color: GRAY, letterSpacing: 1.2,
  },
  pill: {
    backgroundColor: ORANGE_LT, paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 20, marginLeft: 4,
  },
  pillText: { fontSize: 10, fontWeight: '700', color: ORANGE },

  /* ── CARD ── */
  card: {
    backgroundColor: WHITE, borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 10, elevation: 3,
    overflow: 'hidden',
  },

  /* ── ITEM ROW ── */
  itemRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 14, paddingVertical: 14, gap: 12,
  },
  itemImgWrap: { position: 'relative' },
  itemImg: { width: 72, height: 72, borderRadius: 12 },
  imgFallback: { backgroundColor: GRAY_LT, justifyContent: 'center', alignItems: 'center' },
  vegBadge: {
    position: 'absolute', bottom: -4, left: -4,
    width: 14, height: 14, borderRadius: 3,
    backgroundColor: WHITE, borderWidth: 1.5, borderColor: GREEN,
    justifyContent: 'center', alignItems: 'center',
  },
  vegDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: GREEN },

  itemDetails: { flex: 1, paddingTop: 2 },
  itemName: { fontSize: 14, fontWeight: '600', color: DARK, lineHeight: 20, letterSpacing: -0.2 },
  variantChip: {
    alignSelf: 'flex-start', marginTop: 4,
    backgroundColor: GRAY_LT, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6,
  },
  variantChipText: { fontSize: 10, fontWeight: '600', color: GRAY },
  timeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4,
  },
  timeChipText: { fontSize: 10, color: GRAY },
  itemPrice: { fontSize: 14, fontWeight: '700', color: DARK, marginTop: 6 },

  /* ── STEPPER ── */
  stepperWrap: { alignItems: 'center', gap: 4, paddingTop: 4 },
  stepMinus: {
    width: 28, height: 28, borderRadius: 8,
    borderWidth: 1.5, borderColor: ORANGE,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: WHITE,
  },
  stepQty: { fontSize: 14, fontWeight: '800', color: DARK, minWidth: 20, textAlign: 'center' },
  stepPlus: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: ORANGE,
    justifyContent: 'center', alignItems: 'center',
  },

  divider: { height: 1, backgroundColor: BORDER, marginHorizontal: 14 },

  /* ── ADDONS ── */
  addonsBox: {
    marginHorizontal: 14, marginBottom: 12,
    backgroundColor: '#FAFBFF', borderRadius: 10,
    padding: 10, borderWidth: 1, borderColor: BORDER,
  },
  addonsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  addonsLabel: { flex: 1, fontSize: 10, fontWeight: '700', color: ORANGE, letterSpacing: 0.5 },
  addonsTotalText: { fontSize: 11, fontWeight: '700', color: ORANGE },
  addonItem: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  addonDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: ORANGE },
  addonName: { flex: 1, fontSize: 12, color: DARK2 },
  addonPrice: { fontSize: 11, color: GRAY, fontWeight: '500' },

  /* ── ADD MORE ── */
  addMoreRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: BORDER,
  },
  addMoreIcon: {
    width: 22, height: 22, borderRadius: 6,
    backgroundColor: ORANGE_LT, justifyContent: 'center', alignItems: 'center',
  },
  addMoreText: { fontSize: 13, fontWeight: '600', color: ORANGE },

  /* ── ADDRESS ── */
  addressRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14,
  },
  addressIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: ORANGE_LT, justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  addressText: { flex: 1, fontSize: 13, color: DARK2, lineHeight: 20 },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: ORANGE_LT, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8,
  },
  editBtnText: { fontSize: 11, fontWeight: '600', color: ORANGE },
  addAddressBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14,
  },
  addAddressIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: ORANGE_LT, justifyContent: 'center', alignItems: 'center',
  },
  addAddressText: { flex: 1, fontSize: 13, fontWeight: '600', color: DARK2 },

  /* ── DELIVERY OPTIONS ── */
  deliveryOptions: { flexDirection: 'row' },
  deliveryOption: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14,
  },
  deliveryOptionActive: { backgroundColor: '#FFFAF7' },
  deliveryOptionDivider: { width: 1, backgroundColor: BORDER, marginVertical: 10 },
  deliveryOptionIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: GRAY_LT, justifyContent: 'center', alignItems: 'center',
  },
  deliveryOptionTitle: { fontSize: 13, fontWeight: '700', color: DARK },
  deliveryOptionSub:   { fontSize: 11, color: GRAY, marginTop: 1 },
  radioActive: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: ORANGE,
    justifyContent: 'center', alignItems: 'center',
  },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ORANGE },
  radioInactive: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: '#D1D5DB',
  },

  /* ── SCHEDULE BOX ── */
  scheduleBox: {
    margin: 12, marginTop: 0,
    backgroundColor: ORANGE_LT, borderRadius: 12,
    padding: 12, borderWidth: 1, borderColor: '#FFD4BC',
  },
  scheduleBoxLabel: { fontSize: 10, fontWeight: '600', color: GRAY, letterSpacing: 0.5 },
  scheduleBoxTime:  { fontSize: 15, fontWeight: '700', color: ORANGE, marginTop: 2, marginBottom: 10 },
  schedulePickerRow: { flexDirection: 'row', gap: 8 },
  schedulePickerBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: WHITE, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: '#FFD4BC',
  },
  schedulePickerText: { fontSize: 12, fontWeight: '600', color: DARK },

  /* ── BILL ── */
  billRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 14, paddingVertical: 8,
  },
  billLabel: { fontSize: 13, color: GRAY, fontWeight: '500' },
  billHint:  { fontSize: 10, color: GREEN, marginTop: 2 },
  billValue: { fontSize: 13, color: DARK, fontWeight: '600' },
  billFree:  { color: GREEN, fontWeight: '700' },
  billTotalBox: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginHorizontal: 14, marginTop: 4, marginBottom: 12,
    paddingTop: 12, borderTopWidth: 1.5, borderTopColor: BORDER,
    borderStyle: 'dashed',
  },
  billTotalLabel: { fontSize: 15, fontWeight: '700', color: DARK },
  billTotalValue: { fontSize: 18, fontWeight: '800', color: ORANGE },
  savingsBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: GREEN_LT, marginHorizontal: 14, marginBottom: 14,
    paddingVertical: 8, borderRadius: 10,
  },
  savingsText: { fontSize: 12, fontWeight: '600', color: GREEN },

  /* ── UPI NOTE ── */
  upiNote: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 14, marginTop: 10, marginBottom: 4,
    backgroundColor: '#EEF2FF', borderRadius: 10, padding: 10,
  },
  upiNoteText: { flex: 1, fontSize: 12, color: '#4F46E5', lineHeight: 17 },

  /* ── FOOTER ── */
  footer: {
    backgroundColor: WHITE,
    paddingHorizontal: 16, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: BORDER,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.07, shadowRadius: 12, elevation: 16,
  },
  footerInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  footerAmount: { fontSize: 22, fontWeight: '800', color: DARK, letterSpacing: -0.5 },
  footerLabel:  { fontSize: 11, color: GRAY, marginTop: 2 },
  payBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: ORANGE, paddingHorizontal: 22, paddingVertical: 14,
    borderRadius: 14,
    shadowColor: ORANGE, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
  },
  payBtnText: { fontSize: 15, fontWeight: '700', color: WHITE, letterSpacing: 0.2 },

  /* ── MODALS ── */
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28,
  },
  modalCard: {
    backgroundColor: WHITE, borderRadius: 24, padding: 28,
    alignItems: 'center', width: '100%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
  },
  modalIconWrap: {
    width: 68, height: 68, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  modalTitle:    { fontSize: 19, fontWeight: '700', color: DARK, marginBottom: 6, textAlign: 'center' },
  modalSubtitle: { fontSize: 13, color: GRAY, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  modalPrimaryBtn: {
    backgroundColor: ORANGE, borderRadius: 12,
    paddingVertical: 14, width: '100%', alignItems: 'center', marginBottom: 10,
  },
  modalPrimaryText:  { color: WHITE, fontSize: 15, fontWeight: '700' },
  modalSecondaryBtn: {
    borderWidth: 1.5, borderColor: BORDER, borderRadius: 12,
    paddingVertical: 13, width: '100%', alignItems: 'center',
  },
  modalSecondaryText: { color: GRAY, fontSize: 14, fontWeight: '600' },

  /* ── LOADING ── */
  loadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center',
  },
  loadingBox: {
    backgroundColor: WHITE, borderRadius: 16, padding: 28,
    alignItems: 'center', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 8,
  },
  loadingText: { fontSize: 14, fontWeight: '600', color: DARK },
});
