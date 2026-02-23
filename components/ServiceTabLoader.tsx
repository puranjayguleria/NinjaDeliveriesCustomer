import React from "react";
import { View, Image, StyleSheet, Dimensions } from "react-native";

export default function ServiceTabLoader() {
  const { width } = Dimensions.get("window");
  const size = Math.min(320, Math.max(180, Math.round(width * 0.6)));

  return (
    <View style={styles.overlay}>
      <Image
        source={require("../assets/ninjaServiceLoader3.gif")}
        style={{ width: size, height: size }}
        resizeMode="contain"
        fadeDuration={0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
  },
});
