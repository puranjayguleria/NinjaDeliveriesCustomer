/* ------------------------------------------------------------------
   LocationPromptCard  –  bottom-sheet that asks for location
------------------------------------------------------------------- */
import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useNavigation } from "@react-navigation/native";
import { useLocationContext } from "@/context/LocationContext";

const LocationPromptCard: React.FC = () => {
  const nav = useNavigation<any>();
  const { updateLocation } = useLocationContext(); // ← use updater
  const [busy, setBusy] = useState(false);

  /* ask / fetch / store */
  const enableLocation = useCallback(async () => {
    try {
      setBusy(true);

      /* 1️⃣  check existing permission */
      let { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") {
        const res = await Location.requestForegroundPermissionsAsync();
        status = res.status;
      }
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Please allow location access or choose your address manually."
        );
        return;
      }

      /* 2️⃣  get current coordinates */
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      /* 3️⃣  update context (storeId stays null until
              findNearestStore-logic sets it elsewhere) */
      updateLocation({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        address: "", // you can reverse-geocode if desired
        storeId: null,
      });
    } catch (err) {
      console.warn("enableLocation error", err);
      Alert.alert("Error", "Could not fetch location. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [updateLocation]);

  /* UI – simple bottom-sheet card */
  return (
    <View style={styles.sheet}>
      <View style={styles.handle} />

      <View style={styles.headerRow}>
        <MaterialIcons name="location-on" size={26} color="#009688" />
        <Text style={styles.title}>Set your delivery location</Text>
      </View>

      <Text style={styles.sub}>
        Turn on location services or select your address manually.
      </Text>

      <TouchableOpacity
        style={[styles.btn, styles.btnPrimary]}
        onPress={enableLocation}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnPrimaryTxt}>Enable Location</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, styles.btnSecondary]}
        onPress={() =>
          nav.navigate("LocationSelector", { fromScreen: "Products" })
        }
        disabled={busy}
      >
        <Text style={styles.btnSecondaryTxt}>Select Manually</Text>
      </TouchableOpacity>
    </View>
  );
};

/* ------------------------------------------------------------------
   styles (only for the card – keep or merge with your main sheet styles)
------------------------------------------------------------------- */
const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 32 : 20,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: -2 },
    elevation: 12,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#ccc",
    marginBottom: 12,
  },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  title: { fontSize: 18, fontWeight: "700", color: "#333", marginLeft: 6 },
  sub: { fontSize: 14, color: "#555", lineHeight: 20, marginBottom: 20 },

  btn: {
    paddingVertical: 14,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  btnPrimary: { backgroundColor: "#009688" },
  btnSecondary: { backgroundColor: "#e0f2f1" },

  btnPrimaryTxt: { color: "#fff", fontSize: 16, fontWeight: "700" },
  btnSecondaryTxt: { color: "#00796b", fontSize: 16, fontWeight: "700" },
});

export default LocationPromptCard;
