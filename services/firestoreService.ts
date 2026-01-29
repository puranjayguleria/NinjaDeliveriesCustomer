import { firestore } from '../firebase.native';

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

export class FirestoreService {
  /**
   * Fetch all service categories from app_categories collection
   */
  static async getServiceCategories(): Promise<ServiceCategory[]> {
    try {
      console.log('🏷️ STEP 1: Fetching categories from app_categories collection...');
      
      const snapshot = await firestore()
        .collection('app_categories')
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

      // Sort by name
      categories.sort((a, b) => a.name.localeCompare(b.name));

      console.log(`✅ STEP 1 COMPLETE: Fetched ${categories.length} categories from app_categories`);
      console.log('Categories found:', categories.map(c => ({ id: c.id, name: c.name })));
      
      return categories;
    } catch (error) {
      console.error('❌ Error fetching categories from app_categories:', error);
      throw new Error('Failed to fetch service categories. Please check your internet connection.');
    }
  }

  /**
   * Debug method to see data in both collections
   */
  static async debugAppServicesData(): Promise<void> {
    try {
      console.log('🔍 DEBUG: Checking both app_categories and app_services collections...');
      
      // Check app_categories
      console.log('\n=== APP_CATEGORIES COLLECTION ===');
      const categoriesSnapshot = await firestore()
        .collection('app_categories')
        .limit(5)
        .get();

      console.log(`Found ${categoriesSnapshot.size} documents in app_categories collection`);
      
      categoriesSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`Category ${doc.id}:`, {
          name: data.name,
          isActive: data.isActive,
          allFields: Object.keys(data)
        });
      });

      // Check app_services
      console.log('\n=== APP_SERVICES COLLECTION ===');
      const servicesSnapshot = await firestore()
        .collection('app_services')
        .limit(5)
        .get();

      console.log(`Found ${servicesSnapshot.size} documents in app_services collection`);
      
      servicesSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`Service ${doc.id}:`, {
          name: data.name,
          masterCategoryId: data.masterCategoryId,
          categoryMasterId: data.categoryMasterId,
          servicialType: data.servicialType,
          serviceType: data.serviceType,
          isActive: data.isActive,
          allFields: Object.keys(data)
        });
      });
      
    } catch (error) {
      console.error('❌ Error in debug method:', error);
    }
  }

  /**
   * Fetch services from app_services collection for a specific category
   */
  static async getServicesWithCompanies(categoryId: string): Promise<ServiceIssue[]> {
    try {
      if (!categoryId || typeof categoryId !== 'string' || categoryId.trim() === '') {
        console.error('Invalid categoryId provided:', categoryId);
        throw new Error('Invalid category ID provided');
      }

      console.log(`🔧 STEP 2: Fetching services from app_services for category: ${categoryId}`);
      
      // Try both possible field names for category linking
      const snapshot = await firestore()
        .collection('app_services')
        .where('masterCategoryId', '==', categoryId.trim())
        .where('isActive', '==', true)
        .get();

      console.log(`Found ${snapshot.size} services in app_services for category ${categoryId}`);

      const services: ServiceIssue[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        
        console.log(`Service data for ${doc.id}:`, {
          name: data.name,
          masterCategoryId: data.masterCategoryId,
          categoryMasterId: data.categoryMasterId,
          servicialType: data.servicialType,
          serviceType: data.serviceType,
          isActive: data.isActive
        });
        
        if (!data.name) {
          console.warn(`Service document ${doc.id} missing name field, skipping`);
          return;
        }

        services.push({
          id: doc.id,
          name: data.name || '',
          categoryMasterId: data.masterCategoryId || data.categoryMasterId || '',
          companyId: data.companyId,
          isActive: data.isActive || false,
          serviceType: data.serviceType || data.servicialType,
          price: data.price,
          packages: data.packages,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      });

      // If no services found with masterCategoryId, try categoryMasterId
      if (services.length === 0) {
        console.log('No services found with masterCategoryId, trying categoryMasterId...');
        
        const snapshot2 = await firestore()
          .collection('app_services')
          .where('categoryMasterId', '==', categoryId.trim())
          .where('isActive', '==', true)
          .get();

        console.log(`Found ${snapshot2.size} services with categoryMasterId for category ${categoryId}`);
        
        snapshot2.forEach(doc => {
          const data = doc.data();
          
          if (!data.name) {
            console.warn(`Service document ${doc.id} missing name field, skipping`);
            return;
          }

          services.push({
            id: doc.id,
            name: data.name || '',
            categoryMasterId: data.categoryMasterId || data.masterCategoryId || '',
            companyId: data.companyId,
            isActive: data.isActive || false,
            serviceType: data.serviceType || data.servicialType,
            price: data.price,
            packages: data.packages,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          });
        });
      }

      // Sort by name
      services.sort((a, b) => a.name.localeCompare(b.name));

      console.log(`✅ STEP 2 COMPLETE: Fetched ${services.length} services from app_services`);
      console.log('Services found:', services.map(s => ({ id: s.id, name: s.name })));
      
      return services;
    } catch (error) {
      console.error('❌ Error fetching services from app_services:', error);
      throw new Error(`Failed to fetch services for this category. Please check your internet connection.`);
    }
  }

  /**
   * Fetch service issues for a specific category (keeping for backward compatibility)
   */
  static async getServiceIssues(categoryId: string): Promise<ServiceIssue[]> {
    try {
      if (!categoryId || typeof categoryId !== 'string' || categoryId.trim() === '') {
        console.error('Invalid categoryId provided:', categoryId);
        throw new Error('Invalid category ID provided');
      }

      console.log(`🔧 STEP 2: Fetching services from app_services collection for category: ${categoryId}`);
      
      const snapshot = await firestore()
        .collection('app_services')
        .where('masterCategoryId', '==', categoryId.trim())
        .where('isActive', '==', true)
        .get();

      console.log(`Found ${snapshot.size} services in app_services for category ${categoryId}`);

      const issues: ServiceIssue[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        
        if (!data.name) {
          console.warn(`Service document ${doc.id} missing name field, skipping`);
          return;
        }

        issues.push({
          id: doc.id,
          name: data.name || '',
          categoryMasterId: data.masterCategoryId || '', // Use correct field name
          companyId: data.companyId,
          isActive: data.isActive || false,
          serviceType: data.serviceType,
          price: data.price,
          packages: data.packages,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      });

      // Sort by name
      issues.sort((a, b) => a.name.localeCompare(b.name));

      console.log(`✅ STEP 2 COMPLETE: Fetched ${issues.length} services from app_services`);
      
      return issues;
    } catch (error) {
      console.error('❌ Error fetching services from app_services:', error);
      throw new Error(`Failed to fetch services for this category. Please check your internet connection.`);
    }
  }

  /**
   * Fetch all service companies from Firestore
   */
  static async getCompaniesByServiceIssues(issueIds: string[]): Promise<ServiceCompany[]> {
    try {
      console.log(`🏢 STEP 3: Fetching companies for selected services: ${issueIds.join(', ')}`);
      
      if (issueIds.length === 0) {
        return await this.getServiceCompanies();
      }

      // First, get the service issues to find their associated company IDs
      const issuesSnapshot = await firestore()
        .collection('app_services')
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

      console.log(`Found ${companyIds.size} unique company IDs from selected services`);

      // For now, return all active companies from service_services
      // This ensures companies are always shown regardless of the linking logic
      console.log('Fetching all active companies from service_services collection...');
      return await this.getServiceCompanies();
    } catch (error) {
      console.error('❌ Error fetching companies from service_services:', error);
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
        .collection('app_services')
        .where('masterCategoryId', '==', categoryId)
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
          .collection('service_services')
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
      console.log('🏢 Fetching all companies from service_services collection...');
      
      const snapshot = await firestore()
        .collection('service_services')
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

      console.log(`✅ Fetched ${companies.length} companies from service_services collection`);
      
      return companies;
    } catch (error) {
      console.error('❌ Error fetching companies from service_services:', error);
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
        .collection('service_services')
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
        .collection('app_categories')
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
}