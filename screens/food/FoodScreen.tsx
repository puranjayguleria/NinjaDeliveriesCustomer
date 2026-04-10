import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  FlatList, StatusBar, ImageBackground, Modal, Dimensions, Animated, Image as RNImage,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { useLocationContext } from "@/context/LocationContext";
import { useToggleContext } from "@/context/ToggleContext";
import ModeToggle from "@/components/ModeToggle";
import {
  getActiveRestaurants,
  getFoodCategories,
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

const ORANGE = "#FC8019";
const DARK   = "#282C3F";
const GRAY   = "#93959F";
const GREEN  = "#3d9b6d";

const profileLogoMap = {
  grocery: require('../../assets/profile_logo/grocery_logo.png'),
  food: require('../../assets/profile_logo/food_logo.png'),
  service: require('../../assets/profile_logo/services_logo.png'),
};

// ─── Filter Groups ────────────────────────────────────────────────────────────
// ─── Filter Chips ───────────────────────────────────────────────────────────
type FilterChip = { id: string; label: string; emoji: string };

const FILTER_CHIPS: FilterChip[] = [
  { id: "rating4",  label: "Rating 4.0+",  emoji: "⭐" },
  { id: "under30",  label: "Under 30 min", emoji: "⏱" },
  { id: "trending", label: "Trending",     emoji: "🔥" },
  { id: "budget",   label: "Under ₹150",   emoji: "💸" },
  { id: "new",      label: "Newly Added",  emoji: "🆕" },
];
// Animated line loader
function LineLoader() {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 1800, useNativeDriver: false }),
        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: false }),
      ])
    ).start();
  }, []);
  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -200] });
  return (
    <View style={{ marginTop: 24, width: 200, height: 4, backgroundColor: "#f0e8e0", borderRadius: 2, overflow: "hidden" }}>
      <Animated.View style={{ height: 4, width: 200, backgroundColor: ORANGE, borderRadius: 2, transform: [{ translateX }] }} />
    </View>
  );
}



const FOOD_IMAGES = [
  require("../../assets/food/burger.png"),
  require("../../assets/food/food.png"),
  require("../../assets/food/french-fries.png"),
  require("../../assets/food/juice-drink.png"),
  require("../../assets/food/pizza.png"),
];

