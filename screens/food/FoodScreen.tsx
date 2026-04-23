import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, FlatList, ActivityIndicator, Dimensions,
  StatusBar, Platform, RefreshControl, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useLocationContext } from '@/context/LocationContext';
import { useToggleContext } from '@/context/ToggleContext';
import { navigationRef } from '@/navigation/rootNavigation';
import {
  getActiveRestaurants,
  getFoodCategories,
  type Restaurant,
  type FoodCategory as Category,
} from '@/firebase/foodFirebase';

const { width } = Dimensions.get('window');

export default function FoodScreen() {
  const navigation = useNavigation<any>();
  const { location } = useLocationContext();
  const { activeMode, setActiveMode } = useToggleContext();

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isVegMode, setIsVegMode] = useState(false);
  
  // Animation for collapsible header
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerHeight = useRef(new Animated.Value(300)).current;

  const fetchData = useCallback(async () => {
    try {
      const [restData, catData] = await Promise.all([
        getActiveRestaurants(),
        getFoodCategories(),
      ]);
      setRestaurants(restData);
      setCategories(catData);
    } catch (e) {
      console.error('[FoodScreen] fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

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

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const filteredRestaurants = restaurants.filter(r =>
    r.restaurantName?.toLowerCase().includes(searchText.toLowerCase())
  );

  if (loading) {
    return (
      <View style={s.loader}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={s.loaderText}>Finding restaurants near you...</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ── Fixed Header Section (Above Red Line) ── */}
      <Animated.View style={[s.headerBackgroundSection, { height: headerHeight }]}>
        <Image
          source={require('../../assets/foodBG.png')}
          style={s.headerBackgroundImage}
          contentFit="cover"
        />
        
        {/* Header Content Overlay */}
        <View style={s.headerOverlay}>
          {/* ── Header ── */}
          <View style={s.header}>
            <View style={{ flex: 1 }}>
              <TouchableOpacity style={s.locationRow} activeOpacity={0.7}>
                <Ionicons name="location-sharp" size={18} color="#FF6B35" />
                <Text style={s.locationText} numberOfLines={1}>
                  {location?.address ? location.address.split(',')[0] : 'Select Location'}
                </Text>
                <Ionicons name="chevron-down" size={14} color="#1e293b" />
              </TouchableOpacity>
              <Text style={s.locationSub}>Delivering to your location</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
              <Ionicons name="person-circle-outline" size={32} color="#1e293b" />
            </TouchableOpacity>
          </View>

          {/* ── Search & Veg Toggle ── */}
          <View style={s.searchContainer}>
            <View style={s.searchBox}>
              <Ionicons name="search-outline" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
              <TextInput
                style={s.searchInput}
                placeholder="Search restaurants, cuisines..."
                placeholderTextColor="#94a3b8"
                value={searchText}
                onChangeText={setSearchText}
              />
              {searchText.length > 0 && (
                <TouchableOpacity onPress={() => setSearchText('')}>
                  <Ionicons name="close-circle" size={18} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </View>
            
            {/* Veg Mode Toggle */}
            <TouchableOpacity
              style={[s.vegToggle, isVegMode && s.vegToggleActive]}
              onPress={() => setIsVegMode(!isVegMode)}
              activeOpacity={0.7}
            >
              <View style={[s.vegDot, isVegMode && s.vegDotActive]} />
              <Text style={[s.vegText, isVegMode && s.vegTextActive]}>VEG</Text>
            </TouchableOpacity>
          </View>

          {/* ── Grocery/Service/Food Toggle ── */}
          <View style={s.toggleRow}>
            {/* Grocery Toggle - Only show if location.grocery is not false */}
            {location?.grocery !== false && (
              <TouchableOpacity
                style={[s.toggleBtn, activeMode === "grocery" && s.toggleBtnActive]}
                onPress={() => {
                  setActiveMode("grocery");
                  // Navigate to HomeTab only if it exists (grocery is available)
                  if (location?.grocery !== false) {
                    try {
                      navigation.navigate("AppTabs" as any, { screen: "HomeTab" });
                    } catch {
                      try { navigation.navigate("HomeTab" as any); } catch { /* ignore */ }
                    }
                  }
                }}
                activeOpacity={0.7}
              >
                <Text style={[s.toggleLabel, activeMode === "grocery" && s.toggleLabelActive]}>
                  Grocery
                </Text>
              </TouchableOpacity>
            )}
            
            {/* Service Toggle - Only show if location.services is not false */}
            {location?.services !== false && (
              <TouchableOpacity
                style={[s.toggleBtn, activeMode === "service" && s.toggleBtnActive]}
                onPress={() => {
                  setActiveMode("service");
                  // Navigate to HomeTab only if it exists (grocery is available)
                  if (location?.grocery !== false) {
                    try {
                      navigation.navigate("AppTabs" as any, { screen: "HomeTab" });
                    } catch {
                      try { navigation.navigate("HomeTab" as any); } catch { /* ignore */ }
                    }
                  }
                  // If grocery is false, just set mode without navigation
                }}
                activeOpacity={0.7}
              >
                <Text style={[s.toggleLabel, activeMode === "service" && s.toggleLabelActive]}>
                  Service
                </Text>
              </TouchableOpacity>
            )}
            
            {/* Food Toggle - Only show if location.food is not false */}
            {location?.food !== false && (
              <TouchableOpacity
                style={[s.toggleBtn, activeMode === "food" && s.toggleBtnActive]}
                onPress={() => setActiveMode("food")}
                activeOpacity={0.7}
              >
                <Text style={[s.toggleLabel, activeMode === "food" && s.toggleLabelActive]}>
                  Food
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Animated.View>

      {/* ── Fixed Categories Section (RED LINE HERE) ── */}
      {categories.length > 0 && (
        <View style={s.stickyCategories}>
          <Text style={s.sectionTitle}>What's on your mind?</Text>
          <FlatList
            data={categories}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={item => item.id}
            contentContainerStyle={{ paddingBottom: 4 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={s.catItem}
                activeOpacity={0.7}
                onPress={() => setSelectedCategory(selectedCategory === item.id ? null : item.id)}
              >
                {item.image ? (
                  <Image source={{ uri: item.image }} style={s.catImg} contentFit="cover" />
                ) : (
                  <View style={[s.catImg, s.catImgPlaceholder]}>
                    <Ionicons name="restaurant-outline" size={22} color="#FF6B35" />
                  </View>
                )}
                <Text
                  style={[s.catName, selectedCategory === item.id && { color: '#FF6B35', fontWeight: '700' }]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                {selectedCategory === item.id && <View style={s.catUnderline} />}
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* ── Scrollable Section (Below Red Line) ── */}
      <ScrollView 
        style={s.restaurantsContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF6B35']} />}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { 
            useNativeDriver: false,
            listener: (event: any) => {
              const offsetY = event.nativeEvent.contentOffset.y;
              
              // Continuous animation - header height changes with scroll position
              const maxHeight = 300;
              const minHeight = 128;
              const scrollRange = 160;
              
              let newHeight;
              if (offsetY <= 0) {
                newHeight = maxHeight;
              } else if (offsetY >= scrollRange) {
                newHeight = minHeight;
              } else {
                newHeight = maxHeight - (offsetY * (maxHeight - minHeight) / scrollRange);
              }
              
              headerHeight.setValue(newHeight);
            }
          }
        )}
        scrollEventThrottle={16}
      >
        {/* ── Scrollable Filters Section ── */}
        <View style={s.filtersSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filtersRow}>
            {['Pure Veg', 'Ratings 4.0+', 'Fast Delivery', 'New Arrivals', 'Offers'].map(f => (
              <TouchableOpacity key={f} style={s.chip} activeOpacity={0.7}>
                <Text style={s.chipText}>{f}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── Restaurants Section ── */}
        <View style={s.section}>
          <View style={s.sectionRow}>
            <Text style={s.sectionTitle}>
              {selectedCategory
                ? `${categories.find(c => c.id === selectedCategory)?.name ?? ''} Restaurants`
                : 'All Restaurants'}
            </Text>
            <Text style={s.countText}>{filteredRestaurants.length} places</Text>
          </View>

          {filteredRestaurants.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="restaurant-outline" size={52} color="#e2e8f0" />
              <Text style={s.emptyTitle}>No restaurants found</Text>
              <Text style={s.emptySub}>Try a different search</Text>
            </View>
          ) : (
            filteredRestaurants.map(item => (
              <TouchableOpacity
                key={item.id}
                style={s.restCard}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('RestaurantDetail', {
                  restaurantId: item.id,
                  restaurantName: item.restaurantName,
                })}
              >
                <View style={s.restImgWrap}>
                  <View style={s.restImgPlaceholder}>
                    <Ionicons name="restaurant" size={44} color="#FF6B35" />
                  </View>
                  <View style={s.offerBadge}>
                    <Text style={s.offerBadgeText}>20% OFF</Text>
                  </View>
                  <View style={s.deliveryBadge}>
                    <Ionicons name="bicycle-outline" size={12} color="#fff" />
                    <Text style={s.deliveryBadgeText}>Free</Text>
                  </View>
                </View>

                <View style={s.restBody}>
                  <Text style={s.restName} numberOfLines={1}>{item.restaurantName}</Text>
                  <Text style={s.restType} numberOfLines={1}>
                    {item.type === 'restaurant' ? 'Restaurant' : item.type}
                  </Text>

                  <View style={s.metaRow}>
                    <View style={s.ratingBadge}>
                      <Ionicons name="star" size={10} color="#fff" />
                      <Text style={s.ratingText}>4.2</Text>
                    </View>
                    <Text style={s.metaDot}>·</Text>
                    <Text style={s.metaText}>30-40 min</Text>
                    <Text style={s.metaDot}>·</Text>
                    <Text style={s.metaText}>₹150 for one</Text>
                  </View>

                  {item.address ? (
                    <Text style={s.restAddr} numberOfLines={1}>
                      📍 {item.address}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  loaderText: { marginTop: 12, color: '#64748b', fontSize: 14 },

  // Header Background Section
  headerBackgroundSection: {
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
  },
  headerBackgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingBottom: 20,
    justifyContent: 'flex-start',
  },

  header: {
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : 40,
    paddingBottom: 12,
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { fontSize: 15, fontWeight: '700', color: '#1e293b', maxWidth: width * 0.55 },
  locationSub: { fontSize: 11, color: '#94a3b8', marginTop: 2 },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 0,
    gap: 12,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row', 
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12, 
    paddingHorizontal: 14, 
    paddingVertical: 11,
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, 
    shadowRadius: 8, 
    elevation: 3,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1e293b', padding: 0 },

  // Veg Toggle Styles
  vegToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    gap: 6,
  },
  vegToggleActive: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  vegDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#dc2626',
  },
  vegDotActive: {
    backgroundColor: '#fff',
  },
  vegText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 32,
  },
  homeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00b4a0',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  homeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  vegTextActive: {
    color: '#fff',
  },

  // Scrollable Filters Section
  filtersSection: {
    backgroundColor: '#f8fafc',
    paddingVertical: 8,
  },
  filtersRow: { paddingHorizontal: 16, paddingVertical: 6, gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  chipText: { fontSize: 12, color: '#475569', fontWeight: '500' },

  section: { paddingHorizontal: 16, marginBottom: 8 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#1e293b', marginBottom: 14 },
  countText: { fontSize: 12, color: '#94a3b8' },

  // Sticky Categories
  stickyCategories: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16,
    paddingVertical: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },

  // Restaurants Container
  restaurantsContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },

  catItem: { alignItems: 'center', marginRight: 18, width: 60 },
  catImg: { width: 54, height: 54, borderRadius: 32 },
  catImgPlaceholder: { backgroundColor: '#fff5f0', justifyContent: 'center', alignItems: 'center' },
  catName: { fontSize: 10, color: '#475569', marginTop: 6, textAlign: 'center', fontWeight: '500' },
  catUnderline: { width: 24, height: 2, backgroundColor: '#FF6B35', borderRadius: 1, marginTop: 3 },

  restCard: {
    backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    marginBottom: 14, marginHorizontal: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  restImgWrap: { position: 'relative' },
  restImgPlaceholder: {
    width: '100%', height: 160,
    backgroundColor: '#fff5f0', justifyContent: 'center', alignItems: 'center',
  },
  offerBadge: {
    position: 'absolute', bottom: 10, left: 10,
    backgroundColor: '#FF6B35', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6,
  },
  offerBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  deliveryBadge: {
    position: 'absolute', bottom: 10, right: 10,
    backgroundColor: '#16a34a', paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 3,
  },
  deliveryBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  restBody: { padding: 14 },
  restName: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  restType: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 5 },
  ratingBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#16a34a', paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4, gap: 2,
  },
  ratingText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  metaDot: { color: '#cbd5e1', fontSize: 14 },
  metaText: { fontSize: 12, color: '#64748b' },
  restAddr: { fontSize: 11, color: '#94a3b8', marginTop: 6 },

  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#94a3b8', marginTop: 12 },
  emptySub: { fontSize: 13, color: '#cbd5e1', marginTop: 4 },

  // Toggle styles
  toggleRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 4,
    gap: 8,
  },
  toggleBtn: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    backgroundColor: "rgba(0, 0, 0, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.15)",
  },
  toggleBtnActive: {
    backgroundColor: "#00b4a0",
    borderColor: "#00b4a0",
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333333",
  },
  toggleLabelActive: {
    color: "#ffffff",
  },
});