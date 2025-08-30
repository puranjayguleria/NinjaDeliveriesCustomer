// firebase.native.ts
import app, { getApps, initializeApp } from '@react-native-firebase/app';
import authModule from '@react-native-firebase/auth';
import firestoreModule from '@react-native-firebase/firestore';
import { Platform } from 'react-native';

export const auth = authModule;
export const firestore = firestoreModule;

/**
 * Ensure the [DEFAULT] Firebase app exists (especially on iOS where
 * auto-config from GoogleService-Info.plist sometimes doesn't run).
 * Safe to call multiple times; it no-ops if already initialized.
 */
export async function ensureFirebaseReady() {
  // Already configured?
  if (getApps && getApps().length > 0) return;
  if ((app as any).apps && (app as any).apps.length > 0) return;

  if (Platform.OS === 'ios') {
    // Initialize [DEFAULT] using values from your GoogleService-Info.plist
    await initializeApp({
      // from your plist:
      appId: '1:1047234268136:ios:2026afdf7b58bb82bf325d', // GOOGLE_APP_ID
      apiKey: 'AIzaSyD5hL42w1G6oXLCC4EhpqxGeaF-qX5Lo9A',     // API_KEY
      projectId: 'ninjadeliveries-91007',                    // PROJECT_ID
      messagingSenderId: '1047234268136',                    // GCM_SENDER_ID

      // IMPORTANT: use the canonical bucket name; your plist shows
      // "ninjadeliveries-91007.firebasestorage.app" (domain), but the bucket
      // identifier should be "<project>.appspot.com".
      storageBucket: 'ninjadeliveries-91007.appspot.com',

      databaseURL: 'https://ninjadeliveries-91007-default-rtdb.firebaseio.com',
    });

    console.log('[RNFB] Initialized [DEFAULT] on iOS via JS');
  }
}