export default function FoodScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { location } = useLocationContext();
  const { activeMode, setActiveMode, previousMode, switchedToFood, clearSwitchedToFood } = useToggleContext();

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [banners, setBanners] = useState<FoodBanner[]>([]);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [modalImageIndex, setModalImageIndex] = useState(0);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [categoryRestaurantIds, setCategoryRestaurantIds] = useState<string[]>([]);
  const scrollRef = useRef<any>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  
  // Scroll-based animations for sticky header replacement
  const CROP_MAX = 170;
  const HERO_INITIAL = 320;
  const heroHeight = scrollY.interpolate({
    inputRange: [0, CROP_MAX],
    outputRange: [HERO_INITIAL, HERO_INITIAL - CROP_MAX],
    extrapolate: 'clamp',
  });
  
  // Original search bar and toggle animations (fade out on scroll)
  const originalSearchOpacity = scrollY.interpolate({
    inputRange: [0, 60, 100],
    outputRange: [1, 0.5, 0],
    extrapolate: 'clamp',
  });
  const originalSearchTranslateY = scrollY.interpolate({
    inputRange: [0, 60, 100],
    outputRange: [0, -15, -30],
    extrapolate: 'clamp',
  });

  // Location and profile animations (fade out and move up on scroll)
  const locationProfileOpacity = scrollY.interpolate({
    inputRange: [0, 40, 80],
    outputRange: [1, 0.7, 0],
    extrapolate: 'clamp',
  });
  const locationProfileTranslateY = scrollY.interpolate({
    inputRange: [0, 40, 80],
    outputRange: [0, -10, -20],
    extrapolate: 'clamp',
  });

  // Sticky search bar and toggle animations (slide in to replace location/profile)
  const stickySearchOpacity = scrollY.interpolate({
    inputRange: [0, 50, 100],
    outputRange: [0, 0.8, 1],
    extrapolate: 'clamp',
  });

  // Bounce animation for modal images
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const playBounceIn = () => {
    bounceAnim.setValue(0);
    fadeAnim.setValue(0);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(bounceAnim, {
        toValue: 1,
        friction: 4,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Cycle food images in loading modal with bounce
  useEffect(() => {
    if (!showSearchModal) return;
    playBounceIn();
    const interval = setInterval(() => {
      setModalImageIndex((prev) => (prev + 1) % FOOD_IMAGES.length);
    }, 1500);
    return () => clearInterval(interval);
  }, [showSearchModal]);

  useEffect(() => {
    if (showSearchModal) playBounceIn();
  }, [modalImageIndex]);
  const [isVegMode, setIsVegMode] = useState(true);
  const [showVegToggleModal, setShowVegToggleModal] = useState(false);
  const [pendingVegMode, setPendingVegMode] = useState<boolean | null>(null);
  const [dishModal, setDishModal] = useState<{
    visible: boolean;
    restaurantId: string;
    restaurantName: string;
    filterCategoryId?: string | null;
  }>({ visible: false, restaurantId: "", restaurantName: "" });

  // Order rejection modal
  const [rejectionModal, setRejectionModal] = useState<{
    visible: boolean;
    restaurantName: string;
  }>({ visible: false, restaurantName: "" });
  const rejectionScaleAnim = useRef(new Animated.Value(0.8)).current;
  const rejectionOpacAnim  = useRef(new Animated.Value(0)).current;

  // Listen for rejected food orders in real-time (only live status changes, not old ones)
  useEffect(() => {
    const user = auth().currentUser;
    if (!user) return;

    // Listen to ALL non-delivered/non-cancelled recent orders for this user
    // No createdAt filter — avoids Firestore timestamp comparison issues
    const unsub = firestore()
      .collection("restaurant_Orders")
      .where("userId", "==", user.uid)
      .onSnapshot((snap) => {
        if (!snap) return;
        snap.docChanges().forEach((change) => {
          const data = change.doc.data();
          console.log('[RejectionListener] change.type:', change.type, 'status:', data?.status);
          // Trigger on MODIFIED docs where status just became "rejected"
          if (change.type === "modified") {
            const status = (data?.status ?? "").toLowerCase().trim();
            if (status === "rejected") {
              const name = data?.restaurantName ?? "the restaurant";
              console.log('[RejectionListener] ORDER REJECTED by:', name);
              rejectionScaleAnim.setValue(0.8);
              rejectionOpacAnim.setValue(0);
              setRejectionModal({ visible: true, restaurantName: name });
              Animated.parallel([
                Animated.spring(rejectionScaleAnim, { toValue: 1, friction: 5, tension: 70, useNativeDriver: true }),
                Animated.timing(rejectionOpacAnim,  { toValue: 1, duration: 220, useNativeDriver: true }),
              ]).start();
            }
          }
        });
      }, (err) => {
        console.error('[RejectionListener] error:', err);
      });
    return () => unsub();
  }, []);

  // Show modal when FoodScreen mounts after a mode switch from grocery/service
  useEffect(() => {
    console.log('[FoodScreen] switchedToFood:', switchedToFood);
    if (switchedToFood) {
      setShowSearchModal(true);
      setTimeout(() => {
        setShowSearchModal(false);
        clearSwitchedToFood();
      }, 4000);
    }
  }, [switchedToFood]);

  // Initial data load — real-time listeners
  useEffect(() => {
    // Real-time: restaurants
    const unsubRestaurants = listenActiveRestaurants(
      (data) => setRestaurants(data),
      (err) => console.error('[FoodScreen] restaurants listener error:', err)
    );

    // Real-time: categories
    const unsubCategories = listenFoodCategoriesWithItems(
      (data) => setCategories(data),
      (err) => console.error('[FoodScreen] categories listener error:', err)
    );

    // One-time: banners (don't change often)
    getFoodBanners().then((bannerData) => {
      setBanners(bannerData);
    }).catch((err) => console.error('[FoodScreen] banners fetch error:', err));

    return () => {
      unsubRestaurants();
      unsubCategories();
    };
  }, []);

  // Auto slide banners
  useEffect(() => {
    if (banners.length > 1) {
      const interval = setInterval(() => {
        setCurrentBannerIndex((prevIndex) => 
          prevIndex === banners.length - 1 ? 0 : prevIndex + 1
        );
      }, 3000); // 3 seconds auto slide

      return () => clearInterval(interval);
    }
  }, [banners.length]);

  const handleVegToggle = () => {
    const newMode = !isVegMode;
    setPendingVegMode(newMode);
    setShowVegToggleModal(true);
  };

  const confirmVegToggle = () => {
    if (pendingVegMode !== null) {
      setIsVegMode(pendingVegMode);
    }
    setShowVegToggleModal(false);
    setPendingVegMode(null);
  };

  const cancelVegToggle = () => {
    setShowVegToggleModal(false);
    setPendingVegMode(null);
  };

  const openDishModal = (
    restaurantId: string,
    restaurantName: string,
    filterCategoryId?: string | null
  ) => setDishModal({ visible: true, restaurantId, restaurantName, filterCategoryId });

  const filteredRestaurants = React.useMemo(() => {
    let list = [...restaurants];

    // Filter by Veg/NonVeg toggle based on cuisineType
    if (isVegMode) {
      // Veg mode: Show only veg and both restaurants
      list = list.filter(r => (r as any).cuisineType === "veg" || (r as any).cuisineType === "both");
    } else {
      // NonVeg mode: Show only nonveg and both restaurants  
      list = list.filter(r => (r as any).cuisineType === "nonveg" || (r as any).cuisineType === "both");
    }

    // Filter by selected category — based on which restaurants have menu items in that category
    if (selectedCategoryId && categoryRestaurantIds.length > 0) {
      list = list.filter(r => categoryRestaurantIds.includes(r.id));
    } else if (selectedCategoryId && categoryRestaurantIds.length === 0) {
      // Still fetching or no results — show nothing to avoid showing all
      list = [];
    }

    switch (selectedFilter) {
      case "rating4":   list = list.filter(r => (r.rating ?? 0) >= 4.0); break;
      case "rating45":  list = list.filter(r => (r.rating ?? 0) >= 4.5); break;
      case "under30":   list = list.filter(r => (r.deliveryTime ?? 99) < 30); break;
      case "free_del":  list = list.filter(r => r.freeDelivery === true); break;
      case "trending":  list = list.filter(r => r.isTrending === true); break;
      case "veg":       list = list.filter(r => r.isVeg === true); break;
      case "nonveg":    list = list.filter(r => r.isVeg === false); break;
      case "budget":    list = list.filter(r => (r.avgPrice ?? 999) < 150); break;
      case "mid":       list = list.filter(r => { const p = r.avgPrice ?? 999; return p >= 150 && p <= 300; }); break;
      case "premium":   list = list.filter(r => (r.avgPrice ?? 0) > 300); break;
      case "breakfast": list = list.filter(r => r.mealTimes?.includes("breakfast")); break;
      case "lunch":     list = list.filter(r => r.mealTimes?.includes("lunch")); break;
      case "dinner":    list = list.filter(r => r.mealTimes?.includes("dinner")); break;
      case "latenight": list = list.filter(r => r.mealTimes?.includes("latenight")); break;
      case "snacks":    list = list.filter(r => r.mealTimes?.includes("snacks")); break;
      case "offers":    list = list.filter(r => r.hasOffer === true); break;
      case "new":       list.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)); break;
      case "az":        list.sort((a, b) => a.restaurantName.localeCompare(b.restaurantName)); break;
    }
    return list;
  }, [restaurants, selectedFilter, selectedCategoryId, categoryRestaurantIds, categories, isVegMode]);

  return (
    <View style={s.container}>
      <Modal
        visible={showSearchModal}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={s.searchModalOverlay}>
          <View style={s.searchModalContent}>
            <View style={s.searchModalIconContainer}>
              <Animated.View style={{
                opacity: fadeAnim,
                transform: [
                  {
                    scale: bounceAnim.interpolate({
                      inputRange: [0, 0.6, 0.8, 1],
                      outputRange: [0.3, 1.15, 0.95, 1],
                    }),
                  },
                ],
              }}>
                <Image
                  source={FOOD_IMAGES[modalImageIndex]}
                  style={s.searchModalFoodImage}
                  contentFit="cover"
                />
              </Animated.View>
            </View>
            <Text style={s.searchModalTitle}>Finding Restaurants</Text>
            <Text style={s.searchModalSubtitle}>Discovering the best restaurants for you</Text>
            <LineLoader />
          </View>
        </View>
      </Modal>

      {/* Veg Toggle Confirmation Modal */}
      <Modal
        visible={showVegToggleModal}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={s.vegModalOverlay}>
          <View style={s.vegModalContent}>
            <View style={s.vegModalIconContainer}>
              <View style={s.vegModalIconCircle}>
                <Ionicons name="alert" size={32} color="#ff4757" />
              </View>
            </View>
            
            <Text style={s.vegModalTitle}>
              {pendingVegMode ? "Switch to Veg Mode?" : "Switch to NonVeg Mode?"}
            </Text>
            
            <Text style={s.vegModalSubtitle}>
              {pendingVegMode 
                ? "You'll see only vegetarian and mixed cuisine restaurants"
                : "You'll see only non-vegetarian and mixed cuisine restaurants"
              }
            </Text>

            <View style={s.vegModalButtons}>
              <TouchableOpacity
                style={s.vegModalButtonSecondary}
                onPress={cancelVegToggle}
                activeOpacity={0.8}
              >
                <Text style={s.vegModalButtonSecondaryText}>
                  Keep using this mode
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={s.vegModalButtonPrimary}
                onPress={confirmVegToggle}
                activeOpacity={0.8}
              >
                <Text style={s.vegModalButtonPrimaryText}>
                  {pendingVegMode ? "Switch to Veg" : "Switch to NonVeg"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Order Rejected Modal */}
      <Modal
        visible={rejectionModal.visible}
        transparent
        animationType="none"
        statusBarTranslucent
      >
        <View style={s.rejModalOverlay}>
          <Animated.View style={[
            s.rejModalCard,
            { opacity: rejectionOpacAnim, transform: [{ scale: rejectionScaleAnim }] }
          ]}>
            {/* Red top strip */}
            <View style={s.rejModalStrip} />

            <View style={s.rejModalBody}>
              {/* Icon */}
              <View style={s.rejModalIconWrap}>
                <Ionicons name="close-circle" size={52} color="#ef4444" />
              </View>

              <Text style={s.rejModalTitle}>Order Rejected</Text>
              <Text style={s.rejModalSub}>
                Your order has been rejected by
              </Text>
              <Text style={s.rejModalRestName}>{rejectionModal.restaurantName}</Text>
              <Text style={s.rejModalHint}>
                You can try ordering from another restaurant nearby.
              </Text>

              <TouchableOpacity
                style={s.rejModalBtn}
                activeOpacity={0.85}
                onPress={() => {
                  setRejectionModal({ visible: false, restaurantName: "" });
                  navigation.reset({
                    index: 0,
                    routes: [{ name: "AppTabs" }],
                  });
                }}
              >
                <Text style={s.rejModalBtnText}>Got it</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {!showSearchModal && (
        <>
          <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
          
          {/* Fixed Background Pattern */}
          <ImageBackground
            source={require("../../assets/foodScreenbg.png")}
            style={s.fixedBgPattern}
            resizeMode="cover"
          >
              {/* Sticky Header - appears at top when scrolling */}
              <Animated.View style={[
                s.stickyHeader,
                {
                  opacity: stickySearchOpacity,
                  top: 0,
                }
              ]}>
                <View style={s.stickyHeaderContent}>
                  <TouchableOpacity
                    style={s.stickySearchBarOriginal}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate("FoodSearch")}
                  >
                    <Ionicons name="search" size={18} color={GRAY} style={{ marginRight: 8 }} />
                    <Text style={s.stickySearchPlaceholderOriginal}>Search restaurants, cuisines...</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.stickyToggleOriginal}
                    onPress={handleVegToggle}
                    activeOpacity={0.8}
                  >
                    <View style={[s.stickyToggleTrackOriginal, isVegMode && s.stickyToggleTrackActiveOriginal]}>
                      <View style={[s.stickyToggleThumbOriginal, isVegMode && s.stickyToggleThumbActiveOriginal]}>
                        <View style={[s.stickyToggleDotOriginal, { backgroundColor: isVegMode ? GREEN : "#dc2626" }]} />
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              </Animated.View>

            <Animated.ScrollView 
              showsVerticalScrollIndicator={false} 
              bounces={false} 
              style={s.scrollContent} 
              ref={scrollRef}
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                { useNativeDriver: false }
              )}
              scrollEventThrottle={16}
            >
              {/* Header Section */}
              <View style={s.headerBannerContainer}>
                {/* Default VEG/NonVEG Banner */}
                <ImageBackground
                  key={isVegMode ? "veg" : "nonveg"}
                  source={
                    isVegMode
                      ? require("../../assets/ninjafoodVeg.png")
                      : require("../../assets/ninjafoodNonVeg.png")
                  }
                  style={s.hero}
                  resizeMode="stretch"
                >
                  {!isVegMode && <View style={s.redTint} />}
                  <View style={[s.heroContent, { paddingTop: insets.top + 12 }]}>
                    {/* Location and Profile Row - fades out on scroll */}
                    <Animated.View style={[
                      s.locationRow,
                      {
                        opacity: locationProfileOpacity,
                        transform: [{ translateY: locationProfileTranslateY }]
                      }
                    ]}>
                      <TouchableOpacity 
                        style={s.locationBtn}
                        activeOpacity={0.7}
                        onPress={() => navigation.navigate('LocationSelector', { fromScreen: 'Food' })}
                      >
                        <Ionicons name="location-sharp" size={18} color={ORANGE} style={{ marginRight: 6 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={s.locationLabel} numberOfLines={1}>
                            {location?.address || "Set delivery location"}
                          </Text>
                        </View>
                        <Ionicons name="chevron-down" size={16} color={DARK} style={{ marginLeft: 6 }} />
                      </TouchableOpacity>
                      <View style={{ width: 8 }} />
                      <TouchableOpacity onPress={() => navigation.navigate("Profile")}>
                        <RNImage
                          source={profileLogoMap[activeMode]}
                          style={{ width: 44, height: 44, borderRadius: 22 }}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    </Animated.View>

                    {/* Sticky Search Bar and Toggle - slides in to replace location/profile */}
                    <Animated.View style={[
                      s.stickyReplacementRow,
                      {
                        opacity: stickySearchOpacity,
                      }
                    ]}>
                      <TouchableOpacity
                        style={s.stickySearchBarReplacement}
                        activeOpacity={0.85}
                        onPress={() => navigation.navigate("FoodSearch")}
                      >
                        <Ionicons name="search" size={16} color={GRAY} style={{ marginRight: 8 }} />
                        <Text style={s.stickySearchPlaceholder}>Search restaurants...</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={s.stickyToggleSwitch}
                        onPress={handleVegToggle}
                        activeOpacity={0.8}
                      >
                        <View style={[s.stickyToggleTrack, isVegMode && s.stickyToggleTrackActive]}>
                          <View style={[s.stickyToggleThumb, isVegMode && s.stickyToggleThumbActive]}>
                            <View style={[s.stickyToggleDot, { backgroundColor: isVegMode ? GREEN : "#dc2626" }]} />
                          </View>
                        </View>
                      </TouchableOpacity>
                    </Animated.View>

                    {/* Original Search Row - fades out on scroll */}
                    <Animated.View style={[
                      s.searchRow, 
                      { 
                        opacity: originalSearchOpacity,
                        transform: [{ translateY: originalSearchTranslateY }]
                      }
                    ]}>
                      <TouchableOpacity
                        style={s.searchBar}
                        activeOpacity={0.85}
                        onPress={() => navigation.navigate("FoodSearch")}
                      >
                        <Ionicons name="search" size={18} color={GRAY} style={{ marginRight: 8 }} />
                        <Text style={s.searchPlaceholder}>Search restaurants, cuisines...</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={s.toggleSwitch}
                        onPress={handleVegToggle}
                        activeOpacity={0.8}
                      >
                        <View style={[s.toggleTrack, isVegMode && s.toggleTrackActive]}>
                          <View style={[s.toggleThumb, isVegMode && s.toggleThumbActive]}>
                            <View style={[s.toggleDot, { backgroundColor: isVegMode ? GREEN : "#dc2626" }]} />
                          </View>
                        </View>
                      </TouchableOpacity>
                    </Animated.View>

                    <ModeToggle activeMode={activeMode} onPress={setActiveMode} />
                  </View>
                </ImageBackground>

                {/* Firebase Banners Overlay */}
                {banners.length > 0 && (
                  <View style={s.bannersOverlay}>
                    <FlatList
                      data={banners}
                      horizontal
                      pagingEnabled
                      showsHorizontalScrollIndicator={false}
                      keyExtractor={(item) => item.id}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={s.bannerSlide}
                          activeOpacity={0.9}
                        >
                          <Image 
                            source={{ uri: item.imageUrl }} 
                            style={s.bannerSlideImg} 
                            contentFit="cover" 
                          />
                        </TouchableOpacity>
                      )}
                      ref={(ref) => {
                        if (ref && banners.length > 0) {
                          ref.scrollToIndex({ 
                            index: currentBannerIndex, 
                            animated: true 
                          });
                        }
                      }}
                    />
                    
                    {/* Banner Indicators */}
                    <View style={s.bannerIndicators}>
                      {banners.map((_, index) => (
                        <View
                          key={index}
                          style={[
                            s.bannerDot,
                            index === currentBannerIndex && s.bannerDotActive
                          ]}
                        />
                      ))}
                    </View>
                  </View>
                )}
              </View>

              {/* Content Area */}
              <View style={s.contentArea}>
                {categories.length > 0 && (
                  <View style={s.section}>
                    <Text style={s.sectionTitle}>What's on your mind? 🍽️</Text>
                    <View style={s.categoriesBorder}>
                    <FlatList
                      data={[
                        { id: 'all', name: 'All Categories', image: null }, // All Categories button
                        ...categories
                      ]}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      keyExtractor={(i) => i.id}
                      contentContainerStyle={{ paddingLeft: 16, paddingRight: 8, paddingBottom: 4 }}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={s.catItem}
                          activeOpacity={0.75}
                          onPress={async () => {
                            if (item.id === 'all') {
                              // All Categories button pressed - clear filter
                              setSelectedCategoryId(null);
                              setCategoryRestaurantIds([]);
                              scrollRef.current?.scrollTo({ y: 400, animated: true });
                              return;
                            }
                            
                            const newId = selectedCategoryId === item.id ? null : item.id;
                            setSelectedCategoryId(newId);
                            setCategoryRestaurantIds([]);
                            if (newId) {
                              try {
                                const snap = await firestore()
                                  .collection('restaurant_menu')
                                  .where('categoryId', '==', newId)
                                  .where('available', '==', true)
                                  .get();
                                const ids = [...new Set(snap.docs.map(d => d.data().restaurantId).filter(Boolean))];
                                console.log('[Category] categoryId:', newId, 'restaurantIds found:', ids);
                                setCategoryRestaurantIds(ids);
                              } catch (e) {
                                console.error('[Category] fetch error:', e);
                              }
                            }
                            scrollRef.current?.scrollTo({ y: 400, animated: true });
                          }}
                        >
                          {item.id === 'all' ? (
                            // All Categories button design
                            <View style={[
                              s.catImg, 
                              s.allCategoriesImg, 
                              selectedCategoryId === null && s.allCategoriesImgSelected
                            ]}>
                              <Ionicons 
                                name="grid-outline" 
                                size={24} 
                                color={selectedCategoryId === null ? "#fff" : ORANGE} 
                              />
                            </View>
                          ) : item.image ? (
                            <Image source={{ uri: item.image }} style={[s.catImg, selectedCategoryId === item.id && s.catImgSelected]} contentFit="cover" />
                          ) : (
                            <View style={[s.catImg, s.catImgPlaceholder, selectedCategoryId === item.id && s.catImgSelected]}>
                              <Ionicons name="restaurant-outline" size={22} color={ORANGE} />
                            </View>
                          )}
                          <Text style={[
                            s.catName, 
                            (selectedCategoryId === item.id || (item.id === 'all' && selectedCategoryId === null)) && { color: ORANGE, fontWeight: "700" }
                          ]} numberOfLines={1}>
                            {item.name}
                          </Text>
                        </TouchableOpacity>
                      )}
                    />
                    </View>
                  </View>
                )}

        <View style={s.divider} />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filtersRow}
          style={s.filtersWrap}
        >
          {FILTER_CHIPS.map((f) => {
            const active = selectedFilter === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                style={[s.chip, active && s.chipActive]}
                onPress={() => setSelectedFilter(active ? null : f.id)}
                activeOpacity={0.8}
              >
                <Text style={s.chipEmoji}>{f.emoji}</Text>
                <Text style={[s.chipText, active && s.chipTextActive]}>{f.label}</Text>
                {active && <View style={s.chipActiveDot} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={s.restSection}>
          <Text style={s.restSectionTitle}>{filteredRestaurants.length} restaurants</Text>
          {filteredRestaurants.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="restaurant-outline" size={52} color="#e2e8f0" />
              <Text style={s.emptyTitle}>No restaurants found</Text>
              <Text style={s.emptySub}>Try a different filter</Text>
            </View>
          ) : (
            filteredRestaurants.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={s.restCard}
                activeOpacity={0.88}
                onPress={() => openDishModal(item.id, item.restaurantName)}
              >
                <View style={s.restImgWrap}>
                  {item.profileImage || item.image ? (
                    <Image
                      source={{ uri: item.profileImage || item.image }}
                      style={s.restImg}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={s.restImgPlaceholder}>
                      <Ionicons name="restaurant" size={44} color={ORANGE} />
                    </View>
                  )}
                  
                  {/* Pure Veg Watermark for veg restaurants */}
                  {(item as any).cuisineType === "veg" && (
                    <View style={s.pureVegWatermark}>
                      <Ionicons name="leaf" size={12} color="#fff" style={{ marginRight: 4 }} />
                      <Text style={s.pureVegText}>PURE VEG</Text>
                    </View>
                  )}
                  
                  <View style={s.offerTag}>
                    <Text style={s.offerTagText}>20% OFF upto Rs.50</Text>
                  </View>
                </View>
                <View style={s.restInfo}>
                  <View style={s.restNameRow}>
                    <Text style={s.restName} numberOfLines={1}>{item.restaurantName}</Text>
                    <View style={s.ratingPill}>
                      <Ionicons name="star" size={10} color="#fff" />
                      <Text style={s.ratingText}>4.2</Text>
                    </View>
                  </View>
                  <Text style={s.restCuisine} numberOfLines={1}>
                    {item.type === "restaurant" ? "Multi-cuisine" : (item.type ?? "Restaurant")}
                  </Text>
                  <View style={s.restMeta}>
                    <Ionicons name="time-outline" size={12} color={GRAY} />
                    <Text style={s.restMetaText}>30-40 min</Text>
                    <View style={s.metaDot} />
                    <Text style={s.restMetaText}>Rs.150 for one</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={{ height: 90 }} />
              </View>
            </Animated.ScrollView>
          </ImageBackground>

      <DishModal
        visible={dishModal.visible}
        onClose={() => setDishModal((p) => ({ ...p, visible: false }))}
        restaurantId={dishModal.restaurantId}
        restaurantName={dishModal.restaurantName}
        filterCategoryId={dishModal.filterCategoryId}
      />
        </>
      )}
    </View>
  );
}


const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: "#fff" },
  fixedBgPattern: { flex: 1 },
  bgPattern: { flex: 1 },
  scrollContent: { flex: 1 },
  contentArea: { flex: 1 },
  loader:     { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
  loaderText: { marginTop: 12, color: GRAY, fontSize: 14 },

  hero:        { width: "100%", height: 320 },
  heroContent: { paddingHorizontal: 16, paddingBottom: 20 },
  redTint:     { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(220, 38, 38, 0.15)" },

  locationRow:   { flexDirection: "row", alignItems: "center", marginBottom: 12, paddingHorizontal: 4 },
  locationBtn:   { flexDirection: "row", alignItems: "center", flex: 1 },
  locationLabel: { fontSize: 15, fontWeight: "600", color: DARK, flex: 1 },

  // Sticky Replacement Row Styles (replaces location/profile on scroll)
  stickyReplacementRow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  stickySearchBarReplacement: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  stickySearchPlaceholder: {
    fontSize: 13,
    color: GRAY,
    fontWeight: "500",
  },
  stickyToggleSwitch: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  stickyToggleTrack: {
    width: 42,
    height: 24,
    borderRadius: 5,
    backgroundColor: "#e57373",
    justifyContent: "center",
    padding: 2,
  },
  stickyToggleTrackActive: {
    backgroundColor: "#81c784",
  },
  stickyToggleThumb: {
    width: 18,
    height: 20,
    borderRadius: 3,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
    alignSelf: "flex-end",
  },
  stickyToggleThumbActive: {
    alignSelf: "flex-start",
  },
  stickyToggleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // Sticky Header Styles (appears at top when scrolling) - Same as original
  stickyHeader: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 18, // Increased to match original searchRow spacing
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  stickyHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10, // Same gap as original searchRow
  },
  
  // Sticky Search Bar - Exact copy of original searchBar
  stickySearchBarOriginal: {
    flex: 1, 
    flexDirection: "row", 
    alignItems: "center",
    backgroundColor: "#fff", 
    borderRadius: 10,
    paddingHorizontal: 14, 
    paddingVertical: 12,
    shadowColor: "#000", 
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, 
    shadowRadius: 6, 
    elevation: 4,
  },
  stickySearchPlaceholderOriginal: { 
    fontSize: 14, 
    color: GRAY 
  },
  
  // Sticky Toggle - Exact copy of original toggleSwitch
  stickyToggleOriginal: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  stickyToggleTrackOriginal: {
    width: 50,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#e57373",
    justifyContent: "center",
    padding: 2,
  },
  stickyToggleTrackActiveOriginal: {
    backgroundColor: "#81c784",
  },
  stickyToggleThumbOriginal: {
    width: 22,
    height: 24,
    borderRadius: 4,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 4,
    alignSelf: "flex-end",
  },
  stickyToggleThumbActiveOriginal: {
    alignSelf: "flex-start",
  },
  stickyToggleDotOriginal: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  searchRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 0 },
  searchBar: {
    flex: 1, flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 6, elevation: 4,
  },
  searchPlaceholder: { fontSize: 14, color: GRAY },
  
  toggleSwitch: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  toggleTrack: {
    width: 50,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#e57373",
    justifyContent: "center",
    padding: 2,
  },
  toggleTrackActive: {
    backgroundColor: "#81c784",
  },
  toggleThumb: {
    width: 22,
    height: 24,
    borderRadius: 4,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 4,
    alignSelf: "flex-end",
  },
  toggleThumbActive: {
    alignSelf: "flex-start",
  },
  toggleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  
  vegSwitchContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  vegSwitchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 8,
  },
  vegSwitchBtnActive: {
    backgroundColor: "#f0f0f0",
  },
  vegSwitchText: {
    fontSize: 11,
    fontWeight: "600",
    color: GRAY,
  },
  vegSwitchTextActive: {
    color: DARK,
    fontWeight: "700",
  },
  
  vegToggle: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#fff", borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 12,
    borderWidth: 1.5, borderColor: "#e2e8f0",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 6, elevation: 4,
  },
  vegToggleActive:     { backgroundColor: GREEN, borderColor: GREEN },
  vegDot:              { width: 9, height: 9, borderRadius: 5, backgroundColor: "#dc2626" },
  vegDotActive:        { backgroundColor: GREEN },
  vegToggleText:       { fontSize: 11, fontWeight: "700", color: DARK },
  vegToggleTextActive: { color: "#fff" },

  modeRow: {
    flexDirection: "row", backgroundColor: "rgba(0,0,0,0.22)",
    borderRadius: 30, padding: 4,
  },
  modeBtn:       { flex: 1, paddingVertical: 8, borderRadius: 26, alignItems: "center" },
  modeBtnActive: {
    backgroundColor: "#fff",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 3,
  },
  modeLabel:       { fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.8)", letterSpacing: 0.2 },
  modeLabelActive: { color: DARK, fontWeight: "700" },

  section:           { marginTop: 20 },
  categoriesBorder: {
    marginHorizontal: 12,
    borderRadius: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: DARK,
    marginBottom: 14,
    paddingHorizontal: 16,
    letterSpacing: -0.5,
  },
  catItem:           { alignItems: "center", marginRight: 4, width: 80 },
  catImg:            { width: 72, height: 72, borderRadius: 36 },
  catImgSelected:    { borderWidth: 2.5, borderColor: ORANGE },
  catImgPlaceholder: { backgroundColor: "#fff5f0", justifyContent: "center", alignItems: "center" },
  allCategoriesImg:  { 
    backgroundColor: "#f8f9fa", 
    justifyContent: "center", 
    alignItems: "center", 
    borderWidth: 2, 
    borderColor: "#e9ecef",
    borderRadius: 36, // Added border radius to make it circular
  },
  allCategoriesImgSelected: {
    backgroundColor: ORANGE,
    borderColor: ORANGE,
    borderRadius: 36, // Ensure it stays circular when selected
  },
  catName:           { fontSize: 11, color: DARK, marginTop: 6, textAlign: "center", fontWeight: "500", width: 72 },

  // Banner Styles
  headerBannerContainer: {
    position: 'relative',
  },
  bannersOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    height: 120,
  },
  bannerSlide: {
    width: Dimensions.get('window').width - 32,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  bannerSlideImg: {
    width: '100%',
    height: 120,
    borderRadius: 12,
  },
  bannerIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  bannerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  bannerDotActive: {
    backgroundColor: '#fff',
    width: 20,
  },
  bannerItem: { 
    borderRadius: 12, 
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bannerImg: { 
    width: 280, 
    height: 140, 
    borderRadius: 12,
  },

  divider: { height: 1, backgroundColor: "#f0f0f0", marginTop: 16 },

  filtersWrap:    { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f0f0f0", backgroundColor: "#fff" },
  filtersRow:     { paddingHorizontal: 14, gap: 10 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 24, borderWidth: 1.5, borderColor: "#e8e8e8",
    backgroundColor: "#fafafa",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 1,
  },
  chipActive: {
    borderColor: ORANGE, backgroundColor: "#fff4eb",
    shadowColor: ORANGE, shadowOpacity: 0.2, elevation: 3,
  },
  chipEmoji:      { fontSize: 14 },
  chipText:       { fontSize: 13, color: "#555", fontWeight: "500" },
  chipTextActive: { color: ORANGE, fontWeight: "700" },
  chipActiveDot:  { width: 5, height: 5, borderRadius: 3, backgroundColor: ORANGE, marginLeft: 2 },

  restSection:      { paddingTop: 12 },
  restSectionTitle: { fontSize: 13, color: GRAY, fontWeight: "500", paddingHorizontal: 16, marginBottom: 8 },
  restCard: {
    marginHorizontal: 16, marginBottom: 20,
    backgroundColor: "#fff", borderRadius: 16, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  restImgWrap:        { position: "relative" },
  restImg:            { width: "100%", height: 180 },
  restImgPlaceholder: { width: "100%", height: 180, backgroundColor: "#fff5f0", justifyContent: "center", alignItems: "center" },
  
  // Pure Veg Watermark
  pureVegWatermark: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4CAF50", // Solid green background
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  pureVegText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  
  offerTag:     { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 12, paddingVertical: 6 },
  offerTagText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  restInfo:     { padding: 12 },
  restNameRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  restName:     { fontSize: 16, fontWeight: "700", color: DARK, flex: 1, marginRight: 8 },
  ratingPill:   { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: GREEN, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  ratingText:   { color: "#fff", fontSize: 11, fontWeight: "700" },
  restCuisine:  { fontSize: 12, color: GRAY, marginTop: 3 },
  restMeta:     { flexDirection: "row", alignItems: "center", marginTop: 6, gap: 5 },
  restMetaText: { fontSize: 12, color: GRAY },
  metaDot:      { width: 3, height: 3, borderRadius: 1.5, backgroundColor: GRAY },

  empty:      { alignItems: "center", paddingVertical: 48 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: GRAY, marginTop: 12 },
  emptySub:   { fontSize: 13, color: "#cbd5e1", marginTop: 4 },

  searchModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  searchModalContent: {
    backgroundColor: "#fff",
    borderRadius: 28,
    padding: 36,
    alignItems: "center",
    width: "85%",
    maxWidth: 340,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },
  searchModalIconContainer: {
    marginBottom: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  searchModalFoodImage: {
    width: 160,
    height: 160,
    borderRadius: 20,
  },
  searchModalIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(252, 128, 25, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(252, 128, 25, 0.15)",
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  searchModalTitle: {
    fontSize: 21,
    fontWeight: "700",
    color: DARK,
    textAlign: "center",
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  searchModalSubtitle: {
    fontSize: 15,
    color: GRAY,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 8,
  },

  // Veg Toggle Modal Styles
  vegModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  vegModalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    width: "90%",
    maxWidth: 360,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  vegModalIconContainer: {
    marginBottom: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  vegModalIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 71, 87, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255, 71, 87, 0.2)",
  },
  vegModalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: DARK,
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  vegModalSubtitle: {
    fontSize: 14,
    color: GRAY,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  vegModalButtons: {
    width: "100%",
    gap: 12,
  },
  vegModalButtonPrimary: {
    backgroundColor: "#ff4757",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  vegModalButtonPrimaryText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  vegModalButtonSecondary: {
    backgroundColor: "transparent",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  vegModalButtonSecondaryText: {
    color: DARK,
    fontSize: 16,
    fontWeight: "500",
  },

  // Order Rejection Modal
  rejModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  rejModalCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#fff",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 14,
  },
  rejModalStrip: {
    height: 6,
    backgroundColor: "#ef4444",
  },
  rejModalBody: {
    padding: 28,
    alignItems: "center",
  },
  rejModalIconWrap: {
    marginBottom: 16,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#fef2f2",
    alignItems: "center",
    justifyContent: "center",
  },
  rejModalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: DARK,
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  rejModalSub: {
    fontSize: 14,
    color: GRAY,
    textAlign: "center",
  },
  rejModalRestName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#ef4444",
    marginTop: 4,
    marginBottom: 12,
    textAlign: "center",
  },
  rejModalHint: {
    fontSize: 13,
    color: GRAY,
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 24,
  },
  rejModalBtn: {
    width: "100%",
    backgroundColor: "#ef4444",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  rejModalBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
