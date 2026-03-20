import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, StatusBar, Platform, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import {
  listenFoodCategoriesWithItems,
  listenActiveRestaurants,
  type FoodCategory,
  type Restaurant,
} from '@/firebase/foodFirebase';
import DishModal from '@/components/food/DishModal';

export default function FoodCategoriesScreen() {
  const [categories, setCategories] = useState<FoodCategory[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dishModal, setDishModal] = useState<{
    visible: boolean; restaurantId: string; restaurantName: string;
    filterCategoryId?: string | null;
  }>({ visible: false, restaurantId: '', restaurantName: '' });

  useEffect(() => {
    const u1 = listenActiveRestaurants(d => { setRestaurants(d); setLoading(false); }, () => setLoading(false));
    const u2 = listenFoodCategoriesWithItems(setCategories);
    return () => { u1(); u2(); };
  }, []);

  const openCategory = (cat: FoodCategory) => {
    const restId = cat.companyIds?.[0] ?? '';
    const rest = restaurants.find(r => r.id === restId);
    if (!rest) return;
    setDishModal({ visible: true, restaurantId: rest.id, restaurantName: rest.restaurantName, filterCategoryId: cat.id });
  };

  const filtered = categories.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <View style={s.loader}><ActivityIndicator size="large" color="#FF6B35" /></View>;

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={s.header}>
        <Text style={s.headerTitle}>Menu Categories</Text>
        <View style={s.searchBox}>
          <Ionicons name="search-outline" size={16} color="#94a3b8" />
          <TextInput
            style={s.searchInput}
            placeholder="Search categories..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        numColumns={3}
        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity style={s.catCard} onPress={() => openCategory(item)} activeOpacity={0.8}>
            {item.image ? (
              <Image source={{ uri: item.image }} style={s.catImg} contentFit="cover" />
            ) : (
              <View style={[s.catImg, s.catImgPlaceholder]}>
                <Ionicons name="restaurant-outline" size={28} color="#FF6B35" />
              </View>
            )}
            <Text style={s.catName} numberOfLines={2}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />

      <DishModal
        visible={dishModal.visible}
        onClose={() => setDishModal(prev => ({ ...prev, visible: false }))}
        restaurantId={dishModal.restaurantId}
        restaurantName={dishModal.restaurantName}
        filterCategoryId={dishModal.filterCategoryId}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 52 : 40,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#1e293b', marginBottom: 10 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#f1f5f9', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1e293b', padding: 0 },
  catCard: { flex: 1, margin: 6, alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  catImg: { width: 64, height: 64, borderRadius: 32, marginBottom: 8 },
  catImgPlaceholder: { backgroundColor: '#fff5f0', justifyContent: 'center', alignItems: 'center' },
  catName: { fontSize: 12, fontWeight: '600', color: '#1e293b', textAlign: 'center' },
});
