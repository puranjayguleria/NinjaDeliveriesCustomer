import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { useNavigation, useRoute } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

import { useLocationContext } from "@/context/LocationContext";

const PLACEHOLDER_BLURHASH = "LKO2?U%2Tw=w]~RBVZRi};ofM{ay";
const CATEGORY_ID = "Holi Specials";
const FALLBACK_STORE_ID = "0oS7Zig2gxj2MJesvlC2";

type SubcategoryDoc = {
  id: string;
  name?: string;
  categoryId?: string;
  storeId?: string;
  priority?: number;
  image?: string;
  imageUrl?: string;
  img?: string;
};

const { width } = Dimensions.get("window");
const GUTTER = 14;
const GRID_GAP = 14;
const CARD_W = (width - GUTTER * 2 - GRID_GAP) / 2;
const CARD_H = Math.round(CARD_W * 1.06);

const pickImage = (s: SubcategoryDoc) => {
  const raw =
    s?.imageUrl ||
    s?.image ||
    s?.img ||
    "";
  return String(raw).replace(/`/g, "").trim();
};

export default function HoliSpecialsScreen() {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { location } = useLocationContext();

  const fromBanner = route?.params?.fromBanner === true;
  const storeId = String(route?.params?.storeId || location?.storeId || FALLBACK_STORE_ID);

  const [items, setItems] = useState<SubcategoryDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");

  const confetti = useMemo(
    () => [
      { left: "10%", top: 14, size: 7, color: "rgba(236, 72, 153, 0.35)" },
      { left: "18%", top: 52, size: 5, color: "rgba(59, 130, 246, 0.28)" },
      { left: "26%", top: 22, size: 4, color: "rgba(34, 197, 94, 0.26)" },
      { left: "34%", top: 58, size: 8, color: "rgba(245, 158, 11, 0.28)" },
      { left: "44%", top: 18, size: 5, color: "rgba(168, 85, 247, 0.22)" },
      { left: "54%", top: 48, size: 4, color: "rgba(16, 185, 129, 0.20)" },
      { left: "63%", top: 20, size: 8, color: "rgba(244, 63, 94, 0.22)" },
      { left: "72%", top: 54, size: 5, color: "rgba(14, 165, 233, 0.24)" },
      { left: "82%", top: 18, size: 4, color: "rgba(34, 197, 94, 0.22)" },
      { left: "90%", top: 44, size: 7, color: "rgba(250, 204, 21, 0.28)" },
      { left: "14%", top: 96, size: 6, color: "rgba(59, 130, 246, 0.20)" },
      { left: "38%", top: 104, size: 4, color: "rgba(34, 197, 94, 0.20)" },
      { left: "62%", top: 92, size: 6, color: "rgba(236, 72, 153, 0.22)" },
      { left: "86%", top: 96, size: 4, color: "rgba(245, 158, 11, 0.22)" },
    ],
    []
  );

  useEffect(() => {
    nav?.setOptions?.({
      headerShown: true,
      title: "Holi Specials",
      headerShadowVisible: false,
      headerStyle: { backgroundColor: "#fff" },
      headerTitleStyle: { fontWeight: "900" },
    });
  }, [nav]);

  useEffect(() => {
    setLoading(true);
    const unsub = firestore()
      .collection("subcategories")
      .where("storeId", "==", storeId)
      .where("categoryId", "==", CATEGORY_ID)
      .onSnapshot(
        (snap) => {
          const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
          setItems(rows);
          setLoading(false);
        },
        () => {
          setItems([]);
          setLoading(false);
        }
      );
    return () => unsub();
  }, [storeId]);

  useEffect(() => {
    if (!fromBanner) return;
    const u = auth().currentUser;
    if (!u?.uid) {
      setUserName("");
      return;
    }
    const unsub = firestore()
      .collection("users")
      .doc(u.uid)
      .onSnapshot(
        (doc) => {
          const data: any = doc.data() || {};
          setUserName(String(data?.name || "").trim());
        },
        () => setUserName("")
      );
    return () => unsub();
  }, [fromBanner]);

  const data = useMemo(() => {
    return [...items].sort((a, b) => {
      const ap = typeof a.priority === "number" ? a.priority : Number.MAX_SAFE_INTEGER;
      const bp = typeof b.priority === "number" ? b.priority : Number.MAX_SAFE_INTEGER;
      if (ap !== bp) return ap - bp;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }, [items]);

  const greetingName = useMemo(() => {
    const u = auth().currentUser as any;
    return (
      String(userName || "").trim() ||
      String(u?.displayName || "").trim() ||
      "Ninja"
    );
  }, [userName]);

  const onOpenSub = (sub: SubcategoryDoc) => {
    nav.navigate("ProductListingFromHome", {
      categoryId: CATEGORY_ID,
      categoryName: String(sub?.name || "Holi Specials"),
      subcategoryId: sub.id,
    });
  };

  return (
    <View style={styles.page}>
      <Image
        source={{
          uri: "https://firebasestorage.googleapis.com/v0/b/ninjadeliveries-91007.firebasestorage.app/o/holi%20theme%2Fspecial%20bg.png?alt=media&token=15a5e541-c16e-4f52-8e0b-1d8fee4bccf9",
        }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={120}
        priority="high"
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : data.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No subcategories found</Text>
          <Text style={styles.emptySub}>Try again later.</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(it) => it.id}
          numColumns={2}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.header}>
              <View style={styles.hero}>
                <LinearGradient
                  colors={["rgba(236, 72, 153, 0.28)", "rgba(59, 130, 246, 0.22)", "rgba(34, 197, 94, 0.20)", "rgba(245, 158, 11, 0.18)"]}
                  start={{ x: 0.1, y: 0 }}
                  end={{ x: 0.9, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.heroOverlay} />
                <View style={[styles.splash, styles.splashPink]} />
                <View style={[styles.splash, styles.splashBlue]} />
                <View style={[styles.splash, styles.splashGreen]} />
                <View style={[styles.splash, styles.splashOrange]} />
                {confetti.map((d, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      {
                        left: d.left as any,
                        top: d.top,
                        width: d.size,
                        height: d.size,
                        borderRadius: d.size,
                        backgroundColor: d.color,
                      },
                    ]}
                  />
                ))}
                <View style={styles.heroInner}>
                  <LinearGradient
                    colors={["rgba(255,255,255,0.92)", "rgba(255,255,255,0.78)"]}
                    style={styles.badge}
                  >
                    <Ionicons name="sparkles" size={14} color="#B45309" />
                    <Text style={styles.badgeText}>Festival Picks</Text>
                  </LinearGradient>
                  <Text style={styles.title}>Holi Specials</Text>
                  <Text style={styles.subtitle}>Choose a section to start shopping</Text>
                </View>
                <LinearGradient
                  colors={["rgba(236, 72, 153, 0)", "rgba(236, 72, 153, 0.08)", "rgba(59, 130, 246, 0.10)", "rgba(34, 197, 94, 0.08)", "rgba(245, 158, 11, 0)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.heroRibbon}
                />
              </View>

              {fromBanner ? (
                <LinearGradient
                  colors={["rgba(236, 72, 153, 0.34)", "rgba(59, 130, 246, 0.30)", "rgba(34, 197, 94, 0.26)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.greetingBorder}
                >
                  <View style={styles.greetingCard}>
                    <Text style={styles.greetingTitle} numberOfLines={1}>
                      {`HAPPY HOLI, ${greetingName}`.toUpperCase()}
                    </Text>
                    <Text style={styles.greetingSub} numberOfLines={2}>
                      May your day be filled with colors and joy.
                    </Text>
                  </View>
                </LinearGradient>
              ) : null}

              <View style={styles.sectionHead}>
                <View style={styles.sectionTitleWrap}>
                  <Text style={styles.sectionTitle}>Explore</Text>
                  <LinearGradient
                    colors={["rgba(236, 72, 153, 0.55)", "rgba(59, 130, 246, 0.55)", "rgba(34, 197, 94, 0.45)"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.sectionUnderline}
                  />
                </View>
                <View style={styles.sectionHint}>
                  <Ionicons name="hand-left-outline" size={14} color="#6B7280" />
                  <Text style={styles.sectionHintText}>Tap a card</Text>
                </View>
              </View>
            </View>
          }
          renderItem={({ item, index }) => {
            const img = pickImage(item);
            const isLastOdd = data.length % 2 === 1 && index === data.length - 1;
            const mediaH = isLastOdd ? Math.round(CARD_H * 0.92) : CARD_H;
            return (
              <View style={[styles.itemWrap, isLastOdd && styles.itemWrapFull]}>
                <Pressable
                  onPress={() => onOpenSub(item)}
                  style={({ pressed }) => [
                    styles.cardPress,
                    pressed ? styles.cardPressed : null,
                  ]}
                >
                  <LinearGradient
                    colors={["rgba(236, 72, 153, 0.65)", "rgba(59, 130, 246, 0.65)", "rgba(34, 197, 94, 0.55)"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.cardBorder}
                  >
                    <View style={styles.card}>
                      <View style={[styles.cardMedia, { height: mediaH }]}>
                        {img ? (
                          <Image
                            source={{ uri: img }}
                            style={StyleSheet.absoluteFill}
                            contentFit="cover"
                            placeholder={{ blurhash: PLACEHOLDER_BLURHASH }}
                            transition={220}
                            cachePolicy="disk"
                          />
                        ) : (
                          <LinearGradient
                            colors={["#FDE68A", "#FBCFE8", "#A7F3D0"]}
                            style={StyleSheet.absoluteFill}
                          />
                        )}

                        <LinearGradient
                          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.76)"]}
                          style={styles.cardShade}
                        />
                        <Text style={styles.cardTitle} numberOfLines={2}>
                          {String(item.name || "").trim() || "Holi"}
                        </Text>
                      </View>
                    </View>
                  </LinearGradient>
                </Pressable>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#fff" },
  header: {
    paddingTop: 14,
    paddingHorizontal: GUTTER,
    paddingBottom: 10,
  },
  hero: {
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.70)",
    borderWidth: 1,
    borderColor: "rgba(17, 24, 39, 0.06)",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  heroInner: {
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  heroRibbon: {
    position: "absolute",
    left: -28,
    right: -28,
    bottom: -24,
    height: 66,
    transform: [{ rotate: "-4deg" }],
  },
  dot: {
    position: "absolute",
    opacity: 1,
  },
  splash: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 999,
    opacity: 0.3,
    transform: [{ rotate: "18deg" }],
  },
  splashPink: { backgroundColor: "#FB7185", top: -80, left: -70 },
  splashBlue: { backgroundColor: "#60A5FA", top: -70, right: -90, opacity: 0.28 },
  splashGreen: { backgroundColor: "#34D399", bottom: -90, left: -80, opacity: 0.25 },
  splashOrange: { backgroundColor: "#FDBA74", bottom: -90, right: -70, opacity: 0.25 },
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(180, 83, 9, 0.12)",
  },
  badgeText: { color: "#92400E", fontWeight: "900", fontSize: 12 },
  title: {
    marginTop: 8,
    fontSize: 26,
    fontWeight: "900",
    color: "#111827",
    letterSpacing: 0.2,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
  },
  list: {
    paddingHorizontal: GUTTER,
    paddingBottom: 18,
  },
  sectionHead: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitleWrap: { flexDirection: "column", gap: 6 },
  sectionTitle: { fontSize: 16, fontWeight: "900", color: "#111827" },
  sectionUnderline: {
    width: 54,
    height: 4,
    borderRadius: 999,
  },
  sectionHint: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionHintText: { fontSize: 12, fontWeight: "800", color: "#6B7280" },
  greetingBorder: {
    marginTop: 12,
    borderRadius: 18,
    padding: 2,
  },
  greetingCard: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(17, 24, 39, 0.06)",
    backgroundColor: "rgba(255,255,255,0.86)",
  },
  greetingTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#111827",
    letterSpacing: 0.7,
  },
  greetingSub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "800",
    color: "#6B7280",
  },
  itemWrap: {
    width: CARD_W,
    marginBottom: GRID_GAP,
  },
  itemWrapFull: {
    width: "100%",
  },
  cardPress: {
    transform: [{ scale: 1 }],
  },
  cardPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.97,
  },
  cardBorder: {
    padding: 2,
    borderRadius: 20,
  },
  card: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "rgba(17, 24, 39, 0.06)",
    shadowColor: "#000",
    shadowOpacity: 0.10,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  cardMedia: {
    width: "100%",
    backgroundColor: "#F3F4F6",
  },
  cardShade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 86,
  },
  cardTitle: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: "#111827" },
  emptySub: { marginTop: 6, fontSize: 13, fontWeight: "700", color: "#6B7280" },
});
