import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Dimensions,
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import { useNavigation } from "@react-navigation/native";
import { QuickTile } from "./QuickTile";
import Loader from "./VideoLoader";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const ITEM_WIDTH = 100;
const ITEM_HEIGHT = 170;
const PAGE_SIZE = 10;

interface Product {
  id: string;
  name: string;
  price: number;
  discount: number;
  image: string;
  // add other fields you use in QuickTile
}

type ConfigDoc = {
  storeId: string;
  // optional "key" if you later segment configs, e.g., "home"
  key?: string;
  homeDiscountTitle?: string;
  homeDiscountSeeAll?: string;
};

const SalesBanner: React.FC<{ storeId: string }> = ({ storeId }) => {
  // --- UI strings from config ---
  const [cfgLoading, setCfgLoading] = useState(true);
  const [homeDiscountTitle, setHomeDiscountTitle] = useState<string | undefined>(undefined);
  const [homeDiscountSeeAll, setHomeDiscountSeeAll] = useState<string | undefined>(undefined);

  // Listen to /config where storeId == current store
  useEffect(() => {
    if (!storeId) {
      setCfgLoading(false);
      setHomeDiscountTitle(undefined);
      setHomeDiscountSeeAll(undefined);
      return;
    }
    setCfgLoading(true);

    // If you later add a "key" field, you can chain .where("key","==","home")
    const q = firestore().collection("config").where("storeId", "==", storeId).limit(1);
    const unsub = q.onSnapshot(
      (snap) => {
        const doc = snap.docs[0]?.data() as ConfigDoc | undefined;
        setHomeDiscountTitle(doc?.homeDiscountTitle);
        setHomeDiscountSeeAll(doc?.homeDiscountSeeAll);
        setCfgLoading(false);
      },
      () => {
        setHomeDiscountTitle(undefined);
        setHomeDiscountSeeAll(undefined);
        setCfgLoading(false);
      }
    );

    return unsub;
  }, [storeId]);

  // --- products (discounted) ---
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);

  const navigation = useNavigation();
  const isPan = false;

  const [acceptedPan, setAcceptedPan] = useState(false);
  const [catAlert, setCatAlert] = useState(true);
  const [showGate, setShowGate] = useState(false);
  const onAcceptRef = useRef<() => void>(() => {});

  const maybeGate = useCallback(
    (cb: () => void, isPanFlag: boolean) => {
      if (!isPanFlag || acceptedPan || !catAlert) {
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
      if (!storeId || loading || (!loadMore && products.length > 0)) return;

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
          if (loadMore) setHasMore(false);
          return;
        }

        const newProducts = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Product),
        }));

        setProducts((prev) => (loadMore ? [...prev, ...newProducts] : newProducts));
        setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
        setHasMore(snapshot.docs.length === PAGE_SIZE);
      } catch (error) {
        console.error("Error fetching discounted products:", error);
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
    // @ts-ignore – adjust your navigator types if needed
    navigation.navigate("AllDiscountedProducts", { storeId });
  };

  const renderItem = ({ item }: { item: Product }) => (
    <QuickTile p={item as any} isPan={isPan} guard={maybeGate} ribbonColor="#C2185B" />
  );

  const titleText = homeDiscountTitle?.trim() || "Discounted Products";
  const seeAllText = homeDiscountSeeAll?.trim() || "See All";

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{titleText}</Text>
        <Pressable onPress={navigateToAllDiscounted}>
          <Text style={styles.seeAll}>{seeAllText}</Text>
        </Pressable>
      </View>

      {/* You could show a tiny shimmer or loader when cfgLoading, but it's optional */}
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
            loading ? (
              <View style={styles.loadingFooter}>
                <Loader />
              </View>
            ) : null
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
    color: "#C2185B",
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
