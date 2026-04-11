import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  ScrollView, ActivityIndicator, TouchableWithoutFeedback,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useFoodCart } from '@/context/FoodCartContext';
import { type MenuItem, type MenuAddon } from '@/firebase/foodFirebase';
import firestore from '@react-native-firebase/firestore';

type Props = {
  visible: boolean;
  onClose: () => void;
  restaurantId: string;
  restaurantName: string;
  filterCategoryId?: string | null;
  initialItem?: MenuItem | null;
};

export default function DishModal({
  visible, onClose, restaurantId, restaurantName,
  filterCategoryId, initialItem,
}: Props) {
  const { addItem, getItemQty, removeItem, totalItems, totalPrice } = useFoodCart();
  const navigation = useNavigation<any>();

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [addons, setAddons] = useState<MenuAddon[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<{ size: string; price: string } | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);

  // Real-time listeners when modal opens
  useEffect(() => {
    if (!visible || !restaurantId) return;
    setLoading(true);

    const unsubMenu = firestore()
      .collection('restaurant_menu')
      .where('restaurantId', '==', restaurantId)
      .where('available', '==', true)
      .onSnapshot({ includeMetadataChanges: false }, snap => {
        const items = snap.docs.map(d => {
          const data = d.data() as any;
          return { id: d.id, ...data, image: data.image || data.imageUrl || data.imageURL || '' } as MenuItem;
        });
        setMenuItems(items);
        setLoading(false);
      }, () => setLoading(false));

    const unsubAddons = firestore()
      .collection('restaurant_menuAddons')
      .where('restaurantId', '==', restaurantId)
      .where('available', '==', true)
      .onSnapshot({ includeMetadataChanges: false }, snap => {
        const items = snap.docs.map(d => {
          const data = d.data() as any;
          return { id: d.id, ...data, image: data.image || data.imageUrl || data.imageURL || '' } as MenuAddon;
        });
        setAddons(items);
      }, () => {});

    return () => { unsubMenu(); unsubAddons(); };
  }, [visible, restaurantId]);

  useEffect(() => {
    if (visible && initialItem) {
      setSelectedItem(initialItem);
      setSelectedVariant(initialItem.variants?.[0] ?? null);
      setSelectedAddons([]);
    }
    if (!visible) {
      setSelectedItem(null);
      setSelectedVariant(null);
      setSelectedAddons([]);
    }
  }, [visible, initialItem]);

  const displayItems = filterCategoryId
    ? menuItems.filter(i => i.categoryId === filterCategoryId)
    : menuItems;

  const categories = React.useMemo(() => {
    if (filterCategoryId) return [];
    const map = new Map<string, string>();
    menuItems.forEach(i => { if (i.categoryId && i.category) map.set(i.categoryId, i.category); });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [menuItems, filterCategoryId]);

  const addonsForItem = (itemId: string) => addons.filter(a => a.menuItemId === itemId);

  const openItem = (item: MenuItem) => {
    const itemAddons = addons.filter(a => a.menuItemId === item.id);
    if ((!item.variants || item.variants.length === 0) && itemAddons.length === 0) {
      addItem({
        id: item.id,
        name: item.name,
        price: Number(item.price),
        image: item.image,
        restaurantId,
        restaurantName,
        description: item.description,
        cookingTimeHours: item.cookingTimeHours,
        cookingTimeMinutes: item.cookingTimeMinutes,
      });
      return;
    }
    setSelectedItem(item);
    setSelectedVariant(item.variants?.[0] ?? null);
    setSelectedAddons([]);
  };

  const confirmAdd = () => {
    if (!selectedItem) return;
    const basePrice = selectedVariant ? Number(selectedVariant.price) : Number(selectedItem.price);
    
    // Map selected addon IDs to full addon objects with name, price, image
    const selectedAddonObjects = selectedAddons
      .map(aid => {
        const addon = addons.find(x => x.id === aid);
        if (!addon) return null;
        return {
          name: addon.name,
          price: Number(addon.price),
          image: addon.image || undefined,
        };
      })
      .filter(Boolean) as { name: string; price: number; image?: string }[];
    
    addItem({
      id: selectedItem.id + (selectedVariant?.size ?? ''),
      name: selectedItem.name + (selectedVariant ? ` (${selectedVariant.size})` : ''),
      price: basePrice,
      image: selectedItem.image,
      restaurantId,
      restaurantName,
      variant: selectedVariant?.size,
      addons: selectedAddonObjects,
      description: selectedItem.description,
      cookingTimeHours: selectedItem.cookingTimeHours,
      cookingTimeMinutes: selectedItem.cookingTimeMinutes,
    });
    // Go back to dish list (don't close modal — user may want to add more)
    setSelectedItem(null);
    setSelectedVariant(null);
    setSelectedAddons([]);
  };

  const renderDishCard = (item: MenuItem) => {
    const qty = getItemQty(item.id);
    
    // Check if foodType field exists and determine color
    let indicatorColor = '#16a34a'; // default green
    if ((item as any).foodType) {
      const foodTypeValue = ((item as any).foodType || '').toLowerCase().trim();
      if (foodTypeValue === 'veg') {
        indicatorColor = '#16a34a'; // green for veg
      } else if (foodTypeValue === 'nonveg' || foodTypeValue === 'non-veg') {
        indicatorColor = '#dc2626'; // red for non-veg
      }
    }
    
    return (
      <TouchableOpacity key={item.id} style={s.dishCard} onPress={() => openItem(item)} activeOpacity={0.85}>
        <View style={s.dishLeft}>
          <View style={[s.vegIndicator, { borderColor: indicatorColor }]}>
            <View style={[s.vegInner, { backgroundColor: indicatorColor }]} />
          </View>
          <Text style={s.dishName} numberOfLines={1}>{item.name}</Text>
          <Text style={s.dishPrice}>
            {item.variants?.length > 0
              ? `₹${item.variants.map(v => v.price).sort((a, b) => Number(a) - Number(b))[0]}`
              : `₹${item.price}`}
          </Text>
          {item.variants?.length > 0 && (
            <Text style={s.dishVariantHint}>{item.variants.map(v => v.size).join(' · ')}</Text>
          )}
          {item.description ? <Text style={s.dishDesc} numberOfLines={2}>{item.description}</Text> : null}
          {(() => {
                const h = Number(item.cookingTimeHours ?? 0);
                const m = Number(item.cookingTimeMinutes ?? 0);
                if (h === 0 && m === 0) return null;
                return (
                  <View style={s.dishTimingRow}>
                    <Ionicons name="time-outline" size={11} color="#94a3b8" />
                    <Text style={s.dishTiming}>
                      {h > 0 && m > 0 ? `${h}h ${m}m` : h > 0 ? `${h} hr` : `${m} mins`}
                    </Text>
                  </View>
                );
              })()}
        </View>
        <View style={s.dishRight}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={s.dishImg} contentFit="cover" />
          ) : (
            <View style={[s.dishImg, s.dishImgPlaceholder]}>
              <Ionicons name="fast-food-outline" size={24} color="#FF6B35" />
            </View>
          )}
          {qty === 0 ? (
            <TouchableOpacity style={s.addBtn} onPress={() => openItem(item)} activeOpacity={0.7}>
              <Text style={s.addBtnText}>ADD</Text>
            </TouchableOpacity>
          ) : (
            <View style={s.qtyRow}>
              <TouchableOpacity style={s.qtyBtn} onPress={() => removeItem(item.id)} activeOpacity={0.7}>
                <Ionicons name="remove" size={14} color="#FF6B35" />
              </TouchableOpacity>
              <Text style={s.qtyText}>{qty}</Text>
              <TouchableOpacity style={s.qtyBtn} onPress={() => openItem(item)} activeOpacity={0.7}>
                <Ionicons name="add" size={14} color="#FF6B35" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Overlay — tap outside to close */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={s.overlay} />
      </TouchableWithoutFeedback>

      {/* Sheet — does NOT propagate taps to overlay */}
      <View style={s.sheet}>
        <View style={s.handle} />
        {selectedItem ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            {selectedItem.image ? (
              <Image source={{ uri: selectedItem.image }} style={s.itemHeroImg} contentFit="cover" />
            ) : (
              <View style={s.itemHeroPlaceholder}>
                <Ionicons name="fast-food-outline" size={48} color="#FF6B35" />
              </View>
            )}
            <View style={s.itemDetailBody}>
              <TouchableOpacity style={s.backRow} onPress={() => setSelectedItem(null)} activeOpacity={0.7}>
                <Ionicons name="arrow-back" size={18} color="#64748b" />
                <Text style={s.backText}>Back</Text>
              </TouchableOpacity>
              <Text style={s.itemDetailName}>{selectedItem.name}</Text>
              <Text style={s.itemDetailPrice}>
                ₹{selectedVariant ? selectedVariant.price : selectedItem.price}
              </Text>
              {selectedItem.description ? (
                <Text style={s.itemDetailDesc}>{selectedItem.description}</Text>
              ) : null}

              {selectedItem.variants?.length > 0 && (
                <View style={s.section}>
                  <Text style={s.sectionTitle}>Choose Size</Text>
                  {selectedItem.variants.map(v => (
                    <TouchableOpacity
                      key={v.size} style={s.optionRow}
                      onPress={() => setSelectedVariant(v)}
                      activeOpacity={0.7}
                    >
                      <View style={[s.radio, selectedVariant?.size === v.size && s.radioActive]}>
                        {selectedVariant?.size === v.size && <View style={s.radioInner} />}
                      </View>
                      <Text style={s.optionName}>{v.size}</Text>
                      <Text style={s.optionPrice}>₹{v.price}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {addonsForItem(selectedItem.id).length > 0 && (
                <View style={s.section}>
                  <Text style={s.sectionTitle}>Add-ons (Optional)</Text>
                  {addonsForItem(selectedItem.id).map(addon => (
                    <TouchableOpacity
                      key={addon.id} style={s.optionRow}
                      activeOpacity={0.7}
                      onPress={() => setSelectedAddons(prev =>
                        prev.includes(addon.id)
                          ? prev.filter(x => x !== addon.id)
                          : [...prev, addon.id]
                      )}
                    >
                      <View style={[s.checkbox, selectedAddons.includes(addon.id) && s.checkboxActive]}>
                        {selectedAddons.includes(addon.id) && (
                          <Ionicons name="checkmark" size={11} color="#fff" />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.optionName}>{addon.name}</Text>
                        {addon.description ? <Text style={s.optionDesc}>{addon.description}</Text> : null}
                      </View>
                      {addon.image ? (
                        <Image source={{ uri: addon.image }} style={s.addonImg} contentFit="cover" />
                      ) : null}
                      <Text style={s.optionPrice}>+₹{addon.price}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={s.confirmBtn}
                onPress={confirmAdd}
                activeOpacity={0.85}
              >
                <Text style={s.confirmBtnText}>
                  Add to Cart · ₹{
                    (selectedVariant ? Number(selectedVariant.price) : Number(selectedItem.price)) +
                    selectedAddons.reduce((sum, aid) => {
                      const a = addons.find(x => x.id === aid);
                      return sum + (a ? Number(a.price) : 0);
                    }, 0)
                  }
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : (
          <>
            <Text style={s.sheetTitle}>{restaurantName}</Text>
            {loading ? (
              <View style={s.loadingContainer}>
                <ActivityIndicator size="large" color="#FF6B35" />
                <Text style={s.loadingText}>Loading menu...</Text>
              </View>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="always"
                style={{ maxHeight: '90%' }}
              >
                {filterCategoryId
                  ? displayItems.map(renderDishCard)
                  : categories.map(cat => (
                    <View key={cat.id}>
                      <Text style={s.catHeader}>{cat.name}</Text>
                      {menuItems.filter(i => i.categoryId === cat.id).map(renderDishCard)}
                    </View>
                  ))
                }
                <View style={{ height: 32 }} />
              </ScrollView>
            )}
          </>
        )}

        {/* Cart Bar — visible when items in cart */}
        {totalItems > 0 && !selectedItem && (
          <TouchableOpacity
            style={s.cartBar}
            activeOpacity={0.9}
            onPress={() => {
              onClose();
              navigation.navigate('FoodCartTab');
            }}
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
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0', alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b', paddingHorizontal: 20, paddingBottom: 12 },
  catHeader: { fontSize: 13, fontWeight: '700', color: '#64748b', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, backgroundColor: '#f8fafc', textTransform: 'uppercase', letterSpacing: 0.5 },
  dishCard: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#fff' },
  dishLeft: { flex: 1, paddingRight: 12 },
  vegIndicator: { width: 14, height: 14, borderRadius: 2, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', marginBottom: 5 },
  vegInner: { width: 7, height: 7, borderRadius: 3.5 },
  dishName: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  dishPrice: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginTop: 3 },
  dishVariantHint: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  dishDesc: { fontSize: 12, color: '#94a3b8', marginTop: 4, lineHeight: 17 },
  dishTimingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 5 },
  dishTiming: { fontSize: 11, color: '#94a3b8' },
  dishRight: { alignItems: 'center', width: 96 },
  dishImg: { width: 86, height: 76, borderRadius: 10 },
  dishImgPlaceholder: { backgroundColor: '#fff5f0', justifyContent: 'center', alignItems: 'center' },
  addBtn: { marginTop: 6, flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#FF6B35', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 5, backgroundColor: '#fff', gap: 2 },
  addBtnText: { color: '#FF6B35', fontWeight: '700', fontSize: 12 },
  addBtnPlus: { color: '#FF6B35', fontSize: 9, fontWeight: '700' },
  qtyRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#FF6B35', borderRadius: 8, overflow: 'hidden' },
  qtyBtn: { paddingHorizontal: 8, paddingVertical: 5, backgroundColor: '#fff5f0' },
  qtyText: { paddingHorizontal: 10, fontSize: 13, fontWeight: '700', color: '#1e293b' },
  itemHeroImg: { width: '100%', height: 200, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  itemHeroPlaceholder: { width: '100%', height: 200, backgroundColor: '#fff5f0', justifyContent: 'center', alignItems: 'center', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  itemDetailBody: { paddingHorizontal: 20, paddingTop: 12 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  backText: { fontSize: 13, color: '#64748b' },
  itemDetailName: { fontSize: 20, fontWeight: '800', color: '#1e293b' },
  itemDetailPrice: { fontSize: 18, fontWeight: '700', color: '#FF6B35', marginTop: 4 },
  itemDetailDesc: { fontSize: 13, color: '#64748b', marginTop: 8, lineHeight: 20 },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  optionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f8fafc', gap: 12 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center' },
  radioActive: { borderColor: '#FF6B35' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF6B35' },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { backgroundColor: '#FF6B35', borderColor: '#FF6B35' },
  optionName: { flex: 1, fontSize: 14, color: '#1e293b', fontWeight: '500' },
  optionDesc: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  optionPrice: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  addonImg: { width: 44, height: 44, borderRadius: 8 },
  confirmBtn: { backgroundColor: '#FF6B35', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 24, marginBottom: 16 },
  confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  loadingContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  loadingText: { marginTop: 12, color: '#94a3b8', fontSize: 14 },
  cartBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#FF6B35', marginHorizontal: 16, marginBottom: 16, marginTop: 8,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
  },
  cartBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cartCount: {
    backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  cartCountText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  cartBarText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cartBarPrice: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
