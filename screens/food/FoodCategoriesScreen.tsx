import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, StatusBar, TextInput, Dimensions, Image, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import {
  listenFoodCategoriesWithItems,
  listenAllMenuItems,
  type FoodCategory,
  type MenuItem,
} from '@/firebase/foodFirebase';
import { useFoodCart } from '@/context/FoodCartContext';

const { width } = Dimensions.get('window');
const SIDE_NAV_WIDTH = 100;
const IMAGE_SIZE = 60;

export default function FoodCategoriesScreen() {
  const navigation = useNavigation<any>();
  const { addItem, getItemQty, removeItem } = useFoodCart();

  const [categories, setCategories] = useState<FoodCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [restaurants, setRestaurants] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [restaurantsLoading, setRestaurantsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // Animated values for dots
  const dot1Opacity = useRef(new Animated.Value(0.3)).current;
  const dot2Opacity = useRef(new Animated.Value(0.3)).current;
  const dot3Opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // Animate dots when loading
    if (loading || restaurantsLoading) {
      const animateDots = () => {
        Animated.sequence([
          Animated.timing(dot1Opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot1Opacity, { toValue: 0.3, duration: 400, useNativeDriver: true }),
          Animated.timing(dot2Opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot2Opacity, { toValue: 0.3, duration: 400, useNativeDriver: true }),
          Animated.timing(dot3Opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot3Opacity, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ]).start(() => {
          if (loading || restaurantsLoading) {
            animateDots();
          }
        });
      };
      animateDots();
    }
  }, [loading, restaurantsLoading]);

  useEffect(() => {
    const u1 = listenFoodCategoriesWithItems(d => {
      setCategories(d);
      if (d.length > 0 && !selectedCategoryId) {
        setSelectedCategoryId(d[0].id);
      }
      setLoading(false);
    }, () => setLoading(false));
    const u2 = listenAllMenuItems(items => {
      setMenuItems(items);
      // Fetch restaurant names for all unique restaurant IDs
      const restaurantIds = [...new Set(items.map(i => i.restaurantId))];
      fetchRestaurantNames(restaurantIds);
    });
    return () => { u1(); u2(); };
  }, []);

  const fetchRestaurantNames = async (restaurantIds: string[]) => {
    setRestaurantsLoading(true);
    try {
      const firestore = (await import('@react-native-firebase/firestore')).default;
      const restaurantMap = new Map<string, string>();
      
      for (const id of restaurantIds) {
        const doc = await firestore().collection('registerRestaurant').doc(id).get();
        if (doc.exists) {
          const data = doc.data();
          restaurantMap.set(id, data?.restaurantName || 'Unknown Restaurant');
        }
      }
      
      setRestaurants(restaurantMap);
    } catch (error) {
      console.error('Error fetching restaurant names:', error);
    } finally {
      setRestaurantsLoading(false);
    }
  };

  const displayedDishes = selectedCategoryId
    ? menuItems.filter(item => {
        const matchesCategory = item.categoryId === selectedCategoryId;
        const matchesSearch = searchQuery.trim()
          ? item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.description?.toLowerCase().includes(searchQuery.toLowerCase())
          : true;
        return matchesCategory && matchesSearch;
      })
    : [];

  const handleAddToCart = (item: MenuItem) => {
    const restaurantName = restaurants.get(item.restaurantId) || 'Unknown Restaurant';
    addItem({
      id: item.id,
      name: item.name,
      price: Number(item.price),
      image: item.image,
      restaurantId: item.restaurantId,
      restaurantName: restaurantName,
      description: item.description,
      cookingTimeHours: item.cookingTimeHours,
      cookingTimeMinutes: item.cookingTimeMinutes,
    });
  };

  const renderCategoryItem = ({ item }: { item: FoodCategory }) => (
    <TouchableOpacity
      style={[
        styles.categoryItem,
        item.id === selectedCategoryId && styles.selectedCategory,
      ]}
      onPress={() => setSelectedCategoryId(item.id)}
    >
      <Image source={{ uri: item.image }} style={styles.categoryImage} />
      <Text
        style={[
          styles.categoryText,
          item.id === selectedCategoryId && styles.selectedCategoryText,
        ]}
        numberOfLines={2}
      >
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  const renderDishItem = ({ item }: { item: MenuItem }) => {
    const qty = getItemQty(item.id);
    const h = Number(item.cookingTimeHours ?? 0);
    const m = Number(item.cookingTimeMinutes ?? 0);
    const restaurantName = restaurants.get(item.restaurantId) || 'Loading...';

    return (
      <TouchableOpacity 
        style={styles.dishCard}
        activeOpacity={0.9}
        onPress={() => {
          // Navigate to dish details screen
          navigation.navigate('FoodDishDetails', { 
            dish: item, 
            restaurantName: restaurantName 
          });
        }}
      >
        {/* Image Container with Overlay Elements */}
        <View style={styles.imageContainer}>
          <Image 
            source={{ uri: item.image || 'https://via.placeholder.com/150' }} 
            style={styles.dishImage} 
          />
          
          {/* Veg/Non-veg Indicator - Top Left */}
          <View style={[styles.vegIndicator, { borderColor: item.foodType === 'nonveg' ? '#dc2626' : '#16a34a' }]}>
            <View style={[styles.vegInner, { backgroundColor: item.foodType === 'nonveg' ? '#dc2626' : '#16a34a' }]} />
          </View>

          {/* Cooking Time Badge - Top Right */}
          {(h > 0 || m > 0) && (
            <View style={styles.timeBadge}>
              <MaterialIcons name="access-time" size={10} color="#fff" />
              <Text style={styles.timeBadgeText}>
                {h > 0 && m > 0 ? `${h}h ${m}m` : h > 0 ? `${h}h` : `${m}m`}
              </Text>
            </View>
          )}
        </View>

        {/* Content Section */}
        <View style={styles.dishContent}>
          {/* Restaurant Badge */}
          <View style={styles.restaurantBadge}>
            <MaterialIcons name="store" size={10} color="#FF6B35" />
            <Text style={styles.restaurantName} numberOfLines={1}>{restaurantName}</Text>
          </View>

          {/* Dish Name */}
          <Text style={styles.dishName} numberOfLines={2}>{item.name}</Text>
          
          {/* Description */}
          {item.description ? (
            <Text style={styles.dishDesc} numberOfLines={2}>{item.description}</Text>
          ) : null}

          {/* Price Row */}
          <View style={styles.priceRow}>
            <View style={styles.priceContainer}>
              <Text style={styles.price}>₹{item.price}</Text>
              {item.variants && item.variants.length > 1 && (
                <View style={styles.variantBadge}>
                  <Text style={styles.variantText}>+{item.variants.length - 1}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Add Button / Quantity Control */}
        <View style={styles.actionContainer}>
          {qty === 0 ? (
            <TouchableOpacity 
              style={styles.addButton}
              onPress={(e) => {
                e.stopPropagation();
                handleAddToCart(item);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.addButtonText}>ADD</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.quantityControl}>
              <TouchableOpacity 
                style={styles.qtyBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  removeItem(item.id);
                }}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons name="remove" size={18} color="#FF6B35" />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{qty}</Text>
              <TouchableOpacity 
                style={styles.qtyBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  handleAddToCart(item);
                }}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons name="add" size={18} color="#FF6B35" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading || restaurantsLoading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingModal}>
          <View style={styles.loadingIconContainer}>
            <MaterialIcons name="restaurant-menu" size={48} color="#FF6B35" />
          </View>
          <Text style={styles.loadingTitle}>Finding Best Dishes</Text>
          <Text style={styles.loadingSubtitle}>
            {loading ? 'Loading categories...' : 'Discovering restaurants...'}
          </Text>
          <View style={styles.loadingDots}>
            <Animated.View style={[styles.dot, { opacity: dot1Opacity }]} />
            <Animated.View style={[styles.dot, { opacity: dot2Opacity }]} />
            <Animated.View style={[styles.dot, { opacity: dot3Opacity }]} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />

      {/* Side Navigation - Categories */}
      <View style={styles.sideNav}>
        <FlatList
          data={categories}
          keyExtractor={(i) => i.id}
          renderItem={renderCategoryItem}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyCategoryContainer}>
              <Text style={styles.emptyCategoryText}>No categories</Text>
            </View>
          }
        />
      </View>

      {/* Main Content - Dishes */}
      <View style={styles.mainContent}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <MaterialIcons
            name="search"
            size={24}
            color="#555"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchBar}
            placeholder="Search for dishes..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearIcon}
            >
              <MaterialIcons name="clear" size={24} color="#555" />
            </TouchableOpacity>
          )}
        </View>

        {/* Dishes List */}
        <FlatList
          data={displayedDishes}
          keyExtractor={(i) => i.id}
          renderItem={renderDishItem}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.dishList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No dishes found.</Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#FAFAFA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  loadingModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
    minWidth: 280,
  },
  loadingIconContainer: {
    marginBottom: 20,
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
  },
  loadingSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  loadingDots: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF6B35',
  },

  // Side Navigation
  sideNav: {
    width: SIDE_NAV_WIDTH,
    backgroundColor: '#fff',
    paddingTop: 20,
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderRightColor: '#ddd',
  },
  categoryItem: {
    paddingVertical: 10,
    paddingHorizontal: 5,
    borderRadius: 5,
    marginBottom: 8,
    alignItems: 'center',
  },
  categoryImage: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: IMAGE_SIZE / 2,
    marginBottom: 5,
  },
  selectedCategory: {
    backgroundColor: '#FF6B35',
  },
  categoryText: {
    fontSize: 11,
    color: '#333',
    textAlign: 'center',
    fontWeight: '500',
  },
  selectedCategoryText: {
    color: '#fff',
    fontWeight: '700',
  },
  emptyCategoryContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  emptyCategoryText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },

  // Main Content
  mainContent: {
    flex: 1,
    paddingHorizontal: 10,
    paddingTop: 10,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    position: 'relative',
  },
  searchIcon: {
    position: 'absolute',
    left: 16,
    zIndex: 1,
  },
  searchBar: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 25,
    paddingLeft: 48,
    paddingRight: 48,
    height: 45,
    fontSize: 16,
    color: '#333',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  clearIcon: {
    position: 'absolute',
    right: 16,
  },

  // Dishes List
  dishList: {
    paddingBottom: 20,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 50,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },

  // Dish Card
  dishCard: {
    width: (width - SIDE_NAV_WIDTH - 30) / 2,
    height: 320, // Fixed height for all cards
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 130, // Fixed image height
  },
  dishImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f5f5f5',
  },
  vegIndicator: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 18,
    height: 18,
    borderRadius: 3,
    borderWidth: 2,
    borderColor: '#16a34a',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  vegInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16a34a',
  },
  timeBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
  },
  timeBadgeText: {
    fontSize: 9,
    color: '#fff',
    fontWeight: '600',
  },
  dishContent: {
    flex: 1, // Takes remaining space between image and button
    padding: 12,
    justifyContent: 'space-between',
  },
  restaurantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFF5F0',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
    alignSelf: 'flex-start',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#FFE5D9',
  },
  restaurantName: {
    fontSize: 9,
    color: '#FF6B35',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  dishName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
    lineHeight: 18,
    letterSpacing: -0.2,
    height: 36, // Fixed 2 lines
  },
  dishDesc: {
    fontSize: 11,
    color: '#666',
    marginBottom: 6,
    lineHeight: 15,
    height: 30, // Fixed 2 lines
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  price: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FF6B35',
    letterSpacing: -0.3,
  },
  variantBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  variantText: {
    fontSize: 9,
    color: '#2E7D32',
    fontWeight: '700',
  },
  actionContainer: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 0,
  },

  // Add Button
  addButton: {
    backgroundColor: '#fff',
    height: 36, // Fixed button height
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FF6B35',
  },
  addButtonText: {
    color: '#FF6B35',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Quantity Control
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FF6B35',
    borderRadius: 8,
    height: 36, // Fixed button height - same as add button
    paddingHorizontal: 6,
  },
  qtyBtn: {
    backgroundColor: '#fff',
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
});
