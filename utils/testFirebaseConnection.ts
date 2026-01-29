import { FirestoreService } from '../services/firestoreService';

/**
 * Test Firebase connection and service_bookings collection
 */
export class FirebaseConnectionTest {
  
  /**
   * Test creating a booking in Firebase
   */
  static async testCreateBooking(): Promise<void> {
    try {
      console.log('🔥 Testing Firebase connection to service_bookings...');
      
      const testBookingData = {
        companyId: 'test-company-id',
        customerName: 'Test Customer',
        serviceName: 'Test Service',
        date: '2026-02-15',
        time: '10:00 AM',
        status: 'pending' as const,
        workName: 'Test work description',
        otherVerified: false,
        startOtp: null,
      };

      const bookingId = await FirestoreService.createServiceBooking(testBookingData);
      console.log('✅ Test booking created successfully with ID:', bookingId);
      
      // Test fetching the booking back
      const fetchedBooking = await FirestoreService.getServiceBookingById(bookingId);
      console.log('✅ Test booking fetched successfully:', fetchedBooking);
      
      return;
    } catch (error) {
      console.error('❌ Firebase connection test failed:', error);
      throw error;
    }
  }

  /**
   * Test fetching all bookings
   */
  static async testFetchBookings(): Promise<void> {
    try {
      console.log('🔥 Testing fetch all bookings...');
      
      const bookings = await FirestoreService.getServiceBookings(5);
      console.log(`✅ Fetched ${bookings.length} bookings from Firebase`);
      
      bookings.forEach((booking, index) => {
        console.log(`📋 Booking ${index + 1}:`, {
          id: booking.id,
          customerName: booking.customerName,
          serviceName: booking.serviceName,
          status: booking.status,
          date: booking.date,
          time: booking.time
        });
      });
      
    } catch (error) {
      console.error('❌ Fetch bookings test failed:', error);
      throw error;
    }
  }

  /**
   * Test updating a booking
   */
  static async testUpdateBooking(bookingId: string): Promise<void> {
    try {
      console.log('🔥 Testing booking update...');
      
      await FirestoreService.updateServiceBooking(bookingId, {
        status: 'confirmed',
        otherVerified: true
      });
      
      console.log('✅ Booking updated successfully');
      
      // Verify the update
      const updatedBooking = await FirestoreService.getServiceBookingById(bookingId);
      console.log('✅ Updated booking verified:', {
        status: updatedBooking?.status,
        otherVerified: updatedBooking?.otherVerified
      });
      
    } catch (error) {
      console.error('❌ Update booking test failed:', error);
      throw error;
    }
  }

  /**
   * Run all tests
   */
  static async runAllTests(): Promise<void> {
    try {
      console.log('🚀 Starting Firebase service_bookings collection tests...');
      
      // Test 1: Create booking
      await this.testCreateBooking();
      
      // Test 2: Fetch bookings
      await this.testFetchBookings();
      
      console.log('🎉 All Firebase tests passed successfully!');
      
    } catch (error) {
      console.error('💥 Firebase tests failed:', error);
      throw error;
    }
  }
}