import React, { useState } from 'react';
import { View, Text, TextInput, Switch, Button, ScrollView, StyleSheet, Alert } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useNavigation, useRoute } from '@react-navigation/native';

const AdditionalInfoScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { pickupCoords, dropoffCoords, pickupDetails, dropoffDetails } = route.params;

  // State for the new field 'What are you sending?'
  const [packageDescription, setPackageDescription] = useState('');

  // State for phone numbers
  const [senderPhoneNumber, setSenderPhoneNumber] = useState('');
  const [recipientPhoneNumber, setRecipientPhoneNumber] = useState('');

  // Existing parcel information states
  const [packageWeight, setPackageWeight] = useState('Up to 1 kg');
  const [preferBag, setPreferBag] = useState(false);
  const [notifyBySms, setNotifyBySms] = useState(true);
  const [promoCode, setPromoCode] = useState('');

  // Function to proceed to the order summary
  const handleProceedToSummary = () => {
    // Check if required fields are filled
    if (!senderPhoneNumber || !recipientPhoneNumber || !packageDescription) {
      Alert.alert('Missing Information', 'Please fill in all required fields, including the package description.');
      return;
    }

    // Proceed to the summary screen with all the order details
    navigation.navigate('OrderSummary', {
      pickupCoords,
      dropoffCoords,
      pickupDetails,
      dropoffDetails,
      parcelDetails: {
        senderPhoneNumber,
        recipientPhoneNumber,
        packageDescription, // Replaced the parcel value with the package description
        packageWeight,
        preferBag,
        notifyBySms,
        promoCode,
      },
    });
  };

  return (
    <ScrollView style={styles.scrollView}>
      <View style={styles.container}>
        <Text style={styles.label}>Sender's Phone Number</Text>
        <TextInput
          style={styles.input}
          value={senderPhoneNumber}
          onChangeText={setSenderPhoneNumber}
          keyboardType="phone-pad"
          placeholder="Enter sender's phone number"
        />

        <Text style={styles.label}>Recipient's Phone Number</Text>
        <TextInput
          style={styles.input}
          value={recipientPhoneNumber}
          onChangeText={setRecipientPhoneNumber}
          keyboardType="phone-pad"
          placeholder="Enter recipient's phone number"
        />

        <Text style={styles.label}>What are you sending?</Text>
        <TextInput
          style={styles.input}
          value={packageDescription}
          onChangeText={setPackageDescription}
          placeholder="Describe the content of the package"
        />

        <Text style={styles.label}>Package Weight</Text>
        <Picker
          selectedValue={packageWeight}
          onValueChange={(itemValue) => setPackageWeight(itemValue)}
          style={styles.picker}
        >
          <Picker.Item label="Up to 1 kg" value="Up to 1 kg" />
          <Picker.Item label="1 - 5 kg" value="1 - 5 kg" />
          <Picker.Item label="5 - 10 kg" value="5 - 10 kg" />
          <Picker.Item label="Above 10 kg" value="Above 10 kg" />
        </Picker>

        <View style={styles.switchContainer}>
          <Text>Prefer Courier with Delivery Bag</Text>
          <Switch value={preferBag} onValueChange={setPreferBag} />
        </View>

        <View style={styles.switchContainer}>
          <Text>Notify Recipient by SMS</Text>
          <Switch value={notifyBySms} onValueChange={setNotifyBySms} />
        </View>

        <Text style={styles.label}>Promo Code</Text>
        <TextInput style={styles.input} value={promoCode} onChangeText={setPromoCode} />

        <Button title="Proceed to Summary" onPress={handleProceedToSummary} />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  container: {
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
  picker: {
    backgroundColor: '#fff',
    borderRadius: 5,
    marginVertical: 10,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
  },
});

export default AdditionalInfoScreen;
