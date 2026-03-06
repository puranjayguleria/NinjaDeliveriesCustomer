import React from "react";
import { View, Pressable, StyleSheet, Dimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Image } from "expo-image";

const { width } = Dimensions.get("window");
const H = 16;
const PLACEHOLDER_BLURHASH = "LKO2?U%2Tw=w]~RBVZRi};ofM{ay";

interface ValentineBannerProps {
  imageUrl: string | null;
}

const ValentineBanner: React.FC<ValentineBannerProps> = ({ imageUrl }) => {
  const navigation = useNavigation<any>();

  const handlePress = () => {
    navigation.navigate("ValentineSpecials");
  };

  const src = typeof imageUrl === "string" ? imageUrl.replace(/`/g, "").trim() : "";
  if (!src) return null;

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
    marginBottom: 18,
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

export default ValentineBanner;
