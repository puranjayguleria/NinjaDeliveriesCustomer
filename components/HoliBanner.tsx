import React from "react";
import { View, Pressable, StyleSheet, Dimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";

const { width } = Dimensions.get("window");
const H = 16;
const PLACEHOLDER_BLURHASH = "LKO2?U%2Tw=w]~RBVZRi};ofM{ay";

type Props = {
  imageUrl: string | null | undefined;
  storeId: string | null | undefined;
};

const HoliBanner: React.FC<Props> = ({ imageUrl, storeId }) => {
  const nav = useNavigation<any>();
  const src = typeof imageUrl === "string" ? imageUrl.replace(/`/g, "").trim() : "";
  if (!src) return null;

  const handlePress = () => {
    nav.navigate("HoliSpecials", {
      storeId: storeId || "0oS7Zig2gxj2MJesvlC2",
      fromBanner: true,
    });
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={handlePress} style={styles.pressable}>
        <Image
          source={{ uri: src }}
          style={styles.banner}
          contentFit="cover"
          placeholder={{ blurhash: PLACEHOLDER_BLURHASH }}
          cachePolicy="memory-disk"
          transition={120}
          priority="high"
        />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: H,
    marginBottom: 5,
    alignItems: "center",
  },
  pressable: {
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 6,
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
  },
  banner: {
    width: "100%",
    height: width * 0.40,
    borderRadius: 12,
  },
});

export default HoliBanner;

