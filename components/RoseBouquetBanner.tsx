import React from "react";
import { View, Pressable, StyleSheet, Dimensions, Image } from "react-native";
import { useNavigation } from "@react-navigation/native";

const { width } = Dimensions.get("window");
const H = 16;

const RoseBouquetBanner = () => {
  const navigation = useNavigation<any>();

  const handlePress = () => {
    navigation.navigate("RoseBouquetScreen");
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={handlePress} style={styles.pressable}>
        <Image
          source={require("../assets/rose-bouquet-banner.png")}
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
    marginBottom: 16,
    alignItems: "center",
  },
  pressable: {
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    backgroundColor: "#fff",
    borderRadius: 12,
  },
  banner: {
    width: "100%",
    height: width * 0.30, // Consistent with ValentineBanner
    borderRadius: 12,
  },
});

export default RoseBouquetBanner;
