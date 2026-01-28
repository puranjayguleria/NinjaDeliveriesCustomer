import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  Image,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  Alert,
} from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from '@expo/vector-icons';
import { FirestoreService, ServiceCategory } from '../services/firestoreService';

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
  // Laundry / Dry Cleaning (more specific)
  else if (name.includes("laundry") || name.includes("dry clean") || name.includes("iron") || name.includes("cloth") || name.includes("garment")) {
    icon = "shirt-outline";
    color = "#8B5CF6";
    bgColor = "#F3E8FF";
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
  // Car Wash / Vehicle Services
  else if (name.includes("car") || name.includes("wash") || name.includes("vehicle") || name.includes("auto") || name.includes("bike")) {
    icon = "car-outline";
    color = "#EF4444";
    bgColor = "#FEF2F2";
  } 
  // AC / Cooling Services
  else if (name.includes("ac") || name.includes("air") || name.includes("condition") || name.includes("cooling") || name.includes("hvac")) {
    icon = "snow-outline";
    color = "#0EA5E9";
    bgColor = "#F0F9FF";
  } 
  // Appliance Repair
  else if (name.includes("appliance") || name.includes("refrigerat") || name.includes("washing") || name.includes("microwave") || name.includes("oven")) {
    icon = "tv-outline";
    color = "#DC2626";
    bgColor = "#FEF2F2";
  } 
  // Painting Services
  else if (name.includes("paint") || name.includes("wall") || name.includes("interior") || name.includes("exterior")) {
    icon = "brush-outline";
    color = "#7C3AED";
    bgColor = "#F3E8FF";
  } 
  // Gardening / Landscaping
  else if (name.includes("garden") || name.includes("landscap") || name.includes("plant") || name.includes("lawn")) {
    icon = "leaf-outline";
    color = "#059669";
    bgColor = "#ECFDF5";
  } 
  // Security Services
  else if (name.includes("security") || name.includes("guard") || name.includes("watchman") || name.includes("cctv")) {
    icon = "shield-checkmark-outline";
    color = "#DC2626";
    bgColor = "#FEF2F2";
  } 
  // Pest Control
  else if (name.includes("pest") || name.includes("control") || name.includes("termite") || name.includes("cockroach")) {
    icon = "bug-outline";
    color = "#B45309";
    bgColor = "#FFFBEB";
  } 
  // Home Services / General Repair
  else if (name.includes("home") || name.includes("house") || name.includes("repair") || name.includes("maintenance")) {
    icon = "home-outline";
    color = "#3B82F6";
    bgColor = "#EFF6FF";
  } 
  // Carpentry / Furniture
  else if (name.includes("carpen") || name.includes("furniture") || name.includes("wood") || name.includes("cabinet")) {
    icon = "hammer-outline";
    color = "#92400E";
    bgColor = "#FFFBEB";
  } 
  // Beauty / Salon Services
  else if (name.includes("beauty") || name.includes("salon") || name.includes("hair") || name.includes("facial") || name.includes("makeup")) {
    icon = "cut-outline";
    color = "#EC4899";
    bgColor = "#FDF2F8";
  } 
  // Tutoring / Education
  else if (name.includes("tutor") || name.includes("teach") || name.includes("education") || name.includes("study")) {
    icon = "book-outline";
    color = "#7C3AED";
    bgColor = "#F3E8FF";
  } 
  // Moving / Packers
  else if (name.includes("moving") || name.includes("packer") || name.includes("relocation") || name.includes("shifting")) {
    icon = "cube-outline";
    color = "#059669";
    bgColor = "#ECFDF5";
  } 
  // Laundry / Dry Cleaning
  else if (name.includes("laundry") || name.includes("dry") || name.includes("iron") || name.includes("cloth")) {
    icon = "shirt-outline";
    color = "#0EA5E9";
    bgColor = "#F0F9FF";
  } 
  // Photography / Videography
  else if (name.includes("photo") || name.includes("video") || name.includes("camera") || name.includes("shoot")) {
    icon = "camera-outline";
    color = "#7C2D12";
    bgColor = "#FEF7ED";
  } 
  // Catering / Food Services
  else if (name.includes("cater") || name.includes("food") || name.includes("cook") || name.includes("chef")) {
    icon = "restaurant-outline";
    color = "#DC2626";
    bgColor = "#FEF2F2";
  } 
  // Event Management
  else if (name.includes("event") || name.includes("party") || name.includes("wedding") || name.includes("decoration")) {
    icon = "balloon-outline";
    color = "#EC4899";
    bgColor = "#FDF2F8";
  } 
  // IT / Computer Services
  else if (name.includes("computer") || name.includes("laptop") || name.includes("software") || name.includes("tech")) {
    icon = "laptop-outline";
    color = "#4338CA";
    bgColor = "#EEF2FF";
  } 
  // Delivery Services
  else if (name.includes("delivery") || name.includes("courier") || name.includes("transport") || name.includes("logistics")) {
    icon = "bicycle-outline";
    color = "#059669";
    bgColor = "#ECFDF5";
  } 
  // Solar / Renewable Energy
  else if (name.includes("solar") || name.includes("panel") || name.includes("renewable") || name.includes("energy")) {
    icon = "sunny-outline";
    color = "#F59E0B";
    bgColor = "#FFFBEB";
  } 
  // Welding / Metal Work
  else if (name.includes("weld") || name.includes("metal") || name.includes("steel") || name.includes("iron")) {
    icon = "flame-outline";
    color = "#DC2626";
    bgColor = "#FEF2F2";
  } 
  // Glass / Window Services
  else if (name.includes("glass") || name.includes("window") || name.includes("mirror") || name.includes("glazing")) {
    icon = "square-outline";
    color = "#0EA5E9";
    bgColor = "#F0F9FF";
  } 
  // Locksmith Services
  else if (name.includes("lock") || name.includes("key") || name.includes("door") || name.includes("safe")) {
    icon = "key-outline";
    color = "#92400E";
    bgColor = "#FFFBEB";
  } 
  // Tile / Flooring
  else if (name.includes("tile") || name.includes("floor") || name.includes("marble") || name.includes("ceramic")) {
    icon = "grid-outline";
    color = "#7C3AED";
    bgColor = "#F3E8FF";
  } 
  // Roofing Services
  else if (name.includes("roof") || name.includes("ceiling") || name.includes("waterproof") || name.includes("leak")) {
    icon = "triangle-outline";
    color = "#B45309";
    bgColor = "#FFFBEB";
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

const ALL_SERVICES = [
  {
    id: "1",
    title: "Electrician",
    subtitle: "Wiring, repairs & installations",
    screen: "ServiceCategory",
    params: { serviceTitle: "Electrician" },
    icon: "flash-outline",
    availability: "Available 24/7",
  },
  {
    id: "2",
    title: "Plumber",
    subtitle: "Pipe repairs & water solutions",
    screen: "ServiceCategory",
    params: { serviceTitle: "Plumber" },
    icon: "water-outline",
    availability: "Emergency service",
  },
  {
    id: "3",
    title: "Health",
    subtitle: "Wellness & fitness services",
    screen: "HealthCategory",
    params: { serviceTitle: "Health" },
    icon: "fitness-outline",
    availability: "Book sessions",
  },
  {
    id: "4",
    title: "Cleaning",
    subtitle: "Deep cleaning & maintenance",
    screen: "CleaningCategory",
    params: { serviceTitle: "Cleaning" },
    icon: "sparkles-outline",
    availability: "Same day service",
  },
  {
    id: "5",
    title: "Daily Wages",
    subtitle: "Skilled workers for hire",
    screen: "DailyWagesCategory",
    params: { serviceTitle: "Daily Wages" },
    icon: "people-outline",
    availability: "Flexible hours",
  },
  {
    id: "6",
    title: "Car Wash",
    subtitle: "Premium car care services",
    screen: "CarWashCategory",
    params: { serviceTitle: "Car Wash" },
    icon: "car-outline",
    availability: "Doorstep service",
  },
];

export default function ServicesScreen() {
  const navigation = useNavigation<any>();
  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchServiceCategories();
  }, []);

  const fetchServiceCategories = async () => {
    try {
      setLoading(true);
      const categories = await FirestoreService.getServiceCategories();
      setServiceCategories(categories);
    } catch (error) {
      console.error('Error fetching service categories:', error);
      // Don't show alert since we have fallback data in the service
      // Alert.alert('Error', 'Failed to load service categories. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const goTo = (screen: string, params: any) => {
    navigation.navigate(screen, params);
  };

  const handleMonsoonSpecial = () => {
    // Navigate to a special monsoon services screen or show modal
    navigation.navigate("ServiceCategory", { 
      serviceTitle: "Monsoon Special",
      specialOffer: true,
      discount: 30
    });
  };

  const handleViewAllPopular = () => {
    // Navigate to All Services Screen
    navigation.navigate("AllServices");
  };

  const handleViewAllCategories = () => {
    // Navigate to All Services Screen
    navigation.navigate("AllServices");
  };

  const HeaderUI = () => {
    return (
      <View>
        {/* Status Bar */}
        <StatusBar barStyle="dark-content" backgroundColor="white" />
        
        {/* Header */}
        <View style={styles.topHeader}>
          <View style={styles.headerRow}>
            <View style={styles.headerTextContainer}>
              <Text style={styles.header}>Professional Services</Text>
              <Text style={styles.headerSub}>
                Trusted experts at your doorstep
              </Text>
            </View>
            {/* <View style={styles.headerBadge}>
              <Text style={styles.badgeText}>24/7</Text>
            </View> */}
          </View>
        </View>

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
          ) : (
            <View style={styles.categoryRow}>
              {serviceCategories.slice(0, 3).map((item, index) => {
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
              })}
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
            {POPULAR.map((item) => (
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
            ))}
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
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Full screen scroll */}
      <FlatList
        data={loading ? [] : serviceCategories.slice(0, 6)} // Show first 6 categories in the list
        keyExtractor={(item) => item.id}
        ListHeaderComponent={HeaderUI}
        renderItem={({ item, index }) => {
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
        }}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyLoadingContainer}>
              <ActivityIndicator size="large" color="#3b82f6" />
              <Text style={styles.emptyLoadingText}>Loading services...</Text>
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
      />
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
});
