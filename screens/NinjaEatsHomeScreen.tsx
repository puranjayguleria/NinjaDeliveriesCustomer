import React, {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Video from "react-native-video";
import { MaterialIcons } from "@expo/vector-icons";
import firestore from "@react-native-firebase/firestore";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Image } from "expo-image";
import { useLocationContext } from "@/context/LocationContext";
import { VerticalSwitcher } from "@/components/VerticalSwitcher";
import Loader from "@/components/VideoLoader";
import { PerformanceMonitor } from "@/utils/PerformanceMonitor";
import * as Location from "expo-location";

/* -------------------------------------------------------------------------- */
/*  CONSTANTS                                                                 */
/* -------------------------------------------------------------------------- */

const { width } = Dimensions.get("window");
const H = 16;

const INITIAL_HEADER_HEIGHT = 180; // 👈 taller video
const COLLAPSED_HEADER_HEIGHT = 120;

const INITIAL_PADDING_TOP = Platform.OS === "ios" ? 52 : 40;
const COLLAPSED_PADDING_TOP = Platform.OS === "ios" ? 40 : 30;

const NINJA_ACCENT = "#00b4a0";

const RESTAURANT_SEARCH_PH = [
  "pizza",
  "momos",
  "thali",
  "burger",
  "biryani",
  "pasta",
];

/* -------------------------------------------------------------------------- */
/*  TYPES                                                                     */
/* -------------------------------------------------------------------------- */

type Restaurant = {
  id: string;
  name: string;
  heroImageUrl?: string;
  cuisines?: string[];
  rating?: number;
  ratingCount?: number;
  deliveryTimeMin?: number;
  deliveryTimeMax?: number;
  costForTwo?: number;
  isPureVeg?: boolean;
  offerText?: string;
  distanceKm?: number;
  isPromoted?: boolean;
  isActive?: boolean;
  cityId?: string;
};

type Cuisine = {
  id: string;
  name: string;
  iconUrl?: string;
  priority?: number;
};

type QuickFilterKey = "veg" | "fast" | "rating" | "offers";

/* -------------------------------------------------------------------------- */
/*  LOCATION PROMPT CARD COMPONENT                                            */
/* -------------------------------------------------------------------------- */

const LocationPromptCard: React.FC<{
  setHasPerm: (v: boolean) => void;
  setSelectManually: (v: boolean) => void;
  setShowLocationPrompt: (v: boolean) => void;
}> = ({ setHasPerm, setSelectManually, setShowLocationPrompt }) => {
  const nav = useNavigation<any>();
  const { updateLocation } = useLocationContext();
  const [busy, setBusy] = useState(false);

  console.log('[LocationPromptCard] Rendering location prompt card');

  const enableLocation = useCallback(async () => {
    try {
      setBusy(true);
      let { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") {
        const res = await Location.requestForegroundPermissionsAsync();
        status = res.status;
      }
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Please allow location access or choose your address manually."
        );
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      updateLocation({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        address: "",
        cityId: "dharamshala", // Default city for restaurants
      });

      setHasPerm(true);
      setSelectManually(true);
      setShowLocationPrompt(false); // Hide the prompt
    } catch (err) {
      console.warn("enableLocation error", err);
      Alert.alert("Error", "Could not fetch location. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [updateLocation, setHasPerm, setSelectManually, setShowLocationPrompt]);

  const handleManualSelection = () => {
    setHasPerm(true);
    setSelectManually(true);
    setShowLocationPrompt(false); // Hide the prompt
    nav.navigate("LocationSelector", { fromScreen: "NinjaEatsHome" });
  };

  return (
    <View style={styles.locationPromptSheet}>
      <View style={styles.locationPromptHandle} />
      
      <View style={styles.locationPromptHeader}>
        <MaterialIcons name="location-on" size={26} color="#00b4a0" />
        <Text style={styles.locationPromptTitle}>Choose your location</Text>
      </View>
      
      <Text style={styles.locationPromptSubtitle}>
        To find the best restaurants and delivery options near you
      </Text>

      <TouchableOpacity
        style={[styles.locationPromptBtn, styles.locationPromptBtnPrimary]}
        onPress={enableLocation}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.locationPromptBtnTxtPrimary}>Enable Location</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.locationPromptBtn, styles.locationPromptBtnSecondary]}
        onPress={handleManualSelection}
        disabled={busy}
      >
        <Text style={styles.locationPromptBtnTxtSecondary}>Select Manually</Text>
      </TouchableOpacity>
    </View>
  );
};
/* -------------------------------------------------------------------------- */

