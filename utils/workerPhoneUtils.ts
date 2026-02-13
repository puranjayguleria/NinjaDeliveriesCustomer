/**
 * Utility functions for fetching worker phone numbers
 */

export class WorkerPhoneUtils {
  /**
   * Fetch worker phone number from service_workers collection
   */
  static async fetchWorkerPhone(workerId: string): Promise<string | null> {
    if (!workerId) {
      console.log('📞 No worker ID provided');
      return null;
    }
    
    try {
      console.log(`📞 Fetching worker phone for ID: ${workerId}`);
      
      // Import firestore from the firebase config
      const { firestore } = require('../firebase.native');
      
      const workerDoc = await firestore()
        .collection('service_workers')
        .doc(workerId)
        .get();
      
      if (workerDoc.exists) {
        const workerData = workerDoc.data();
        
        // Try multiple possible field names for phone
        const phone = workerData?.phone || 
                     workerData?.mobile || 
                     workerData?.phoneNumber || 
                     workerData?.contactNumber || 
                     workerData?.mobileNumber ||
                     "";
        
        console.log(`📞 Worker data found:`, {
          workerId,
          name: workerData?.name || workerData?.workerName,
          phone: phone || 'No phone found',
          availableFields: Object.keys(workerData || {})
        });
        
        return phone || null;
      } else {
        console.log(`📞 No worker document found for ID: ${workerId}`);
        return null;
      }
    } catch (error) {
      console.error(`📞 Error fetching worker phone:`, error);
      return null;
    }
  }

  /**
   * Get worker details including phone number
   */
  static async getWorkerDetails(workerId: string): Promise<{
    name: string;
    phone: string;
    id: string;
  } | null> {
    if (!workerId) return null;
    
    try {
      const { firestore } = require('../firebase.native');
      
      const workerDoc = await firestore()
        .collection('service_workers')
        .doc(workerId)
        .get();
      
      if (workerDoc.exists) {
        const workerData = workerDoc.data();
        
        return {
          id: workerId,
          name: workerData?.name || workerData?.workerName || 'Unknown Worker',
          phone: workerData?.phone || 
                workerData?.mobile || 
                workerData?.phoneNumber || 
                workerData?.contactNumber || 
                workerData?.mobileNumber || ''
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching worker details:', error);
      return null;
    }
  }

  /**
   * Debug worker phone data structure
   */
  static async debugWorkerPhoneData(workerId: string): Promise<void> {
    console.log(`🔍 Debugging worker phone data for ID: ${workerId}`);
    
    try {
      const { firestore } = require('../firebase.native');
      
      const workerDoc = await firestore()
        .collection('service_workers')
        .doc(workerId)
        .get();
      
      if (workerDoc.exists) {
        const workerData = workerDoc.data();
        
        console.log('📋 Complete worker document:', workerData);
        console.log('📋 Available fields:', Object.keys(workerData || {}));
        
        // Check all possible phone fields
        const phoneFields = [
          'phone', 'mobile', 'phoneNumber', 'contactNumber', 
          'mobileNumber', 'contact', 'phoneNo', 'mobileNo'
        ];
        
        console.log('📞 Phone field analysis:');
        phoneFields.forEach(field => {
          const value = workerData?.[field];
          if (value) {
            console.log(`  ✅ ${field}: ${value}`);
          } else {
            console.log(`  ❌ ${field}: not found`);
          }
        });
        
      } else {
        console.log(`❌ Worker document not found for ID: ${workerId}`);
      }
    } catch (error) {
      console.error('❌ Error debugging worker phone data:', error);
    }
  }

  /**
   * Test worker phone fetching for a booking
   */
  static async testWorkerPhoneForBooking(bookingId: string): Promise<void> {
    console.log(`🧪 Testing worker phone fetching for booking: ${bookingId}`);
    
    try {
      const { firestore } = require('../firebase.native');
      
      // Get booking data
      const bookingDoc = await firestore()
        .collection('service_bookings')
        .doc(bookingId)
        .get();
      
      if (!bookingDoc.exists) {
        console.log('❌ Booking not found');
        return;
      }
      
      const bookingData = bookingDoc.data();
      const workerId = bookingData?.workerId || bookingData?.technicianId;
      
      console.log('📋 Booking worker info:', {
        bookingId,
        workerId,
        workerName: bookingData?.workerName || bookingData?.technicianName
      });
      
      if (workerId) {
        await this.debugWorkerPhoneData(workerId);
        const phone = await this.fetchWorkerPhone(workerId);
        console.log(`📞 Final result - Worker phone: ${phone || 'Not found'}`);
      } else {
        console.log('❌ No worker ID found in booking');
      }
      
    } catch (error) {
      console.error('❌ Error testing worker phone for booking:', error);
    }
  }
}

// Usage examples:
//
// Fetch worker phone:
// const phone = await WorkerPhoneUtils.fetchWorkerPhone('worker123');
//
// Get complete worker details:
// const worker = await WorkerPhoneUtils.getWorkerDetails('worker123');
//
// Debug worker phone data:
// await WorkerPhoneUtils.debugWorkerPhoneData('worker123');
//
// Test for a specific booking:
// await WorkerPhoneUtils.testWorkerPhoneForBooking('booking123');