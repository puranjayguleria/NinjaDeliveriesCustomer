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
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PAGE_SIZE = 15; // Load 15 items at a time
const ITEM_SPACING = 8;
const BANNER_HEIGHT = 170;
const FIRST_ROW_HEIGHT = 200;
const ITEM_WIDTH = (SCREEN_WIDTH - ITEM_SPACING * 4) / 3; // 3 items with equal padding

const AllDiscountedProductsScreen: React.FC<{ route: any }> = ({ route }) => {
  const { storeId } = route.params;
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [scrollY] = useState(new Animated.Value(0));
  const [sortOption, setSortOption] = useState("discount");

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
  const bannerImage =
    "data:image/jpeg;base64,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";

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