const Header = memo(() => {
  const { location } = useLocationContext();
  const nav = useNavigation<any>();

  return (
    <Pressable
      style={styles.locationRow}
      onPress={() =>
        nav.navigate("LocationSelector", { fromScreen: "NinjaEatsHome" })
      }
    >
      <MaterialIcons
        name="place"
        size={20}
        color="#fff"
        style={{ marginRight: 4 }}
      />
      <Text style={styles.locationTxt} numberOfLines={1}>
        {location.address
          ? `Delivering to ${location.address}`
          : "Set delivery location"}
      </Text>
      <MaterialIcons name="keyboard-arrow-down" size={18} color="#fff" />
    </Pressable>
  );
});

const RestaurantSearchBar = memo(({ ph }: { ph: string }) => {
  const nav = useNavigation<any>();

  return (
    <Pressable
      style={styles.searchWrapper}
      onPress={() => nav.navigate("RestaurantSearch")}
    >
      <MaterialIcons
        name="search"
        size={20}
        color="#555"
        style={{ marginRight: 6 }}
      />
      <Text style={styles.searchTxt}>{`Search for ${ph}`}</Text>
      <View style={styles.searchRightChip}>
        <MaterialIcons name="restaurant-menu" size={14} color="#555" />
        <Text style={styles.searchRightTxt}>Dishes & restaurants</Text>
      </View>
    </Pressable>
  );
});

const RotatingRestaurantSearchBar = () => {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIdx((prev) => (prev + 1) % RESTAURANT_SEARCH_PH.length);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  return <RestaurantSearchBar ph={RESTAURANT_SEARCH_PH[idx]} />;
};

/* -------------------------------------------------------------------------- */
/*  QUICK FILTERS + CUISINES STRIP                                           */
/* -------------------------------------------------------------------------- */

const QUICK_FILTERS: { key: QuickFilterKey; label: string; icon: string }[] = [
  { key: "veg", label: "Veg only", icon: "eco" },
  { key: "fast", label: "Fast delivery", icon: "bolt" },
  { key: "rating", label: "Rating 4.0+", icon: "star-rate" },
  { key: "offers", label: "Great offers", icon: "local-offer" },
];

