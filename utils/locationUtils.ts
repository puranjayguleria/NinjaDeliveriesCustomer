// locationUtils.ts

import { LatLng } from 'react-native-maps';
import axios from 'axios';
import { GOOGLE_PLACES_API_KEY } from '@env'; // Ensure this is correctly set up

// Dharamshala Center Coordinates
export const DHARAMSHALA_CENTER: LatLng = {
  latitude: 32.2190,
  longitude: 76.3234,
};

/**
 * Fetch the distance between two geographical points using Google Distance Matrix API.
 * @param startCoords - Starting coordinates (latitude and longitude).
 * @param endCoords - Ending coordinates (latitude and longitude).
 * @returns Distance in kilometers.
 */
export const calculateDistance = async (
  startCoords: LatLng,
  endCoords: LatLng
): Promise<number | null> => {
  try {
    const origin = `${startCoords.latitude},${startCoords.longitude}`;
    const destination = `${endCoords.latitude},${endCoords.longitude}`;
    const mode = 'driving'; // You can change this to 'walking', 'bicycling', or 'transit' if needed

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${destination}&mode=${mode}&key=${GOOGLE_PLACES_API_KEY}`;

    const response = await axios.get(url);

    if (
      response.data.status === 'OK' &&
      response.data.rows[0].elements[0].status === 'OK'
    ) {
      const distanceInMeters =
        response.data.rows[0].elements[0].distance.value;
      const distanceInKm = distanceInMeters / 1000; // Convert to kilometers
      console.log(distanceInKm)
      return distanceInKm;
    } else {
      console.error('Error fetching distance:', response.data);
      return null;
    }
  } catch (error) {
    console.error('Distance Matrix API Error:', error);
    return null;
  }
};

/**
 * Check if the given coordinates are within 10 km of Dharamshala.
 * @param coords - Coordinates to check.
 * @returns Boolean indicating if within 10 km.
 */
export const isWithin10KmOfDharamshala = async (coords: LatLng): Promise<boolean> => {
  const distance = await calculateDistance(DHARAMSHALA_CENTER, coords);
  if (distance === null) {
    // Handle error as per your application's requirement
    return false;
  }
  return distance <= 10;
};
