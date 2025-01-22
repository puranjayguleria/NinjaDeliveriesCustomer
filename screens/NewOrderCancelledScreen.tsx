// NewOrderCancelledScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation, useRoute, RouteProp, CommonActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

// Define navigation stack types
type RootStackParamList = {
  // ... other screens
  OrderCancelled: { orderId: string; refundAmount: number };
  ContactUs: undefined;
  Orders: undefined;
  Home: undefined; // Ensure 'Home' is defined if not already
  // ... other screens
};

type NewOrderCancelledRouteProp = RouteProp<RootStackParamList, 'OrderCancelled'>;

const NewOrderCancelledScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<NewOrderCancelledRouteProp>();
  let { refundAmount } = route.params;

  // Ensure refundAmount is a number
  if (typeof refundAmount !== 'number') {
    refundAmount = 0;
    console.warn("refundAmount is not a number. Defaulting to 0.");
  }

  // Function to navigate back to Home (Categories) screen
  const navigateToHome = () => {
    // Option 1: Simple navigate to 'Home' tab
    navigation.navigate('Home');

    // Option 2: Reset navigation stack and navigate to 'Home'
    /*
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      })
    );
    */
  };

  return (
    <View style={styles.container}>
      {/* Red Cross Icon for Order Cancellation */}
      <View style={styles.iconContainer}>
        <Ionicons name="close-circle" size={80} color="red" />
      </View>

      {/* Card Container for Message */}
      <View style={styles.card}>
        <Text style={styles.header}>We're Sorry!</Text>
        <Text style={styles.message}>
          Unfortunately, your order has been cancelled. A refund of ₹{refundAmount.toFixed(2)} will be processed to your account.
        </Text>
        <Text style={styles.note}>If you need any assistance, please feel free to reach out.</Text>
      </View>

      {/* Help Button */}
      <TouchableOpacity
        style={styles.helpButton}
        onPress={() => navigation.navigate('ContactUs')} // Navigate to ContactUs screen
      >
        <Ionicons name="help-circle-outline" size={24} color="#FFFFFF" />
        <Text style={styles.helpButtonText}>Get Help</Text>
      </TouchableOpacity>

      {/* Back to Home Button */}
      <TouchableOpacity style={styles.homeButton} onPress={navigateToHome}>
        <Text style={styles.homeButtonText}>Back to Home</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  iconContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },
  card: {
    width: '90%',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
    alignItems: 'center',
    marginBottom: 20,
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    color: '#555555',
    textAlign: 'center',
    lineHeight: 22,
    marginVertical: 10,
  },
  note: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
    marginTop: 10,
  },
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007BFF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 20,
    elevation: 2,
  },
  helpButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  homeButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007BFF',
  },
  homeButtonText: {
    color: '#007BFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default NewOrderCancelledScreen;