const QuickFiltersRow: React.FC<{
  activeFilter: QuickFilterKey | null;
  onChange: (key: QuickFilterKey | null) => void;
}> = ({ activeFilter, onChange }) => {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.quickFiltersContainer}
    >
      {QUICK_FILTERS.map((f) => {
        const active = f.key === activeFilter;
        return (
          <Pressable
            key={f.key}
            onPress={() => onChange(active ? null : f.key)}
            style={[
              styles.quickFilterChip,
              active && styles.quickFilterChipActive,
            ]}
          >
            <MaterialIcons
              name={f.icon as any}
              size={14}
              color={active ? "#fff" : "#444"}
            />
            <Text
              style={[
                styles.quickFilterTxt,
                active && styles.quickFilterTxtActive,
              ]}
            >
              {f.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
};

const CuisinesRow: React.FC<{ cuisines: Cuisine[] }> = ({ cuisines }) => {
  const nav = useNavigation<any>();
  const scrollViewRef = useRef<ScrollView>(null);
  const currentIndex = useRef(0);
  const animationRef = useRef<NodeJS.Timeout>();
  const isUserInteracting = useRef(false);

  if (!cuisines.length) return null;

  // Create triple duplicated content for infinite scroll
  const triplicatedCuisines = [...cuisines, ...cuisines, ...cuisines];

  // Pause-then-switch carousel effect
  useEffect(() => {
    const itemWidth = 92; // 80px width + 12px margin
    const originalLength = cuisines.length;
    
    const startCarousel = () => {
      animationRef.current = setInterval(() => {
        if (isUserInteracting.current) return;
        
        currentIndex.current += 1;
        
        // Reset to beginning of second set when we reach the end of first duplicate
        if (currentIndex.current >= originalLength) {
          currentIndex.current = 0;
        }
        
        const targetX = currentIndex.current * itemWidth;
        
        scrollViewRef.current?.scrollTo({ 
          x: targetX, 
          animated: true // Smooth animated transition
        });
      }, 2500); // 2.5 second pause between switches
    };

    // Start carousel after initial delay
    const timeout = setTimeout(startCarousel, 1500);

    return () => {
      clearTimeout(timeout);
      if (animationRef.current) {
        clearInterval(animationRef.current);
      }
    };
  }, [cuisines.length]);

  return (
    <View style={{ marginTop: 8 }}>
      <Text style={styles.sectionTitle}>What&apos;s on your mind?</Text>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cuisinesContainer}
        scrollEventThrottle={16}
        onTouchStart={() => {
          // Pause auto-scroll when user touches
          isUserInteracting.current = true;
          if (animationRef.current) {
            clearInterval(animationRef.current);
          }
        }}
        onTouchEnd={() => {
          // Resume auto-scroll after user stops touching
          setTimeout(() => {
            isUserInteracting.current = false;
            const itemWidth = 92;
            const originalLength = cuisines.length;
            
            animationRef.current = setInterval(() => {
              if (isUserInteracting.current) return;
              
              currentIndex.current += 1;
              
              if (currentIndex.current >= originalLength) {
                currentIndex.current = 0;
              }
              
              const targetX = currentIndex.current * itemWidth;
              
              scrollViewRef.current?.scrollTo({ 
                x: targetX, 
                animated: true
              });
            }, 2500);
          }, 3000); // Resume after 3 seconds
        }}
        onMomentumScrollEnd={(event) => {
          // Update current index based on scroll position
          const itemWidth = 92;
          const scrollX = event.nativeEvent.contentOffset.x;
          currentIndex.current = Math.round(scrollX / itemWidth);
        }}
      >
        {triplicatedCuisines.map((c, index) => (
          <Pressable
            key={`${c.id}-${index}`}
            style={styles.cuisinePill}
            onPress={() =>
              nav.navigate("RestaurantCategoryListing", {
                cuisineId: c.id,
                cuisineName: c.name,
              })
            }
          >
            <View style={styles.cuisineIconWrapper}>
              {c.iconUrl ? (
                <Image
                  source={{ uri: c.iconUrl }}
                  style={styles.cuisineIcon}
                  contentFit="cover"
                />
              ) : (
                <MaterialIcons name="restaurant" size={20} color="#444" />
              )}
            </View>
            <Text style={styles.cuisineName} numberOfLines={1}>
              {c.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
};

/* -------------------------------------------------------------------------- */
/*  RESTAURANT TILE                                                           */
/* -------------------------------------------------------------------------- */

type RestaurantTileProps = {
  restaurant: Restaurant;
};

const RestaurantTile: React.FC<RestaurantTileProps> = ({ restaurant }) => {
  const nav = useNavigation<any>();
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      friction: 5,
      tension: 120,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 5,
      tension: 120,
    }).start();
  };

  const onPress = () => {
    nav.navigate("RestaurantDetails", { restaurantId: restaurant.id });
  };

  const {
    name,
    heroImageUrl,
    cuisines = [],
    rating,
    ratingCount,
    deliveryTimeMin,
    deliveryTimeMax,
    costForTwo,
    isPureVeg,
    offerText,
    distanceKm,
    isPromoted,
  } = restaurant;

  const etaLabel =
    deliveryTimeMin && deliveryTimeMax
      ? `${deliveryTimeMin}-${deliveryTimeMax} mins`
      : deliveryTimeMin
      ? `${deliveryTimeMin} mins`
      : "30-40 mins";

  const ratingLabel = rating != null ? rating.toFixed(1) : "NEW";

  const ratingCountLabel =
    ratingCount != null && ratingCount > 0 ? `(${ratingCount})` : "";

  const cuisinesLabel = cuisines.join(", ");
  const costLabel =
    costForTwo != null ? `₹${costForTwo} for two` : "Pocket friendly";

  const distanceLabel =
    distanceKm != null ? `${distanceKm.toFixed(1)} km` : "";

  return (
    <Animated.View
      style={[styles.restaurantCardWrap, { transform: [{ scale }] }]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={styles.restaurantCard}
      >
        <View style={styles.restaurantImageWrapper}>
          {heroImageUrl ? (
            <Image
              source={{ uri: heroImageUrl }}
              style={styles.restaurantImage}
              contentFit="cover"
              cachePolicy="disk"
              transition={160}
            />
          ) : (
            <View
              style={[
                styles.restaurantImage,
                styles.restaurantImagePlaceholder,
              ]}
            >
              <MaterialIcons name="restaurant-menu" size={40} color="#ccc" />
            </View>
          )}

          {/* Top labels */}
          <View style={styles.restaurantTopLabels}>
            {isPromoted && (
              <View style={styles.promotedTag}>
                <Text style={styles.promotedTagTxt}>PROMOTED</Text>
              </View>
            )}
            {isPureVeg && (
              <View style={styles.vegTag}>
                <Text style={styles.vegTagTxt}>PURE VEG</Text>
              </View>
            )}
          </View>

          {/* Offer ribbon */}
          {!!offerText && (
            <View style={styles.offerRibbon}>
              <MaterialIcons
                name="local-offer"
                size={14}
                color="#fff"
                style={{ marginRight: 4 }}
              />
              <Text numberOfLines={1} style={styles.offerRibbonTxt}>
                {offerText}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.restaurantInfoBlock}>
          <View style={styles.restaurantRowTop}>
            <Text style={styles.restaurantName} numberOfLines={1}>
              {name}
            </Text>
          </View>

          <View style={styles.ratingEtaRow}>
            <View style={styles.ratingPill}>
              <MaterialIcons name="star" size={12} color="#fff" />
              <Text style={styles.ratingPillTxt}>{ratingLabel}</Text>
            </View>
            <View style={styles.dot} />
            <Text style={styles.ratingEtaTxt}>{etaLabel}</Text>
            {ratingCountLabel ? (
              <>
                <View style={styles.dot} />
                <Text style={styles.ratingEtaTxt}>{ratingCountLabel}</Text>
              </>
            ) : null}
          </View>

          <Text style={styles.cuisineLine} numberOfLines={1}>
            {cuisinesLabel || "Multi-cuisine · Himachali · North Indian"}
          </Text>

          <View style={styles.costDistanceRow}>
            <Text style={styles.costDistanceTxt}>{costLabel}</Text>
            {distanceLabel ? (
              <>
                <View style={styles.dot} />
                <Text style={styles.costDistanceTxt}>{distanceLabel}</Text>
              </>
            ) : null}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
};

/* -------------------------------------------------------------------------- */
/*  MAIN SCREEN                                                               */
/* -------------------------------------------------------------------------- */

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

export default function NinjaEatsHomeScreen() {
  const nav = useNavigation<any>();
  const { location } = useLocationContext();

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [cuisines, setCuisines] = useState<Cuisine[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeVerticalMode, setActiveVerticalMode] =
    useState<"grocery" | "restaurants">("restaurants");
  const [activeFilter, setActiveFilter] = useState<QuickFilterKey | null>(null);

  // Permission-based location prompt logic - Show immediately on load
  const [hasPerm, setHasPerm] = useState<boolean | null>(null);
  const [selectManually, setSelectManually] = useState(false);
  // Show prompt immediately unless user already has a location set
  const [showLocationPrompt, setShowLocationPrompt] = useState(
    !location.lat && !location.lng && !location.address
  );

  // Check location permissions on mount but don't hide prompt based on permissions
  useEffect(() => {
    console.log('[NinjaEats] Checking location permissions...');
    Location.getForegroundPermissionsAsync().then((r) => {
      console.log('[NinjaEats] Permission status:', r.status);
      const hasPermission = r.status === "granted";
      setHasPerm(hasPermission);
      // Don't automatically hide the prompt - let user choose
    }).catch((error) => {
      console.error('[NinjaEats] Error checking permissions:', error);
      setHasPerm(false);
    });
  }, []);

  // Hide prompt if user already has location
  useEffect(() => {
    if (location.lat && location.lng) {
      console.log('[NinjaEats] User has location, hiding prompt');
      setShowLocationPrompt(false);
    }
  }, [location.lat, location.lng]);

  // Debug log for render condition
  useEffect(() => {
    console.log('[NinjaEats] Render state:', {
      hasPerm,
      selectManually,
      showLocationPrompt,
      shouldShowPrompt: showLocationPrompt,
      location: {
        lat: location.lat,
        lng: location.lng,
        address: location.address,
        cityId: location.cityId
      }
    });
  }, [hasPerm, selectManually, showLocationPrompt, location]);

  // Ensure we stay on NinjaEats screen when returning from location selection
  useFocusEffect(
    React.useCallback(() => {
      console.log('[NinjaEats] Screen focused - ensuring we stay on restaurants');
      // Force the vertical switcher to show restaurants mode
      setActiveVerticalMode("restaurants");
      
      // If user is returning from location selection, hide the prompt
      if (selectManually) {
        setShowLocationPrompt(false);
      }
      
      return () => {
        // Cleanup if needed
      };
    }, [selectManually])
  );

  const scrollY = useRef(new Animated.Value(0)).current;

  const headerHeight = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [INITIAL_HEADER_HEIGHT, COLLAPSED_HEADER_HEIGHT],
    extrapolate: "clamp",
  });

  const headerPaddingTop = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [INITIAL_PADDING_TOP, COLLAPSED_PADDING_TOP],
    extrapolate: "clamp",
  });

  const videoOpacity = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [1, 0.2],
    extrapolate: "clamp",
  });

  /* ---------------------------- Firestore fetches --------------------------- */

  // Restaurants – city-aware
  useEffect(() => {
    // DEV fallback: if cityId not set yet, default to Dharamshala so you see data
    const effectiveCityId = location.cityId || "dharamshala";

    console.log('[NinjaEats] Fetching restaurants for cityId:', effectiveCityId);
    console.log('[NinjaEats] Current location:', location);

    if (!effectiveCityId) {
      setRestaurants([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsub = firestore()
      .collection("restaurants")
      .where("isActive", "==", true)
      .where("cityId", "==", effectiveCityId)
      .onSnapshot(
        (snap) => {
          const list: Restaurant[] = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          }));
          console.log('[NinjaEats] Loaded restaurants:', list.length);
          setRestaurants(list);
          setLoading(false);
          setError(null);
        },
        (e) => {
          console.warn("[NinjaEats] restaurants error", e);
          setError("Could not load restaurants.");
          setLoading(false);
        }
      );

    return () => unsub();
  }, [location.cityId]);

  // Cuisines – global (later can filter by city if you want city-specific cuisines)
  useEffect(() => {
    const unsub = firestore()
      .collection("cuisines")
      .orderBy("priority", "asc")
      .onSnapshot(
        (snap) => {
          const list: Cuisine[] = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          }));
          setCuisines(list);
        },
        (e) => {
          console.warn("[NinjaEats] cuisines error", e);
        }
      );
    return () => unsub();
  }, []);

  /* ---------------------------- Derived groupings --------------------------- */

  const topRated = useMemo(
    () =>
      [...restaurants]
        .filter((r) => (r.rating ?? 0) >= 4)
        .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
        .slice(0, 10),
    [restaurants]
  );

  const fastDelivery = useMemo(
    () =>
      restaurants
        .filter((r) => (r.deliveryTimeMin ?? 999) <= 30)
        .slice(0, 10),
    [restaurants]
  );

  const budgetFriendly = useMemo(
    () =>
      restaurants
        .filter((r) => (r.costForTwo ?? 999) <= 300)
        .slice(0, 10),
    [restaurants]
  );

  const filteredRestaurants = useMemo(() => {
    let list = [...restaurants];

    if (activeFilter === "veg") {
      list = list.filter((r) => r.isPureVeg);
    } else if (activeFilter === "fast") {
      list = list.filter((r) => (r.deliveryTimeMin ?? 999) <= 30);
    } else if (activeFilter === "rating") {
      list = list.filter((r) => (r.rating ?? 0) >= 4.0);
    } else if (activeFilter === "offers") {
      list = list.filter((r) => !!r.offerText);
    }

    return list;
  }, [restaurants, activeFilter]);

  /* --------------------------- Switcher interactions ------------------------ */

