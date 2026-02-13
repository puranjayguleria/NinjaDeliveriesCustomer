/**
 * Test utility to verify rating prevention functionality
 */

import { FirestoreService } from '../services/firestoreService';

export class RatingPreventionTest {
  /**
   * Test the rating prevention logic
   */
  static async testRatingPrevention(bookingId: string) {
    console.log('🧪 Testing rating prevention logic...');
    
    try {
      // Test 1: Check if booking has been rated
      console.log('Test 1: Checking rating status...');
      const hasBeenRated = await FirestoreService.hasBookingBeenRated(bookingId);
      console.log(`✅ Rating status check result: ${hasBeenRated}`);
      
      // Test 2: Try to submit a rating
      console.log('Test 2: Attempting to submit rating...');
      try {
        await FirestoreService.submitBookingRating(bookingId, 5, 'Test feedback');
        console.log('✅ Rating submitted successfully (first time)');
      } catch (error: any) {
        console.log(`❌ Rating submission failed: ${error.message}`);
      }
      
      // Test 3: Try to submit another rating (should fail)
      console.log('Test 3: Attempting to submit duplicate rating...');
      try {
        await FirestoreService.submitBookingRating(bookingId, 4, 'Another test feedback');
        console.log('❌ PROBLEM: Duplicate rating was allowed!');
      } catch (error: any) {
        console.log(`✅ Duplicate rating prevented: ${error.message}`);
      }
      
      // Test 4: Check rating status again
      console.log('Test 4: Checking rating status after submission...');
      const hasBeenRatedAfter = await FirestoreService.hasBookingBeenRated(bookingId);
      console.log(`✅ Rating status after submission: ${hasBeenRatedAfter}`);
      
      console.log('🧪 Rating prevention test completed!');
      
    } catch (error) {
      console.error('❌ Test failed:', error);
    }
  }
}