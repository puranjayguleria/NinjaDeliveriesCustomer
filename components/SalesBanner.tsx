import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Dimensions,
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import { useNavigation } from "@react-navigation/native";
import { QuickTile } from "./QuickTile"; // Adjust import path as needed
import Loader from "./VideoLoader";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const ITEM_WIDTH = 120;
const ITEM_HEIGHT = 210;
const PAGE_SIZE = 10;

interface Product {
  id: string;
  name: string;
  price: number;
  discount: number;
  image: string;
  // Include all other product fields you need
}

const SalesBanner: React.FC<{ storeId: string }> = ({ storeId }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const navigation = useNavigation();
  const isPan = false; // or fetch from user state, e.g. user?.isPan || false

  const [acceptedPan, setAcceptedPan] = useState(false);
  const [catAlert, setCatAlert] = useState(true);
  const [showGate, setShowGate] = useState(false);
  const onAcceptRef = useRef<() => void>(() => {});

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

  const fetchDiscountedProducts = useCallback(
    async (loadMore = false) => {
      if (loading || (!loadMore && products.length > 0)) return;

      setLoading(true);

      try {
        let query = firestore()
          .collection("saleProducts")
          .where("storeId", "==", storeId)
          .where("discount", ">", 0)
          .orderBy("discount", "desc")
          .limit(PAGE_SIZE);

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
        })) as Product[];

        setProducts((prev) =>
          loadMore ? [...prev, ...newProducts] : newProducts
        );
        setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
        setHasMore(snapshot.docs.length === PAGE_SIZE);
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoading(false);
      }
    },
    [storeId, lastVisible, products.length, loading]
  );

  useEffect(() => {
    fetchDiscountedProducts();
  }, [fetchDiscountedProducts]);

  const handleEndReached = () => {
    if (hasMore && !loading) {
      fetchDiscountedProducts(true);
    }
  };

  const navigateToAllDiscounted = () => {
    navigation.navigate("AllDiscountedProducts", { storeId });
  };

  const renderItem = ({ item }: { item: Product }) => {
    return <QuickTile p={item} isPan={isPan} guard={maybeGate} />;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Special Discounts</Text>
        <Pressable onPress={navigateToAllDiscounted}>
          <Text style={styles.seeAll}>See All</Text>
        </Pressable>
      </View>

      {products.length === 0 && !loading ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No discounted products available</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          renderItem={renderItem}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loading ? <View style={styles.loadingFooter}></View> : null
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  seeAll: {
    color: "#009688",
    fontWeight: "600",
  },
  listContent: {
    paddingRight: 8,
  },
  emptyContainer: {
    height: ITEM_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
  },
  emptyText: {
    color: "#666",
  },
  loadingFooter: {
    width: ITEM_WIDTH,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default React.memo(SalesBanner);
