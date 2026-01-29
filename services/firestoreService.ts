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
      if (!categoryId || typeof categoryId !== 'string' || categoryId.trim() === '') {
        console.error('Invalid categoryId provided:', categoryId);
        throw new Error('Invalid category ID provided');
      }

      console.log(`Fetching services for category: ${categoryId}`);
      
      const snapshot = await firestore()
        .collection('app_services')
        .where('categoryMasterId', '==', categoryId.trim())
        .where('isActive', '==', true)
        .get();

      console.log(`Found ${snapshot.size} services for category ${categoryId}`);

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

      // Sort by name
      issues.sort((a, b) => a.name.localeCompare(b.name));

      console.log(`Successfully fetched ${issues.length} services for category ${categoryId}`);
      
      return issues;
    } catch (error) {
      console.error('Error fetching services from app_services:', error);
      throw new Error(`Failed to fetch services for this category. Please check your internet connection.`);
    }
  }

  /**
   * Fetch all service companies from Firestore
   */
  static async getCompaniesByServiceIssues(issueIds: string[]): Promise<ServiceCompany[]> {
    try {
      console.log(`Fetching companies for service issues: ${issueIds.join(', ')}`);
      
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
        .collection('app_services')
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
      console.log('Fetching service companies from Firestore...');
      
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