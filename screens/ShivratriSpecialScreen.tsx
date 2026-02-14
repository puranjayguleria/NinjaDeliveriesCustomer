import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  FlatList,
  Animated,
  TouchableWithoutFeedback,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons, Ionicons, FontAwesome5, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import firestore from "@react-native-firebase/firestore";
import { Colors } from "@/constants/colors";
import { Typography } from "@/constants/typography";

const { width } = Dimensions.get("window");

// --- Theme Constants ---
const ShivratriTheme = {
  primary: "#FF9933", // Saffron
  dark: "#1A237E",    // Deep Indigo
  accent: "#FFD700",  // Gold
  bg: "#d6eaf8",      // Light Blue
  cardBg: "#FFFFFF",
  text: "#1A237E",
  subText: "#5C6BC0",
  success: "#2E7D32",
};

const PLACEHOLDER_BLURHASH = "LKO2?U%2Tw=w]~RBVZRi};ofM{ay";

// --- Data ---
const POOJA_SUBCATEGORIES = [
  {
    id: "1",
    name: "Premium Dhoop",
    image: "https://firebasestorage.googleapis.com/v0/b/ninjadeliveries-91007.firebasestorage.app/o/subcategories%2F1770882931284_dhoop.png?alt=media&token=cacd94f1-ecdc-4139-b56e-062fb23f919d",
    badge: "Bestseller",
    discount: "20% OFF",
  },
  {
    id: "2",
    name: "Premium Incense Sticks",
    image: "https://firebasestorage.googleapis.com/v0/b/ninjadeliveries-91007.firebasestorage.app/o/subcategories%2F1770883325078_Premium%20Incense%20Sticks.png?alt=media&token=6b8fe752-8a66-46ef-9477-b2ee433c6c14",
    badge: "New Arrival",
    discount: "15% OFF",
  },
  {
    id: "3",
    name: "Puja Cotton",
    image: "https://firebasestorage.googleapis.com/v0/b/ninjadeliveries-91007.firebasestorage.app/o/subcategories%2F1770892253717_image.jpg?alt=media&token=c6c46f13-98ea-4f02-8fe1-2642ed276e26",
    badge: "Temple-Ready",
  },
  {
    id: "4",
    name: "Pure Pooja Oil",
    image: "https://firebasestorage.googleapis.com/v0/b/ninjadeliveries-91007.firebasestorage.app/o/subcategories%2F1770883847053_pooja%20oil.png?alt=media&token=23ce36a9-130a-427b-b867-ab46b7d1e170",
    badge: "Pure & Natural",
    discount: "10% OFF",
  },
  {
    id: "5",
    name: "Tilak",
    image: "https://images.unsplash.com/photo-1600112045783-d3d686b8a0b2?auto=format&fit=crop&w=400&q=80",
    badge: "Authentic",
  },
  {
    id: "6",
    name: "Fasting Food",
    image: "https://firebasestorage.googleapis.com/v0/b/ninjadeliveries-91007.firebasestorage.app/o/subcategories%2F1771045606151_2nzvgKz0pQ_1ROVMDnM1oOnynrFBPWRbEnX8vZA4VohKUI_Kqt1XsLB-tKITPLUKhLutg7pJJS8-VwNAApgHV_EhW-zuvqsKXCb56y82b3c.jpg?alt=media&token=472592ca-dbed-4507-a1bb-4961c6a46d96",
    badge: "Farm Fresh",
  },
];

const TRUST_CHIPS = [
  { icon: "check-decagram", text: "Authentic" },
  { icon: "leaf", text: "Fresh" },
  { icon: "truck-fast", text: "Same-Day Delivery" },
];

// --- Components ---

