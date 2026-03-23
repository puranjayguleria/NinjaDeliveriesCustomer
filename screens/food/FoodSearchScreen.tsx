import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TextInput, FlatList,
  TouchableOpacity, ActivityIndicator, StatusBar,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  listenActiveRestaurants,
  listenFoodCategoriesWithItems,
  type Restaurant,
  type FoodCategory,
} from "@/firebase/foodFirebase";
import DishModal from "@/components/food/DishModal";

const ORANGE = "#FC8019";
const DARK   = "#282C3F";
const GRAY   = "#93959F";

// Animated result row
function ResultRow({ item, index, onPress }: {
  item: { type: "category" | "restaurant"; data: any };
  index: number;
  onPress: () => void;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 280,
      delay: index * 60,
      useNativeDriver: true,
    }).start();
  }, []);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });

  const isCategory = item.type === "category";
  const cat = item.data as FoodCategory;
  const rest = item.data as Restaurant;

  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateY }] }}>
      <TouchableOpacity style={s.resultRow} onPress={onPress} activeOpacity={0.8}>
        <View style={s.resultIconWrap}>
          {isCategory ? (
            cat.image ? (
              <Image source={{ uri: cat.image }} style={s.resultIcon} contentFit="cover" />
            ) : (
              <View style={[s.resultIcon, s.resultIconPlaceholder]}>
                <Ionicons name="restaurant-outline" size={20} color={ORANGE} />
              </View>
            )
          ) : (
            (rest.profileImage || rest.image) ? (
              <Image source={{ uri: rest.profileImage || rest.image }} style={s.resultIcon} contentFit="cover" />
            ) : (
              <View style={[s.resultIcon, s.resultIconPlaceholder]}>
                <Ionicons name="restaurant" size={20} color={ORANGE} />
              </View>
            )
          )}
        </View>
        <View style={s.resultInfo}>
          <Text style={s.resultName}>{isCategory ? cat.name : rest.restaurantName}</Text>
          <Text style={s.resultSub}>{isCategory ? "Dish / Category" : "Restaurant · 30-40 min"}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={GRAY} />
      </TouchableOpacity>
    </Animated.View>
  );
}

