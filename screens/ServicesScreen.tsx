import React from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  Image,
} from "react-native";
import { useNavigation } from "@react-navigation/native";

const SERVICES = [
  {
    id: "home-repair",
    title: "Home Repair",
    subtitle: "Electrician, plumber, etc.",
    icon: require("../assets/images/icon_home_repair.png"),
    screen: "ServiceCategory",
    params: { serviceTitle: "Electrician" },
  },
  {
    id: "health",
    title: "Health",
    subtitle: "Physio, yoga, gym",
    icon: require("../assets/images/icon_cleaning.png"),
    screen: "HealthCategory",
    params: { serviceTitle: "Health" },
  },
  {
    id: "daily-wages",
    title: "Daily Wages",
    subtitle: "Half day / Full day",
    icon: require("../assets/images/icon_car_bike.png"),
    screen: "DailyWagesCategory",
    params: { serviceTitle: "Daily Wages" },
  },
];

const POPULAR = [
  {
    id: "electrician",
    title: "Electrician",
    image: require("../assets/images/card_electrician.png"),
    screen: "ServiceCategory",
    params: { serviceTitle: "Electrician" },
  },
  {
    id: "plumber",
    title: "Plumber",
    image: require("../assets/images/card_acrepair.png"),
    screen: "ServiceCategory",
    params: { serviceTitle: "Plumber" },
  },
  {
    id: "cleaning",
    title: "Cleaning",
    image: require("../assets/images/icon_cleaning.png"), // ✅ FIXED (file exists)
    screen: "CleaningCategory",
    params: { serviceTitle: "Cleaning" },
  },
  {
    id: "car-wash",
    title: "Car Wash",
    image: require("../assets/images/car_wash.jpg"),
    screen: "CarWashCategory",
    params: { serviceTitle: "Car Wash" },
  },
];

const ALL_SERVICES = [
  {
    id: "1",
    title: "Electrician",
    screen: "ServiceCategory",
    params: { serviceTitle: "Electrician" },
  },
  {
    id: "2",
    title: "Plumber",
    screen: "ServiceCategory",
    params: { serviceTitle: "Plumber" },
  },
  {
    id: "3",
    title: "Health",
    screen: "HealthCategory",
    params: { serviceTitle: "Health" },
  },
  {
    id: "4",
    title: "Cleaning",
    screen: "CleaningCategory",
    params: { serviceTitle: "Cleaning" },
  },
  {
    id: "5",
    title: "Daily Wages",
    screen: "DailyWagesCategory",
    params: { serviceTitle: "Daily Wages" },
  },
  {
    id: "6",
    title: "Car Wash",
    screen: "CarWashCategory",
    params: { serviceTitle: "Car Wash" },
  },
];

export default function ServicesScreen() {
  const navigation = useNavigation<any>();

  const goTo = (screen: string, params: any) => {
    navigation.navigate(screen, params);
  };

  const HeaderUI = () => {
    return (
      <View>
        <View style={styles.topHeader}>
      <Text style={styles.header}>Services</Text>
      <Text style={styles.headerSub}>
    Book trusted professionals near you
  </Text>
</View>


        {/* Banner */}
        <ImageBackground
          source={require("../assets/images/service_banner.jpg")}
          style={styles.banner}
          imageStyle={styles.bannerImage}
        >
          <View style={styles.bannerOverlay} />
          <Text style={styles.bannerTitle}>Monsoon Special</Text>
          <Text style={styles.bannerSubTitle}>Leak Proofing & Geyser Repair</Text>
        </ImageBackground>

        {/* Categories Row */}
        <View style={styles.categoryRow}>
          {SERVICES.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.categoryCard}
              activeOpacity={0.9}
              onPress={() => goTo(item.screen, item.params)}
            >
              <Image source={item.icon} style={styles.categoryIcon} />
              <Text style={styles.categoryText}>{item.title}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Popular Near You */}
        <Text style={styles.sectionTitle}>Popular Near You</Text>

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
                <View style={styles.popularOverlay} />
                <Text style={styles.popularTitle}>{item.title}</Text>
              </ImageBackground>
            </TouchableOpacity>
          ))}
        </View>

        {/* All Services Title */}
        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
          All Services
        </Text>
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
            activeOpacity={0.7}
            onPress={() => goTo(item.screen, item.params)}
          >
            <View>
              <Text style={styles.listTitle}>{item.title}</Text>
              <Text style={styles.listSub}>Professional service providers</Text>
            </View>
            <Text style={styles.listArrow}>→</Text>
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
    backgroundColor: "#fafbfc",
  },

  topHeader: {
    paddingHorizontal: 24,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: "white",
  },

  header: {
    fontSize: 32,
    fontWeight: "600",
    color: "#0f172a",
    letterSpacing: -0.8,
    marginBottom: 4,
  },

  headerSub: {
    color: "#64748b",
    fontSize: 16,
    fontWeight: "400",
    lineHeight: 24,
  },

  banner: {
    height: 180,
    borderRadius: 16,
    overflow: "hidden",
    justifyContent: "flex-end",
    padding: 24,
    marginHorizontal: 24,
    marginTop: 20,
    marginBottom: 32,
  },

  bannerImage: { 
    borderRadius: 16 
  },
  
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
  },
  
  bannerTitle: { 
    color: "white", 
    fontSize: 22, 
    fontWeight: "600",
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  
  bannerSubTitle: { 
    color: "rgba(255,255,255,0.9)", 
    fontSize: 15,
    fontWeight: "400",
    lineHeight: 22,
  },

  categoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    marginBottom: 40,
  },

  categoryCard: {
    width: "30%",
    backgroundColor: "white",
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: "center",
    elevation: 0,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  categoryIcon: {
    width: 48,
    height: 48,
    marginBottom: 16,
  },

  categoryText: { 
    fontSize: 14, 
    fontWeight: "500",
    color: "#334155",
    textAlign: "center",
    lineHeight: 20,
  },

  sectionTitle: { 
    fontSize: 20, 
    fontWeight: "600", 
    color: "#0f172a",
    paddingHorizontal: 24,
    marginBottom: 20,
    letterSpacing: -0.3,
  },

  popularRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 16,
    paddingHorizontal: 24,
    marginBottom: 40,
  },

  popularCard: { 
    width: "47%", 
    height: 120,
    borderRadius: 16,
    overflow: "hidden",
    elevation: 0,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
  },

  popularBg: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 20,
  },

  popularBgImage: { 
    borderRadius: 16 
  },

  popularOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.3)",
  },

  popularTitle: { 
    color: "white", 
    fontWeight: "500", 
    fontSize: 15,
    letterSpacing: -0.2,
  },

  listCard: {
    marginBottom: 12,
    backgroundColor: "white",
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 16,
    marginHorizontal: 24,
    elevation: 0,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  listTitle: { 
    fontSize: 16, 
    fontWeight: "500",
    color: "#0f172a",
    letterSpacing: -0.2,
  },

  listSub: { 
    marginTop: 4, 
    color: "#64748b", 
    fontSize: 14,
    fontWeight: "400",
  },

  listArrow: {
    fontSize: 18,
    color: "#94a3b8",
    fontWeight: "400",
  },
});
