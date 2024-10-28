import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, Switch, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useRoute, useFocusEffect } from '@react-navigation/native';

const NewOrderForm: React.FC = () => {
  const route = useRoute();
  const { pickupCoords, dropoffCoords } = route.params;

  // Form fields
  const [parcelValue, setParcelValue] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [preferBag, setPreferBag] = useState(false);
  const [notifyBySms, setNotifyBySms] = useState(true);
  const [packageWeight, setPackageWeight] = useState('Up to 1 kg');
  const [paymentMethod, setPaymentMethod] = useState('Cash');

  // Reset form fields when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      // Reset form fields
      setParcelValue('');
      setPromoCode('');
      setPreferBag(false);
      setNotifyBySms(true);
      setPackageWeight('Up to 1 kg');
      setPaymentMethod('Cash');
    }, [])
  );

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Pickup and Drop-off</Text>
      <Text style={styles.infoText}>Pickup: {`Lat: ${pickupCoords.latitude}, Lon: ${pickupCoords.longitude}`}</Text>
      <Text style={styles.infoText}>Drop-off: {`Lat: ${dropoffCoords.latitude}, Lon: ${dropoffCoords.longitude}`}</Text>

      <Text style={styles.sectionTitle}>Parcel Details</Text>
      <Picker
        selectedValue={packageWeight}
        style={styles.picker}
        onValueChange={(itemValue) => setPackageWeight(itemValue)}
      >
        <Picker.Item label="Up to 1 kg" value="Up to 1 kg" />
        <Picker.Item label="1 - 5 kg" value="1 - 5 kg" />
        <Picker.Item label="5 - 10 kg" value="5 - 10 kg" />
        <Picker.Item label="Above 10 kg" value="Above 10 kg" />
      </Picker>

      <TextInput 
        placeholder="Parcel value" 
        style={styles.input} 
        value={parcelValue} 
        keyboardType="numeric" 
        onChangeText={setParcelValue} 
      />

      <Text style={styles.sectionTitle}>Additional Services</Text>
      <View style={styles.switchContainer}>
        <Text>Prefer Courier with Delivery Bag</Text>
        <Switch value={preferBag} onValueChange={setPreferBag} />
      </View>
      <View style={styles.switchContainer}>
        <Text>Notify Recipient by SMS</Text>
        <Switch value={notifyBySms} onValueChange={setNotifyBySms} />
      </View>

      <Text style={styles.sectionTitle}>Payment</Text>
      <TextInput 
        placeholder="Promo code" 
        style={styles.input} 
        value={promoCode} 
        onChangeText={setPromoCode} 
      />
      <Picker
        selectedValue={paymentMethod}
        style={styles.picker}
        onValueChange={(itemValue) => setPaymentMethod(itemValue)}
      >
        <Picker.Item label="Cash" value="Cash" />
        <Picker.Item label="Card" value="Card" />
        <Picker.Item label="UPI" value="UPI" />
      </Picker>

      <Button title="Create Order" onPress={() => { /* Handle order creation */ }} color="#0066FF" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#1C1C1E',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 20,
  },
  infoText: {
    color: '#FFFFFF',
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 5,
    padding: 10,
    marginVertical: 10,
    fontSize: 16,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
  },
  picker: {
    backgroundColor: '#fff',
    borderRadius: 5,
    marginVertical: 10,
  },
});

export default NewOrderForm;
