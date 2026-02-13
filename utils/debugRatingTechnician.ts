/**
 * Test utility to verify technician information in ratings
 */

import { FirestoreService } from '../services/firestoreService';

export class RatingTechnicianDebug {
  /**
   * Debug technician information in rating submission
   */
  static async debugTechnicianRating(bookingId: string) {
    console.log('🔧 Debugging technician information in rating...');
    
    try {
      // Step 1: Get booking details
      console.log('Step 1: Getting booking details...');
      const booking = await FirestoreService.getServiceBookingById(bookingId);
      
      if (!booking) {
        console.log('❌ Booking not found');
        return;
      }
      
      console.log('📋 Booking worker info:', {
        bookingId: booking.id,
        workerId: booking.workerId,
        workerName: booking.workerName,
        technicianId: booking.technicianId, // Legacy field
        technicianName: booking.technicianName, // Legacy field
        companyId: booking.companyId,
        status: booking.status,
        serviceName: booking.serviceName
      });
      
      // Step 2: Check if rating exists
      console.log('Step 2: Checking existing rating...');
      const hasRating = await FirestoreService.hasBookingBeenRated(bookingId);
      console.log(`Rating exists: ${hasRating}`);
      
      // Step 3: Verify worker data completeness
      console.log('Step 3: Verifying worker data completeness...');
      const hasWorkerId = !!(booking.workerId && booking.workerId.trim());
      const hasWorkerName = !!(booking.workerName && booking.workerName.trim());
      const hasTechnicianId = !!(booking.technicianId && booking.technicianId.trim());
      const hasTechnicianName = !!(booking.technicianName && booking.technicianName.trim());
      const hasCompanyId = !!(booking.companyId && booking.companyId.trim());
      
      console.log('✅ Worker data completeness:', {
        hasWorkerId,
        hasWorkerName,
        hasTechnicianId, // Legacy
        hasTechnicianName, // Legacy
        hasCompanyId,
        isComplete: (hasWorkerId && hasWorkerName) || (hasTechnicianId && hasTechnicianName),
        workerIdLength: booking.workerId?.length || 0,
        workerNameLength: booking.workerName?.length || 0,
        fallbackAvailable: hasCompanyId || booking.serviceName
      });
      
      if (!hasWorkerId && !hasTechnicianId) {
        console.log('⚠️ WARNING: No worker/technician ID found in booking!');
      }
      if (!hasWorkerName && !hasTechnicianName) {
        console.log('⚠️ WARNING: No worker/technician name found in booking!');
        console.log('   The system will use fallback logic:');
        if (hasCompanyId) {
          console.log(`   - Will try to use company name from companyId: ${booking.companyId}`);
        } else {
          console.log(`   - Will use service name as fallback: ${booking.serviceName} Provider`);
        }
      }
      
      return {
        booking,
        hasRating,
        hasWorkerInfo: (hasWorkerId && hasWorkerName) || (hasTechnicianId && hasTechnicianName),
        hasFallback: hasCompanyId || booking.serviceName
      };
      
    } catch (error) {
      console.error('❌ Debug failed:', error);
      return null;
    }
  }
  
  /**
   * Test rating submission with technician info
   */
  static async testRatingWithTechnician(bookingId: string, rating: number, feedback: string) {
    console.log('🧪 Testing rating submission with technician info...');
    
    try {
      // Debug before submission
      const debugResult = await this.debugTechnicianRating(bookingId);
      
      if (!debugResult) {
        console.log('❌ Cannot proceed with test - debug failed');
        return;
      }
      
      if (debugResult.hasRating) {
        console.log('⚠️ Booking already has a rating - skipping submission test');
        return;
      }
      
      // Submit rating
      console.log('Submitting test rating...');
      await FirestoreService.submitBookingRating(bookingId, rating, feedback);
      
      // Verify the rating was created with worker info
      console.log('Checking rating after submission...');
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for Firestore
      
      const hasRatingAfter = await FirestoreService.hasBookingBeenRated(bookingId);
      console.log(`✅ Rating created successfully: ${hasRatingAfter}`);
      
    } catch (error) {
      console.error('❌ Test failed:', error);
    }
  }

  /**
   * Fix missing worker info in a booking
   */
  static async fixBookingWorkerInfo(
    bookingId: string, 
    workerId: string, 
    workerName: string
  ) {
    console.log('🔧 Fixing worker info in booking...');
    
    try {
      await FirestoreService.updateBookingTechnicianInfo(bookingId, workerId, workerName);
      console.log('✅ Worker info updated successfully');
      
      // Verify the update
      const booking = await FirestoreService.getServiceBookingById(bookingId);
      if (booking) {
        console.log('✅ Verification - Updated booking worker info:', {
          workerId: booking.workerId,
          workerName: booking.workerName,
          technicianId: booking.technicianId, // Legacy field
          technicianName: booking.technicianName // Legacy field
        });
      }
    } catch (error) {
      console.error('❌ Failed to fix worker info:', error);
    }
  }
}