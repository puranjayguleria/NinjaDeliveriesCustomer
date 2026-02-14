import React from "react";
import { Dimensions, Image as RNImage, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");
const H = 16;
const PLACEHOLDER_BLURHASH = "LKO2?U%2Tw=w]~RBVZRi};ofM{ay";

type Props = {
  onPress: () => void;
  source?: any;
  label?: string;
  title?: string;
  subtitle?: string;
};

const ShivratriImageBanner: React.FC<Props> = ({
  onPress,
  source,
  label,
  title,
  subtitle,
}) => {
  const resolved = RNImage.resolveAssetSource(
    source ?? require("../assets/shivratri banner.jpeg")
  );
  const uri = typeof resolved?.uri === "string" ? resolved.uri : null;
  if (!uri) return null;

  const effectiveTitle = title ?? label;

  return (
    <View style={styles.container}>
      <Pressable onPress={onPress} style={styles.pressable}>
        <View style={styles.bannerWrap}>
          <Image
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            placeholder={{ blurhash: PLACEHOLDER_BLURHASH }}
            cachePolicy="memory-disk"
            transition={180}
          />
          {effectiveTitle ? (
            <LinearGradient
              colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.62)"]}
              style={styles.bottomGradient}
            >
              <Text style={styles.bannerTitle} numberOfLines={1}>
                {effectiveTitle}
              </Text>
              {subtitle ? (
                <Text style={styles.bannerSubtitle} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </LinearGradient>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: H,
    marginTop: 10,
    marginBottom: 12,
  },
  pressable: {
    width: "100%",
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  bannerWrap: {
    width: "100%",
    height: width * 0.475, // Increased by ~10% (0.42 * 1.1)
  },
  bottomGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingBottom: 12,
    paddingTop: 22,
  },
  bannerTitle: {
    color: "#fff",
    fontSize: 14, // Reduced from 16
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  bannerSubtitle: {
    marginTop: 2,
    color: "rgba(255,255,255,0.9)",
    fontSize: 10, // Reduced from 12
    fontWeight: "700",
  },
});

export default ShivratriImageBanner;
