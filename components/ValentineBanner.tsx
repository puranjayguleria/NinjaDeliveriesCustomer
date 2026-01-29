import React from "react";
import { View, Pressable, StyleSheet, Dimensions, Image } from "react-native";
import { useNavigation } from "@react-navigation/native";

const { width } = Dimensions.get("window");
const H = 16;

const ValentineBanner = () => {
  const navigation = useNavigation<any>();

  const handlePress = () => {
    navigation.navigate("ValentineSpecials");
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={handlePress} style={styles.pressable}>
        <Image
          source={require("../assets/valentine-banner.png")}
          style={styles.banner}
          resizeMode="stretch"
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
  },
  banner: {
    width: "100%",
    height: width * 0.40, // Aspect ratio approx 3:1
    borderRadius: 12,
  },
});

export default ValentineBanner;
