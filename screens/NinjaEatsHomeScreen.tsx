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
import { MaterialIcons } from "@expo/vector-icons";
import firestore from "@react-native-firebase/firestore";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Image } from "expo-image";
import { useLocationContext } from "@/context/LocationContext";
import { VerticalSwitcher } from "@/components/VerticalSwitcher";
import Loader from "@/components/VideoLoader";
import { PerformanceMonitor } from "@/utils/PerformanceMonitor";
import * as Location from "expo-location";

// Helper function to validate image URL
const isValidImageUrl = (url: string): boolean => {
  if (!url || typeof url !== 'string') return false;
  
  // Check if it's a valid URL format
  try {
    new URL(url);
  } catch {
    return false;
  }
  
  // Check if it's likely an image (not SVG which causes issues)
  const lowercaseUrl = url.toLowerCase();
  const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  const hasValidExtension = validExtensions.some(ext => lowercaseUrl.includes(ext));
  const isSvg = lowercaseUrl.includes('.svg') || lowercaseUrl.includes('svg');
  
  // Allow if it has valid extension or if it's from a known image service (even without extension)
  const isImageService = lowercaseUrl.includes('unsplash.com') || 
                         lowercaseUrl.includes('cloudinary.com') || 
                         lowercaseUrl.includes('firebase') ||
                         lowercaseUrl.includes('googleapis.com');
  
  return !isSvg && (hasValidExtension || isImageService);
};

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
  imageurl?: string; // Match Firebase field name
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

