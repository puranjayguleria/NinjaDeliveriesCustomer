import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ImageBackground,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useLocationContext } from "@/context/LocationContext";
import { navigateToSpecializedCategory } from "../../utils/categoryNavigation";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const NavratriPageScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { location } = useLocationContext();

  const handleCardPress = async (title: string) => {
    // Map "Puja" to "Pooja Essentials" for navigation
    const lookupTitle = title === "Puja" ? "Pooja Essentials" : title;
    
    const specialCategories = ["Pooja Essentials", "Dry Fruits", "Dairy", "Fruits", "Instant Food"];
    
    if (specialCategories.includes(lookupTitle)) {
      const storeId = location?.storeId || "0oS7Zig2gxj2MJesvlC2";
      const handled = await navigateToSpecializedCategory(
        lookupTitle,
        storeId,
        navigation,
        (cat) => {
          navigation.navigate("ProductListingFromHome", {
            categoryId: cat.id,
            categoryName: cat.name,
          });
        }
      );
      if (handled) return;
    }

    const contentMap: Record<string, string> = {
      "Puja": "Detailed guides for each of the nine days of Navratri, including mantras, offerings, and significance.",
      "Pooja Essentials": "Detailed guides for each of the nine days of Navratri, including mantras, offerings, and significance.",
      "Dry Fruits": "Premium quality dry fruits and nuts for your festive needs.",
      "Dairy": "Fresh milk, curd, and other dairy essentials for your daily rituals.",
      "Fruits": "Fresh and seasonal fruits for offerings and healthy snacking.",
      "Instant Food": "Quick and easy to prepare food items for your festive celebrations.",
    };

    const content = contentMap[title] || "Details coming soon.";
    navigation.navigate("NavratriContent", { title, content });
  };

  const CategoryCard = ({ 
    title, 
    subtitle, 
    icon, 
    flex = 1, 
    height = 120 
  }: { 
    title: string; 
    subtitle: string; 
    icon: string; 
    flex?: number;
    height?: number;
  }) => (
    <TouchableOpacity 
      style={[styles.categoryCard, { flex, height }]} 
      activeOpacity={0.9}
      onPress={() => handleCardPress(title)}
    >
      <LinearGradient
        colors={["rgba(60, 0, 0, 0.4)", "rgba(100, 20, 0, 0.8)"]}
        style={styles.cardGradient}
      >
        <View style={styles.cardIconContainer}>
          <MaterialCommunityIcons name={icon as any} size={32} color="#FFD700" />
        </View>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSubtitle}>{subtitle}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ImageBackground
        source={{
          uri: "https://firebasestorage.googleapis.com/v0/b/ninjadeliveries-91007.firebasestorage.app/o/normal%20ui%2FImage%20Mar%2019%2C.png?alt=media&token=c1308308-b9fa-446e-9302-4a3b6659fe19",
        }}
        style={styles.background}
        resizeMode="cover"
      >
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Deity Area Spacer */}
            <View style={{ height: 180 }} />

            {/* Title Section */}
            <View style={styles.titleSection}>
              <Text style={styles.preTitle}>HAPPY</Text>
              <Text style={styles.mainTitle}>Navratri</Text>
              <Text style={styles.subtitle}>Celebrate the Festival of Nine Nights!</Text>
            </View>

            {/* Top Grid: 3 cards */}
            <View style={styles.gridRow}>
              <CategoryCard 
                title="Puja" 
                subtitle="Guides for Each Day" 
                icon="hands-pray" 
              />
              <CategoryCard 
                title="Dry Fruits" 
                subtitle="Premium Quality Nuts" 
                icon="peanut" 
              />
              <CategoryCard 
                title="Dairy" 
                subtitle="Fresh Milk & Eggs" 
                icon="milk" 
              />
            </View>

            {/* Special Offers Banner */}
            <TouchableOpacity 
              style={styles.offersBanner} 
              activeOpacity={0.9}
              onPress={() => handleCardPress("Pooja Essentials")}
            >
              <LinearGradient
                colors={["#8B0000", "#D2691E"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.offersGradient}
              >
                <View style={styles.offersHeader}>
                  <View style={styles.offerLine} />
                  <Text style={styles.offersTitle}>Navratri Special Offers</Text>
                  <View style={styles.offerLine} />
                </View>
                <Text style={styles.offersSubtitle}>Exclusive Discounts on Puja Essentials!</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Bottom Grid: 2 cards */}
            <View style={styles.gridRow}>
              <CategoryCard 
                title="Fruits" 
                subtitle="Fresh Seasonal Fruits" 
                icon="food-apple" 
                height={140}
              />
              <CategoryCard 
                title="Instant Food" 
                subtitle="Quick Festive Meals" 
                icon="pot-steam" 
                height={140}
              />
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  background: {
    flex: 1,
    width: SCREEN_WIDTH,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  titleSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  preTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFD700",
    letterSpacing: 2,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  mainTitle: {
    fontSize: 48,
    fontWeight: "900",
    color: "#fff",
    fontFamily: "serif",
    marginTop: -5,
    textShadowColor: "rgba(139, 0, 0, 0.8)",
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 5,
  },
  subtitle: {
    fontSize: 14,
    color: "#fff",
    marginTop: 5,
    fontWeight: "600",
    fontStyle: "italic",
    opacity: 0.9,
  },
  gridRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  categoryCard: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 215, 0, 0.3)",
  },
  cardGradient: {
    flex: 1,
    padding: 10,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  cardIconContainer: {
    marginBottom: 10,
    backgroundColor: "rgba(0,0,0,0.2)",
    padding: 8,
    borderRadius: 20,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
  },
  cardSubtitle: {
    fontSize: 10,
    color: "#FFD700",
    textAlign: "center",
    marginTop: 2,
    opacity: 0.8,
  },
  offersBanner: {
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 215, 0, 0.5)",
  },
  offersGradient: {
    padding: 15,
    alignItems: "center",
  },
  offersHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 5,
  },
  offerLine: {
    height: 1,
    width: 20,
    backgroundColor: "#FFD700",
  },
  offersTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 0.5,
  },
  offersSubtitle: {
    fontSize: 12,
    color: "#FFD700",
    marginBottom: 12,
    fontWeight: "600",
  },
});

export default NavratriPageScreen;
