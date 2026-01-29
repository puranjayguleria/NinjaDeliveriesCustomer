import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  TextInput,
  Alert,
} from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from '@expo/vector-icons';
import { FirestoreService, ServiceCategory } from '../services/firestoreService';
import { FirebaseConnectionTest } from '../utils/testFirebaseConnection';

const { width } = Dimensions.get('window');

// Function to get icon and colors based on service category name
const getCategoryStyle = (categoryName: string, index: number) => {
  const name = categoryName.toLowerCase();
  
  // Icon mapping based on category name
  let icon = "construct-outline"; // default
  let color = "#64748b";
  let bgColor = "#f1f5f9";
  
  // Electrical Services
  if (name.includes("electric") || name.includes("wiring") || name.includes("voltage")) {
    icon = "flash-outline";
    color = "#F59E0B";
    bgColor = "#FFFBEB";
  } 
  // Plumbing Services
  else if (name.includes("plumb") || name.includes("pipe") || name.includes("water") || name.includes("drain")) {
    icon = "water-outline";
    color = "#3B82F6";
    bgColor = "#EFF6FF";
  } 
  // Car Wash / Vehicle Cleaning (check before general cleaning)
  else if (name.includes("car") && name.includes("clean")) {
    icon = "water-outline";
    color = "#0EA5E9";
    bgColor = "#F0F9FF";
  }
  else if (name.includes("car") || name.includes("wash") || name.includes("vehicle") || name.includes("auto") || name.includes("bike")) {
    icon = "water-outline";
    color = "#0EA5E9";
    bgColor = "#F0F9FF";
  } 
  // Home Cleaning Services (check before general cleaning)
  else if ((name.includes("home") && name.includes("clean")) || name.includes("housekeep") || name.includes("maid") || name.includes("domestic")) {
    icon = "home-outline";
    color = "#10B981";
    bgColor = "#ECFDF5";
  }
  // General Cleaning Services
  else if (name.includes("clean") || name.includes("sanitiz")) {
    icon = "sparkles-outline";
    color = "#06B6D4";
    bgColor = "#ECFEFF";
  } 
  // Health & Fitness
  else if (name.includes("health") || name.includes("fitness") || name.includes("yoga") || name.includes("physio") || name.includes("massage") || name.includes("therapy")) {
    icon = "fitness-outline";
    color = "#10B981";
    bgColor = "#ECFDF5";
  } 
  // Daily Wages / Labor
  else if (name.includes("daily") || name.includes("wage") || name.includes("worker") || name.includes("labor") || name.includes("helper")) {
    icon = "people-outline";
    color = "#8B5CF6";
    bgColor = "#F3E8FF";
  } 
  // AC / Cooling Services
  else if (name.includes("ac") || name.includes("air") || name.includes("condition") || name.includes("cooling") || name.includes("hvac")) {
    icon = "snow-outline";
    color = "#0EA5E9";
    bgColor = "#F0F9FF";
  } 
  else {
    // Fallback to index-based colors for unknown categories
    const fallbackColors = [
      { color: "#3B82F6", bgColor: "#EFF6FF", icon: "construct-outline" },
      { color: "#10B981", bgColor: "#ECFDF5", icon: "build-outline" },
      { color: "#F59E0B", bgColor: "#FFFBEB", icon: "hammer-outline" },
      { color: "#EF4444", bgColor: "#FEF2F2", icon: "settings-outline" },
      { color: "#8B5CF6", bgColor: "#F3E8FF", icon: "cog-outline" },
      { color: "#06B6D4", bgColor: "#ECFEFF", icon: "wrench-outline" },
    ];
    const fallback = fallbackColors[index % fallbackColors.length];
    icon = fallback.icon;
    color = fallback.color;
    bgColor = fallback.bgColor;
  }
  
  return { icon, color, bgColor };
};

// const SERVICES = [
//   {
//     id: "home-repair",
//     title: "Home Repair",
//     subtitle: "Electrician, plumber, etc.",
//     icon: "home-outline",
//     screen: "ServiceCategory",
//     params: { serviceTitle: "Electrician" },
//     color: "#3B82F6",
//     bgColor: "#EFF6FF",
//   },
//   {
//     id: "health",
//     title: "Health",
//     subtitle: "Physio, yoga, gym",
//     icon: "fitness-outline",
//     screen: "HealthCategory",
//     params: { serviceTitle: "Health" },
//     color: "#10B981",
//     bgColor: "#ECFDF5",
//   },
//   {
//     id: "daily-wages",
//     title: "Daily Wages",
//     subtitle: "Half day / Full day",
//     icon: "people-outline",
//     screen: "DailyWagesCategory",
//     params: { serviceTitle: "Daily Wages" },
//     color: "#F59E0B",
//     bgColor: "#FFFBEB",
//   },
// ];

