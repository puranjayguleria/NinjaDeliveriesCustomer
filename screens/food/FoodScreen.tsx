import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, FlatList, ActivityIndicator, Dimensions,
  StatusBar, Platform, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useLocationContext } from '@/context/LocationContext';
import {
  getActiveRestaurants,
  getFoodCategories,
  type Restaurant,
  type FoodCategory as Category,
} from '@/firebase/foodFirebase';

const { width } = Dimensions.get('window');

const BANNERS = [
  { id: '1', color: '#FF6B35', text: '50% OFF up to ₹100', sub: 'Use code NINJA50' },
  { id: '2', color: '#E91E8C', text: 'Free Delivery', sub: 'On orders above ₹199' },
  { id: '3', color: '#7C3AED', text: 'Try Something New', sub: 'New restaurants added daily' },
];

export default function FoodScreen() {
  const navigation = useNavigation<any>();
  const { location } = useLocationContext();

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [bannerIndex, setBannerIndex] = useState(0);
  const bannerTimer = useRef<any>(null);

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

  useEffect(() => {
    bannerTimer.current = setInterval(() => setBannerIndex(i => (i + 1) % BANNERS.length), 3000);
    return () => clearInterval(bannerTimer.current);
  }, []);

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

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#FF6B35']} />}
      >
        {/* ── Search ── */}
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

        {/* ── Offer Banner ── */}
        <View style={s.bannerWrap}>
          <View style={[s.banner, { backgroundColor: BANNERS[bannerIndex].color }]}>
            <Text style={s.bannerTitle}>{BANNERS[bannerIndex].text}</Text>
            <Text style={s.bannerSub}>{BANNERS[bannerIndex].sub}</Text>
          </View>
          <View style={s.dots}>
            {BANNERS.map((_, i) => (
              <View key={i} style={[s.dot, i === bannerIndex && s.dotActive]} />
            ))}
          </View>
        </View>

        {/* ── Quick Filters ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filtersRow}>
          {['Pure Veg', 'Ratings 4.0+', 'Fast Delivery', 'New Arrivals', 'Offers'].map(f => (
            <TouchableOpacity key={f} style={s.chip} activeOpacity={0.7}>
              <Text style={s.chipText}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Categories ── */}
        {categories.length > 0 && (
          <View style={s.section}>
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

        {/* ── Restaurants ── */}
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

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : 40,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { fontSize: 15, fontWeight: '700', color: '#1e293b', maxWidth: width * 0.55 },
  locationSub: { fontSize: 11, color: '#94a3b8', marginTop: 2 },

  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16, marginTop: 14,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1e293b', padding: 0 },

  bannerWrap: {
    marginHorizontal: 16, marginTop: 14,
    borderRadius: 16, overflow: 'hidden', height: 90,
  },
  banner: {
    width: '100%', height: 90, borderRadius: 16,
    justifyContent: 'center', paddingHorizontal: 20,
  },
  bannerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  bannerSub: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  dots: { position: 'absolute', bottom: 10, right: 14, flexDirection: 'row', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.45)' },
  dotActive: { backgroundColor: '#fff', width: 16 },

  filtersRow: { paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
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

  catItem: { alignItems: 'center', marginRight: 18, width: 70 },
  catImg: { width: 64, height: 64, borderRadius: 32 },
  catImgPlaceholder: { backgroundColor: '#fff5f0', justifyContent: 'center', alignItems: 'center' },
  catName: { fontSize: 11, color: '#475569', marginTop: 6, textAlign: 'center', fontWeight: '500' },
  catUnderline: { width: 24, height: 2, backgroundColor: '#FF6B35', borderRadius: 1, marginTop: 3 },

  restCard: {
    backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    marginBottom: 14,
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
});
