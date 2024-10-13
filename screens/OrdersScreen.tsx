import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Button, Image, Alert } from 'react-native';
import auth from '@react-native-firebase/auth';
import { useNavigation } from '@react-navigation/native';

const OrdersScreen: React.FC = () => {
  const [user, setUser] = useState<any>(null); // Store the logged-in user
  const navigation = useNavigation();

  useEffect(() => {
    // Listen to authentication state changes
    const unsubscribe = auth().onAuthStateChanged((user) => {
      if (user) {
        setUser(user); // User is logged in
      } else {
        setUser(null); // No user logged in
      }
    });
    return unsubscribe; // Clean up the listener on unmount
  }, []);

  const handleLogin = () => {
    // Navigate to login screen
    navigation.navigate('Login');
  };

  const handleCreateOrder = () => {
    if (!user) {
      Alert.alert(
        'Login Required',
        'Please log in with your phone number to create an order.',
        [{ text: 'OK', onPress: handleLogin }]
      );
    } else {
      // Proceed to order form if logged in
      navigation.navigate('NewOrder');
    }
  };

  return (
    <View style={styles.container}>
      {/* Logo or Package Icon */}
      <Image 
        source={require('../assets/ninja-logo.png')} 
        style={styles.logo} 
      />

      {/* Title */}
      <Text style={styles.title}>Send a package</Text>

      {/* Subtitle */}
      <Text style={styles.subtitle}>
        A courier will pick up and deliver documents, gifts, flowers, food, and other items.
      </Text>

      {/* Create Order Button */}
      <View style={styles.buttonContainer}>
        <Button title="Create Order" onPress={handleCreateOrder} color="#0066FF" />
      </View>

      {/* Login Footer */}
      {!user && (
        <Text style={styles.footerText}>
          Log in with your phone number to continue
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    padding: 20,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 30,
  },
  buttonContainer: {
    width: '100%',
    borderRadius: 5,
    marginBottom: 30,
  },
  footerText: {
    color: '#FFFFFF',
    marginTop: 20,
  },
});

export default OrdersScreen;
