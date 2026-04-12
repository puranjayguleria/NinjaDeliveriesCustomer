import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  FlatList, StatusBar, Modal, Dimensions, Animated, Image as RNImage,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { useLocationContext } from "@/context/LocationContext";
import { useToggleContext } from "@/context/ToggleContext";
import ModeToggle from "@/components/ModeToggle";
import {
  getFoodBanners,
  listenActiveRestaurants,
  listenFoodCategoriesWithItems,
  type Restaurant,
  type FoodCategory as Category,
  type FoodBanner,
} from "@/firebase/foodFirebase";
import DishModal from "@/components/food/DishModal";
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
  const [isVegMode,            setIsVegMode]            = useState(true);
  const [isScrolled,           setIsScrolled]           = useState(false);
  const [showVegModal,         setShowVegModal]         = useState(false);
  const [pendingVeg,           setPendingVeg]           = useState<boolean | null>(null);
  const [dishModal,            setDishModal]            = useState<{
    visible: boolean; restaurantId: string; restaurantName: string; filterCategoryId?: string | null;
  }>({ visible: false, restaurantId: "", restaurantName: "" });
  const [rejectionModal, setRejectionModal] = useState<{ visible: boolean; restaurantName: string }>({ visible: false, restaurantName: "" });

  const scrollRef  = useRef<any>(null);
  const scrollY    = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const rejScaleAnim = useRef(new Animated.Value(0.85)).current;
  const rejOpacAnim  = useRef(new Animated.Value(0)).current;

  // Header shrink on scroll — hero height based on image aspect ratio 720x567
  const HERO_FULL = Math.round(SW * 567 / 720); // exact aspect ratio 720x567
  const HERO_MIN  = 80;
  const headerH = scrollY.interpolate({ inputRange: [0, HERO_FULL - HERO_MIN], outputRange: [HERO_FULL, HERO_MIN], extrapolate: "clamp" });

  const playBounce = () => {
    bounceAnim.setValue(0); fadeAnim.setValue(0);
    Animated.parallel([
      Animated.timing(fadeAnim,   { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(bounceAnim, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
    ]).start();
  };

  useEffect(() => {
    if (!showSearchModal) return;
    playBounce();
    const t = setInterval(() => setModalImageIndex(p => (p + 1) % FOOD_IMAGES.length), 1500);
    return () => clearInterval(t);
  }, [showSearchModal]); // eslint-disable-line react-hooks/exhaustive-deps

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
    return () => { u1(); u2(); };
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => setCurrentBannerIndex(p => (p === banners.length - 1 ? 0 : p + 1)), 3000);
    return () => clearInterval(t);
  }, [banners.length]);

  const handleVegToggle = () => { setPendingVeg(!isVegMode); setShowVegModal(true); };
  const confirmVeg = () => { if (pendingVeg !== null) setIsVegMode(pendingVeg); setShowVegModal(false); setPendingVeg(null); };
  const cancelVeg  = () => { setShowVegModal(false); setPendingVeg(null); };
  const openDish   = (id: string, name: string, catId?: string | null) =>
    setDishModal({ visible: true, restaurantId: id, restaurantName: name, filterCategoryId: catId });

  const filtered = React.useMemo(() => {
    let list = [...restaurants];
    if (isVegMode) list = list.filter(r => (r as any).cuisineType === "veg" || (r as any).cuisineType === "both");
    else           list = list.filter(r => (r as any).cuisineType === "nonveg" || (r as any).cuisineType === "both");
    if (selectedCategoryId && categoryRestaurantIds.length > 0) list = list.filter(r => categoryRestaurantIds.includes(r.id));
    else if (selectedCategoryId && categoryRestaurantIds.length === 0) list = [];
    switch (selectedFilter) {
      case "rating4":  list = list.filter(r => (r.rating ?? 0) >= 4.0); break;
      case "under30":  list = list.filter(r => (r.deliveryTime ?? 99) < 30); break;
      case "trending": list = list.filter(r => r.isTrending === true); break;
      case "budget":   list = list.filter(r => (r.avgPrice ?? 999) < 150); break;
      case "new":      list.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)); break;
    }
    return list;
  }, [restaurants, selectedFilter, selectedCategoryId, categoryRestaurantIds, isVegMode]);

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
          <View style={s.vegCard}>
            <View style={[s.vegIconCircle, { backgroundColor: pendingVeg ? "#e8f8ef" : "#fef0f0" }]}>
              <Text style={{ fontSize: 32 }}>{pendingVeg ? "🥦" : "🍗"}</Text>
            </View>
            <Text style={s.vegTitle}>{pendingVeg ? "Switch to Veg?" : "Switch to Non-Veg?"}</Text>
            <Text style={s.vegSub}>
              {pendingVeg ? "Only veg & mixed restaurants will be shown." : "Only non-veg & mixed restaurants will be shown."}
            </Text>
            <TouchableOpacity style={[s.vegBtn, { backgroundColor: pendingVeg ? GREEN : "#ef4444" }]} onPress={confirmVeg} activeOpacity={0.85}>
              <Text style={s.vegBtnTxt}>{pendingVeg ? "Yes, Go Veg" : "Yes, Non-Veg"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.vegCancelBtn} onPress={cancelVeg} activeOpacity={0.8}>
              <Text style={s.vegCancelTxt}>Keep Current</Text>
            </TouchableOpacity>
          </View>
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
      <Animated.ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        bounces={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: false,
          listener: (e: any) => {
            const y = e.nativeEvent.contentOffset.y;
            setIsScrolled(y > 50);
          }
        })}
        scrollEventThrottle={16}
        stickyHeaderIndices={[1]}
      >
        {/* ── Hero Image + Header UI (scrolls away) ── */}
        <View style={{ marginBottom: 0 }}>
          <Animated.View style={[s.hero, { height: headerH }]}>
            <Image
              key={isVegMode ? "veg" : "nonveg"}
              source={isVegMode
                ? require("../../assets/ninjafoodVeg.png")
                : require("../../assets/ninjafoodNonVeg.png")}
              style={StyleSheet.absoluteFillObject}
              contentFit="fill"
            />
            <View style={s.heroDim} />
          </Animated.View>

          {/* Header UI overlaid on hero — scrolls with content */}
          <View style={[s.headerUI, { top: insets.top + 12 }]}>
            {/* Row 1: Location + Avatar */}
            <View style={s.heroTopRow}>
              <TouchableOpacity style={s.locationPill} activeOpacity={0.8}
                onPress={() => navigation.navigate("LocationSelector", { fromScreen: "Food" })}>
                <Ionicons name="location-sharp" size={15} color={ORANGE} />
                <Text style={s.locationTxt} numberOfLines={1}>
                  {location?.address || "Set delivery location"}
                </Text>
                <Ionicons name="chevron-down" size={13} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate("Profile")} style={s.avatarBtn}>
                <RNImage source={profileLogoMap[activeMode]} style={s.avatar} resizeMode="cover" />
              </TouchableOpacity>
            </View>

            {/* Row 2: Search + Veg toggle */}
            <View style={s.searchWrap}>
              <TouchableOpacity style={s.searchBar} activeOpacity={0.85}
                onPress={() => navigation.navigate("FoodSearch")}>
                <Ionicons name="search-outline" size={17} color={GRAY} />
                <Text style={s.searchTxt}>Search restaurants, cuisines...</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.vegToggleBtn, { backgroundColor: isVegMode ? "#00666A" : "#B70000" }]}
                onPress={handleVegToggle}
                activeOpacity={0.85}
              >
                <View style={s.vegDot} />
                <Text style={s.vegToggleTxt}>{isVegMode ? "VEG" : "NON"}</Text>
              </TouchableOpacity>
            </View>

            {/* Row 3: Mode Toggle */}
            <View style={s.modeToggleWrap}>
              <ModeToggle activeMode={activeMode} onPress={setActiveMode} />
            </View>
          </View>
        </View>

        {/* ── Sticky: Categories only ── */}
        <View style={[s.catSection, { paddingTop: insets.top, marginTop: -2, backgroundColor: isScrolled ? "#fff" : "rgba(255,255,255,0.75)" }]}>
          {categories.length > 0 && (
            <FlatList
              data={[{ id: "all", name: "All", image: null }, ...categories]}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={i => i.id}
              contentContainerStyle={s.catList}
              renderItem={({ item }) => {
                const active = item.id === "all" ? selectedCategoryId === null : selectedCategoryId === item.id;
                return (
                  <TouchableOpacity style={s.catItem} activeOpacity={0.75} onPress={async () => {
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
              }}
            />
          )}
        </View>

        {/* ── Filter Chips (scrolls normally) ── */}
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
            filtered.map(item => (
              <TouchableOpacity key={item.id} style={s.card} activeOpacity={0.9}
                onPress={() => openDish(item.id, item.restaurantName)}>
                <View style={s.cardImgWrap}>
                  {item.profileImage || item.image
                    ? <Image source={{ uri: item.profileImage || item.image }} style={s.cardImg} contentFit="cover" />
                    : <View style={s.cardImgPlaceholder}><Ionicons name="restaurant" size={40} color={ORANGE} /></View>
                  }
                  {(item as any).cuisineType === "veg" && (
                    <View style={s.vegBadge}>
                      <Ionicons name="leaf" size={10} color="#fff" />
                      <Text style={s.vegBadgeTxt}>PURE VEG</Text>
                    </View>
                  )}
                </View>
                <View style={s.cardBody}>
                  <View style={s.cardRow}>
                    <Text style={s.cardName} numberOfLines={1}>{item.restaurantName}</Text>
                    <View style={s.ratingBadge}>
                      <Ionicons name="star" size={11} color="#fff" />
                      <Text style={s.ratingTxt}>4.2</Text>
                    </View>
                  </View>
                  <Text style={s.cardCuisine} numberOfLines={1}>
                    {item.type === "restaurant" ? "Multi-cuisine" : (item.type ?? "Restaurant")}
                  </Text>
                  <View style={s.cardMeta}>
                    <Ionicons name="time-outline" size={13} color={GRAY} />
                    <Text style={s.metaTxt}>30–40 min</Text>
                    <View style={s.metaSep} />
                    <Ionicons name="bicycle-outline" size={13} color={GRAY} />
                    <Text style={s.metaTxt}>Free delivery</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
          <View style={{ height: 100 }} />
        </View>
      </Animated.ScrollView>

      <DishModal
        visible={dishModal.visible}
        onClose={() => setDishModal(p => ({ ...p, visible: false }))}
        restaurantId={dishModal.restaurantId}
        restaurantName={dishModal.restaurantName}
        filterCategoryId={dishModal.filterCategoryId}
        vegMode={isVegMode}
      />
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

  vegCard:       { backgroundColor: "#fff", borderRadius: 24, padding: 28, alignItems: "center", width: "88%", shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 10 },
  vegIconCircle: { width: 72, height: 72, borderRadius: 36, justifyContent: "center", alignItems: "center", marginBottom: 16 },
  vegTitle:      { fontSize: 19, fontWeight: "700", color: DARK, marginBottom: 8, textAlign: "center" },
  vegSub:        { fontSize: 13, color: GRAY, textAlign: "center", lineHeight: 20, marginBottom: 24 },
  vegBtn:        { width: "100%", paddingVertical: 14, borderRadius: 14, alignItems: "center", marginBottom: 10 },
  vegBtnTxt:     { color: "#fff", fontSize: 15, fontWeight: "700" },
  vegCancelBtn:  { paddingVertical: 10 },
  vegCancelTxt:  { color: GRAY, fontSize: 14, fontWeight: "500" },

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
  heroTopRow:  { flexDirection: "row", alignItems: "center" },

  // Header UI floats over hero image
  headerUI: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 16,
    gap: 10,
  },
  locationPill:{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  locationTxt: { flex: 1, fontSize: 14, fontWeight: "600", color: "#fff" },
  avatarBtn:   { marginLeft: 10 },
  avatar:      { width: 44, height: 44, borderRadius: 22, borderWidth: 2.5, borderColor: "rgba(255,255,255,0.7)" },

  searchWrap:   { flexDirection: "row", alignItems: "center", gap: 10 },
  searchBar:    { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 6 },
  searchTxt:    { fontSize: 14, color: GRAY, flex: 1 },
  vegToggleBtn: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6, minWidth: 58 },
  vegDot:       { width: 9, height: 9, borderRadius: 5, backgroundColor: "#fff", marginBottom: 4 },
  vegToggleTxt: { fontSize: 10, fontWeight: "800", letterSpacing: 1, color: "#fff" },
  modeToggleWrap: { paddingHorizontal: 0 },

  // ── Categories ──
  catSection: { backgroundColor: "rgba(255,255,255,0.75)", paddingTop: 8, borderBottomWidth: 0, marginTop: 0 },
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
  vegBadge:     { position: "absolute", top: 12, left: 12, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#22c55e", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },
  vegBadgeTxt:  { color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  cardBody:     { padding: 16 },
  cardRow:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  cardName:     { fontSize: 17, fontWeight: "700", color: DARK, flex: 1, marginRight: 8 },
  ratingBadge:  { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: GREEN, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  ratingTxt:    { color: "#fff", fontSize: 11, fontWeight: "700" },
  cardCuisine:  { fontSize: 13, color: GRAY, marginBottom: 10 },
  cardMeta:     { flexDirection: "row", alignItems: "center", gap: 6 },
  metaTxt:      { fontSize: 12, color: GRAY, fontWeight: "500" },
  metaSep:      { width: 3, height: 3, borderRadius: 1.5, backgroundColor: "#CCC" },

  empty:      { alignItems: "center", paddingVertical: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: DARK, marginTop: 12, marginBottom: 6 },
  emptySub:   { fontSize: 13, color: GRAY, textAlign: "center" },
});
