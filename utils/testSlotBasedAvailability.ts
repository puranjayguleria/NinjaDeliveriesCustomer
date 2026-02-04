/**
 * Test utility for slot-based worker availability system
 * 
 * Usage: Call these functions from your app to test the new functionality
 */

import { FirestoreService } from '../services/firestoreService';
import { WorkerAvailabilityUtils } from './workerAvailabilityUtils';

export class SlotAvailabilityTester {
  
  /**
   * Test basic company availability checking
   */
  static async testBasicAvailability() {
    console.log('🧪 Testing basic company availability...');
    
    try {
      // Test with sample data - replace with your actual company IDs
      const testCompanyId = 'test_company_1';
      const testDate = '2026-02-05'; // Tomorrow
      const testTime = '1:00 PM - 3:00 PM';
      const testService = 'electrician';
      
      console.log(`Testing: Company ${testCompanyId}, Date: ${testDate}, Time: ${testTime}, Service: ${testService}`);
      
      const result = await FirestoreService.checkCompanyWorkerAvailability(
        testCompanyId,
        testDate,
        testTime,
        testService
      );
      
      console.log('✅ Basic availability test result:', result);
      
      return result;
    } catch (error) {
      console.error('❌ Basic availability test failed:', error);
      return null;
    }
  }
  
  /**
   * Test enhanced company availability with detailed worker info
   */
  static async testEnhancedAvailability() {
    console.log('🧪 Testing enhanced company availability...');
    
    try {
      const testCompanyId = 'test_company_1';
      const testDate = '2026-02-05';
      const testTime = '1:00 PM - 3:00 PM';
      const testService = 'electrician';
      
      const summary = await WorkerAvailabilityUtils.getCompanyAvailabilitySummary(
        testCompanyId,
        testService,
        testDate,
        testTime
      );
      
      console.log('✅ Enhanced availability test result:', summary);
      
      return summary;
    } catch (error) {
      console.error('❌ Enhanced availability test failed:', error);
      return null;
    }
  }
  
  /**
   * Test slot-based company filtering
   */
  static async testSlotBasedFiltering() {
    console.log('🧪 Testing slot-based company filtering...');
    
    try {
      const testCategoryId = 'electrician_category';
      const testIssueIds = ['issue_1', 'issue_2'];
      const testDate = '2026-02-05';
      const testTime = '1:00 PM - 3:00 PM';
      const testService = 'electrician';
      
      const companies = await FirestoreService.getCompaniesWithSlotAvailability(
        testCategoryId,
        testIssueIds,
        testDate,
        testTime,
        testService
      );
      
      console.log(`✅ Found ${companies.length} companies with slot availability:`);
      companies.forEach((company, index) => {
        console.log(`${index + 1}. ${company.companyName || company.serviceName}:`);
        console.log(`   Status: ${company.availabilityInfo.status}`);
        console.log(`   Message: ${company.availabilityInfo.statusMessage}`);
        console.log(`   Workers: ${company.availabilityInfo.availableWorkers}/${company.availabilityInfo.totalWorkers}`);
      });
      
      return companies;
    } catch (error) {
      console.error('❌ Slot-based filtering test failed:', error);
      return [];
    }
  }
  
  /**
   * Test time slot parsing
   */
  static testTimeSlotParsing() {
    console.log('🧪 Testing time slot parsing...');
    
    const testSlots = [
      '9:00 AM - 11:00 AM',
      '11:00 AM - 1:00 PM',
      '1:00 PM - 3:00 PM',
      '3:00 PM - 5:00 PM',
      '5:00 PM - 7:00 PM',
      '7:00 PM - 9:00 PM'
    ];
    
    testSlots.forEach(slot => {
      const parsed = WorkerAvailabilityUtils.parseTimeSlot(slot);
      console.log(`Slot: "${slot}" → Start: ${parsed?.startTime}, End: ${parsed?.endTime}`);
    });
    
    return testSlots;
  }
  
