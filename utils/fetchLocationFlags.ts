// utils/fetchLocationFlags.ts
import firestore from '@react-native-firebase/firestore';

export async function fetchLocationFlags(storeId: string): Promise<{
  grocery: boolean;
  food: boolean;
  services: boolean;
}> {
  try {
    console.log('[fetchLocationFlags] Fetching flags for storeId:', storeId);
    
    // Query locations collection where storeId field matches
    const querySnapshot = await firestore()
      .collection('locations')
      .where('storeId', '==', storeId)
      .limit(1)
      .get();
    
    console.log('[fetchLocationFlags] Query returned', querySnapshot.size, 'documents');
    
    if (!querySnapshot.empty) {
      const data = querySnapshot.docs[0].data();
      console.log('[fetchLocationFlags] Document data:', data);
      
      const flags = {
        grocery: data?.grocery ?? true,
        food: data?.food ?? true,
        services: data?.services ?? true,
      };
      
      console.log('[fetchLocationFlags] Returning flags:', flags);
      return flags;
    } else {
      console.warn('[fetchLocationFlags] No document found with storeId:', storeId);
    }
  } catch (error) {
    console.error('[fetchLocationFlags] Error fetching location flags:', error);
  }
  
  // Default to all true if fetch fails
  console.log('[fetchLocationFlags] Returning default flags (all true)');
  return { grocery: true, food: true, services: true };
}
