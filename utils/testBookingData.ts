import { FirestoreService } from '../services/firestoreService';

/**
 * Test utility to create sample bookings for demonstration
 */
export class TestBookingData {
  
  /**
   * Create sample bookings with different statuses for logged-in user
   */
  static async createSampleBookings(): Promise<void> {
    try {
      console.log('🧪 Creating sample bookings for logged-in user...');

      if (!FirestoreService.isUserLoggedIn()) {
        throw new Error('Please log in to create sample bookings');
      }

      const userId = FirestoreService.getCurrentUserId();
      console.log(`Creating bookings for logged-in user: ${userId}`);

      // Sample booking 1: Pending
      const booking1 = {
        serviceName: 'Electrical Repair',
        workName: 'Fix ceiling fan and switch board',
        customerName: 'John Doe',
        customerPhone: '+91 9876543210',
        customerAddress: '123 Main Street, City',
        date: new Date().toISOString().split('T')[0], // Today
        time: '10:00 AM',
        status: 'pending' as const,
        estimatedDuration: 2,
        totalPrice: 500,
        location: {
          lat: 28.6139,
          lng: 77.2090,
          address: '123 Main Street, City',
          houseNo: '123',
          placeLabel: 'Main Street Area',
        },
      };

      // Sample booking 2: Started (with completion OTP)
      const booking2 = {
        serviceName: 'Plumbing Service',
        workName: 'Fix kitchen sink leak',
        customerName: 'Jane Smith',
        customerPhone: '+91 9876543211',
        customerAddress: '456 Oak Avenue, City',
        date: new Date().toISOString().split('T')[0], // Today
        time: '2:00 PM',
        status: 'started' as const,
        technicianName: 'Mike Wilson',
        technicianId: 'tech_001',
        estimatedDuration: 1,
        completionOtp: '4567', // Make sure OTP is included
        startedAt: new Date(Date.now() - 30 * 60 * 1000), // Started 30 minutes ago
        totalPrice: 300,
        location: {
          lat: 28.6200,
          lng: 77.2100,
          address: '456 Oak Avenue, City',
          houseNo: '456',
          placeLabel: 'Oak Avenue Area',
        },
      };

      // Sample booking 3: Completed
      const booking3 = {
        serviceName: 'Home Cleaning',
        workName: 'Deep cleaning of 2BHK apartment',
        customerName: 'Bob Johnson',
        customerPhone: '+91 9876543212',
        customerAddress: '789 Pine Street, City',
        date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Yesterday
        time: '9:00 AM',
        status: 'completed' as const,
        technicianName: 'Sarah Davis',
        technicianId: 'tech_002',
        estimatedDuration: 3,
        completionOtp: '8901',
        completionOtpVerified: true,
        startedAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // Started yesterday
        completedAt: new Date(Date.now() - 22 * 60 * 60 * 1000), // Completed yesterday
        totalPrice: 800,
        customerRating: 5,
        customerFeedback: 'Excellent service! Very professional and thorough.',
        location: {
          lat: 28.6250,
          lng: 77.2150,
          address: '789 Pine Street, City',
          houseNo: '789',
          placeLabel: 'Pine Street Area',
        },
      };

      // Create the bookings (customerId will be automatically set to logged-in user)
      const id1 = await FirestoreService.createServiceBooking(booking1);
      const id2 = await FirestoreService.createServiceBooking(booking2);
      const id3 = await FirestoreService.createServiceBooking(booking3);

      console.log('✅ Sample user bookings created:');
      console.log(`   - Pending booking: ${id1}`);
      console.log(`   - Started booking: ${id2} (OTP: ${booking2.completionOtp})`);
      console.log(`   - Completed booking: ${id3}`);
      console.log(`   - All bookings created for logged-in user: ${userId}`);

    } catch (error: any) {
      console.error('❌ Error creating sample bookings:', error);
      throw error;
    }
  }

  /**
   * Test the OTP completion flow
   */
  static async testOtpCompletion(bookingId: string, otp: string): Promise<void> {
    try {
      console.log(`🧪 Testing OTP completion for booking ${bookingId} with OTP ${otp}...`);
      
      const success = await FirestoreService.completeServiceWithOtp(bookingId, otp);
      
      if (success) {
        console.log('✅ Service completed successfully with OTP verification!');
      } else {
        console.log('❌ Invalid OTP provided');
      }
    } catch (error: any) {
      console.error('❌ Error testing OTP completion:', error);
    }
  }

  /**
   * Create a single test booking with OTP for current user
   */
  static async createTestBookingWithOtp(): Promise<string> {
    try {
      console.log('🧪 Creating test booking with OTP for current user...');

      const userId = FirestoreService.getCurrentUserId();

      const testBooking = {
        serviceName: 'Test Electrical Service',
        workName: 'Fix test switch - OTP Test',
        customerName: 'Test Customer',
        customerPhone: '+91 9999999999',
        customerAddress: 'Test Address, Test City',
        customerId: userId, // Set current user ID
        date: new Date().toISOString().split('T')[0], // Today
        time: '3:00 PM',
        status: 'started' as const,
        technicianName: 'Test Technician',
        technicianId: 'test_tech_001',
        estimatedDuration: 2,
        startOtp: '1234',
        completionOtp: '5678',
        otpVerified: false,
        completionOtpVerified: false,
        startedAt: new Date(),
        totalPrice: 400,
        location: {
          lat: 28.6300,
          lng: 77.2200,
          address: 'Test Address, Test City',
          houseNo: 'Test House',
          placeLabel: 'Test Area',
        },
      };

      const bookingId = await FirestoreService.createServiceBooking(testBooking);
      
      console.log(`✅ Created test booking with ID: ${bookingId} for user: ${userId}`);
      console.log(`   - Start OTP: ${testBooking.startOtp}`);
      console.log(`   - Completion OTP: ${testBooking.completionOtp}`);
      console.log(`   - Status: ${testBooking.status}`);
      
      return bookingId;
    } catch (error: any) {
      console.error('❌ Error creating test booking:', error);
      throw error;
    }
  }

