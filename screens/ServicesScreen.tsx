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
  ImageBackground,
  ScrollView,
  Animated,
  RefreshControl,
  Platform,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
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

interface LiveBooking {
  id: string;
  serviceName: string;
  location: string;
  timestamp: any;
}

export default function ServicesScreen() {
  const navigation = useNavigation<any>();
  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>([]);
  const [serviceBanners, setServiceBanners] = useState<ServiceBanner[]>([]);
  const [liveBookings, setLiveBookings] = useState<LiveBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [bannersLoading, setBannersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tapLoading, setTapLoading] = useState<{ visible: boolean; message?: string }>(
    { visible: false }
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const searchInputRef = React.useRef<TextInput>(null);
  const bannerScrollRef = React.useRef<FlatList>(null);
  const liveBookingsScrollRef = React.useRef<ScrollView>(null);
  const currentBannerIndex = React.useRef(0);
  const currentBookingIndex = React.useRef(0);
  const scrollX = React.useRef(0);
  const blinkAnim = React.useRef(new Animated.Value(1)).current;
  const bookingBlinkAnim = React.useRef(new Animated.Value(1)).current;
  const arrowAnim = React.useRef(new Animated.Value(0)).current;

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

            // Filter to show only categories with active workers
            console.log('🔍 Filtering categories with active workers...');
            const companiesSnapshot = await firestore()
              .collection('service_services')
              .where('isActive', '==', true)
              .get();
            
            const activeCategoryIds = new Set<string>();
            companiesSnapshot.forEach(doc => {
              const data = doc.data();
              if (data.categoryMasterId) {
                activeCategoryIds.add(data.categoryMasterId);
              }
            });
            
            const categoriesWithWorkers = allCategories.filter(category => {
              const hasWorkersWithOwnId = activeCategoryIds.has(category.id);
              const hasWorkersWithMasterId = category.masterCategoryId ? activeCategoryIds.has(category.masterCategoryId) : false;
              return hasWorkersWithOwnId || hasWorkersWithMasterId;
            });
            
            console.log(`✅ Showing ${categoriesWithWorkers.length}/${allCategories.length} categories with active workers`);

            setServiceCategories(categoriesWithWorkers);
            setLoading(false);
            console.log('✅ Real-time categories updated:', categoriesWithWorkers.length);
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

  // Real-time listener for live bookings
  useEffect(() => {
    console.log('🔥 Setting up real-time listener for live bookings...');

    const unsubscribe = firestore()
      .collection('service_bookings')
      .orderBy('createdAt', 'desc')
      .limit(15)
      .onSnapshot(
        (snapshot) => {
          console.log(`📊 Real-time update: Found ${snapshot.size} live bookings at ${new Date().toLocaleTimeString()}`);
          
          const bookings: LiveBooking[] = [];
          
          snapshot.forEach(doc => {
            const data = doc.data();
            bookings.push({
              id: doc.id,
              serviceName: data.serviceName || data.serviceTitle || 'Service',
              location: data.address?.city || data.address?.area || 'Your area',
              timestamp: data.createdAt,
            });
          });

          setLiveBookings(bookings);
          console.log('✅ Real-time bookings updated:', bookings.length);
        },
        (error) => {
          console.error('❌ Real-time listener error for bookings:', error);
          setLiveBookings([]);
        }
      );

    // Cleanup listener on unmount
    return () => {
      console.log('🔥 Cleaning up live bookings listener');
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

  // Auto-scroll live bookings with smooth continuous marquee effect
  useEffect(() => {
    if (liveBookings.length === 0) return;

    // iOS: this continuous scroll can keep a responder active and make the
    // rest of the screen feel "not clickable". Disable it on iOS.
    if (Platform.OS === 'ios') {
      return;
    }

    let animationFrameId: number;
    const scrollSpeed = 1; // Pixels per frame - increased from 0.5 to 1

    const smoothScroll = () => {
      if (liveBookingsScrollRef.current) {
        scrollX.current += scrollSpeed;
        
        liveBookingsScrollRef.current.scrollTo({
          x: scrollX.current,
          animated: false, // Use false for smooth continuous scroll
        });
      }
      
      animationFrameId = requestAnimationFrame(smoothScroll);
    };

    animationFrameId = requestAnimationFrame(smoothScroll);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [liveBookings.length]);

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

  // Blinking animation for live bookings
  useEffect(() => {
    const blinkAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(bookingBlinkAnim, {
          toValue: 0.6,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(bookingBlinkAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    blinkAnimation.start();

    return () => {
      blinkAnimation.stop();
    };
  }, [bookingBlinkAnim]);

  // Arrow movement animation for View All button
  useEffect(() => {
    const arrowAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(arrowAnim, {
          toValue: 5,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(arrowAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    );

    arrowAnimation.start();

    return () => {
      arrowAnimation.stop();
    };
  }, [arrowAnim]);

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

  // Ensure we never leave the "Opening..." overlay stuck if navigation succeeds.
  useFocusEffect(
    useCallback(() => {
      return () => {
        setTapLoading({ visible: false });
      };
    }, [])
  );

  // Navigation functions
  const goTo = (screen: string, params: any) => {
    navigation.navigate(screen, params);
  };

  const handleCategoryPress = async (category: ServiceCategory) => {
    console.log('🎯 Category clicked:', category.name, category.id);

    // Instant feedback so the user knows the tap registered.
    setTapLoading({ visible: true, message: 'Opening…' });
    
    // Check if category has packages
    let hasPackages = false;
    try {
      hasPackages = await FirestoreService.categoryHasPackages(category.id);
    } catch (e) {
      console.log('⚠️ categoryHasPackages failed:', e);
    }
    
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

    setTapLoading({ visible: true, message: 'Opening…' });

    if (banner.redirectType === "ServiceCategory" && banner.categoryId) {
      // Check if category has packages before navigating
      let hasPackages = false;
      try {
        hasPackages = await FirestoreService.categoryHasPackages(banner.categoryId);
      } catch (e) {
        console.log('⚠️ categoryHasPackages failed:', e);
      }
      
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
    setTapLoading({ visible: true, message: 'Loading…' });
    navigation.navigate("AllServices");
  };

  const handleHistoryPress = () => {
    setTapLoading({ visible: true, message: 'Loading…' });
    navigation.navigate("BookingHistory");
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
          <View style={styles.bannerImage}>
            <ExpoImage
              source={{ uri: banner.imageUrl }}
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={150}
            />
            <View style={styles.bannerOverlay} pointerEvents="none">
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
          </View>
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
            <ExpoImage
              source={{ uri: item.imageUrl }}
              style={styles.gridCategoryImage}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={150}
              onError={(e) => {
                console.log(`⚠️ Failed to load image for ${item.name}`, {
                  url: item.imageUrl,
                  error: (e as any)?.nativeEvent,
                });
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
        
        {/* Header with Background Image */}
        <ImageBackground
          source={require('../assets/img.png')}
          style={styles.topHeader}
          resizeMode="cover"
          imageStyle={{ marginTop: 20 }}
        >
          <View style={styles.headerOverlay} pointerEvents="box-none">
            <View style={styles.headerContent}>
              {/* Booking History Button */}
              <TouchableOpacity 
                style={styles.historyButton}
                onPress={handleHistoryPress}
                activeOpacity={0.8}
              >
                <Ionicons name="receipt-outline" size={22} color="white" />
                <Text style={styles.historyButtonText}>History</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ImageBackground>

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

            {/* All Services List Header with View All Button */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>All Services</Text>
              {hasMoreCategories && (
                <TouchableOpacity 
                  style={styles.viewAllButtonInline}
                  onPress={handleViewAllCategories}
                  activeOpacity={0.7}
                >
                  <Text style={styles.viewAllTextInline}>View All</Text>
                  <Animated.View style={{ transform: [{ translateX: arrowAnim }] }}>
                    <Ionicons name="arrow-forward" size={14} color="#00b4a0" />
                  </Animated.View>
                </TouchableOpacity>
              )}
            </View>

            {/* Live Updates Section */}
            <View style={styles.liveUpdatesContainer}>
              <View style={styles.liveUpdatesHeader}>
                <Animated.View style={[styles.liveIndicator, { opacity: bookingBlinkAnim }]}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>Live Bookings</Text>
                </Animated.View>
              </View>
              <View style={styles.liveUpdatesWrapper} pointerEvents="box-none">
                <ScrollView 
                  ref={liveBookingsScrollRef}
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  scrollEventThrottle={16}
                  pointerEvents="box-none"
                  contentContainerStyle={styles.liveUpdatesScroll}
                  onScroll={Platform.OS === 'ios' ? undefined : (event) => {
                    const contentWidth = event.nativeEvent.contentSize.width;
                    const scrollWidth = event.nativeEvent.layoutMeasurement.width;
                    const currentScrollX = event.nativeEvent.contentOffset.x;
                    
                    // Reset scroll when reaching end for infinite loop effect
                    if (currentScrollX >= contentWidth - scrollWidth) {
                      scrollX.current = 0;
                      liveBookingsScrollRef.current?.scrollTo({ x: 0, animated: false });
                    }
                  }}
                >
                  {liveBookings.length > 0 ? (
                    <>
                      {/* Original bookings */}
                      {liveBookings.map((booking, index) => (
                        <Animated.View 
                          key={`original-${booking.id}`} 
                          style={[
                            styles.liveUpdateItem,
                            { opacity: bookingBlinkAnim }
                          ]}
                        >
                          <View style={styles.liveUpdateDot} />
                          <Text style={styles.liveUpdateSimpleText}>
                            <Text style={styles.liveUpdateBold}>{booking.serviceName}</Text>
                            {' '} service has been booked in{' '}
                            <Text style={styles.liveUpdateLocation}>{booking.location}</Text>
                          </Text>
                        </Animated.View>
                      ))}
                      {/* Duplicate bookings for seamless loop */}
                      {liveBookings.map((booking, index) => (
                        <Animated.View 
                          key={`duplicate-${booking.id}`} 
                          style={[
                            styles.liveUpdateItem,
                            { opacity: bookingBlinkAnim }
                          ]}
                        >
                          <View style={styles.liveUpdateDot} />
                          <Text style={styles.liveUpdateSimpleText}>
                            <Text style={styles.liveUpdateBold}>{booking.serviceName}</Text>
                            {' '}booked in{' '}
                            <Text style={styles.liveUpdateLocation}>{booking.location}</Text>
                          </Text>
                        </Animated.View>
                      ))}
                    </>
                  ) : (
                    <View style={styles.liveUpdateItem}>
                      <View style={[styles.liveUpdateDot, { backgroundColor: '#cbd5e1' }]} />
                      <Text style={styles.liveUpdateSimpleText}>
                        No active bookings right now
                      </Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            </View>
          </>
        )}
      </View>
    );
  }, [searchQuery, isSearchFocused, filteredCategories, bannersLoading, serviceBanners, navigation, renderBanner, activeBannerIndex, hasMoreCategories, liveBookings, arrowAnim]);

  return (
    <View style={styles.container}>
      {tapLoading.visible && (
        <View style={styles.tapLoadingOverlay} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.tapLoadingCard}
            activeOpacity={1}
            onPress={() => setTapLoading({ visible: false })}
          >
            <ActivityIndicator size="small" color="#00b4a0" />
            <Text style={styles.tapLoadingText}>{tapLoading.message || 'Opening…'}</Text>
          </TouchableOpacity>
        </View>
      )}

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
          ListFooterComponent={null}
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
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="on-drag"
          nestedScrollEnabled
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

  tapLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    elevation: 999,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.08)",
  },

  tapLoadingCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },

  tapLoadingText: {
    marginLeft: 10,
    fontSize: 14,
    color: "#0f172a",
    fontWeight: "600",
  },

  // Header Styles
  topHeader: {
    paddingTop: 80,
    paddingBottom: 30,
    paddingHorizontal: 16,
  },

  headerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.1)",
    justifyContent: "flex-end",
  },

  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 20,
  },

  historyButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "transparent",
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
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

  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 12,
    marginTop: 8,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
  },

  viewAllButtonInline: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#00b4a0",
    gap: 4,
  },

  viewAllTextInline: {
    color: "#00b4a0",
    fontSize: 13,
    fontWeight: "600",
  },

  // Live Updates Styles
  liveUpdatesContainer: {
    paddingVertical: 12,
    // backgroundColor: "#f8fafc",
    backgroundColor: "white",
    marginBottom: 16,
  },

  liveUpdatesHeader: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },

  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ef4444",
    shadowColor: "#ef4444",
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 4,
  },

  liveText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },

  liveUpdatesWrapper: {
    overflow: "hidden",
  },

  liveUpdatesScroll: {
    paddingHorizontal: 16,
    flexDirection: "row",
  },

  liveUpdateItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 40,
    gap: 8,
  },

  liveUpdateDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#00b4a0",
  },

  liveUpdateSimpleText: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "400",
  },

  liveUpdateLocation: {
    color: "#00b4a0",
    fontWeight: "500",
  },

  liveUpdateCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    marginRight: 10,
    minWidth: 270,
  },

  liveUpdateText: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "400",
  },

  liveUpdateBold: {
    fontWeight: "600",
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

});
