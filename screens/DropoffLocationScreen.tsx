import React, { useState } from 'react';
import { View, Button, Text, TextInput, ScrollView, StyleSheet, Alert } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useNavigation, useRoute } from '@react-navigation/native';
import { DHARAMSHALA_CENTER, isWithin10KmOfDharamshala } from '../utils/locationUtils';

const DropoffLocationScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { pickupCoords, pickupDetails } = route.params;

  const [markerCoords, setMarkerCoords] = useState(DHARAMSHALA_CENTER);
  const [buildingName, setBuildingName] = useState('');
  const [flatNumber, setFlatNumber] = useState('');
  const [floor, setFloor] = useState('');
  const [instructions, setInstructions] = useState('');

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

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: DHARAMSHALA_CENTER.latitude,
          longitude: DHARAMSHALA_CENTER.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        onPress={(e) => setMarkerCoords(e.nativeEvent.coordinate)}
      >
        <Marker coordinate={markerCoords} />
      </MapView>
      <ScrollView style={styles.scrollView}>
        <View style={styles.formContainer}>
          <Text style={styles.label}>Drop-off Location: Lat: {markerCoords.latitude}, Lon: {markerCoords.longitude}</Text>
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
          <Button title="Confirm Drop-off Location" onPress={handleConfirmLocation} />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1.5, // Reduce the map's size
  },
  scrollView: {
    flex: 1,
  },
  formContainer: {
    padding: 20,
    backgroundColor: '#1C1C1E',
  },
  label: {
    color: '#FFFFFF',
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
    fontSize: 16,
  },
});

export default DropoffLocationScreen;
