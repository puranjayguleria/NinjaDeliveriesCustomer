// PickupLocationScreen.tsx

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Alert,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  FlatList,
  Modal,
  Image,
  Dimensions,
  Keyboard,
  Platform,
  TouchableWithoutFeedback,
} from "react-native";
import MapView, { Region } from "react-native-maps";
import * as Location from "expo-location";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import firestore from "@react-native-firebase/firestore";
import { useCustomer } from "../context/CustomerContext";
import { debounce } from "lodash";
import { GOOGLE_PLACES_API_KEY } from "@env"; // Ensure this is correctly set up
import Loader from "@/components/VideoLoader";

const screenWidth = Dimensions.get("window").width;
const screenHeight = Dimensions.get("window").height;

// TypeScript Interfaces
interface SavedLocation {
  name: string;
  coords: {
    latitude: number;
    longitude: number;
  };
  buildingName?: string;
}

interface PlacePrediction {
  description: string;
  place_id: string;
}

const PickupLocationScreen: React.FC = () => {
  // State Variables
  const [region, setRegion] = useState<Region | null>(null);
  const [initialRegion, setInitialRegion] = useState<Region | null>(null);
  const [buildingName, setBuildingName] = useState<string>("");
  const [hasPanned, setHasPanned] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [placeQuery, setPlaceQuery] = useState<string>("");
  const [places, setPlaces] = useState<PlacePrediction[]>([]);
  const [showSavedLocationsModal, setShowSavedLocationsModal] =
    useState<boolean>(false);
  const [showSaveModal, setShowSaveModal] = useState<boolean>(false);
  const [locationName, setLocationName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loadingPlaces, setLoadingPlaces] = useState<boolean>(false);
  const [hasSelectedPlace, setHasSelectedPlace] = useState<boolean>(false); // New State Variable

  const navigation = useNavigation();
  const { customerId } = useCustomer();

  // Fetch User Location
  useEffect(() => {
    const fetchUserLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Permission Denied",
            "Location permission is required to fetch your current location."
          );
          setLoading(false);
          return;
        }
        const location = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = location.coords;
        const initial: Region = {
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };
        setRegion(initial);
        setInitialRegion(initial);
      } catch (err) {
        console.error("Error fetching location:", err);
        Alert.alert("Error", "Failed to fetch your current location.");
      } finally {
        setLoading(false);
      }
    };

    fetchUserLocation();
  }, []);

  // Fetch Saved Locations when Screen is Focused
  useFocusEffect(
    useCallback(() => {
      const fetchSavedLocations = async () => {
        try {
          if (customerId) {
            const userDoc = await firestore()
              .collection("users")
              .doc(customerId)
              .get();
            const userData = userDoc.data();
            if (userData && userData.savedLocations) {
              setSavedLocations(userData.savedLocations);
            } else {
              setSavedLocations([]);
            }
          }
        } catch (err) {
          console.error("Error fetching saved locations:", err);
          setError("Failed to load saved locations.");
        }
      };

      fetchSavedLocations();
      return () => {
        setShowSavedLocationsModal(false);
      };
    }, [customerId])
  );

  // Fetch Places from Google Places API
  const fetchPlaces = async (query: string) => {
    if (!query.trim()) {
      setPlaces([]);
      return;
    }

    setLoadingPlaces(true);
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
          query
        )}&key=${GOOGLE_PLACES_API_KEY}&components=country:in&location=31.1048,77.1734&radius=200000&bounds=30.3753,75.5703|33.0425,79.0734`
      );

      const data = await response.json();
      if (data.status === "OK") {
        setPlaces(data.predictions);
      } else {
        console.error("Error fetching places:", data.status);
        setError("Failed to fetch place suggestions.");
        setPlaces([]);
      }
    } catch (err) {
      console.error("Error fetching places:", err);
      setError("An unexpected error occurred while fetching places.");
      setPlaces([]);
    } finally {
      setLoadingPlaces(false);
    }
  };

  // Debounced Fetch Places
  const debouncedFetchPlaces = useCallback(
    debounce((query: string) => {
      fetchPlaces(query);
    }, 500),
    []
  );

  // Handle Search Input Change
  const handlePlaceQueryChange = (query: string) => {
    setPlaceQuery(query);
    debouncedFetchPlaces(query);
    setHasSelectedPlace(false); // Reset when user starts typing
  };

  // Handle Region Change Complete
  const handleRegionChangeComplete = (newRegion: Region) => {
    setRegion(newRegion);
    setHasPanned(true);
  };

  // Handle Place Selection
  const handlePlaceSelect = async (placeId: string) => {
    Keyboard.dismiss();
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${GOOGLE_PLACES_API_KEY}`
      );
      const data = await response.json();
      if (data.status === "OK") {
        const { lat, lng } = data.result.geometry.location;
        const newRegion: Region = {
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };
        setRegion(newRegion);
        setPlaces([]);
        setPlaceQuery(data.result.formatted_address || data.result.name || "");
        setHasPanned(true);
        setHasSelectedPlace(true); // Set to true when a place is selected
      } else {
        console.error("Error fetching place details:", data.status);
        setError("Failed to fetch place details.");
      }
    } catch (err) {
      console.error("Error fetching place details:", err);
      setError("An unexpected error occurred while fetching place details.");
    }
  };

  // Handle Confirm Location
  const handleConfirmLocation = () => {
    if (!region) {
      Alert.alert("Error", "Unable to retrieve location. Please try again.");
      return;
    }

    if (!hasPanned) {
      Alert.alert(
        "Location Required",
        "Please move the map to pinpoint your pickup location."
      );
      return;
    }

    if (!buildingName.trim()) {
      Alert.alert("Building Name Required", "Please enter a building name.");
      return;
    }

    setShowSaveModal(true);
  };

  // Handle Save Location
  const handleSaveLocation = async () => {
    if (!locationName.trim()) {
      Alert.alert("Error", "Please provide a name for the location.");
      return;
    }

    try {
      if (customerId && region) {
        const newLocation: SavedLocation = {
          name: locationName,
          coords: {
            latitude: region.latitude,
            longitude: region.longitude,
          },
          buildingName: buildingName.trim(),
        };
        await firestore()
          .collection("users")
          .doc(customerId)
          .update({
            savedLocations: firestore.FieldValue.arrayUnion(newLocation),
          });
        Alert.alert("Success", "Location saved successfully.");
        setLocationName("");
      }
    } catch (err) {
      console.error("Error saving location:", err);
      Alert.alert("Error", "Failed to save location.");
    }
    setShowSaveModal(false);
    navigateToDropoff();
  };

  // Navigate to Dropoff Location Screen
  const navigateToDropoff = () => {
    if (region) {
      navigation.navigate("DropoffLocation", {
        pickupCoords: region,
        pickupDetails: { buildingName: buildingName.trim() },
      });
    } else {
      Alert.alert("Error", "Unable to retrieve location. Please try again.");
    }
  };

  // Handle Select Saved Location
  const handleSelectSavedLocation = (location: SavedLocation) => {
    setRegion({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
    setBuildingName(location.buildingName || "");
    setHasPanned(true);
    setShowSavedLocationsModal(false);

    navigation.navigate("DropoffLocation", {
      pickupCoords: location.coords,
      pickupDetails: { buildingName: location.buildingName || "" },
    });
  };

  // Handle Skip Saving Location
  const handleSkipSave = () => {
    setShowSaveModal(false);
    navigateToDropoff();
  };

  // Render Place Item
  const renderPlaceItem = ({ item }: { item: PlacePrediction }) => (
    <TouchableOpacity
      onPress={() => handlePlaceSelect(item.place_id)}
      style={styles.placeItem}
      accessible={true}
      accessibilityLabel={`Select place ${item.description}`}
    >
      <Text style={styles.placeText}>{item.description}</Text>
    </TouchableOpacity>
  );

  // Render Saved Location Item
  const renderSavedLocationItem = ({ item }: { item: SavedLocation }) => (
    <TouchableOpacity
      style={styles.locationCard}
      onPress={() => handleSelectSavedLocation(item)}
      accessible={true}
      accessibilityLabel={`Select saved location ${item.name}`}
    >
      <Text style={styles.locationName}>{item.name}</Text>
      <Text style={styles.locationDetails}>{item.buildingName}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Loader />
        <Text style={styles.loadingText}>
          Fetching your current location...
        </Text>
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        {/* Title and Search Input Container */}
        <View style={styles.headerContainer}>
          {/* Common Opaque Background */}
          <View style={styles.headerBackground}>
            {/* Title */}
            <Text style={styles.title}>Select Pickup Location</Text>

            {/* Search Input */}
            <TextInput
              placeholder="Search nearby places in Himachal"
              style={styles.searchInput}
              value={placeQuery}
              onChangeText={handlePlaceQueryChange}
              accessible={true}
              accessibilityLabel="Search for places"
            />

            {/* Search Results Dropdown */}
            {loadingPlaces && <Loader />}
            {placeQuery.trim() && places.length > 0 && (
              <FlatList
                data={places}
                keyExtractor={(item) => item.place_id}
                renderItem={renderPlaceItem}
                style={styles.placesList}
                keyboardShouldPersistTaps="handled"
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                windowSize={21}
              />
            )}
            {placeQuery.trim() &&
              !loadingPlaces &&
              places.length === 0 &&
              !hasSelectedPlace && (
                <Text style={styles.noResultsText}>No places found.</Text>
              )}
            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>
        </View>

        {/* Map View */}
        <MapView
          style={styles.map}
          initialRegion={initialRegion}
          region={region}
          onRegionChangeComplete={handleRegionChangeComplete}
          showsUserLocation={true}
          showsMyLocationButton={false}
        />
        <View style={styles.markerFixed}>
          <Image
            source={require("../assets/pickup-marker.png")}
            style={styles.marker}
          />
        </View>

        {/* Building Name Input and Buttons */}
        <View style={styles.formContainer}>
          <TextInput
            placeholder="Building Name"
            style={styles.input}
            value={buildingName}
            onChangeText={setBuildingName}
            accessible={true}
            accessibilityLabel="Enter building name"
          />

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.savedLocationsButton]}
              onPress={() => setShowSavedLocationsModal(true)}
              accessible={true}
              accessibilityLabel="View saved locations"
            >
              <Text style={styles.buttonText}>Saved Locations</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.confirmButton]}
              onPress={handleConfirmLocation}
              accessible={true}
              accessibilityLabel="Confirm pickup location"
            >
              <Text style={styles.buttonText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Save Location Modal */}
        <Modal visible={showSaveModal} animationType="slide" transparent>
          <View style={styles.modalContainer}>
            <View style={styles.saveLocationModal}>
              <Text style={styles.modalText}>Save this location?</Text>
              <TextInput
                placeholder="Enter location name"
                style={styles.input}
                value={locationName}
                onChangeText={setLocationName}
                accessible={true}
                accessibilityLabel="Enter name for the location"
              />
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.confirmButton]}
                  onPress={handleSaveLocation}
                  accessible={true}
                  accessibilityLabel="Save location"
                >
                  <Text style={styles.buttonText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.savedLocationsButton]}
                  onPress={handleSkipSave}
                  accessible={true}
                  accessibilityLabel="Skip saving location"
                >
                  <Text style={styles.buttonText}>Skip</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Saved Locations Modal */}
        <Modal
          visible={showSavedLocationsModal}
          animationType="slide"
          transparent
        >
          <View style={styles.modalContainer}>
            <View style={styles.savedLocationsModal}>
              <TouchableOpacity
                style={styles.crossButton}
                onPress={() => setShowSavedLocationsModal(false)}
                accessible={true}
                accessibilityLabel="Close saved locations modal"
              >
                <Text style={styles.crossText}>×</Text>
              </TouchableOpacity>

              <Text style={styles.modalText}>Saved Locations</Text>
              {savedLocations.length > 0 ? (
                <FlatList
                  data={savedLocations}
                  keyExtractor={(item, index) => index.toString()}
                  renderItem={renderSavedLocationItem}
                  contentContainerStyle={styles.savedLocationsList}
                  initialNumToRender={10}
                  maxToRenderPerBatch={10}
                  windowSize={21}
                />
              ) : (
                <Text style={styles.noResultsText}>
                  No saved locations found.
                </Text>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </TouchableWithoutFeedback>
  );
};

