import { LatLng } from 'react-native-maps';

// Dharamshala Center Coordinates
export const DHARAMSHALA_CENTER: LatLng = {
  latitude: 32.2190,
  longitude: 76.3234,
};

// Calculate distance between two lat/lng points using Haversine formula
export const calculateDistance = (startCoords: LatLng, endCoords: LatLng): number => {
  const toRadians = (degree: number) => (degree * Math.PI) / 180;
  const earthRadiusKm = 6371;

  const dLat = toRadians(endCoords.latitude - startCoords.latitude);
  const dLon = toRadians(endCoords.longitude - startCoords.longitude);

  const startLat = toRadians(startCoords.latitude);
  const endLat = toRadians(endCoords.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(startLat) * Math.cos(endLat);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
};

// Check if the coordinates are within 10 km from Dharamshala
export const isWithin10KmOfDharamshala = (coords: LatLng): boolean => {
  const distance = calculateDistance(DHARAMSHALA_CENTER, coords);
  return distance <= 10;
};
