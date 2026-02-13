import { firestore } from '../firebase.native';
import { FirestoreService } from './firestoreService';

/**
 * Extensions to FirestoreService for booking status fixes
 */
export class FirestoreServiceExtensions {
  /**
   * Fix inconsistent booking statuses - convert 'reject' to 'rejected' but keep 'cancelled' separate
   */
  static async fixInconsistentBookingStatuses(): Promise<void> {
    try {
      console.log('🔧 Fixing inconsistent booking statuses...');
      
      const userId = FirestoreService.getCurrentUserId();
      if (!userId) {
        console.log('❌ No user logged in');
        return;
      }

      // Get all user bookings
      const snapshot = await firestore()
        .collection('service_bookings')
        .where('customerId', '==', userId)
        .get();

      console.log(`📊 Checking ${snapshot.size} bookings for status inconsistencies...`);

      let fixedCount = 0;
      const batch = firestore().batch();

      snapshot.forEach(doc => {
        const data = doc.data();
        
        // Check for inconsistent status values
        if (data.status === 'reject') {
          console.log(`🔧 Fixing booking ${doc.id}: 'reject' → 'rejected'`);
          batch.update(doc.ref, { 
            status: 'rejected',
            rejectedBy: 'admin', // Assume admin rejection for legacy 'reject' status
            updatedAt: new Date()
          });
          fixedCount++;
        } else if (data.status === 'cancel') {
          console.log(`🔧 Fixing booking ${doc.id}: 'cancel' → 'cancelled'`);
          batch.update(doc.ref, { 
            status: 'cancelled',
            cancelledBy: 'user', // Assume user cancellation for legacy 'cancel' status
            updatedAt: new Date()
          });
          fixedCount++;
        }
        // Note: We no longer convert 'cancelled' to 'rejected' - they are now separate statuses
      });

      if (fixedCount > 0) {
        await batch.commit();
        console.log(`✅ Fixed ${fixedCount} booking status inconsistencies`);
      } else {
        console.log(`✅ No status inconsistencies found`);
      }

    } catch (error) {
      console.error('❌ Error fixing booking statuses:', error);
    }
  }

  /**
   * Debug method to check all booking statuses for current user
   */
  static async debugBookingStatusesDetailed(): Promise<void> {
    try {
      const userId = FirestoreService.getCurrentUserId();
      if (!userId) {
        console.log('❌ No user logged in');
        return;
      }

      console.log(`🔍 Checking all booking statuses for user: ${userId}`);

      const snapshot = await firestore()
        .collection('service_bookings')
        .where('customerId', '==', userId)
        .get();

      console.log(`📊 Found ${snapshot.size} bookings:`);

      const statusCounts: Record<string, number> = {};
      const bookingsByStatus: Record<string, any[]> = {};

      snapshot.forEach(doc => {
        const data = doc.data();
        const status = data.status || 'unknown';
        
        statusCounts[status] = (statusCounts[status] || 0) + 1;
        
        if (!bookingsByStatus[status]) {
          bookingsByStatus[status] = [];
        }
        
        bookingsByStatus[status].push({
          id: doc.id,
          serviceName: data.serviceName,
          customerName: data.customerName,
          date: data.date,
          time: data.time
        });
      });

      console.log(`📋 Status counts:`, statusCounts);
      
      Object.keys(bookingsByStatus).forEach(status => {
        console.log(`\n📋 Bookings with status '${status}' (${bookingsByStatus[status].length}):`);
        bookingsByStatus[status].forEach((booking, index) => {
          console.log(`   ${index + 1}. ${booking.serviceName} | ${booking.customerName} | ${booking.date} ${booking.time}`);
        });
      });

    } catch (error) {
      console.error('❌ Error debugging booking statuses:', error);
    }
  }
}