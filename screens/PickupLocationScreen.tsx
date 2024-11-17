import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TouchableOpacity,
  FlatList,
  Image,
} from 'react-native';
import MapView from 'react-native-maps';
import * as Location from 'expo-location';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import firestore from '@react-native-firebase/firestore';
import { useCustomer } from '../context/CustomerContext';
import LinearGradient from 'react-native-linear-gradient'; // Using react-native-linear-gradient
import { Button } from 'react-native-paper';

const PickupLocationScreen: React.FC = () => {
  const [region, setRegion] = useState(null);
  const [initialRegion, setInitialRegion] = useState(null);
  const [hasPanned, setHasPanned] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(true);
  const [showSaveLocationModal, setShowSaveLocationModal] = useState(false);
  const [savedLocationName, setSavedLocationName] = useState('');
  const [savedLocations, setSavedLocations] = useState([]);
  const [loadingSavedLocations, setLoadingSavedLocations] = useState(true);
  const [showSavedLocationsModal, setShowSavedLocationsModal] = useState(false);

  const navigation = useNavigation();
  const { customerId } = useCustomer();

  // Fetch user location and saved locations
  useEffect(() => {
    const fetchUserLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Location permission is required to fetch your current location.');
          setLoading(false);
          return;
        }
        const location = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = location.coords;
        const initialRegion = {
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };
        setRegion(initialRegion);
        setInitialRegion(initialRegion);
      } catch (error) {
        console.error('Error fetching location:', error);
        Alert.alert('Error', 'Failed to fetch your current location.');
      } finally {
        setLoading(false);
      }
    };

    const fetchSavedLocations = async () => {
      try {
        if (customerId) {
          const userDoc = await firestore().collection('users').doc(customerId).get();
          const userData = userDoc.data();
          if (userData && userData.savedLocations) {
            setSavedLocations(userData.savedLocations);
          }
        }
      } catch (error) {
        console.error('Error fetching saved locations:', error);
      } finally {
        setLoadingSavedLocations(false);
      }
    };

    fetchUserLocation();
    fetchSavedLocations();
  }, [customerId]);

  // Manage modal state with screen focus
  useFocusEffect(
    useCallback(() => {
      setRegion(initialRegion); // Reset region
      setHasPanned(false); // Reset panning state
      return () => {
        setShowSaveLocationModal(false); // Ensure save modal is closed on exit
        setShowSavedLocationsModal(false); // Ensure saved locations modal is closed on exit
      };
    }, [initialRegion])
  );

  const handleRegionChangeComplete = (newRegion) => {
    setRegion(newRegion);
    setHasPanned(true);
  };

  const handleConfirmLocation = () => {
    if (!hasPanned) {
      Alert.alert('Location Required', 'Please move the map to pinpoint your pickup location.');
      return;
    }
    setShowSaveLocationModal(true);
  };

  const handleSaveLocation = async () => {
    if (!savedLocationName) {
      Alert.alert('Error', 'Please enter a name for this location.');
      return;
    }

    try {
      if (customerId) {
        await firestore()
          .collection('users')
          .doc(customerId)
          .update({
            savedLocations: firestore.FieldValue.arrayUnion({
              name: savedLocationName,
              instructions,
              coords: {
                latitude: region.latitude,
                longitude: region.longitude,
              },
            }),
          });
        Alert.alert('Success', 'Location saved successfully.');
      } else {
        Alert.alert('Error', 'No customer ID available.');
      }
    } catch (error) {
      console.error('Error saving location:', error);
      Alert.alert('Error', 'Failed to save location.');
    }

    setShowSaveLocationModal(false);
    handleNavigation();
  };

  const handleNavigation = () => {
    navigation.navigate('DropoffLocation', {
      pickupCoords: {
        latitude: region.latitude,
        longitude: region.longitude,
      },
      pickupDetails: { instructions },
    });
  };

  const handleSelectSavedLocation = (location) => {
    setRegion({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
    setInstructions(location.instructions || '');
    setShowSavedLocationsModal(false);

    navigation.navigate('DropoffLocation', {
      pickupCoords: {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      },
      pickupDetails: { instructions: location.instructions || '' },
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.loadingText}>Fetching your current location...</Text>
      </View>
    );
  }

  if (!customerId) {
    return (
      <View style={styles.loginPromptContainer}>
        <Image source={require('../assets/ninja-logo.jpg')} style={styles.promptImage} />
        <Text style={styles.promptText}>Login to set your pickup location</Text>
        <Button mode="contained" onPress={() => navigation.navigate('Login')} style={styles.loginButton}>
          Login
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FF0000', '#000000']} // Red and black gradient
        style={styles.titleBackground}
      >
        <Text style={styles.pageTitle}>Pickup Location</Text>
      </LinearGradient>

      {region ? (
        <>
          <MapView
            style={styles.map}
            initialRegion={initialRegion}
            onRegionChangeComplete={handleRegionChangeComplete}
          />
          <View style={styles.markerFixed}>
            <Image
              source={require('../assets/pickup-marker.png')}
              style={styles.marker}
              resizeMode="contain"
            />
          </View>
        </>
      ) : (
        <Text style={styles.errorText}>Unable to determine your location.</Text>
      )}

      <View style={styles.formContainer}>
        <TextInput
          placeholder="How to Reach (Instructions)"
          style={[styles.input, styles.highlightInput]} // Highlight the input field for better visibility
          value={instructions}
          onChangeText={setInstructions}
        />

        <View style={styles.buttonContainer}>
          {customerId && !loadingSavedLocations && savedLocations.length > 0 && (
            <TouchableOpacity
              style={[styles.button, styles.savedLocationsButton]}
              onPress={() => setShowSavedLocationsModal(true)}
            >
              <Text style={styles.buttonText}>Saved Locations</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.button, styles.confirmButton]} onPress={handleConfirmLocation}>
            <Text style={styles.buttonText}>Confirm</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Saved Locations Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showSavedLocationsModal}
        onRequestClose={() => setShowSavedLocationsModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalView}>
            <Text style={styles.modalText}>Select a Saved Location:</Text>
            <FlatList
              data={savedLocations}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.locationCard}
                  onPress={() => handleSelectSavedLocation(item)}
                >
                  <Text style={styles.locationName}>{item.name}</Text>
                  <Text style={styles.locationDetails}>Instructions: {item.instructions || 'None'}</Text>
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item.name}
              style={{ maxHeight: 200 }}
            />
            <TouchableOpacity
              style={[styles.button, styles.modalCloseButton]}
              onPress={() => setShowSavedLocationsModal(false)}
            >
              <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Save Location Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showSaveLocationModal}
        onRequestClose={() => setShowSaveLocationModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalView}>
            <Text style={styles.modalText}>Do you want to save this location for future use?</Text>
            <TextInput
              placeholder="Location Name (e.g., Home, Office)"
              style={[styles.modalInput, styles.highlightInput]} // Highlight the input field for saving location
              value={savedLocationName}
              onChangeText={setSavedLocationName}
            />
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity style={[styles.button, styles.modalSaveButton]} onPress={handleSaveLocation}>
                <Text style={styles.buttonText}>Save Location</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.modalSkipButton]} onPress={handleNavigation}>
                <Text style={styles.buttonText}>Skip Saving</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1.5 },
  titleBackground: { padding: 20, alignItems: 'center' },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginTop: 40, // Add extra margin at the top to move the title below
  },
  markerFixed: { position: 'absolute', top: '50%', left: '50%', marginLeft: -24, marginTop: -48 },
  marker: { width: 48, height: 48 },
  formContainer: { padding: 20, backgroundColor: '#1C1C1E' },
  input: { backgroundColor: '#fff', borderRadius: 5, padding: 10, marginBottom: 10, fontSize: 16 },
  highlightInput: { borderColor: 'black', borderWidth: 1 },
  buttonContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  button: { padding: 10, borderRadius: 5, marginHorizontal: 5, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16 },
  savedLocationsButton: { backgroundColor: '#4A90E2' },
  confirmButton: { backgroundColor: '#00C853' },
  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  modalView: { width: '90%', backgroundColor: '#fff', padding: 20, borderRadius: 10, alignItems: 'center' },
  modalText: { marginBottom: 20, fontSize: 18, textAlign: 'center' },
  locationCard: { backgroundColor: '#f2f2f2', padding: 15, marginVertical: 5, borderRadius: 8, width: '100%' },
  locationName: { fontWeight: 'bold', fontSize: 16, marginBottom: 5 },
  locationDetails: { fontSize: 14, color: '#333' },
  modalInput: { backgroundColor: '#fff', borderRadius: 5, padding: 10, marginBottom: 10, fontSize: 16, width: '100%' },
  modalButtonContainer: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  modalSaveButton: { flex: 1, backgroundColor: '#00C853' },
  modalSkipButton: { flex: 1, backgroundColor: '#FF3D00', marginLeft: 10 },
  modalCloseButton: { marginTop: 20, backgroundColor: '#FF3D00', width: '100%', paddingVertical: 10 },
});

export default PickupLocationScreen;
