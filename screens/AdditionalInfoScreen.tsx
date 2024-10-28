import React, { useState } from 'react';
import { View, Text, TextInput, Switch, Button, ScrollView, StyleSheet, Alert, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
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
        notifyBySms,
        promoCode,
      },
    });
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.container}>
          <Text style={styles.label}>Sender's Phone Number</Text>
          <TextInput
            style={styles.input}
            value={senderPhoneNumber}
            onChangeText={setSenderPhoneNumber}
            keyboardType="phone-pad"
            placeholder="Enter sender's phone number"
            placeholderTextColor="#888"
          />

          <Text style={styles.label}>Recipient's Phone Number</Text>
          <TextInput
            style={styles.input}
            value={recipientPhoneNumber}
            onChangeText={setRecipientPhoneNumber}
            keyboardType="phone-pad"
            placeholder="Enter recipient's phone number"
            placeholderTextColor="#888"
          />

          <Text style={styles.label}>What are you sending?</Text>
          <TextInput
            style={styles.input}
            value={packageDescription}
            onChangeText={setPackageDescription}
            placeholder="Describe the content of the package"
            placeholderTextColor="#888"
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
            <Text style={styles.switchLabel}>Notify Recipient by SMS</Text>
            <Switch value={notifyBySms} onValueChange={setNotifyBySms} />
          </View>

          <Text style={styles.label}>Promo Code</Text>
          <TextInput
            style={styles.input}
            value={promoCode}
            onChangeText={setPromoCode}
            placeholder="Enter promo code (if any)"
            placeholderTextColor="#888"
          />

          <TouchableOpacity style={styles.button} onPress={handleProceedToSummary}>
            <Text style={styles.buttonText}>Proceed to Summary</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: '#1C1C1E',
  },
  scrollContent: {
    padding: 20,
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  label: {
    color: '#FFFFFF',
    marginBottom: 5,
    fontSize: 16,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
    fontSize: 16,
    color: '#333',
  },
  picker: {
    backgroundColor: '#fff',
    borderRadius: 5,
    marginBottom: 15,
    paddingVertical: 5,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 15,
  },
  switchLabel: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#00C853',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
  },
});

export default AdditionalInfoScreen;
