import React, { useState, useEffect } from 'react';
import { View, Button, Text, TextInput, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location'; // Import Expo Location API
import { useNavigation } from '@react-navigation/native';

const PickupLocationScreen: React.FC = () => {
  const [markerCoords, setMarkerCoords] = useState(null); // Initial location is null
  const [buildingName, setBuildingName] = useState('');
  const [flatNumber, setFlatNumber] = useState('');
  const [floor, setFloor] = useState('');
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(true); // Loading state for location fetching
  const navigation = useNavigation();

  // Fetch user's current location when the component mounts
  useEffect(() => {
    const fetchUserLocation = async () => {
      try {
        // Request location permission
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Location permission is required to fetch your current location.');
          setLoading(false);
          return;
        }

        // Get user's current location
        const location = await Location.getCurrentPositionAsync({});
        setMarkerCoords({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      } catch (error) {
        console.error('Error fetching location:', error);
        Alert.alert('Error', 'Failed to fetch your current location.');
      } finally {
        setLoading(false); // Stop loading spinner
      }
    };

    fetchUserLocation();
  }, []);

  const handleConfirmLocation = () => {
    if (!markerCoords) {
      Alert.alert('Location Error', 'Unable to determine pickup location.');
      return;
    }

    if (!buildingName || !flatNumber || !floor || !instructions) {
      Alert.alert('Incomplete Information', 'Please fill in all address details.');
      return;
    }

    navigation.navigate('DropoffLocation', {
      pickupCoords: markerCoords,
      pickupDetails: { buildingName, flatNumber, floor, instructions },
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

  return (
    <View style={styles.container}>
      {markerCoords ? (
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: markerCoords.latitude,
            longitude: markerCoords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          onPress={(e) => setMarkerCoords(e.nativeEvent.coordinate)}
        >
          <Marker coordinate={markerCoords} />
        </MapView>
      ) : (
        <Text style={styles.errorText}>Unable to determine your location.</Text>
      )}

      {/* Form to Enter Pickup Address */}
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
        <Button title="Confirm Pickup Location" onPress={handleConfirmLocation} />
      </View>
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
});

export default PickupLocationScreen;
