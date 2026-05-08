import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  FlatList, StatusBar, Modal, Dimensions, Animated, Image as RNImage,
  TextInput, ActivityIndicator, Platform, RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { useLocationContext } from "@/context/LocationContext";
import { useToggleContext } from "@/context/ToggleContext";
import ModeToggle from "@/components/ModeToggle";
import { navigationRef } from "@/navigation/rootNavigation";
import {
  getFoodBanners,
  listenActiveRestaurants,
  listenFoodCategoriesWithItems,
  type Restaurant,
  type FoodCategory as Category,
  type FoodBanner,
} from "@/firebase/foodFirebase";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";

const { width: SW } = Dimensions.get("window");

const ORANGE = "#FC8019";
const DARK   = "#1C1C2E";
const GRAY   = "#8A8A9A";
const GREEN  = "#2ECC71";

const profileLogoMap: Record<string, any> = {
  grocery: require("../../assets/profile_logo/grocery_logo.png"),
  food:    require("../../assets/profile_logo/food_logo.png"),
  service: require("../../assets/profile_logo/services_logo.png"),
};

type FilterChip = { id: string; label: string; emoji: string };
const FILTER_CHIPS: FilterChip[] = [
  { id: "rating4",  label: "Top Rated",   emoji: "⭐" },
  { id: "under30",  label: "Fast Delivery", emoji: "⚡" },
  { id: "trending", label: "Trending",    emoji: "🔥" },
  { id: "budget",   label: "Budget",      emoji: "💰" },
  { id: "new",      label: "New",         emoji: "✨" },
];

const FOOD_IMAGES = [
  require("../../assets/food/burger.png"),
  require("../../assets/food/food.png"),
  require("../../assets/food/french-fries.png"),
  require("../../assets/food/juice-drink.png"),
  require("../../assets/food/pizza.png"),
];

function PulseLoader() {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Animated.View style={{ transform: [{ scale: pulse }], marginTop: 20 }}>
      <View style={pl.dots}>
        {[0, 1, 2].map(i => <View key={i} style={pl.dot} />)}
      </View>
    </Animated.View>
  );
}
const pl = StyleSheet.create({
  dots: { flexDirection: "row", gap: 8 },
  dot:  { width: 10, height: 10, borderRadius: 5, backgroundColor: ORANGE },
});

