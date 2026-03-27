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
  listenAllMenuItems,
  type Restaurant,
  type FoodCategory,
  type MenuItem,
} from "@/firebase/foodFirebase";
import DishModal from "@/components/food/DishModal";

const ORANGE = "#FC8019";
const DARK   = "#282C3F";
const GRAY   = "#93959F";

// Animated result row
function ResultRow({ item, index, onPress }: {
  item: { type: "dish" | "restaurant"; data: any };
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

  const isDish = item.type === "dish";
  const dish = item.data as MenuItem;
  const rest = item.data as Restaurant;

  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateY }] }}>
      <TouchableOpacity style={s.resultRow} onPress={onPress} activeOpacity={0.8}>
        <View style={s.resultIconWrap}>
          {isDish ? (
            dish.image ? (
              <Image source={{ uri: dish.image }} style={s.resultIcon} contentFit="cover" />
            ) : (
              <View style={[s.resultIcon, s.resultIconPlaceholder]}>
                <Ionicons name="fast-food-outline" size={20} color={ORANGE} />
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
          <Text style={s.resultName}>{isDish ? dish.name : rest.restaurantName}</Text>
          <Text style={s.resultSub}>
            {isDish 
              ? `${dish.price ? `₹${dish.price}` : dish.variants?.[0]?.price ? `₹${dish.variants[0].price}` : 'Price not available'} · ${dish.category || "Dish"}` 
              : "Restaurant · 30-40 min"}
          </Text>
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
    Animated.spring(anim, {
      toValue: 1,
      tension: 50,
      friction: 7,
      delay: index * 40,
      useNativeDriver: true,
    }).start();
  }, [index]);

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });

  return (
    <Animated.View style={{ opacity: anim, transform: [{ scale }, { translateY }], flex: 1, marginHorizontal: 4, marginVertical: 6 }}>
      <TouchableOpacity style={s.catCard} onPress={onPress} activeOpacity={0.85}>
        <View style={s.catImgContainer}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={s.catImg} contentFit="cover" />
          ) : (
            <View style={[s.catImg, s.catImgPlaceholder]}>
              <Ionicons name="restaurant-outline" size={32} color={ORANGE} />
            </View>
          )}
        </View>
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
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
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
    const u3 = listenAllMenuItems(setMenuItems);
    return () => { u1(); u2(); u3(); };
  }, []);

  const filteredRestaurants = query.length > 1
    ? restaurants.filter(r => r.restaurantName?.toLowerCase().includes(query.toLowerCase()))
    : [];

  const filteredDishes = query.length > 1
    ? menuItems.filter(m => 
        m.name?.toLowerCase().includes(query.toLowerCase()) ||
        m.description?.toLowerCase().includes(query.toLowerCase()) ||
        m.category?.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  const results = [
    ...filteredDishes.map(d => ({ type: "dish" as const, data: d })),
    ...filteredRestaurants.map(r => ({ type: "restaurant" as const, data: r })),
  ];

  const openDish = (dish: MenuItem) => {
    const rest = restaurants.find(r => r.id === dish.restaurantId);
    if (!rest) return;
    setDishModal({ 
      visible: true, 
      restaurantId: rest.id, 
      restaurantName: rest.restaurantName,
      filterCategoryId: dish.categoryId 
    });
  };

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
          numColumns={3}
          contentContainerStyle={s.catGrid}
          columnWrapperStyle={s.catRow}
          ListHeaderComponent={
            <View style={s.headerSection}>
              <Text style={s.sectionTitle}>Popular Categories</Text>
              <Text style={s.sectionSubtitle}>Browse dishes by category</Text>
            </View>
          }
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
                if (item.type === "dish") {
                  openDish(item.data as MenuItem);
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

  headerSection: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: DARK, marginBottom: 4 },
  sectionSubtitle: { fontSize: 13, color: GRAY, fontWeight: "400" },
  catGrid:      { paddingBottom: 80, paddingHorizontal: 8 },
  catRow:       { justifyContent: "flex-start" },
  catCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  catImgContainer:   { marginBottom: 10 },
  catImg:            { width: 56, height: 56, borderRadius: 28 },
  catImgPlaceholder: { backgroundColor: "#fff5f0", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#ffe5d0" },
  catName:           { fontSize: 11, fontWeight: "600", color: DARK, textAlign: "center", lineHeight: 14 },

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