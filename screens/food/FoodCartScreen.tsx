import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useFoodCart } from '@/context/FoodCartContext';
import { getMenuByRestaurant, type MenuItem } from '@/firebase/foodFirebase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ORANGE    = '#FF6B35';
const ORANGE_LT = '#FFF3EE';
const DARK      = '#1A1D2E';
const DARK2     = '#2D3142';
const GRAY      = '#8A8FA8';
const GRAY_LT   = '#F8F9FC';
const GREEN     = '#22C55E';
const WHITE     = '#FFFFFF';
const BORDER    = '#E8EBF3';
const FOOTER_H  = 60;

// Auto-scroll timing (ms)
const AUTO_SCROLL_DELAY = 4000; // time between auto-scroll steps
const AUTO_RESUME_DELAY = 2500; // delay before resuming after user interaction
const AUTO_INITIAL_DELAY = 1000; // initial delay before starting auto-scroll


export default function FoodCartScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { cartItems, addItem, removeItem, getItemQty, totalItems, clearCart, restaurantIds } = useFoodCart();

  const currentRestaurantId = restaurantIds[0] ?? null;
  const currentRestaurantItems = useMemo(
    () => currentRestaurantId ? cartItems.filter(i => i.restaurantId === currentRestaurantId) : [],
    [cartItems, currentRestaurantId]
  );
  const currentRestaurantName = useMemo(
    () => currentRestaurantId
      ? cartItems.find(i => i.restaurantId === currentRestaurantId)?.restaurantName ?? currentRestaurantId
      : '',
    [cartItems, currentRestaurantId]
  );

  const [restaurantMenu, setRestaurantMenu] = useState<MenuItem[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(false);

  useEffect(() => {
    if (!currentRestaurantId) {
      setRestaurantMenu([]);
      setLoadingMenu(false);
      return;
    }

    let canceled = false;
    setLoadingMenu(true);

    getMenuByRestaurant(currentRestaurantId)
      .then(items => {
        if (!canceled) setRestaurantMenu(items);
      })
      .catch(() => {
        if (!canceled) setRestaurantMenu([]);
      })
      .finally(() => {
        if (!canceled) setLoadingMenu(false);
      });

    return () => { canceled = true; };
  }, [currentRestaurantId]);

  

  const groupedRestaurantItems = useMemo(() => {
    const map = new Map<string, { item: any; qty: number; ids: string[] }>();
    currentRestaurantItems.forEach(item => {
      const key = `${item.name?.trim().toLowerCase() ?? ''}|${item.variant ?? ''}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { item, qty: item.qty, ids: [item.id] });
      } else {
        existing.qty += item.qty;
        existing.ids.push(item.id);
      }
    });
    return Array.from(map.values());
  }, [currentRestaurantItems]);

  const overallTotal = currentRestaurantItems.reduce((sum, item) => {
    const addonTotal = (item.addons || []).reduce((acc: number, addon: any) => acc + (addon.price ?? 0), 0);
    return sum + item.price * item.qty + addonTotal * item.qty;
  }, 0);

  const arrowAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(arrowAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(arrowAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const arrowTranslateX = arrowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 4] });
  const footerH = FOOTER_H + (insets.bottom > 0 ? insets.bottom : 16);

  // Auto-scroll for restaurant menu carousel with pause/resume
  const menuScrollRef = useRef<ScrollView | null>(null);
  const autoIntervalRef = useRef<number | null>(null);
  const autoTimeoutRef = useRef<number | null>(null);
  const [autoIndex, setAutoIndex] = useState(0);

  const stopAutoScroll = () => {
    if (autoIntervalRef.current) {
      clearInterval(autoIntervalRef.current as any);
      autoIntervalRef.current = null;
    }
    if (autoTimeoutRef.current) {
      clearTimeout(autoTimeoutRef.current as any);
      autoTimeoutRef.current = null;
    }
  };

  const startAutoScroll = (delay = AUTO_SCROLL_DELAY, listLength = 0) => {
    if (autoIntervalRef.current) return;
    if ((listLength || 0) <= 1) return;
    const itemWidth = 162; // suggestionCard width (150) + marginRight (12)
    autoIntervalRef.current = setInterval(() => {
      setAutoIndex(prev => {
        const next = ((prev + 1) % listLength);
        menuScrollRef.current?.scrollTo({ x: next * itemWidth, animated: true });
        return next;
      });
    }, delay) as unknown as number;
  };

  const displayedMenu = useMemo(() => {
    const idsInCart = new Set(currentRestaurantItems.map(i => i.id));
    return restaurantMenu.filter(item => !idsInCart.has(item.id));
  }, [restaurantMenu, currentRestaurantItems]);

  useEffect(() => {
    // restart auto-scroll when displayed menu loads/changes
    stopAutoScroll();
    autoTimeoutRef.current = setTimeout(() => startAutoScroll(undefined, displayedMenu.length), AUTO_INITIAL_DELAY) as unknown as number;
    return () => stopAutoScroll();
  }, [displayedMenu]);

  /* ── EMPTY STATE ── */
  if (cartItems.length === 0) {
    return (
      <View style={s.emptyRoot}>
        <StatusBar barStyle="dark-content" backgroundColor={WHITE} />
        <View style={[s.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconBtn}>
            <Ionicons name="arrow-back" size={22} color={DARK} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>My Cart</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.emptyBody}>
          <View style={s.emptyCircleOuter}><View style={s.emptyCircleInner}>
            <Ionicons name="bag-outline" size={52} color={ORANGE} />
          </View></View>
          <Text style={s.emptyTitle}>Your bag is empty</Text>
          <Text style={s.emptySub}>Add items from restaurants{'\n'}to get started</Text>
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

<View style={[s.header, { paddingTop: insets.top + 8 }]}> 
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={DARK} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Your Cart</Text>
          <Text style={s.headerSub}>{currentRestaurantName} · {totalItems} items</Text>
        </View>
        <TouchableOpacity onPress={clearCart} style={s.iconBtn}>
          <Ionicons name="trash-outline" size={20} color={ORANGE} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: footerH + 20, paddingTop: 8 }}>

        <View style={s.section}>
          <View style={s.sectionHeaderRow}>
            <Text style={s.sectionTitle}>Cart items</Text>
            <Text style={s.sectionCount}>{groupedRestaurantItems.length} items</Text>
          </View>

          <View style={s.card}>
            {groupedRestaurantItems.map(({ item, qty, ids }, idx) => {
              const addonTotal = (item.addons || []).reduce((acc: number, addon: any) => acc + (addon.price ?? 0), 0);
              const lineTotal = (item.price + addonTotal) * qty;
              return (
                <View key={`${item.id}-${idx}`}>
                  {idx > 0 && <View style={s.divider} />}
                  <View style={s.itemRow}>
                    <View style={s.itemImgWrap}>
                      {item.image ? (
                        <Image source={{ uri: item.image }} style={s.itemImg} contentFit="cover" />
                      ) : (
                        <View style={[s.itemImg, s.imgFallback]}>
                          <Ionicons name="fast-food-outline" size={22} color="#CBD5E1" />
                        </View>
                      )}
                    </View>
                    <View style={s.itemDetails}>
                      <Text style={s.itemName} numberOfLines={2}>{item.name}</Text>
                      {!!item.variant && (
                        <View style={s.variantChip}>
                          <Text style={s.variantChipText}>{item.variant}</Text>
                        </View>
                      )}
                      <View style={s.itemBottomRow}>
                        <View>
                          <Text style={s.itemPrice}>₹{lineTotal}</Text>
                          <Text style={s.itemQuantity}>{qty} × ₹{item.price}</Text>
                        </View>
                        <View style={s.stepperWrap}>
                          <TouchableOpacity
                            style={[s.stepBtn, qty === 1 && s.stepBtnDelete]}
                            onPress={() => removeItem(ids[0])}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons
                              name={qty === 1 ? 'trash-outline' : 'remove'}
                              size={13}
                              color={ORANGE}
                            />
                          </TouchableOpacity>
                          <Text style={s.stepQty}>{qty}</Text>
                          <TouchableOpacity
                            style={s.stepBtnAdd}
                            onPress={() => addItem({ ...item })}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="add" size={13} color={WHITE} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </View>
                  {!!item.addons && item.addons.length > 0 && (
                    <View style={s.addonsBox}>
                      <View style={s.addonsTitleRow}>
                        <Ionicons name="add-circle-outline" size={12} color={ORANGE} />
                        <Text style={s.addonsLabel}>Add-ons</Text>
                        <Text style={s.addonsTotalText}>+₹{addonTotal * qty}</Text>
                      </View>
                      {item.addons.map((addon: any, ai: number) => (
                        <View key={ai} style={s.addonItem}>
                          <View style={s.addonDot} />
                          <Text style={s.addonName}>{addon.name}</Text>
                          <Text style={s.addonPrice}>₹{addon.price ?? 0} × {qty}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          <TouchableOpacity style={s.addMoreRow} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <View style={s.addMoreIcon}><Ionicons name="add" size={14} color={ORANGE} /></View>
            <Text style={s.addMoreText}>Add more from {currentRestaurantName}</Text>
          </TouchableOpacity>

          <View style={s.suggestionsSection}>
            <View style={s.sectionHeaderRow}>
              <Text style={s.sectionTitle}>All dishes</Text>
              <Text style={s.sectionCount}>{displayedMenu.length} items</Text>
            </View>
            <Text style={s.trySubtitle}>Explore the full menu from {currentRestaurantName}</Text>

            {loadingMenu ? (
              <View style={[s.suggestionsList, { paddingVertical: 12 }]}> 
                <Text style={s.trySubtitle}>Loading dishes...</Text>
              </View>
            ) : displayedMenu.length > 0 ? (
              <ScrollView
                ref={ref => (menuScrollRef.current = ref)}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.suggestionsList}
                onScrollBeginDrag={() => { stopAutoScroll(); }}
                onScrollEndDrag={() => {
                  if (autoTimeoutRef.current) clearTimeout(autoTimeoutRef.current as any);
                  autoTimeoutRef.current = setTimeout(() => startAutoScroll(undefined, displayedMenu.length), AUTO_RESUME_DELAY) as unknown as number;
                }}
                onMomentumScrollEnd={() => {
                  if (autoTimeoutRef.current) clearTimeout(autoTimeoutRef.current as any);
                  autoTimeoutRef.current = setTimeout(() => startAutoScroll(undefined, displayedMenu.length), AUTO_RESUME_DELAY) as unknown as number;
                }}
              >
                {displayedMenu.map((item, index) => {
                  const price = Number(item.price) || 0;
                  return (
                    <View key={item.id ?? index} style={s.suggestionCard}>
                      {item.image ? (
                        <Image source={{ uri: item.image }} style={s.suggestionImg} contentFit="cover" />
                      ) : (
                        <View style={[s.suggestionImg, s.suggestionImgPlaceholder]}>
                          <Ionicons name="fast-food-outline" size={24} color={GRAY} />
                        </View>
                      )}
                      <View style={s.suggestionInfo}>
                        <View style={s.suggestionTextWrap}>
                          <Text style={s.suggestionName} numberOfLines={2}>{item.name}</Text>
                          <Text style={s.suggestionPrice}>₹{price}</Text>
                        </View>
                        <TouchableOpacity
                          activeOpacity={0.85}
                          style={s.suggestionAddBtn}
                          onPress={() => {
                            addItem({
                              id: item.id,
                              name: item.name,
                              price,
                              image: item.image,
                              restaurantId: item.restaurantId,
                              restaurantName: currentRestaurantName,
                              description: item.description,
                              cookingTimeHours: item.cookingTimeHours,
                              cookingTimeMinutes: item.cookingTimeMinutes,
                              variant: undefined,
                              addons: [],
                            });
                            // only remove locally if the item was actually added to cart
                                setTimeout(() => {
                              if (getItemQty(item.id) > 0) {
                                setRestaurantMenu(prev => prev.filter(m => m.id !== item.id));
                                // pause & resume auto-scroll
                                stopAutoScroll();
                                    if (autoTimeoutRef.current) clearTimeout(autoTimeoutRef.current as any);
                                    autoTimeoutRef.current = setTimeout(() => startAutoScroll(undefined, Math.max(0, displayedMenu.length - 1)), AUTO_RESUME_DELAY) as unknown as number;
                              }
                            }, 60);
                          }}
                        >
                          <Text style={s.suggestionAddTxt}>ADD</Text>
                          <Ionicons name="add" size={12} color={WHITE} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={[s.suggestionsList, { paddingVertical: 12 }]}> 
                <Text style={s.trySubtitle}>No dishes available right now.</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* FOOTER */}
      <View style={[s.footer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 16 }]}>
        <View style={s.footerInner}>
          <View>
            <Text style={s.footerAmount}>₹{overallTotal}</Text>
            <Text style={s.footerLabel}>{currentRestaurantName ? `Checkout ${currentRestaurantName}` : 'Checkout'}</Text>
          </View>
          <TouchableOpacity
            style={s.payBtn}
            activeOpacity={0.88}
            onPress={() => navigation.navigate('FoodCheckout' as never, {
              restaurantId: currentRestaurantId,
              items: currentRestaurantItems,
              totalAmount: overallTotal,
              restaurantName: currentRestaurantName,
            } as never)}
          >
            <Text style={s.payBtnText}>Checkout</Text>
            <Animated.View style={{ transform: [{ translateX: arrowTranslateX }] }}>
              <Ionicons name="arrow-forward-circle" size={20} color={WHITE} />
            </Animated.View>
          </TouchableOpacity>
        </View>
      </View>

      {/*
        <View style={s.slotModalOverlay}><View style={s.slotModalCard}>
          <View style={s.slotHandle} />
          <View style={s.slotModalHeader}>
            <View><Text style={s.slotModalTitle}>Select Time</Text><Text style={s.slotModalSub}>Choose a delivery slot</Text></View>
            <TouchableOpacity style={s.slotCloseBtn} onPress={() => setShowTimeSlotPicker(false)}>
              <Ionicons name="close" size={18} color={DARK} />
            </TouchableOpacity>
          </View>
          {futureTimeSlots.length === 0 ? (
            <View style={s.slotEmpty}><Ionicons name="time-outline" size={40} color={GRAY} /><Text style={s.slotEmptyTxt}>No slots available today.{'\n'}Please select tomorrow.</Text></View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.slotGrid}>
              {futureTimeSlots.map((slot, i) => {
                const isSelected = scheduledDate && scheduledDate.getHours() === slot.date.getHours() && scheduledDate.getMinutes() === slot.date.getMinutes();
                return (
                  <TouchableOpacity key={i} style={[s.slotBtn, isSelected && s.slotBtnActive]} activeOpacity={0.8}
                    onPress={() => { const d = new Date(scheduledDate || new Date()); d.setHours(slot.date.getHours()); d.setMinutes(slot.date.getMinutes()); d.setSeconds(0,0); setScheduledDate(d); setShowTimeSlotPicker(false); }}>
                    <Ionicons name="time-outline" size={15} color={isSelected ? WHITE : ORANGE} />
                    <Text style={[s.slotTxt, isSelected && s.slotTxtActive]}>{slot.label}</Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={15} color={WHITE} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View></View>
      */}

    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: GRAY_LT },
  emptyRoot: { flex: 1, backgroundColor: WHITE },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', backgroundColor: WHITE, paddingHorizontal: 18, paddingBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 4 },
  iconBtn: { width: 40, height: 40, borderRadius: 13, backgroundColor: GRAY_LT, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: DARK, letterSpacing: -0.4 },
  headerSub: { fontSize: 11, color: GRAY, fontWeight: '500', marginTop: 3 },
  emptyBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyCircleOuter: { width: 160, height: 160, borderRadius: 80, backgroundColor: '#FFF8F5', justifyContent: 'center', alignItems: 'center', marginBottom: 36 },
  emptyCircleInner: { width: 110, height: 110, borderRadius: 55, backgroundColor: ORANGE_LT, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontSize: 24, fontWeight: '800', color: DARK, marginBottom: 10 },
  emptySub: { fontSize: 15, color: GRAY, textAlign: 'center', lineHeight: 24 },
  browseBtn: { marginTop: 36, backgroundColor: ORANGE, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', shadowColor: ORANGE, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8 },
  browseBtnTxt: { color: WHITE, fontWeight: '800', fontSize: 16 },
  restaurantHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, marginTop: 12, marginBottom: 6, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: WHITE, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  restaurantHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  restaurantIconWrap: { width: 34, height: 34, borderRadius: 10, backgroundColor: ORANGE_LT, justifyContent: 'center', alignItems: 'center' },
  restaurantName: { fontSize: 14, fontWeight: '800', color: DARK },
  restaurantItemCount: { fontSize: 11, color: GRAY, marginTop: 2 },
  removeRestaurantBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center' },
  restaurantDivider: { height: 8, backgroundColor: GRAY_LT, marginTop: 6 },
  trySection: { marginHorizontal: 16, padding: 16, borderRadius: 18, backgroundColor: WHITE, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3, marginBottom: 10 },
  tryTitle: { fontSize: 16, fontWeight: '800', color: DARK },
  trySubtitle: { fontSize: 13, color: GRAY, marginTop: 4, lineHeight: 20 },
  section: { marginHorizontal: 16, marginTop: 10 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: DARK },
  sectionCount: { fontSize: 12, color: GRAY, fontWeight: '700' },
  suggestionsSection: { marginTop: 18, borderRadius: 18, backgroundColor: WHITE, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 5 },
  itemQuantity: { fontSize: 12, color: GRAY, marginTop: 2 },
  suggestionCard: { width: 150, backgroundColor: WHITE, borderRadius: 18, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3, marginRight: 12, minHeight: 240, justifyContent: 'space-between' },
  suggestionImg: { width: '100%', height: 110, backgroundColor: GRAY_LT },
  suggestionImgPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  suggestionInfo: { padding: 12, flex: 1, justifyContent: 'space-between' },
  suggestionTextWrap: { gap: 8 },
  suggestionName: { fontSize: 13, fontWeight: '700', color: DARK, lineHeight: 18, marginBottom: 4 },
  suggestionPrice: { fontSize: 14, fontWeight: '800', color: ORANGE, marginBottom: 0 },
  suggestionAddBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: ORANGE, paddingVertical: 10, borderRadius: 12, marginTop: 12 },
  suggestionAddTxt: { fontSize: 12, fontWeight: '800', color: WHITE },
  suggestionsList: { paddingVertical: 8, paddingHorizontal: 4 },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  sectionDot: { width: 5, height: 16, borderRadius: 2.5, backgroundColor: ORANGE },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: GRAY, letterSpacing: 1.4 },
  card: { backgroundColor: WHITE, borderRadius: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4, overflow: 'hidden' },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  itemImgWrap: { position: 'relative' },
  itemImg: { width: 64, height: 64, borderRadius: 12 },
  imgFallback: { backgroundColor: GRAY_LT, justifyContent: 'center', alignItems: 'center' },
  vegBadge: { position: 'absolute', bottom: -5, left: -5, width: 16, height: 16, borderRadius: 4, backgroundColor: WHITE, borderWidth: 2, borderColor: GREEN, justifyContent: 'center', alignItems: 'center' },
  vegDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN },
  itemDetails: { flex: 1, paddingTop: 2 },
  itemName: { fontSize: 15, fontWeight: '700', color: DARK, lineHeight: 21 },
  variantChip: { alignSelf: 'flex-start', marginTop: 5, backgroundColor: GRAY_LT, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, borderWidth: 1, borderColor: BORDER },
  variantChipText: { fontSize: 10, fontWeight: '700', color: GRAY },
  itemPrice: { fontSize: 15, fontWeight: '800', color: DARK, marginTop: 7 },
  itemBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  stepperWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: WHITE, borderRadius: 10, borderWidth: 1.5, borderColor: BORDER, overflow: 'hidden' },
  stepBtn: { width: 30, height: 30, justifyContent: 'center', alignItems: 'center', backgroundColor: ORANGE_LT },
  stepBtnDelete: { backgroundColor: '#FEF2F2' },
  stepBtnAdd: { width: 30, height: 30, justifyContent: 'center', alignItems: 'center', backgroundColor: ORANGE },
  stepQty: { fontSize: 14, fontWeight: '800', color: DARK, minWidth: 28, textAlign: 'center' },
  stepMinus: { width: 32, height: 32, borderRadius: 10, borderWidth: 2, borderColor: ORANGE, justifyContent: 'center', alignItems: 'center', backgroundColor: WHITE },
  stepPlus: { width: 32, height: 32, borderRadius: 10, backgroundColor: ORANGE, justifyContent: 'center', alignItems: 'center' },
  divider: { height: 1, backgroundColor: BORDER, marginHorizontal: 16 },
  addonsBox: { marginHorizontal: 14, marginBottom: 10, backgroundColor: '#FAFBFF', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: BORDER },
  addonsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  addonsLabel: { flex: 1, fontSize: 11, fontWeight: '800', color: ORANGE, letterSpacing: 0.6 },
  addonsTotalText: { fontSize: 12, fontWeight: '800', color: ORANGE },
  addonItem: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 5 },
  addonDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: ORANGE },
  addonName: { flex: 1, fontSize: 13, color: DARK2, fontWeight: '500' },
  addonPrice: { fontSize: 12, color: GRAY, fontWeight: '600' },
  addMoreRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: BORDER, backgroundColor: '#FAFBFF' },
  addMoreIcon: { width: 24, height: 24, borderRadius: 7, backgroundColor: ORANGE_LT, justifyContent: 'center', alignItems: 'center' },
  addMoreText: { fontSize: 13, fontWeight: '700', color: ORANGE },
  billRestaurantHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: BORDER },
  billRestaurantTitle: { fontSize: 13, fontWeight: '700', color: DARK },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 14, paddingVertical: 7 },
  billLabel: { fontSize: 14, color: GRAY, fontWeight: '600' },
  billHint: { fontSize: 10, color: GREEN, marginTop: 3, fontWeight: '600' },
  billValue: { fontSize: 14, color: DARK, fontWeight: '700' },
  billFree: { color: GREEN, fontWeight: '800' },
  billStrike: { fontSize: 11, color: GRAY, textDecorationLine: 'line-through' },
  nightSurgeRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 4, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFF8E7', borderRadius: 10, borderWidth: 1, borderColor: '#FFE4A0', gap: 8 },
  nightSurgeIcon: { fontSize: 16 },
  nightSurgeLabel: { flex: 1, fontSize: 13, fontWeight: '700', color: '#92400E' },
  nightSurgeValue: { fontSize: 14, fontWeight: '800', color: '#92400E' },
  billTotalBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 14, marginTop: 4, marginBottom: 10, paddingTop: 10, borderTopWidth: 2, borderTopColor: BORDER, borderStyle: 'dashed' },
  billTotalLabel: { fontSize: 15, fontWeight: '800', color: DARK },
  billTotalValue: { fontSize: 18, fontWeight: '900', color: ORANGE },
  orderSingleBtn: { marginHorizontal: 14, marginBottom: 10, backgroundColor: ORANGE_LT, borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1.5, borderColor: '#FFD4BC' },
  orderSingleBtnTxt: { fontSize: 13, fontWeight: '700', color: ORANGE },
  overallTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  overallTotalLabel: { fontSize: 15, fontWeight: '800', color: DARK },
  overallTotalSub: { fontSize: 12, color: GRAY, marginTop: 3 },
  overallTotalValue: { fontSize: 22, fontWeight: '900', color: ORANGE },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16 },
  addressIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: ORANGE_LT, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  addressText: { flex: 1, fontSize: 14, color: DARK2, lineHeight: 22, fontWeight: '500' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: ORANGE_LT, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: '#FFD4BC' },
  editBtnText: { fontSize: 12, fontWeight: '700', color: ORANGE },
  addAddressBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  addAddressIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: ORANGE_LT, justifyContent: 'center', alignItems: 'center' },
  addAddressText: { flex: 1, fontSize: 14, fontWeight: '700', color: DARK2 },
  deliveryOptions: { flexDirection: 'row' },
  deliveryOption: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  deliveryOptionActive: { backgroundColor: '#FFFAF7' },
  deliveryOptionDivider: { width: 1, backgroundColor: BORDER, marginVertical: 12 },
  deliveryOptionIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: GRAY_LT, justifyContent: 'center', alignItems: 'center' },
  deliveryOptionTitle: { fontSize: 14, fontWeight: '800', color: DARK },
  deliveryOptionSub: { fontSize: 12, color: GRAY, marginTop: 2 },
  radioActive: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: ORANGE, justifyContent: 'center', alignItems: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: ORANGE },
  radioInactive: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#D1D5DB' },
  scheduleBox: { margin: 14, marginTop: 0, backgroundColor: ORANGE_LT, borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#FFD4BC' },
  scheduleBoxLabel: { fontSize: 11, fontWeight: '700', color: GRAY, letterSpacing: 0.6 },
  scheduleBoxTime: { fontSize: 16, fontWeight: '800', color: ORANGE, marginTop: 3, marginBottom: 12 },
  schedulePickerRow: { flexDirection: 'row', gap: 10 },
  schedulePickerBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: WHITE, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#FFD4BC' },
  schedulePickerText: { fontSize: 13, fontWeight: '700', color: DARK },
  upiNote: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 12, marginBottom: 6, backgroundColor: '#EEF2FF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#DDD6FE' },
  upiNoteText: { flex: 1, fontSize: 13, color: '#4F46E5', lineHeight: 19, fontWeight: '600' },
  footer: { backgroundColor: WHITE, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: BORDER, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 8 },
  footerInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerAmount: { fontSize: 18, fontWeight: '800', color: DARK, letterSpacing: -0.4 },
  footerLabel: { fontSize: 11, color: GRAY, marginTop: 2, fontWeight: '600' },
  payBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: ORANGE, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, minWidth: 110, justifyContent: 'center', shadowColor: ORANGE, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 10, elevation: 6 },
  payBtnText: { fontSize: 14, fontWeight: '800', color: WHITE, letterSpacing: 0.2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 },
  modalCard: { backgroundColor: WHITE, borderRadius: 26, padding: 30, alignItems: 'center', width: '100%', position: 'relative' },
  modalCloseBtn: { position: 'absolute', top: 18, right: 18, width: 34, height: 34, borderRadius: 17, backgroundColor: GRAY_LT, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  modalIconWrap: { width: 72, height: 72, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: DARK, marginBottom: 8, textAlign: 'center' },
  modalSubtitle: { fontSize: 14, color: GRAY, textAlign: 'center', lineHeight: 22, marginBottom: 26 },
  modalPrimaryBtn: { backgroundColor: ORANGE, borderRadius: 14, paddingVertical: 16, width: '100%', alignItems: 'center', marginBottom: 12 },
  modalPrimaryText: { color: WHITE, fontSize: 16, fontWeight: '800' },
  modalSecondaryBtn: { borderWidth: 2, borderColor: BORDER, borderRadius: 14, paddingVertical: 15, width: '100%', alignItems: 'center' },
  modalSecondaryText: { color: GRAY, fontSize: 15, fontWeight: '700' },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  loadingBox: { backgroundColor: WHITE, borderRadius: 18, padding: 32, alignItems: 'center', gap: 14 },
  loadingText: { fontSize: 15, fontWeight: '700', color: DARK },
  slotModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  slotModalCard: { backgroundColor: WHITE, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingBottom: 36, paddingTop: 12, maxHeight: '65%' },
  slotHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0', alignSelf: 'center', marginBottom: 16 },
  slotModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: BORDER },
  slotModalTitle: { fontSize: 18, fontWeight: '800', color: DARK },
  slotModalSub: { fontSize: 12, color: GRAY, marginTop: 3 },
  slotCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: GRAY_LT, justifyContent: 'center', alignItems: 'center' },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 8 },
  slotBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: '#FFD4BC', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: ORANGE_LT, minWidth: '44%', flex: 1 },
  slotBtnActive: { backgroundColor: ORANGE, borderColor: ORANGE },
  slotTxt: { flex: 1, fontSize: 13, fontWeight: '600', color: DARK },
  slotTxtActive: { color: WHITE, fontWeight: '700' },
  slotEmpty: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  slotEmptyTxt: { fontSize: 14, color: GRAY, textAlign: 'center', lineHeight: 22 },
});
