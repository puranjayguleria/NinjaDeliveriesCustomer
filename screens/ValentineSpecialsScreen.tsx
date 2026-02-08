import React, { useEffect, useMemo, useState } from "react";
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
import { Colors } from "@/constants/colors";
import firestore from "@react-native-firebase/firestore";
import { useLocationContext } from "@/context/LocationContext";

const { width } = Dimensions.get("window");

const ValentineSpecialsScreen = () => {
  const navigation = useNavigation<any>();
  const visibleOffers = SPECIAL_OFFERS.filter((item) => item.id !== "v5" && item.id !== "v6");
  const { location } = useLocationContext();
  const [teddyImageUrl, setTeddyImageUrl] = useState<string | null>(null);

  const openSubcategoryListing = async (
    subcategoryName: string,
    fallbackCategoryId: string,
    fallbackCategoryName: string
  ) => {
    const storeId = location?.storeId;

    if (!storeId) {
      navigation.navigate("ProductListingFromHome", {
        categoryId: fallbackCategoryId,
        categoryName: fallbackCategoryName,
      });
      return;
    }

    try {
      const snap = await firestore()
        .collection("subcategories")
        .where("storeId", "==", storeId)
        .where("name", "==", subcategoryName)
        .limit(1)
        .get();

      if (snap.empty) {
        navigation.navigate("ProductListingFromHome", {
          categoryId: fallbackCategoryId,
          categoryName: fallbackCategoryName,
        });
        return;
      }

      const doc = snap.docs[0];
      const data: any = doc.data() || {};
      const categoryId = data.categoryId || fallbackCategoryId;

      navigation.navigate("ProductListingFromHome", {
        categoryId,
        categoryName: subcategoryName,
        subcategoryId: doc.id,
      });
    } catch {
      navigation.navigate("ProductListingFromHome", {
        categoryId: fallbackCategoryId,
        categoryName: fallbackCategoryName,
      });
    }
  };

  useEffect(() => {
    const storeId = location?.storeId;
    if (!storeId) {
      setTeddyImageUrl(null);
      return;
    }

    const unsub = firestore()
      .collection("subcategories")
      .where("storeId", "==", storeId)
      .where("name", "==", "Teddy Bear")
      .limit(1)
      .onSnapshot(
        (snap) => {
          if (snap.empty) {
            setTeddyImageUrl(null);
            return;
          }
          const data: any = snap.docs[0].data() || {};
          const raw = String(data.image || "").replace(/`/g, "").trim();
          setTeddyImageUrl(raw || null);
        },
        () => setTeddyImageUrl(null)
      );

    return () => unsub();
  }, [location?.storeId]);

  const handleProductPress = async (item: any) => {
    if (item.id === "v1") {
      await openSubcategoryListing(
        "Chocolate & Sweets",
        "Snacks & Ready-to-Eat",
        "Snacks & Ready-to-Eat"
      );
    } else if (item.id === "v2") {
      await openSubcategoryListing("Bouquet", "Gift Shop", "Gift Shop");
    } else if (item.id === "v6") {
      navigation.navigate("MakeBouquetScreen");
    } else if (item.id === "v3") {
      await openSubcategoryListing("Teddy Bear", "Gift Shop", "Gift Shop");
    } else if (item.id === "v4") {
      await openSubcategoryListing(
        "Condoms",
        "Sexual Wellness",
        "Sexual Wellness"
      );
    } else {
      // Default behavior
      navigation.navigate("ProductDetails", { product: item });
    }
  };

  const valentineProducts = useMemo(() => {
    const bouquetImageUrl = String(
      "https://firebasestorage.googleapis.com/v0/b/ninjadeliveries-91007.firebasestorage.app/o/valentine%20week%2Fval_specialScreen%2FbouquetImg.jpeg?alt=media&token=31cff32e-dcbb-4616-8a70-55814aa47ff1"
    )
      .replace(/`/g, "")
      .trim();
    const luxuryChocoImageUrl = String(
      "https://firebasestorage.googleapis.com/v0/b/ninjadeliveries-91007.firebasestorage.app/o/valentine%20week%2Fval_specialScreen%2Fval_chocoBox.webp?alt=media&token=b07b0ca1-a1ce-4226-b4cc-85a006a38407"
    )
      .replace(/`/g, "")
      .trim();
    const sexualWellnessImageUrl = String(
      "https://firebasestorage.googleapis.com/v0/b/ninjadeliveries-91007.firebasestorage.app/o/valentine%20week%2Fval_specialScreen%2FsexualWell.png?alt=media&token=4a5103bb-969c-4a37-b2f8-94193238bf45"
    )
      .replace(/`/g, "")
      .trim();

    return VALENTINE_PRODUCTS.map((p) => {
      if (p.id === "v1" && luxuryChocoImageUrl) {
        return { ...p, image: luxuryChocoImageUrl };
      }
      if (p.id === "v2" && bouquetImageUrl) {
        return { ...p, image: bouquetImageUrl };
      }
      if (p.id === "v4") {
        return {
          ...p,
          name: "Sexual Wellness",
          image: sexualWellnessImageUrl || p.image,
          description: "Explore Sexual Wellness products",
        };
      }
      if (p.id !== "v3") return p;
      if (!teddyImageUrl) return p;
      return { ...p, image: teddyImageUrl };
    });
  }, [teddyImageUrl]);

  return (
    <View style={styles.container}>
      {/* Background Image - Using a network image as placeholder for the "second image" 
          User should replace uri with their local asset if needed */}
      <ImageBackground
        source={{
          uri: "https://firebasestorage.googleapis.com/v0/b/ninjadeliveries-91007.firebasestorage.app/o/valentine%20week%2Fval_specialScreen%2Fval_spesBG.png?alt=media&token=2a0aecd1-f5cd-441f-b149-5877f9985e00",
        }}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <SafeAreaView style={styles.safeArea}>
          {/* Back Button */}
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
            accessibilityLabel="Go back"
            accessibilityHint="Returns to previous screen"
            accessibilityRole="button"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={28} color={Colors.valentine.primary} />
          </TouchableOpacity>

          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle} accessibilityRole="header">Valentine Specials</Text>
              <Text style={styles.headerSubtitle}>
                Surprise Your Loved Ones with Something Sweet
              </Text>
            </View>

            {/* Sale Banner */}
            <View style={styles.bannerContainer}>
              <LinearGradient
                colors={[Colors.valentine.gradientStart, Colors.valentine.gradientEnd]}
                style={styles.bannerGradient}
              >
                <View style={styles.bannerContent}>
                  <View style={styles.bannerTextContainer}>
                    <Text style={styles.bannerTitle}>Valentine's</Text>
                    <View style={styles.saleBadge}>
                      <Text style={styles.saleText}>SALE</Text>
                    </View>
                    <Text style={styles.discountText}>
                      UP TO <Text style={styles.percentText}>40%</Text> OFF
                    </Text>
                    <View style={styles.shopNowButton}>
                      <Text style={styles.shopNowText}>Special</Text>
                    </View>
                  </View>
                  <Image
                    source={{
                      uri: "https://firebasestorage.googleapis.com/v0/b/ninjadeliveries-91007.firebasestorage.app/o/valentine%20week%2Fval_specialScreen%2FvalSaleTheme.png?alt=media&token=14bc4bca-854b-45d9-a996-a4f80f0ebd03",
                    }}
                    style={styles.bannerImage}
                    accessibilityLabel="Valentine's day chocolates and gifts"
                  />
                </View>
              </LinearGradient>
            </View>

            {/* Best Gifts Section */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle} accessibilityRole="header">Best Gifts for Your Valentine</Text>
              <View style={styles.gridContainer}>
                {valentineProducts.map((item) => {
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.productCard}
                      onPress={() => handleProductPress(item)}
                      activeOpacity={0.2}
                      accessibilityLabel={`View details for ${item.name}`}
                      accessibilityRole="button"
                    >
                      <Image source={{ uri: item.image }} style={styles.productImage} accessibilityLabel={item.name} />
                      <View style={styles.productInfo}>
                        <Text style={styles.productName}>{item.name}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {visibleOffers.length > 0 && (
              <View style={styles.sectionContainer}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle} accessibilityRole="header">Special Offers</Text>
                </View>
                <View style={styles.offersRow}>
                  {visibleOffers.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.offerCard}
                      onPress={() => handleProductPress(item)}
                      activeOpacity={0.2}
                      accessibilityLabel={`View details for ${item.name}`}
                      accessibilityRole="button"
                    >
                      <Image source={{ uri: item.image }} style={styles.offerImage} accessibilityLabel={item.name} />
                      <View style={styles.offerOverlay}>
                        <Text style={styles.offerName}>{item.name}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
            
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
    zIndex: 100,
    padding: 8,
    backgroundColor: Colors.white,
    borderRadius: 20,
    elevation: 10,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
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
    color: Colors.valentine.primary,
    fontFamily: "IndieFlower",
    textShadowColor: "rgba(255, 255, 255, 0.6)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  headerSubtitle: {
    fontSize: 16,
    color: Colors.valentine.dark,
    marginTop: 5,
    fontWeight: "600",
    textAlign: "center",
  },
  bannerContainer: {
    marginBottom: 24,
    borderRadius: 20,
    overflow: "hidden",
    elevation: 5,
    shadowColor: Colors.black,
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
    color: Colors.valentine.dark,
    marginBottom: 5,
  },
  saleBadge: {
    backgroundColor: Colors.valentine.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: "flex-start",
    marginBottom: 5,
  },
  saleText: {
    color: Colors.white,
    fontWeight: "bold",
    fontSize: 12,
  },
  discountText: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginBottom: 10,
  },
  percentText: {
    fontSize: 20,
    fontWeight: "bold",
    color: Colors.valentine.primary,
  },
  shopNowButton: {
    backgroundColor: Colors.valentine.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  shopNowText: {
    color: Colors.white,
    fontWeight: "bold",
  },
  bannerImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: Colors.valentine.dark,
    marginBottom: 12,
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  productCard: {
    width: (width - 48) / 2,
    backgroundColor: Colors.valentine.primary,
    borderRadius: 16,
    marginBottom: 16,
    overflow: "hidden",
    elevation: 3,
    shadowColor: Colors.white,
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
    color: Colors.white,
    marginBottom: 4,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  viewAllText: {
    color: Colors.text.muted,
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
    color: Colors.white,
    fontWeight: "bold",
    fontSize: 16,
    textAlign: "center",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  comingSoonOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  comingSoonText: {
    color: Colors.white,
    fontWeight: 'bold',
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

export default ValentineSpecialsScreen;
