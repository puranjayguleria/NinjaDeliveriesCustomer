import React, { useState } from 'react';
import { View, Text, Button, Alert, StyleSheet } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { AirbnbRating } from 'react-native-ratings';  // A star rating library
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';

type RatingScreenRouteProp = RouteProp<{ params: { orderId: string; riderId: string } }, 'params'>;

const RatingScreen: React.FC = () => {
  const route = useRoute<RatingScreenRouteProp>();
  const { orderId, riderId } = route.params;  // Order and Rider IDs passed from the previous screen
  const [rating, setRating] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigation = useNavigation();  // For navigating back to home screen

  const submitRating = async () => {
    if (rating === 0) {
      Alert.alert('Please select a rating before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Save the rating to Firestore under the rider's document
      const riderRef = firestore().collection('riderDetails').doc(riderId);
      await riderRef.update({
        ratings: firestore.FieldValue.arrayUnion({
          orderId: orderId,
          rating: rating,
          ratedAt: firestore.FieldValue.serverTimestamp(),
        }),
      });

      Alert.alert('Thank you!', 'Your rating has been submitted successfully.');
      // Navigate back to home or another screen
      navigation.reset({
        index: 0,
        routes: [{ name: 'Orders' }],  // Adjust this to navigate to the desired screen
      });
    } catch (error) {
      console.error('Error submitting rating:', error);
      Alert.alert('Error', 'There was an error submitting your rating. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Rate Your Rider</Text>

      {/* Star Rating Component */}
      <AirbnbRating
        count={5}
        reviews={['Terrible', 'Bad', 'OK', 'Good', 'Great']}
        defaultRating={0}
        size={40}
        onFinishRating={setRating}
      />

      {/* Submit Button */}
      <View style={styles.buttonContainer}>
        <Button title={isSubmitting ? 'Submitting...' : 'Submit Rating'} onPress={submitRating} disabled={isSubmitting} />
      </View>

      {/* Thank You Message */}
      {rating > 0 && !isSubmitting && (
        <View style={styles.thankYouContainer}>
          <Text style={styles.thankYouMessage}>Thank you for rating!</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  buttonContainer: {
    marginTop: 30,
    width: '80%',
  },
  thankYouContainer: {
    marginTop: 30,
    alignItems: 'center',
  },
  thankYouMessage: {
    fontSize: 20,
    color: 'green',
  },
});

export default RatingScreen;
