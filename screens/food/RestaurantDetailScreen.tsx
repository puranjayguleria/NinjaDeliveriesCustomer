import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  FlatList, ActivityIndicator, Dimensions, Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useFoodCart } from '@/context/FoodCartContext';
import {
  getMenuByRestaurant,
  getAddonsByRestaurant,
  type MenuItem,
  type MenuAddon,
  type FoodCategory as Category,
} from '@/firebase/foodFirebase';
import DishModal from '@/components/food/DishModal';

const { width } = Dimensions.get('window');

export default function RestaurantDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { restaurantId, restaurantName, restaurantImage } = route.params ?? {};

  const { cartItems, addItem, removeItem, getItemQty, totalItems, totalPrice, clearCart } = useFoodCart();

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [addons, setAddons] = useState<MenuAddon[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [dishModal, setDishModal] = useState<{ visible: boolean; item: MenuItem | null }>({ visible: false, item: null });

  const sectionRefs = useRef<{ [key: string]: number }>({});
  const scrollRef = useRef<ScrollView>(null);

  const fetchData = useCallback(async () => {
    try {
      const [items, addonItems] = await Promise.all([
        getMenuByRestaurant(restaurantId),
        getAddonsByRestaurant(restaurantId),
      ]);

      console.log('[RestaurantDetail] menu items fetched:', items.length, items.map(i => ({ name: i.name, image: i.image })));
      console.log('[RestaurantDetail] addons fetched:', addonItems.length, addonItems.map(a => ({ name: a.name, image: a.image })));

      setMenuItems(items);
      setAddons(addonItems);

      // Build unique categories from menu items
      const catMap = new Map<string, Category>();
      items.forEach(item => {
        if (item.categoryId && item.category && !catMap.has(item.categoryId)) {
          catMap.set(item.categoryId, { id: item.categoryId, name: item.category, image: '' });
        }
      });
      const cats = Array.from(catMap.values());
      setCategories(cats);
      if (cats.length > 0) setActiveCategory(cats[0].id);
    } catch (e) {
      console.error('[RestaurantDetail] fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const itemsByCategory = (catId: string) => menuItems.filter(i => i.categoryId === catId);

  const openDishModal = (item: MenuItem) => setDishModal({ visible: true, item });

  if (loading) {
    return (
      <View style={s.loader}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />

      {/* ── Hero ── */}
      <View style={s.hero}>
        {restaurantImage ? (
          <Image source={{ uri: restaurantImage }} style={s.heroImg} contentFit="cover" />
        ) : (
          <View style={s.heroPlaceholder}>
            <Ionicons name="restaurant" size={56} color="rgba(255,255,255,0.4)" />
          </View>
        )}
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={s.heroOverlay}>
          <Text style={s.heroName}>{restaurantName}</Text>
          <View style={s.heroMeta}>
            <View style={s.ratingBadge}>
              <Ionicons name="star" size={11} color="#fff" />
              <Text style={s.ratingText}>4.2</Text>
            </View>
            <Text style={s.heroDot}>·</Text>
            <Text style={s.heroMetaText}>30-40 min</Text>
            <Text style={s.heroDot}>·</Text>
            <Text style={s.heroMetaText}>₹150 for one</Text>
          </View>
        </View>
      </View>

      {/* ── Category Tabs ── */}
      {categories.length > 0 && (
        <View style={s.tabsWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[s.tab, activeCategory === cat.id && s.tabActive]}
                onPress={() => {
                  setActiveCategory(cat.id);
                  const y = sectionRefs.current[cat.id];
                  if (y !== undefined) scrollRef.current?.scrollTo({ y, animated: true });
                }}
              >
                <Text style={[s.tabText, activeCategory === cat.id && s.tabTextActive]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Menu ── */}
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}>
        {categories.map(cat => (
          <View
            key={cat.id}
            onLayout={e => { sectionRefs.current[cat.id] = e.nativeEvent.layout.y; }}
          >
            <View style={s.catHeader}>
              <Text style={s.catHeaderText}>{cat.name}</Text>
              <Text style={s.catCount}>{itemsByCategory(cat.id).length} items</Text>
            </View>

            {itemsByCategory(cat.id).map(item => {
              const qty = getItemQty(item.id);

              return (
                <TouchableOpacity key={item.id} style={s.menuItem} onPress={() => openDishModal(item)} activeOpacity={0.85}>
                  <View style={s.menuItemLeft}>
                    {/* Veg/Non-veg indicator */}
                    <View style={[s.vegDot, { borderColor: '#16a34a' }]}>
                      <View style={[s.vegDotInner, { backgroundColor: '#16a34a' }]} />
                    </View>
                    <Text style={s.itemName}>{item.name}</Text>
                    <Text style={s.itemPrice}>₹{item.price}</Text>
                    {item.variants?.length > 0 && (
                      <Text style={s.variantHint}>
                        {item.variants.map(v => v.size).join(' · ')}
                      </Text>
                    )}
                    {item.description ? (
                      <Text style={s.itemDesc} numberOfLines={2}>{item.description}</Text>
                    ) : null}
                  </View>

                  <View style={s.menuItemRight}>
                    {item.image ? (
                      <Image source={{ uri: item.image }} style={s.itemImg} contentFit="cover" />
                    ) : (
                      <View style={[s.itemImg, s.itemImgPlaceholder]}>
                        <Ionicons name="fast-food-outline" size={28} color="#FF6B35" />
                      </View>
                    )}

                    {qty === 0 ? (
                      <TouchableOpacity style={s.addBtn} onPress={() => openDishModal(item)}>
                        <Text style={s.addBtnText}>ADD</Text>
                        {item.variants?.length > 0 && <Text style={s.addBtnPlus}>+</Text>}
                      </TouchableOpacity>
                    ) : (
                      <View style={s.qtyControl}>
                        <TouchableOpacity style={s.qtyBtn} onPress={() => removeItem(item.id)}>
                          <Ionicons name="remove" size={16} color="#FF6B35" />
                        </TouchableOpacity>
                        <Text style={s.qtyText}>{qty}</Text>
                        <TouchableOpacity style={s.qtyBtn} onPress={() => openDishModal(item)}>
                          <Ionicons name="add" size={16} color="#FF6B35" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Cart Bar ── */}
      {totalItems > 0 && (
        <TouchableOpacity
          style={s.cartBar}
          activeOpacity={0.9}
          onPress={() => navigation.navigate('FoodCartTab')}
        >
          <View style={s.cartBarLeft}>
            <View style={s.cartCount}>
              <Text style={s.cartCountText}>{totalItems}</Text>
            </View>
            <Text style={s.cartBarText}>View Cart</Text>
          </View>
          <Text style={s.cartBarPrice}>₹{totalPrice}</Text>
        </TouchableOpacity>
      )}

      <DishModal
        visible={dishModal.visible}
        onClose={() => setDishModal({ visible: false, item: null })}
        restaurantId={restaurantId}
        restaurantName={restaurantName}
        initialItem={dishModal.item}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  hero: { height: 220, position: 'relative' },
  heroImg: { width: '100%', height: '100%' },
  heroPlaceholder: {
    width: '100%', height: '100%',
    backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center',
  },
  backBtn: {
    position: 'absolute', top: Platform.OS === 'ios' ? 52 : 40, left: 16,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center',
  },
  heroOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16, paddingBottom: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  heroName: { fontSize: 20, fontWeight: '800', color: '#fff' },
  heroMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 5 },
  ratingBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#16a34a', paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4, gap: 2,
  },
  ratingText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  heroDot: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
  heroMetaText: { fontSize: 12, color: 'rgba(255,255,255,0.85)' },

  tabsWrap: {
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  tabs: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  tab: {
    paddingHorizontal: 16, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0',
  },
  tabActive: { backgroundColor: '#FF6B35', borderColor: '#FF6B35' },
  tabText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  tabTextActive: { color: '#fff', fontWeight: '700' },

  catHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 10,
    backgroundColor: '#f8fafc',
  },
  catHeaderText: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  catCount: { fontSize: 12, color: '#94a3b8' },

  menuItem: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  menuItemLeft: { flex: 1, paddingRight: 12 },
  vegDot: {
    width: 14, height: 14, borderRadius: 2, borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  vegDotInner: { width: 7, height: 7, borderRadius: 3.5 },
  itemName: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  itemPrice: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginTop: 4 },
  variantHint: { fontSize: 11, color: '#94a3b8', marginTop: 3 },
  itemDesc: { fontSize: 12, color: '#94a3b8', marginTop: 5, lineHeight: 17 },
  addonHint: { fontSize: 11, color: '#FF6B35', marginTop: 5, fontWeight: '500' },

  menuItemRight: { alignItems: 'center', width: 100 },
  itemImg: { width: 90, height: 80, borderRadius: 10 },
  itemImgPlaceholder: { backgroundColor: '#fff5f0', justifyContent: 'center', alignItems: 'center' },

  addBtn: {
    marginTop: 8, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#FF6B35', borderRadius: 8,
    paddingHorizontal: 18, paddingVertical: 6, backgroundColor: '#fff',
    gap: 2,
  },
  addBtnText: { color: '#FF6B35', fontWeight: '700', fontSize: 13 },
  addBtnPlus: { color: '#FF6B35', fontSize: 10, fontWeight: '700' },

  qtyControl: {
    marginTop: 8, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#FF6B35', borderRadius: 8, overflow: 'hidden',
  },
  qtyBtn: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#fff5f0' },
  qtyText: { paddingHorizontal: 12, fontSize: 14, fontWeight: '700', color: '#1e293b' },

  cartBar: {
    position: 'absolute', bottom: 20, left: 16, right: 16,
    backgroundColor: '#FF6B35', borderRadius: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 14,
    shadowColor: '#FF6B35', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  cartBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cartCount: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center',
  },
  cartCountText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  cartBarText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cartBarPrice: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingBottom: 32, maxHeight: '80%',
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0',
    alignSelf: 'center', marginTop: 12, marginBottom: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#1e293b', marginBottom: 16 },
  modalSection: { marginBottom: 20 },
  modalSectionTitle: {
    fontSize: 13, fontWeight: '700', color: '#64748b',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12,
  },
  optionRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f8fafc', gap: 12,
  },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#e2e8f0',
    justifyContent: 'center', alignItems: 'center',
  },
  radioActive: { borderColor: '#FF6B35' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF6B35' },
  checkbox: {
    width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#e2e8f0',
    justifyContent: 'center', alignItems: 'center',
  },
  checkboxActive: { backgroundColor: '#FF6B35', borderColor: '#FF6B35' },
  optionName: { flex: 1, fontSize: 14, color: '#1e293b', fontWeight: '500' },
  optionDesc: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  optionPrice: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  addonImg: { width: 48, height: 48, borderRadius: 8 },
  confirmBtn: {
    backgroundColor: '#FF6B35', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
