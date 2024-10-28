import React, { useState, useEffect } from 'react';
import { View, Button, Text, TextInput, Alert, StyleSheet, ActivityIndicator, Modal, TouchableOpacity, FlatList } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import firestore from '@react-native-firebase/firestore';
import { useCustomer } from '../context/CustomerContext'; // Import Customer Context
import { DHARAMSHALA_CENTER, isWithin10KmOfDharamshala } from '../utils/locationUtils'; // Utility functions for validation

const DropoffLocationScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { pickupCoords, pickupDetails } = route.params;

  const [markerCoords, setMarkerCoords] = useState(DHARAMSHALA_CENTER);
  const [buildingName, setBuildingName] = useState('');
  const [flatNumber, setFlatNumber] = useState('');
  const [floor, setFloor] = useState('');
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(false);
  const [savedLocations, setSavedLocations] = useState([]);
  const [loadingSavedLocations, setLoadingSavedLocations] = useState(true);
  const [showSavedLocationsModal, setShowSavedLocationsModal] = useState(false); // Modal for saved locations

  const { customerId } = useCustomer(); // Get customerId from context

  // Fetch user's saved locations when the component mounts
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

  const handleConfirmLocation = () => {
    if (!isWithin10KmOfDharamshala(markerCoords)) {
      Alert.alert('Location Out of Range', 'Drop-off location must be within 10 km of Dharamshala.');
      return;
    }

    if (!buildingName || !flatNumber || !floor || !instructions) {
      Alert.alert('Incomplete Information', 'Please fill in all address details.');
      return;
    }

    navigation.navigate('AdditionalInfo', {
      pickupCoords,
      dropoffCoords: markerCoords,
      pickupDetails,
      dropoffDetails: { buildingName, flatNumber, floor, instructions },
    });
  };

  const handleSelectSavedLocation = (location) => {
    setMarkerCoords(location.coords);
    setBuildingName(location.buildingName);
    setFlatNumber(location.flatNumber);
    setFloor(location.floor);
    setInstructions(location.instructions);

    setShowSavedLocationsModal(false);
  };

  const renderLocationCard = ({ item }) => (
    <TouchableOpacity style={styles.locationCard} onPress={() => handleSelectSavedLocation(item)}>
      <Text style={styles.locationName}>{item.name}</Text>
      <Text style={styles.locationDetails}>{item.buildingName}, Flat {item.flatNumber}, Floor {item.floor}</Text>
      <Text style={styles.locationDetails}>Instructions: {item.instructions}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.loadingText}>Fetching your current location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {markerCoords ? (
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: markerCoords.latitude,
            longitude: markerCoords.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          onPress={(e) => setMarkerCoords(e.nativeEvent.coordinate)}
        >
          <Marker coordinate={markerCoords} />
        </MapView>
      ) : (
        <Text style={styles.errorText}>Unable to determine your location.</Text>
      )}

      <View style={styles.formContainer}>
        <TextInput
          placeholder="Building Name"
          style={styles.input}
          value={buildingName}
          onChangeText={setBuildingName}
        />
        <TextInput
          placeholder="Flat Number"
          style={styles.input}
          value={flatNumber}
          onChangeText={setFlatNumber}
        />
        <TextInput
          placeholder="Floor"
          style={styles.input}
          value={floor}
          onChangeText={setFloor}
        />
        <TextInput
          placeholder="How to Reach (Instructions)"
          style={styles.input}
          value={instructions}
          onChangeText={setInstructions}
        />

        <View style={styles.buttonContainer}>
          {!loadingSavedLocations && savedLocations.length > 0 && (
            <TouchableOpacity
              style={[styles.button, styles.savedLocationsButton]}
              onPress={() => setShowSavedLocationsModal(true)}
            >
              <Text style={styles.buttonText}>Saved Locations</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.button, styles.confirmButton]}
            onPress={handleConfirmLocation}
          >
            <Text style={styles.buttonText}>Confirm</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Modal for Saved Locations with FlatList */}
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
              renderItem={renderLocationCard}
              keyExtractor={(item) => item.name}
              style={styles.modalFlatList}
            />
            <TouchableOpacity
              style={[styles.button, styles.modalCloseButton]} // Adjust button height, width and background color
              onPress={() => setShowSavedLocationsModal(false)}
            >
              <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1.5,
  },
  formContainer: {
    padding: 20,
    backgroundColor: '#1C1C1E',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    marginTop: 10,
    color: '#000',
  },
  errorText: {
    fontSize: 16,
    color: 'red',
    textAlign: 'center',
    marginTop: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  button: {
    padding: 10,
    borderRadius: 5,
    marginHorizontal: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
  },
  savedLocationsButton: {
    backgroundColor: '#4A90E2',
  },
  confirmButton: {
    backgroundColor: '#00C853',
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
  modalText: {
    marginBottom: 20,
    fontSize: 18,
    textAlign: 'center',
  },
  modalFlatList: {
    width: '100%',
  },
  locationCard: {
    backgroundColor: '#f2f2f2',
    padding: 15,
    marginVertical: 5,
    borderRadius: 8,
    width: '100%',
  },
  locationName: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 5,
  },
  locationDetails: {
    fontSize: 14,
    color: '#333',
  },
  modalCloseButton: {
    marginTop: 20,
    backgroundColor: '#FF3D00',
    width: '100%',
    paddingVertical: 10, // Add padding to make the button more visible
  },
});

export default DropoffLocationScreen;
