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
  },
  {
    id: "car-bike",
    title: "Car & Bike",
    subtitle: "Car wash, bike wash",
    icon: require("../assets/images/icon_car_bike.png"),
  },
  {
    id: "cleaning",
    title: "Cleaning",
    subtitle: "Home & office cleaning",
    icon: require("../assets/images/icon_cleaning.png"),
  },
];

const POPULAR = [
  {
    id: "electrician",
    title: "Electrician",
    image: require("../assets/images/card_electrician.png"),
  },
  {
    id: "car-wash",
    title: "Car Wash",
    image: require("../assets/images/car_wash.jpg"),
  },
  {
    id: "ac-repair",
    title: "AC Repair",
    image: require("../assets/images/card_acrepair.png"),
  },
];

export default function ServicesScreen() {
  const navigation = useNavigation<any>();

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Services</Text>

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
          <TouchableOpacity key={item.id} style={styles.categoryCard}>
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
            onPress={() =>
              navigation.navigate("ServiceCategory", {
                serviceTitle: item.title,
              })
            }
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

      {/* नीचे list भी चाहिए तो */}
      <Text style={[styles.sectionTitle, { marginTop: 16 }]}>All Services</Text>

      <FlatList
        data={POPULAR}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.listCard}
            onPress={() =>
              navigation.navigate("ServiceCategory", {
                serviceTitle: item.title,
              })
            }
          >
            <Text style={styles.listTitle}>{item.title}</Text>
            <Text style={styles.listSub}>Tap to select slot</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },

  header: { fontSize: 22, fontWeight: "800", marginBottom: 12 },

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
    backgroundColor: "#f4f4f4",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  categoryIcon: { width: 34, height: 34, marginBottom: 6 },
  categoryText: { fontSize: 12, fontWeight: "700" },

  sectionTitle: { fontSize: 16, fontWeight: "800", marginTop: 16 },

  popularRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  popularCard: { width: "31%", height: 90 },
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