  /**
   * Add OTP to existing started bookings (for testing)
   */
  static async addOtpToStartedBookings(): Promise<void> {
    try {
      console.log('🔧 Adding OTP to existing started bookings...');
      
      const bookings = await this.getServiceBookings(20);
      const startedBookings = bookings.filter(b => b.status === 'started');
      
      console.log(`Found ${startedBookings.length} started bookings`);
      
      for (const booking of startedBookings) {
        if (!booking.completionOtp && !booking.startOtp) {
          const otp = this.generateCompletionOtp();
          
          await firestore()
            .collection('service_bookings')
            .doc(booking.id)
            .update({
              completionOtp: otp,
              startOtp: otp, // Also add as startOtp for fallback
              updatedAt: new Date(),
            });
          
          console.log(`✅ Added OTP ${otp} to booking ${booking.id} (${booking.serviceName})`);
        } else {
          console.log(`⚠️ Booking ${booking.id} already has OTP: completion=${booking.completionOtp}, start=${booking.startOtp}`);
        }
      }
      
      console.log('✅ Finished adding OTPs to started bookings');
    } catch (error: any) {
      console.error('❌ Error adding OTPs to bookings:', error);
    }
  }

  /**
   * Update existing bookings with current user ID (for migration)
   */
  static async updateExistingBookingsWithUserId(): Promise<void> {
    try {
      console.log('🔧 Updating existing bookings with current user ID...');
      await FirestoreService.updateExistingBookingsWithUserId();
      console.log('✅ Finished updating existing bookings');
    } catch (error: any) {
      console.error('❌ Error updating existing bookings:', error);
    }
  }

  /**
   * Debug method to check user bookings
   */
  static async debugUserBookings(): Promise<void> {
    try {
      const userId = FirestoreService.getCurrentUserId();
      console.log(`🔍 Debugging bookings for user: ${userId}`);
      
      const userBookings = await FirestoreService.getUserBookings(10);
      
      console.log(`Found ${userBookings.length} bookings for user ${userId}:`);
      
      userBookings.forEach((booking, index) => {
        console.log(`${index + 1}. ${booking.serviceName} (${booking.status})`);
        console.log(`   - ID: ${booking.id}`);
        console.log(`   - Customer ID: ${booking.customerId}`);
        console.log(`   - Customer Name: ${booking.customerName}`);
        console.log(`   - Start OTP: ${booking.startOtp || 'None'}`);
        console.log(`   - Completion OTP: ${booking.completionOtp || 'None'}`);
        console.log(`   - Status: ${booking.status}`);
        console.log('---');
      });
      
      const startedBookings = userBookings.filter(b => b.status === 'started');
      console.log(`\n📊 User's started bookings with OTP: ${startedBookings.length}`);
      
      startedBookings.forEach(booking => {
        console.log(`✅ ${booking.serviceName}: OTP = ${booking.completionOtp || 'MISSING!'}`);
      });
      
    } catch (error: any) {
      console.error('❌ Error debugging user bookings:', error);
    }
  }

  /**
   * Debug method to check OTP in bookings
   */
  static async debugOtpInBookings(): Promise<void> {
    try {
      console.log('🔍 Debugging OTP in bookings...');
      
      const bookings = await FirestoreService.getServiceBookings(10);
      
      console.log(`Found ${bookings.length} bookings:`);
      
      bookings.forEach((booking, index) => {
        console.log(`${index + 1}. ${booking.serviceName} (${booking.status})`);
        console.log(`   - ID: ${booking.id}`);
        console.log(`   - Start OTP: ${booking.startOtp || 'None'}`);
        console.log(`   - Completion OTP: ${booking.completionOtp || 'None'}`);
        console.log(`   - Status: ${booking.status}`);
        console.log(`   - Started At: ${booking.startedAt ? 'Yes' : 'No'}`);
        console.log('---');
      });
      
      const startedBookings = bookings.filter(b => b.status === 'started');
      console.log(`\n📊 Started bookings with OTP: ${startedBookings.length}`);
      
      startedBookings.forEach(booking => {
        console.log(`✅ ${booking.serviceName}: OTP = ${booking.completionOtp || 'MISSING!'}`);
      });
      
    } catch (error: any) {
      console.error('❌ Error debugging OTP:', error);
    }
  }
  static async testStartService(bookingId: string): Promise<void> {
    try {
      console.log(`🧪 Testing service start for booking ${bookingId}...`);
      
      const completionOtp = await FirestoreService.startServiceWithOtp(bookingId);
      
      console.log(`✅ Service started! Completion OTP: ${completionOtp}`);
      console.log('Give this OTP to the company when service is completed.');
    } catch (error: any) {
      console.error('❌ Error testing service start:', error);
    }
  }
}