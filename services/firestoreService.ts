import { firestore } from '../firebase.native';
import { ensureFirebaseReady } from '../firebase.native';

export interface ServiceCategory {
  id: string;
  name: string;
  isActive: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface ServiceIssue {
  id: string;
  name: string;
  categoryMasterId: string;
  companyId?: string;
  isActive: boolean;
  serviceType?: string;
  price?: number;
  packages?: any[];
  createdAt?: any;
  updatedAt?: any;
}

export interface ServiceCompany {
  id: string;
  companyName: string;
  name: string; // Owner name
  phone: string;
  email: string;
  deliveryZoneId: string;
  deliveryZoneName: string;
  type: string; // "service" type
  isActive: boolean;
  createdAt: any;
}

export interface ServiceBooking {
  id?: string;
  companyId: string;
  customerName: string;
  serviceName: string;
  date: string; // Format: "YYYY-MM-DD"
  time: string; // Format: "H:MM AM/PM"
  status: 'pending' | 'assigned' | 'started' | 'completed' | 'rejected' | 'expired';
  workName?: string; // Optional - for backward compatibility
  otherVerified?: boolean; // Optional - for backward compatibility
  startOtp?: string | null;
  otpVerified?: boolean;
  technicianName?: string;
  phone?: string;
  address?: string;
  totalPrice?: number;
  addOns?: Array<{
    name: string;
    price: number;
  }>;
  createdAt: any;
  startedAt?: any;
  completedAt?: any;
  expiredAt?: any;
}

export class FirestoreService {
  // Cache for service categories to avoid repeated fetches
  private static categoriesCache: ServiceCategory[] | null = null;
  private static cacheTimestamp: number = 0;
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Fetch all service categories from Firestore with caching
   */
  static async getServiceCategories(): Promise<ServiceCategory[]> {
    try {
      // Check if we have valid cached data
      const now = Date.now();
      if (
        this.categoriesCache && 
        this.cacheTimestamp && 
        (now - this.cacheTimestamp) < this.CACHE_DURATION
      ) {
        console.log('Returning cached service categories');
        return this.categoriesCache;
      }

      console.log('Fetching service categories from Firestore...');
      
      const snapshot = await firestore()
        .collection('service_categories_master')
        .where('isActive', '==', true)
        .get();

      const categories: ServiceCategory[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        categories.push({
          id: doc.id,
          name: data.name || '',
          isActive: data.isActive || false,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      });

      // Sort by name on the client side
      categories.sort((a, b) => a.name.localeCompare(b.name));

      console.log(`Fetched ${categories.length} service categories from Firestore`);
      
      // Cache the results
      this.categoriesCache = categories;
      this.cacheTimestamp = now;
      
      return categories;
    } catch (error) {
      console.error('Error fetching service categories from Firestore:', error);
      throw new Error('Failed to fetch service categories. Please check your internet connection.');
    }
  }

  /**
   * Clear the cache (useful for refresh operations)
   */
  static clearCache(): void {
    this.categoriesCache = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Fetch service issues for a specific category
   */
  static async getServiceIssues(categoryId: string): Promise<ServiceIssue[]> {
    try {
      console.log(`Fetching service issues for category: ${categoryId}`);
      
      const snapshot = await firestore()
        .collection('service_services')
        .where('categoryMasterId', '==', categoryId)
        .where('isActive', '==', true)
        .get();

      const issues: ServiceIssue[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        issues.push({
          id: doc.id,
          name: data.name || '',
          categoryMasterId: data.categoryMasterId || '',
          companyId: data.companyId,
          isActive: data.isActive || false,
          serviceType: data.serviceType,
          price: data.price,
          packages: data.packages,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      });

      // Sort by name on the client side
      issues.sort((a, b) => a.name.localeCompare(b.name));

      console.log(`Fetched ${issues.length} service issues for category ${categoryId}`);
      
      return issues;
    } catch (error) {
      console.error('Error fetching service issues from Firestore:', error);
      throw new Error('Failed to fetch service issues. Please check your internet connection.');
    }
  }

  /**
   * Fetch service companies that provide specific services/issues
   */
  static async getCompaniesByServiceIssues(issueIds: string[]): Promise<ServiceCompany[]> {
    try {
      console.log(`Fetching companies for service issues: ${issueIds.join(', ')}`);
      
      if (issueIds.length === 0) {
        return await this.getServiceCompanies();
      }

      // First, get the service issues to find their associated company IDs
      const issuesSnapshot = await firestore()
        .collection('service_services')
        .where('__name__', 'in', issueIds)
        .where('isActive', '==', true)
        .get();

      const companyIds = new Set<string>();
      
      issuesSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.companyId) {
          companyIds.add(data.companyId);
        }
      });

      console.log(`Found ${companyIds.size} unique companies for selected issues`);

      if (companyIds.size === 0) {
        console.log('No companies found for selected issues, returning all companies');
        return await this.getServiceCompanies();
      }

      // Convert Set to Array for Firestore query
      const companyIdsArray = Array.from(companyIds);
      
      // Firestore 'in' query has a limit of 10 items, so we need to batch if more
      const companies: ServiceCompany[] = [];
      
      // Process in batches of 10
      for (let i = 0; i < companyIdsArray.length; i += 10) {
        const batch = companyIdsArray.slice(i, i + 10);
        
        const companiesSnapshot = await firestore()
          .collection('service_company')
          .where('__name__', 'in', batch)
          .where('isActive', '==', true)
          .get();

        companiesSnapshot.forEach(doc => {
          const data = doc.data();
          companies.push({
            id: doc.id,
            companyName: data.companyName || '',
            name: data.name || '',
            phone: data.phone || '',
            email: data.email || '',
            type: data.type || '',
            deliveryZoneId: data.deliveryZoneId || '',
            deliveryZoneName: data.deliveryZoneName || '',
            isActive: data.isActive || false,
            createdAt: data.createdAt,
          });
        });
      }

      // Sort by company name
      companies.sort((a, b) => a.companyName.localeCompare(b.companyName));

      console.log(`Fetched ${companies.length} companies that provide the selected services`);
      
      return companies;
    } catch (error) {
      console.error('Error fetching companies by service issues:', error);
      throw new Error('Failed to fetch service companies. Please check your internet connection.');
    }
  }

