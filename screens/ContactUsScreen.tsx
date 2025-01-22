import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const ContactUsScreen: React.FC = () => {
  const handleCall = () => {
    Linking.openURL('tel:8219105753');
  };

  const handleEmail = () => {
    Linking.openURL('mailto:admin@ninjadeliveries.com');
  };

  return (
    <View style={styles.container}>
      <View style={styles.imageContainer}>
        <Image
          source={require('../assets/ninja-phone.jpg')} // Use the generated ninja phone image
          style={styles.ninjaImage}
          resizeMode="cover"
        />
      </View>

      <View style={styles.contentContainer}>
        <Text style={styles.title}>Get in Touch</Text>
        <Text style={styles.description}>
          Have questions, feedback, or need help? We're here for you!
        </Text>

        <TouchableOpacity style={styles.contactButton} onPress={handleCall}>
          <Icon name="phone" size={24} color="#FFFFFF" style={styles.icon} />
          <Text style={styles.contactButtonText}>Call Us: 8219105753</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.contactButton} onPress={handleEmail}>
          <Icon name="email" size={24} color="#FFFFFF" style={styles.icon} />
          <Text style={styles.contactButtonText}>
            Email Us: admin@ninjadeliveries.com
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  imageContainer: {
    marginBottom: 20,
    width: 150,
    height: 150,
    borderRadius: 75,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  ninjaImage: {
    width: '100%',
    height: '100%',
  },
  contentContainer: {
    alignItems: 'center',
    width: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#00C853',
    textAlign: 'center',
    marginBottom: 10,
  },
  description: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00C853',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 30, // Increased border radius for a more curvy look
    marginVertical: 10,
    width: '90%',
    shadowColor: '#000', // Optional shadow for depth
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  icon: {
    marginRight: 10, // Space between icon and text
  },
  contactButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ContactUsScreen;
