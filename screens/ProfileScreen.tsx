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
import { useCustomer } from '../context/CustomerContext';
import { useNavigation } from '@react-navigation/native';

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation();
  const { customerId, setCustomerId } = useCustomer();
  const [userInfo, setUserInfo] = useState<any>(null);
  const [name, setName] = useState('');
  const [dob, setDob] = useState<Date | undefined>(undefined);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customerId) {
      setLoading(false);
      return;
    }

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

    return () => unsubscribe();
  }, [customerId]);

  const saveUserInfo = async () => {
    try {
      await firestore().collection('users').doc(customerId).update({
        name,
        dob: dob ? dob.toISOString().split('T')[0] : '',
      });
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      console.error('Error saving user info:', error);
      Alert.alert('Error', 'Failed to save profile information.');
    }
  };

  const handleLogout = async () => {
    try {
      await firestore().collection('users').doc(customerId).update({
        isLoggedOut: true,
      });
      await auth().signOut();
      setCustomerId(null);
      setUserInfo(null);
      setName('');
      setDob(undefined);

      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
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

  if (!customerId) {
    return (
      <View style={styles.loginPromptContainer}>
        <Image
          source={require('../assets/ninja-logo.jpg')}
          style={styles.promptImage}
        />
        <Text style={styles.promptText}>
          Login to view and manage your profile
        </Text>
        <Button
          mode="contained"
          onPress={() => navigation.navigate('Login')}
          style={styles.loginButton}
        >
          Login
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Image source={require('../assets/ninja-logo.jpg')} style={styles.profileImage} />

      <TextInput
        label="Name"
        value={name}
        onChangeText={setName}
        mode="outlined"
        style={styles.input}
      />

      <Text style={styles.label}>Date of Birth</Text>

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

      <Button mode="contained" onPress={saveUserInfo} style={styles.saveButton}>
        Save
      </Button>

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
  loginPromptContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#fff',
  },
  promptImage: {
    width: 100,
    height: 100,
    borderRadius: 50, // Make the image circular
    marginBottom: 20,
  },
  promptText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  loginButton: {
    width: '80%',
    backgroundColor: '#FF5722',
  },
});

export default ProfileScreen;
