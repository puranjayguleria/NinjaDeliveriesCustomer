import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  ImageBackground,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { FirestoreService, ServiceCategory } from '../services/firestoreService';

// Function to get icon based on service category name
const getCategoryIcon = (categoryName: string) => {
  const name = categoryName.toLowerCase();
  
  // Electrical Services
  if (name.includes("electric") || name.includes("wiring") || name.includes("voltage")) return "flash-outline";
  // Plumbing Services
  if (name.includes("plumb") || name.includes("pipe") || name.includes("water") || name.includes("drain")) return "water-outline";
  // Cleaning Services
  if (name.includes("clean") || name.includes("housekeep") || name.includes("maid") || name.includes("sanitiz")) return "sparkles-outline";
  // Health & Fitness
  if (name.includes("health") || name.includes("fitness") || name.includes("yoga") || name.includes("physio") || name.includes("massage") || name.includes("therapy")) return "fitness-outline";
  // Daily Wages / Labor
  if (name.includes("daily") || name.includes("wage") || name.includes("worker") || name.includes("labor") || name.includes("helper")) return "people-outline";
  // Car Wash / Vehicle Services
  if (name.includes("car") || name.includes("wash") || name.includes("vehicle") || name.includes("auto") || name.includes("bike")) return "water-outline";
  // AC / Cooling Services
  if (name.includes("ac") || name.includes("air") || name.includes("condition") || name.includes("cooling") || name.includes("hvac")) return "snow-outline";
  // Appliance Repair
  if (name.includes("appliance") || name.includes("refrigerat") || name.includes("washing") || name.includes("microwave") || name.includes("oven")) return "tv-outline";
  // Painting Services
  if (name.includes("paint") || name.includes("wall") || name.includes("interior") || name.includes("exterior")) return "brush-outline";
  // Gardening / Landscaping
  if (name.includes("garden") || name.includes("landscap") || name.includes("plant") || name.includes("lawn")) return "leaf-outline";
  // Security Services
  if (name.includes("security") || name.includes("guard") || name.includes("watchman") || name.includes("cctv")) return "shield-checkmark-outline";
  // Pest Control
  if (name.includes("pest") || name.includes("control") || name.includes("termite") || name.includes("cockroach")) return "bug-outline";
  // Home Services / General Repair
  if (name.includes("home") || name.includes("house") || name.includes("repair") || name.includes("maintenance")) return "home-outline";
  // Carpentry / Furniture
  if (name.includes("carpen") || name.includes("furniture") || name.includes("wood") || name.includes("cabinet")) return "hammer-outline";
  // Beauty / Salon Services
  if (name.includes("beauty") || name.includes("salon") || name.includes("hair") || name.includes("facial") || name.includes("makeup")) return "cut-outline";
  // Tutoring / Education
  if (name.includes("tutor") || name.includes("teach") || name.includes("education") || name.includes("study")) return "book-outline";
  // Moving / Packers
  if (name.includes("moving") || name.includes("packer") || name.includes("relocation") || name.includes("shifting")) return "cube-outline";
  // Laundry / Dry Cleaning
  if (name.includes("laundry") || name.includes("dry") || name.includes("iron") || name.includes("cloth")) return "shirt-outline";
  // Photography / Videography
  if (name.includes("photo") || name.includes("video") || name.includes("camera") || name.includes("shoot")) return "camera-outline";
  // Catering / Food Services
  if (name.includes("cater") || name.includes("food") || name.includes("cook") || name.includes("chef")) return "restaurant-outline";
  // Event Management
  if (name.includes("event") || name.includes("party") || name.includes("wedding") || name.includes("decoration")) return "balloon-outline";
  // IT / Computer Services
  if (name.includes("computer") || name.includes("laptop") || name.includes("software") || name.includes("tech")) return "laptop-outline";
  // Delivery Services
  if (name.includes("delivery") || name.includes("courier") || name.includes("transport") || name.includes("logistics")) return "bicycle-outline";
  // Solar / Renewable Energy
  if (name.includes("solar") || name.includes("panel") || name.includes("renewable") || name.includes("energy")) return "sunny-outline";
  // Welding / Metal Work
  if (name.includes("weld") || name.includes("metal") || name.includes("steel") || name.includes("iron")) return "flame-outline";
  // Glass / Window Services
  if (name.includes("glass") || name.includes("window") || name.includes("mirror") || name.includes("glazing")) return "square-outline";
  // Locksmith Services
  if (name.includes("lock") || name.includes("key") || name.includes("door") || name.includes("safe")) return "key-outline";
  // Tile / Flooring
  if (name.includes("tile") || name.includes("floor") || name.includes("marble") || name.includes("ceramic")) return "grid-outline";
  // Roofing Services
  if (name.includes("roof") || name.includes("ceiling") || name.includes("waterproof") || name.includes("leak")) return "triangle-outline";
  
  return "construct-outline"; // default
};

