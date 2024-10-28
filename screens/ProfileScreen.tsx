import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { TextInput, Button } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { useCustomer } from '../context/CustomerContext'; // Import context
import { useNavigation } from '@react-navigation/native'; // Import navigation

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation(); // Initialize navigation
  const { customerId, setCustomerId } = useCustomer(); // Access customerId
  const [userInfo, setUserInfo] = useState<any>(null); // Store user info
  const [name, setName] = useState('');
  const [dob, setDob] = useState<Date | undefined>(undefined); // Date of Birth field
  const [showDatePicker, setShowDatePicker] = useState(false); // Show calendar picker
  const [loading, setLoading] = useState(true); // Loading state

  // Realtime listener for user data
  useEffect(() => {
    const unsubscribe = firestore()
      .collection('users')
      .doc(customerId)
      .onSnapshot(
        (doc) => {
          const data = doc.data();
          if (data) {
            setUserInfo(data);
            setName(data.name || '');
            if (data.dob) setDob(new Date(data.dob));
          }
          setLoading(false);
        },
        (error) => {
          console.error('Error fetching user info:', error);
          Alert.alert('Error', 'Failed to fetch user information.');
          setLoading(false);
        }
      );

    return () => unsubscribe(); // Cleanup the listener on unmount
  }, [customerId]);

  // Save updated user info
  const saveUserInfo = async () => {
    try {
      await firestore().collection('users').doc(customerId).update({
        name,
        dob: dob ? dob.toISOString().split('T')[0] : '', // Save DOB as YYYY-MM-DD
      });
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      console.error('Error saving user info:', error);
      Alert.alert('Error', 'Failed to save profile information.');
    }
  };

  // Logout function
  const handleLogout = async () => {
    try {
      await firestore().collection('users').doc(customerId).update({
        isLoggedOut: true,
      });
      await auth().signOut();
      setCustomerId(null); // Reset customerId
      setUserInfo(null); // Clear profile data
      setName(''); // Clear name
      setDob(undefined); // Clear DOB

      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }], // Navigate to Login screen
      });

      Alert.alert('Logged Out', 'You have successfully logged out.');
    } catch (error) {
      console.error('Error logging out:', error);
      Alert.alert('Error', 'Failed to log out.');
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDob(selectedDate);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Profile Picture */}
      <Image source={require('../assets/ninja-logo.jpg')} style={styles.profileImage} />

      {/* Name Field */}
      <TextInput
        label="Name"
        value={name}
        onChangeText={setName}
        mode="outlined"
        style={styles.input}
      />

      {/* Date of Birth Label */}
      <Text style={styles.label}>Date of Birth</Text>

      {/* Date of Birth Field */}
      <Button
        mode="outlined"
        onPress={() => setShowDatePicker(true)}
        style={styles.button}
      >
        {dob ? dob.toDateString() : 'Select Date of Birth'}
      </Button>

      {showDatePicker && (
        <DateTimePicker
          value={dob || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
          onChange={onDateChange}
        />
      )}

      {/* Save Button */}
      <Button mode="contained" onPress={saveUserInfo} style={styles.saveButton}>
        Save
      </Button>

      {/* Logout Button */}
      <Button mode="text" onPress={handleLogout} style={styles.logoutButton}>
        Logout
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 20,
  },
  input: {
    width: '100%',
    marginBottom: 10,
  },
  label: {
    width: '100%',
    textAlign: 'left',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  button: {
    width: '100%',
    marginBottom: 10,
  },
  saveButton: {
    width: '100%',
    marginVertical: 10,
    backgroundColor: '#4CAF50',
  },
  logoutButton: {
    width: '100%',
    marginVertical: 10,
  },
});

export default ProfileScreen;
