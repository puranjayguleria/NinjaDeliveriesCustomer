import React from "react";
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
} from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const SERVICES = [
  {
    id: "home-repair",
    title: "Home Repair",
    subtitle: "Electrician, plumber, etc.",
    icon: "home-outline",
    screen: "ServiceCategory",
    params: { serviceTitle: "Electrician" },
    color: "#3B82F6",
    bgColor: "#EFF6FF",
  },
  {
    id: "health",
    title: "Health",
    subtitle: "Physio, yoga, gym",
    icon: "fitness-outline",
    screen: "HealthCategory",
    params: { serviceTitle: "Health" },
    color: "#10B981",
    bgColor: "#ECFDF5",
  },
  {
    id: "daily-wages",
    title: "Daily Wages",
    subtitle: "Half day / Full day",
    icon: "people-outline",
    screen: "DailyWagesCategory",
    params: { serviceTitle: "Daily Wages" },
    color: "#F59E0B",
    bgColor: "#FFFBEB",
  },
];

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
    // Create a simple alert or navigate to show all services
    // Since this is a services screen, we'll navigate to the main services listing
    // You can customize this based on your app's navigation structure
    
    // Option 1: Show an alert with all services
    // Alert.alert("All Services", "Electrician\nPlumber\nCleaning\nHealth\nDaily Wages\nCar Wash");
    
    // Option 2: Navigate to a service category screen showing all
    navigation.navigate("ServiceCategory", { 
      serviceTitle: "All Popular Services",
      showAll: true 
    });
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
          <Text style={styles.sectionTitle}>Service Categories</Text>
          <View style={styles.categoryRow}>
            {SERVICES.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.categoryCard, { backgroundColor: item.bgColor }]}
                activeOpacity={0.8}
                onPress={() => goTo(item.screen, item.params)}
              >
                <View style={[styles.iconContainer, { backgroundColor: item.color }]}>
                  <Ionicons name={item.icon as any} size={28} color="white" />
                </View>
                <Text style={styles.categoryTitle}>{item.title}</Text>
                <Text style={styles.categorySubtitle}>{item.subtitle}</Text>
              </TouchableOpacity>
            ))}
          </View>
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
          <Text style={styles.sectionTitle}>All Services</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Full screen scroll */}
      <FlatList
        data={ALL_SERVICES}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={HeaderUI}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.listCard}
            activeOpacity={0.8}
            onPress={() => goTo(item.screen, item.params)}
          >
            <View style={styles.listIconContainer}>
              <Ionicons name={item.icon as any} size={24} color="#64748b" />
            </View>
            <View style={styles.listContent}>
              <Text style={styles.listTitle}>{item.title}</Text>
              <Text style={styles.listSubtitle}>{item.subtitle}</Text>
              <Text style={styles.listAvailability}>{item.availability}</Text>
            </View>
            <View style={styles.listArrowContainer}>
              <Ionicons name="chevron-forward" size={20} color="#64748b" />
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={{ paddingBottom: 30 }}
        showsVerticalScrollIndicator={false}
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
});
