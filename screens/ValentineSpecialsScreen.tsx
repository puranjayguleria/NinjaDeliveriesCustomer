import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ImageBackground,
  Dimensions,
  TouchableOpacity,
  SafeAreaView,
  Image,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { VALENTINE_PRODUCTS, SPECIAL_OFFERS } from "@/constants/ValentineProducts";

const { width } = Dimensions.get("window");

const ValentineSpecialsScreen = () => {
  const navigation = useNavigation<any>();

  const handleProductPress = (item: any) => {
    if (item.id === "v1") {
      // Luxury Chocolate Box -> All chocolates
      navigation.navigate("ProductListingFromHome", { 
        categoryName: "Chocolates",
        searchQuery: "chocolate" 
      });
    } else if (item.id === "v2" || item.id === "v6") {
      // Rose Bouquet or Mixed Flower Arrangement -> Make Bouquet
      navigation.navigate("MakeBouquetScreen");
    } else {
      // Default behavior
      navigation.navigate("ProductDetails", { product: item });
    }
  };

  return (
    <View style={styles.container}>
      {/* Background Image - Using a network image as placeholder for the "second image" 
          User should replace uri with their local asset if needed */}
      <ImageBackground
        source={{
          uri: "https://images.unsplash.com/photo-1503455637927-730bce8583c0?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
        }}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <SafeAreaView style={styles.safeArea}>
          {/* Back Button */}
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={28} color="#b22222" />
          </TouchableOpacity>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Valentine Specials</Text>
              <Text style={styles.headerSubtitle}>
                Surprise Your Loved Ones with Something Sweet
              </Text>
            </View>

            {/* Sale Banner */}
            <View style={styles.bannerContainer}>
              <LinearGradient
                colors={["#ffe6e9", "#ffccd5"]}
                style={styles.bannerGradient}
              >
                <View style={styles.bannerContent}>
                  <View style={styles.bannerTextContainer}>
                    <Text style={styles.bannerTitle}>Valentine's</Text>
                    <View style={styles.saleBadge}>
                      <Text style={styles.saleText}>SALE</Text>
                    </View>
                    <Text style={styles.discountText}>
                      UP TO <Text style={styles.percentText}>50%</Text> OFF
                    </Text>
                    <TouchableOpacity style={styles.shopNowButton}>
                      <Text style={styles.shopNowText}>Shop Now</Text>
                    </TouchableOpacity>
                  </View>
                  <Image
                    source={{
                      uri: "https://images.unsplash.com/photo-1581938165093-050aeb5ef218?q=80&w=735&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
                    }}
                    style={styles.bannerImage}
                  />
                </View>
              </LinearGradient>
            </View>

            {/* Best Gifts Section */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Best Gifts for Your Valentine</Text>
              <View style={styles.gridContainer}>
                {VALENTINE_PRODUCTS.map((item) => (
                  <View key={item.id} style={styles.productCard}>
                    <TouchableOpacity onPress={() => handleProductPress(item)}>
                      <Image source={{ uri: item.image }} style={styles.productImage} />
                    </TouchableOpacity>
                    <View style={styles.productInfo}>
                      <Text style={styles.productName}>{item.name}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Special Offers Section */}
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Special Offers</Text>
              </View>
              <View style={styles.offersRow}>
                {SPECIAL_OFFERS.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.offerCard}
                    onPress={() => handleProductPress(item)}
                  >
                    <Image source={{ uri: item.image }} style={styles.offerImage} />
                    <View style={styles.offerOverlay}>
                      <Text style={styles.offerName}>{item.name}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
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
  },
  backgroundImage: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  safeArea: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    top: 20,
    left: 15,
    zIndex: 10,
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 20,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
    marginTop: 60,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#b22222",
    fontFamily: "IndieFlower",
    textShadowColor: "rgba(255, 255, 255, 0.6)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  headerSubtitle: {
    fontSize: 16,
    color: "#8b0000",
    marginTop: 5,
    fontWeight: "600",
    textAlign: "center",
  },
  bannerContainer: {
    marginBottom: 24,
    borderRadius: 20,
    overflow: "hidden",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  bannerGradient: {
    padding: 20,
  },
  bannerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#8b0000",
    marginBottom: 5,
  },
  saleBadge: {
    backgroundColor: "#b22222",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: "flex-start",
    marginBottom: 5,
  },
  saleText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 12,
  },
  discountText: {
    fontSize: 16,
    color: "#555",
    marginBottom: 10,
  },
  percentText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#b22222",
  },
  shopNowButton: {
    backgroundColor: "#b22222",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  shopNowText: {
    color: "#fff",
    fontWeight: "bold",
  },
  bannerImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: "#fff",
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#8b0000",
    marginBottom: 12,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  productCard: {
    width: (width - 48) / 2,
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 16,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  productImage: {
    width: "100%",
    height: 140,
    resizeMode: "cover",
  },
  productInfo: {
    padding: 12,
  },
  productName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  viewAllText: {
    color: "#666",
    fontSize: 14,
  },
  offersRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  offerCard: {
    width: (width - 48) / 2,
    height: 100,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  offerImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  offerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
    padding: 8,
  },
  offerName: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
});

export default ValentineSpecialsScreen;
