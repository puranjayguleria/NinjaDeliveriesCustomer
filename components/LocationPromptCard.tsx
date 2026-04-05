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
  Dimensions,
} from "react-native";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useNavigation } from "@react-navigation/native";
import { useLocationContext } from "@/context/LocationContext";

const { width } = Dimensions.get("window");

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

  /* UI – elegant bottom-sheet card */
  return (
    <View style={styles.sheet}>
      <View style={styles.handle} />

      <View style={styles.iconContainer}>
        <View style={styles.iconCircle}>
          <MaterialIcons name="location-on" size={40} color="#009688" />
        </View>
      </View>

      <Text style={styles.title}>Enable Location Services</Text>
      <Text style={styles.sub}>
        We need your location to show nearby stores and provide accurate delivery estimates
      </Text>

      <TouchableOpacity
        style={[styles.btn, styles.btnPrimary, busy && styles.btnDisabled]}
        onPress={enableLocation}
        disabled={busy}
        activeOpacity={0.8}
      >
        {busy ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Ionicons name="navigate" size={20} color="#fff" style={styles.btnIcon} />
            <Text style={styles.btnPrimaryTxt}>Use Current Location</Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, styles.btnSecondary]}
        onPress={() =>
          nav.navigate("LocationSelector", { fromScreen: "Products" })
        }
        disabled={busy}
        activeOpacity={0.8}
      >
        <Ionicons name="search-outline" size={20} color="#009688" style={styles.btnIcon} />
        <Text style={styles.btnSecondaryTxt}>Enter Address Manually</Text>
      </TouchableOpacity>
    </View>
  );
};

/* ------------------------------------------------------------------
   styles
------------------------------------------------------------------- */
const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  },
  handle: {
    alignSelf: "center",
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#e0e0e0",
    marginBottom: 20,
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#e0f2f1",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#009688",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1a1a1a",
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  sub: {
    fontSize: 15,
    color: "#666",
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 28,
    paddingHorizontal: 8,
  },

  btn: {
    flexDirection: "row",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  btnPrimary: {
    backgroundColor: "#009688",
  },
  btnSecondary: {
    backgroundColor: "#f5f5f5",
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
  },
  btnDisabled: {
    opacity: 0.7,
  },
  btnIcon: {
    marginRight: 8,
  },
  btnPrimaryTxt: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  btnSecondaryTxt: {
    color: "#009688",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
});

export default LocationPromptCard;
