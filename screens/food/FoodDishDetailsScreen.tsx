import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Dimensions, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useFoodCart } from '@/context/FoodCartContext';
import type { MenuItem, MenuAddon } from '@/firebase/foodFirebase';
import firestore from '@react-native-firebase/firestore';

const { width } = Dimensions.get('window');

export default function FoodDishDetailsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { dish, restaurantName } = route.params || {};
  
  const { addItem, getItemQty, removeItem } = useFoodCart();
  const [addons, setAddons] = useState<MenuAddon[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<{ size: string; price: string } | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);

  useEffect(() => {
    if (dish?.variants && dish.variants.length > 0) {
      setSelectedVariant(dish.variants[0]);
    }
    fetchAddons();
  }, [dish]);

  const fetchAddons = async () => {
    if (!dish?.id) return;
    try {
      const snap = await firestore()
        .collection('restaurant_menuAddons')
        .where('menuItemId', '==', dish.id)
        .where('available', '==', true)
        .get();
      
      const items = snap.docs.map(d => {
        const data = d.data() as any;
        return { id: d.id, ...data, image: data.image || data.imageUrl || data.imageURL || '' } as MenuAddon;
      });
      setAddons(items);
    } catch (error) {
      console.error('Error fetching addons:', error);
    }
  };

  const handleAddToCart = () => {
    const basePrice = selectedVariant ? Number(selectedVariant.price) : Number(dish.price);
    
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
      id: dish.id + (selectedVariant?.size ?? ''),
      name: dish.name + (selectedVariant ? ` (${selectedVariant.size})` : ''),
      price: basePrice,
      image: dish.image,
      restaurantId: dish.restaurantId,
      restaurantName: restaurantName,
      variant: selectedVariant?.size,
      addons: selectedAddonObjects,
      description: dish.description,
      cookingTimeHours: dish.cookingTimeHours,
      cookingTimeMinutes: dish.cookingTimeMinutes,
    });
    
    navigation.goBack();
  };

  const qty = getItemQty(dish?.id || '');
  const h = Number(dish?.cookingTimeHours ?? 0);
  const m = Number(dish?.cookingTimeMinutes ?? 0);

  const totalPrice = (selectedVariant ? Number(selectedVariant.price) : Number(dish?.price || 0)) +
    selectedAddons.reduce((sum, aid) => {
      const a = addons.find(x => x.id === aid);
      return sum + (a ? Number(a.price) : 0);
    }, 0);

  if (!dish) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Dish not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dish Details</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Image */}
        <Image 
          source={{ uri: dish.image || 'https://via.placeholder.com/400' }} 
          style={styles.dishImage}
          contentFit="cover"
        />

        {/* Content */}
        <View style={styles.content}>
          {/* Restaurant Badge */}
          <View style={styles.restaurantBadge}>
            <MaterialIcons name="store" size={12} color="#FF6B35" />
            <Text style={styles.restaurantName}>{restaurantName}</Text>
          </View>

          {/* Dish Name */}
          <Text style={styles.dishName}>{dish.name}</Text>

          {/* Veg Indicator & Price Row */}
          <View style={styles.infoRow}>
            <View style={styles.vegRow}>
              <View style={styles.vegIndicator}>
                <View style={styles.vegInner} />
              </View>
              <Text style={styles.vegText}>Veg</Text>
            </View>
            <Text style={styles.price}>₹{selectedVariant ? selectedVariant.price : dish.price}</Text>
          </View>

          {/* Cooking Time */}
          {(h > 0 || m > 0) && (
            <View style={styles.timeRow}>
              <MaterialIcons name="access-time" size={14} color="#999" />
              <Text style={styles.timeText}>
                {h > 0 && m > 0 ? `${h}h ${m}m` : h > 0 ? `${h} hr` : `${m} mins`}
              </Text>
            </View>
          )}

          {/* Description */}
          {dish.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.description}>{dish.description}</Text>
            </View>
          )}

          {/* Variants */}
          {dish.variants && dish.variants.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Choose Size</Text>
              {dish.variants.map((v: any) => (
                <TouchableOpacity
                  key={v.size}
                  style={styles.optionRow}
                  onPress={() => setSelectedVariant(v)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.radio, selectedVariant?.size === v.size && styles.radioActive]}>
                    {selectedVariant?.size === v.size && <View style={styles.radioInner} />}
                  </View>
                  <Text style={styles.optionName}>{v.size}</Text>
                  <Text style={styles.optionPrice}>₹{v.price}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Add-ons */}
          {addons.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Add-ons</Text>
              {addons.map(addon => (
                <TouchableOpacity
                  key={addon.id}
                  style={styles.optionRow}
                  activeOpacity={0.7}
                  onPress={() => setSelectedAddons(prev =>
                    prev.includes(addon.id)
                      ? prev.filter(x => x !== addon.id)
                      : [...prev, addon.id]
                  )}
                >
                  <View style={[styles.checkbox, selectedAddons.includes(addon.id) && styles.checkboxActive]}>
                    {selectedAddons.includes(addon.id) && (
                      <MaterialIcons name="check" size={12} color="#fff" />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionName}>{addon.name}</Text>
                    {addon.description && <Text style={styles.optionDesc}>{addon.description}</Text>}
                  </View>
                  {addon.image && (
                    <Image source={{ uri: addon.image }} style={styles.addonImg} contentFit="cover" />
                  )}
                  <Text style={styles.optionPrice}>+₹{addon.price}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={{ height: 20 }} />
        </View>
      </ScrollView>

      {/* Footer Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAddToCart}
          activeOpacity={0.8}
        >
          <Text style={styles.addButtonText}>
            Add to Cart · ₹{totalPrice}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  dishImage: {
    width: width,
    height: width * 0.7,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 16,
  },
  restaurantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF5F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FFE5D9',
  },
  restaurantName: {
    fontSize: 11,
    color: '#FF6B35',
    fontWeight: '600',
  },
  dishName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 10,
    lineHeight: 26,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  vegRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  vegIndicator: {
    width: 16,
    height: 16,
    borderRadius: 2,
    borderWidth: 1.5,
    borderColor: '#16a34a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vegInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16a34a',
  },
  vegText: {
    fontSize: 12,
    color: '#16a34a',
    fontWeight: '600',
  },
  price: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FF6B35',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
  },
  timeText: {
    fontSize: 12,
    color: '#999',
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 10,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
    gap: 10,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioActive: {
    borderColor: '#FF6B35',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF6B35',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  optionName: {
    flex: 1,
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  optionDesc: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  optionPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  addonImg: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  addButton: {
    backgroundColor: '#FF6B35',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#FF6B35',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 100,
  },
});
