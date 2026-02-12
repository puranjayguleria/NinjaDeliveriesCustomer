import React, { useState, useEffect, useCallback } from "react";
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
  Animated,
  RefreshControl,
} from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons } from '@expo/vector-icons';
import { FirestoreService, ServiceCategory, ServiceBanner } from '../services/firestoreService';
import { firestore } from '../firebase.native';

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
  const [refreshing, setRefreshing] = useState(false);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const searchInputRef = React.useRef<TextInput>(null);
  const bannerScrollRef = React.useRef<FlatList>(null);
  const currentBannerIndex = React.useRef(0);
  const blinkAnim = React.useRef(new Animated.Value(1)).current;

  // Manual refresh function
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Real-time listeners will automatically fetch fresh data
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  // Re-subscribe to listeners when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('📱 ServicesScreen focused - real-time listeners active');
      return () => {
        console.log('📱 ServicesScreen unfocused');
      };
    }, [])
  );

  // Real-time listener for service categories
  useEffect(() => {
    console.log('🔥 Setting up real-time listener for service categories...');
    setLoading(true);
    setError(null);

    const unsubscribe = firestore()
      .collection('app_categories')
      .where('isActive', '==', true)
      .onSnapshot(
        async (snapshot) => {
          try {
            console.log(`📊 Real-time update: Found ${snapshot.size} active categories at ${new Date().toLocaleTimeString()}`);
            
            const allCategories: ServiceCategory[] = [];
            
            snapshot.forEach(doc => {
              const data = doc.data();
              const category = {
                id: doc.id,
                name: data.name || '',
                isActive: data.isActive || false,
                masterCategoryId: data.masterCategoryId,
                imageUrl: null,
                createdAt: data.createdAt,
                updatedAt: data.updatedAt,
              };
              allCategories.push(category);
              
              // 🚨 DEBUG: Log each category with its ID
              console.log(`📋 Category: "${category.name}" -> ID: ${doc.id}`);
            });

            // Sort by name
            allCategories.sort((a, b) => a.name.localeCompare(b.name));

            // Populate images from service_categories_master
            await FirestoreService.populateCategoryImages(allCategories);

            setServiceCategories(allCategories);
            setLoading(false);
            console.log('✅ Real-time categories updated:', allCategories.length);
            
            // TODO: Enable worker filtering once service_companies collection has data
            // Currently showing all categories because no workers are assigned yet
          } catch (error) {
            console.error('❌ Error processing real-time category update:', error);
            setError('Failed to load services. Pull down to refresh.');
            setServiceCategories([]);
            setLoading(false);
          }
        },
        (error) => {
          console.error('❌ Real-time listener error for categories:', error);
          setError('Connection lost. Pull down to refresh.');
          setServiceCategories([]);
          setLoading(false);
        }
      );

    // Cleanup listener on unmount
    return () => {
      console.log('🔥 Cleaning up service categories listener');
      unsubscribe();
    };
  }, []);

  // Real-time listener for service banners
  useEffect(() => {
    console.log('🔥 Setting up real-time listener for service banners...');
    setBannersLoading(true);

    const unsubscribe = firestore()
      .collection('service_banners')
      .where('isActive', '==', true)
      .onSnapshot(
        (snapshot) => {
          console.log(`📊 Real-time update: Found ${snapshot.size} active banners at ${new Date().toLocaleTimeString()}`);
          
          const banners: ServiceBanner[] = [];
          
          snapshot.forEach(doc => {
            const data = doc.data();
            banners.push({
              id: doc.id,
              title: data.title || '',
              subtitle: data.subtitle,
              description: data.description,
              imageUrl: data.imageUrl,
              backgroundColor: data.backgroundColor,
              textColor: data.textColor,
              isActive: data.isActive || false,
              clickable: data.clickable,
              redirectType: data.redirectType,
              redirectUrl: data.redirectUrl,
              categoryId: data.categoryId,
              offerText: data.offerText,
              iconName: data.iconName,
              priority: data.priority || 0,
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
            });
          });

          // Sort by priority on client side (descending - highest priority first)
          banners.sort((a, b) => (b.priority || 0) - (a.priority || 0));

          setServiceBanners(banners);
          setBannersLoading(false);
          console.log('✅ Real-time banners updated:', banners.length);
        },
        (error) => {
          console.error('❌ Real-time listener error for banners:', error);
          setServiceBanners([]);
          setBannersLoading(false);
        }
      );

    // Cleanup listener on unmount
    return () => {
      console.log('🔥 Cleaning up service banners listener');
      unsubscribe();
    };
  }, []);

  // Auto-scroll banners with pause
  useEffect(() => {
    if (serviceBanners.length <= 1) return;

    const bannerWidth = width - 32;

    const interval = setInterval(() => {
      currentBannerIndex.current = (currentBannerIndex.current + 1) % serviceBanners.length;
      
      console.log('🔄 Banner auto-scroll - changing to index:', currentBannerIndex.current);
      
      // Update state immediately before scrolling
      setActiveBannerIndex(currentBannerIndex.current);
      
      if (bannerScrollRef.current) {
        bannerScrollRef.current.scrollToOffset({
          offset: currentBannerIndex.current * bannerWidth,
          animated: true,
        });
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [serviceBanners.length]);

  // Blinking animation for View All button (light)
  useEffect(() => {
    const blinkAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, {
          toValue: 0.7,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(blinkAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    blinkAnimation.start();

    return () => {
      blinkAnimation.stop();
    };
  }, [blinkAnim]);

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

  const handleCategoryPress = async (category: ServiceCategory) => {
    console.log('🎯 Category clicked:', category.name, category.id);
    
    // Check if category has packages
    const hasPackages = await FirestoreService.categoryHasPackages(category.id);
    
    const navigationParams = {
      serviceTitle: category.name,
      categoryId: category.id,
      allCategories: serviceCategories,
    };
    
    if (hasPackages) {
      console.log('✅ Category has packages, navigating to PackageSelection');
      navigation.navigate("PackageSelection", navigationParams);
    } else {
      console.log('✅ Category has no packages, navigating directly to ServiceCategory');
      navigation.navigate("ServiceCategory", navigationParams);
    }
  };

  const handleBannerPress = async (banner: ServiceBanner) => {
    if (!banner.clickable) return;

    if (banner.redirectType === "ServiceCategory" && banner.categoryId) {
      // Check if category has packages before navigating
      const hasPackages = await FirestoreService.categoryHasPackages(banner.categoryId);
      
      if (hasPackages) {
        console.log('✅ Category has packages, navigating to PackageSelection');
        navigation.navigate("PackageSelection", { 
          serviceTitle: banner.title,
          categoryId: banner.categoryId,
          allCategories: serviceCategories,
        });
      } else {
        console.log('✅ Category has no packages, navigating directly to ServiceCategory');
        navigation.navigate("ServiceCategory", { 
          serviceTitle: banner.title,
          categoryId: banner.categoryId,
          allCategories: serviceCategories,
        });
      }
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
    searchInputRef.current?.focus();
  };

  // Data slices with null checks - Show only 6 categories in main view
  const listCategories = searchQuery 
    ? (filteredCategories || []).slice(0, 20) 
    : (serviceCategories || []).slice(0, 6);
  
  // Check if there are more categories to show
  const hasMoreCategories = !searchQuery && (serviceCategories || []).length > 6;

  // Render functions
  const renderBanner = React.useCallback(({ item: banner, index }: { item: ServiceBanner; index: number }) => {
    const backgroundColor = banner.backgroundColor || '#667eea';
    const textColor = banner.textColor || 'white';

    const onBannerPress = async () => {
      console.log('🎯 Banner clicked:', {
        title: banner.title,
        clickable: banner.clickable,
        redirectType: banner.redirectType,
        categoryId: banner.categoryId,
      });

      // If clickable is false, don't navigate
      if (banner.clickable === false) {
        console.log('⚠️ Banner is not clickable');
        return;
      }

      // If categoryId exists, check for packages before navigating
      if (banner.categoryId) {
        const hasPackages = await FirestoreService.categoryHasPackages(banner.categoryId);
        
        const navigationParams = {
          serviceTitle: banner.title,
          categoryId: banner.categoryId,
          allCategories: serviceCategories,
        };
        
        if (hasPackages) {
          console.log('✅ Category has packages, navigating to PackageSelection');
          navigation.navigate("PackageSelection", navigationParams);
        } else {
          console.log('✅ Category has no packages, navigating to ServiceCategory');
          navigation.navigate("ServiceCategory", navigationParams);
        }
        return;
      }

      // Fallback to redirectType-based navigation
      if (banner.redirectType === "ServiceCategory" && banner.categoryId) {
        const hasPackages = await FirestoreService.categoryHasPackages(banner.categoryId);
        
        if (hasPackages) {
          navigation.navigate("PackageSelection", { 
            serviceTitle: banner.title,
            categoryId: banner.categoryId,
            allCategories: serviceCategories,
          });
        } else {
          navigation.navigate("ServiceCategory", { 
            serviceTitle: banner.title,
            categoryId: banner.categoryId,
            allCategories: serviceCategories,
          });
        }
      } else if (banner.redirectType === "AllServices") {
        navigation.navigate("AllServices");
      } else if (banner.redirectUrl) {
        console.log('Banner redirect URL:', banner.redirectUrl);
      } else {
        console.log('⚠️ No valid navigation target found for banner');
      }
    };

    return (
      <TouchableOpacity 
        key={banner.id}
        activeOpacity={banner.clickable === false ? 1 : 0.7}
        onPress={onBannerPress}
        style={styles.bannerItem}
        disabled={banner.clickable === false}
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
                  {/* Tag at the top */}
                  {(banner as any).tag && (
                    <View style={styles.bannerTag}>
                      <Text style={styles.bannerTagText}>{(banner as any).tag}</Text>
                    </View>
                  )}
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
                {/* Tag at the top */}
                {(banner as any).tag && (
                  <View style={styles.bannerTag}>
                    <Text style={styles.bannerTagText}>{(banner as any).tag}</Text>
                  </View>
                )}
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
  }, [navigation]);

  const renderListItem = ({ item, index }: { item: ServiceCategory; index: number }) => {
    if (!item || !item.name) return null; // Safety check
    
    const categoryStyle = getCategoryStyle(item.name, index);
    return (
      <TouchableOpacity
        style={styles.gridCard}
        activeOpacity={0.7}
        onPress={() => handleCategoryPress(item)}
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

  const HeaderUI = React.useMemo(() => {
    return (
      <View>
        {/* Status Bar */}
        <StatusBar barStyle="light-content" backgroundColor="#ffffff" />
        
        {/* Header with Gradient */}
        <LinearGradient
          colors={["#00b4a0", "#00d2c7"]}
          style={styles.topHeader}
        >
          <View style={styles.headerContent}>
            {/* Booking History Button */}
            <TouchableOpacity 
              style={styles.historyButton}
              onPress={() => navigation.navigate("BookingHistory")}
              activeOpacity={0.8}
            >
              <Ionicons name="receipt-outline" size={22} color="white" />
              <Text style={styles.historyButtonText}>History</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={[styles.searchBar, isSearchFocused && styles.searchBarFocused]}>
            <Ionicons name="search" size={20} color="#00b4a0" style={styles.searchIcon} />
            <TextInput
              ref={searchInputRef}
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
                <Ionicons name="close-circle" size={20} color="#cbd5e1" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Show search results header when searching */}
        {searchQuery.length > 0 && (
          <View style={styles.searchResultsHeader}>
            <Text style={styles.searchResultsText}>
              {(filteredCategories || []).length} service{(filteredCategories || []).length !== 1 ? 's' : ''} found
            </Text>
          </View>
        )}

        {/* Only show banner when not searching */}
        {searchQuery.length === 0 && (
          <>
            {/* Service Banners */}
            {!bannersLoading && serviceBanners.length > 0 && (
              <View style={styles.bannerContainer}>
                <FlatList
                  ref={bannerScrollRef}
                  data={serviceBanners}
                  renderItem={renderBanner}
                  keyExtractor={(item) => item.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.bannerScrollContent}
                  snapToInterval={width - 32}
                  decelerationRate="fast"
                  pagingEnabled={false}
                  onMomentumScrollEnd={(event) => {
                    const index = Math.round(event.nativeEvent.contentOffset.x / (width - 32));
                    setActiveBannerIndex(index);
                  }}
                />
                
                {/* Pagination Dots */}
                {serviceBanners.length > 1 && (
                  <View style={styles.paginationContainer}>
                    {serviceBanners.map((_, index) => (
                      <View
                        key={index}
                        style={[
                          styles.paginationDot,
                          index === activeBannerIndex && styles.paginationDotActive
                        ]}
                      />
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* All Services List Header */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>All Services</Text>
            </View>
          </>
        )}
      </View>
    );
  }, [searchQuery, isSearchFocused, filteredCategories, bannersLoading, serviceBanners, navigation, renderBanner, activeBannerIndex]);

  return (
    <View style={styles.container}>
      {/* Add safety check for initial render */}
      {!serviceCategories && loading ? (
        <View style={styles.emptyLoadingContainer}>
          <ActivityIndicator size="large" color="#00b4a0" />
          <Text style={styles.emptyLoadingText}>Loading services...</Text>
        </View>
      ) : (
        <FlatList
          data={loading ? [] : (listCategories || [])}
          keyExtractor={(item, index) => item?.id || `item-${index}`}
          ListHeaderComponent={HeaderUI}
          renderItem={renderListItem}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          key="two-columns"
          ListFooterComponent={
            // View All Button - Only show when not searching and there are more categories
            searchQuery.length === 0 && hasMoreCategories ? (
              <View style={styles.viewAllButtonContainer}>
                <Animated.View 
                  style={{ opacity: blinkAnim }}
                >
                  <TouchableOpacity 
                    style={styles.viewAllButton}
                    onPress={handleViewAllCategories}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.viewAllText}>View All</Text>
                    <Ionicons name="arrow-forward" size={16} color="#00b4a0" />
                  </TouchableOpacity>
                </Animated.View>
              </View>
            ) : null
          }
          ListEmptyComponent={
            loading ? (
              <View style={styles.emptyLoadingContainer}>
                <ActivityIndicator size="large" color="#00b4a0" />
                <Text style={styles.emptyLoadingText}>Loading services...</Text>
              </View>
            ) : error ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="cloud-offline-outline" size={48} color="#ef4444" style={styles.emptyIcon} />
                <Text style={styles.emptyText}>{error}</Text>
              </View>
            ) : searchQuery.length > 0 && (filteredCategories || []).length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="search" size={48} color="#cbd5e1" style={styles.emptyIcon} />
                <Text style={styles.emptyText}>No services found</Text>
                <Text style={styles.emptySubText}>Try different keywords</Text>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No services available</Text>
              </View>
            )
          }
          contentContainerStyle={{ paddingBottom: 30 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#00b4a0', '#00d2c7']}
              tintColor="#00b4a0"
            />
          }
          removeClippedSubviews={false}
          maxToRenderPerBatch={10}
          windowSize={10}
          initialNumToRender={searchQuery ? 20 : 6}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fdfdfd",
  },

  // Header Styles
  topHeader: {
    paddingTop: 40,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },

  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },

  historyButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },

  historyButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },

  // Search Bar Styles
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#fdfdfd",
  },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },

  searchBarFocused: {
    borderColor: "#00b4a0",
    elevation: 4,
    shadowOpacity: 0.1,
  },

  searchIcon: {
    marginRight: 12,
  },

  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#1e293b",
    fontWeight: "400",
  },

  clearButton: {
    padding: 4,
    marginLeft: 8,
  },

  searchResultsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#f8fafc",
  },

  searchResultsText: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
  },

  // Banner Styles
  bannerContainer: {
    paddingVertical: 16,
  },

  bannerScrollContent: {
    paddingHorizontal: 16,
  },

  paginationContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
    gap: 6,
  },

  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#cbd5e1",
  },

  paginationDotActive: {
    width: 8,
    height: 8,
    backgroundColor: "#00b4a0",
  },

  bannerItem: {
    width: width - 48,
    marginHorizontal: 8,
  },

  gradientBanner: {
    borderRadius: 16,
    overflow: "hidden",
    height: 160,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },

  bannerImage: {
    width: "100%",
    height: 160,
    borderRadius: 16,
    overflow: "hidden",
  },

  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 16,
  },

  bannerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    height: "100%",
  },

  bannerTextSection: {
    flex: 1,
  },

  bannerTitle: {
    color: "white",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 6,
  },

  bannerSubTitle: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 18,
    marginBottom: 10,
  },

  bannerOffer: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "flex-start",
  },

  offerText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },

  bannerTag: {
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginBottom: 10,
  },

  bannerTagText: {
    color: "#00b4a0",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },

  // Section Styles
  sectionContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
    marginTop: 8,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
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
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },

  gridIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    overflow: "hidden",
  },

  gridCategoryImage: {
    width: 72,
    height: 72,
    borderRadius: 16,
  },

  gridTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
    textAlign: "center",
  },

  // Loading and Empty States
  emptyLoadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },

  emptyLoadingText: {
    marginTop: 16,
    fontSize: 15,
    color: "#00b4a0",
    fontWeight: "500",
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

  // View All Button Styles
  viewAllButtonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: "center",
  },

  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#00b4a0",
    gap: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },

  viewAllText: {
    color: "#00b4a0",
    fontSize: 14,
    fontWeight: "600",
  },
});
