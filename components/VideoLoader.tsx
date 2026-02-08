import React, { useEffect, useState } from "react";
import { View, Image, Text, StyleSheet } from "react-native";
import firestore from "@react-native-firebase/firestore";

interface LoaderProps {
  isValentine?: boolean;
}

const Loader: React.FC<LoaderProps> = ({ isValentine: isValentineProp }) => {
  const [isValentine, setIsValentine] = useState<boolean>(
    isValentineProp ?? false
  );

  // Fetch the Valentine UI flag from Firestore if prop is not provided
  useEffect(() => {
    if (isValentineProp !== undefined) {
      setIsValentine(isValentineProp);
      return;
    }

    const unsub = firestore()
      .collection("ui_config")
      .doc("valentine_ui")
      .onSnapshot(
        (snap) => {
          if (snap.exists) {
            const data = snap.data() as any;
            setIsValentine(data?.enabled === true);
          } else {
            setIsValentine(false);
          }
        },
        (err) => {
          console.warn("Error fetching UI config in Loader:", err);
          setIsValentine(false);
        }
      );

    return () => unsub && unsub();
  }, [isValentineProp]);

  const loaderSource = isValentine
    ? require("../assets/valentineLoader.gif")
    : require("../assets/loader.gif");

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
