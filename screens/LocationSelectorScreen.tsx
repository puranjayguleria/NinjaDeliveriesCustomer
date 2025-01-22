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
} from "react-native";
import MapView, { Region } from "react-native-maps";
import * as Location from "expo-location";
import axios from "axios";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";
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
  radius: number; // km
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
  /****************************************
   * 1) LOCATION CONTEXT & MAP REF
   ****************************************/
  const { location, updateLocation } = useLocationContext();
  const mapRef = useRef<MapView>(null);

  // If from Cart, we’ll show the bottom sheet form
  const fromScreen = route.params?.fromScreen || "Category";

  /****************************************
   * 2) DEFAULT REGION (CONTEXT FALLBACK)
   ****************************************/
  const DEFAULT_REGION: Region = {
    latitude: location.lat ?? 31.1048,
    longitude: location.lng ?? 77.1734,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  /****************************************
   * 3) STATE
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

  // BOTTOM SHEET FOR "houseNo" & "placeLabel"
  const [showSaveForm, setShowSaveForm] = useState<boolean>(false);
  const [houseNo, setHouseNo] = useState<string>("");
  const [placeLabel, setPlaceLabel] = useState<string>("");

  /****************************************
   * 4) USEEFFECTS
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
   * 5) LOCATION PERMISSION
   ****************************************/
  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        setLocationPermission(true);
        fetchCurrentLocation();
      } else {
        setLocationPermission(false);
        showErrorModal(
          "Permission Denied",
          "Location permission is required to use this feature. Please enable it in settings."
        );
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
   * 6) FETCH DELIVERY ZONES
   ****************************************/
  const fetchDeliveryZones = async () => {
    try {
      const snapshot = await firestore().collection("delivery_zones").get();
      const zones: DeliveryZone[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as DeliveryZone[];
      setDeliveryZones(zones);
    } catch (err) {
      console.error("Error fetching delivery zones:", err);
      showErrorModal("Error", "We are overloaded!! Please try after some time!");
    }
  };

  /****************************************
   * 7) PLACE AUTOCOMPLETE
   ****************************************/
  const fetchPlaceSuggestions = async () => {
    setIsLoading(true);
    try {
      // Prepend "Himachal Pradesh, " to the user's query
      const queryWithRegion = `Himachal Pradesh, ${placeQuery}`;
      const resp = await axios.get("https://maps.googleapis.com/maps/api/place/autocomplete/json", {
        params: {
          input: queryWithRegion,
          key: GOOGLE_PLACES_API_KEY,
          // Bias the search toward Himachal Pradesh
          location: "31.1048,77.1734",
          radius: 50000,
          components: "country:in",
        },
      });

      if (resp.data.status === "OK") {
        // Filter predictions to include only those from Himachal Pradesh
        const filteredResults = resp.data.predictions.filter((prediction: PlaceDetails) =>
          prediction.description.toLowerCase().includes("himachal")
        );
        setAutocompleteResults(filteredResults);
      } else if (resp.data.status === "ZERO_RESULTS") {
        // No results found: clear autocomplete results without showing an error
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
      const detailsResp = await axios.get("https://maps.googleapis.com/maps/api/place/details/json", {
        params: {
          place_id: place.place_id,
          key: GOOGLE_PLACES_API_KEY,
          fields: "geometry,formatted_address",
        },
      });

      if (detailsResp.data.status === "OK") {
        const { lat, lng } = detailsResp.data.result.geometry.location;
        const newAddress = detailsResp.data.result.formatted_address;

        mapRef.current?.animateToRegion(
          { latitude: lat, longitude: lng, latitudeDelta: 0.005, longitudeDelta: 0.005 },
          1000
        );
        setMarkerCoord({ latitude: lat, longitude: lng });
        setAddress(newAddress);
        // Update the search textbox with the selected address
        setPlaceQuery(newAddress);
        // Close the dropdown by clearing autocomplete results
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

  /****************************************
   * 8) FETCH CURRENT LOCATION
   ****************************************/
  const fetchCurrentLocation = async () => {
    setIsLoading(true);
    try {
      const currentLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
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
   * 9) CONFIRM LOCATION
   ****************************************/
  const confirmLocation = async () => {
    setIsLoading(true);
    try {
      // Reverse geocode
      const revGeoResp = await Location.reverseGeocodeAsync({
        latitude: markerCoord.latitude,
        longitude: markerCoord.longitude,
      });

      if (revGeoResp.length === 0) {
        showErrorModal("Error", "Failed to retrieve address for the selected location.");
        return;
      }

      const formattedAddress = `${revGeoResp[0].name || ""}, ${revGeoResp[0].city || ""}`;
      const newLocationData: LocationData = {
        lat: markerCoord.latitude,
        lng: markerCoord.longitude,
        address: formattedAddress,
      };

      // Check deliverability
      const destinations = deliveryZones.map((z) => `${z.latitude},${z.longitude}`).join("|");

      const distResp = await axios.get("https://maps.googleapis.com/maps/api/distancematrix/json", {
        params: {
          origins: `${newLocationData.lat},${newLocationData.lng}`,
          destinations,
          key: GOOGLE_PLACES_API_KEY,
          units: "metric",
        },
      });

      if (distResp.data.status !== "OK") {
        console.warn("Distance Matrix API Error:", distResp.data.status);
        showErrorModal("Error", "Failed to calculate distances.");
        return;
      }

      const elements = distResp.data.rows[0].elements;
      const isDeliverable = elements.some((el: any, index: number) => {
        if (el.status === "OK") {
          const km = el.distance.value / 1000;
          return km <= deliveryZones[index].radius;
        }
        return false;
      });

      if (!isDeliverable) {
        showErrorModal(
          "Delivery Unavailable",
          "Oops! We're not in your area yet. Please select a different location."
        );
        return;
      }

      // If from Cart, show bottom sheet to ALWAYS save
      if (fromScreen === "Cart") {
        // we open the SaveForm now
        updateLocation(newLocationData); // update context with the raw address
        setHouseNo(""); // reset form
        setPlaceLabel(""); // reset form
        setShowSaveForm(true);
      } else {
        // fromCategory or anything else
        // update context right away, no saving
        updateLocation(newLocationData);
        navigation.navigate("Categories", { selectedLocation: newLocationData });
      }
    } catch (err) {
      console.error("Error checking delivery availability:", err);
      showErrorModal("Error", "Failed to check delivery availability.");
    } finally {
      setIsLoading(false);
    }
  };

  /****************************************
   * 10) SAVE LOCATION (FIRESTORE)
   ****************************************/
  const saveLocationForUser = async (loc: LocationData, houseNoVal: string, labelVal: string) => {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) {
        console.warn("No user is logged in");
        return;
      }

      const userDocRef = firestore().collection("users").doc(currentUser.uid);

      // Instead of FieldValue.serverTimestamp(), we must use firestore.Timestamp.now()
      await userDocRef.update({
        locations: firestore.FieldValue.arrayUnion({
          lat: loc.lat,
          lng: loc.lng,
          address: loc.address,
          houseNo: houseNoVal,
          placeLabel: labelVal,
          createdAt: firestore.Timestamp.now(), // fix the serverTimestamp error
        }),
      });
      console.log("Location saved successfully.");
    } catch (err) {
      console.error("Error saving location:", err);
      Alert.alert("Error", "Could not save your location. Please try again later.");
    }
  };

  /****************************************
   * 11) ERROR MODAL
   ****************************************/
  const showErrorModal = (_title: string, message: string) => {
    setErrorMessage(message);
    setIsErrorModalVisible(true);
  };
  const closeErrorModal = () => setIsErrorModalVisible(false);

  /****************************************
   * 12) HANDLE "USE CURRENT LOCATION"
   ****************************************/
  const handleUseCurrentLocation = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") {
        const { status: newStatus } = await Location.requestForegroundPermissionsAsync();
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
   * 13) ON SAVE FORM
   ****************************************/
  const handleSaveLocationForm = async () => {
    if (!houseNo.trim() || !placeLabel.trim()) {
      Alert.alert("Required", "Please fill both House No and Name of Place.");
      return;
    }

    setIsLoading(true);
    try {
      // The context's location should already have lat/lng/address
      const newLoc = {
        lat: location.lat!,
        lng: location.lng!,
        address: location.address,
        houseNo,           
        placeLabel
      };

      // 1) Save in Firestore with houseNo & placeLabel
      await saveLocationForUser(newLoc, houseNo, placeLabel);

      // 2) Optionally update local context with new name of place or house no if you want
      // e.g. updateLocation({ ...newLoc, address: `${houseNo}, ${placeLabel}` });

      // 3) Navigate to Categories
      setShowSaveForm(false);
      if (fromScreen === "Cart") {
        navigation.navigate("CartFlow", {
          screen: "CartHome",
          params: { selectedLocation: newLoc },
        });           
      } else {
        navigation.navigate("Categories", { selectedLocation: newLoc });
      }   
    } catch (err) {
      console.error("Error in handleSaveLocationForm:", err);
    } finally {
      setIsLoading(false);
    }
  };

  /****************************************
   * 14) RENDER
   ****************************************/
  return (
    <View style={styles.container}>
      {/* Loader Overlay */}
      {isLoading && (
        <View style={styles.loaderOverlay}>
          <ActivityIndicator size="large" color="#000" />
        </View>
      )}

      {/* Error Modal */}
      <ErrorModal visible={isErrorModalVisible} message={errorMessage} onClose={closeErrorModal} />

      {/* Search Container */}
      <View style={styles.searchContainer}>
        <TextInput
          placeholder="Search or enter your location"
          style={styles.searchInput}
          value={placeQuery}
          onChangeText={setPlaceQuery}
        />

        {/* "Use Current Location" Button */}
        <TouchableOpacity style={styles.useCurrentLocationButton} onPress={handleUseCurrentLocation}>
          <Text style={styles.useCurrentLocationText}>Use Current Location</Text>
        </TouchableOpacity>

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

        {/* Permission Handling */}
        {!locationPermission && (
          <TouchableOpacity style={styles.enableLocationButton} onPress={openAppSettings}>
            <Text style={styles.enableLocationText}>Enable Location Permission</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Map Section */}
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
        {/* Fixed Marker */}
        <View pointerEvents="none" style={styles.markerFixed}>
          <Image
            style={styles.marker}
            source={{
              uri: "https://img.icons8.com/color/96/000000/map-pin.png",
            }}
          />
        </View>
      </View>

      {/* Footer with Confirm Button */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.confirmButton} onPress={confirmLocation}>
          <Text style={styles.confirmButtonText}>Confirm Location</Text>
        </TouchableOpacity>
      </View>

      {/* BOTTOM SHEET for House No + Place Label (only if from Cart) */}
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

            <TouchableOpacity style={styles.saveLocationButton} onPress={handleSaveLocationForm}>
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
  );
};

export default LocationSelectorScreen;

/****************************************
 *          STYLES
 ****************************************/
const styles = StyleSheet.create({
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
  searchInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: "#f9f9f9",
    color: "#333",
  },
  useCurrentLocationButton: {
    marginTop: 10,
    backgroundColor: "#4CAF50", // green
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  useCurrentLocationText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  autocompleteContainer: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 10,
    maxHeight: 160,
    backgroundColor: "#fff",
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
  /* BOTTOM SHEET STYLES */
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
