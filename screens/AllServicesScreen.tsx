import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
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

  useEffect(() => {
    filterCategories();
  }, [searchQuery, categories]);

  const fetchServiceCategories = async () => {
    try {
      setLoading(true);
      console.log('🏷️ AllServicesScreen: Fetching service categories with images...');
      const fetchedCategories = await FirestoreService.getServiceCategories();
      
      // Log image statistics
      const categoriesWithImages = fetchedCategories.filter(cat => cat.imageUrl);
      console.log(`🖼️ AllServicesScreen: ${categoriesWithImages.length}/${fetchedCategories.length} categories have images`);
      
      setCategories(fetchedCategories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      // Don't show alert since we have fallback data in the service
      // Alert.alert('Error', 'Failed to load service categories. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filterCategories = () => {
    if (!searchQuery.trim()) {
      setFilteredCategories(categories);
      return;
    }

    const filtered = categories.filter(category =>
      category.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredCategories(filtered);
  };

  const handleServicePress = (category: ServiceCategory) => {
    // Navigate to the appropriate service category screen
    // You can customize this based on your navigation structure
    navigation.navigate('ServiceCategory', {
      serviceTitle: category.name,
      categoryId: category.id,
    });
  };

  const renderServiceItem = ({ item }: { item: ServiceCategory }) => (
    <TouchableOpacity
      style={styles.serviceCard}
      activeOpacity={0.8}
      onPress={() => handleServicePress(item)}
    >
      <View style={styles.serviceIconContainer}>
        {item.imageUrl ? (
          <Image 
            source={{ uri: item.imageUrl }} 
            style={styles.serviceImage}
            resizeMode="cover"
            onError={() => {
              console.log(`⚠️ Failed to load image for ${item.name} in AllServices, falling back to icon`);
            }}
          />
        ) : (
          <Ionicons name={getCategoryIcon(item.name) as any} size={24} color="#64748b" />
        )}
      </View>
      <View style={styles.serviceContent}>
        <Text style={styles.serviceName}>{item.name}</Text>
        <Text style={styles.serviceDescription}>Professional service available</Text>
      </View>
      <View style={styles.serviceArrow}>
        <Ionicons name="chevron-forward" size={20} color="#64748b" />
      </View>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.titleContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.title}>All Services</Text>
      </View>
      
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#64748b" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search services..."
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
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="search-outline" size={64} color="#cbd5e1" />
      <Text style={styles.emptyTitle}>No services found</Text>
      <Text style={styles.emptyDescription}>
        {searchQuery ? 'Try adjusting your search terms' : 'No services available at the moment'}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading services...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredCategories}
        keyExtractor={(item) => item.id}
        renderItem={renderServiceItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshing={loading}
        onRefresh={fetchServiceCategories}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
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
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
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
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
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
    fontSize: 16,
    color: '#0f172a',
    fontWeight: '400',
  },
  
  clearButton: {
    marginLeft: 8,
  },
  
  serviceCard: {
    backgroundColor: 'white',
    marginHorizontal: 24,
    marginBottom: 16,
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  
  serviceIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    overflow: 'hidden', // Added for image clipping
  },

  serviceImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  
  serviceContent: {
    flex: 1,
  },
  
  serviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  
  serviceDescription: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '400',
  },
  
  serviceArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
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