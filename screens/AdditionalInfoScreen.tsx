import React, { useState } from 'react';
import { View, Text, TextInput, Alert, ScrollView, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

const AdditionalInfoScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { pickupCoords, dropoffCoords, pickupDetails, dropoffDetails } = route.params;

  // State for package details
  const [packageDescription, setPackageDescription] = useState('');
  const [senderPhoneNumber, setSenderPhoneNumber] = useState('');
  const [recipientPhoneNumber, setRecipientPhoneNumber] = useState('');
  const [packageWeight, setPackageWeight] = useState('Up to 1 kg');
  const [promoCode, setPromoCode] = useState('');
  const [discountApplied, setDiscountApplied] = useState(false);
  const [discountLabel, setDiscountLabel] = useState('');
  const [promoDescription, setPromoDescription] = useState('');
  const [promoId, setPromoId] = useState('');
  const [promoType, setPromoType] = useState('');
  const [promoAmount, setPromoAmount] = useState(0);

  // Get user ID
  const userId = auth().currentUser?.uid;

  const handleApplyPromoCode = async () => {
    if (!promoCode) {
      Alert.alert('Promo Code Missing', 'Please enter a promo code to apply.');
      return;
    }

    try {
      const promoRef = firestore().collection('promoCodes');
      const promoSnapshot = await promoRef.where('code', '==', promoCode).get();

      if (promoSnapshot.empty) {
        Alert.alert('Invalid Promo Code', 'The entered promo code does not exist.');
        return;
      }

      const promoData = promoSnapshot.docs[0].data();

      // Validate promo code
      if (!promoData.isActive) {
        Alert.alert('Promo Code Inactive', 'This promo code is no longer active.');
        return;
      }
      if (promoData.expirationDate && promoData.expirationDate.toDate() < new Date()) {
        Alert.alert('Promo Code Expired', 'This promo code has expired.');
        return;
      }
      if (promoData.usedBy && promoData.usedBy.includes(userId)) {
        Alert.alert('Promo Code Used', 'You have already used this promo code.');
        return;
      }

      // Set promo details for display
      setDiscountLabel(promoData.promoLabel || 'Discount applied');
      setPromoDescription(promoData.description || '');
      setDiscountApplied(true);
      setPromoId(promoSnapshot.docs[0].id);
      setPromoType(promoData.discountType);
      setPromoAmount(promoData.discountValue);

      Alert.alert('Promo Code Applied', promoData.promoLabel || 'Discount applied successfully!');

    } catch (error) {
      console.error('Error applying promo code:', error);
      Alert.alert('Error', 'Failed to apply promo code.');
    }
  };

  const handleProceedToSummary = () => {
    const phoneNumberRegex = /^[0-9]{10}$/; // Regex to validate 10-digit phone numbers

    if (!senderPhoneNumber || !recipientPhoneNumber || !packageDescription) {
      Alert.alert('Missing Information', 'Please fill in all required fields, including the package description.');
      return;
    }

    if (!phoneNumberRegex.test(senderPhoneNumber)) {
      Alert.alert('Invalid Sender Number', 'Please enter a valid 10-digit sender phone number.');
      return;
    }

    if (!phoneNumberRegex.test(recipientPhoneNumber)) {
      Alert.alert('Invalid Recipient Number', 'Please enter a valid 10-digit recipient phone number.');
      return;
    }

    navigation.navigate('OrderSummary', {
      pickupCoords,
      dropoffCoords,
      pickupDetails,
      dropoffDetails,
      parcelDetails: {
        senderPhoneNumber,
        recipientPhoneNumber,
        packageDescription,
        packageWeight,
        promoCode,
        discountApplied,
        discountLabel,
        promoId,
        promoType,
        promoAmount,
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
            maxLength={10} // Restrict input to 10 digits
            placeholder="Enter sender's phone number"
            placeholderTextColor="#888"
          />

          <Text style={styles.label}>Recipient's Phone Number</Text>
          <TextInput
            style={styles.input}
            value={recipientPhoneNumber}
            onChangeText={setRecipientPhoneNumber}
            keyboardType="phone-pad"
            maxLength={10} // Restrict input to 10 digits
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

          <Text style={styles.label}>Promo Code</Text>
          <TextInput
            style={styles.input}
            value={promoCode}
            onChangeText={setPromoCode}
            placeholder="Enter promo code (if any)"
            placeholderTextColor="#888"
          />
          <TouchableOpacity style={styles.applyButton} onPress={handleApplyPromoCode}>
            <Text style={styles.buttonText}>Apply Promo Code</Text>
          </TouchableOpacity>

          {discountApplied && (
            <View style={styles.promoDetailsContainer}>
              <Text style={styles.discountLabel}>{discountLabel}</Text>
              <Text style={styles.promoDescription}>{promoDescription}</Text>
            </View>
          )}

          <TouchableOpacity style={styles.button} onPress={handleProceedToSummary}>
            <Text style={styles.buttonText}>Proceed to Summary</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  scrollView: { flex: 1, backgroundColor: '#1C1C1E' },
  scrollContent: { padding: 20, justifyContent: 'center' },
  container: { flex: 1, justifyContent: 'center' },
  label: { color: '#FFFFFF', marginBottom: 5, fontSize: 16 },
  input: { backgroundColor: '#fff', borderRadius: 5, padding: 10, marginBottom: 15, fontSize: 16, color: '#333' },
  picker: { backgroundColor: '#fff', borderRadius: 5, marginBottom: 15, paddingVertical: 5 },
  button: { backgroundColor: '#00C853', padding: 15, borderRadius: 5, alignItems: 'center', marginTop: 20 },
  applyButton: { backgroundColor: '#4A90E2', padding: 10, borderRadius: 5, alignItems: 'center', marginBottom: 15 },
  buttonText: { color: '#fff', fontSize: 16 },
  promoDetailsContainer: { marginTop: 10, paddingHorizontal: 10 },
  discountLabel: { color: '#00C853', fontSize: 14, fontWeight: 'bold', marginBottom: 3, textAlign: 'center' },
  promoDescription: { color: '#888', fontSize: 12, fontStyle: 'italic', textAlign: 'center' },
});

export default AdditionalInfoScreen;
