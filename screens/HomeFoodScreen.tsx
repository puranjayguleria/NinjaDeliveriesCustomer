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

const INITIAL_HEADER_HEIGHT = 180;
const COLLAPSED_HEADER_HEIGHT = 120;

const INITIAL_PADDING_TOP = Platform.OS === "ios" ? 52 : 40;
const COLLAPSED_PADDING_TOP = Platform.OS === "ios" ? 40 : 30;

const NINJA_ACCENT = "#00b4a0";

const HOME_FOOD_SEARCH_PH = [
  "homemade dal",
  "fresh rotis",
  "mom's special curry",
  "home-style biryani",
  "traditional thali",
  "fresh parathas",
];

/* -------------------------------------------------------------------------- */
/*  TYPES                                                                     */
/* -------------------------------------------------------------------------- */

type HomeCook = {
  id: string;
  name: string;
  profileImageUrl?: string;
  specialties?: string[];
  rating?: number;
  ratingCount?: number;
  deliveryTimeMin?: number;
  deliveryTimeMax?: number;
  avgCostPerMeal?: number;
  isVerified?: boolean;
  description?: string;
  distanceKm?: number;
  isActive?: boolean;
  cityId?: string;
  kitchenType?: "home" | "cloud";
  certifications?: string[];
};

type HomeMeal = {
  id: string;
  name: string;
  imageUrl?: string;
  cookId: string;
  cookName: string;
  price: number;
  description?: string;
  isVeg?: boolean;
  category?: string;
  preparationTime?: number;
  isAvailable?: boolean;
  rating?: number;
  tags?: string[];
};