const POPULAR = [
  {
    id: "electrician",
    title: "Electrician",
    subtitle: "Quick & reliable repairs",
    image: require("../assets/images/card_electrician.png"),
    screen: "ServiceCategory",
    params: { serviceTitle: "Electrician" },
    rating: "4.8",
    bookings: "2.5k+",
  },
  {
    id: "plumber",
    title: "Plumber",
    subtitle: "Emergency plumbing services",
    image: require("../assets/images/card_acrepair.png"),
    screen: "ServiceCategory",
    params: { serviceTitle: "Plumber" },
    rating: "4.7",
    bookings: "1.8k+",
  },
  {
    id: "cleaning",
    title: "Cleaning",
    subtitle: "Deep cleaning specialists",
    image: require("../assets/images/icon_cleaning.png"),
    screen: "CleaningCategory",
    params: { serviceTitle: "Cleaning" },
    rating: "4.9",
    bookings: "3.2k+",
  },
  {
    id: "car-wash",
    title: "Car Wash",
    subtitle: "Premium car care",
    image: require("../assets/images/car_wash.jpg"),
    screen: "CarWashCategory",
    params: { serviceTitle: "Car Wash" },
    rating: "4.6",
    bookings: "1.2k+",
  },
];

// Remove unused constants
// const ALL_SERVICES = [
//   {
//     id: "1",
//     title: "Electrician",
//     subtitle: "Wiring, repairs & installations",
//     screen: "ServiceCategory",
//     params: { serviceTitle: "Electrician" },
//     icon: "flash-outline",
//     availability: "Available 24/7",
//   },
//   {
//     id: "2",
//     title: "Plumber",
//     subtitle: "Pipe repairs & water solutions",
//     screen: "ServiceCategory",
//     params: { serviceTitle: "Plumber" },
//     icon: "water-outline",
//     availability: "Emergency service",
//   },
//   {
//     id: "3",
//     title: "Health",
//     subtitle: "Wellness & fitness services",
//     screen: "HealthCategory",
//     params: { serviceTitle: "Health" },
//     icon: "fitness-outline",
//     availability: "Book sessions",
//   },
//   {
//     id: "4",
//     title: "Cleaning",
//     subtitle: "Deep cleaning & maintenance",
//     screen: "CleaningCategory",
//     params: { serviceTitle: "Cleaning" },
//     icon: "sparkles-outline",
//     availability: "Same day service",
//   },
//   {
//     id: "5",
//     title: "Daily Wages",
//     subtitle: "Skilled workers for hire",
//     screen: "DailyWagesCategory",
//     params: { serviceTitle: "Daily Wages" },
//     icon: "people-outline",
//     availability: "Flexible hours",
//   },
//   {
//     id: "6",
//     title: "Car Wash",
//     subtitle: "Premium car care services",
//     screen: "CarWashCategory",
//     params: { serviceTitle: "Car Wash" },
//     icon: "car-outline",
//     availability: "Doorstep service",
//   },
// ];

