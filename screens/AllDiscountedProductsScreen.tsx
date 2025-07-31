import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Image,
  Dimensions,
  RefreshControl,
  TouchableOpacity,
  Animated,
  SafeAreaViewBase,
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import { QuickTile } from "@/components/QuickTile";
import Loader from "@/components/VideoLoader";
import { useLocationContext } from "@/context/LocationContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PAGE_SIZE = 15; // Load 15 items at a time
const ITEM_SPACING = 8;
const BANNER_HEIGHT = 170;
const FIRST_ROW_HEIGHT = 200;
const ITEM_WIDTH = (SCREEN_WIDTH - ITEM_SPACING * 4) / 3; // 3 items with equal padding

const AllDiscountedProductsScreen: React.FC<{ route: any }> = ({ route }) => {
  const { storeId } = route.params;
  const { location, updateLocation } = useLocationContext();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [scrollY] = useState(new Animated.Value(0));
  const [sortOption, setSortOption] = useState("discount");
  const [bannerImage, setBannerImage] = useState<string | null>(null);
  const [acceptedPan, setAcceptedPan] = useState(false);
  const [catAlert, setCatAlert] = useState(true);
  const onAcceptRef = useRef<() => void>(() => {});
  const [showGate, setShowGate] = useState(false);
  // Banner animation
  const bannerTranslateY = scrollY.interpolate({
    inputRange: [0, FIRST_ROW_HEIGHT, FIRST_ROW_HEIGHT + BANNER_HEIGHT],
    outputRange: [0, 0, -BANNER_HEIGHT], // fixed for first row, moves after
    extrapolate: "clamp",
  });

  // Fade out banner when sliding up
  const bannerOpacity = scrollY.interpolate({
    inputRange: [0, FIRST_ROW_HEIGHT, FIRST_ROW_HEIGHT + BANNER_HEIGHT],
    outputRange: [1, 1, 0],
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
          setBannerImage(data.salesBanner || null); // 🔹 Fetch salesBanner field
        }
      } catch (error) {
        console.error("Error fetching banner image:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchBanner();
  }, [location?.storeId]);

  const fetchProducts = useCallback(
    async (loadMore = false) => {
      if (loading || (!loadMore && products.length > 0)) return;

      setLoading(true);

      try {
        let query = firestore()
          .collection("saleProducts")
          .where("storeId", "==", storeId)
          .where("discount", ">", 0);

        // Add sorting
        if (sortOption === "discount") {
          query = query.orderBy("discount", "desc");
        } else if (sortOption === "price-low") {
          query = query.orderBy("price", "asc");
        } else if (sortOption === "price-high") {
          query = query.orderBy("price", "desc");
        }

        query = query.limit(PAGE_SIZE);

        if (loadMore && lastVisible) {
          query = query.startAfter(lastVisible);
        }

        const snapshot = await query.get();

        if (snapshot.empty) {
          if (loadMore) {
            setHasMore(false);
          }
          return;
        }

        const newProducts = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setProducts((prev) =>
          loadMore ? [...prev, ...newProducts] : newProducts
        );
        setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
        setHasMore(snapshot.docs.length === PAGE_SIZE);
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [storeId, lastVisible, loading, products.length, sortOption]
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
  }, [fetchProducts, sortOption]);

  const handleEndReached = useCallback(() => {
    if (hasMore && !loading && !refreshing) {
      fetchProducts(true);
    }
  }, [fetchProducts, hasMore, loading, refreshing]);

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const isPan = item.categoryId === "panCorner"; // or use item.requiresPan if available

    return (
      <Animated.View
        style={[
          styles.itemContainer,
          {
            opacity: scrollY.interpolate({
              inputRange: [0, 100, 200],
              outputRange: [1, 1, 0.9],
              extrapolate: "clamp",
            }),
            transform: [
              {
                scale: scrollY.interpolate({
                  inputRange: [-100, 0, 100, 200],
                  outputRange: [1.05, 1, 0.98, 0.95],
                  extrapolate: "clamp",
                }),
              },
            ],
          },
        ]}
      >
        <QuickTile
          p={item}
          isPan={isPan}
          guard={maybeGate}
          style={{
            width: ITEM_WIDTH,
            height: ITEM_WIDTH * 1.4,
            marginBottom: ITEM_SPACING,
          }}
        />
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={{ flex: 1 }}>
        {/* Animated Banner */}
        <Animated.View
          style={[
            styles.bannerContainer,
            {
              transform: [{ translateY: bannerTranslateY }],
              opacity: bannerOpacity,
            },
          ]}
        >
          <Image
            source={{ uri: bannerImage }}
            style={styles.bannerImage}
            resizeMode="cover"
          />
        </Animated.View>

        {/* Product Grid */}
        <Animated.FlatList
          data={products}
          renderItem={renderItem}
          numColumns={3}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingTop: BANNER_HEIGHT, // products start below banner
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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#009688"
              colors={["#009688"]}
            />
          }
          ListFooterComponent={
            loading ? (
              <View style={styles.loadingFooter}>
                <Loader />
              </View>
            ) : !hasMore ? (
              <View style={styles.endReached}>
                <MaterialIcons name="done-all" size={24} color="#009688" />
                <Text style={styles.endReachedText}>All deals loaded</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyContainer}>
                <MaterialIcons name="tag" size={48} color="#ccc" />
                <Text style={styles.emptyTitle}>No Discounts Available</Text>
                <Text style={styles.emptySubtitle}>
                  Check back later for special offers
                </Text>
                <TouchableOpacity
                  style={styles.refreshButton}
                  onPress={handleRefresh}
                >
                  <MaterialIcons name="refresh" size={20} color="#fff" />
                  <Text style={styles.refreshText}>Refresh</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.08)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    zIndex: 10,
  },
  bannerContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: BANNER_HEIGHT,
    overflow: "hidden",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    backgroundColor: "#f0f0f0",
    elevation: 5,
    shadowColor: "#000",
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
    color: "#333",
    marginBottom: 12,
  },
  sortContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  sortButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#f0f0f0",
  },
  activeSort: {
    backgroundColor: "#009688",
  },
  sortText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
  },
  activeSortText: {
    color: "#fff",
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
    marginBottom: ITEM_SPACING,
    borderRadius: 8,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  loadingFooter: {
    padding: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  loadingText: {
    marginLeft: 8,
    color: "#666",
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
    color: "#333",
    marginTop: 16,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#009688",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
  },
  refreshText: {
    color: "#fff",
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
    color: "#009688",
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
    backgroundColor: "#009688",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  filterText: {
    color: "#fff",
    fontWeight: "600",
    marginLeft: 6,
    fontSize: 14,
  },
});

export default React.memo(AllDiscountedProductsScreen);
