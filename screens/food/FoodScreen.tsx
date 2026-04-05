import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  FlatList, ActivityIndicator, StatusBar, ImageBackground, Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";
import { useLocationContext } from "@/context/LocationContext";
import { useToggleContext } from "@/context/ToggleContext";
import ModeToggle from "@/components/ModeToggle";
import {
  listenActiveRestaurants,
  listenFoodCategoriesWithItems,
  type Restaurant,
  type FoodCategory as Category,
} from "@/firebase/foodFirebase";
import DishModal from "@/components/food/DishModal";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ORANGE = "#FC8019";
const DARK   = "#282C3F";
const GRAY   = "#93959F";
const GREEN  = "#3d9b6d";

const FILTER_CHIPS = [
  { id: "sort",     label: "Sort",          icon: true  },
  { id: "delivery", label: "Delivery Time", icon: false },
  { id: "rating",   label: "Rating 4.0+",   icon: false },
  { id: "veg",      label: "Pure Veg",       icon: false },
  { id: "offers",   label: "Offers",         icon: false },
  { id: "price",    label: "Rs.300-Rs.600",  icon: false },
];

// Global flag to track if modal has been shown in current food session
let hasShownModalInFoodSession = false;
// Track the last mode to detect actual mode switches
let lastKnownMode: string | null = null;

