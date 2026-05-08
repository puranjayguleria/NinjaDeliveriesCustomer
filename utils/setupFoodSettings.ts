/**
 * Quick utility to create foodOrderSettings collection
 * 
 * Usage: Import this function and call it once from any screen
 * Example:
 * 
 * import { quickSetupFoodSettings } from '@/utils/setupFoodSettings';
 * 
 * // In your component:
 * <Button onPress={quickSetupFoodSettings} title="Setup Food Settings" />
 */

import firestore from '@react-native-firebase/firestore';
import { Alert } from 'react-native';

const DEFAULT_FOOD_SETTINGS = {
  additionalCostPerKm: 8,
  badWeather: false,
  baseDeliveryCharge: 5,
  distanceThreshold: 0,
  gstPercentage: 5,
  platformFee: 1,
  surgeFee: 10,
  weatherFromApi: false,
  freeDeliveryAbove: 199,
  packagingFee: 20,
  itemGstDefaultPercent: 5,
  highGstPercent: 18,
  nightSurgeEnabled: true,
  nightSurgePercent: 10,
  nightSurgeFromHour: 22,
  nightSurgeToHour: 6,
};

export async function quickSetupFoodSettings() {
  try {
    console.log('🚀 Starting setup...');

    // Fetch restaurants from registerRestaurant collection (as per foodFirebase.ts)
    console.log('📋 Fetching restaurants from registerRestaurant collection...');
    const restaurantsSnapshot = await firestore()
      .collection('registerRestaurant')
      .where('isActive', '==', true)
      .where('accountEnabled', '==', true)
      .get();
    
    if (restaurantsSnapshot.empty) {
      Alert.alert('No Restaurants', 'No active restaurants found in registerRestaurant collection.');
      console.log('⚠️  No restaurants found');
      return;
    }

    console.log(`✅ Found ${restaurantsSnapshot.size} active restaurants`);

    // Check existing settings
    const existingSettings = await firestore().collection('foodOrderSettings').get();
    const existingIds = new Set<string>();
    existingSettings.forEach(doc => {
      const data = doc.data();
      if (data.restaurantId) existingIds.add(data.restaurantId);
    });

    let created = 0;
    let skipped = 0;

    // Create settings for each restaurant
    for (const restaurantDoc of restaurantsSnapshot.docs) {
      const restaurantId = restaurantDoc.id;
      const restaurantData = restaurantDoc.data();
      const restaurantName = restaurantData.restaurantName || restaurantData.name || 'Unknown Restaurant';

      if (existingIds.has(restaurantId)) {
        console.log(`⏭️  Skipped: ${restaurantName}`);
        skipped++;
        continue;
      }

      const settingData = {
        ...DEFAULT_FOOD_SETTINGS,
        restaurantId,
        restaurantName,
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };

      await firestore().collection('foodOrderSettings').add(settingData);
      console.log(`✅ Created: ${restaurantName} (${restaurantId})`);
      created++;
    }

    const message = `✅ Created: ${created}\n⏭️  Skipped: ${skipped}\n📋 Total Restaurants: ${restaurantsSnapshot.size}`;
    console.log('\n' + message);
    
    Alert.alert('Setup Complete! 🎉', message);
    
    return { success: true, created, skipped, total: restaurantsSnapshot.size };
  } catch (error: any) {
    console.error('❌ Error:', error);
    Alert.alert('Error', error.message);
    return { success: false, error: error.message };
  }
}

// Alternative: Create for a single restaurant from registerRestaurant collection
export async function createSettingForRestaurant(restaurantId: string) {
  try {
    // Check if already exists
    const existing = await firestore()
      .collection('foodOrderSettings')
      .where('restaurantId', '==', restaurantId)
      .limit(1)
      .get();

    if (!existing.empty) {
      console.log('⏭️  Setting already exists for this restaurant');
      return { success: true, message: 'Already exists' };
    }

    // Get restaurant data from registerRestaurant collection
    const restaurantDoc = await firestore()
      .collection('registerRestaurant')
      .doc(restaurantId)
      .get();

    if (!restaurantDoc.exists) {
      throw new Error('Restaurant not found in registerRestaurant collection');
    }

    const restaurantData = restaurantDoc.data();
    const settingData = {
      ...DEFAULT_FOOD_SETTINGS,
      restaurantId,
      restaurantName: restaurantData?.restaurantName || restaurantData?.name || 'Unknown',
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    };

    await firestore().collection('foodOrderSettings').add(settingData);
    console.log(`✅ Created setting for: ${restaurantData?.restaurantName || restaurantData?.name}`);
    
    return { success: true, message: 'Created successfully' };
  } catch (error: any) {
    console.error('❌ Error:', error);
    return { success: false, error: error.message };
  }
}