const handleModeChange = useCallback((mode: "grocery" | "restaurants") => {
  if (mode === "grocery") {
    // Start performance monitoring
    PerformanceMonitor.startTimer("restaurants-to-grocery");
    
    // Immediate visual feedback - update state first
    setActiveVerticalMode(mode);
    
    // Use requestAnimationFrame for smoother transition with longer delay for loader visibility
    requestAnimationFrame(() => {
      setTimeout(() => {
        nav.replace("AppTabs", {
          screen: "HomeTab",
          params: { screen: "ProductsHome" }
        });
        
        // End performance monitoring after navigation
        setTimeout(() => {
          PerformanceMonitor.endTimer("restaurants-to-grocery");
        }, 100);
      }, 200); // Increased delay to ensure loader is visible
    });
  }
  // For restaurants mode, we're already here, so just update the state
  setActiveVerticalMode(mode);
}, [nav]);




  /* ------------------------------ List header ------------------------------- */

  const listHeader = useMemo(() => (
    <>
      <QuickFiltersRow
        activeFilter={activeFilter}
        onChange={setActiveFilter}
      />

      <CuisinesRow cuisines={cuisines} />

      {topRated.length > 0 && (
        <View style={{ marginTop: 18 }}>
          <View style={styles.carouselHeaderRow}>
            <Text style={styles.sectionTitle}>Top rated near you</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselContainer}
          >
            {topRated.map((r) => (
              <View key={r.id} style={styles.carouselCardWrapper}>
                <RestaurantTile restaurant={r} />
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {fastDelivery.length > 0 && (
        <View style={{ marginTop: 18 }}>
          <View style={styles.carouselHeaderRow}>
            <Text style={styles.sectionTitle}>Lightning-fast delivery</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselContainer}
          >
            {fastDelivery.map((r) => (
              <View key={r.id} style={styles.carouselCardWrapper}>
                <RestaurantTile restaurant={r} />
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {budgetFriendly.length > 0 && (
        <View style={{ marginTop: 18 }}>
          <View style={styles.carouselHeaderRow}>
            <Text style={styles.sectionTitle}>Budget-friendly eats</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselContainer}
          >
            {budgetFriendly.map((r) => (
              <View key={r.id} style={styles.carouselCardWrapper}>
                <RestaurantTile restaurant={r} />
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
        All restaurants around you
      </Text>
    </>
  ), [activeFilter, setActiveFilter, cuisines, topRated, fastDelivery, budgetFriendly]);

  // Memoize the render item function for better performance
  const renderRestaurantItem = useCallback(({ item }: { item: Restaurant }) => (
    <RestaurantTile restaurant={item} />
  ), []);

  /* ------------------------------ Loading / UI ------------------------------ */

  if (loading && !restaurants.length) {
    return (
      <View style={[styles.center, { flex: 1 }]}>
        <Loader />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#fdfdfd" }}>
      {/* Static header with video background */}
      <View style={styles.staticHeaderWrapper}>
        {/* Background video */}
        <View style={styles.staticVideoContainer}>
          <Video
            source={require("../assets/deliveryBackground.mp4")}
            style={StyleSheet.absoluteFill}
            muted
            repeat
            resizeMode="cover"
            rate={1.0}
            ignoreSilentSwitch="obey"
          />
        </View>

        {/* Gradient overlay */}
        <LinearGradient
          colors={["rgba(0,0,0,0.7)", "rgba(0,0,0,0.25)", "transparent"]}
          style={StyleSheet.absoluteFill}
        />

        {/* Static content */}
        <View style={styles.staticContentContainer}>
          {/* Location row */}
          <Header />

          {/* Search bar */}
          <View style={styles.staticSearchRow}>
            <RotatingRestaurantSearchBar />
          </View>

          {/* Vertical switcher below search */}
          <View style={styles.staticSwitcherRow}>
            <VerticalSwitcher
              active={activeVerticalMode}
              onChange={handleModeChange}
            />
          </View>
        </View>
      </View>

      {/* Main feed */}
      {error && <Text style={styles.errorTxt}>{error}</Text>}

      {hasPerm !== false || selectManually ? (
        <FlatList
          data={filteredRestaurants}
          keyExtractor={(item: Restaurant) => item.id}
          renderItem={renderRestaurantItem}
          ListHeaderComponent={listHeader}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: 16, // Just basic padding since header is now static
            paddingBottom: 32,
          }}
          // Performance optimizations
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={10}
          initialNumToRender={8}
          getItemLayout={(data, index) => ({
            length: 200, // Approximate item height
            offset: 200 * index,
            index,
          })}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No restaurants found</Text>
                <Text style={styles.emptySubtitle}>
                  Try changing filters or updating your location.
                </Text>
              </View>
            ) : (
              <View style={[styles.center, { flex: 1 }]}>
                <Loader />
              </View>
            )
          }
        />
      ) : (
        <View style={{ flex: 1 }} />
      )}

      {/* Location Prompt Card - Show immediately on load */}
      {showLocationPrompt && (
        <>
          {/* Overlay background */}
          <View style={styles.locationPromptOverlay} />
          <LocationPromptCard
            setHasPerm={setHasPerm}
            setSelectManually={setSelectManually}
            setShowLocationPrompt={setShowLocationPrompt}
          />
        </>
      )}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  STYLES                                                                    */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  center: { justifyContent: "center", alignItems: "center" },

  staticHeaderWrapper: {
    height: 180, // Reduced height for smaller video + content
    position: "relative",
    zIndex: 999,
    elevation: 20,
  },

  staticVideoContainer: {
    ...StyleSheet.absoluteFillObject,
    height: 180, // Matching reduced height
  },

  staticContentContainer: {
    flex: 1,
    paddingTop: Platform.OS === "ios" ? 52 : 40,
    paddingHorizontal: H,
    paddingBottom: 16,
    position: "relative",
    zIndex: 1,
  },

  staticSwitcherRow: {
    alignSelf: "flex-start",
    marginTop: 12, // Space below search bar
  },

  staticSearchRow: {
    marginTop: 10,
  },

  headerWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    elevation: 20,
  },
  topBg: {
    paddingHorizontal: H,
    paddingBottom: 16,
    backgroundColor: "transparent",
  },

  searchContainer: {
  height: 55,              // 👈 fixed height like Grocery
  justifyContent: "center",
  marginTop: 6,
},

verticalSwitcherRow: {
  position: "absolute",
  top: Platform.OS === "ios" ? 104 : 92, // below location + search
  left: 18,          // 👈 move to LEFT
  zIndex: 1000,
},

  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  locationTxt: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },

  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fafafa",
    borderRadius: 22,
    paddingVertical: 8,
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  searchTxt: {
    flex: 1,
    color: "#555",
    fontSize: 14,
  },
  searchRightChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: "#eee",
  },
  searchRightTxt: {
    fontSize: 11,
    color: "#555",
    marginLeft: 4,
  },

  errorTxt: {
    color: "#c62828",
    textAlign: "center",
    marginTop: 20,
  },

  /* Quick filters */
  quickFiltersContainer: {
    paddingHorizontal: H,
    paddingTop: 8,
    paddingBottom: 4,
  },
  quickFilterChip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ddd",
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    backgroundColor: "#fff",
  },
  quickFilterChipActive: {
    backgroundColor: NINJA_ACCENT,
    borderColor: NINJA_ACCENT,
  },
  quickFilterTxt: {
    fontSize: 12,
    color: "#444",
    marginLeft: 4,
    fontWeight: "600",
  },
  quickFilterTxtActive: {
    color: "#fff",
  },

  /* Cuisines */
  cuisinesContainer: {
    paddingHorizontal: H,
    paddingBottom: 4,
    paddingTop: 6,
  },
  cuisinePill: {
    width: 80,
    alignItems: "center",
    marginRight: 12,
  },
  cuisineIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eee",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cuisineIcon: {
    width: "100%",
    height: "100%",
    borderRadius: 32,
  },
  cuisineName: {
    fontSize: 11,
    color: "#444",
    textAlign: "center",
  },

  sectionTitle: {
    marginHorizontal: H,
    marginBottom: 6,
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
  },

  /* carousels */
  carouselHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: H,
  },
  carouselContainer: {
    paddingHorizontal: H,
    paddingBottom: 4,
  },
  carouselCardWrapper: {
    width: width * 0.75,
    marginRight: 12,
  },

  /* Restaurant cards */
  restaurantCardWrap: {
    marginHorizontal: H,
    marginTop: 12,
  },
  restaurantCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  restaurantImageWrapper: {
    position: "relative",
  },
  restaurantImage: {
    width: "100%",
    height: 170,
    backgroundColor: "#f5f5f5",
  },
  restaurantImagePlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  restaurantTopLabels: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    gap: 6,
  },
  promotedTag: {
    backgroundColor: "rgba(0,0,0,0.75)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  promotedTagTxt: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  vegTag: {
    backgroundColor: "#e8f5e9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  vegTagTxt: {
    color: "#2e7d32",
    fontSize: 10,
    fontWeight: "700",
  },
  offerRibbon: {
    position: "absolute",
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  offerRibbonTxt: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },

  restaurantInfoBlock: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
  },
  restaurantRowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  restaurantName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: "#222",
  },

  ratingEtaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1b5e20",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ratingPillTxt: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    marginLeft: 3,
  },
  ratingEtaTxt: {
    fontSize: 11,
    color: "#555",
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#777",
    marginHorizontal: 5,
  },

  cuisineLine: {
    marginTop: 4,
    fontSize: 12,
    color: "#777",
  },
  costDistanceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  costDistanceTxt: {
    fontSize: 12,
    color: "#555",
  },

  /* Empty state */
  emptyState: {
    alignItems: "center",
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#777",
    textAlign: "center",
    paddingHorizontal: 32,
  },
  searchSwitcherRow: {
  flexDirection: "row",
  alignItems: "center",
  marginTop: 20,
},