export default function ServicesScreen() {
  const navigation = useNavigation<any>();
  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Fetch function
  const fetchServiceCategories = async () => {
    try {
      setLoading(true);
      setError(null);
      const categories = await FirestoreService.getServiceCategories();
      setServiceCategories(categories || []);
    } catch (error) {
      console.error('Error fetching service categories:', error);
      setError('Failed to load services. Please check your internet connection and try again.');
      setServiceCategories([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServiceCategories();
  }, []);

  // Search functionality - simplified without useMemo to avoid React null error
  const getFilteredCategories = () => {
    if (!searchQuery.trim()) {
      return serviceCategories || [];
    }
    
    const query = searchQuery.toLowerCase().trim();
    return (serviceCategories || []).filter(category =>
      (category && category.name && category.name.toLowerCase().includes(query)) ||
      (category && category.name && category.name.toLowerCase().replace(/\s+/g, '').includes(query.replace(/\s+/g, '')))
    );
  };

  const filteredCategories = getFilteredCategories();

  // Navigation functions
  const goTo = (screen: string, params: any) => {
    navigation.navigate(screen, params);
  };

  const handleMonsoonSpecial = () => {
    navigation.navigate("ServiceCategory", { 
      serviceTitle: "Monsoon Special",
      specialOffer: true,
      discount: 30
    });
  };

  const handleViewAllPopular = () => {
    navigation.navigate("AllServices");
  };

  const handleViewAllCategories = () => {
    navigation.navigate("AllServices");
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  // Data slices with null checks
  const topCategories = searchQuery 
    ? (filteredCategories || []).slice(0, 3) 
    : (serviceCategories || []).slice(0, 3);
    
  const listCategories = searchQuery 
    ? (filteredCategories || []).slice(0, 20) 
    : (serviceCategories || []).slice(0, 6);

  // Render functions
  const renderCategoryCard = ({ item, index }: { item: ServiceCategory; index: number }) => {
    if (!item || !item.name) return null; // Safety check
    
    const categoryStyle = getCategoryStyle(item.name, index);
    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.categoryCard, { backgroundColor: categoryStyle.bgColor }]}
        activeOpacity={0.8}
        onPress={() => goTo("ServiceCategory", { serviceTitle: item.name, categoryId: item.id })}
      >
        <View style={[styles.iconContainer, { backgroundColor: categoryStyle.color }]}>
          <Ionicons name={categoryStyle.icon as any} size={28} color="white" />
        </View>
        <Text style={styles.categoryTitle}>{item.name}</Text>
        <Text style={styles.categorySubtitle}>Professional service</Text>
      </TouchableOpacity>
    );
  };

  const renderListItem = ({ item, index }: { item: ServiceCategory; index: number }) => {
    if (!item || !item.name) return null; // Safety check
    
    const categoryStyle = getCategoryStyle(item.name, index);
    return (
      <TouchableOpacity
        style={styles.listCard}
        activeOpacity={0.8}
        onPress={() => goTo("ServiceCategory", { serviceTitle: item.name, categoryId: item.id })}
      >
        <View style={[styles.listIconContainer, { backgroundColor: categoryStyle.bgColor }]}>
          <Ionicons 
            name={categoryStyle.icon as any} 
            size={24} 
            color={categoryStyle.color} 
          />
        </View>
        <View style={styles.listContent}>
          <Text style={styles.listTitle}>{item.name}</Text>
          <Text style={styles.listSubtitle}>Professional {item.name.toLowerCase()} services</Text>
          <Text style={styles.listAvailability}>Available now</Text>
        </View>
        <View style={styles.listArrowContainer}>
          <Ionicons name="chevron-forward" size={20} color="#64748b" />
        </View>
      </TouchableOpacity>
    );
  };

  const renderPopularCard = (item: any) => {
    if (!item || !item.id) return null; // Safety check
    
    return (
      <TouchableOpacity
        key={item.id}
        style={styles.popularCard}
        activeOpacity={0.9}
        onPress={() => goTo(item.screen, item.params)}
      >
        <ImageBackground
          source={item.image}
          style={styles.popularBg}
          imageStyle={styles.popularBgImage}
        >
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)']}
            style={styles.popularGradient}
          >
            <View style={styles.popularContent}>
              <View style={styles.popularStats}>
                <View style={styles.statItem}>
                  <Text style={styles.statIcon}>⭐</Text>
                  <Text style={styles.statText}>{item.rating}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statText}>{item.bookings}</Text>
                </View>
              </View>
              <Text style={styles.popularTitle}>{item.title}</Text>
              <Text style={styles.popularSubtitle}>{item.subtitle}</Text>
            </View>
          </LinearGradient>
        </ImageBackground>
      </TouchableOpacity>
    );
  };

  const HeaderUI = () => {
    return (
      <View>
        {/* Status Bar */}
        <StatusBar barStyle="dark-content" backgroundColor="white" />
        
        {/* Header */}
        <View style={styles.topHeader}>
          <View style={styles.headerRow}>
            {/* Header content only */}
            <View style={styles.headerTextContainer}>
              <Text style={styles.header}>Professional Services</Text>
              <Text style={styles.headerSub}>
                Trusted experts at your doorstep
              </Text>
            </View>
            
            {/* Debug button for development */}
            {__DEV__ && (
              <TouchableOpacity 
                style={styles.debugButton}
                onPress={async () => {
                  await FirestoreService.debugAppServicesData();
                  Alert.alert('Debug Complete', 'Check console for app_services data');
                }}
              >
                <Text style={styles.debugButtonText}>Debug Data</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={[styles.searchBar, isSearchFocused && styles.searchBarFocused]}>
            <Ionicons name="search" size={20} color="#64748b" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search for services..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={handleSearch}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
                <Ionicons name="close-circle" size={20} color="#64748b" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Show search results header when searching */}
        {searchQuery.length > 0 && (
          <View style={styles.searchResultsHeader}>
            <Text style={styles.searchResultsText}>
              {(filteredCategories || []).length} service{(filteredCategories || []).length !== 1 ? 's' : ''} found for "{searchQuery}"
            </Text>
            {(filteredCategories || []).length === 0 && (
              <Text style={styles.noResultsText}>
                Try searching for "electrician", "plumber", "cleaning", etc.
              </Text>
            )}
          </View>
        )}

        {/* Only show banner and sections when not searching */}
        {searchQuery.length === 0 && (
          <>
            {/* Premium Banner */}
            <View style={styles.bannerContainer}>
              <TouchableOpacity 
                activeOpacity={0.9}
                onPress={handleMonsoonSpecial}
              >
                <LinearGradient
                  colors={['#667eea', '#764ba2']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.gradientBanner}
                >
                  <View style={styles.bannerContent}>
                    <View style={styles.bannerTextSection}>
                      <Text style={styles.bannerTitle}>Monsoon Special</Text>
                      <Text style={styles.bannerSubTitle}>
                        Leak Proofing & Geyser Repair
                      </Text>
                      <View style={styles.bannerOffer}>
                        <Text style={styles.offerText}>Up to 30% OFF</Text>
                      </View>
                    </View>
                    <View style={styles.bannerIcon}>
                      <Ionicons name="umbrella" size={40} color="white" />
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Service Categories */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Service Categories</Text>
                <TouchableOpacity 
                  onPress={handleViewAllCategories}
                  activeOpacity={0.7}
                >
                  <Text style={styles.viewAllText}>View All</Text>
                </TouchableOpacity>
              </View>
              
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#3b82f6" />
                  <Text style={styles.loadingText}>Loading categories...</Text>
                </View>
              ) : error ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                  <TouchableOpacity onPress={fetchServiceCategories} style={styles.retryButton}>
                    <Text style={styles.retryText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.categoryRow}>
                  {(topCategories || []).filter(Boolean).map((item, index) => renderCategoryCard({ item, index }))}
                </View>
              )}
            </View>

            {/* Popular Services */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Popular Near You</Text>
                <TouchableOpacity 
                  onPress={handleViewAllPopular}
                  activeOpacity={0.7}
                >
                  <Text style={styles.viewAllText}>View All</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.popularRow}>
                {(POPULAR || []).filter(Boolean).map(renderPopularCard)}
              </View>
            </View>

            {/* All Services Header */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>All Services</Text>
                <TouchableOpacity 
                  onPress={handleViewAllCategories}
                  activeOpacity={0.7}
                >
                  <Text style={styles.viewAllText}>View All</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Add safety check for initial render */}
      {!serviceCategories && loading ? (
        <View style={styles.emptyLoadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.emptyLoadingText}>Loading services...</Text>
        </View>
      ) : (
        <FlatList
          data={loading ? [] : (listCategories || [])}
          keyExtractor={(item) => item?.id || Math.random().toString()}
          ListHeaderComponent={HeaderUI}
          renderItem={renderListItem}
          ListEmptyComponent={
            loading ? (
              <View style={styles.emptyLoadingContainer}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={styles.emptyLoadingText}>Loading services...</Text>
              </View>
            ) : error ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>{error}</Text>
                <TouchableOpacity onPress={fetchServiceCategories} style={styles.retryButton}>
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : searchQuery.length > 0 && (filteredCategories || []).length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="search" size={48} color="#cbd5e1" style={styles.emptyIcon} />
                <Text style={styles.emptyText}>No services found</Text>
                <Text style={styles.emptySubText}>Try searching with different keywords</Text>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No services available</Text>
              </View>
            )
          }
          contentContainerStyle={{ paddingBottom: 30 }}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={fetchServiceCategories}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={10}
          initialNumToRender={searchQuery ? 20 : 6}
          getItemLayout={(data, index) => ({
            length: 100, // Approximate item height
            offset: 100 * index,
            index,
          })}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },

  // Header Styles
  topHeader: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },

  headerTextContainer: {
    flex: 1,
  },

  header: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0f172a",
    letterSpacing: -0.5,
    marginBottom: 6,
  },

  headerSub: {
    color: "#64748b",
    fontSize: 16,
    fontWeight: "400",
    lineHeight: 24,
  },

  // Search Bar Styles
  searchContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  searchBarFocused: {
    borderColor: "#3b82f6",
    backgroundColor: "white",
    elevation: 2,
    shadowColor: '#3b82f6',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },

  searchIcon: {
    marginRight: 12,
  },

  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#0f172a",
    fontWeight: "400",
  },

  clearButton: {
    padding: 4,
    marginLeft: 8,
  },

  searchResultsHeader: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },

  searchResultsText: {
    fontSize: 14,
    color: "#475569",
    fontWeight: "500",
    marginBottom: 4,
  },

  noResultsText: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "400",
  },

  headerBadge: {
    backgroundColor: "#10b981",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },

  badgeText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },

  // Debug button for development
  debugButton: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 12,
  },

  debugButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },

  // Banner Styles
  bannerContainer: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },

  gradientBanner: {
    borderRadius: 20,
    overflow: "hidden",
  },

  bannerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 24,
  },

  bannerTextSection: {
    flex: 1,
  },

  bannerTitle: {
    color: "white",
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.3,
    marginBottom: 6,
  },

  bannerSubTitle: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 16,
    fontWeight: "400",
    lineHeight: 22,
    marginBottom: 12,
  },

  bannerOffer: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: "flex-start",
  },

  offerText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },

  bannerIcon: {
    marginLeft: 16,
  },

  // Section Styles
  sectionContainer: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },

  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
    letterSpacing: -0.3,
  },

  viewAllText: {
    color: "#3b82f6",
    fontSize: 14,
    fontWeight: "600",
  },

  // Category Styles
  categoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },

  categoryCard: {
    width: (width - 72) / 3,
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: "center",
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },

  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  categoryIcon: {
    width: 28,
    height: 28,
  },

  categoryTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
    textAlign: "center",
    marginBottom: 4,
  },

  categorySubtitle: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 16,
  },

  // Popular Services Styles
  popularRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 16,
  },

  popularCard: {
    width: (width - 64) / 2,
    height: 160,
    borderRadius: 20,
    overflow: "hidden",
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },

  popularBg: {
    flex: 1,
  },

  popularBgImage: {
    borderRadius: 20,
  },

  popularGradient: {
    flex: 1,
    justifyContent: "flex-end",
  },

  popularContent: {
    padding: 16,
  },

  popularStats: {
    flexDirection: "row",
    marginBottom: 8,
    gap: 12,
  },

  statItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },

  statIcon: {
    fontSize: 12,
    marginRight: 4,
  },

  statText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },

  popularTitle: {
    color: "white",
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: -0.2,
    marginBottom: 4,
  },

  popularSubtitle: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    fontWeight: "400",
  },

  // List Styles
  listCard: {
    marginBottom: 16,
    backgroundColor: "white",
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginHorizontal: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    flexDirection: "row",
    alignItems: "center",
  },

  listIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },

  listContent: {
    flex: 1,
  },

  listTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
    letterSpacing: -0.2,
    marginBottom: 4,
  },

  listSubtitle: {
    color: "#64748b",
    fontSize: 14,
    fontWeight: "400",
    marginBottom: 4,
  },

  listAvailability: {
    color: "#10b981",
    fontSize: 12,
    fontWeight: "500",
  },

  listArrowContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },

  // Loading and Empty States
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748b",
    fontWeight: "400",
  },

  emptyLoadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
  },

  emptyLoadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#64748b",
    fontWeight: "500",
  },

  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
    paddingHorizontal: 48,
  },

  emptyText: {
    fontSize: 16,
    color: "#64748b",
    fontWeight: "400",
    textAlign: "center",
  },

  emptySubText: {
    fontSize: 14,
    color: "#94a3b8",
    fontWeight: "400",
    textAlign: "center",
    marginTop: 8,
  },

  emptyIcon: {
    marginBottom: 16,
    alignSelf: "center",
  },

  // Error States
  errorContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
  },

  errorText: {
    fontSize: 14,
    color: "#ef4444",
    fontWeight: "400",
    textAlign: "center",
    marginBottom: 12,
  },

  retryButton: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },

  retryText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
});
