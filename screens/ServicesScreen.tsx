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
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [bannersLoading, setBannersLoading] = useState(true);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
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

  // Fetch activities function
  const fetchActivities = async () => {
    try {
      setActivitiesLoading(true);
      // Try to fetch orders/bookings as activities
      const fetchedActivities = await FirestoreService.getOrders?.() || [];
      
      // Transform orders into activity format
      const transformedActivities = (fetchedActivities as any[])
        .filter(order => order.status === 'completed' || order.status === 'Completed')
        .map(order => ({
          id: order.id,
          title: `Service completed - ${order.serviceName || order.categoryName || 'Service'}`,
          timestamp: order.completedAt || order.createdAt,
        }))
        .sort((a, b) => {
          const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
          const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
          return dateB.getTime() - dateA.getTime();
        })
        .slice(0, 1);
      
      setActivities(transformedActivities || []);
    } catch (error) {
      console.error('Error fetching activities:', error);
      // Don't show error for activities, just continue without them
      setActivities([]);
    } finally {
      setActivitiesLoading(false);
    }
  };

  // Helper function to format time ago
  const getTimeAgo = (timestamp: any) => {
    if (!timestamp) return 'recently';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    
    return date.toLocaleDateString();
  };

  useEffect(() => {
    fetchServiceCategories();
    fetchServiceBanners();
    fetchActivities();
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
        activeOpacity={0.7}
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
        <Text style={styles.categorySubtitle}>Book now</Text>
      </TouchableOpacity>
    );
  };

  const renderListItem = ({ item, index }: { item: ServiceCategory; index: number }) => {
    if (!item || !item.name) return null; // Safety check
    
    const categoryStyle = getCategoryStyle(item.name, index);
    return (
      <TouchableOpacity
        style={styles.gridCard}
        activeOpacity={0.7}
        onPress={() => goTo("ServiceCategory", { serviceTitle: item.name, categoryId: item.id })}
      >
        <View style={[styles.gridIconContainer, { backgroundColor: categoryStyle.bgColor }]}>
          {item.imageUrl ? (
            <Image 
              source={{ uri: item.imageUrl }} 
              style={styles.gridCategoryImage}
              resizeMode="cover"
              onError={() => {
                console.log(`⚠️ Failed to load image for ${item.name} in list, falling back to icon`);
              }}
            />
          ) : (
            <Ionicons 
              name={categoryStyle.icon as any} 
              size={32} 
              color={categoryStyle.color} 
            />
          )}
        </View>
        <Text style={styles.gridTitle}>{item.name}</Text>
      </TouchableOpacity>
    );
  };

  const HeaderUI = () => {
    return (
      <View>
        {/* Status Bar */}
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        
        {/* Header with Image Background */}
        <ImageBackground
          source={require('../assets/8.png')}
          style={styles.topHeader}
          resizeMode="cover"
        >
          <View style={styles.headerOverlay}>
            <View style={styles.headerRow}>
              {/* Booking History Button */}
              <TouchableOpacity 
                style={styles.historyButton}
                onPress={() => navigation.navigate("BookingHistory")}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={["#ef4444", "#dc2626"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.historyButtonGradient}
                >
                  <Ionicons name="receipt-outline" size={22} color="white" />
                  <Text style={styles.historyButtonText}>History</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </ImageBackground>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={[styles.searchBar, isSearchFocused && styles.searchBarFocused]}>
            <Ionicons name="search" size={20} color="#ce0c8d" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="What do you need?"
              placeholderTextColor="#a0aec0"
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
                <Ionicons name="close-circle-sharp" size={20} color="#cbd5e1" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Show search results header when searching */}
        {searchQuery.length > 0 && (
          <View style={styles.searchResultsHeader}>
            <Text style={styles.searchResultsText}>
              Found {(filteredCategories || []).length} service{(filteredCategories || []).length !== 1 ? 's' : ''} for &quot;{searchQuery}&quot;
            </Text>
            {(filteredCategories || []).length === 0 && (
              <Text style={styles.noResultsText}>
                Try "electrician", "plumber", "cleaning", etc.
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
                  snapToInterval={width - 32}
                  decelerationRate="fast"
                  pagingEnabled={false}
                />
              </View>
            )}

            {/* Live Activity Section */}
            <View style={styles.liveActivityContainer}>
              <View style={styles.activityHeaderRow}>
                <View style={styles.activityIconBox}>
                  <Ionicons name="pulse" size={24} color="white" />
                </View>
                <Text style={styles.activityHeading}>Live Activity</Text>
              </View>
              
              {activitiesLoading ? (
                <View style={styles.activityLoadingContainer}>
                  <ActivityIndicator size="small" color="#1e40af" />
                  <Text style={styles.activityLoadingText}>Loading activities...</Text>
                </View>
              ) : activities && activities.length > 0 ? (
                activities.map((activity) => (
                  <View key={activity.id} style={styles.activityCard}>
                    <View style={styles.activityDot} />
                    <View style={styles.activityContent}>
                      <Text style={styles.activityTitle}>{activity.title}</Text>
                      <Text style={styles.activityTime}>{getTimeAgo(activity.timestamp)}</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.noActivityText}>No recent activities</Text>
              )}
            </View>

            {/* All Services List Header */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>All Professional Services</Text>
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
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          key="two-columns"
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
    backgroundColor: "#f5f7fb",
  },

  // Header Styles
  topHeader: {
    height: 215,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: "hidden",
  },

  headerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 2,
    paddingTop: 40,
    paddingBottom: 32,
    justifyContent: "flex-start",
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },

  headerTextContainer: {
    flex: 1,
  },

  historyButton: {
    borderRadius: 25,
    elevation: 8,
    shadowColor: '#ef4444',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },

  historyButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },

  historyButtonText: {
    color: "white",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  header: {
    fontSize: 32,
    fontWeight: "800",
    color: "white",
    letterSpacing: -0.5,
    marginBottom: 8,
  },

  headerSub: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },

  // Search Bar Styles
  searchContainer: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: "#f5f7fb",
    marginTop: -20,
    paddingBottom: 30,
  },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: "#e8ecf1",
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },

  searchBarFocused: {
    borderColor: "#1e40af",
    backgroundColor: "white",
    elevation: 5,
    shadowColor: '#1e40af',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },

  searchIcon: {
    marginRight: 12,
  },

  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#1e293b",
    fontWeight: "500",
  },

  clearButton: {
    padding: 4,
    marginLeft: 8,
  },

  searchResultsHeader: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: "#f5f7fb",
    borderBottomWidth: 1,
    borderBottomColor: "#e8ecf1",
  },

  searchResultsText: {
    fontSize: 14,
    color: "#1e40af",
    fontWeight: "600",
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
    borderRadius: 24,
    overflow: "hidden",
    height: 180,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
  },

  bannerImage: {
    width: "100%",
    height: 180,
    borderRadius: 24,
    overflow: "hidden",
  },

  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 24,
  },

  bannerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 24,
    height: "100%",
  },

  bannerTextSection: {
    flex: 1,
  },

  bannerTitle: {
    color: "white",
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.3,
    marginBottom: 8,
  },

  bannerSubTitle: {
    color: "rgba(255,255,255,0.95)",
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
    marginBottom: 12,
  },

  bannerOffer: {
    backgroundColor: "rgba(255,255,255,0.25)",
    backdropFilter: "blur(10px)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },

  offerText: {
    color: "white",
    fontSize: 13,
    fontWeight: "700",
  },

  bannerIcon: {
    marginLeft: 16,
  },

  // Section Styles
  sectionContainer: {
    paddingHorizontal: 24,
    marginBottom: 28,
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },

  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.3,
  },

  // Live Activity Container Styles
  liveActivityContainer: {
    marginHorizontal: 24,
    marginBottom: 28,
    paddingVertical: 50,
    paddingHorizontal: 40,
    backgroundColor: "white",
    borderRadius: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: "#e8ecf1",
  },

  // Live Activity Section Styles
  activityHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f4f8",
  },

  activityIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#f59e0b",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    elevation: 3,
    shadowColor: '#f59e0b',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },

  activityHeading: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1e293b",
    flex: 1,
  },

  activityCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "transparent",
    paddingVertical: 16,
    paddingHorizontal: 0,
    marginBottom: 0,
    borderRadius: 0,
    borderWidth: 0,
  },

  activityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#10b981",
    marginTop: 4,
    marginRight: 12,
    flexShrink: 0,
  },

  activityContent: {
    flex: 1,
  },

  activityTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 6,
    lineHeight: 20,
  },

  activityTime: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },

  activityLoadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },

  activityLoadingText: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
    marginLeft: 8,
  },

  noActivityText: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
    textAlign: "center",
    paddingVertical: 20,
  },

  // Category Styles
  categoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    gap: 12,
  },

  categoryCard: {
    width: (width - 72) / 3,
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 12,
    alignItems: "center",
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 10,
  },

  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    overflow: "hidden",
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },

  categoryImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },

  categoryIcon: {
    width: 32,
    height: 32,
  },

  categoryTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
    marginBottom: 4,
  },

  categorySubtitle: {
    fontSize: 11,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 15,
    fontWeight: "400",
  },

  // List Styles
  listCard: {
    marginBottom: 14,
    backgroundColor: "white",
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 18,
    marginHorizontal: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f0f4f8",
  },

  listIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
    overflow: "hidden",
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },

  listCategoryImage: {
    width: 50,
    height: 50,
    borderRadius: 16,
  },

  listContent: {
    flex: 1,
  },

  listTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    letterSpacing: -0.2,
    marginBottom: 4,
  },

  listSubtitle: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "400",
    marginBottom: 3,
  },

  listAvailability: {
    color: "#1e40af",
    fontSize: 12,
    fontWeight: "600",
  },

  listArrowContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: '#1e40af',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },

  // Grid Styles (2 columns)
  gridRow: {
    paddingHorizontal: 16,
    justifyContent: "space-between",
    marginBottom: 16,
  },

  gridCard: {
    width: (width - 48) / 2,
    backgroundColor: "white",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: "#f0f4f8",
  },

  gridIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    overflow: "hidden",
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },

  gridCategoryImage: {
    width: 80,
    height: 80,
    borderRadius: 20,
  },

  gridTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
    letterSpacing: -0.2,
  },

  // Loading and Empty States
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#1e40af",
    fontWeight: "600",
  },

  emptyLoadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },

  emptyLoadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#1e40af",
    fontWeight: "600",
  },

  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    paddingHorizontal: 48,
  },

  emptyText: {
    fontSize: 16,
    color: "#64748b",
    fontWeight: "600",
    textAlign: "center",
  },

  emptySubText: {
    fontSize: 13,
    color: "#94a3b8",
    fontWeight: "400",
    textAlign: "center",
    marginTop: 8,
  },

  emptyIcon: {
    marginBottom: 16,
    alignSelf: "center",
    color: "#cbd5e1",
  },

  // Error States
  errorContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },

  errorText: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 16,
    marginTop: 12,
  },

  retryButton: {
    backgroundColor: "#1e40af",
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#1e40af',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
  },

  retryText: {
    color: "white",
    fontSize: 14,
    fontWeight: "700",
  },
});
