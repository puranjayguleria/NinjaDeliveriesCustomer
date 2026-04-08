import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, StatusBar, Platform, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import firestore from '@react-native-firebase/firestore';
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

  // Category restaurants list modal
  const [catRestModal, setCatRestModal] = useState<{
    visible: boolean; categoryId: string; restaurantIds: string[];
  }>({ visible: false, categoryId: '', restaurantIds: [] });

  useEffect(() => {
    const u1 = listenActiveRestaurants(d => { setRestaurants(d); setLoading(false); }, () => setLoading(false));
    const u2 = listenFoodCategoriesWithItems(setCategories);
    return () => { u1(); u2(); };
  }, []);

  const openCategory = async (cat: FoodCategory) => {
    try {
      const snap = await firestore()
        .collection('restaurant_menu')
        .where('categoryId', '==', cat.id)
        .where('available', '==', true)
        .get();
      const ids = [...new Set(snap.docs.map(d => d.data().restaurantId).filter(Boolean))] as string[];
      const matchedRests = restaurants.filter(r => ids.includes(r.id));

      if (matchedRests.length === 1) {
        // Only one restaurant — open DishModal directly
        setDishModal({
          visible: true,
          restaurantId: matchedRests[0].id,
          restaurantName: matchedRests[0].restaurantName,
          filterCategoryId: cat.id,
        });
      } else if (matchedRests.length > 1) {
        // Multiple restaurants — show picker
        setCatRestModal({ visible: true, categoryId: cat.id, restaurantIds: ids });
      }
    } catch (e) {
      console.error('[FoodCategoriesScreen] openCategory error:', e);
    }
  };

  const filtered = categories.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()));
  const catRestaurants = restaurants.filter(r => catRestModal.restaurantIds.includes(r.id));

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
        numColumns={3}
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

      {/* Restaurant picker when multiple restaurants serve this category */}
      {catRestModal.visible && (
        <View style={s.pickerOverlay}>
          <View style={s.pickerSheet}>
            <View style={s.pickerHandle} />
            <Text style={s.pickerTitle}>Choose a Restaurant</Text>
            {catRestaurants.map(r => (
              <TouchableOpacity
                key={r.id}
                style={s.pickerRow}
                activeOpacity={0.8}
                onPress={() => {
                  setCatRestModal({ visible: false, categoryId: '', restaurantIds: [] });
                  setDishModal({
                    visible: true,
                    restaurantId: r.id,
                    restaurantName: r.restaurantName,
                    filterCategoryId: catRestModal.categoryId,
                  });
                }}
              >
                {r.profileImage || r.image ? (
                  <Image source={{ uri: r.profileImage || r.image }} style={s.pickerImg} contentFit="cover" />
                ) : (
                  <View style={[s.pickerImg, s.pickerImgPlaceholder]}>
                    <Ionicons name="restaurant" size={20} color="#fc8019" />
                  </View>
                )}
                <Text style={s.pickerName}>{r.restaurantName}</Text>
                <Ionicons name="chevron-forward" size={18} color="#93959f" />
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={s.pickerCancel} onPress={() => setCatRestModal({ visible: false, categoryId: '', restaurantIds: [] })}>
              <Text style={s.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

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
    width: '33.33%',
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

  // Restaurant picker
  pickerOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 12,
  },
  pickerHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#e0e0e0', alignSelf: 'center', marginBottom: 16,
  },
  pickerTitle: {
    fontSize: 16, fontWeight: '700', color: '#3d4152',
    marginBottom: 16, textAlign: 'center',
  },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f5',
  },
  pickerImg: { width: 44, height: 44, borderRadius: 22 },
  pickerImgPlaceholder: { backgroundColor: '#fff7ed', justifyContent: 'center', alignItems: 'center' },
  pickerName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#3d4152' },
  pickerCancel: {
    marginTop: 16, paddingVertical: 14,
    backgroundColor: '#f0f0f5', borderRadius: 12, alignItems: 'center',
  },
  pickerCancelText: { fontSize: 15, fontWeight: '600', color: '#686b78' },
});
