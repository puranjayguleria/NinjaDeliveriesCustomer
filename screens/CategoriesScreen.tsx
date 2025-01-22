// screens/CategoriesScreen.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  TextInput,
  Modal,
  Platform,
  Linking,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import * as Location from "expo-location";
import firestore from "@react-native-firebase/firestore";
import axios from "axios"; // Ensure axios is installed
import { useNavigation, useRoute, useIsFocused } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList, LocationData } from "../types/navigation";
import ErrorModal from "../components/ErrorModal"; // Ensure this component exists
import { GOOGLE_PLACES_API_KEY } from "@env"; // Ensure this is set up correctly

type CategoriesScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "Categories"
>;

type CategoriesScreenRouteProp = RouteProp<RootStackParamList, "Categories">;

type Props = {
  navigation: CategoriesScreenNavigationProp;
  route: CategoriesScreenRouteProp;
};

type DeliveryZone = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number; // in kilometers
};

const CategoriesScreen: React.FC<Props> = () => {
  const [categories, setCategories] = useState<Array<any>>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filteredCategories, setFilteredCategories] = useState<Array<any>>([]);
  const [isBottomSheetVisible, setIsBottomSheetVisible] = useState<boolean>(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState<boolean>(true);
  const [isCheckingDelivery, setIsCheckingDelivery] = useState<boolean>(false);

  // Store user's chosen lat/lng and address
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationAddress, setLocationAddress] = useState<string>("Select Location");

  // Delivery Zones
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);

  // Error Modal State
  const [isErrorModalVisible, setIsErrorModalVisible] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const navigation = useNavigation<CategoriesScreenNavigationProp>();
  const route = useRoute<CategoriesScreenRouteProp>();
  const isFocused = useIsFocused();

  /***************************
   * Fetch Categories on Mount
   ***************************/
  useEffect(() => {
    fetchCategories();
    fetchDeliveryZones();
    checkLocationPermission();
  }, []);

  /***************************
   * Handle Returned Location Data
   ***************************/
  useEffect(() => {
    if (isFocused && route.params?.selectedLocation) {
      const { lat, lng, address } = route.params.selectedLocation;
      setLatitude(lat);
      setLongitude(lng);
      setLocationAddress(address);
      // Clear the params to avoid repeated updates
      navigation.setParams({ selectedLocation: undefined });
      // After setting location, check delivery availability
      checkDeliveryAvailability(lat, lng);
    }
  }, [isFocused, route.params?.selectedLocation]);

  /***************************
   * Filter Categories
   ***************************/
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredCategories(categories);
    } else {
      const lowerQuery = searchQuery.toLowerCase();
      const filtered = categories.filter((category) =>
        category.name.toLowerCase().includes(lowerQuery)
      );
      setFilteredCategories(filtered);
    }
  }, [searchQuery, categories]);

  /***************************
   * Check Location Permission on Mount
   ***************************/
  const checkLocationPermission = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === Location.PermissionStatus.GRANTED) {
        // Permission already granted, fetch location
        fetchCurrentLocation();
      } else {
        // Permission not granted, show bottom sheet
        setIsBottomSheetVisible(true);
        setIsLoadingLocation(false);
      }
    } catch (error) {
      console.error("Error checking location permission:", error);
      setIsBottomSheetVisible(true);
      setIsLoadingLocation(false);
    }
  };

  /***************************
   * Fetch Categories
   ***************************/
  const fetchCategories = async () => {
    try {
      const categorySnapshot = await firestore().collection("categories").get();
      const categoryData = categorySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCategories(categoryData);
      setFilteredCategories(categoryData);
    } catch (error) {
      Alert.alert("Error", "Failed to fetch categories.");
    }
  };

  /***************************
   * Fetch Delivery Zones
   ***************************/
  const fetchDeliveryZones = async () => {
    try {
      const snapshot = await firestore().collection("delivery_zones").get();
      const zones: DeliveryZone[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as DeliveryZone[];
      setDeliveryZones(zones);
    } catch (error) {
      console.error("Error fetching delivery zones:", error);
      showErrorModal("Error", "We are overloaded!! Please try after some time!");
    }
  };

  /***************************
   * Fetch Current Location
   ***************************/
  const fetchCurrentLocation = async () => {
    try {
      setIsLoadingLocation(true);
      const currentLocation = await Location.getCurrentPositionAsync({});
      const address = await Location.reverseGeocodeAsync({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });

      const formattedAddress = `${address[0].name || ""}, ${address[0].city || ""}`;

      setLatitude(currentLocation.coords.latitude);
      setLongitude(currentLocation.coords.longitude);
      setLocationAddress(formattedAddress);

      // After setting location, check delivery availability
      checkDeliveryAvailability(
        currentLocation.coords.latitude,
        currentLocation.coords.longitude
      );
    } catch (error) {
      Alert.alert("Error", "Failed to fetch your location. Please try again.");
    } finally {
      setIsLoadingLocation(false);
    }
  };

  /***************************
   * Check Delivery Availability
   ***************************/
  const checkDeliveryAvailability = async (lat: number, lng: number) => {
    if (deliveryZones.length === 0) {
      // Delivery zones not loaded yet
      return;
    }

    setIsCheckingDelivery(true);

    try {
      // Prepare destinations as "lat,lng" strings
      const destinations = deliveryZones
        .map((zone) => `${zone.latitude},${zone.longitude}`)
        .join("|");

      const distanceResponse = await axios.get(
        "https://maps.googleapis.com/maps/api/distancematrix/json",
        {
          params: {
            origins: `${lat},${lng}`,
            destinations: destinations,
            key: GOOGLE_PLACES_API_KEY,
            units: "metric",
          },
        }
      );

      if (distanceResponse.data.status !== "OK") {
        console.warn("Distance Matrix API Error:", distanceResponse.data.status);
        showErrorModal("Error", "Failed to calculate delivery availability.");
        return;
      }

      const elements = distanceResponse.data.rows[0].elements;

      // Check if any distance is within the zone's radius
      const isDeliverable = elements.some((element: any, index: number) => {
        if (element.status === "OK") {
          const distanceInKm = element.distance.value / 1000; // Convert meters to kilometers
          return distanceInKm <= deliveryZones[index].radius;
        }
        return false;
      });

      if (!isDeliverable) {
        // Location is outside all delivery zones
        showErrorModal(
          "Delivery Unavailable",
          "Oops! We're not in your area yet. Please select a different location within our delivery range to continue."
        );
      }
    } catch (error) {
      console.error("Error checking delivery availability:", error);
      showErrorModal("Error", "Failed to check delivery availability.");
    } finally {
      setIsCheckingDelivery(false);
    }
  };

  /***************************
   * Show Custom Error Modal
   ***************************/
  const showErrorModal = (title: string, message: string) => {
    setErrorMessage(message);
    setIsErrorModalVisible(true);
  };

  /***************************
   * Close Error Modal
   ***************************/
  const closeErrorModal = () => {
    setIsErrorModalVisible(false);
  };

  /***************************
   * Open App Settings
   ***************************/
  const openAppSettings = () => {
    if (Platform.OS === "android") {
      Linking.openSettings();
    } else {
      Linking.openURL("app-settings:");
    }
  };

  /***************************
   * Request / Handle Location
   ***************************/
  const handleAllowLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== Location.PermissionStatus.GRANTED) {
        Alert.alert(
          "Permission Denied",
          "Please enable location permissions in your settings to continue.",
          [
            {
              text: "Go to Settings",
              onPress: () => {
                if (Platform.OS === "android") {
                  Linking.openSettings();
                } else {
                  Linking.openURL("app-settings:");
                }
              },
            },
            { text: "Cancel", style: "cancel" },
          ]
        );
        return;
      }

      // Permission granted, fetch location
      await fetchCurrentLocation();
      setIsBottomSheetVisible(false);
    } catch (error) {
      Alert.alert("Error", "Failed to fetch your location. Please try again.");
    }
  };

  /***************************
   * Navigate to the Location Flow
   ***************************/
  const navigateToLocationFlow = () => {
    setIsBottomSheetVisible(false);
    navigation.navigate("LocationSelector", {
      fromScreen: "Category",
      initialLat: latitude,
      initialLng: longitude,
      initialAddress: locationAddress,
    });
  };

  /***************************
   * Navigate to Products
   ***************************/
  const navigateToProducts = (categoryId: string, categoryName: string) => {
    navigation.navigate("ProductListing", { categoryId, categoryName });
  };

  const renderCategoryItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.categoryCard}
      onPress={() => navigateToProducts(item.id, item.name)}
      activeOpacity={0.8}
      accessibilityLabel={`Category: ${item.name}`}
    >
      <View style={styles.imageContainer}>
        <Image source={{ uri: item.image }} style={styles.categoryImage} />
      </View>
      <Text style={styles.categoryText}>{item.name}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Loader Overlay */}
      {(isLoadingLocation || isCheckingDelivery) && (
        <View style={styles.loaderOverlay}>
          <ActivityIndicator size="large" color="#28a745" />
        </View>
      )}

      {/* Error Modal */}
      <ErrorModal
        visible={isErrorModalVisible}
        message={errorMessage}
        onClose={closeErrorModal}
        onRetry={navigateToLocationFlow} // Optional: Add a retry button
      />

      {/* Header with Enhanced UI */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <MaterialIcons name="location-on" size={28} color="green" />
          <View style={styles.locationTextContainer}>
            <Text style={styles.deliveringText}>Delivering To</Text>
            <TouchableOpacity onPress={navigateToLocationFlow} style={styles.locationButton}>
              {isLoadingLocation ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.locationText} numberOfLines={1} ellipsizeMode="tail">
                  {locationAddress}
                </Text>
              )}
              <MaterialIcons name="keyboard-arrow-down" size={24} color="green" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Bottom Sheet (Permission Request) */}
      {isBottomSheetVisible && (
        <Modal transparent animationType="slide">
          <View style={styles.bottomSheetContainer}>
            <View style={styles.bottomSheet}>
              <Image
                source={{
                  uri: "https://img.icons8.com/color/96/000000/map-pin.png",
                }}
                style={styles.locationIcon}
              />
              <Text style={styles.locationTitle}>Location Permission is Off</Text>
              <Text style={styles.locationDescription}>
                Please enable location permission for a better delivery experience.
              </Text>
              <TouchableOpacity
                style={styles.continueButton}
                onPress={handleAllowLocation}
                activeOpacity={0.8}
                accessibilityLabel="Allow Location Permission"
              >
                <Text style={styles.continueButtonText}>Allow Location</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.searchButton}
                onPress={navigateToLocationFlow}
                activeOpacity={0.8}
                accessibilityLabel="Search for Location"
              >
                <Text style={styles.searchButtonText}>Search Location</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Search Bar for Categories */}
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={24} color="#555" style={styles.searchIcon} />
        <TextInput
          style={styles.searchBar}
          placeholder="Search categories..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
          accessibilityLabel="Search Categories"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearIcon} accessibilityLabel="Clear Search">
            <MaterialIcons name="clear" size={24} color="#555" />
          </TouchableOpacity>
        )}
      </View>

      {/* Categories List */}
      <FlatList
        data={filteredCategories}
        keyExtractor={(item) => item.id}
        renderItem={renderCategoryItem}
        numColumns={3}
        // Align items to flex-start so that if not full, they align to left
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No categories found.</Text>
          </View>
        }
      />
    </View>
  );
};

