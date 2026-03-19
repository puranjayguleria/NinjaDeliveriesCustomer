import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Dimensions,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import {
  SafeAreaView,
} from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { QuickTile } from "@/components/QuickTile";
import { ProductGridSkeleton } from "@/components/Skeleton";
import { useLocationContext } from "@/context/LocationContext";
import { Colors } from "@/constants/colors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const ITEM_SPACING = 8;
const ITEM_WIDTH = (SCREEN_WIDTH - ITEM_SPACING * 4) / 3;

const BuyAgainScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { location } = useLocationContext();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [extraProductsById, setExtraProductsById] = useState<Record<string, any>>({});

  const fetchBuyAgainProducts = useCallback(async () => {
    const currentUser = auth().currentUser;
    if (!currentUser || !location.storeId) {
      setProducts([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      // Fetch ALL orders for this user - no storeId or status filters initially
      // We'll also try multiple potential field names for the user ID just in case
      const [snap1, snap2] = await Promise.all([
        firestore()
          .collection("orders")
          .where("orderedBy", "==", currentUser.uid)
          .get(),
        firestore()
          .collection("orders")
          .where("userId", "==", currentUser.uid)
          .get()
      ]);

      const allDocs = [...snap1.docs, ...snap2.docs];
      
      if (allDocs.length === 0) {
        setProducts([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Collect unique product IDs and Names from ALL orders
      const allProductIds = new Set<string>();
      const allProductNames = new Set<string>();
      
      allDocs.forEach((doc) => {
        const orderData = doc.data();
        const items: any[] = orderData.items || [];
        
        items.forEach((it: any) => {
          // Be extremely aggressive in finding product identifiers
          const id = it.productId || it.productID || it.pId || it.product?.id || it.id;
          const name = it.name || it.productName || it.title || it.product?.name;
          
          if (id) allProductIds.add(String(id));
          if (name) allProductNames.add(String(name).trim());
        });
      });

      const productIds = Array.from(allProductIds);
      const productNames = Array.from(allProductNames);

      if (productIds.length === 0 && productNames.length === 0) {
        setProducts([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Fetch product details for the current store
      // 1. Fetch by Document ID
      const idChunks: string[][] = [];
      for (let i = 0; i < productIds.length; i += 10) {
        idChunks.push(productIds.slice(i, i + 10));
      }

      const fetchedById: Record<string, any> = {};
      for (const chunk of idChunks) {
        const prodSnap = await firestore()
          .collection("products")
          .where("storeId", "==", location.storeId)
          .where(firestore.FieldPath.documentId(), "in", chunk)
          .get();
        
        prodSnap.docs.forEach(doc => {
          fetchedById[doc.id] = { id: doc.id, ...doc.data() };
        });
      }

      // 2. Fetch by Name (to catch products ordered from other stores/IDs)
      const foundNames = new Set(Object.values(fetchedById).map(p => String(p.name).trim()));
      const remainingNames = productNames.filter(name => !foundNames.has(name));

      const nameChunks: string[][] = [];
      for (let i = 0; i < remainingNames.length; i += 10) {
        nameChunks.push(remainingNames.slice(i, i + 10));
      }

      const fetchedByName: Record<string, any> = {};
      for (const chunk of nameChunks) {
        const prodSnap = await firestore()
          .collection("products")
          .where("storeId", "==", location.storeId)
          .where("name", "in", chunk)
          .get();
        
        prodSnap.docs.forEach(doc => {
          fetchedByName[doc.id] = { id: doc.id, ...doc.data() };
        });
      }

      // Combine both results and remove any potential duplicates
      const finalProductsMap = new Map();
      [...Object.values(fetchedById), ...Object.values(fetchedByName)].forEach(p => {
        finalProductsMap.set(p.id, p);
      });

      setProducts(Array.from(finalProductsMap.values()));
    } catch (error) {
      console.error("Error fetching buy again products:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [location.storeId]);

  useEffect(() => {
    fetchBuyAgainProducts();
  }, [fetchBuyAgainProducts]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchBuyAgainProducts();
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.itemContainer}>
      <QuickTile
        p={item}
        isPan={item.categoryId === "panCorner"}
        onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
      />
    </View>
  );

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate("HomeTab");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
        >
          <MaterialIcons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Buy Again</Text>
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: 8, paddingTop: 16 }}>
          <ProductGridSkeleton />
        </View>
      ) : (
        <FlatList
          data={products}
          renderItem={renderItem}
          numColumns={3}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.columnWrapper}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="history" size={64} color="#ccc" />
              <Text style={styles.emptyTitle}>No Recent Orders Found</Text>
              <Text style={styles.emptySubtitle}>
                Items you've ordered before will appear here for quick reordering.
              </Text>
              <TouchableOpacity
                style={styles.shopNowButton}
                onPress={() => navigation.navigate("HomeTab")}
              >
                <Text style={styles.shopNowText}>Start Shopping</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.default,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.text.primary,
  },
  listContent: {
    paddingHorizontal: ITEM_SPACING,
    paddingTop: 16,
    paddingBottom: 24,
  },
  columnWrapper: {
    justifyContent: "flex-start",
  },
  itemContainer: {
    width: ITEM_WIDTH,
    marginBottom: 20,
    marginHorizontal: ITEM_SPACING / 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.text.muted,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  shopNowButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  shopNowText: {
    color: Colors.white,
    fontWeight: "700",
    fontSize: 16,
  },
});

export default BuyAgainScreen;
