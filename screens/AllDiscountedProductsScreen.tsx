import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Dimensions,
  RefreshControl,
  TouchableOpacity,
  Animated,
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import { QuickTile } from "@/components/QuickTile";
import Loader from "@/components/VideoLoader";
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PAGE_SIZE = 15; // Load 15 items at a time
const ITEM_SPACING = 8;
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
    <View style={styles.container}>
      <Animated.View style={[styles.header, { opacity: headerOpacity }]}>
        <Text style={styles.headerTitle}>Special Discounts for you </Text>
      </Animated.View>

      <Animated.FlatList
        data={products}
        renderItem={renderItem}
        numColumns={3}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
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

      {/* Floating Filter Button */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 25,
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