export default function FoodScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { location } = useLocationContext();
  const { activeMode, setActiveMode } = useToggleContext();

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [isVegMode, setIsVegMode] = useState(true);
  const [dishModal, setDishModal] = useState<{
    visible: boolean;
    restaurantId: string;
    restaurantName: string;
    filterCategoryId?: string | null;
  }>({ visible: false, restaurantId: "", restaurantName: "" });

  // Detect actual mode switches (not just component remounts)
  useEffect(() => {
    console.log('[FoodScreen] Component mounted/updated');
    console.log('[FoodScreen] activeMode:', activeMode);
    console.log('[FoodScreen] lastKnownMode:', lastKnownMode);
    console.log('[FoodScreen] hasShownModalInFoodSession:', hasShownModalInFoodSession);
    
    // Check if we actually switched TO food mode from a different mode
    const justSwitchedToFood = lastKnownMode !== null && lastKnownMode !== 'food' && activeMode === 'food';
    
    if (justSwitchedToFood) {
      console.log('[FoodScreen] Just switched to food mode from', lastKnownMode);
      // Reset the flag when actually switching to food mode
      hasShownModalInFoodSession = false;
    }
    
    // Update last known mode
    lastKnownMode = activeMode;
  }, [activeMode]);

  // Initial data load
  useEffect(() => {
    console.log('[FoodScreen] Data load effect running');
    console.log('[FoodScreen] hasShownModalInFoodSession:', hasShownModalInFoodSession);
    
    // Show modal only if we haven't shown it in this food session
    const shouldShowModal = !hasShownModalInFoodSession;
    
    if (shouldShowModal) {
      console.log('[FoodScreen] Showing modal');
      setShowSearchModal(true);
    }
    
    const u1 = listenActiveRestaurants(
      (d) => { 
        setRestaurants(d);
        if (shouldShowModal) {
          console.log('[FoodScreen] Data loaded, hiding modal after 800ms');
          setTimeout(() => {
            setShowSearchModal(false);
            hasShownModalInFoodSession = true;
          }, 800);
        }
      },
      () => {
        if (shouldShowModal) {
          console.log('[FoodScreen] Data load error, hiding modal after 800ms');
          setTimeout(() => {
            setShowSearchModal(false);
            hasShownModalInFoodSession = true;
          }, 800);
        }
      }
    );
    const u2 = listenFoodCategoriesWithItems(setCategories);
    
    return () => { 
      console.log('[FoodScreen] Component unmounting');
      u1(); 
      u2(); 
    };
  }, []);

  const openDishModal = (
    restaurantId: string,
    restaurantName: string,
    filterCategoryId?: string | null
  ) => setDishModal({ visible: true, restaurantId, restaurantName, filterCategoryId });

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
              <View style={s.searchModalIconCircle}>
                <Ionicons name="restaurant-outline" size={42} color={ORANGE} />
              </View>
            </View>
            <Text style={s.searchModalTitle}>Finding Restaurants</Text>
            <Text style={s.searchModalSubtitle}>Discovering the best options near you</Text>
            <ActivityIndicator size="large" color={ORANGE} style={{ marginTop: 24 }} />
          </View>
        </View>
      </Modal>

      {!showSearchModal && (
        <>
          {!isVegMode && <View style={s.fullScreenRedOverlay} />}
          <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
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
          {!isVegMode && <View style={s.redOverlay} />}
          <View style={[s.heroContent, { paddingTop: insets.top + 12 }]}>
            <TouchableOpacity 
              style={s.locationRow}
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
              <View style={{ width: 8 }} />
              <TouchableOpacity onPress={() => navigation.navigate("Profile")}>
                <Ionicons name="person-circle" size={34} color={DARK} />
              </TouchableOpacity>
            </TouchableOpacity>

            <View style={s.searchRow}>
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
                onPress={() => setIsVegMode(!isVegMode)}
                activeOpacity={0.8}
              >
                <View style={[s.toggleTrack, isVegMode && s.toggleTrackActive]}>
                  <View style={[s.toggleThumb, isVegMode && s.toggleThumbActive]}>
                    <View style={[s.toggleDot, { backgroundColor: isVegMode ? GREEN : "#dc2626" }]} />
                  </View>
                </View>
              </TouchableOpacity>
            </View>

            <ModeToggle activeMode={activeMode} onPress={setActiveMode} />
          </View>
        </ImageBackground>

        <ImageBackground
          source={require("../../assets/foodScreenbg.png")}
          style={s.bgPattern}
          resizeMode="repeat"
        >
        {categories.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{"What's on your mind?"}</Text>
            <View style={s.categoriesBorder}>
            <FlatList
              data={categories}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(i) => i.id}
              contentContainerStyle={{ paddingLeft: 16, paddingRight: 8, paddingBottom: 4 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={s.catItem}
                  activeOpacity={0.75}
                  onPress={() => {
                    const restId = item.companyIds?.[0] ?? "";
                    const rest = restaurants.find((r) => r.id === restId);
                    if (rest) openDishModal(rest.id, rest.restaurantName, item.id);
                  }}
                >
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={s.catImg} contentFit="cover" />
                  ) : (
                    <View style={[s.catImg, s.catImgPlaceholder]}>
                      <Ionicons name="restaurant-outline" size={22} color={ORANGE} />
                    </View>
                  )}
                  <Text style={s.catName} numberOfLines={1}>{item.name}</Text>
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
                {f.icon && (
                  <Ionicons
                    name="options-outline"
                    size={13}
                    color={active ? ORANGE : DARK}
                    style={{ marginRight: 4 }}
                  />
                )}
                <Text style={[s.chipText, active && s.chipTextActive]}>{f.label}</Text>
                <Ionicons
                  name="chevron-down"
                  size={12}
                  color={active ? ORANGE : GRAY}
                  style={{ marginLeft: 3 }}
                />
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={s.restSection}>
          <Text style={s.restSectionTitle}>{restaurants.length} restaurants</Text>
          {restaurants.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="restaurant-outline" size={52} color="#e2e8f0" />
              <Text style={s.emptyTitle}>No restaurants found</Text>
              <Text style={s.emptySub}>Try a different filter</Text>
            </View>
          ) : (
            restaurants.map((item) => (
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
        </ImageBackground>
      </ScrollView>

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
  bgPattern: { flex: 1 },
  fullScreenRedOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(220, 38, 38, 0.12)",
    zIndex: 1,
    pointerEvents: "none",
  },
  loader:     { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
  loaderText: { marginTop: 12, color: GRAY, fontSize: 14 },

  hero:        { width: "100%", height: 320 },
  heroContent: { paddingHorizontal: 16, paddingBottom: 20 },
  redOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(220, 38, 38, 0.15)",
  },

  locationRow:   { flexDirection: "row", alignItems: "center", marginBottom: 12, paddingHorizontal: 4 },
  locationBtn:   { flexDirection: "row", alignItems: "center" },
  locationLabel: { fontSize: 15, fontWeight: "600", color: DARK, flex: 1 },

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

  section:           { marginTop: 16 },
  categoriesBorder: {
    marginHorizontal: 12,
    borderRadius: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  sectionTitle:      { fontSize: 18, fontWeight: "800", color: DARK, marginBottom: 14, paddingHorizontal: 16 },
  catItem:           { alignItems: "center", marginRight: 4, width: 80 },
  catImg:            { width: 72, height: 72, borderRadius: 36 },
  catImgPlaceholder: { backgroundColor: "#fff5f0", justifyContent: "center", alignItems: "center" },
  catName:           { fontSize: 11, color: DARK, marginTop: 6, textAlign: "center", fontWeight: "500", width: 72 },

  divider: { height: 1, backgroundColor: "#f0f0f0", marginTop: 16 },

  filtersWrap:    { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f0f0f0", backgroundColor: "#fff" },
  filtersRow:     { paddingHorizontal: 12, gap: 8 },
  chip:           { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#d4d5d9", backgroundColor: "#fff" },
  chipActive:     { borderColor: ORANGE, backgroundColor: "#fff8f3" },
  chipText:       { fontSize: 13, color: DARK, fontWeight: "500" },
  chipTextActive: { color: ORANGE, fontWeight: "600" },

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
});