const SubcategoryCard = ({ item, onPress }: { item: any; onPress: () => void }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 20,
    }).start();
  };

  const pressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
    }).start();
  };

  return (
    <TouchableWithoutFeedback onPress={onPress} onPressIn={pressIn} onPressOut={pressOut}>
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        <View style={styles.cardHeader}>
          {item.badge ? (
            <View style={[styles.badge, item.badge === "Bestseller" && styles.bestsellerBadge]}>
              <Text style={styles.badgeText}>{item.badge}</Text>
            </View>
          ) : <View />}
          {item.discount && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>{item.discount}</Text>
            </View>
          )}
        </View>
        
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: item.image }}
            style={styles.productImage}
            contentFit="cover"
            transition={200}
            placeholder={PLACEHOLDER_BLURHASH}
            cachePolicy="memory-disk"
          />
        </View>
        
        <View style={styles.cardContent}>
          <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
          <TouchableOpacity style={styles.exploreBtn} onPress={onPress}>
             <Text style={styles.exploreText}>Explore Now</Text>
             <MaterialIcons name="arrow-forward" size={12} color={ShivratriTheme.primary} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

const SectionDivider = () => (
  <View style={styles.dividerContainer}>
    <View style={styles.dividerLine} />
    <MaterialCommunityIcons name="om" size={24} color={ShivratriTheme.accent} style={styles.dividerIcon} />
    <View style={styles.dividerLine} />
  </View>
);