  /**
   * Fetch service companies that provide services in a specific category
   */
  static async getCompaniesByCategory(categoryId: string): Promise<ServiceCompany[]> {
    try {
      console.log(`Fetching companies for category: ${categoryId}`);
      
      // First, get all service issues for this category
      const issuesSnapshot = await firestore()
        .collection('service_services')
        .where('categoryMasterId', '==', categoryId)
        .where('isActive', '==', true)
        .get();

      const companyIds = new Set<string>();
      
      issuesSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.companyId) {
          companyIds.add(data.companyId);
        }
      });

      console.log(`Found ${companyIds.size} unique companies for category ${categoryId}`);

      if (companyIds.size === 0) {
        console.log('No companies found for category, returning all companies');
        return await this.getServiceCompanies();
      }

      // Convert Set to Array for Firestore query
      const companyIdsArray = Array.from(companyIds);
      
      // Fetch companies in batches of 10 (Firestore 'in' query limit)
      const companies: ServiceCompany[] = [];
      
      for (let i = 0; i < companyIdsArray.length; i += 10) {
        const batch = companyIdsArray.slice(i, i + 10);
        
        const companiesSnapshot = await firestore()
          .collection('service_company')
          .where('__name__', 'in', batch)
          .where('isActive', '==', true)
          .get();

        companiesSnapshot.forEach(doc => {
          const data = doc.data();
          companies.push({
            id: doc.id,
            companyName: data.companyName || '',
            name: data.name || '',
            phone: data.phone || '',
            email: data.email || '',
            type: data.type || '',
            deliveryZoneId: data.deliveryZoneId || '',
            deliveryZoneName: data.deliveryZoneName || '',
            isActive: data.isActive || false,
            createdAt: data.createdAt,
          });
        });
      }

      // Sort by company name
      companies.sort((a, b) => a.companyName.localeCompare(b.companyName));

      console.log(`Fetched ${companies.length} companies for category ${categoryId}`);
      