// ── Enhanced Veg Toggle Switch with Symbols ──────────────────────────────────────────
function VegSwitch({ filter, onToggle }: { filter: 'all' | 'veg' | 'nonveg'; onToggle: () => void }) {
  const isVeg    = filter === 'veg';
  const isNonVeg = filter === 'nonveg';
  const isAll    = filter === 'all';

  const accentColor = isVeg ? GREEN : isNonVeg ? "#cc2200" : ORANGE;
  const label       = isVeg ? "VEG" : isNonVeg ? "NON VEG" : "ALL";

  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.85}
      style={{
        width: 52,
        height: 52,
        borderRadius: 14,
        backgroundColor: "#fff",
        borderWidth: 2.5,
        borderColor: accentColor,
        shadowColor: accentColor,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
        justifyContent: "center",
        alignItems: "center",
        gap: 3,
      }}
    >
      {isAll ? (
        <Ionicons name="fast-food" size={18} color={ORANGE} />
      ) : isVeg ? (
        <View style={{
          width: 20, height: 20,
          borderWidth: 2.5, borderColor: GREEN,
          borderRadius: 3, backgroundColor: "#fff",
          justifyContent: "center", alignItems: "center",
        }}>
          <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: GREEN }} />
        </View>
      ) : (
        <View style={{
          width: 20, height: 20,
          borderWidth: 2.5, borderColor: "#cc2200",
          borderRadius: 3, backgroundColor: "#fff",
          justifyContent: "center", alignItems: "center",
        }}>
          <View style={{
            width: 0, height: 0,
            borderLeftWidth: 4, borderRightWidth: 4, borderBottomWidth: 7,
            borderLeftColor: "transparent", borderRightColor: "transparent",
            borderBottomColor: "#cc2200",
            transform: [{ rotate: "180deg" }],
          }} />
        </View>
      )}
      <Text style={{ fontSize: 7, fontWeight: "800", color: accentColor, letterSpacing: 0.3 }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function FoodScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { location } = useLocationContext();
  const { activeMode, setActiveMode, switchedToFood, clearSwitchedToFood } = useToggleContext();

  const [restaurants,          setRestaurants]          = useState<Restaurant[]>([]);
  const [categories,           setCategories]           = useState<Category[]>([]);
  const [banners,              setBanners]              = useState<FoodBanner[]>([]);
  const [currentBannerIndex,   setCurrentBannerIndex]   = useState(0);
  const [showSearchModal,      setShowSearchModal]      = useState(false);
  const [modalImageIndex,      setModalImageIndex]      = useState(0);
  const [selectedFilter,       setSelectedFilter]       = useState<string | null>(null);
  const [selectedCategoryId,   setSelectedCategoryId]   = useState<string | null>(null);
  const [categoryRestaurantIds,setCategoryRestaurantIds]= useState<string[]>([]);
  const [vegFilter,            setVegFilter]            = useState<'all' | 'veg' | 'nonveg'>('all'); // 'all' = all restaurants, 'veg' = pure veg only, 'nonveg' = non-veg only
  const [showVegModal,         setShowVegModal]         = useState(false);
  const [pendingVegFilter,     setPendingVegFilter]     = useState<'all' | 'veg' | 'nonveg'>('all');
  // restaurantIds that have at least one veg item / non-veg item
  const [vegRestaurantIds,     setVegRestaurantIds]     = useState<Set<string>>(new Set());
  const [nonVegRestaurantIds,  setNonVegRestaurantIds]  = useState<Set<string>>(new Set());
  const [rejectionModal, setRejectionModal] = useState<{ visible: boolean; restaurantName: string }>({ visible: false, restaurantName: "" });
  // Track which companies have menu_phases role
  const [menuPhasesCompanyIds, setMenuPhasesCompanyIds] = useState<Set<string>>(new Set());

  // Helper: parse "HH:MM AM/PM" or "HH:MM" string to a comparable Date (today)
  const parseTimeString = (t: string): Date | null => {
    if (!t) return null;
    const clean = t.trim().toUpperCase();
    const match = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
    if (!match) return null;
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const meridiem = match[3];
    if (meridiem === "PM" && hours !== 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;
    const d = new Date();
    d.setHours(hours, minutes, 0, 0);
    return d;
  };

  // Helper: is restaurant currently open based on openingTime / closingTime strings
  const isRestaurantOpen = (opening?: string, closing?: string): boolean => {
    if (!opening || !closing) return true; // no timing set → assume open
    const now = new Date();
    const open = parseTimeString(opening);
    const close = parseTimeString(closing);
    if (!open || !close) return true;
    // Handle overnight (e.g. 10 PM – 2 AM)
    if (close < open) return now >= open || now <= close;
    return now >= open && now <= close;
  };

  const scrollRef  = useRef<any>(null);
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const rejScaleAnim = useRef(new Animated.Value(0.85)).current;
  const rejOpacAnim  = useRef(new Animated.Value(0)).current;

  // Hero height — fixed, no animation (avoids flicker with stickyHeaderIndices)
  const HERO_FULL = Math.round(SW * 567 / 720);
  const HERO_MIN  = 80;
  const playBounce = () => {
    bounceAnim.setValue(0); fadeAnim.setValue(0);
    Animated.parallel([
      Animated.timing(fadeAnim,   { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(bounceAnim, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
    ]).start();
  };

  useEffect(() => {
    if (!showSearchModal && !showVegModal) return;
    playBounce();
    if (showSearchModal) {
      const t = setInterval(() => setModalImageIndex(p => (p + 1) % FOOD_IMAGES.length), 1500);
      return () => clearInterval(t);
    }
  }, [showSearchModal, showVegModal]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (showSearchModal) playBounce(); }, [modalImageIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const user = auth().currentUser;
    if (!user) return;
    const unsub = firestore().collection("restaurant_Orders").where("userId", "==", user.uid)
      .onSnapshot(snap => {
        if (!snap) return;
        snap.docChanges().forEach(change => {
          const data = change.doc.data();
          if (change.type === "modified" && (data?.status ?? "").toLowerCase().trim() === "rejected") {
            const name = data?.restaurantName ?? "the restaurant";
            rejScaleAnim.setValue(0.85); rejOpacAnim.setValue(0);
            setRejectionModal({ visible: true, restaurantName: name });
            Animated.parallel([
              Animated.spring(rejScaleAnim, { toValue: 1, friction: 5, tension: 70, useNativeDriver: true }),
              Animated.timing(rejOpacAnim,  { toValue: 1, duration: 220, useNativeDriver: true }),
            ]).start();
          }
        });
      }, err => console.error(err));
    return () => unsub();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (switchedToFood) {
      setShowSearchModal(true);
      setTimeout(() => { setShowSearchModal(false); clearSwitchedToFood(); }, 4000);
    }
  }, [switchedToFood]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const u1 = listenActiveRestaurants(d => setRestaurants(d), e => console.error(e));
    const u2 = listenFoodCategoriesWithItems(d => setCategories(d), e => console.error(e));
    getFoodBanners().then(setBanners).catch(console.error);

    // Track which restaurants have veg / non-veg items in their menu
    const u3 = firestore()
      .collection('restaurant_menu')
      .where('available', '==', true)
      .onSnapshot(snap => {
        const vegIds = new Set<string>();
        const nonVegIds = new Set<string>();
        snap.docs.forEach(d => {
          const data = d.data();
          const ft = (data.foodType || '').toLowerCase().trim();
          const rid = data.restaurantId;
          if (!rid) return;
          if (ft === 'veg') {
            vegIds.add(rid);
          } else if (ft === 'nonveg' || ft === 'non-veg') {
            nonVegIds.add(rid);
          } else {
            // foodType not set — include in both
            vegIds.add(rid);
            nonVegIds.add(rid);
          }
        });
        
        // Also check restaurant's cuisineType field as fallback
        restaurants.forEach(r => {
          const cuisineType = ((r as any).cuisineType || '').toLowerCase().trim();
          if (cuisineType === 'veg') {
            vegIds.add(r.id);
          } else if (cuisineType === 'nonveg' || cuisineType === 'non-veg') {
            nonVegIds.add(r.id);
          }
        });
        
        console.log('Veg Restaurant IDs:', Array.from(vegIds));
        console.log('Non-Veg Restaurant IDs:', Array.from(nonVegIds));
        setVegRestaurantIds(vegIds);
        setNonVegRestaurantIds(nonVegIds);
      }, e => console.error(e));

    // Track which companies have menu_phases role
    const u4 = firestore()
      .collection('registerRestaurant')
      .where('role', '==', 'menu_phases')
      .onSnapshot(snap => {
        const phaseIds = new Set<string>();
        snap.docs.forEach(d => phaseIds.add(d.id));
        setMenuPhasesCompanyIds(phaseIds);
      }, e => console.error(e));

    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => setCurrentBannerIndex(p => (p === banners.length - 1 ? 0 : p + 1)), 3000);
    return () => clearInterval(t);
  }, [banners.length]);

  // Auto-switch to available mode if current mode becomes unavailable
  useEffect(() => {
    const isGroceryAvailable = location?.grocery !== false;
    const isServicesAvailable = location?.services !== false;
    const isFoodAvailable = location?.food !== false;

    // If current mode is not available, switch to an available one
    if (activeMode === 'grocery' && !isGroceryAvailable) {
      if (isServicesAvailable) {
        setActiveMode('service');
      } else if (isFoodAvailable) {
        setActiveMode('food');
      }
    } else if (activeMode === 'service' && !isServicesAvailable) {
      if (isGroceryAvailable) {
        setActiveMode('grocery');
      } else if (isFoodAvailable) {
        setActiveMode('food');
      }
    } else if (activeMode === 'food' && !isFoodAvailable) {
      if (isGroceryAvailable) {
        setActiveMode('grocery');
      } else if (isServicesAvailable) {
        setActiveMode('service');
      }
    }
  }, [location?.grocery, location?.services, location?.food, activeMode, setActiveMode]);

  const handleVegToggle = () => { 
    setPendingVegFilter(vegFilter); // Start with current filter
    setShowVegModal(true); 
  };
  const confirmVeg = () => { 
    setVegFilter(pendingVegFilter); 
    setShowVegModal(false); 
  };
  const cancelVeg  = () => { 
    setShowVegModal(false); 
    setPendingVegFilter(vegFilter); // Reset to current
  };
  const openDish = (
    id: string, 
    name: string, 
    catId?: string | null, 
    rushHour?: boolean, 
    rushTime?: string,
    coverImage?: string,
    profileImage?: string,
    restaurantImage?: string,
    description?: string
  ) =>
    navigation.navigate("RestaurantDetail", {
      restaurantId: id,
      restaurantName: name,
      coverImage,
      profileImage,
      restaurantImage,
      description,
    });

  const filtered = React.useMemo(() => {
    let list = [...restaurants];

    // Exclude restaurants with role "menu_phases"
    list = list.filter(r => (r as any).role !== "menu_phases");

    // Veg filter logic:
    // 'all' = show all restaurants (both veg and non-veg)
    // 'veg' = show only restaurants that have at least one veg item
    // 'nonveg' = show only restaurants that have at least one non-veg item
    if (vegFilter === 'veg') {
      list = list.filter(r => vegRestaurantIds.has(r.id));
      console.log('Veg Filter Applied - Showing restaurants:', list.length);
    } else if (vegFilter === 'nonveg') {
      list = list.filter(r => nonVegRestaurantIds.has(r.id));
      console.log('Non-Veg Filter Applied - Showing restaurants:', list.length);
    } else {
      console.log('All Filter - Showing all restaurants:', list.length);
    }
    // If vegFilter === 'all', don't filter by veg/non-veg at all

    // Category filter
    if (selectedCategoryId && categoryRestaurantIds.length > 0) list = list.filter(r => categoryRestaurantIds.includes(r.id));
    else if (selectedCategoryId && categoryRestaurantIds.length === 0) list = [];

    // Filter chips — only exclude if field exists AND doesn't match
    switch (selectedFilter) {
      case "rating4":
        list = list.filter(r => r.rating === undefined || r.rating === null || r.rating >= 4.0);
        break;
      case "under30":
        list = list.filter(r => r.deliveryTime === undefined || r.deliveryTime === null || r.deliveryTime < 30);
        break;
      case "trending":
        list = list.filter(r => r.isTrending === true);
        break;
      case "budget":
        list = list.filter(r => r.avgPrice === undefined || r.avgPrice === null || r.avgPrice < 150);
        break;
      case "new":
        list = [...list].sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
        break;
    }

    return list;
  }, [restaurants, selectedFilter, selectedCategoryId, categoryRestaurantIds, vegFilter, vegRestaurantIds]);

  return (
    <View style={s.root}>
      {/* foodScreenbg.png — full screen background, always visible */}
      <Image
        source={require("../../assets/foodScreenbg.png")}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
      />
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* ── Loading Modal ── */}
      <Modal visible={showSearchModal} transparent animationType="fade" statusBarTranslucent>
        <View style={s.modalBg}>
          <View style={s.loadCard}>
            <Animated.View style={{
              opacity: fadeAnim,
              transform: [{ scale: bounceAnim.interpolate({ inputRange: [0,0.6,0.8,1], outputRange: [0.3,1.15,0.95,1] }) }],
            }}>
              <Image source={FOOD_IMAGES[modalImageIndex]} style={s.loadImg} contentFit="cover" />
            </Animated.View>
            <Text style={s.loadTitle}>Finding Restaurants</Text>
            <Text style={s.loadSub}>Hang tight, we&apos;re on it...</Text>
            <PulseLoader />
          </View>
        </View>
      </Modal>

      {/* ── Veg Toggle Modal ── */}
      <Modal visible={showVegModal} transparent animationType="fade" statusBarTranslucent>
        <View style={s.modalBg}>
          <Animated.View style={[s.vegCard, {
            opacity: fadeAnim,
            transform: [
              { scale: bounceAnim.interpolate({ inputRange: [0,1], outputRange: [0.88,1] }) },
              { translateY: bounceAnim.interpolate({ inputRange: [0,1], outputRange: [40,0] }) },
            ]
          }]}>

            {/* ── Colored header band — compact ── */}
            <View style={[s.vegBand, {
              backgroundColor:
                pendingVegFilter === 'veg'    ? GREEN :
                pendingVegFilter === 'nonveg' ? "#cc2200" : ORANGE,
            }]}>
              <TouchableOpacity style={s.vegCloseBtn} onPress={cancelVeg} activeOpacity={0.7}>
                <Ionicons name="close" size={18} color="rgba(255,255,255,0.9)" />
              </TouchableOpacity>
              <Text style={s.vegBandTitle}>Food Preference</Text>
              <Text style={s.vegBandSub}>What would you like to see?</Text>
            </View>

            {/* ── Options ── */}
            <View style={s.vegOptionsWrap}>

              {/* ALL */}
              <TouchableOpacity
                style={[s.vegOption, pendingVegFilter === 'all' && { borderColor: ORANGE, backgroundColor: "#FFF8F0" }]}
                activeOpacity={0.75}
                onPress={() => setPendingVegFilter('all')}
              >
                <View style={[s.vegOptionIcon2, { backgroundColor: "#FFF3E0", borderColor: ORANGE }]}>
                  <Ionicons name="fast-food" size={20} color={ORANGE} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.vegOptionText, pendingVegFilter === 'all' && { color: ORANGE }]}>All Restaurants</Text>
                  <Text style={s.vegOptionDesc}>Veg & non-veg, everything</Text>
                </View>
                <View style={[s.radioOuter, pendingVegFilter === 'all' && { borderColor: ORANGE }]}>
                  {pendingVegFilter === 'all' && <View style={[s.radioInner, { backgroundColor: ORANGE }]} />}
                </View>
              </TouchableOpacity>

              {/* VEG */}
              <TouchableOpacity
                style={[s.vegOption, pendingVegFilter === 'veg' && { borderColor: GREEN, backgroundColor: "#F0FDF4" }]}
                activeOpacity={0.75}
                onPress={() => setPendingVegFilter('veg')}
              >
                <View style={[s.vegOptionIcon2, { backgroundColor: "#DCFCE7", borderColor: GREEN }]}>
                  <View style={{ width: 22, height: 22, borderWidth: 2.5, borderColor: GREEN, borderRadius: 3, backgroundColor: "#fff", justifyContent: "center", alignItems: "center" }}>
                    <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: GREEN }} />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.vegOptionText, pendingVegFilter === 'veg' && { color: GREEN }]}>Pure Veg Only</Text>
                  <Text style={s.vegOptionDesc}>Only vegetarian restaurants</Text>
                </View>
                <View style={[s.radioOuter, pendingVegFilter === 'veg' && { borderColor: GREEN }]}>
                  {pendingVegFilter === 'veg' && <View style={[s.radioInner, { backgroundColor: GREEN }]} />}
                </View>
              </TouchableOpacity>

              {/* NON-VEG */}
              <TouchableOpacity
                style={[s.vegOption, pendingVegFilter === 'nonveg' && { borderColor: "#cc2200", backgroundColor: "#FFF5F5" }]}
                activeOpacity={0.75}
                onPress={() => setPendingVegFilter('nonveg')}
              >
                <View style={[s.vegOptionIcon2, { backgroundColor: "#FFE4E4", borderColor: "#cc2200" }]}>
                  <View style={{ width: 22, height: 22, borderWidth: 2.5, borderColor: "#cc2200", borderRadius: 3, backgroundColor: "#fff", justifyContent: "center", alignItems: "center" }}>
                    <View style={{ width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderBottomWidth: 9, borderLeftColor: "transparent", borderRightColor: "transparent", borderBottomColor: "#cc2200", transform: [{ rotate: "180deg" }] }} />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.vegOptionText, pendingVegFilter === 'nonveg' && { color: "#cc2200" }]}>Non-Veg Only</Text>
                  <Text style={s.vegOptionDesc}>Only non-vegetarian restaurants</Text>
                </View>
                <View style={[s.radioOuter, pendingVegFilter === 'nonveg' && { borderColor: "#cc2200" }]}>
                  {pendingVegFilter === 'nonveg' && <View style={[s.radioInner, { backgroundColor: "#cc2200" }]} />}
                </View>
              </TouchableOpacity>

            </View>

            {/* ── Buttons ── */}
            <View style={s.vegButtonsRow}>
              <TouchableOpacity style={s.vegCancelBtn} onPress={cancelVeg} activeOpacity={0.85}>
                <Text style={s.vegCancelBtnTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.vegApplyBtn, {
                  backgroundColor:
                    pendingVegFilter === 'veg'    ? GREEN :
                    pendingVegFilter === 'nonveg' ? "#cc2200" : ORANGE,
                  shadowColor:
                    pendingVegFilter === 'veg'    ? GREEN :
                    pendingVegFilter === 'nonveg' ? "#cc2200" : ORANGE,
                }]}
                onPress={confirmVeg}
                activeOpacity={0.85}
              >
                <Text style={s.vegApplyBtnTxt}>Show Restaurants</Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </TouchableOpacity>
            </View>

          </Animated.View>
        </View>
      </Modal>

      {/* ── Rejection Modal ── */}
      <Modal visible={rejectionModal.visible} transparent animationType="none" statusBarTranslucent>
        <View style={s.modalBg}>
          <Animated.View style={[s.rejCard, { opacity: rejOpacAnim, transform: [{ scale: rejScaleAnim }] }]}>
            <View style={s.rejIconWrap}>
              <Ionicons name="close-circle" size={56} color="#ef4444" />
            </View>
            <Text style={s.rejTitle}>Order Rejected</Text>
            <Text style={s.rejSub}>Your order was rejected by</Text>
            <Text style={s.rejName}>{rejectionModal.restaurantName}</Text>
            <Text style={s.rejHint}>Try ordering from another restaurant nearby.</Text>
            <TouchableOpacity style={s.rejBtn} activeOpacity={0.85} onPress={() => {
              setRejectionModal({ visible: false, restaurantName: "" });
              navigation.reset({ index: 0, routes: [{ name: "AppTabs" }] });
            }}>
              <Text style={s.rejBtnTxt}>Got it</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      {/* ── Main Content ── */}
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        bounces={false}
        scrollEventThrottle={16}
        stickyHeaderIndices={[1]}
      >
        {/* index 0 — Hero (scrolls away) */}
        <View>
          <View style={[s.hero, { height: HERO_FULL }]}>
            <Image
              source={
                vegFilter === 'nonveg'
                  ? require("../../assets/ninjafoodNonVeg.png")
                  : require("../../assets/ninjafoodVeg.png")
              }
              style={StyleSheet.absoluteFillObject}
              contentFit="fill"
            />
            <View style={s.heroDim} />
          </View>

          {/* Header UI overlaid on hero */}
          <View style={[s.headerUI, { top: insets.top + 12 }]}>
            <View style={s.heroTopRow}>
              <TouchableOpacity style={s.locationPill} activeOpacity={0.8}
                onPress={() => navigation.navigate("LocationSelector", { fromScreen: "Food" })}>
                <Ionicons name="location-sharp" size={15} color={ORANGE} />
                <Text style={s.locationTxt} numberOfLines={1}>
                  {location?.address || "Set delivery location"}
                </Text>
                <Ionicons name="chevron-down" size={13} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => navigation.navigate("Profile")} 
                style={s.avatarBtn} 
                activeOpacity={0.8}
              >
                <RNImage source={profileLogoMap[activeMode]} style={s.avatar} resizeMode="cover" />
              </TouchableOpacity>
            </View>
            <View style={s.searchWrap}>
              <TouchableOpacity style={s.searchBar} activeOpacity={0.85}
                onPress={() => navigation.navigate("FoodSearch")}>
                <Ionicons name="search-outline" size={17} color={GRAY} />
                <Text style={s.searchTxt}>Search restaurants, cuisines...</Text>
              </TouchableOpacity>
              <VegSwitch filter={vegFilter} onToggle={handleVegToggle} />
            </View>
            <View style={s.modeToggleWrap}>
              <ModeToggle compact activeMode={activeMode} onPress={setActiveMode} />
            </View>
          </View>
        </View>

        {/* index 1 — Sticky Categories */}
        <View style={[s.catSection, { paddingTop: insets.top - 4 }]} pointerEvents="box-none">
          {categories.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.catList}
              nestedScrollEnabled={true}
              scrollEnabled={true}
              bounces={false}
            >
              {[{ id: "all", name: "All", image: null }, ...categories.filter(cat => {
                // Only filter out categories where ALL companyIds have role "menu_phases"
                const companyIds = cat.companyIds || [];
                if (companyIds.length === 0) return true; // Show if no companies assigned
                // Show category if at least one company is NOT menu_phases
                return !companyIds.every(companyId => menuPhasesCompanyIds.has(companyId));
              })].map((item) => {
                const active = item.id === "all" ? selectedCategoryId === null : selectedCategoryId === item.id;
                return (
                  <TouchableOpacity key={item.id} style={s.catItem} activeOpacity={0.75} onPress={async () => {
                    if (item.id === "all") { setSelectedCategoryId(null); setCategoryRestaurantIds([]); return; }
                    const newId = selectedCategoryId === item.id ? null : item.id;
                    setSelectedCategoryId(newId); setCategoryRestaurantIds([]);
                    if (newId) {
                      try {
                        const snap = await firestore().collection("restaurant_menu")
                          .where("categoryId", "==", newId).where("available", "==", true).get();
                        setCategoryRestaurantIds([...new Set(snap.docs.map(d => d.data().restaurantId).filter(Boolean))]);
                      } catch (e) { console.error(e); }
                    }
                  }}>
                    <View style={[s.catImgWrap, active && s.catImgActive]}>
                      {item.id === "all"
                        ? <Ionicons name="grid" size={22} color={active ? "#fff" : ORANGE} />
                        : item.image
                          ? <Image source={{ uri: item.image }} style={s.catImg} contentFit="cover" />
                          : <Ionicons name="restaurant-outline" size={22} color={active ? "#fff" : ORANGE} />
                      }
                    </View>
                    <Text style={[s.catName, active && s.catNameActive]} numberOfLines={1}>{item.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* index 2+ — rest of content */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filterList} style={s.filterWrap}>
          {FILTER_CHIPS.map(f => {
            const active = selectedFilter === f.id;
            return (
              <TouchableOpacity key={f.id} style={[s.chip, active && s.chipActive]}
                onPress={() => setSelectedFilter(active ? null : f.id)} activeOpacity={0.8}>
                <Text style={s.chipEmoji}>{f.emoji}</Text>
                <Text style={[s.chipTxt, active && s.chipTxtActive]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Banners ── */}
        {banners.length > 0 && (
          <View style={s.bannerSection}>
            <FlatList
              data={banners} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
              keyExtractor={i => i.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={s.bannerSlide} activeOpacity={0.9}>
                  <Image source={{ uri: item.imageUrl }} style={s.bannerImg} contentFit="cover" />
                </TouchableOpacity>
              )}
              ref={ref => { if (ref && banners.length > 0) ref.scrollToIndex({ index: currentBannerIndex, animated: true }); }}
            />
            <View style={s.bannerDots}>
              {banners.map((_, i) => (
                <View key={i} style={[s.bannerDot, i === currentBannerIndex && s.bannerDotActive]} />
              ))}
            </View>
          </View>
        )}

        {/* ── Restaurant List ── */}
        <View style={s.listSection}>
          {filtered.length > 0 && (
            <View style={s.listHeaderWrap}>
              <View style={s.listHeaderLeft}>
                <Ionicons name="restaurant" size={18} color={ORANGE} />
                <Text style={s.listHeader}>Popular Restaurants</Text>
              </View>
              <View style={s.countBadge}>
                <Text style={s.countTxt}>{filtered.length}</Text>
              </View>
            </View>
          )}
          {filtered.length === 0 ? (
            <View style={s.empty}>
              <Text style={{ fontSize: 48 }}>🍽️</Text>
              <Text style={s.emptyTitle}>No restaurants found</Text>
              <Text style={s.emptySub}>Try a different filter or category</Text>
            </View>
          ) : (
            filtered.map(item => {
              const now = new Date();

              // Resolve rushHoursUntil — prefer stored timestamp, fallback to updatedAt + duration
              let rushUntil: Date | null = null;
              if (item.rushHoursUntil) {
                rushUntil = item.rushHoursUntil?.toDate
                  ? item.rushHoursUntil.toDate()
                  : typeof item.rushHoursUntil === 'string'
                    ? new Date(item.rushHoursUntil)
                    : null;
              }

              // If rushHoursUntil missing/stale but duration exists, calculate from updatedAt
              if (item.rushHours === true && !rushUntil && (item as any).rushHoursDuration && item.updatedAt) {
                const updatedAt: Date = item.updatedAt?.toDate
                  ? item.updatedAt.toDate()
                  : new Date(item.updatedAt);
                const durationMs = (item as any).rushHoursDuration * 60 * 1000;
                rushUntil = new Date(updatedAt.getTime() + durationMs);
              }

              // Active only if flag true AND end time is in the future
              const isRushHour = item.rushHours === true && rushUntil !== null && rushUntil > now;

              // Format end time in local timezone
              let rushTimeText = "";
              if (isRushHour && rushUntil) {
                const h = rushUntil.getHours();
                const m = rushUntil.getMinutes();
                const ampm = h >= 12 ? 'PM' : 'AM';
                const displayH = h % 12 || 12;
                rushTimeText = `${displayH}:${m.toString().padStart(2, '0')} ${ampm}`;
              }

              // Operating hours
              const opening = (item as any).openingTime as string | undefined;
              const closing = (item as any).closingTime as string | undefined;
              const hasHours = !!(opening && closing);
              const open = isRestaurantOpen(opening, closing);

              return (
                <TouchableOpacity key={item.id} style={s.card} activeOpacity={0.9}
                  onPress={() => openDish(
                    item.id, 
                    item.restaurantName, 
                    undefined, 
                    isRushHour, 
                    rushTimeText,
                    item.coverImage,
                    item.profileImage,
                    item.image,
                    item.description
                  )}>
                  <View style={s.cardImgWrap}>
                    {item.coverImage || item.profileImage || item.image
                      ? <Image source={{ uri: item.coverImage || item.profileImage || item.image }} style={s.cardImg} contentFit="cover" />
                      : <View style={s.cardImgPlaceholder}><Ionicons name="restaurant" size={40} color={ORANGE} /></View>
                    }
                    {/* Dark overlay for rush hours - covers entire image */}
                    {isRushHour && (
                      <>
                        <View style={s.rushOverlay} />
                        {/* Rush Hours text centered on image */}
                        <View style={s.rushOverlayContent}>
                          <Ionicons name="time" size={40} color="#fff" />
                          <Text style={s.rushOverlayTitle}>RUSH HOURS</Text>
                          {rushTimeText && (
                            <Text style={s.rushOverlayTime}>Until {rushTimeText}</Text>
                          )}
                        </View>
                      </>
                    )}
                    
                    {(item as any).cuisineType === "veg" && (
                      <View style={s.vegBadge}>
                        <Ionicons name="leaf" size={10} color="#fff" />
                        <Text style={s.vegBadgeTxt}>PURE VEG</Text>
                      </View>
                    )}
                    {item.isTrending && !isRushHour && (
                      <View style={s.trendingBadge}>
                        <Text style={s.trendingBadgeTxt}>🔥 Trending</Text>
                      </View>
                    )}
                  </View>
                  <View style={s.cardBody}>
                    <View style={s.cardRow}>
                      <Text style={s.cardName} numberOfLines={1}>{item.restaurantName}</Text>
                      {item.rating != null && (
                        <View style={s.ratingBadge}>
                          <Ionicons name="star" size={11} color="#fff" />
                          <Text style={s.ratingTxt}>{item.rating.toFixed(1)}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={s.cardCuisine} numberOfLines={1}>
                      {item.type === "restaurant" ? "Multi-cuisine" : (item.type ?? "Restaurant")}
                    </Text>
                    {/* Operating Hours */}
                    {hasHours && (
                      <View style={[s.hoursRow, !open && s.hoursRowClosed]}>
                        <Ionicons name="time-outline" size={13} color={open ? GREEN : "#ef4444"} />
                        <Text style={[s.hoursTxt, !open && s.hoursTxtClosed]}>
                          {open ? `Open: ${opening} - ${closing}` : `Closed • Opens at ${opening}`}
                        </Text>
                      </View>
                    )}
                    <View style={s.cardMeta}>
                      <Ionicons name="time-outline" size={13} color={GRAY} />
                      <Text style={s.metaTxt}>
                        {item.deliveryTime != null ? `${item.deliveryTime} min` : "30–40 min"}
                      </Text>
                      <View style={s.metaSep} />
                      <Ionicons name="bicycle-outline" size={13} color={GRAY} />
                      <Text style={s.metaTxt}>
                        {item.freeDelivery ? "Free delivery" : item.avgPrice != null ? `₹${item.avgPrice} for one` : "Free delivery"}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F0F8F8" },

  // ── Modals ──
  modalBg:  { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 24 },
  loadCard: { backgroundColor: "#fff", borderRadius: 24, padding: 32, alignItems: "center", width: "85%", shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 12 },
  loadImg:  { width: 140, height: 140, borderRadius: 16, marginBottom: 20 },
  loadTitle:{ fontSize: 20, fontWeight: "700", color: DARK, marginBottom: 6 },
  loadSub:  { fontSize: 14, color: GRAY },

  vegCard:       { backgroundColor: "#fff", borderRadius: 24, width: "88%", maxWidth: 380, shadowColor: "#000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 20, overflow: "hidden" },
  vegBand:       { paddingTop: 18, paddingBottom: 14, paddingHorizontal: 18, position: "relative" },
  vegBandImg:    { width: 70, height: 70, marginBottom: 10 },
  vegBandTitle:  { fontSize: 17, fontWeight: "800", color: "#fff", letterSpacing: -0.3 },
  vegBandSub:    { fontSize: 11, color: "rgba(255,255,255,0.85)", marginTop: 2, fontWeight: "500" },
  vegCloseBtn:   { position: "absolute", top: 10, right: 10, zIndex: 10, width: 26, height: 26, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.25)", justifyContent: "center", alignItems: "center" },
  vegTopBar:     { height: 0 },
  vegTopBarGradient: { height: 0 },
  vegCloseBtnInner: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#f5f5f5", justifyContent: "center", alignItems: "center" },
  vegHeaderRow:  { flexDirection: "row" },
  vegTitleMain:  { fontSize: 17, fontWeight: "800", color: DARK },
  vegTitleSub:   { fontSize: 17, fontWeight: "800", color: GREEN },
  vegHeaderDesc: { fontSize: 11, color: GRAY, marginTop: 2 },
  vegHeaderImgWrap: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#FFF8F0", justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#FFE8CC" },
  vegHeaderImg:  { width: 50, height: 50 },
  vegHeaderImgGlow: { position: "absolute", width: 50, height: 50, borderRadius: 25, backgroundColor: ORANGE, opacity: 0.15 },
  vegSubtitle:   { fontSize: 11, color: GRAY, paddingHorizontal: 18, marginBottom: 10 },
  vegOptionsWrap:{ gap: 7, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6 },
  vegOption:     { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#fafafa", borderWidth: 1.5, borderColor: "#efefef" },
  vegOptionActive: { backgroundColor: "#FFF8F0", borderColor: ORANGE },
  vegOptionActiveNonVeg: { backgroundColor: "#FFF5F5", borderColor: "#cc2200" },
  vegOptionContent: { flexDirection: "row", alignItems: "center", gap: 12 },
  vegOptionIcon2: { width: 40, height: 40, borderRadius: 11, justifyContent: "center", alignItems: "center", borderWidth: 1.5, borderColor: "#e5e5e5" },
  vegOptionIconWrap: { width: 40, height: 40, borderRadius: 11, backgroundColor: "#fff", justifyContent: "center", alignItems: "center", borderWidth: 1.5, borderColor: "#e5e5e5" },
  vegOptionIconWrapActive: { borderColor: ORANGE, backgroundColor: "#FFF8F0" },
  vegOptionIconWrapActiveVeg: { borderColor: GREEN, backgroundColor: "#f0fdf4" },
  vegOptionIconWrapActiveNonVeg: { borderColor: "#cc2200", backgroundColor: "#FFF5F5" },
  vegOptionIcon: { fontSize: 20 },
  vegOptionText: { fontSize: 13, color: DARK, fontWeight: "700", marginBottom: 2 },
  vegOptionTextActive: { color: ORANGE },
  vegOptionTextActiveNonVeg: { color: "#cc2200" },
  vegOptionDesc: { fontSize: 11, color: GRAY, fontWeight: "400" },
  radioOuter:    { width: 19, height: 19, borderRadius: 9.5, borderWidth: 2, borderColor: "#d5d5d5", justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
  radioOuterActive: { borderColor: GREEN },
  radioOuterActiveNonVeg: { borderColor: "#cc2200" },
  radioInner:    { width: 9, height: 9, borderRadius: 4.5, backgroundColor: GREEN },
  radioInnerNonVeg: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: "#cc2200" },
  vegButtonsRow: { flexDirection: "row", gap: 8, paddingHorizontal: 14, paddingBottom: 16, paddingTop: 8 },
  vegCancelBtn:  { flex: 1, backgroundColor: "#f5f5f5", paddingVertical: 12, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#e8e8e8" },
  vegCancelBtnTxt: { color: GRAY, fontSize: 13, fontWeight: "700" },
  vegApplyBtn:   { flex: 2, paddingVertical: 12, borderRadius: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  vegApplyBtnTxt: { color: "#fff", fontSize: 13, fontWeight: "800", letterSpacing: 0.2 },

  rejCard:    { backgroundColor: "#fff", borderRadius: 24, padding: 28, alignItems: "center", width: "88%", shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 12 },
  rejIconWrap:{ width: 88, height: 88, borderRadius: 44, backgroundColor: "#fef2f2", justifyContent: "center", alignItems: "center", marginBottom: 16 },
  rejTitle:   { fontSize: 22, fontWeight: "800", color: DARK, marginBottom: 6 },
  rejSub:     { fontSize: 14, color: GRAY },
  rejName:    { fontSize: 17, fontWeight: "700", color: "#ef4444", marginTop: 4, marginBottom: 10, textAlign: "center" },
  rejHint:    { fontSize: 13, color: GRAY, textAlign: "center", lineHeight: 19, marginBottom: 24 },
  rejBtn:     { width: "100%", backgroundColor: "#ef4444", paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  rejBtnTxt:  { color: "#fff", fontSize: 15, fontWeight: "700" },

  // ── Hero ──
  hero:        { width: "100%", overflow: "hidden", marginBottom: 0 },
  heroDim:     { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.25)" },
  heroOverlay: { flex: 1, paddingHorizontal: 16, paddingBottom: 16, justifyContent: "flex-start", gap: 10 },

  // Header UI floats over hero image
  headerUI: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 100,
    paddingHorizontal: 16,
    gap: 10,
  },
  heroTopRow:  { flexDirection: "row", alignItems: "center", zIndex: 100 },
  locationPill:{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  locationTxt: { flex: 1, fontSize: 14, fontWeight: "600", color: "#fff" },
  avatarBtn:   { marginLeft: 10, zIndex: 200 },
  avatar:      { width: 44, height: 44, borderRadius: 22, borderWidth: 2.5, borderColor: "rgba(255,255,255,0.7)" },

  searchWrap:   { flexDirection: "row", alignItems: "center", gap: 10 },
  searchBar:    { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 6 },
  searchTxt:    { fontSize: 14, color: GRAY, flex: 1 },
  modeToggleWrap: { paddingHorizontal: 0 },

  // ── Categories ──
  catSection: {
    backgroundColor: "#ffffff",
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 0,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4 },
      android: { elevation: 4 },
    }),
  },
  catList:    { paddingHorizontal: 16, gap: 8 },
  catItem:    { alignItems: "center", width: 68 },
  catImgWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#FFF3EC", justifyContent: "center", alignItems: "center", marginBottom: 6, borderWidth: 2, borderColor: "transparent" },
  catImgActive:{ backgroundColor: ORANGE, borderColor: ORANGE },
  catImg:     { width: 56, height: 56, borderRadius: 28 },
  catName:    { fontSize: 11, color: DARK, fontWeight: "600", textAlign: "center" },
  catNameActive:{ color: ORANGE, fontWeight: "700" },

  // ── Banners ──
  bannerSection:{ paddingVertical: 16, backgroundColor: "transparent" },
  bannerSlide:  { width: SW - 32, marginHorizontal: 16, borderRadius: 16, overflow: "hidden" },
  bannerImg:    { width: "100%", height: 130, borderRadius: 16 },
  bannerDots:   { flexDirection: "row", justifyContent: "center", marginTop: 10, gap: 6 },
  bannerDot:    { width: 6, height: 6, borderRadius: 3, backgroundColor: "#DDD" },
  bannerDotActive:{ width: 18, backgroundColor: ORANGE },

  // ── Filters ──
  filterWrap: { backgroundColor: "transparent", borderBottomWidth: 0 },
  filterList: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  chip:       { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: "#EBEBF0", backgroundColor: "#FAFAFA" },
  chipActive: { borderColor: ORANGE, backgroundColor: "#FFF4EB" },
  chipEmoji:  { fontSize: 13 },
  chipTxt:    { fontSize: 13, color: GRAY, fontWeight: "500" },
  chipTxtActive:{ color: ORANGE, fontWeight: "700" },

  // ── Restaurant List ──
  listSection: { paddingTop: 0, backgroundColor: "transparent" },
  listHeaderWrap: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, marginBottom: 4 },
  listHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  listHeader:  { fontSize: 18, color: DARK, fontWeight: "700" },
  countBadge:  { backgroundColor: ORANGE, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  countTxt:    { color: "#fff", fontSize: 13, fontWeight: "700" },

  card:         { marginHorizontal: 16, marginBottom: 16, marginTop: 0, backgroundColor: "#fff", borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5 },
  cardImgWrap:  { position: "relative" },
  cardImg:      { width: "100%", height: 180 },
  cardImgPlaceholder: { width: "100%", height: 180, backgroundColor: "#FFF3EC", justifyContent: "center", alignItems: "center" },
  rushOverlay:  { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.75)", zIndex: 1 },
  rushOverlayContent: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center", zIndex: 2 },
  rushOverlayTitle: { fontSize: 22, fontWeight: "800", color: "#fff", marginTop: 8, letterSpacing: 1.5 },
  rushOverlayTime: { fontSize: 15, fontWeight: "600", color: "#fbbf24", marginTop: 4 },
  vegBadge:     { position: "absolute", top: 12, left: 12, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#22c55e", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3, zIndex: 3 },
  vegBadgeTxt:  { color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  trendingBadge: { position: "absolute", top: 12, right: 12, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, zIndex: 3 },
  trendingBadgeTxt: { color: "#fff", fontSize: 10, fontWeight: "700" },
  rushBadge:    { position: "absolute", top: 12, right: 12, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#f59e0b", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3, zIndex: 2 },
  rushBadgeTxt: { color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  cardBody:     { padding: 16 },
  cardRow:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  cardName:     { fontSize: 17, fontWeight: "700", color: DARK, flex: 1, marginRight: 8 },
  rushTimeRow:  { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6, backgroundColor: "#fef3c7", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: "flex-start" },
  rushTimeText: { fontSize: 11, color: "#92400e", fontWeight: "600" },
  ratingBadge:  { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: GREEN, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  ratingTxt:    { color: "#fff", fontSize: 11, fontWeight: "700" },
  cardCuisine:  { fontSize: 13, color: GRAY, marginBottom: 10 },
  hoursRow:     { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 8, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: "#f0fdf4", borderRadius: 6, alignSelf: "flex-start" },
  hoursRowClosed: { backgroundColor: "#fef2f2" },
  hoursTxt:     { fontSize: 11, color: GREEN, fontWeight: "600" },
  hoursTxtClosed: { color: "#ef4444" },
  cardMeta:     { flexDirection: "row", alignItems: "center", gap: 6 },
  metaTxt:      { fontSize: 12, color: GRAY, fontWeight: "500" },
  metaSep:      { width: 3, height: 3, borderRadius: 1.5, backgroundColor: "#CCC" },

  empty:      { alignItems: "center", paddingVertical: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: DARK, marginTop: 12, marginBottom: 6 },
  emptySub:   { fontSize: 13, color: GRAY, textAlign: "center" },
});
