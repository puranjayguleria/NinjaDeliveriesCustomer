// firebase.native.ts
import  firebase  from '@react-native-firebase/app';
import authModule from '@react-native-firebase/auth';
import firestoreModule from '@react-native-firebase/firestore';
import { Platform } from 'react-native';

export const auth = authModule;           // use: auth()
export const firestore = firestoreModule; // use: firestore()

/**
 * Call once (e.g., App.tsx) before any Firebase usage.
 * On iOS we proactively init via JS (avoids relying on plugin patching).
 * On Android, native auto-init via google-services.json is fine.
 */
export function ensureFirebaseReady() {
  try {
    const def = firebase.app(); // default exists
    console.log('[RNFB] default app exists:', def?.name);

    return;
  } catch (_) {
    // no default app, init below
  }

  if (__DEV__ && Platform.OS === "ios") {
    firebase.initializeApp({
      appId: '1:1047234268136:ios:2026afdf7b58bb82bf325d',
      apiKey: 'AIzaSyD5hL42w1G6oXLCC4EhpqxGeaF-qX5Lo9A',
      projectId: 'ninjadeliveries-91007',
      messagingSenderId: '1047234268136',
      storageBucket: 'ninjadeliveries-91007.appspot.com',
      databaseURL: 'https://ninjadeliveries-91007-default-rtdb.firebaseio.com',
    });
    console.log('[RNFB] Initialized [DEFAULT] on iOS via JS');
  }
}
