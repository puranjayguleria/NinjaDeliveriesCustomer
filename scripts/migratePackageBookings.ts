/**
 * Migration Script: Add isPackage field to existing bookings
 * 
 * This script identifies package bookings and adds the isPackage field
 * Run this once to fix existing bookings in Firebase
 */

import firestore from '@react-native-firebase/firestore';

export async function migratePackageBookings() {
  try {
    console.log('🔄 Starting package bookings migration...');
    
    // Get all service bookings
    const bookingsSnapshot = await firestore()
      .collection('service_bookings')
      .get();
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    const batch = firestore().batch();
    
    for (const doc of bookingsSnapshot.docs) {
      const booking = doc.data();
      
      // Skip if isPackage field already exists
      if (booking.isPackage !== undefined) {
        skippedCount++;
        continue;
      }
      
      // Determine if this is a package booking based on available data
      const isPackageBooking = !!(
        booking.packageName || 
        booking.packageId || 
        booking.packageType ||
        // Additional heuristics: if serviceName contains "package" or "monthly" or "weekly"
        booking.serviceName?.toLowerCase().includes('package') ||
        booking.serviceName?.toLowerCase().includes('monthly') ||
        booking.serviceName?.toLowerCase().includes('weekly')
      );
      
      // Update the booking with isPackage field
      batch.update(doc.ref, {
        isPackage: isPackageBooking,
        updatedAt: firestore.FieldValue.serverTimestamp()
      });
      
      updatedCount++;
      
      console.log(`${isPackageBooking ? '📦' : '🔧'} ${doc.id}: ${booking.serviceName} - isPackage: ${isPackageBooking}`);
    }
    
    // Commit the batch update
    await batch.commit();
    
    console.log('✅ Migration completed!');
    console.log(`   Updated: ${updatedCount} bookings`);
    console.log(`   Skipped: ${skippedCount} bookings (already had isPackage field)`);
    
    return {
      success: true,
      updated: updatedCount,
      skipped: skippedCount
    };
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Usage: Call this function once from your app
// Example: Add a button in admin/settings screen to run migration
