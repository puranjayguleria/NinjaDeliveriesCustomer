import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  TextInput,
  Image,
  ImageBackground,
  ScrollView,
} from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from '@expo/vector-icons';
import { FirestoreService, ServiceCategory, ServiceBanner } from '../services/firestoreService';

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
  const [serviceBanners, setServiceBanners] = useState<ServiceBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [bannersLoading, setBannersLoading] = useState(true);
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

  // Fetch banners function
  const fetchServiceBanners = async () => {
    try {
      setBannersLoading(true);
      const banners = await FirestoreService.getServiceBanners();
      setServiceBanners(banners || []);
    } catch (error) {
      console.error('Error fetching service banners:', error);
      // Don't show error for banners, just continue without them
      setServiceBanners([]);
    } finally {
      setBannersLoading(false);
    }
  };

  useEffect(() => {
    fetchServiceCategories();
    fetchServiceBanners();
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

  const handleBannerPress = (banner: ServiceBanner) => {
    if (!banner.clickable) return;

    if (banner.redirectType === "ServiceCategory" && banner.categoryId) {
      navigation.navigate("ServiceCategory", { 
        serviceTitle: banner.title,
        categoryId: banner.categoryId
      });
    } else if (banner.redirectType === "AllServices") {
      navigation.navigate("AllServices");
    } else if (banner.redirectUrl) {
      // Handle external URLs or other navigation
      console.log('Banner redirect URL:', banner.redirectUrl);
    }
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
  const renderBanner = ({ item: banner, index }: { item: ServiceBanner; index: number }) => {
    const backgroundColor = banner.backgroundColor || '#667eea';
    const textColor = banner.textColor || 'white';

    return (
      <TouchableOpacity 
        key={banner.id}
        activeOpacity={0.9}
        onPress={() => handleBannerPress(banner)}
        style={styles.bannerItem}
      >
        {banner.imageUrl ? (
          <ImageBackground 
            source={{ uri: banner.imageUrl }} 
            style={styles.bannerImage}
            resizeMode="cover"
          >
            <View style={styles.bannerOverlay}>
              <View style={styles.bannerContent}>
                <View style={styles.bannerTextSection}>
                  <Text style={[styles.bannerTitle, { color: textColor }]}>
                    {banner.title}
                  </Text>
                  {banner.subtitle && (
                    <Text style={[styles.bannerSubTitle, { color: textColor }]}>
                      {banner.subtitle}
                    </Text>
                  )}
                  {banner.offerText && (
                    <View style={styles.bannerOffer}>
                      <Text style={styles.offerText}>{banner.offerText}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </ImageBackground>
        ) : (
          <LinearGradient
            colors={[backgroundColor, backgroundColor + 'CC']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientBanner}
          >
            <View style={styles.bannerContent}>
              <View style={styles.bannerTextSection}>
                <Text style={[styles.bannerTitle, { color: textColor }]}>
                  {banner.title}
                </Text>
                {banner.subtitle && (
                  <Text style={[styles.bannerSubTitle, { color: textColor }]}>
                    {banner.subtitle}
                  </Text>
                )}
                {banner.offerText && (
                  <View style={styles.bannerOffer}>
                    <Text style={styles.offerText}>{banner.offerText}</Text>
                  </View>
                )}
              </View>
            </View>
          </LinearGradient>
        )}
      </TouchableOpacity>
    );
  };

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
          {item.imageUrl ? (
            <Image 
              source={{ uri: item.imageUrl }} 
              style={styles.categoryImage}
              resizeMode="cover"
              onError={() => {
                console.log(`⚠️ Failed to load image for ${item.name}, falling back to icon`);
              }}
            />
          ) : (
            <Ionicons name={categoryStyle.icon as any} size={28} color="white" />
          )}
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
          {item.imageUrl ? (
            <Image 
              source={{ uri: item.imageUrl }} 
              style={styles.listCategoryImage}
              resizeMode="cover"
              onError={() => {
                console.log(`⚠️ Failed to load image for ${item.name} in list, falling back to icon`);
              }}
            />
          ) : (
            <Ionicons 
              name={categoryStyle.icon as any} 
              size={24} 
              color={categoryStyle.color} 
            />
          )}
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
            
            {/* Booking History Button */}
            <TouchableOpacity 
              style={styles.historyButton}
              onPress={() => navigation.navigate("BookingHistory")}
              activeOpacity={0.8}
            >
              <Ionicons name="receipt-outline" size={22} color="#3b82f6" />
            </TouchableOpacity>
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
              {(filteredCategories || []).length} service{(filteredCategories || []).length !== 1 ? 's' : ''} found for &quot;{searchQuery}&quot;
            </Text>
            {(filteredCategories || []).length === 0 && (
              <Text style={styles.noResultsText}>
                Try searching for &quot;electrician&quot;, &quot;plumber&quot;, &quot;cleaning&quot;, etc.
              </Text>
            )}
          </View>
        )}

        {/* Only show banner and sections when not searching */}
        {searchQuery.length === 0 && (
          <>
            {/* Service Banners */}
            {!bannersLoading && serviceBanners.length > 0 && (
              <View style={styles.bannerContainer}>
                <FlatList
                  data={serviceBanners}
                  renderItem={renderBanner}
                  keyExtractor={(item) => item.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.bannerScrollContent}
                  snapToInterval={width - 32} // Snap to each banner
                  decelerationRate="fast"
                  pagingEnabled={false}
                />
              </View>
            )}

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
          onRefresh={() => {
            fetchServiceCategories();
            fetchServiceBanners();
          }}
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

  historyButton: {
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
    backgroundColor: "white",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 3,
    shadowColor: '#3b82f6',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
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

  // Banner Styles
  bannerContainer: {
    paddingVertical: 20,
  },

  bannerScrollContent: {
    paddingHorizontal: 16,
  },

  bannerItem: {
    width: width - 48,
    marginHorizontal: 8,
  },

  gradientBanner: {
    borderRadius: 20,
    overflow: "hidden",
    height: 140,
  },

  bannerImage: {
    width: "100%",
    height: 140,
    borderRadius: 20,
    overflow: "hidden",
  },

  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 20,
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
    overflow: "hidden", // Added for image clipping
  },

  categoryImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
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
    overflow: "hidden", // Added for image clipping
  },

  listCategoryImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