export default function ShivratriSpecialScreen() {
  const navigation = useNavigation<any>();
  const [timeLeft, setTimeLeft] = useState("2h 15m");
  const [isShivratriBgActive, setIsShivratriBgActive] = useState(false);

  useEffect(() => {
    const unsub = firestore()
      .collection('shivratri_config')
      .doc('settings')
      .onSnapshot(doc => {
        setIsShivratriBgActive(doc?.data()?.isBackgroundVisible ?? false);
      }, (err) => {
        console.log("Shivratri BG config error", err);
        setIsShivratriBgActive(false);
      });
    return () => unsub();
  }, []);

  const handleSubcategoryPress = async (item: any) => {
    if (item.name === "Premium Dhoop") {
      try {
        const storeId = "0oS7Zig2gxj2MJesvlC2"; // Or fetch from context if dynamic
        
        // Fetch subcategory doc for ID
        const snap = await firestore()
          .collection("subcategories")
          .where("storeId", "==", storeId)
          .where("categoryId", "==", "Pooja Essentials")
          .where("name", "==", "Premium Dhoop")
          .limit(1)
          .get();

        if (!snap.empty) {
          const doc = snap.docs[0];
          navigation.navigate("ProductListingFromHome", {
            categoryId: "Pooja Essentials",
            categoryName: "Premium Dhoop",
            subcategoryId: doc.id,
          });
          return;
        }
      } catch (e) {
        console.log("Nav error", e);
      }
    }

    if (item.name === "Premium Incense Sticks") {
      try {
        const storeId = "0oS7Zig2gxj2MJesvlC2"; 
        
        const snap = await firestore()
          .collection("subcategories")
          .where("storeId", "==", storeId)
          .where("categoryId", "==", "Pooja Essentials")
          .where("name", "==", "Premium Incense Sticks")
          .limit(1)
          .get();

        if (!snap.empty) {
          const doc = snap.docs[0];
          navigation.navigate("ProductListingFromHome", {
            categoryId: "Pooja Essentials",
            categoryName: "Premium Incense Sticks",
            subcategoryId: doc.id,
          });
          return;
        }
      } catch (e) {
        console.log("Nav error", e);
      }
    }

    if (item.name === "Puja Cotton") {
      try {
        const storeId = "0oS7Zig2gxj2MJesvlC2"; 
        
        const snap = await firestore()
          .collection("subcategories")
          .where("storeId", "==", storeId)
          .where("categoryId", "==", "Pooja Essentials")
          .where("name", "==", "Puja Cotton")
          .limit(1)
          .get();

        if (!snap.empty) {
          const doc = snap.docs[0];
          navigation.navigate("ProductListingFromHome", {
            categoryId: "Pooja Essentials",
            categoryName: "Puja Cotton",
            subcategoryId: doc.id,
          });
          return;
        }
      } catch (e) {
        console.log("Nav error", e);
      }
    }

    if (item.name === "Pure Pooja Oil") {
      try {
        const storeId = "0oS7Zig2gxj2MJesvlC2"; 
        
        const snap = await firestore()
          .collection("subcategories")
          .where("storeId", "==", storeId)
          .where("categoryId", "==", "Pooja Essentials")
          .where("name", "==", "Pure Pooja Oil")
          .limit(1)
          .get();

        if (!snap.empty) {
          const doc = snap.docs[0];
          navigation.navigate("ProductListingFromHome", {
            categoryId: "Pooja Essentials",
            categoryName: "Pure Pooja Oil",
            subcategoryId: doc.id,
          });
          return;
        }
      } catch (e) {
        console.log("Nav error", e);
      }
    }

    if (item.name === "Fasting Food") {
      try {
        const storeId = "0oS7Zig2gxj2MJesvlC2"; 
        
        const snap = await firestore()
          .collection("subcategories")
          .where("storeId", "==", storeId)
          .where("categoryId", "==", "Pooja Essentials")
          .where("name", "==", "Fasting Food")
          .limit(1)
          .get();

        if (!snap.empty) {
          const doc = snap.docs[0];
          navigation.navigate("ProductListingFromHome", {
            categoryId: "Pooja Essentials",
            categoryName: "Fasting Food",
            subcategoryId: doc.id,
          });
          return;
        }
      } catch (e) {
        console.log("Nav error", e);
      }
    }

    navigation.navigate("ProductListingFromHome", {
      categoryName: "Pooja Essentials",
      searchQuery: item.name,
    });
  };

  const renderHeader = () => (
    <View style={styles.listHeader}>
      {/* Enhanced Hero Banner */}
      <View style={styles.bannerContainer}>
        <Image 
          source={{ uri: "https://firebasestorage.googleapis.com/v0/b/ninjadeliveries-91007.firebasestorage.app/o/shivratri%2Fshiv.jpeg?alt=media&token=5887ebea-e3c0-49a7-88c0-bddc0822b915" }}
          style={styles.bannerImage}
          contentFit="cover"
          transition={300}
          placeholder={PLACEHOLDER_BLURHASH}
        />
        <LinearGradient
          colors={["rgba(26, 35, 126, 0.0)", "rgba(26, 35, 126, 0.1)", "rgba(26, 35, 126, 0.3)"]}
          style={styles.bannerOverlay}
        >
          <View style={styles.bannerContent}>
            <Text style={styles.festivalName}>MAHASHIVRATRI</Text>
          </View>
        </LinearGradient>
      </View>

      {/* Trust Chips */}
      <View style={styles.chipsContainer}>
        {TRUST_CHIPS.map((chip, index) => (
          <View key={index} style={styles.chip}>
            <MaterialCommunityIcons name={chip.icon as any} size={14} color={ShivratriTheme.success} style={{marginRight: 4}} />
            <Text style={styles.chipText}>{chip.text}</Text>
          </View>
        ))}
      </View>
      
      <SectionDivider />

      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Pooja Essentials</Text>
          <View style={styles.titleUnderline} />
        </View>
      </View>
    </View>
  );

  const renderFooter = () => (
    <View style={styles.footerContainer}>
      <MaterialCommunityIcons name="hand-heart-outline" size={20} color={ShivratriTheme.subText} />
      <Text style={styles.footerText}>Curated with devotion, delivered with care.</Text>
      <View style={styles.verifiedBadge}>
        <MaterialIcons name="verified" size={14} color={ShivratriTheme.success} />
        <Text style={styles.verifiedText}> Verified Temple-Grade</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <StatusBar style="dark" />
      {isShivratriBgActive && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Image
            source={{ uri: "https://firebasestorage.googleapis.com/v0/b/ninjadeliveries-91007.firebasestorage.app/o/shivratri%2Fmaha%20special%20bg.jpeg?alt=media&token=b2eebd34-0e3f-4dc7-b542-b402b1b648d6" }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        </View>
      )}
      
      {/* Navigation Bar */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.iconButton}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <MaterialIcons name="arrow-back" size={24} color={ShivratriTheme.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mahashivratri Specials</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={POOJA_SUBCATEGORIES}
        keyExtractor={(item) => item.id}
        numColumns={2}
        renderItem={({ item }) => (
          <SubcategoryCard 
            item={item} 
            onPress={() => handleSubcategoryPress(item)} 
          />
        )}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnWrapper}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ShivratriTheme.bg,
  },
  // Navigation Bar
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#d6eaf8", // Light Blue
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700", // Serif simulation
    color: ShivratriTheme.dark,
    letterSpacing: 0.5,
  },
  iconButton: {
    padding: 8,
  },
  headerActions: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    padding: 4,
  },
  
  listContent: {
    paddingBottom: 24,
  },
  listHeader: {
    marginBottom: 8,
  },

  // Hero Banner
  bannerContainer: {
    height: 240,
    width: "100%",
    position: 'relative',
    marginBottom: 16,
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  bannerOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    justifyContent: "flex-end",
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  bannerContent: {
    alignItems: "center",
    width: "100%",
  },
  festivalName: {
    color: "#E0F7FA", // Light Blue
    fontSize: 34,
    fontWeight: "bold",
    letterSpacing: 1.5,
    marginBottom: 4,
    // 3D Effect Layering
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: {width: 2, height: 3}, 
    textShadowRadius: 1,
    fontFamily: Platform.OS === 'ios' ? 'HelveticaNeue-CondensedBold' : 'sans-serif-condensed',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  offerDetails: {
    color: ShivratriTheme.accent,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: {width: -1, height: 1},
    textShadowRadius: 10,
  },
  deliveryPromiseContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    marginBottom: 6,
  },
  deliveryPromise: {
    color: "#E0E0E0",
    fontSize: 12,
    fontWeight: "600",
  },
  timerContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: ShivratriTheme.dark,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  timerText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "700",
  },

  // Trust Chips
  chipsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 16,
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  chipText: {
    fontSize: 11,
    color: ShivratriTheme.dark,
    fontWeight: "600",
  },

  // Divider
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 12,
    paddingHorizontal: 40,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E0E0E0",
  },
  dividerIcon: {
    marginHorizontal: 12,
  },

  // Section Header
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 16,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: ShivratriTheme.dark,
    letterSpacing: 0.5,
  },
  titleUnderline: {
    height: 3,
    width: 40,
    backgroundColor: ShivratriTheme.accent,
    marginTop: 4,
    borderRadius: 2,
  },
  seeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 4,
  },
  seeAllText: {
    fontSize: 14,
    color: ShivratriTheme.dark,
    fontWeight: "700",
    marginRight: 4,
  },

  // Grid / Cards
  columnWrapper: {
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  card: {
    width: (width - 48) / 2, 
    marginBottom: 16,
    backgroundColor: ShivratriTheme.cardBg,
    borderRadius: 12,
    padding: 0,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  cardHeader: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    zIndex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  badge: {
    backgroundColor: ShivratriTheme.dark,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  bestsellerBadge: {
    backgroundColor: ShivratriTheme.accent,
  },
  badgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
    textTransform: 'uppercase',
  },
  discountBadge: {
    backgroundColor: "#D32F2F",
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 4,
  },
  discountText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
  },
  imageContainer: {
    width: "100%",
    height: 140,
    backgroundColor: "#fff",
  },
  productImage: {
    width: "100%",
    height: "100%",
  },
  cardContent: {
    padding: 12,
    alignItems: "flex-start",
  },
  productName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
    height: 40, 
    lineHeight: 20,
  },
  exploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  exploreText: {
    fontSize: 12,
    color: ShivratriTheme.primary,
    fontWeight: "700",
    marginRight: 4,
    textTransform: 'uppercase',
  },

  // Footer
  footerContainer: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: "#F9FAFB",
    marginTop: 8,
  },
  footerText: {
    fontSize: 12,
    color: ShivratriTheme.subText,
    fontStyle: 'italic',
    marginTop: 8,
    marginBottom: 8,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verifiedText: {
    fontSize: 10,
    color: ShivratriTheme.success,
    fontWeight: "700",
  },
});
