import React from "react";
import { View, Image, Text, StyleSheet } from "react-native";
 
const Loader: React.FC = () => {
  const loaderSource = require("../assets/loader.gif");

  return (
    <View style={styles.container}>
      <Image source={loaderSource} style={styles.gif} />
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

