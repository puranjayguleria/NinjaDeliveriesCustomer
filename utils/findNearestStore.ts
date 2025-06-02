// utils/findNearestStore.ts
import firestore from '@react-native-firebase/firestore';
import axios from 'axios';
import { GOOGLE_PLACES_API_KEY } from '@env';

type DeliveryZone = {
  id: string;            // == storeId
  latitude: number;
  longitude: number;
  radius: number;        // km
};

export async function findNearestStore(
  lat: number,
  lng: number
): Promise<{ id: string } | null> {
  // ── 1. get all zones
  const snap = await firestore().collection('delivery_zones').get();
  const zones: DeliveryZone[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));

  if (!zones.length) return null;

  // ── 2. ask Google for distances (one call, many destinations)
  const destinations = zones.map(z => `${z.latitude},${z.longitude}`).join('|');

  const { data } = await axios.get(
    'https://maps.googleapis.com/maps/api/distancematrix/json',
    {
      params: {
        origins: `${lat},${lng}`,
        destinations,
        key: GOOGLE_PLACES_API_KEY,
        units: 'metric',
      },
    }
  );

  if (data.status !== 'OK') {
    console.warn('[findNearestStore] Distance-Matrix error:', data.status);
    return null;
  }

  // ── 3. build list of candidates inside their radius
  const els = data.rows[0].elements as any[];
  const eligible: { km: number; id: string }[] = [];

  els.forEach((el, i) => {
    if (el.status === 'OK') {
      const km = el.distance.value / 1000;
      if (km <= zones[i].radius) {
        eligible.push({ km, id: zones[i].id });
      }
    }
  });

  if (!eligible.length) return null;

  // ── 4. pick closest
  eligible.sort((a, b) => a.km - b.km);
  return { id: eligible[0].id };
}