// Animated category card
function CatCard({ item, index, onPress }: { item: FoodCategory; index: number; onPress: () => void }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 300,
      delay: index * 50,
      useNativeDriver: true,
    }).start();
  }, []);

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] });

  return (
    <Animated.View style={{ opacity: anim, transform: [{ scale }], flex: 1 }}>
      <TouchableOpacity style={s.catCard} onPress={onPress} activeOpacity={0.8}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={s.catImg} contentFit="cover" />
        ) : (
          <View style={[s.catImg, s.catImgPlaceholder]}>
            <Ionicons name="restaurant-outline" size={28} color={ORANGE} />
          </View>
        )}
        <Text style={s.catName} numberOfLines={2}>{item.name}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function FoodSearchScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [categories, setCategories] = useState<FoodCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [dishModal, setDishModal] = useState<{
    visible: boolean; restaurantId: string; restaurantName: string; filterCategoryId?: string | null;
  }>({ visible: false, restaurantId: "", restaurantName: "" });

  useEffect(() => {
    const u1 = listenActiveRestaurants(
      (d) => { setRestaurants(d); setLoading(false); },
      () => setLoading(false)
    );
    const u2 = listenFoodCategoriesWithItems(setCategories);
    return () => { u1(); u2(); };
  }, []);

  const filteredRestaurants = query.length > 1
    ? restaurants.filter(r => r.restaurantName?.toLowerCase().includes(query.toLowerCase()))
    : [];

  const filteredCategories = query.length > 1
    ? categories.filter(c => c.name?.toLowerCase().includes(query.toLowerCase()))
    : [];

  const results = [
    ...filteredCategories.map(c => ({ type: "category" as const, data: c })),
    ...filteredRestaurants.map(r => ({ type: "restaurant" as const, data: r })),
  ];

  const openCategory = (cat: FoodCategory) => {
    const restId = cat.companyIds?.[0] ?? "";
    const rest = restaurants.find(r => r.id === restId);
    if (!rest) return;
    setDishModal({ visible: true, restaurantId: rest.id, restaurantName: rest.restaurantName, filterCategoryId: cat.id });
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={DARK} />
        </TouchableOpacity>
        <View style={s.searchBox}>
          <Ionicons name="search" size={17} color={ORANGE} style={{ marginRight: 8 }} />
          <TextInput
            style={s.searchInput}
            placeholder="Search restaurants, dishes..."
            placeholderTextColor={GRAY}
            value={query}
            onChangeText={setQuery}
            autoFocus
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")}>
              <Ionicons name="close-circle" size={18} color={GRAY} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={s.loader}><ActivityIndicator color={ORANGE} size="large" /></View>
      ) : query.length < 2 ? (
        <FlatList
          key="categories"
          data={categories}
          keyExtractor={i => i.id}
          numColumns={2}
          contentContainerStyle={s.catGrid}
          ListHeaderComponent={<Text style={s.sectionTitle}>Popular Categories</Text>}
          renderItem={({ item, index }) => (
            <CatCard item={item} index={index} onPress={() => openCategory(item)} />
          )}
        />
      ) : results.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="search-outline" size={52} color="#e2e8f0" />
          <Text style={s.emptyText}>No results for "{query}"</Text>
        </View>
      ) : (
        <FlatList
          key={query}
          data={results}
          keyExtractor={(item, i) => `${item.type}-${i}`}
          contentContainerStyle={{ paddingBottom: 80 }}
          renderItem={({ item, index }) => (
            <ResultRow
              item={item}
              index={index}
              onPress={() => {
                if (item.type === "category") {
                  openCategory(item.data as FoodCategory);
                } else {
                  const rest = item.data as Restaurant;
                  setDishModal({ visible: true, restaurantId: rest.id, restaurantName: rest.restaurantName });
                }
              }}
            />
          )}
        />
      )}

      <DishModal
        visible={dishModal.visible}
        onClose={() => setDishModal(p => ({ ...p, visible: false }))}
        restaurantId={dishModal.restaurantId}
        restaurantName={dishModal.restaurantName}
        filterCategoryId={dishModal.filterCategoryId}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: "#fff" },
  loader:     { flex: 1, justifyContent: "center", alignItems: "center" },

  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "#f1f5f9", gap: 10,
  },
  backBtn:   { padding: 4 },
  searchBox: {
    flex: 1, flexDirection: "row", alignItems: "center",
    backgroundColor: "#f8fafc", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: "#e2e8f0",
  },
  searchInput: { flex: 1, fontSize: 14, color: DARK, padding: 0 },

  sectionTitle: { fontSize: 16, fontWeight: "700", color: DARK, marginBottom: 12, paddingHorizontal: 16, paddingTop: 16 },
  catGrid:      { paddingBottom: 80, paddingHorizontal: 8 },
  catCard: {
    margin: 6, backgroundColor: "#fff5f0", borderRadius: 12, padding: 14,
    alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  catImg:            { width: 64, height: 64, borderRadius: 32, marginBottom: 8 },
  catImgPlaceholder: { backgroundColor: "#fff", justifyContent: "center", alignItems: "center" },
  catName:           { fontSize: 12, fontWeight: "600", color: DARK, textAlign: "center" },

  resultRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "#f8fafc",
  },
  resultIconWrap:        { marginRight: 12 },
  resultIcon:            { width: 48, height: 48, borderRadius: 8 },
  resultIconPlaceholder: { backgroundColor: "#fff5f0", justifyContent: "center", alignItems: "center" },
  resultInfo:            { flex: 1 },
  resultName:            { fontSize: 14, fontWeight: "600", color: DARK },
  resultSub:             { fontSize: 12, color: GRAY, marginTop: 2 },

  empty:     { alignItems: "center", paddingTop: 60 },
  emptyText: { fontSize: 14, color: GRAY, marginTop: 12 },
});