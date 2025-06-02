// LocationSelectorScreen.tsx

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  Linking,
  Platform,
  ActivityIndicator,
  Image,
  Modal,
  KeyboardAvoidingView,
  SafeAreaView,
} from "react-native";
import MapView, { Region } from "react-native-maps";
import * as Location from "expo-location";
import axios from "axios";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList, LocationData } from "../types/navigation";
import { GOOGLE_PLACES_API_KEY } from "@env";
import ErrorModal from "../components/ErrorModal";
import { useLocationContext } from "../context/LocationContext"; // location context hook

type LocationSelectorScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "LocationSelector"
>;
type LocationSelectorScreenRouteProp = RouteProp<
  RootStackParamList,
  "LocationSelector"
>;

type Props = {
  navigation: LocationSelectorScreenNavigationProp;
  route: LocationSelectorScreenRouteProp;
};

type DeliveryZone = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
};

type PlaceDetails = {
  description: string;
  place_id: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
};

const LocationSelectorScreen: React.FC<Props> = ({ navigation, route }) => {
  const { location, updateLocation } = useLocationContext();
  const mapRef = useRef<MapView>(null);

  const fromScreen = route.params?.fromScreen || "Category";

  /****************************************
   * DEFAULT REGION
   ****************************************/
  const DEFAULT_REGION: Region = {
    latitude: location.lat ?? 31.1048,
    longitude: location.lng ?? 77.1734,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  /****************************************
   * STATE
   ****************************************/
  const [markerCoord, setMarkerCoord] = useState({
    latitude: DEFAULT_REGION.latitude,
    longitude: DEFAULT_REGION.longitude,
  });
  const [address, setAddress] = useState<string>(
    location.address || "Search or choose your location"
  );
  const [placeQuery, setPlaceQuery] = useState<string>("");
  const [autocompleteResults, setAutocompleteResults] = useState<PlaceDetails[]>([]);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);

  // Error Modal
  const [isErrorModalVisible, setIsErrorModalVisible] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // BOTTOM SHEET
  const [showSaveForm, setShowSaveForm] = useState<boolean>(false);
  const [houseNo, setHouseNo] = useState<string>("");
  const [placeLabel, setPlaceLabel] = useState<string>("");

  /****************************************
   * USEEFFECTS
   ****************************************/
  useEffect(() => {
    requestLocationPermission();
    fetchDeliveryZones();
  }, []);

  useEffect(() => {
    if (placeQuery.length > 2) {
      fetchPlaceSuggestions();
    } else {
      setAutocompleteResults([]);
    }
  }, [placeQuery]);

  /****************************************
   * LOCATION PERMISSION
   ****************************************/
  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        setLocationPermission(true);
        fetchCurrentLocation();
      } else {
        setLocationPermission(false);
        // not forcing error modal so user can manually pick
      }
    } catch (err) {
      console.error("Permission error:", err);
      showErrorModal("Error", "Failed to request location permission.");
    }
  };

  const openAppSettings = () => {
    if (Platform.OS === "ios") {
      Linking.openURL("app-settings:");
    } else {
      Linking.openSettings();
    }
  };

  /****************************************
   * FETCH DELIVERY ZONES
   ****************************************/
  const fetchDeliveryZones = async () => {
    try {
      const snap = await firestore().collection("delivery_zones").get();
      const zones: DeliveryZone[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          storeId: d.id,                   
          name: data.name,
          latitude: Number(data.latitude),
          longitude: Number(data.longitude),
          radius: Number(data.radius),
        };
      });
      setDeliveryZones(zones);
    } catch (err) {
      console.error("fetchDeliveryZones:", err);
      showErrorModal("Error", "Could not load service areas.");
    }
  };
  
  /****************************************
   * PLACE AUTOCOMPLETE
   ****************************************/
  const fetchPlaceSuggestions = async () => {
    setIsLoading(true);
    try {
      const queryWithRegion = `Himachal Pradesh, ${placeQuery}`;
      const resp = await axios.get(
        "https://maps.googleapis.com/maps/api/place/autocomplete/json",
        {
          params: {
            input: queryWithRegion,
            key: GOOGLE_PLACES_API_KEY,
            location: "31.1048,77.1734",
            radius: 50000,
            components: "country:in",
          },
        }
      );

      if (resp.data.status === "OK") {
        const filteredResults = resp.data.predictions.filter((p: PlaceDetails) =>
          p.description.toLowerCase().includes("himachal")
        );
        setAutocompleteResults(filteredResults);
      } else if (resp.data.status === "ZERO_RESULTS") {
        setAutocompleteResults([]);
      } else {
        console.warn("Autocomplete API Error:", resp.data.status);
        setAutocompleteResults([]);
        showErrorModal("Error", "Failed to fetch place suggestions.");
      }
    } catch (err) {
      console.error("Error fetching place suggestions:", err);
      showErrorModal("Error", "Failed to fetch place suggestions.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlaceSelection = async (place: PlaceDetails) => {
    setIsLoading(true);
    try {
      const detailsResp = await axios.get(
        "https://maps.googleapis.com/maps/api/place/details/json",
        {
          params: {
            place_id: place.place_id,
            key: GOOGLE_PLACES_API_KEY,
            fields: "geometry,formatted_address",
          },
        }
      );

      if (detailsResp.data.status === "OK") {
        const { lat, lng } = detailsResp.data.result.geometry.location;
        const newAddress = detailsResp.data.result.formatted_address;

        // Move map to selected location
        mapRef.current?.animateToRegion(
          {
            latitude: lat,
            longitude: lng,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          },
          1000
        );
        setMarkerCoord({ latitude: lat, longitude: lng });
        setAddress(newAddress);
        setPlaceQuery(newAddress);
        setAutocompleteResults([]);
      } else {
        console.warn("Place Details API Error:", detailsResp.data.status);
        showErrorModal("Error", "Failed to fetch place details.");
      }
    } catch (err) {
      console.error("Error fetching place details:", err);
      showErrorModal("Error", "Failed to fetch place details.");
    } finally {
      setIsLoading(false);
    }
  };

  /**
 * Examine the Distance Matrix response and return the nearest zone
 * whose distance (in km) ≤ zone.radius.  If none match, returns null.
 */
const pickNearestZone = (
  elements: any[],
  zones: DeliveryZone[]
): { storeId: string; zone: DeliveryZone } | null => {
  let winner: { zone: DeliveryZone; distKm: number } | null = null;

  elements.forEach((el, idx) => {
    if (el.status !== "OK") return;

    const km = el.distance.value / 1000; // metres ➜ km
    const zone = zones[idx];
    if (km <= (zone.radius as number)) {
      if (!winner || km < winner.distKm) {
        winner = { zone, distKm: km };
      }
    }
  });

  return winner ? { storeId: winner.zone.storeId, zone: winner.zone } : null;
};


  /****************************************
   * MANUAL REVERSE GEOCODE (FALLBACK)
   ****************************************/
  async function reverseGeocodeLatLng(latitude: number, longitude: number) {
    // Attempt iOS's expo-location reverseGeocodeAsync if:
    // 1) On iOS, or
    // 2) We have permission on Android (to avoid error)
    if (Platform.OS === "ios" || locationPermission) {
      try {
        const places = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (places && places.length > 0) {
          const { name, city } = places[0];
          return `${name || ""}, ${city || ""}`;
        }
      } catch (err) {
        console.warn("reverseGeocodeAsync failed:", err);
        // fallback to Google
      }
    }

    // Fallback: use Google Geocoding API for address
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_PLACES_API_KEY}`;
      const resp = await axios.get(url);
      if (resp.data.status === "OK" && resp.data.results.length > 0) {
        return resp.data.results[0].formatted_address;
      }
    } catch (error) {
      console.warn("Google Geocoding error:", error);
    }
    return "Unnamed Location";
  }

  /****************************************
   * FETCH CURRENT LOCATION
   ****************************************/
  const fetchCurrentLocation = async () => {
    setIsLoading(true);
    try {
      const currentLoc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = currentLoc.coords;
      mapRef.current?.animateToRegion(
        { latitude, longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 },
        1000
      );
      setMarkerCoord({ latitude, longitude });
    } catch (err) {
      console.error("Error fetching current location:", err);
      showErrorModal("Error", "Unable to fetch current location.");
    } finally {
      setIsLoading(false);
    }
  };

  /****************************************
   * CONFIRM LOCATION
   ****************************************/
  const confirmLocation = async () => {
    setIsLoading(true);
    try {
      const addr = await reverseGeocodeLatLng(
        markerCoord.latitude,
        markerCoord.longitude
      );
  
      const destinations = deliveryZones
        .map((z) => `${z.latitude},${z.longitude}`)
        .join("|");
  
      const distResp = await axios.get(
        "https://maps.googleapis.com/maps/api/distancematrix/json",
        {
          params: {
            origins: `${markerCoord.latitude},${markerCoord.longitude}`,
            destinations,
            key: GOOGLE_PLACES_API_KEY,
            units: "metric",
          },
        }
      );
  
      if (distResp.data.status !== "OK") {
        showErrorModal("Error", "Failed to check deliverability.");
        return;
      }
  
      const nearest = pickNearestZone(
        distResp.data.rows[0].elements,
        deliveryZones
      );
  
      if (!nearest) {
        showErrorModal(
          "Delivery Unavailable",
          "Sorry, we don’t deliver to this location yet."
        );
        return;
      }
  
      const newLocationData: LocationData & { storeId: string } = {
        lat: markerCoord.latitude,
        lng: markerCoord.longitude,
        address: addr,
        storeId: nearest.storeId,
      };
  
      updateLocation(newLocationData);
  
      if (fromScreen === "Cart") {
        setHouseNo("");
        setPlaceLabel("");
        setShowSaveForm(true);
      } else {
  navigation.navigate("AppTabs", { screen: "Home" });
      }
    } catch (err) {
      console.error("confirmLocation:", err);
      showErrorModal("Error", "Failed to confirm location. Please retry.");
    } finally {
      setIsLoading(false);
    }
  };
  

  /****************************************
   * SAVE LOCATION (FIRESTORE)
   ****************************************/
  const saveLocationForUser = async (
    loc: LocationData,
    houseNoVal: string,
    labelVal: string
  ) => {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) {
        console.warn("No user is logged in");
        return;
      }
      const userDocRef = firestore().collection("users").doc(currentUser.uid);
      await userDocRef.update({
        locations: firestore.FieldValue.arrayUnion({
          lat: loc.lat,
          lng: loc.lng,
          address: loc.address,
          houseNo: houseNoVal,
          placeLabel: labelVal,
          createdAt: firestore.Timestamp.now(),
        }),
      });
      console.log("Location saved successfully.");
    } catch (err) {
      console.error("Error saving location:", err);
      Alert.alert("Error", "Could not save your location. Please try again later.");
    }
  };

  /****************************************
   * ERROR MODAL
   ****************************************/
  const showErrorModal = (_title: string, message: string) => {
    setErrorMessage(message);
    setIsErrorModalVisible(true);
  };
  const closeErrorModal = () => setIsErrorModalVisible(false);

  /****************************************
   * HANDLE "USE CURRENT LOCATION"
   ****************************************/
  const handleUseCurrentLocation = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") {
        const { status: newStatus } =
          await Location.requestForegroundPermissionsAsync();
        if (newStatus !== "granted") {
          showErrorModal(
            "Permission Denied",
            "Location permission is required. Please enable it in settings."
          );
          return;
        }
      }
      fetchCurrentLocation();
    } catch (err) {
      console.error("Error using current location:", err);
      showErrorModal("Error", "Failed to use current location.");
    }
  };

  /****************************************
   * ON SAVE FORM
   ****************************************/
  const handleSaveLocationForm = async () => {
    if (!houseNo.trim() || !placeLabel.trim()) {
      Alert.alert("Required", "Please fill both House No and Name of Place.");
      return;
    }

    setIsLoading(true);
    try {
      const newLoc = {
        lat: location.lat!,
        lng: location.lng!,
        address: location.address,
        houseNo,
        placeLabel,
      };
      await saveLocationForUser(newLoc, houseNo, placeLabel);

      setShowSaveForm(false);
      if (fromScreen === "Cart") {
        navigation.navigate("CartFlow", {
          screen: "CartHome",
          params: { selectedLocation: newLoc },
        });
      } else {
  navigation.navigate("CategoriesTab", { selectedLocation: newLoc });
      }
    } catch (err) {
      console.error("Error in handleSaveLocationForm:", err);
    } finally {
      setIsLoading(false);
    }
  };

  /****************************************
   * RENDER
   ****************************************/
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* LOADER OVERLAY */}
        {isLoading && (
          <View style={styles.loaderOverlay}>
            <ActivityIndicator size="large" color="#000" />
          </View>
        )}

        {/* ERROR MODAL */}
        <ErrorModal
          visible={isErrorModalVisible}
          message={errorMessage}
          onClose={closeErrorModal}
        />

        {/* SEARCH SECTION */}
        <View style={styles.searchContainer}>
          <View style={{ zIndex: 999 }}>
            {/* Input row with icon + placeholder */}
            <View style={styles.searchInputRow}>
              <Ionicons name="search" size={18} color="#666" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                value={placeQuery}
                onChangeText={setPlaceQuery}
                placeholder="Search location..."
                placeholderTextColor="#aaa"
              />
            </View>

            {/* AUTOCOMPLETE RESULTS */}
            {autocompleteResults.length > 0 && (
              <FlatList
                data={autocompleteResults}
                keyExtractor={(item) => item.place_id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => handlePlaceSelection(item)}
                    style={styles.autocompleteItem}
                  >
                    <Text style={styles.autocompleteText}>{item.description}</Text>
                  </TouchableOpacity>
                )}
                style={styles.autocompleteContainer}
              />
            )}
          </View>

          {/* If location not granted */}
          {!locationPermission && (
            <TouchableOpacity style={styles.enableLocationButton} onPress={openAppSettings}>
              <Text style={styles.enableLocationText}>Enable Location Permission</Text>
            </TouchableOpacity>
          )}

          {/* "Use Current Location" Button */}
          <TouchableOpacity
            style={styles.useCurrentLocationButton}
            onPress={handleUseCurrentLocation}
          >
            <Text style={styles.useCurrentLocationText}>Use Current Location</Text>
          </TouchableOpacity>
        </View>

        {/* MAP SECTION */}
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            initialRegion={DEFAULT_REGION}
            showsPointsOfInterest={false}
            showsTraffic={false}
            onRegionChangeComplete={(newRegion) => {
              setMarkerCoord({
                latitude: newRegion.latitude,
                longitude: newRegion.longitude,
              });
            }}
          />
          <View pointerEvents="none" style={styles.markerFixed}>
            <Image
              style={styles.marker}
              source={{ uri: "https://img.icons8.com/color/96/000000/map-pin.png" }}
            />
          </View>
        </View>

        {/* FOOTER BUTTON */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.confirmButton} onPress={confirmLocation}>
            <Text style={styles.confirmButtonText}>Confirm Location</Text>
          </TouchableOpacity>
        </View>

        {/* BOTTOM SHEET (SAVE FORM) */}
        <Modal visible={showSaveForm} animationType="slide" transparent>
          <KeyboardAvoidingView style={styles.modalContainer} behavior="padding">
            <View style={styles.bottomSheet}>
              <Text style={styles.saveFormTitle}>Save Your Location</Text>
              <Text style={styles.saveFormSubtitle}>
                Enter your house/flat number and a label (like "Home", "Office", etc.)
              </Text>

              <TextInput
                style={styles.inputField}
                placeholder="House / Flat No."
                placeholderTextColor="#999"
                value={houseNo}
                onChangeText={setHouseNo}
              />
              <TextInput
                style={styles.inputField}
                placeholder="Name of Place (e.g. Home)"
                placeholderTextColor="#999"
                value={placeLabel}
                onChangeText={setPlaceLabel}
              />

              <TouchableOpacity
                style={styles.saveLocationButton}
                onPress={handleSaveLocationForm}
              >
                <Text style={styles.saveLocationButtonText}>Save Location</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowSaveForm(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

export default LocationSelectorScreen;

/****************************************
 *          STYLES
 ****************************************/
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f2f2f2",
  },
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },

  /*****************************************
   * SEARCH + AUTOCOMPLETE
   *****************************************/
  searchContainer: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    zIndex: 10,
  },
  searchInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    backgroundColor: "#f9f9f9",
    paddingHorizontal: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
    color: "#333",
  },
  autocompleteContainer: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 10,
    maxHeight: 160,
    backgroundColor: "#fff",
    zIndex: 999,
  },
  autocompleteItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  autocompleteText: {
    fontSize: 16,
    color: "#333",
  },

  enableLocationButton: {
    marginTop: 10,
    backgroundColor: "#FF7043",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  enableLocationText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  useCurrentLocationButton: {
    marginTop: 10,
    backgroundColor: "#4CAF50",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  useCurrentLocationText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },

  /*****************************************
   * MAP
   *****************************************/
  mapContainer: {
    flex: 1,
    backgroundColor: "#ddd",
  },
  markerFixed: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -24,
    marginTop: -48,
  },
  marker: {
    width: 48,
    height: 48,
    resizeMode: "contain",
  },

  /*****************************************
   * FOOTER
   *****************************************/
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderColor: "#ccc",
    backgroundColor: "#fff",
  },
  confirmButton: {
    backgroundColor: "#28a745",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 17,
  },

  /*****************************************
   * BOTTOM SHEET
   *****************************************/
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  bottomSheet: {
    backgroundColor: "#e7f8f6", // pastel teal
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  saveFormTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    marginBottom: 6,
  },
  saveFormSubtitle: {
    fontSize: 14,
    color: "#555",
    marginBottom: 16,
  },
  inputField: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#333",
  },
  saveLocationButton: {
    backgroundColor: "#3498db",
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 8,
  },
  saveLocationButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  cancelButton: {
    backgroundColor: "#fff",
    borderColor: "#3498db",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 8,
  },
  cancelButtonText: {
    color: "#3498db",
    fontSize: 15,
    fontWeight: "600",
  },
});
