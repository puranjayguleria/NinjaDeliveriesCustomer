import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import { RouteProp, useRoute } from "@react-navigation/native";
import { Image } from "expo-image";
import { QuickTile } from "@/components/QuickTile";

const PLACEHOLDER_BLURHASH = "LKO2?U%2Tw=w]~RBVZRi};ofM{ay";

type MenuRouteParams = {
  RestaurantMenu: {
    restaurantId: string;
    restaurantName: string;
    heroImageUrl?: string | null;
    offerText?: string | null;
  };
};

type Product = {
  id: string;
  name: string;
  imageUrl?: string;
  price?: number;
  discount?: number;
  isAvailable?: boolean;
  description?: string;
  [key: string]: any;
};

const RestaurantMenuScreen: React.FC = () => {
  const route = useRoute<RouteProp<MenuRouteParams, "RestaurantMenu">>();
  const { restaurantId, restaurantName, heroImageUrl, offerText } = route.params;

  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMenu = useCallback(() => {
    setLoading(true);

    let q = firestore()
      .collection("products")
      .where("restaurantId", "==", restaurantId)
      .where("isActive", "==", true); // adjust fields based on schema

    const unsub = q.onSnapshot(
      (snap) => {
        const list: Product[] = snap.docs.map((doc) => {
          const data = doc.data() as any;
          return {
            id: doc.id,
            name: data.name,
            imageUrl: data.imageUrl ?? data.imageURL ?? data.thumbnail,
            price: data.price,
            discount: data.discount,
            isAvailable: data.quantity ? data.quantity > 0 : data.isAvailable,
            description: data.description,
            ...data,
          };
        });
        setItems(list);
        setLoading(false);
      },
      (err) => {
        console.warn("[menu products] error", err);
        setItems([]);
        setLoading(false);
      }
    );

    return unsub;
  }, [restaurantId]);

  useEffect(() => {
    const unsub = fetchMenu();
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [fetchMenu]);

  const guard = (cb: () => void) => cb(); // no special gating for food

  const renderHeader = () => {
    const img =
      heroImageUrl ||
      "https://via.placeholder.com/600x300.png?text=Restaurant";

    return (
      <View>
        <View style={styles.heroWrapper}>
          <Image
            source={{ uri: img }}
            style={styles.heroImage}
            placeholder={{ blurhash: PLACEHOLDER_BLURHASH }}
            contentFit="cover"
          />
        </View>
        <View style={styles.heroInfo}>
          <Text style={styles.restName}>{restaurantName}</Text>
          {offerText ? (
            <Text style={styles.offerInfo}>{offerText}</Text>
          ) : (
            <Text style={styles.offerInfo}>
              Same as restaurant prices • Powered by Ninja
            </Text>
          )}
        </View>
      </View>
    );
  };

  if (loading && !items.length) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#00b4a0" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.tileWrapper}>
            <QuickTile p={item} isPan={false} guard={guard} />
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <ScrollView contentContainerStyle={styles.emptyWrap}>
              {renderHeader()}
              <Text style={styles.emptyTxt}>
                This restaurant has not added any items yet.
              </Text>
            </ScrollView>
          ) : null
        }
      />
    </View>
  );
};

export default RestaurantMenuScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fdfdfd",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  heroWrapper: {
    width: "100%",
    height: 180,
    backgroundColor: "#eee",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroInfo: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e0",
    backgroundColor: "#fff",
  },
  restName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#222",
    marginBottom: 4,
  },
  offerInfo: {
    fontSize: 12,
    color: "#666",
  },
  listContent: {
    paddingHorizontal: 10,
    paddingBottom: 20,
  },
  tileWrapper: {
    marginTop: 8,
    marginBottom: 4,
  },
  emptyWrap: {
    paddingBottom: 40,
    alignItems: "center",
  },
  emptyTxt: {
    marginTop: 20,
    fontSize: 14,
    color: "#777",
    textAlign: "center",
    paddingHorizontal: 24,
  },
});