  /**
   * Create sample worker data for testing
   */
  static async createSampleWorkerData() {
    console.log('🧪 Creating sample worker data for testing...');
    
    try {
      const { firestore } = require('../firebase.native');
      
      const sampleWorkers = [
        {
          name: 'राम कुमार',
          companyId: 'test_company_1',
          services: ['electrician', 'plumber'],
          isActive: true,
          phone: '+91-9876543210',
          workingHours: { start: '09:00', end: '18:00' },
          workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
          maxBookingsPerSlot: 1
        },
        {
          name: 'श्याम सिंह',
          companyId: 'test_company_1',
          services: ['electrician'],
          isActive: true,
          phone: '+91-9876543211',
          workingHours: { start: '10:00', end: '20:00' },
          workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          maxBookingsPerSlot: 2
        },
        {
          name: 'गीता देवी',
          companyId: 'test_company_1',
          services: ['cleaning'],
          isActive: false, // Inactive worker
          phone: '+91-9876543212',
          workingHours: { start: '08:00', end: '16:00' },
          workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          maxBookingsPerSlot: 1
        }
      ];
      
      const batch = firestore().batch();
      
      sampleWorkers.forEach((worker, index) => {
        const docRef = firestore().collection('service_workers').doc(`test_worker_${index + 1}`);
        batch.set(docRef, {
          ...worker,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      });
      
      await batch.commit();
      
      console.log('✅ Sample worker data created successfully');
      console.log('Sample workers:', sampleWorkers.map(w => ({ name: w.name, services: w.services, isActive: w.isActive })));
      
      return sampleWorkers;
    } catch (error) {
      console.error('❌ Failed to create sample worker data:', error);
      return [];
    }
  }
  
  /**
   * Create sample booking data for testing busy workers
   */
  static async createSampleBookingData() {
    console.log('🧪 Creating sample booking data for testing...');
    
    try {
      const { firestore } = require('../firebase.native');
      
      const sampleBookings = [
        {
          serviceName: 'Electrical Repair',
          workerId: 'test_worker_1',
          workerName: 'राम कुमार',
          companyId: 'test_company_1',
          date: '2026-02-05',
          time: '1:00 PM - 3:00 PM',
          status: 'assigned',
          customerName: 'Test Customer 1',
          customerPhone: '+91-9999999999',
          customerAddress: 'Test Address 1',
          customerId: 'test_customer_1',
          totalPrice: 500,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          serviceName: 'Plumbing Work',
          workerId: 'test_worker_2',
          workerName: 'श्याम सिंह',
          companyId: 'test_company_1',
          date: '2026-02-05',
          time: '3:00 PM - 5:00 PM',
          status: 'started',
          customerName: 'Test Customer 2',
          customerPhone: '+91-9999999998',
          customerAddress: 'Test Address 2',
          customerId: 'test_customer_2',
          totalPrice: 800,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      
      const batch = firestore().batch();
      
      sampleBookings.forEach((booking, index) => {
        const docRef = firestore().collection('service_bookings').doc(`test_booking_${index + 1}`);
        batch.set(docRef, booking);
      });
      
      await batch.commit();
      
      console.log('✅ Sample booking data created successfully');
      console.log('Sample bookings:', sampleBookings.map(b => ({ 
        worker: b.workerName, 
        date: b.date, 
        time: b.time, 
        status: b.status 
      })));
      
      return sampleBookings;
    } catch (error) {
      console.error('❌ Failed to create sample booking data:', error);
      return [];
    }
  }
  
  /**
   * Run all tests
   */
  static async runAllTests() {
    console.log('🧪 Running all slot-based availability tests...');
    
    try {
      // 1. Test time slot parsing
      console.log('\n--- Test 1: Time Slot Parsing ---');
      this.testTimeSlotParsing();
      
      // 2. Create sample data
      console.log('\n--- Test 2: Creating Sample Data ---');
      await this.createSampleWorkerData();
      await this.createSampleBookingData();
      
      // 3. Test basic availability
      console.log('\n--- Test 3: Basic Availability ---');
      await this.testBasicAvailability();
      
      // 4. Test enhanced availability
      console.log('\n--- Test 4: Enhanced Availability ---');
      await this.testEnhancedAvailability();
      
      // 5. Test slot-based filtering
      console.log('\n--- Test 5: Slot-based Filtering ---');
      await this.testSlotBasedFiltering();
      
      console.log('\n✅ All tests completed!');
      
    } catch (error) {
      console.error('❌ Test suite failed:', error);
    }
  }
}

// Export for easy testing
export default SlotAvailabilityTester;