export default CategoriesScreen;

const { width } = Dimensions.get("window");
// For 3 columns, calculate cardWidth considering padding and margins.
const cardWidth = (width - 48) / 3;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f2f2f2",
  },

  /***** HEADER *****/
  header: {
    backgroundColor: "#e7f8f6",
    paddingTop: Platform.OS === "ios" ? 30 : 20,
    paddingBottom: 12,
    paddingHorizontal: 16,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  locationTextContainer: {
    marginLeft: 10,
    flex: 1,
  },
  deliveringText: {
    fontSize: 22,
    color: "black",
    fontWeight: "700",
  },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  locationText: {
    fontSize: 18,
    fontWeight: "500",
    color: "black",
    flex: 1,
    marginRight: 6,
  },

  /***** SEARCH *****/
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    position: "relative",
  },
  searchIcon: {
    position: "absolute",
    left: 16,
    zIndex: 1,
  },
  searchBar: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 25,
    paddingLeft: 48,
    paddingRight: 48,
    height: 50,
    fontSize: 17,
    color: "#333",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  clearIcon: {
    position: "absolute",
    right: 16,
  },

  /***** LIST *****/
  list: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  // Use flex-start so that any row with fewer than 3 items starts at the left
  row: {
    flex: 1,
    justifyContent: "flex-start",
    marginBottom: 16,
  },
  categoryCard: {
    width: cardWidth,
    backgroundColor: "#fff",
    borderRadius: 15,
    overflow: "hidden",
    marginRight: 8,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  imageContainer: {
    width: "100%",
    aspectRatio: 1, // Square container for image
  },
  categoryImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  categoryText: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    textAlign: "center",
    backgroundColor: "#fff",
  },

  /***** EMPTY STATE *****/
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 50,
  },
  emptyText: {
    fontSize: 18,
    color: "#999",
  },

  /***** BOTTOM SHEET *****/
  bottomSheetContainer: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  bottomSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 25,
    alignItems: "center",
  },
  locationIcon: {
    width: 100,
    height: 100,
    marginBottom: 20,
  },
  locationTitle: {
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 10,
    color: "#333",
    textAlign: "center",
  },
  locationDescription: {
    fontSize: 18,
    color: "#555",
    textAlign: "center",
    marginBottom: 25,
  },
  continueButton: {
    backgroundColor: "#28a745",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    width: "100%",
    alignItems: "center",
    marginBottom: 12,
  },
  continueButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  searchButton: {
    backgroundColor: "#fff",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#28a745",
    width: "100%",
    alignItems: "center",
  },
  searchButtonText: {
    color: "#28a745",
    fontSize: 18,
    fontWeight: "600",
  },

  /***** LOADER OVERLAY *****/
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  },
});
