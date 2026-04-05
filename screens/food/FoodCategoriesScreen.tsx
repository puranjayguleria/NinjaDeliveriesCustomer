import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, StatusBar, Platform, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  listenFoodCategoriesWithItems,
  listenActiveRestaurants,
  type FoodCategory,
  type Restaurant,
} from '@/firebase/foodFirebase';
import DishModal from '@/components/food/DishModal';

export default function FoodCategoriesScreen() {
  const navigation = useNavigation<any>();
  const insets     = useSafeAreaInsets();
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
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color="#3d4152" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Menu Categories</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.searchWrap}>
        <View style={s.searchBox}>
          <Ionicons name="search" size={20} color="#686b78" />
          <TextInput
            style={s.searchInput}
            placeholder="Search for dishes & categories"
            placeholderTextColor="#93959f"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#93959f" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        numColumns={4}
        contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 20, paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity style={s.catCard} onPress={() => openCategory(item)} activeOpacity={0.7}>
            {item.image ? (
              <Image source={{ uri: item.image }} style={s.catImg} contentFit="cover" />
            ) : (
              <View style={[s.catImg, s.catImgPlaceholder]}>
                <Ionicons name="restaurant" size={32} color="#fc8019" />
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
  container: { flex: 1, backgroundColor: '#fff' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  header: {
    backgroundColor: '#fff',
    flexDirection: 'row', 
    alignItems: 'center',
    paddingHorizontal: 16, 
    paddingBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: { elevation: 2 },
    }),
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { 
    flex: 1, 
    fontSize: 20, 
    fontWeight: '700', 
    color: '#3d4152', 
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  searchWrap: { 
    backgroundColor: '#fff', 
    paddingHorizontal: 16, 
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f5',
  },
  searchBox: {
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 10,
    backgroundColor: '#f0f0f5', 
    borderRadius: 12, 
    paddingHorizontal: 14, 
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: '#e9e9ef',
  },
  searchInput: { 
    flex: 1, 
    fontSize: 15, 
    color: '#3d4152', 
    padding: 0,
    fontWeight: '400',
  },
  catCard: { 
    width: '25%',
    alignItems: 'center', 
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  catImg: { 
    width: 72, 
    height: 72, 
    borderRadius: 36, 
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: '#e9e9ef',
  },
  catImgPlaceholder: { 
    backgroundColor: '#fff7ed', 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  catName: { 
    fontSize: 11.5, 
    fontWeight: '500', 
    color: '#3d4152', 
    textAlign: 'center',
    lineHeight: 14,
    letterSpacing: -0.2,
  },
});
