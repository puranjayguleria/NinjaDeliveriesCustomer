/**
 * Example usage of the enhanced rating system with technician information
 */

import { RatingTechnicianDebug } from './debugRatingTechnician';
import { FirestoreService } from '../services/firestoreService';

export class RatingTechnicianExample {
  /**
   * Example: Debug a booking's technician information
   */
  static async exampleDebugBooking() {
    const bookingId = 'your-booking-id-here';
    
    console.log('📋 Example: Debugging booking technician info...');
    const result = await RatingTechnicianDebug.debugTechnicianRating(bookingId);
    
    if (result) {
      console.log('Debug result:', result);
    }
  }

  /**
   * Example: Fix a booking that's missing worker information
   */
  static async exampleFixBooking() {
    const bookingId = 'your-booking-id-here';
    const workerId = 'worker123';
    const workerName = 'John Smith';
    
    console.log('🔧 Example: Fixing booking worker info...');
    await RatingTechnicianDebug.fixBookingWorkerInfo(bookingId, workerId, workerName);
  }

  /**
   * Example: Submit a rating with worker information
   */
  static async exampleSubmitRating() {
    const bookingId = 'your-booking-id-here';
    const rating = 5;
    const feedback = 'Excellent service from the worker!';
    
    console.log('⭐ Example: Submitting rating with worker info...');
    
    try {
      await FirestoreService.submitBookingRating(bookingId, rating, feedback);
      console.log('✅ Rating submitted successfully!');
      
      // The rating will now include:
      // - workerId (from booking or fallback)
      // - workerName (from booking, company name, or service provider fallback)
      // - rating and feedback
      // - all other booking details
      
    } catch (error: any) {
      if (error.message === 'You have already rated this booking') {
        console.log('⚠️ This booking has already been rated');
      } else {
        console.error('❌ Failed to submit rating:', error);
      }
    }
  }

  /**
   * Example: Check what worker info will be used for rating
   */
  static async examplePreviewWorkerInfo(bookingId: string) {
    console.log('👀 Example: Previewing worker info for rating...');
    
    try {
      const booking = await FirestoreService.getServiceBookingById(bookingId);
      
      if (!booking) {
        console.log('❌ Booking not found');
        return;
      }

      // This is what will be shown in the UI and saved in the rating
      const displayName = booking.workerName || booking.technicianName || `${booking.serviceName} Provider`;
      const workerId = booking.workerId || booking.technicianId || booking.companyId || '';
      
      console.log('📋 Worker info that will be used:', {
        displayName,
        workerId,
        source: booking.workerName ? 'worker_fields' : booking.technicianName ? 'legacy_fields' : 'fallback'
      });
      
      return { displayName, workerId };
      
    } catch (error) {
      console.error('❌ Failed to preview worker info:', error);
    }
  }
}

// Usage examples:
// 
// 1. Debug a booking:
// await RatingTechnicianExample.exampleDebugBooking();
//
// 2. Fix missing worker info:
// await RatingTechnicianExample.exampleFixBooking();
//
// 3. Submit a rating:
// await RatingTechnicianExample.exampleSubmitRating();
//
// 4. Preview worker info:
// await RatingTechnicianExample.examplePreviewWorkerInfo('booking-id');