import React, { useState, useEffect } from 'react';
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
import { useNavigation, useRoute } from '@react-navigation/native';
import firestore from '@react-native-firebase/firestore';
import { useCustomer } from '../context/CustomerContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { DHARAMSHALA_CENTER, isWithin10KmOfDharamshala } from '../utils/locationUtils';
import { Dimensions } from 'react-native';

const HIMACHAL_BOUNDS = {
  north: 33.0,
  south: 30.5,
  east: 78.5,
  west: 75.5,
};
const { width } = Dimensions.get('window'); // Get screen width

const DropoffLocationScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { pickupCoords, pickupDetails } = route.params;

  const [region, setRegion] = useState({
    latitude: DHARAMSHALA_CENTER.latitude,
    longitude: DHARAMSHALA_CENTER.longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });
  const [locationSelected, setLocationSelected] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(true);
  const [savedLocations, setSavedLocations] = useState([]);
  const [loadingSavedLocations, setLoadingSavedLocations] = useState(true);
  const [showSavedLocationsModal, setShowSavedLocationsModal] = useState(false);
  const [usingCurrentLocation, setUsingCurrentLocation] = useState(false);

  const { customerId } = useCustomer();

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
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
    fetchSavedLocations();
  }, [customerId]);

  const handleRegionChangeComplete = (newRegion) => {
    if (!usingCurrentLocation) {
      setRegion(newRegion);
      setLocationSelected(true);
    }
  };

  const handleConfirmLocation = () => {
    if (!locationSelected) {
      Alert.alert('Location Required', 'Please select a drop-off location by moving the map or choosing a saved location.');
      return;
    }

    if (!isWithin10KmOfDharamshala(region)) {
      Alert.alert('Location Out of Range', 'Drop-off location must be within 10 km of Dharamshala.');
      return;
    }

    navigation.navigate('AdditionalInfo', {
      pickupCoords,
      dropoffCoords: {
        latitude: region.latitude,
        longitude: region.longitude,
      },
      pickupDetails,
      dropoffDetails: { instructions },
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
    setLocationSelected(true);
    setShowSavedLocationsModal(false);

    navigation.navigate('AdditionalInfo', {
      pickupCoords,
      dropoffCoords: {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      },
      pickupDetails,
      dropoffDetails: { instructions: location.instructions || '' },
    });
  };

  const handleUseCurrentLocation = async () => {
    try {
      setLoading(true);
      setUsingCurrentLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to use your current location.');
        setLoading(false);
        setUsingCurrentLocation(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
      setLocationSelected(true);
    } catch (error) {
      console.error('Error fetching current location:', error);
      Alert.alert('Error', 'Could not fetch your current location.');
    } finally {
      setLoading(false);
      setUsingCurrentLocation(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#00C853', '#1C1C1E']} style={styles.titleBackground}>
        <View style={styles.titleContainer}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.pageTitle}>Drop-off Location</Text>
        </View>
      </LinearGradient>

      {region ? (
        <>
          <MapView style={styles.map} region={region} onRegionChangeComplete={handleRegionChangeComplete} />

          <View style={styles.markerFixed}>
            <Image source={require('../assets/dropoff-marker.png')} style={styles.marker} resizeMode="contain" />
          </View>

          <TouchableOpacity style={styles.currentLocationButton} onPress={handleUseCurrentLocation}>
            <Icon name="my-location" size={24} color="#000" />
          </TouchableOpacity>
        </>
      ) : (
        <Text style={styles.errorText}>Unable to determine your location.</Text>
      )}

      <View style={styles.formContainer}>
        <TextInput placeholder="How to Reach (Instructions)" style={styles.input} value={instructions} onChangeText={setInstructions} />

        <View style={styles.buttonContainer}>
          {customerId && !loadingSavedLocations && savedLocations.length > 0 && (
            <TouchableOpacity style={[styles.button, styles.savedLocationsButton]} onPress={() => setShowSavedLocationsModal(true)}>
              <Text style={styles.buttonText}>Saved Locations</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={[styles.button, styles.confirmButton]} onPress={handleConfirmLocation}>
            <Text style={styles.buttonText}>Confirm</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal animationType="slide" transparent={true} visible={showSavedLocationsModal} onRequestClose={() => setShowSavedLocationsModal(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalView}>
            <Text style={styles.modalText}>Select a Saved Location:</Text>
            <FlatList
              data={savedLocations}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.locationCard} onPress={() => handleSelectSavedLocation(item)}>
                  <Text style={styles.locationName}>{item.name}</Text>
                  <Text style={styles.locationDetails}>Instructions: {item.instructions || 'None'}</Text>
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item.name}
              style={{ maxHeight: 200 }}
            />
            <TouchableOpacity style={[styles.button, styles.modalCloseButton]} onPress={() => setShowSavedLocationsModal(false)}>
              <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  titleBackground: {
    backgroundColor: '#1C1C1E', // Black background; use gradient if needed
    paddingVertical: 10,
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40, // Add extra margin at the top to move the title below
    width: width * 0.9, // Make the container width responsive
    alignSelf: 'center', // Center align the container
  },
  backButton: {
    position: 'absolute', // Position it on the left
    left: 0, // Align to the far left
   // top: 10, // Keep consistent spacing from the top
    zIndex: 10, // Ensure it stays above other components
   // padding: 10, // Add padding for easier touchability
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginLeft: 40, // Offset to avoid overlapping with the back button
  },
  map: { flex: 1.5 },
  markerFixed: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -24,
    marginTop: -48,
  },
  marker: { width: 48, height: 48 },
  formContainer: { padding: 20, backgroundColor: '#1C1C1E' },
  input: { backgroundColor: '#fff', borderRadius: 5, padding: 10, marginBottom: 10, fontSize: 16 },
  buttonContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  button: { padding: 10, borderRadius: 5, marginHorizontal: 5, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16 },
  savedLocationsButton: { backgroundColor: '#4A90E2' },
  confirmButton: { backgroundColor: '#00C853' },
  currentLocationButton: {
    position: 'absolute',
    bottom: 250,
    right: 20,
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    width: '90%',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalText: { marginBottom: 20, fontSize: 18, textAlign: 'center' },
  locationCard: { backgroundColor: '#f2f2f2', padding: 15, marginVertical: 5, borderRadius: 8, width: '100%' },
  locationName: { fontWeight: 'bold', fontSize: 16, marginBottom: 5 },
  locationDetails: { fontSize: 14, color: '#333' },
  modalCloseButton: {
    marginTop: 20,
    backgroundColor: '#FF3D00',
    width: '100%',
    paddingVertical: 10,
  },
});

export default DropoffLocationScreen;
