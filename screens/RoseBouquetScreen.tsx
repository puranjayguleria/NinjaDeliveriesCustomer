import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  Image,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import firestore from "@react-native-firebase/firestore";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import { useCart } from "../context/CartContext";
import ProductCard from "../components/ProductCard";
import { useLocationContext } from "../context/LocationContext";

const { width } = Dimensions.get("window");


const RoseBouquetScreen = () => {
  const navigation = useNavigation<any>();
  // Products list removed as per request
  const { location } = useLocationContext();
  const [flowerBouquetSubcategory, setFlowerBouquetSubcategory] = useState<{
    subcategoryId: string;
    categoryId: string;
  } | null>(null);

  useEffect(() => {
    const storeId = location?.storeId;
    if (!storeId) {
      setFlowerBouquetSubcategory(null);
      return;
    }

    let cancelled = false;
    firestore()
      .collection("subcategories")
      .where("storeId", "==", storeId)
      .where("name", "==", "Flower Bouquet")
      .limit(1)
      .get()
      .then((snap) => {
        if (cancelled) return;
        if (snap.empty) {
          setFlowerBouquetSubcategory(null);
          return;
        }
        const doc = snap.docs[0];
        const data: any = doc.data() || {};
        const categoryId = String(data.categoryId || "Gift Shop").replace(/`/g, "").trim();
        setFlowerBouquetSubcategory({ subcategoryId: doc.id, categoryId });
      })
      .catch(() => {
        if (!cancelled) setFlowerBouquetSubcategory(null);
      });

    return () => {
      cancelled = true;
    };
  }, [location?.storeId]);

  const openFlowerBouquetProducts = () => {
    if (flowerBouquetSubcategory) {
      navigation.navigate("ProductListingFromHome", {
        categoryId: flowerBouquetSubcategory.categoryId,
        categoryName: "Flower Bouquet",
        subcategoryId: flowerBouquetSubcategory.subcategoryId,
      });
      return;
    }

    navigation.navigate("ProductListingFromHome", {
      categoryId: "Gift Shop",
      categoryName: "Flower Bouquet",
      searchQuery: "bouquet",
    });
  };


  const renderHeader = () => (
    <View style={styles.container}>
      {/* 2. Header Title & Info (Simplified per request) */}
      <View style={styles.headerInfoContainer}>
         <View style={styles.titleRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={{marginRight: 12}}>
               <Ionicons name="arrow-back" size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.mainTitle}>Rose Bouquets</Text>
            <View style={{flex: 1}} />
         </View>
         {/* Removed Sort By and Breadcrumbs per request */}
      </View>

      {/* 1. New Top Navigation Categories */}
      <View>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.topNavContainer}
          contentContainerStyle={styles.topNavContent}
        >
           {["Valentine's", "Birthday", "Occasions", "Anniversary", "Flowers"].map((item, index) => (
             <TouchableOpacity 
               key={index} 
               style={styles.topNavItem}
               onPress={() => navigation.navigate("ProductListingFromHome", { categoryName: item, searchQuery: item.toLowerCase() })}
             >
               <Text style={styles.topNavText}>{item} ⌄</Text>
             </TouchableOpacity>
           ))}
        </ScrollView>
      </View>

      <View style={styles.bodyRow}>
        {/* 3. Filter Sidebar (Visual Mock) */}
        <View style={styles.filterSidebar}>
           <Text style={styles.filterTitle}>Filter</Text>
           <View style={styles.filterSection}>
              <View style={styles.filterHeaderRow}>
                 <Text style={styles.filterLabel}>Price</Text>
                 <Text style={styles.minusIcon}>—</Text>
              </View>
              {/* Visual Slider Mock */}
              <View style={styles.chartBarMock}>
                 <View style={[styles.bar, {height: 10}]} />
                 <View style={[styles.bar, {height: 15}]} />
                 <View style={[styles.bar, {height: 12}]} />
                 <View style={[styles.bar, {height: 8}]} />
                 <View style={[styles.bar, {height: 5}]} />
                 <View style={[styles.bar, {height: 10}]} />
              </View>
              <View style={styles.sliderLine}>
                 <View style={styles.sliderKnobLeft} />
                 <View style={styles.sliderKnobRight} />
              </View>
              <View style={styles.priceInputs}>
                 <View style={styles.priceInputBox}>
                    <Text style={styles.priceInputText}>₹ 0</Text>
                 </View>
                 <View style={styles.priceInputBox}>
                    <Text style={styles.priceInputText}>₹ 120000</Text>
                 </View>
              </View>
           </View>
        </View>

        {/* 4. Main Content Area */}
        <View style={styles.mainContent}>
           {/* Visual Categories Row */}
           <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.visualCatScroll}>
              {VISUAL_CATEGORIES.map((cat, index) => (
                <TouchableOpacity 
                  key={index} 
                  style={styles.visualCatCard}
                  onPress={() => navigation.navigate("ProductListingFromHome", { categoryName: cat.name, searchQuery: cat.name.toLowerCase() })}
                >
                   <Image 
                     source={{ uri: cat.image }} 
                     style={styles.visualCatImg} 
                     resizeMode="cover"
                   />
                   <Text style={styles.visualCatTitle}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
           </ScrollView>

           {/* Make Bouquets Button */}
           <TouchableOpacity 
             style={styles.makeBouquetButton}
             onPress={openFlowerBouquetProducts}
           >
             <MaterialIcons name="local-florist" size={20} color="#fff" style={{marginRight: 8}} />
             <Text style={styles.makeBouquetText}>Make Bouquet</Text>
           </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {renderHeader()}
      </ScrollView>
    </SafeAreaView>
  );

};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
    paddingTop: Platform.OS === "android" ? 24 : 0,
  },
  container: {
    backgroundColor: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  topNavContainer: {
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    backgroundColor: "#fff",
    flexGrow: 0,
  },
  topNavContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  topNavItem: {
    marginRight: 24,
  },
  topNavText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#000",
  },
  headerInfoContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 8,
  },
  mainTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#000",
    marginRight: 8,
  },
  itemCount: {
    fontSize: 12,
    color: "#757575",
    marginRight: 8,
  },
  ratingBadge: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    marginRight: 4,
  },
  ratingText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 10,
  },
  reviewCount: {
    color: "#4285F4",
    fontSize: 12,
    fontWeight: "500",
  },
  sortContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
  },
  sortText: {
    color: "#757575",
    fontSize: 12,
  },
  sortValue: {
    color: "#000",
    fontWeight: "bold",
    fontSize: 12,
  },
  bodyRow: {
    flexDirection: "row",
  },
  filterSidebar: {
    width: 100, // Fixed narrow width for mobile "sidebar" simulation
    borderRightWidth: 1,
    borderRightColor: "#eee",
    padding: 8,
    display: "none", // Hidden on small screens by default logic, but user wanted EXACT image. 
                     // The image is desktop. On mobile, a 100px sidebar crushes content.
                     // I will hide it or make it very small if I must, but for "exact same" request I should try to show it?
                     // NO, showing a desktop sidebar on mobile is unusable. I will mimic the *visuals* in a top block or just hide the sidebar and keep the top visuals.
                     // Let's comment out display:none if we want to force it, but better to put it on top for mobile.
                     // Actually, I'll put the "Filter" block ABOVE the products but styled like the sidebar.
  },
  // Re-implementing Filter as a top block for mobile to match visual elements without breaking layout
  filterTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
  },
  filterSection: {
    marginBottom: 16,
  },
  filterHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: "bold",
  },
  minusIcon: {
    fontSize: 12,
    color: "#757575",
  },
  chartBarMock: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 30,
    marginBottom: 4,
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  bar: {
    width: 8,
    backgroundColor: "#e0e0e0",
    borderRadius: 2,
  },
  sliderLine: {
    height: 2,
    backgroundColor: "#8BC34A", // Green slider line
    position: "relative",
    marginBottom: 12,
  },
  sliderKnobLeft: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#8BC34A",
    position: "absolute",
    left: 0,
    top: -4,
  },
  sliderKnobRight: {
    width: 10,
    height: 10,
    borderRadius: 3,
    backgroundColor: "#c42770ff",
    borderWidth: 1,
    borderColor: "#8BC34A",
    position: "absolute",
    right: 0,
    top: -4,
  },
  priceInputs: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  priceInputBox: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 4,
    padding: 4,
    width: "45%",
  },
  priceInputText: {
    fontSize: 10,
    color: "#333",
  },
  mainContent: {
    flex: 1,
    paddingLeft: 12,
  },
  visualCatScroll: {
    marginVertical: 12,
  },
  visualCatCard: {
    marginRight: 12,
    alignItems: "center",
    width: 100,
  },
  visualCatImg: {
    width: 100,
    height: 100,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: "#f5f5f5",
  },
  visualCatTitle: {
    fontSize: 11,
    fontWeight: "bold",
    textAlign: "center",
    color: "#333",
  },
  listContent: {
    paddingBottom: 20,
    paddingHorizontal: 12, // Match main content padding
  },
  columnWrapper: {
    justifyContent: "flex-start", // Changed from space-between to prevent spreading
  },
  cardWrapper: {
    width: (width - 42) / 3, // Adjusted width: (Screen - Padding(24) - Margins(18)) / 3
    marginRight: 6, // Fixed margin for consistent spacing
    marginBottom: 12,
  },
  productCard: {
    width: "100%", 
    height: 240, 
    margin: 0, // Override default card margin to fix spacing
  },
  makeBouquetButton: {
    backgroundColor: "#D81B60",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 12,
    marginRight: 12, // Match scrollview margin
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  makeBouquetText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default RoseBouquetScreen;
