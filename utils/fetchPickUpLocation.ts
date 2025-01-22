// utils/fetchPickupLocation.ts

import firestore from '@react-native-firebase/firestore';
import { FIXED_PICKUP_LOCATION, PickupLocation } from '../constants/pickupLocation';

export const fetchFixedPickupLocation = async (): Promise<PickupLocation> => {
  try {
    const settingsDoc = await firestore()
      .collection('orderSetting')
      .doc('fare')
      .get();
    if (settingsDoc.exists) {
      const data = settingsDoc.data();
      return data?.fixedPickupLocation as PickupLocation;
    } else {
      console.warn('Fixed Pickup Location not found. Using default constants.');
      // Fallback to constants if Firestore data is missing
      return FIXED_PICKUP_LOCATION;
    }
  } catch (error) {
    console.error('Error fetching fixed pickup location:', error);
    // Fallback to constants in case of error
    return FIXED_PICKUP_LOCATION;
  }
};
export { PickupLocation };