searchFlex: {
  flex: 1,              // 👈 search takes remaining space
  marginRight: 40,       // 👈 gap between search & switcher
},

/* Location Prompt Card */
locationPromptOverlay: {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.5)",
  zIndex: 9998,
},
locationPromptSheet: {
  position: "absolute",
  top: "50%",
  left: 20,
  right: 20,
  transform: [{ translateY: -150 }], // Adjust this value to center properly
  backgroundColor: "#fff",
  borderRadius: 24,
  padding: 20,
  shadowColor: "#000",
  shadowOpacity: 0.25,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 15,
  zIndex: 9999, // Ensure it's on top
},
locationPromptHandle: {
  alignSelf: "center",
  width: 40,
  height: 4,
  borderRadius: 2,
  backgroundColor: "#ccc",
  marginBottom: 12,
},
locationPromptHeader: { 
  flexDirection: "row", 
  alignItems: "center", 
  marginBottom: 8 
},
locationPromptTitle: { 
  fontSize: 18, 
  fontWeight: "700", 
  color: "#333", 
  marginLeft: 6 
},
locationPromptSubtitle: { 
  fontSize: 14, 
  color: "#555", 
  lineHeight: 20, 
  marginBottom: 20 
},
locationPromptBtn: {
  paddingVertical: 14,
  borderRadius: 26,
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 10,
},
locationPromptBtnPrimary: { 
  backgroundColor: "#00b4a0" 
},
locationPromptBtnSecondary: { 
  backgroundColor: "#e0f2f1" 
},
locationPromptBtnTxtPrimary: { 
  color: "#fff", 
  fontSize: 16, 
  fontWeight: "700" 
},
locationPromptBtnTxtSecondary: { 
  color: "#00796b", 
  fontSize: 16, 
  fontWeight: "700" 
},

});