// Styles
const styles = StyleSheet.create({
  container: { flex: 1 },
  headerContainer: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 40, // Adjust for status bar
    left: 10,
    right: 10,
    zIndex: 2,
  },
  headerBackground: {
    backgroundColor: "rgba(255, 255, 255, 0.95)", // Opaque background
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    elevation: 3, // For Android shadow
    shadowColor: "#000", // For iOS shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333", // Dark text for better contrast
    textAlign: "center",
    marginBottom: 10,
  },
  searchInput: {
    backgroundColor: "#fff",
    borderRadius: 5,
    paddingVertical: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    borderColor: "#ddd",
    borderWidth: 1,
  },
  map: { flex: 1 },
  markerFixed: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -24, // Half of marker width
    marginTop: -48, // Half of marker height
    zIndex: 1,
  },
  marker: { width: 48, height: 48 },
  placesList: {
    backgroundColor: "#fff",
    borderRadius: 5,
    maxHeight: 200,
    marginTop: 5,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  placeItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: "#ddd" },
  placeText: { fontSize: 16, color: "#333" },
  formContainer: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    padding: 20,
    backgroundColor: "#f9f9f9",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    marginHorizontal: 5,
    borderRadius: 5,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  confirmButton: { backgroundColor: "#00C853" },
  savedLocationsButton: { backgroundColor: "#4A90E2" },
  input: {
    backgroundColor: "#fff",
    borderRadius: 5,
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginBottom: 10,
    fontSize: 16,
    borderColor: "#ddd",
    borderWidth: 1,
    width: "100%",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  saveLocationModal: {
    width: "80%",
    padding: 20,
    backgroundColor: "#fff",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  savedLocationsModal: {
    width: "100%",
    height: screenHeight * 0.5,
    backgroundColor: "#fff",
    paddingTop: 40,
    paddingHorizontal: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    alignItems: "center",
    justifyContent: "flex-start",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  crossButton: {
    position: "absolute",
    top: 10,
    right: 20,
    backgroundColor: "red",
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  crossText: {
    fontSize: 18,
    color: "white",
    fontWeight: "bold",
  },
  modalText: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },
  locationCard: {
    width: screenWidth * 0.85,
    backgroundColor: "#f9f9f9",
    padding: 15,
    marginVertical: 5,
    borderRadius: 8,
    alignSelf: "center",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  locationName: {
    fontWeight: "bold",
    fontSize: 16,
  },
  locationDetails: {
    fontSize: 14,
    color: "#555",
    marginTop: 5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: { marginTop: 10, fontSize: 16 },
  loadingPlaces: {
    position: "absolute",
    top: Platform.OS === "ios" ? 120 : 100, // Adjust based on header position
    left: "50%",
    marginLeft: -10,
    zIndex: 3,
  },
  noResultsText: {
    textAlign: "center",
    marginTop: 10,
    color: "#555",
    fontSize: 16,
  },
  errorText: {
    textAlign: "center",
    marginTop: 10,
    color: "red",
    fontSize: 14,
  },
  savedLocationsList: {
    width: "100%",
    paddingBottom: 10,
  },
});

export default PickupLocationScreen;
