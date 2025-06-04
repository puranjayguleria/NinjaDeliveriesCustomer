import React from "react";
import { View, Image, Text, StyleSheet } from "react-native";

const Loader = () => {
  return (
    <View style={styles.container}>
      <Image source={require("../assets/loader.gif")} style={styles.gif} />
      <Text style={styles.text}>Loading...</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
    flex: 1,
  },
  gif: {
    width: 100,
    height: 100,
  },
  text: {
    marginTop: 15,
    fontSize: 16,
    color: "#333",
  },
});

export default Loader;