const CuisinesRow: React.FC<{ cuisines: Cuisine[]; failedImages: Set<string>; setFailedImages: React.Dispatch<React.SetStateAction<Set<string>>> }> = ({ cuisines, failedImages, setFailedImages }) => {
  const nav = useNavigation<any>();
  const scrollViewRef = useRef<ScrollView>(null);
  const currentIndex = useRef(0);
  const animationRef = useRef<any>(null);
  const isUserInteracting = useRef(false);

  // Create triple duplicated content for infinite scroll
  const triplicatedCuisines = [...cuisines, ...cuisines, ...cuisines];

  // Pause-then-switch carousel effect
  useEffect(() => {
    if (!cuisines.length) return; // Early return inside useEffect is fine
    
    const itemWidth = 140; // Updated width for new design
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

  // Return null if no cuisines after all hooks have been called
  if (!cuisines.length) return null;

  return (
    <View style={{ marginTop: 12, marginBottom: 8 }}>
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
            const itemWidth = 140;
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
          const itemWidth = 140;
          const scrollX = event.nativeEvent.contentOffset.x;
          currentIndex.current = Math.round(scrollX / itemWidth);
        }}
      >
        {triplicatedCuisines.map((c, index) => {
          const shouldShowImage = c.imageurl && 
                                 isValidImageUrl(c.imageurl) && 
                                 !failedImages.has(c.imageurl);
          
          return (
            <Pressable
              key={`${c.id}-${index}`}
              style={styles.cuisineTile}
              onPress={() =>
                nav.navigate("CuisineDetail", {
                  cuisineId: c.id,
                  cuisineName: c.name,
                  cuisineImage: c.imageurl,
                })
              }
            >
              {shouldShowImage ? (
                <Image
                  source={{ uri: c.imageurl }}
                  style={styles.cuisineTileImage}
                  contentFit="cover"
                  onError={() => {
                    console.error('[NinjaEats] Failed to load image for:', c.name, 'URL:', c.imageurl);
                    // Add to failed images set to show placeholder next time
                    setFailedImages((prev: Set<string>) => new Set(prev).add(c.imageurl!));
                  }}
                />
              ) : (
                <View style={[styles.cuisineTileImage, styles.cuisineTilePlaceholder]}>
                  <MaterialIcons name="restaurant" size={32} color="#999" />
                </View>
              )}
              <Text style={styles.cuisineTileName} numberOfLines={2}>
                {c.name}
              </Text>
            </Pressable>
          );
        })}
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
      toValue: 0.98,
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
              <MaterialIcons name="restaurant-menu" size={48} color="#ddd" />
            </View>
          )}

          {/* Gradient overlay on image */}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.1)"]}
            style={styles.restaurantImageGradient}
          />

          {/* Top badges */}
          <View style={styles.restaurantTopBadges}>
            {isPromoted && (
              <View style={styles.promotedBadge}>
                <MaterialIcons name="star" size={10} color="#ffd700" />
                <Text style={styles.promotedBadgeTxt}>PROMOTED</Text>
              </View>
            )}
          </View>

          {/* Offer banner at bottom of image */}
          {!!offerText && (
            <View style={styles.offerBanner}>
              <MaterialIcons
                name="local-offer"
                size={12}
                color="#ff6b35"
                style={{ marginRight: 4 }}
              />
              <Text numberOfLines={1} style={styles.offerBannerTxt}>
                {offerText}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.restaurantInfo}>
          {/* Restaurant name and veg badge */}
          <View style={styles.restaurantNameRow}>
            <Text style={styles.restaurantName} numberOfLines={1}>
              {name}
            </Text>
            {isPureVeg && (
              <View style={styles.vegBadge}>
                <View style={styles.vegDot} />
              </View>
            )}
          </View>

          {/* Rating, time, cost */}
          <View style={styles.restaurantMetaRow}>
            <View style={styles.ratingBadge}>
              <MaterialIcons name="star" size={13} color="#fff" />
              <Text style={styles.ratingBadgeTxt}>{ratingLabel}</Text>
            </View>
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.metaTxt}>{etaLabel}</Text>
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.metaTxt}>{costLabel}</Text>
          </View>

          {/* Cuisines */}
          <Text style={styles.cuisinesText} numberOfLines={1}>
            {cuisinesLabel || "Multi-cuisine"}
          </Text>

          {/* Distance */}
          {distanceLabel && (
            <View style={styles.distanceRow}>
              <MaterialIcons name="location-on" size={12} color="#999" />
              <Text style={styles.distanceTxt}>{distanceLabel}</Text>
            </View>
          )}
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
  const [cuisines, setCuisines] = useState<Cuisine[]>([]); // Fetch from Firebase
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set()); // Track failed image URLs
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
    Location.getForegroundPermissionsAsync().then((r) => {
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
      setShowLocationPrompt(false);
    }
  }, [location.lat, location.lng]);

  // Ensure we stay on NinjaEats screen when returning from location selection
  useFocusEffect(
    React.useCallback(() => {
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

  // Cuisines – Fetch from Firebase
  useEffect(() => {
    const unsub = firestore()
      .collection("cuisines")
      .orderBy("priority", "asc")
      .onSnapshot(
        (snap) => {
          const list: Cuisine[] = snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              ...(data as any),
            };
          });
          setCuisines(list);
        },
        (e) => {
          console.warn("[NinjaEats] cuisines error", e);
          // No fallback data - show empty state
          setCuisines([]);
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

      <CuisinesRow cuisines={cuisines} failedImages={failedImages} setFailedImages={setFailedImages} />

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
      {/* Static header with gradient background */}
      <View style={styles.staticHeaderWrapper}>
        {/* Orange to White Gradient Background */}
        <LinearGradient
          colors={["#ff6b35", "#ff8c42", "#ffa552", "#ffb366", "#ffffff"]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
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
    height: 180, // Reduced height for smaller content
    position: "relative",
    zIndex: 999,
    elevation: 20,
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

  /* Cuisines - Swiggy Style */
  cuisinesContainer: {
    paddingHorizontal: H,
    paddingBottom: 8,
    paddingTop: 8,
  },
  cuisineTile: {
    width: 130,
    marginRight: 16,
    alignItems: "center",
  },
  cuisineTileImage: {
    width: 130,
    height: 150,
    borderRadius: 16,
    backgroundColor: "#f5f5f5",
    marginBottom: 8,
  },
  cuisineTilePlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  cuisineTileName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    textAlign: "center",
    lineHeight: 18,
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

  /* Restaurant cards - Swiggy Style */
  restaurantCardWrap: {
    marginHorizontal: H,
    marginBottom: 20,
  },
  restaurantCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  restaurantImageWrapper: {
    position: "relative",
    width: "100%",
    height: 180,
  },
  restaurantImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#f8f8f8",
  },
  restaurantImagePlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  restaurantImageGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  restaurantTopBadges: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    gap: 6,
  },
  promotedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 3,
  },
  promotedBadgeTxt: {
    color: "#333",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  offerBanner: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,107,53,0.1)",
  },
  offerBannerTxt: {
    color: "#ff6b35",
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
  },

  restaurantInfo: {
    padding: 12,
  },
  restaurantNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  restaurantName: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: "#1c1c1c",
    letterSpacing: -0.3,
  },
  vegBadge: {
    width: 18,
    height: 18,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: "#0f8a65",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 6,
  },
  vegDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#0f8a65",
  },

  restaurantMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1c8a5c",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 2,
  },
  ratingBadgeTxt: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  metaDot: {
    color: "#999",
    fontSize: 14,
    marginHorizontal: 6,
    fontWeight: "700",
  },
  metaTxt: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
  },

  cuisinesText: {
    fontSize: 13,
    color: "#888",
    marginBottom: 4,
    lineHeight: 18,
  },

  distanceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  distanceTxt: {
    fontSize: 12,
    color: "#999",
    marginLeft: 2,
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
