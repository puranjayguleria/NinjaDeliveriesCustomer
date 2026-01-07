import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import firestore from "@react-native-firebase/firestore";
import { useLocationContext } from "@/context/LocationContext";
import RestaurantTile, { Restaurant } from "@/components/RestaurantTile";
import { getEffectiveCityId } from "@/utils/locationHelper";

const RestaurantSearchScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { location } = useLocationContext();

  const [allRestaurants, setAllRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const effectiveCityId = getEffectiveCityId(location);
    
    setLoading(true);

    const unsub = firestore()
      .collection("restaurants")
      .where("isActive", "==", true)
      .where("cityId", "==", effectiveCityId)
      .onSnapshot(
        (snap) => {
          const list: Restaurant[] = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          }));
          setAllRestaurants(list);
          setLoading(false);
        },
        () => setLoading(false)
      );

    return unsub;
  }, [location.cityId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allRestaurants;

    return allRestaurants.filter((r) => {
      const name = r.name?.toLowerCase() ?? "";
      const cuisines = (r.cuisines || []).join(" ").toLowerCase();
      return name.includes(q) || cuisines.includes(q);
    });
  }, [allRestaurants, query]);

  const renderHeader = () => (
    <View style={styles.searchRow}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.backBtn}
      >
        <MaterialIcons name="arrow-back" size={22} color="#222" />
      </TouchableOpacity>
      <View style={styles.inputWrapper}>
        <MaterialIcons
          name="search"
          size={18}
          color="#777"
          style={{ marginRight: 4 }}
        />
        <TextInput
          style={styles.input}
          placeholder="Search for dishes or restaurants"
          placeholderTextColor="#999"
          value={query}
          onChangeText={setQuery}
          autoFocus
          returnKeyType="search"
        />
      </View>
    </View>
  );

  if (loading && !allRestaurants.length) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <ActivityIndicator
          size="large"
          color="#00b4a0"
          style={{ marginTop: 24 }}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderHeader()}

      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No matches found</Text>
          <Text style={styles.emptySubtitle}>
            Try a different name, cuisine, or dish.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 24,
            paddingTop: 10,
          }}
          ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
          renderItem={({ item }) => (
            <RestaurantTile
              restaurant={item}
              onPress={() =>
                navigation.navigate("RestaurantDetails", {
                  restaurantId: item.id,
                })
              }
            />
          )}
        />
      )}
    </View>
  );
};

export default RestaurantSearchScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fdfdfd" },
  searchRow: {
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
  inputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: "#222",
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