export default function AllServicesScreen() {
  const navigation = useNavigation<any>();
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchServiceCategories();
  }, []);

  const fetchServiceCategories = async () => {
    try {
      setLoading(true);
      console.log('🏷️ AllServicesScreen: Fetching categories with active workers...');
      const fetchedCategories = await FirestoreService.getCategoriesWithActiveWorkers();
      
      // Log image statistics
      const categoriesWithImages = fetchedCategories.filter(cat => cat.imageUrl);
      console.log(`🖼️ AllServicesScreen: ${categoriesWithImages.length}/${fetchedCategories.length} categories have images`);
      console.log(`📊 Showing ${fetchedCategories.length} categories with active workers`);
      
      setCategories(fetchedCategories);
      setFilteredCategories(fetchedCategories);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setLoading(false);
      // Don't show alert since we have fallback data in the service
      // Alert.alert('Error', 'Failed to load service categories. Please try again.');
    }
  };

  const filterCategories = React.useCallback(() => {
    if (!searchQuery.trim()) {
      setFilteredCategories(categories);
      return;
    }

    const filtered = categories.filter(category =>
      category.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredCategories(filtered);
  }, [categories, searchQuery]);

  useEffect(() => {
    filterCategories();
  }, [filterCategories]);

  const handleServicePress = async (category: ServiceCategory) => {
    console.log('🎯 Category clicked:', category.name, category.id);
    
    // Check if category has packages before navigating
    const hasPackages = await FirestoreService.categoryHasPackages(category.id);
    
    const navigationParams = {
      serviceTitle: category.name,
      categoryId: category.id,
      allCategories: categories,
    };
    
    if (hasPackages) {
      console.log('✅ Category has packages, navigating to PackageSelection');
      navigation.navigate('PackageSelection', navigationParams);
    } else {
      console.log('✅ Category has no packages, navigating directly to ServiceCategory');
      navigation.navigate('ServiceCategory', navigationParams);
    }
  };

  const renderServiceItem = ({ item }: { item: ServiceCategory }) => (
    <TouchableOpacity
      style={styles.categoryCard}
      activeOpacity={0.7}
      onPress={() => handleServicePress(item)}
    >
      <View style={styles.categoryMedia}>
        <View style={styles.categoryIconContainer}>
          {typeof item.imageUrl === 'string' && item.imageUrl.trim().length > 0 ? (
            <ExpoImage
              source={{ uri: item.imageUrl.trim() }}
              style={styles.categoryImage}
              contentFit="cover"
              cachePolicy="disk"
              recyclingKey={String(item.id)}
              onError={() => {
                console.log(`⚠️ Failed to load image for ${item.name} in AllServices, falling back to icon`);
              }}
            />
          ) : (
            <Ionicons name={getCategoryIcon(item.name) as any} size={36} color="#00b4a0" />
          )}
        </View>
      </View>

      <View style={styles.categoryInfo}>
        <Text style={styles.categoryName} numberOfLines={3} ellipsizeMode="tail">
          {item.name}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderHeader = React.useMemo(() => (
    <View style={styles.headerContainer}>
      <View style={styles.titleContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.title}>All Categories</Text>
      </View>
      
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#64748b" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search categories..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#94a3b8"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setSearchQuery('')}
          >
            <Ionicons name="close-circle" size={20} color="#64748b" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  ), [searchQuery, navigation]);

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="search-outline" size={64} color="#cbd5e1" />
      <Text style={styles.emptyTitle}>No categories found</Text>
      <Text style={styles.emptyDescription}>
        {searchQuery ? 'Try adjusting your search terms' : 'No categories available at the moment'}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00b4a0" />
        <Text style={styles.loadingText}>Loading categories...</Text>
      </View>
    );
  }

  return (
    <ImageBackground
      source={require('../assets/serviceBG.png')}
      style={styles.container}
      resizeMode="cover"
      blurRadius={3}
    >
      <FlatList
        data={filteredCategories}
        keyExtractor={(item) => item.id}
        renderItem={renderServiceItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        numColumns={3}
        key="three-columns"
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshing={loading}
        onRefresh={fetchServiceCategories}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fdfdfd',
  },
  
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fdfdfd',
  },
  
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },
  
  listContainer: {
    paddingBottom: 32,
  },
  
  headerContainer: {
    backgroundColor: 'white',
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
  },
  
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  
  searchIcon: {
    marginRight: 12,
  },
  
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#0f172a',
    fontWeight: '400',
  },
  
  clearButton: {
    marginLeft: 8,
  },

  gridRow: {
    paddingHorizontal: 16,
    justifyContent: 'flex-start',
    gap: 8,
    marginBottom: 16,
  },

  categoryCard: {
    width: '31%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 10,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    overflow: 'hidden',
  },

  categoryMedia: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 0,
    paddingBottom: 8,
  },

  categoryIconContainer: {
    width: '100%',
    height: 104,
    borderRadius: 16,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  categoryImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },

  categoryInfo: {
    width: '100%',
    paddingHorizontal: 4,
    paddingBottom: 6,
  },

  categoryName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0f172a',
    textAlign: 'center',
    lineHeight: 14,
    minHeight: 42,
  },
  
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 48,
    paddingVertical: 64,
  },
  
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0f172a',
    marginTop: 16,
    marginBottom: 8,
  },
  
  emptyDescription: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
  },
});