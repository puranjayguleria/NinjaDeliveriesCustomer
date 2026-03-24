import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  StyleSheet,
  Image,
  Dimensions,
  RefreshControl,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Vibration,
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import { QuickTile } from "@/components/QuickTile";
import { ProductGridSkeleton } from "@/components/Skeleton";
import Loader from "@/components/VideoLoader";
import { useLocationContext } from "@/context/LocationContext";
import { Colors } from "@/constants/colors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PAGE_SIZE = 15; // Load 15 items at a time
const ITEM_SPACING = 8;
const BANNER_HEIGHT = 170;
const FIRST_ROW_HEIGHT = 200;
const ITEM_WIDTH = (SCREEN_WIDTH - ITEM_SPACING * 4) / 3; // 3 items with equal padding

const AllDiscountedProductsScreen: React.FC<{ route: any }> = ({ route }) => {
  const navigation = useNavigation();
  const { location, updateLocation } = useLocationContext();
  const storeId = location.storeId;
  const { type = "sale" } = route.params || {}; // "sale", "best", "fresh"
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [scrollY] = useState(new Animated.Value(0));
  const [sortOption, setSortOption] = useState("default");
  const [bannerImage, setBannerImage] = useState<string | null>(null);
  const [acceptedPan, setAcceptedPan] = useState(false);
  const [catAlert, setCatAlert] = useState(true);
  const [showGate, setShowGate] = useState(false);
  const onAcceptRef = useRef<() => void>(() => {});
  const sortedProducts = useMemo(() => {
    let sorted = [...products];
    switch (sortOption) {
      case 'price_asc':
        sorted.sort((a, b) => {
          const priceA = Number(a.price ?? 0) + Number(a.CGST ?? 0) + Number(a.SGST ?? 0);
          const priceB = Number(b.price ?? 0) + Number(b.CGST ?? 0) + Number(b.SGST ?? 0);
          return priceA - priceB;
        });
        break;
      case 'price_desc':
        sorted.sort((a, b) => {
          const priceA = Number(a.price ?? 0) + Number(a.CGST ?? 0) + Number(a.SGST ?? 0);
          const priceB = Number(b.price ?? 0) + Number(b.CGST ?? 0) + Number(b.SGST ?? 0);
          return priceB - priceA;
        });
        break;
      case 'discount':
        sorted.sort((a, b) => (Number(b.discount ?? 0)) - (Number(a.discount ?? 0)));
        break;
      default:
        // No sort for "Recommended"
        break;
    }
    return sorted;
  }, [products, sortOption]);

  const sortOptions = [
    { key: "default", label: "Recommended" },
    { key: "price_asc", label: "Price: Low to High" },
    { key: "price_desc", label: "Price: High to Low" },
    { key: "discount", label: "By Discount" },
  ];

  const bannerScale = scrollY.interpolate({
    inputRange: [-BANNER_HEIGHT, 0, BANNER_HEIGHT],
    outputRange: [2, 1, 0.5],
    extrapolate: "clamp",
  });

  const bannerTranslateY = scrollY.interpolate({
    inputRange: [-BANNER_HEIGHT, 0, BANNER_HEIGHT],
    outputRange: [-BANNER_HEIGHT / 2, 0, BANNER_HEIGHT * 0.4],
    extrapolate: "clamp",
  });

  const bannerOpacity = scrollY.interpolate({
    inputRange: [0, BANNER_HEIGHT * 0.8],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const maybeGate = useCallback(
    (cb: () => void, isPan: boolean) => {
      if (!isPan || acceptedPan || !catAlert) {
        cb();
        return;
      }
      onAcceptRef.current = cb;
      setShowGate(true);
    },
    [acceptedPan, catAlert]
  );

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0.9],
    extrapolate: "clamp",
  });

  const getTitle = () => {
    switch (type) {
      case "best": return "Best Sellers";
      case "fresh": return "Fresh Arrivals";
      case "sale": return "Offers & Deals";
      default: return "Products";
    }
  };

  const getBannerField = () => {
    switch (type) {
      case "best": return "bestSellerBanner";
      case "fresh": return "freshArrivalsBanner";
      case "sale": return "salesBanner";
      default: return "salesBanner";
    }
  };

  useEffect(() => {
    if (!location?.storeId) return;

    const fetchBanner = async () => {
      try {
        const querySnap = await firestore()
          .collection("banner")
          .where("storeId", "==", location.storeId)
          .limit(1)
          .get();

        if (!querySnap.empty) {
          const data = querySnap.docs[0].data();
          const specificBanner = data[getBannerField()] || data.salesBanner;
          
          if (type === "best") {
            setBannerImage("https://firebasestorage.googleapis.com/v0/b/ninjadeliveries-91007.firebasestorage.app/o/normal%20ui%2Fbest%20sellers.png?alt=media&token=566a34e0-fcdb-4c9a-a545-f7771d3b27e8");
          } else if (type === "fresh") {
            setBannerImage("https://firebasestorage.googleapis.com/v0/b/ninjadeliveries-91007.firebasestorage.app/o/normal%20ui%2Ffresh%20arrivals2.png?alt=media&token=f090d4f4-9662-4740-8b64-15e2167f7ed9");
          } else if (type === "sale") {
            setBannerImage("https://firebasestorage.googleapis.com/v0/b/ninjadeliveries-91007.firebasestorage.app/o/normal%20ui%2Foffers2.png?alt=media&token=a3cfe05f-82de-4496-b15a-7d1c5fc7a871");
          } else {
            setBannerImage(specificBanner || null);
          }
        } else if (type === "best") {
          // Fallback if no banner doc exists but we want to show the specific best seller image
          setBannerImage("https://firebasestorage.googleapis.com/v0/b/ninjadeliveries-91007.firebasestorage.app/o/normal%20ui%2Fbest%20sellers.png?alt=media&token=566a34e0-fcdb-4c9a-a545-f7771d3b27e8");
        } else if (type === "fresh") {
          // Fallback for fresh arrivals
          setBannerImage("https://firebasestorage.googleapis.com/v0/b/ninjadeliveries-91007.firebasestorage.app/o/normal%20ui%2Ffresh%20arrivals2.png?alt=media&token=f090d4f4-9662-4740-8b64-15e2167f7ed9");
        } else if (type === "sale") {
          // Fallback for offers
          setBannerImage("https://firebasestorage.googleapis.com/v0/b/ninjadeliveries-91007.firebasestorage.app/o/normal%20ui%2Foffers2.png?alt=media&token=a3cfe05f-82de-4496-b15a-7d1c5fc7a871");
        }
      } catch (error) {
        console.error("Error fetching banner image:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchBanner();
  }, [location?.storeId, type]);

  const fetchProducts = useCallback(
    async (loadMore = false) => {
      if (loading || (!loadMore && products.length > 0)) return;

      setLoading(true);

      try {
        let query;
        if (type === "sale") {
          query = firestore()
            .collection("saleProducts")
            .where("storeId", "==", storeId)
            .limit(PAGE_SIZE);
            
          if (loadMore && lastVisible) {
            query = query.startAfter(lastVisible);
          }
        } else {
          // For "best" and "fresh", we fetch products by storeId and sort in memory
          // to avoid needing a composite index. We'll fetch a broad sample.
          query = firestore()
            .collection("products")
            .where("storeId", "==", storeId)
            .limit(100);
        }

        const snapshot = await query.get();

        if (snapshot.empty) {
          if (loadMore) setHasMore(false);
          if (!loadMore) setProducts([]);
          return;
        }

        let newProducts = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        if (type === "best" || type === "fresh") {
          // Filter products with stock
          let filtered = newProducts.filter((p: any) => (p.quantity ?? 0) > 0);
          
          if (type === "best") {
            // Filter best sellers and sort by sales
            filtered = filtered.filter((p: any) => (p.weeklySold ?? 0) > 0);
            filtered.sort((a: any, b: any) => (b.weeklySold ?? 0) - (a.weeklySold ?? 0));
          } else {
            // Filter fresh arrivals and sort by creation time
            filtered = filtered.filter((p: any) => p.isNew === true);
            filtered.sort((a: any, b: any) => {
              const aTime = a.createdAt?.toDate?.()?.getTime?.() ?? 0;
              const bTime = b.createdAt?.toDate?.()?.getTime?.() ?? 0;
              return bTime - aTime;
            });
          }

          // Mixed 20 products from all categories
          const byCategory: Record<string, any[]> = {};
          filtered.forEach((p: any) => {
            const catId = p.categoryId || "uncategorized";
            if (!byCategory[catId]) byCategory[catId] = [];
            byCategory[catId].push(p);
          });

          const mixed20: any[] = [];
          const categories = Object.keys(byCategory);
          let catIdx = 0;
          
          // Keep picking one from each category until we have 20 or run out of products
          while (mixed20.length < 20 && categories.length > 0) {
            const currentCat = categories[catIdx % categories.length];
            const productsInCat = byCategory[currentCat];
            
            if (productsInCat.length > 0) {
              mixed20.push(productsInCat.shift());
            } else {
              // Remove category if it has no more products
              categories.splice(catIdx % categories.length, 1);
              if (categories.length === 0) break;
              // Don't increment catIdx if we just removed one, to keep the flow
              continue;
            }
            catIdx++;
          }
          
          newProducts = mixed20;
          setHasMore(false);
        }

        setProducts((prev) => {
          const combined = loadMore ? [...prev, ...newProducts] : newProducts;
          return combined.filter(
            (item, index, self) =>
              index === self.findIndex((p) => p.id === item.id)
          );
        });

        if (type === "sale") {
          setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
          setHasMore(snapshot.docs.length === PAGE_SIZE);
        }
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [storeId, lastVisible, loading, products.length, type]
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setProducts([]);
    setLastVisible(null);
    setHasMore(true);
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleEndReached = useCallback(() => {
    if (hasMore && !loading && !refreshing) {
      fetchProducts(true);
    }
  }, [fetchProducts, hasMore, loading, refreshing]);

  const renderItem = useCallback(({ item, index }: { item: any; index: number }) => {
    const isPan = item.categoryId === "panCorner";
    const scale = scrollY.interpolate({
      inputRange: [-1, 0, 150 * index, 150 * (index + 2)],
      outputRange: [1, 1, 1, 0.9],
      extrapolate: 'clamp',
    });
    const opacity = scrollY.interpolate({
      inputRange: [-1, 0, 150 * index, 150 * (index + 1)],
      outputRange: [1, 1, 1, 0.5],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View
        style={[
          styles.itemContainer,
          { transform: [{ scale }], opacity },
        ]}
      >
        <QuickTile
          p={item}
          isPan={isPan}
          onPress={() => maybeGate(() => navigation.navigate('ProductDetails', { productId: item.id }), isPan)}
        />
      </Animated.View>
    );
  }, [scrollY, maybeGate]);

  const keyExtractor = useCallback((item: any) => item.id, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background.default }}>
      <View style={{ flex: 1 }}>
        {/* Header Bar */}
        <Animated.View style={[styles.header, { backgroundColor: headerOpacity.interpolate({
          inputRange: [0, 1],
          outputRange: ['transparent', Colors.white]
        }) }]}>
          <TouchableOpacity
            style={[styles.backButtonInner, { backgroundColor: headerOpacity.interpolate({
              inputRange: [0, 1],
              outputRange: ["rgba(0,0,0,0.5)", "transparent"]
            }) }]}
            onPress={() => navigation.goBack()}
          >
            <Animated.View style={{ opacity: headerOpacity.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0]
            }) }}>
               <MaterialIcons name="arrow-back" size={24} color={Colors.white} style={{ position: 'absolute' }} />
            </Animated.View>
            <Animated.View style={{ opacity: headerOpacity }}>
               <MaterialIcons name="arrow-back" size={24} color={Colors.text.primary} />
            </Animated.View>
          </TouchableOpacity>
          
          <Animated.Text style={[styles.headerTitleInner, { 
            color: headerOpacity.interpolate({
              inputRange: [0, 1],
              outputRange: [Colors.white, Colors.text.primary]
            })
          }]}>
            {getTitle()}
          </Animated.Text>
        </Animated.View>

        {/* Sorting Controls */}
        <Animated.View style={[styles.sortContainer, { 
          opacity: headerOpacity,
          transform: [{ translateY: headerOpacity.interpolate({
            inputRange: [0, 1],
            outputRange: [-20, 0]
          }) }]
        }]}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={{ paddingHorizontal: 16, alignItems: 'center' }}
          >
            <MaterialIcons name="sort" size={18} color={Colors.text.muted} style={{ marginRight: 8 }} />
            {sortOptions.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.sortButton, sortOption === opt.key && styles.activeSort]}
                onPress={() => {
                  setSortOption(opt.key);
                  Vibration.vibrate(10);
                }}
              >
                <Text style={[styles.sortText, sortOption === opt.key && styles.activeSortText]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>

        {/* Animated Banner */}
        <Animated.View
          style={[
            styles.bannerContainer,
            {
              transform: [
                { translateY: bannerTranslateY },
                { scale: bannerScale },
              ],
              opacity: bannerOpacity,
              top: 110, // Position below header (60) and sort bar (50)
            },
          ]}
        >
          <Image
            source={{ uri: bannerImage }}
            style={styles.bannerImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={["rgba(0,0,0,0.6)", "transparent"]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        {/* Product Grid */}
        {loading && products.length === 0 ? (
           <View style={{ paddingTop: BANNER_HEIGHT + 80, paddingHorizontal: 8 }}>
             <ProductGridSkeleton />
           </View>
        ) : (
        <Animated.FlatList
          data={sortedProducts}
          renderItem={renderItem}
          numColumns={3}
          keyExtractor={keyExtractor}
          contentContainerStyle={{
            paddingTop: BANNER_HEIGHT + 110, // header (60) + sort bar (50) + banner (170)
            paddingBottom: 20,
            paddingHorizontal: 8,
          }}
          columnWrapperStyle={styles.columnWrapper}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews={true}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          ListFooterComponent={
            loading ? (
              <View style={styles.loadingFooter}>
                <ActivityIndicator size="small" color={Colors.primary} />
              </View>
            ) : !hasMore && products.length > 0 ? (
              <View style={styles.endReached}>
                <MaterialIcons name="done-all" size={24} color={Colors.primary} />
                <Text style={styles.endReachedText}>All {getTitle().toLowerCase()} loaded</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyContainer}>
                <MaterialIcons name="tag" size={48} color="#ccc" />
                <Text style={styles.emptyTitle}>No {getTitle()} Found</Text>
                <Text style={styles.emptySubtitle}>
                  Check back later for new arrivals and best sellers
                </Text>
                <TouchableOpacity
                  style={styles.refreshButton}
                  onPress={handleRefresh}
                  accessibilityLabel="Refresh products"
                  accessibilityRole="button"
                >
                  <MaterialIcons name="refresh" size={20} color="#fff" />
                  <Text style={styles.refreshText}>Refresh</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.default,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
    zIndex: 30,
  },
  backButtonInner: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  headerTitleInner: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.white,
    marginLeft: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  backButton: {
    display: 'none', // replaced by backButtonInner
  },
  bannerContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    height: BANNER_HEIGHT,
    overflow: "hidden",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    backgroundColor: "#f0f0f0",
    elevation: 5,
    shadowColor: Colors.black,
    shadowOpacity: 0.1,
    shadowRadius: 10,
    zIndex: 10,
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.text.primary,
    marginBottom: 12,
  },
  sortContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    height: 50,
    backgroundColor: Colors.white,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 25,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  sortButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f8fafc",
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  activeSort: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  sortText: {
    fontSize: 13,
    fontWeight: "700",
    color: '#64748b',
  },
  activeSortText: {
    color: '#3b82f6',
  },
  listContent: {
    paddingHorizontal: ITEM_SPACING,
    paddingTop: 16,
    paddingBottom: 24,
  },
  columnWrapper: {
    justifyContent: "space-between",
  },
  itemContainer: {
    width: ITEM_WIDTH,
    marginBottom: 20,
    // borderRadius: 8,
    // backgroundColor: "#fff",
    // shadowColor: "#000",
    // shadowOffset: { width: 0, height: 2 },
    // shadowOpacity: 0.1,
    // shadowRadius: 4,
    // elevation: 2,
    alignItems: "center",
    alignContent: "center",
  },
  loadingFooter: {
    padding: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  loadingText: {
    marginLeft: 8,
    color: Colors.text.muted,
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.text.primary,
    marginTop: 16,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.text.muted,
    textAlign: "center",
    marginBottom: 20,
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
  },
  refreshText: {
    color: Colors.white,
    fontWeight: "600",
    marginLeft: 6,
  },
  endReached: {
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  endReachedText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  floatingButton: {
    position: "absolute",
    bottom: 24,
    right: 24,
    zIndex: 100,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  filterText: {
    color: Colors.white,
    fontWeight: "600",
    marginLeft: 6,
    fontSize: 14,
  },
});

export default React.memo(AllDiscountedProductsScreen);

