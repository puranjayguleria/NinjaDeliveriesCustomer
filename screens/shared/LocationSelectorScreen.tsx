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
import { RouteProp, CommonActions } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList, LocationData } from "../../types/navigation";
import { GOOGLE_PLACES_API_KEY } from "@env";
import ErrorModal from "../../components/ErrorModal";
import { useLocationContext } from "../../context/LocationContext"; // location context hook
import { fetchLocationFlags } from "../../utils/fetchLocationFlags";
import { useCart } from "../../context/CartContext";
import { useServiceCart } from "../../context/ServiceCartContext";
import Loader from "@/components/VideoLoader";

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
  const { cart } = useCart();
  const serviceCart = useServiceCart();
  const mapRef = useRef<MapView>(null);

  const fromScreenRaw = (route.params as any)?.fromScreen;
  const fromScreen = (typeof fromScreenRaw === "string" ? fromScreenRaw : String(fromScreenRaw ?? "Category")) || "Category";
  const fromScreenKey = fromScreen.trim().toLowerCase();

  const resetToServicesHome = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [
          {
            name: "AppTabs" as any,
            state: {
              index: 0,
              routes: [
                {
                  name: "CategoriesTab",
                  state: {
                    index: 0,
                    routes: [{ name: "ServicesHome" }],
                  },
                },
              ],
            },
          },
        ],
      })
    );
  };

  const wasOpenedFromServicesTab = () => {
    try {
      const state: any = navigation.getState?.();
      const prevRoute = state?.routes?.[typeof state?.index === "number" ? state.index - 1 : -1];
      if (!prevRoute || prevRoute.name !== "AppTabs") return false;

      const tabsState: any = prevRoute?.state;
      const tabIndex = typeof tabsState?.index === "number" ? tabsState.index : -1;
      const activeTab = tabsState?.routes?.[tabIndex]?.name;
      return activeTab === "CategoriesTab";
    } catch {
      return false;
    }
  };

  const returnToServices = () => {
    // If user opened LocationSelector while already on Services tab,
    // just go back so they land exactly where they were.
    if (wasOpenedFromServicesTab() && navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    // If they tried to enter Services but were blocked (e.g. non-deliverable),
    // force-switch to Services tab after a deliverable location is chosen.
    resetToServicesHome();
  };

  /**
   * Check if all carts are empty
   */
  const isAllCartsEmpty = () => {
    const groceryItemsCount = Object.keys(cart).length;
    const serviceItemsCount = serviceCart.totalItems;
    return groceryItemsCount === 0 && serviceItemsCount === 0;
  };

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
  const [autocompleteResults, setAutocompleteResults] = useState<
    PlaceDetails[]
  >([]);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);

  // Error Modal
  const [isErrorModalVisible, setIsErrorModalVisible] =
    useState<boolean>(false);
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
        const filteredResults = resp.data.predictions.filter(
          (p: PlaceDetails) => p.description.toLowerCase().includes("himachal")
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
        const places = await Location.reverseGeocodeAsync({
          latitude,
          longitude,
        });
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

      // Fetch location flags from Firestore
      const flags = await fetchLocationFlags(nearest.storeId);
      
      updateLocation({
        ...newLocationData,
        ...flags,
      });

      if (fromScreenKey === "cart") {
        const allCartsEmpty = isAllCartsEmpty();
        
        if (allCartsEmpty) {
          // If cart is empty, navigate to home screen instead of cart
          navigation.navigate("AppTabs", { screen: "HomeTab" });
        } else {
          // If cart has items, collect delivery details
          setHouseNo("");
          setPlaceLabel("");
          setShowSaveForm(true);
        }
      } else if (fromScreenKey === "food") {
        // Navigate back to food screen - location context is already updated
        navigation.goBack();
      } else if (fromScreenKey === "foodcheckout") {
        // Navigate back to food checkout screen - location context is already updated
        navigation.goBack();
      } else if (fromScreenKey === "servicecheckout") {
        // Navigate back to checkout screen
        navigation.goBack();
      } else if (fromScreenKey === "services") {
        // User came here by tapping Services tab while not deliverable.
        // After choosing a deliverable location, take them to Services.
        returnToServices();
      } else {
        navigation.navigate("AppTabs", { screen: "HomeTab" });
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
      Alert.alert(
        "Error",
        "Could not save your location. Please try again later."
      );
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
      if (fromScreenKey === "cart") {
        navigation.navigate("AppTabs", {
          screen: "CartFlow",
          params: {
            screen: "CartHome",
            params: { selectedLocation: newLoc },
          },
        });
      } else if (fromScreenKey === "servicecheckout") {
        // Navigate back to checkout screen
        navigation.goBack();
      } else if (fromScreenKey === "services") {
        returnToServices();
      } else {
        navigation.navigate("AppTabs", {
          screen: "CategoriesTab",
          params: { selectedLocation: newLoc },
        });
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
    <View style={styles.container}>
      {/* LOADER OVERLAY */}
      {isLoading && (
        <View style={styles.loaderOverlay}>
          <Loader />
        </View>
      )}

      {/* ERROR MODAL */}
      <ErrorModal
        visible={isErrorModalVisible}
        message={errorMessage}
        onClose={closeErrorModal}
      />

      {/* MAP - Full Screen Background */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        initialRegion={DEFAULT_REGION}
        showsPointsOfInterest={false}
        showsTraffic={false}
        showsCompass={false}
        showsMyLocationButton={false}
        onRegionChangeComplete={(newRegion) => {
          setMarkerCoord({
            latitude: newRegion.latitude,
            longitude: newRegion.longitude,
          });
        }}
      />

      {/* Center Pin Marker */}
      <View pointerEvents="none" style={styles.centerMarker}>
        <View style={styles.pinWrapper}>
          <View style={styles.pinCircle}>
            <View style={styles.pinInner} />
          </View>
          <View style={styles.pinShadow} />
        </View>
      </View>

      {/* TOP SECTION */}
      <SafeAreaView style={styles.topSection}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={22} color="#000" />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Choose Location</Text>
          </View>
          <View style={styles.backBtn} />
        </View>

        {/* Search Bar */}
        <View style={styles.searchWrapper}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={20} color="#8E8E93" />
            <TextInput
              style={styles.searchInput}
              value={placeQuery}
              onChangeText={setPlaceQuery}
              placeholder="Search area, street..."
              placeholderTextColor="#C7C7CC"
              returnKeyType="search"
            />
            {placeQuery.length > 0 && (
              <TouchableOpacity 
                onPress={() => {
                  setPlaceQuery("");
                  setAutocompleteResults([]);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={18} color="#C7C7CC" />
              </TouchableOpacity>
            )}
          </View>

          {/* Autocomplete Results */}
          {autocompleteResults.length > 0 && (
            <View style={styles.resultsContainer}>
              <FlatList
                data={autocompleteResults}
                keyExtractor={(item) => item.place_id}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => handlePlaceSelection(item)}
                    style={styles.resultItem}
                    activeOpacity={0.7}
                  >
                    <View style={styles.resultIcon}>
                      <Ionicons name="location-outline" size={18} color="#8E8E93" />
                    </View>
                    <View style={styles.resultText}>
                      <Text style={styles.resultMain} numberOfLines={1}>
                        {item.structured_formatting.main_text}
                      </Text>
                      <Text style={styles.resultSecondary} numberOfLines={1}>
                        {item.structured_formatting.secondary_text}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}
        </View>

        {/* Current Location Button */}
        <TouchableOpacity
          style={styles.currentLocBtn}
          onPress={handleUseCurrentLocation}
          activeOpacity={0.8}
        >
          <View style={styles.currentLocContent}>
            <Ionicons name="navigate-circle" size={22} color="#007AFF" />
            <Text style={styles.currentLocText}>Use my current location</Text>
          </View>
        </TouchableOpacity>

        {/* Permission Warning */}
        {!locationPermission && (
          <TouchableOpacity 
            style={styles.permissionBanner}
            onPress={openAppSettings}
            activeOpacity={0.8}
          >
            <Ionicons name="alert-circle" size={20} color="#FF9500" />
            <Text style={styles.permissionText}>Enable location access</Text>
            <Ionicons name="chevron-forward" size={18} color="#FF9500" />
          </TouchableOpacity>
        )}
      </SafeAreaView>

      {/* BOTTOM SECTION */}
      <View style={styles.bottomSection}>
        <View style={styles.addressCard}>
          <View style={styles.addressHeader}>
            <View style={styles.addressIconContainer}>
              <Ionicons name="location" size={20} color="#007AFF" />
            </View>
            <View style={styles.addressContent}>
              <Text style={styles.addressLabel}>Selected Location</Text>
              <Text style={styles.addressValue} numberOfLines={2}>
                {address}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={confirmLocation}
            activeOpacity={0.8}
          >
            <Text style={styles.confirmBtnText}>Confirm Location</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* SAVE LOCATION MODAL */}
      <Modal 
        visible={showSaveForm} 
        animationType="slide" 
        transparent
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowSaveForm(false)}
          />
          
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalContent}
          >
            <View style={styles.sheetContainer}>
              {/* Handle */}
              <View style={styles.sheetHandle} />
              
              {/* Header */}
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Add Address Details</Text>
                <Text style={styles.sheetSubtitle}>
                  Help us deliver to your doorstep
                </Text>
              </View>

              {/* Form */}
              <View style={styles.form}>
                {/* House Number Input */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>House / Flat / Floor</Text>
                  <View style={styles.inputContainer}>
                    <View style={styles.inputIconContainer}>
                      <Ionicons name="home-outline" size={18} color="#8E8E93" />
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g., 301, Tower A"
                      placeholderTextColor="#C7C7CC"
                      value={houseNo}
                      onChangeText={setHouseNo}
                    />
                  </View>
                </View>

                {/* Label Selection */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Save as</Text>
                  <View style={styles.chipContainer}>
                    {["Home", "Work", "Other"].map((label) => (
                      <TouchableOpacity
                        key={label}
                        style={[
                          styles.chip,
                          placeLabel === label && styles.chipActive
                        ]}
                        onPress={() => setPlaceLabel(label)}
                        activeOpacity={0.7}
                      >
                        <Ionicons 
                          name={
                            label === "Home" ? "home" : 
                            label === "Work" ? "briefcase" : 
                            "location"
                          } 
                          size={16} 
                          color={placeLabel === label ? "#007AFF" : "#8E8E93"} 
                        />
                        <Text style={[
                          styles.chipText,
                          placeLabel === label && styles.chipTextActive
                        ]}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Custom Label Input */}
                  {placeLabel === "Other" && (
                    <View style={[styles.inputContainer, { marginTop: 12 }]}>
                      <View style={styles.inputIconContainer}>
                        <Ionicons name="create-outline" size={18} color="#8E8E93" />
                      </View>
                      <TextInput
                        style={styles.input}
                        placeholder="Enter custom name"
                        placeholderTextColor="#C7C7CC"
                        value={placeLabel === "Other" ? "" : placeLabel}
                        onChangeText={setPlaceLabel}
                      />
                    </View>
                  )}
                </View>

                {/* Action Buttons */}
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={handleSaveLocationForm}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryBtnText}>Save & Continue</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => setShowSaveForm(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.secondaryBtnText}>Skip for now</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
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
    backgroundColor: "#F2F2F7",
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },

  /*****************************************
   * CENTER PIN MARKER
   *****************************************/
  centerMarker: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -18,
    marginTop: -36,
    zIndex: 1,
  },
  pinWrapper: {
    alignItems: "center",
  },
  pinCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  pinInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#fff",
  },
  pinShadow: {
    width: 20,
    height: 6,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.2)",
    marginTop: 2,
  },

  /*****************************************
   * TOP SECTION
   *****************************************/
  topSection: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  headerTextContainer: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000",
    letterSpacing: -0.4,
  },

  /*****************************************
   * SEARCH BAR
   *****************************************/
  searchWrapper: {
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#000",
    padding: 0,
  },

  /*****************************************
   * AUTOCOMPLETE RESULTS
   *****************************************/
  resultsContainer: {
    marginTop: 8,
    backgroundColor: "#fff",
    borderRadius: 12,
    maxHeight: 220,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    overflow: "hidden",
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5EA",
  },
  resultIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F2F2F7",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  resultText: {
    flex: 1,
  },
  resultMain: {
    fontSize: 15,
    fontWeight: "500",
    color: "#000",
    marginBottom: 2,
  },
  resultSecondary: {
    fontSize: 13,
    color: "#8E8E93",
  },

  /*****************************************
   * CURRENT LOCATION BUTTON
   *****************************************/
  currentLocBtn: {
    backgroundColor: "#fff",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  currentLocContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    gap: 8,
  },
  currentLocText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#007AFF",
  },

  /*****************************************
   * PERMISSION BANNER
   *****************************************/
  permissionBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF9E6",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: "#FFE5B4",
  },
  permissionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: "#B87503",
  },

  /*****************************************
   * BOTTOM SECTION
   *****************************************/
  bottomSection: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
  },
  addressCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  addressHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
    gap: 12,
  },
  addressIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E8F4FF",
    justifyContent: "center",
    alignItems: "center",
  },
  addressContent: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#8E8E93",
    marginBottom: 4,
    letterSpacing: -0.1,
  },
  addressValue: {
    fontSize: 15,
    fontWeight: "500",
    color: "#000",
    lineHeight: 20,
  },
  confirmBtn: {
    backgroundColor: "#007AFF",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmBtnText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#fff",
    letterSpacing: -0.4,
  },

  /*****************************************
   * MODAL
   *****************************************/
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalContent: {
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
  },
  sheetHandle: {
    width: 36,
    height: 5,
    backgroundColor: "#D1D1D6",
    borderRadius: 3,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  sheetHeader: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  sheetTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#000",
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  sheetSubtitle: {
    fontSize: 15,
    color: "#8E8E93",
    lineHeight: 20,
  },

  /*****************************************
   * FORM
   *****************************************/
  form: {
    paddingHorizontal: 24,
    gap: 24,
  },
  formGroup: {
    gap: 12,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000",
    letterSpacing: -0.2,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  inputIconContainer: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#000",
    padding: 0,
  },

  /*****************************************
   * CHIPS
   *****************************************/
  chipContainer: {
    flexDirection: "row",
    gap: 10,
  },
  chip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 6,
    borderWidth: 2,
    borderColor: "transparent",
  },
  chipActive: {
    backgroundColor: "#E8F4FF",
    borderColor: "#007AFF",
  },
  chipText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#8E8E93",
  },
  chipTextActive: {
    color: "#007AFF",
  },

  /*****************************************
   * BUTTONS
   *****************************************/
  primaryBtn: {
    backgroundColor: "#007AFF",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#fff",
    letterSpacing: -0.4,
  },
  secondaryBtn: {
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#8E8E93",
  },
});

