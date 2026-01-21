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
            activeOpacity={0.9}
            onPress={() => goTo(item.screen, item.params)}
          >
            <Text style={styles.listTitle}>{item.title}</Text>
            <Text style={styles.listSub}>Tap to continue</Text>
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
    backgroundColor: "yellow",//background color of service screen
    paddingHorizontal: 16,
    paddingTop: 28,
  },

  topHeader: {
    marginBottom: 14,
  },

  city: {
    fontSize: 14,
    color: "#777",
    fontWeight: "600",
  },

  header: {
    fontSize: 28,
    fontWeight: "900",
    marginTop: 2,
    letterSpacing: 0.5,
  },

  headerSub: {
    color: "#777",
    fontSize: 13,
    marginTop: 2,
  },

  banner: {
    height: 150,
    borderRadius: 18,
    overflow: "hidden",
    justifyContent: "flex-end",
    padding: 14,
  },

  bannerImage: { borderRadius: 18 },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  bannerTitle: { color: "white", fontSize: 18, fontWeight: "800" },
  bannerSubTitle: { color: "white", marginTop: 4, fontSize: 13 },

  categoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
  },
  categoryCard: {
  width: "31%",
  backgroundColor: "#fafafa",
  borderRadius: 18,
  paddingVertical: 16,
  alignItems: "center",

  // Android shadow
  elevation: 3,

  // iOS shadow
  shadowColor: "#000",
  shadowOpacity: 0.08,
  shadowOffset: { width: 0, height: 4 },
  shadowRadius: 6,
},

categoryIcon: {
  width: 40,
  height: 40,
  marginBottom: 8,
},

  categoryText: { fontSize: 12, fontWeight: "700" },

  sectionTitle: { fontSize: 16, fontWeight: "800", marginTop: 16 },

  popularRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 12,
    gap: 10,
  },
  popularCard: { width: "48%", height: 90 },
  popularBg: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
    justifyContent: "flex-end",
    padding: 8,
  },
  popularBgImage: { borderRadius: 14 },
  popularOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  popularTitle: { color: "white", fontWeight: "800", fontSize: 12 },

  listCard: {
    marginTop: 12,
    backgroundColor: "#f6f6f6",
    padding: 14,
    borderRadius: 14,
  },
  listTitle: { fontSize: 15, fontWeight: "800" },
  listSub: { marginTop: 4, color: "#666", fontSize: 12 },
});
