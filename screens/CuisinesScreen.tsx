import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import firestore from "@react-native-firebase/firestore";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocationContext } from "@/context/LocationContext";

type CuisineCategory = {
  id: string;
  name: string;
  iconEmoji?: string;
  priority?: number;
};

const CuisinesScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { location } = useLocationContext();
  const [cuisines, setCuisines] = useState<CuisineCategory[]>([]);
  const [loading, setLoading] = useState(true);

 useEffect(() => {
  setLoading(true);

  // inside CuisinesScreen useEffect
const unsub = firestore()
  .collection("cuisines")
  .orderBy("priority", "asc")
  .onSnapshot((snap) => {
    const list: CuisineCategory[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
    }));
    setCuisines(list);
    setLoading(false);
  });


  return () => unsub();
}, []);


  const renderItem = ({ item }: { item: CuisineCategory }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        navigation.navigate("RestaurantCategoryListing", {
          categoryId: item.id,
          categoryName: item.name,
        })
      }
    >
      <View style={styles.iconCircle}>
        <Text style={styles.iconText}>{item.iconEmoji || "🍽️"}</Text>
      </View>
      <Text style={styles.cardTitle} numberOfLines={1}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <MaterialIcons name="arrow-back" size={22} color="#222" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cuisines</Text>
      </View>

      {loading && !cuisines.length ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#00b4a0" />
        </View>
      ) : (
        <FlatList
          data={cuisines}
          keyExtractor={(item) => item.id}
          numColumns={3}
          contentContainerStyle={{ padding: 16 }}
          columnWrapperStyle={{
            justifyContent: "space-between",
            marginBottom: 14,
          }}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No cuisines yet</Text>
              <Text style={styles.emptySubtitle}>
                Once partners go live, you’ll see cuisines here.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

export default CuisinesScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fdfdfd" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    backgroundColor: "#fff",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  backBtn: {
    marginRight: 8,
    padding: 4,
    borderRadius: 999,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#222",
  },
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: "31%",
    backgroundColor: "#fff",
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#e0f7f5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  iconText: { fontSize: 22 },
  cardTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
    textAlign: "center",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#777",
    textAlign: "center",
  },
});