      return companies;
    } catch (error) {
      console.error('Error fetching companies by category:', error);
      throw new Error('Failed to fetch companies for this category. Please check your internet connection.');
    }
  }

  /**
   * Fetch all service companies from Firestore
   */
  static async getServiceCompanies(): Promise<ServiceCompany[]> {
    try {
      console.log('Fetching service companies from Firestore...');
      
      const snapshot = await firestore()
        .collection('service_company')
        .where('isActive', '==', true)
        .get();

      const companies: ServiceCompany[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        companies.push({
          id: doc.id,
          companyName: data.companyName || '',
          name: data.name || '',
          phone: data.phone || '',
          email: data.email || '',
          type: data.type || '',
          deliveryZoneId: data.deliveryZoneId || '',
          deliveryZoneName: data.deliveryZoneName || '',
          isActive: data.isActive || false,
          createdAt: data.createdAt,
        });
      });

      // Sort by company name on the client side
      companies.sort((a, b) => a.companyName.localeCompare(b.companyName));

      console.log(`Fetched ${companies.length} service companies from Firestore`);
      
      return companies;
    } catch (error) {
      console.error('Error fetching service companies from Firestore:', error);
      throw new Error('Failed to fetch service companies. Please check your internet connection.');
    }
  }

  /**
   * Fetch service companies by delivery zone
   */
  static async getServiceCompaniesByZone(zoneId: string): Promise<ServiceCompany[]> {
    try {
      console.log(`Fetching service companies for zone: ${zoneId}`);
      
      const snapshot = await firestore()
        .collection('service_company')
        .where('deliveryZoneId', '==', zoneId)
        .where('isActive', '==', true)
        .get();

      const companies: ServiceCompany[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        companies.push({
          id: doc.id,
          companyName: data.companyName || '',
          name: data.name || '',
          phone: data.phone || '',
          email: data.email || '',
          type: data.type || '',
          deliveryZoneId: data.deliveryZoneId || '',
          deliveryZoneName: data.deliveryZoneName || '',
          isActive: data.isActive || false,
          createdAt: data.createdAt,
        });
      });

      // Sort by company name on the client side
      companies.sort((a, b) => a.companyName.localeCompare(b.companyName));

      console.log(`Fetched ${companies.length} service companies for zone ${zoneId}`);
      
      return companies;
    } catch (error) {
      console.error('Error fetching service companies by zone from Firestore:', error);
      throw new Error('Failed to fetch companies for this zone. Please check your internet connection.');
    }
  }

  /**
   * Fetch a service category by ID
   */
  static async getServiceCategoryById(categoryId: string): Promise<ServiceCategory | null> {
    try {
      const doc = await firestore()
        .collection('service_categories_master')
        .doc(categoryId)
        .get();

      if (!doc.exists) {
        return null;
      }

      const data = doc.data();
      return {
        id: doc.id,
        name: data?.name || '',
        isActive: data?.isActive || false,
        createdAt: data?.createdAt,
        updatedAt: data?.updatedAt,
      };
    } catch (error) {
      console.error('Error fetching service category by ID:', error);
      throw new Error('Failed to fetch service category. Please check your internet connection.');
    }
  }

  /**
   * Create a new service booking in Firebase (matches website structure)
   */
  static async createServiceBooking(bookingData: Omit<ServiceBooking, 'id' | 'createdAt'>): Promise<string> {
    try {
      // Ensure Firebase is initialized
      ensureFirebaseReady();
      
      console.log('🔥 Creating service booking in Firebase:', bookingData);
      
      // Validate required fields
      if (!bookingData.companyId) {
        throw new Error('Company ID is required');
      }
      if (!bookingData.customerName) {
        throw new Error('Customer name is required');
      }
      if (!bookingData.serviceName) {
        throw new Error('Service name is required');
      }
      
      const bookingDoc = {
        companyId: bookingData.companyId,
        customerName: bookingData.customerName,
        serviceName: bookingData.serviceName,
        date: bookingData.date,
        time: bookingData.time,
        status: bookingData.status || 'pending',
        phone: bookingData.phone || '',
        address: bookingData.address || '',
        totalPrice: bookingData.totalPrice || 0,
        addOns: bookingData.addOns || [],
        startOtp: null,
        otpVerified: false,
        technicianName: null,
        // Backward compatibility fields
        workName: bookingData.workName || `${bookingData.serviceName} service`,
        otherVerified: false,
        createdAt: new Date(),
      };

      console.log('📝 Booking document to create:', bookingDoc);

      const docRef = await firestore()
        .collection('service_bookings')
        .add(bookingDoc);

      console.log(`✅ Service booking created successfully with ID: ${docRef.id}`);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error creating service booking:', error);
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      throw new Error(`Failed to create booking: ${error.message}`);
    }
  }

  /**
   * Update a service booking
   */
  static async updateServiceBooking(bookingId: string, updates: Partial<ServiceBooking>): Promise<void> {
    try {
      console.log(`Updating service booking ${bookingId}:`, updates);
      
      await firestore()
        .collection('service_bookings')
        .doc(bookingId)
        .update(updates);

      console.log(`✅ Service booking ${bookingId} updated successfully`);
    } catch (error) {
      console.error('❌ Error updating service booking:', error);
      throw new Error('Failed to update booking. Please check your internet connection and try again.');
    }
  }

  /**
   * Get service booking by ID (matches website structure)
   */
  static async getServiceBookingById(bookingId: string): Promise<ServiceBooking | null> {
    try {
      const doc = await firestore()
        .collection('service_bookings')
        .doc(bookingId)
        .get();

      if (!doc.exists) {
        return null;
      }

      const data = doc.data();
      return {
        id: doc.id,
        companyId: data?.companyId || '',
        customerName: data?.customerName || '',
        serviceName: data?.serviceName || '',
        date: data?.date || '',
        time: data?.time || '',
        status: data?.status || 'pending',
        phone: data?.phone || '',
        address: data?.address || '',
        totalPrice: data?.totalPrice || 0,
        addOns: data?.addOns || [],
        startOtp: data?.startOtp || null,
        otpVerified: data?.otpVerified || false,
        technicianName: data?.technicianName || null,
        // Backward compatibility
        workName: data?.workName || `${data?.serviceName} service`,
        otherVerified: data?.otherVerified || false,
        createdAt: data?.createdAt,
        startedAt: data?.startedAt,
        completedAt: data?.completedAt,
        expiredAt: data?.expiredAt,
      };
    } catch (error) {
      console.error('❌ Error fetching service booking by ID:', error);
      throw new Error('Failed to fetch booking details. Please check your internet connection.');
    }
  }

  /**
   * Get all service bookings with pagination (matches website structure)
   */
  static async getServiceBookings(limit: number = 20): Promise<ServiceBooking[]> {
    try {
      // Ensure Firebase is initialized
      ensureFirebaseReady();
      
      console.log('Fetching service bookings from Firebase...');
      
      const snapshot = await firestore()
        .collection('service_bookings')
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      const bookings: ServiceBooking[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        bookings.push({
          id: doc.id,
          companyId: data.companyId || '',
          customerName: data.customerName || '',
          serviceName: data.serviceName || '',
          date: data.date || '',
          time: data.time || '',
          status: data.status || 'pending',
          phone: data.phone || '',
          address: data.address || '',
          totalPrice: data.totalPrice || 0,
          addOns: data.addOns || [],
          startOtp: data.startOtp || null,
          otpVerified: data.otpVerified || false,
          technicianName: data.technicianName || null,
          // Backward compatibility
          workName: data.workName || `${data.serviceName} service`,
          otherVerified: data.otherVerified || false,
          createdAt: data.createdAt,
          startedAt: data.startedAt,
          completedAt: data.completedAt,
          expiredAt: data.expiredAt,
        });
      });

      console.log(`✅ Fetched ${bookings.length} service bookings from Firebase`);
      return bookings;
    } catch (error) {
      console.error('❌ Error fetching service bookings:', error);
      throw new Error('Failed to fetch bookings. Please check your internet connection.');
    }
  }

  /**
   * Cancel a service booking
   */
  static async cancelServiceBooking(bookingId: string): Promise<void> {
    try {
      await this.updateServiceBooking(bookingId, { 
        status: 'rejected' 
      });
      console.log(`✅ Service booking ${bookingId} cancelled successfully`);
    } catch (error) {
      console.error('❌ Error cancelling service booking:', error);
      throw new Error('Failed to cancel booking. Please check your internet connection and try again.');
    }
  }

  /**
   * Assign technician to booking (matches website workflow)
   */
  static async assignTechnicianToBooking(bookingId: string, technicianName: string): Promise<void> {
    try {
      await this.updateServiceBooking(bookingId, {
        status: 'assigned',
        technicianName: technicianName,
      });
      console.log(`✅ Technician ${technicianName} assigned to booking ${bookingId}`);
    } catch (error) {
      console.error('❌ Error assigning technician:', error);
      throw new Error('Failed to assign technician. Please check your internet connection and try again.');
    }
  }

  /**
   * Start work on booking (matches website workflow)
   */
  static async startWorkOnBooking(bookingId: string): Promise<string> {
    try {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      
      await this.updateServiceBooking(bookingId, {
        status: 'started',
        startOtp: otp,
        otpVerified: false,
        startedAt: new Date(),
      });
      
      console.log(`✅ Work started on booking ${bookingId}, OTP: ${otp}`);
      return otp;
    } catch (error) {
      console.error('❌ Error starting work:', error);
      throw new Error('Failed to start work. Please check your internet connection and try again.');
    }
  }

  /**
   * Complete work on booking (matches website workflow)
   */
  static async completeWorkOnBooking(bookingId: string, enteredOtp: string): Promise<void> {
    try {
      // First get the booking to verify OTP
      const booking = await this.getServiceBookingById(bookingId);
      
      if (!booking) {
        throw new Error('Booking not found');
      }
      
      if (booking.startOtp !== enteredOtp) {
        throw new Error('Invalid OTP');
      }
      
      await this.updateServiceBooking(bookingId, {
        status: 'completed',
        otpVerified: true,
        completedAt: new Date(),
      });
      
      console.log(`✅ Work completed on booking ${bookingId}`);
    } catch (error) {
      console.error('❌ Error completing work:', error);
      throw new Error(`Failed to complete work: ${error.message}`);
    }
  }

  /**
   * Get bookings by company ID (for website dashboard)
   */
  static async getBookingsByCompanyId(companyId: string, limit: number = 50): Promise<ServiceBooking[]> {
    try {
      ensureFirebaseReady();
      
      console.log(`Fetching bookings for company: ${companyId}`);
      
      const snapshot = await firestore()
        .collection('service_bookings')
        .where('companyId', '==', companyId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      const bookings: ServiceBooking[] = [];
      const today = new Date().toISOString().split('T')[0];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        let status = data.status;
        
        // Auto-expire logic (matches website)
        if (data.date < today && !['completed', 'rejected', 'expired'].includes(status)) {
          status = 'expired';
        }
        
        bookings.push({
          id: doc.id,
          companyId: data.companyId || '',
          customerName: data.customerName || '',
          serviceName: data.serviceName || '',
          date: data.date || '',
          time: data.time || '',
          status: status,
          phone: data.phone || '',
          address: data.address || '',
          totalPrice: data.totalPrice || 0,
          addOns: data.addOns || [],
          startOtp: data.startOtp || null,
          otpVerified: data.otpVerified || false,
          technicianName: data.technicianName || null,
          workName: data.workName || `${data.serviceName} service`,
          otherVerified: data.otherVerified || false,
          createdAt: data.createdAt,
          startedAt: data.startedAt,
          completedAt: data.completedAt,
          expiredAt: data.expiredAt,
        });
      });

      console.log(`✅ Fetched ${bookings.length} bookings for company ${companyId}`);
      return bookings;
    } catch (error) {
      console.error('❌ Error fetching company bookings:', error);
      throw new Error('Failed to fetch company bookings. Please check your internet connection.');
    }
  }

  /**
   * Test method to update booking status (for testing real-time updates)
   */
  static async testUpdateBookingStatus(bookingId: string, status: ServiceBooking['status'], technicianName?: string): Promise<void> {
    try {
      console.log(`🧪 Testing status update for booking ${bookingId} to ${status}`);
      
      const updates: Partial<ServiceBooking> = {
        status: status,
      };

      if (technicianName) {
        updates.technicianName = technicianName;
      }

      if (status === 'started') {
        updates.startOtp = Math.floor(100000 + Math.random() * 900000).toString();
        updates.startedAt = new Date();
      }

      if (status === 'completed') {
        updates.completedAt = new Date();
        updates.otpVerified = true;
      }

      await this.updateServiceBooking(bookingId, updates);
      console.log(`✅ Test status update completed: ${bookingId} → ${status}`);
    } catch (error) {
      console.error('❌ Error in test status update:', error);
      throw error;
    }
  }
}