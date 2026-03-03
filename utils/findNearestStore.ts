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

const ZONES_TTL_MS = 5 * 60 * 1000;
const NEAREST_TTL_MS = 30 * 60 * 1000;

let zonesCache: { ts: number; zones: DeliveryZone[] } | null = null;
let zonesInFlight: Promise<DeliveryZone[]> | null = null;

const nearestCache = new Map<string, { ts: number; id: string | null }>();

const coordKey = (lat: number, lng: number) => {
  // Round to reduce cache cardinality while staying accurate enough for zone selection.
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
};

async function getZones(): Promise<DeliveryZone[]> {
  const now = Date.now();
  if (zonesCache && now - zonesCache.ts < ZONES_TTL_MS) return zonesCache.zones;

  if (zonesInFlight) return zonesInFlight;
  zonesInFlight = (async () => {
    const snap = await firestore().collection('delivery_zones').get();
    const zones: DeliveryZone[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    zonesCache = { ts: Date.now(), zones };
    zonesInFlight = null;
    return zones;
  })();

  try {
    return await zonesInFlight;
  } finally {
    // zonesInFlight is cleared in the promise above; keep this to be safe.
  }
}

export async function prefetchNearestStoreZones(): Promise<void> {
  try {
    await getZones();
  } catch {
    // non-fatal
  }
}

export async function findNearestStore(
  lat: number,
  lng: number
): Promise<{ id: string } | null> {
  const key = coordKey(lat, lng);
  const now = Date.now();
  const cached = nearestCache.get(key);
  if (cached && now - cached.ts < NEAREST_TTL_MS) {
    return cached.id ? { id: cached.id } : null;
  }

  // ── 1. get all zones (cached)
  const zones = await getZones();

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
    nearestCache.set(key, { ts: Date.now(), id: null });
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

  if (!eligible.length) {
    nearestCache.set(key, { ts: Date.now(), id: null });
    return null;
  }

  // ── 4. pick closest
  eligible.sort((a, b) => a.km - b.km);

  const winner = eligible[0].id;
  nearestCache.set(key, { ts: Date.now(), id: winner });
  return { id: winner };
}
