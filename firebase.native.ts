// src/firebase.native.ts
import '@react-native-firebase/app'; // <-- MUST be first RNFirebase import

import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

// Optional sanity check; remove after you confirm it logs "[DEFAULT]"
import { getApp } from '@react-native-firebase/app';
try {
  console.log('[Firebase] Default app:', getApp().name); // -> [DEFAULT]
} catch (e) {
  console.error('[Firebase] Default app missing', e);
}

export { auth, firestore };
