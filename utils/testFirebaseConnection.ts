import { FirestoreService } from '../services/firestoreService';

/**
 * Test Firebase connection and service_bookings collection
 */
export class FirebaseConnectionTest {
  
  /**
   * Test creating a booking in Firebase (matches website structure)
   */
  static async testCreateBooking(): Promise<void> {
    try {
      console.log('🔥 Testing Firebase connection to service_bookings...');
      
      const testBookingData = {
        companyId: 'PLbLmI2YMOSLBuLa2wOPHkgbkkI',
        customerName: 'Test Customer',
        serviceName: 'Test Service',
        date: '2026-02-15',
        time: '10:00 AM',
        status: 'pending' as const,
        phone: '9876543210',
        address: 'Test Address',
        totalPrice: 500,
        addOns: [
          { name: 'Extra cleaning', price: 100 }
        ],
        workName: 'Test work description',
      };

      console.log('📋 Test booking data:', testBookingData);

      const bookingId = await FirestoreService.createServiceBooking(testBookingData);
      console.log('✅ Test booking created successfully with ID:', bookingId);
      
      // Test fetching the booking back
      const fetchedBooking = await FirestoreService.getServiceBookingById(bookingId);
      console.log('✅ Test booking fetched successfully:', fetchedBooking);
      
      return;
    } catch (error) {
      console.error('❌ Firebase connection test failed:', error);
      console.error('❌ Test error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
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
      
      // Test 3: Real-time updates
      await this.testRealTimeUpdates();
      
      console.log('🎉 All Firebase tests passed successfully!');
      
    } catch (error) {
      console.error('💥 Firebase tests failed:', error);
      throw error;
    }
  }
}