type QuickFilterKey = "veg" | "fast" | "rating" | "verified" | "nearby";

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
          "Please allow location access to find home cooks near you."
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
        cityId: "dharamshala",
      });

      setHasPerm(true);
      setSelectManually(true);
      setShowLocationPrompt(false);
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
    setShowLocationPrompt(false);
    nav.navigate("LocationSelector", { fromScreen: "HomeFood" });
  };

  return (
    <View style={styles.locationPromptSheet}>
      <View style={styles.locationPromptHandle} />
      
      <View style={styles.locationPromptHeader}>
        <MaterialIcons name="kitchen" size={26} color="#00b4a0" />
        <Text style={styles.locationPromptTitle}>Find home cooks near you</Text>
      </View>
      
      <Text style={styles.locationPromptSubtitle}>
        Discover authentic home-cooked meals from verified local cooks
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
/*  HEADER COMPONENTS                                                         */
/* -------------------------------------------------------------------------- */

const Header = memo(() => {
  const { location } = useLocationContext();
  const nav = useNavigation<any>();

  return (
    <Pressable
      style={styles.locationRow}
      onPress={() =>
        nav.navigate("LocationSelector", { fromScreen: "HomeFood" })
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
          ? `Finding home cooks near ${location.address}`
          : "Set location to find home cooks"}
      </Text>
      <MaterialIcons name="keyboard-arrow-down" size={18} color="#fff" />
    </Pressable>
  );
});

const HomeFoodSearchBar = memo(({ ph }: { ph: string }) => {
  const nav = useNavigation<any>();

  return (
    <Pressable
      style={styles.searchWrapper}
      onPress={() => nav.navigate("HomeFoodSearch")}
    >
      <MaterialIcons
        name="search"
        size={20}
        color="#555"
        style={{ marginRight: 6 }}
      />
      <Text style={styles.searchTxt}>{`Search for ${ph}`}</Text>
      <View style={styles.searchRightChip}>
        <MaterialIcons name="kitchen" size={14} color="#555" />
        <Text style={styles.searchRightTxt}>Home meals & cooks</Text>
      </View>
    </Pressable>
  );
});

const RotatingHomeFoodSearchBar = () => {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIdx((prev) => (prev + 1) % HOME_FOOD_SEARCH_PH.length);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  return <HomeFoodSearchBar ph={HOME_FOOD_SEARCH_PH[idx]} />;
};

/* -------------------------------------------------------------------------- */
/*  FOOD CATEGORIES STRIP                                                     */
/* -------------------------------------------------------------------------- */

type FoodCategory = {
  id: string;
  name: string;
  iconUrl?: string;
  priority?: number;
};

const FoodCategoriesRow: React.FC<{ categories: FoodCategory[] }> = ({ categories }) => {
  const nav = useNavigation<any>();
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollX = useRef(0);
  const animationRef = useRef<NodeJS.Timeout>();

  if (!categories.length) return null;

  // Create triple duplicated content for smoother infinite scroll
  const triplicatedCategories = [...categories, ...categories, ...categories];

  // Smooth auto-scroll effect
  useEffect(() => {
    const itemWidth = 92; // 80px width + 12px margin
    const originalContentWidth = categories.length * itemWidth;
    
    const startScrolling = () => {
      animationRef.current = setInterval(() => {
        scrollX.current += 0.8; // Smooth scroll speed
        
        // Reset seamlessly when we reach the end of the first duplicate
        if (scrollX.current >= originalContentWidth) {
          scrollX.current = 0;
        }
        
        scrollViewRef.current?.scrollTo({ 
          x: scrollX.current, 
          animated: false 
        });
      }, 16); // 60fps for smooth animation
    };

    // Start scrolling after a small delay
    const timeout = setTimeout(startScrolling, 1000);

    return () => {
      clearTimeout(timeout);
      if (animationRef.current) {
        clearInterval(animationRef.current);
      }
    };
  }, [categories.length]);

  return (
    <View style={{ marginTop: 8 }}>
      <Text style={styles.sectionTitle}>What type of home food?</Text>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoriesContainer}
        scrollEventThrottle={16}
        onTouchStart={() => {
          // Pause auto-scroll when user touches
          if (animationRef.current) {
            clearInterval(animationRef.current);
          }
        }}
        onTouchEnd={() => {
          // Resume auto-scroll after user stops touching
          setTimeout(() => {
            const itemWidth = 92;
            const originalContentWidth = categories.length * itemWidth;
            
            animationRef.current = setInterval(() => {
              scrollX.current += 0.8;
              
              if (scrollX.current >= originalContentWidth) {
                scrollX.current = 0;
              }
              
              scrollViewRef.current?.scrollTo({ 
                x: scrollX.current, 
                animated: false 
              });
            }, 16);
          }, 2000); // Resume after 2 seconds
        }}
      >
        {triplicatedCategories.map((c, index) => (
          <Pressable
            key={`${c.id}-${index}`}
            style={styles.categoryPill}
            onPress={() =>
              nav.navigate("HomeFoodCategoryListing", {
                categoryId: c.id,
                categoryName: c.name,
              })
            }
          >
            <View style={styles.categoryIconWrapper}>
              {c.iconUrl ? (
                <Image
                  source={{ uri: c.iconUrl }}
                  style={styles.categoryIcon}
                  contentFit="cover"
                />
              ) : (
                <MaterialIcons name="kitchen" size={20} color="#444" />
              )}
            </View>
            <Text style={styles.categoryName} numberOfLines={1}>
              {c.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
};

/* -------------------------------------------------------------------------- */
/*  QUICK FILTERS                                                             */
/* -------------------------------------------------------------------------- */

const QUICK_FILTERS: { key: QuickFilterKey; label: string; icon: string }[] = [
  { key: "veg", label: "Veg only", icon: "eco" },
  { key: "fast", label: "Quick meals", icon: "bolt" },
  { key: "rating", label: "Top rated", icon: "star-rate" },
  { key: "verified", label: "Verified cooks", icon: "verified" },
  { key: "nearby", label: "Nearby", icon: "near-me" },
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

/* -------------------------------------------------------------------------- */
/*  HOME COOK TILE                                                            */
/* -------------------------------------------------------------------------- */

type HomeCookTileProps = {
  cook: HomeCook;
};

const HomeCookTile: React.FC<HomeCookTileProps> = ({ cook }) => {
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
    nav.navigate("HomeCookDetails", { cookId: cook.id });
  };

  const {
    name,
    profileImageUrl,
    specialties = [],
    rating,
    ratingCount,
    deliveryTimeMin,
    deliveryTimeMax,
    avgCostPerMeal,
    isVerified,
    description,
    distanceKm,
    kitchenType,
  } = cook;

  const etaLabel =
    deliveryTimeMin && deliveryTimeMax
      ? `${deliveryTimeMin}-${deliveryTimeMax} mins`
      : deliveryTimeMin
      ? `${deliveryTimeMin} mins`
      : "45-60 mins";

  const ratingLabel = rating != null ? rating.toFixed(1) : "NEW";
  const ratingCountLabel =
    ratingCount != null && ratingCount > 0 ? `(${ratingCount})` : "";

  const specialtiesLabel = specialties.join(", ");
  const costLabel =
    avgCostPerMeal != null ? `₹${avgCostPerMeal} avg per meal` : "Affordable";

  const distanceLabel =
    distanceKm != null ? `${distanceKm.toFixed(1)} km` : "";

  return (
    <Animated.View
      style={[styles.cookCardWrap, { transform: [{ scale }] }]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={styles.cookCard}
      >
        <View style={styles.cookImageWrapper}>
          {profileImageUrl ? (
            <Image
              source={{ uri: profileImageUrl }}
              style={styles.cookImage}
              contentFit="cover"
              cachePolicy="disk"
              transition={160}
            />
          ) : (
            <View style={[styles.cookImage, styles.cookImagePlaceholder]}>
              <MaterialIcons name="person" size={40} color="#ccc" />
            </View>
          )}

          {/* Top labels */}
          <View style={styles.cookTopLabels}>
            {isVerified && (
              <View style={styles.verifiedTag}>
                <MaterialIcons name="verified" size={12} color="#fff" />
                <Text style={styles.verifiedTagTxt}>VERIFIED</Text>
              </View>
            )}
            {kitchenType === "home" && (
              <View style={styles.homeKitchenTag}>
                <MaterialIcons name="home" size={12} color="#fff" />
                <Text style={styles.homeKitchenTagTxt}>HOME KITCHEN</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.cookInfoBlock}>
          <View style={styles.cookRowTop}>
            <Text style={styles.cookName} numberOfLines={1}>
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

          <Text style={styles.specialtiesLine} numberOfLines={1}>
            {specialtiesLabel || "North Indian · Home-style cooking"}
          </Text>

          {description && (
            <Text style={styles.descriptionLine} numberOfLines={2}>
              {description}
            </Text>
          )}

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
/*  AUTO SCROLL CAROUSEL COMPONENT                                            */
/* -------------------------------------------------------------------------- */

type AutoScrollCarouselProps<T> = {
  data: T[];
  renderItem: (item: T) => React.ReactNode;
};

const AutoScrollCarousel = <T extends { id: string }>({ 
  data, 
  renderItem 
}: AutoScrollCarouselProps<T>) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollX = useRef(0);
  const animationRef = useRef<NodeJS.Timeout>();

  // Create triple duplicated content for smoother infinite scroll
  const triplicatedData = [...data, ...data, ...data];

  // Smooth auto-scroll effect
  useEffect(() => {
    if (data.length <= 2) return; // Don't scroll if too few items

    const itemWidth = width * 0.75 + 12; // Card width + margin
    const originalContentWidth = data.length * itemWidth;
    
    const startScrolling = () => {
      animationRef.current = setInterval(() => {
        scrollX.current += 0.4; // Slower scroll speed for carousels
        
        // Reset seamlessly when we reach the end of the first duplicate
        if (scrollX.current >= originalContentWidth) {
          scrollX.current = 0;
        }
        
        scrollViewRef.current?.scrollTo({ 
          x: scrollX.current, 
          animated: false 
        });
      }, 16); // 60fps for smooth animation
    };

    // Start scrolling after a small delay
    const timeout = setTimeout(startScrolling, 1500);

    return () => {
      clearTimeout(timeout);
      if (animationRef.current) {
        clearInterval(animationRef.current);
      }
    };
  }, [data.length]);

  return (
    <ScrollView
      ref={scrollViewRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.carouselContainer}
      scrollEventThrottle={16}
      onTouchStart={() => {
        // Pause auto-scroll when user touches
        if (animationRef.current) {
          clearInterval(animationRef.current);
        }
      }}
      onTouchEnd={() => {
        // Resume auto-scroll after user stops touching
        setTimeout(() => {
          const itemWidth = width * 0.75 + 12;
          const originalContentWidth = data.length * itemWidth;
          
          animationRef.current = setInterval(() => {
            scrollX.current += 0.4;
            
            if (scrollX.current >= originalContentWidth) {
              scrollX.current = 0;
            }
            
            scrollViewRef.current?.scrollTo({ 
              x: scrollX.current, 
              animated: false 
            });
          }, 16);
        }, 3000); // Resume after 3 seconds
      }}
    >
      {triplicatedData.map((item, index) => (
        <React.Fragment key={`${item.id}-${index}`}>
          {renderItem(item)}
        </React.Fragment>
      ))}
    </ScrollView>
  );
};

/* -------------------------------------------------------------------------- */
/*  MAIN SCREEN                                                               */
/* -------------------------------------------------------------------------- */

export default function HomeFoodScreen() {
  const nav = useNavigation<any>();
  const { location } = useLocationContext();

  const [homeCooks, setHomeCooks] = useState<HomeCook[]>([]);
  const [foodCategories, setFoodCategories] = useState<FoodCategory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<QuickFilterKey | null>(null);

  // Permission-based location prompt logic
  const [hasPerm, setHasPerm] = useState<boolean | null>(null);
  const [selectManually, setSelectManually] = useState(false);
  const [showLocationPrompt, setShowLocationPrompt] = useState(
    !location.lat && !location.lng && !location.address
  );

  // Check location permissions on mount
  useEffect(() => {
    Location.getForegroundPermissionsAsync().then((r) => {
      const hasPermission = r.status === "granted";
      setHasPerm(hasPermission);
    }).catch((error) => {
      console.error('[HomeFood] Error checking permissions:', error);
      setHasPerm(false);
    });
  }, []);

  // Hide prompt if user already has location
  useEffect(() => {
    if (location.lat && location.lng) {
      setShowLocationPrompt(false);
    }
  }, [location.lat, location.lng]);

  // Fetch home cooks from Firestore
  useEffect(() => {
    const effectiveCityId = location.cityId || "dharamshala";

    if (!effectiveCityId) {
      setHomeCooks([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsub = firestore()
      .collection("homeCooks")
      .where("isActive", "==", true)
      .where("cityId", "==", effectiveCityId)
      .onSnapshot(
        (snap) => {
          const list: HomeCook[] = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          }));
          setHomeCooks(list);
          setLoading(false);
          setError(null);
        },
        (e) => {
          console.warn("[HomeFood] homeCooks error", e);
          setError("Could not load home cooks.");
          setLoading(false);
        }
      );

    return () => unsub();
  }, [location.cityId]);

  // Food Categories – global
  useEffect(() => {
    const unsub = firestore()
      .collection("foodCategories")
      .orderBy("priority", "asc")
      .onSnapshot(
        (snap) => {
          const list: FoodCategory[] = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          }));
          setFoodCategories(list);
        },
        (e) => {
          console.warn("[HomeFood] foodCategories error", e);
        }
      );
    return () => unsub();
  }, []);

  /* ---------------------------- Derived groupings --------------------------- */

  const topRated = useMemo(
    () =>
      [...homeCooks]
        .filter((c) => (c.rating ?? 0) >= 4.5)
        .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
        .slice(0, 10),
    [homeCooks]
  );

  const verified = useMemo(
    () => homeCooks.filter((c) => c.isVerified).slice(0, 10),
    [homeCooks]
  );

  const nearby = useMemo(
    () =>
      homeCooks
        .filter((c) => (c.distanceKm ?? 999) <= 5)
        .slice(0, 10),
    [homeCooks]
  );

  const filteredHomeCooks = useMemo(() => {
    let list = [...homeCooks];

    if (activeFilter === "veg") {
      list = list.filter((c) => c.specialties?.some(s => s.toLowerCase().includes('veg')));
    } else if (activeFilter === "fast") {
      list = list.filter((c) => (c.deliveryTimeMin ?? 999) <= 30);
    } else if (activeFilter === "rating") {
      list = list.filter((c) => (c.rating ?? 0) >= 4.0);
    } else if (activeFilter === "verified") {
      list = list.filter((c) => c.isVerified);
    } else if (activeFilter === "nearby") {
      list = list.filter((c) => (c.distanceKm ?? 999) <= 5);
    }

    return list;
  }, [homeCooks, activeFilter]);

  /* ------------------------------ List header ------------------------------- */

  const listHeader = useMemo(() => (
    <>
      <QuickFiltersRow
        activeFilter={activeFilter}
        onChange={setActiveFilter}
      />

      <FoodCategoriesRow categories={foodCategories} />

      {topRated.length > 0 && (
        <View style={{ marginTop: 18 }}>
          <View style={styles.carouselHeaderRow}>
            <Text style={styles.sectionTitle}>Top rated home cooks</Text>
          </View>
          <AutoScrollCarousel
            data={topRated}
            renderItem={(cook) => (
              <View style={styles.carouselCardWrapper}>
                <HomeCookTile cook={cook} />
              </View>
            )}
          />
        </View>
      )}

      {verified.length > 0 && (
        <View style={{ marginTop: 18 }}>
          <View style={styles.carouselHeaderRow}>
            <Text style={styles.sectionTitle}>Verified home cooks</Text>
          </View>
          <AutoScrollCarousel
            data={verified}
            renderItem={(cook) => (
              <View style={styles.carouselCardWrapper}>
                <HomeCookTile cook={cook} />
              </View>
            )}
          />
        </View>
      )}

      {nearby.length > 0 && (
        <View style={{ marginTop: 18 }}>
          <View style={styles.carouselHeaderRow}>
            <Text style={styles.sectionTitle}>Home cooks near you</Text>
          </View>
          <AutoScrollCarousel
            data={nearby}
            renderItem={(cook) => (
              <View style={styles.carouselCardWrapper}>
                <HomeCookTile cook={cook} />
              </View>
            )}
          />
        </View>
      )}

      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>
        All home cooks in your area
      </Text>
    </>
  ), [activeFilter, setActiveFilter, topRated, verified, nearby]);

  // Memoize the render item function for better performance
  const renderHomeCookItem = useCallback(({ item }: { item: HomeCook }) => (
    <HomeCookTile cook={item} />
  ), []);

  /* ------------------------------ Loading / UI ------------------------------ */

  if (loading && !homeCooks.length) {
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
            <RotatingHomeFoodSearchBar />
          </View>
        </View>
      </View>

      {/* Main feed */}
      {error && <Text style={styles.errorTxt}>{error}</Text>}

      {hasPerm !== false || selectManually ? (
        <FlatList
          data={filteredHomeCooks}
          keyExtractor={(item: HomeCook) => item.id}
          renderItem={renderHomeCookItem}
          ListHeaderComponent={listHeader}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: 16,
            paddingBottom: 100, // Extra padding for bottom tab
          }}
          // Performance optimizations
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={10}
          initialNumToRender={8}
          getItemLayout={(data, index) => ({
            length: 220, // Approximate item height
            offset: 220 * index,
            index,
          })}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyState}>
                <MaterialIcons name="kitchen" size={48} color="#ccc" />
                <Text style={styles.emptyTitle}>No home cooks found</Text>
                <Text style={styles.emptySubtitle}>
                  Try changing filters or updating your location to find home cooks near you.
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

      {/* Location Prompt Card */}
      {showLocationPrompt && (
        <>
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
    height: 180,
    position: "relative",
    zIndex: 999,
    elevation: 20,
  },

  staticVideoContainer: {
    ...StyleSheet.absoluteFillObject,
    height: 180,
  },

  staticContentContainer: {
    flex: 1,
    paddingTop: Platform.OS === "ios" ? 52 : 40,
    paddingHorizontal: H,
    paddingBottom: 16,
    position: "relative",
    zIndex: 1,
  },

  staticSearchRow: {
    marginTop: 10,
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

  /* Food categories */
  categoriesContainer: {
    paddingHorizontal: H,
    paddingBottom: 4,
    paddingTop: 6,
  },
  categoryPill: {
    width: 80,
    alignItems: "center",
    marginRight: 12,
  },
  categoryIconWrapper: {
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
  categoryIcon: {
    width: "100%",
    height: "100%",
    borderRadius: 32,
  },
  categoryName: {
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

  /* Home Cook cards */
  cookCardWrap: {
    marginHorizontal: H,
    marginTop: 12,
  },
  cookCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cookImageWrapper: {
    position: "relative",
  },
  cookImage: {
    width: "100%",
    height: 170,
    backgroundColor: "#f5f5f5",
  },
  cookImagePlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  cookTopLabels: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    gap: 6,
  },
  verifiedTag: {
    backgroundColor: "#4caf50",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  verifiedTagTxt: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    marginLeft: 2,
  },
  homeKitchenTag: {
    backgroundColor: "#ff9800",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  homeKitchenTagTxt: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    marginLeft: 2,
  },

  cookInfoBlock: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
  },
  cookRowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cookName: {
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

  specialtiesLine: {
    marginTop: 4,
    fontSize: 12,
    color: "#777",
  },
  descriptionLine: {
    marginTop: 4,
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
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
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginBottom: 4,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#777",
    textAlign: "center",
    lineHeight: 18,
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
    transform: [{ translateY: -150 }],
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 15,
    zIndex: 9999,
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