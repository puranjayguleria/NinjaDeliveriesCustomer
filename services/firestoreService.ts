import { firestore } from '../firebase.native';

export interface ServiceCategory {
  id: string;
  name: string;
  isActive: boolean;
  createdAt?: any;
  updatedAt?: any;
  // Add other fields as needed based on your Firestore structure
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
  ownerName: string;
  phone: string;
  email: string;
  address: string;
  businessType: string;
  deliveryZoneId: string;
  deliveryZoneName: string;
  registrationDate: any;
  isActive: boolean;
  createdAt?: any;
  updatedAt?: any;
}

// Fallback demo data in case Firestore is not accessible
const DEMO_CATEGORIES: ServiceCategory[] = [
  { id: 'demo-1', name: 'Electrician', isActive: true },
  { id: 'demo-2', name: 'Plumber', isActive: true },
  { id: 'demo-3', name: 'Cleaning', isActive: true },
  { id: 'demo-4', name: 'Health & Fitness', isActive: true },
  { id: 'demo-5', name: 'Daily Wages', isActive: true },
  { id: 'demo-6', name: 'Car Wash', isActive: true },
  { id: 'demo-7', name: 'AC Repair', isActive: true },
  { id: 'demo-8', name: 'Appliance Repair', isActive: true },
];

const DEMO_ISSUES: ServiceIssue[] = [
  { id: 'issue-1', name: 'Fan Not Working', categoryMasterId: 'demo-1', isActive: true },
  { id: 'issue-2', name: 'Switchboard Repair', categoryMasterId: 'demo-1', isActive: true },
  { id: 'issue-3', name: 'Wiring & Short Circuit', categoryMasterId: 'demo-1', isActive: true },
  { id: 'issue-4', name: 'Tap Leakage', categoryMasterId: 'demo-2', isActive: true },
  { id: 'issue-5', name: 'Pipe Leakage', categoryMasterId: 'demo-2', isActive: true },
  { id: 'issue-6', name: 'Bathroom Fitting Repair', categoryMasterId: 'demo-2', isActive: true },
];

const DEMO_COMPANIES: ServiceCompany[] = [
  {
    id: 'company-1',
    companyName: 'Ninja Electric Service',
    ownerName: 'John Doe',
    phone: '9876543210',
    email: 'ninja@electric.com',
    address: 'Dharamshala',
    businessType: 'service',
    deliveryZoneId: 'zone-1',
    deliveryZoneName: 'Dharamshala Zone',
    registrationDate: new Date(),
    isActive: true,
  },
  {
    id: 'company-2',
    companyName: 'Quick Fix Electrician',
    ownerName: 'Jane Smith',
    phone: '9876543211',
    email: 'quickfix@electric.com',
    address: 'Dharamshala',
    businessType: 'service',
    deliveryZoneId: 'zone-1',
    deliveryZoneName: 'Dharamshala Zone',
    registrationDate: new Date(),
    isActive: true,
  },
];

export class FirestoreService {
  /**
   * Fetch all service categories from Firestore
   */
  static async getServiceCategories(): Promise<ServiceCategory[]> {
    try {
      console.log('Fetching service categories from Firestore...');
      
      // First, get all documents with isActive = true
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

      // Sort by name on the client side to avoid index requirement
      categories.sort((a, b) => a.name.localeCompare(b.name));

      console.log(`Fetched ${categories.length} service categories from Firestore`);
      
      // If no categories found in Firestore, return demo data
      if (categories.length === 0) {
        console.log('No categories found in Firestore, using demo data');
        return DEMO_CATEGORIES;
      }

      return categories;
    } catch (error) {
      console.error('Error fetching service categories from Firestore:', error);
      console.log('Falling back to demo data');
      // Return demo data as fallback
      return DEMO_CATEGORIES;
    }
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
      
      // If no issues found, return demo issues for this category
      if (issues.length === 0) {
        console.log('No issues found in Firestore, using demo data');
        const demoIssues = DEMO_ISSUES.filter(issue => issue.categoryMasterId === categoryId);
        return demoIssues.length > 0 ? demoIssues : [];
      }

      return issues;
    } catch (error) {
      console.error('Error fetching service issues from Firestore:', error);
      console.log('Falling back to demo data');
      // Return demo issues as fallback
      const demoIssues = DEMO_ISSUES.filter(issue => issue.categoryMasterId === categoryId);
      return demoIssues;
    }
  }

  /**
   * Fetch service companies that provide specific services/issues
   */
  static async getCompaniesByServiceIssues(issueIds: string[]): Promise<ServiceCompany[]> {
    try {
      console.log(`Fetching companies for service issues: ${issueIds.join(', ')}`);
      
      if (issueIds.length === 0) {
        return await this.getServiceCompanies(); // Return all companies if no specific issues
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
            ownerName: data.ownerName || '',
            phone: data.phone || '',
            email: data.email || '',
            address: data.address || '',
            businessType: data.businessType || '',
            deliveryZoneId: data.deliveryZoneId || '',
            deliveryZoneName: data.deliveryZoneName || '',
            registrationDate: data.registrationDate,
            isActive: data.isActive || false,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          });
        });
      }

      // Sort by company name
      companies.sort((a, b) => a.companyName.localeCompare(b.companyName));

      console.log(`Fetched ${companies.length} companies that provide the selected services`);
      
      // If no companies found, return demo data
      if (companies.length === 0) {
        console.log('No companies found for selected issues, using demo data');
        return DEMO_COMPANIES;
      }

      return companies;
    } catch (error) {
      console.error('Error fetching companies by service issues:', error);
      console.log('Falling back to all companies');
      // Fallback to all companies
      return await this.getServiceCompanies();
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
            ownerName: data.ownerName || '',
            phone: data.phone || '',
            email: data.email || '',
            address: data.address || '',
            businessType: data.businessType || '',
            deliveryZoneId: data.deliveryZoneId || '',
            deliveryZoneName: data.deliveryZoneName || '',
            registrationDate: data.registrationDate,
            isActive: data.isActive || false,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          });
        });
      }

      // Sort by company name
      companies.sort((a, b) => a.companyName.localeCompare(b.companyName));

      console.log(`Fetched ${companies.length} companies for category ${categoryId}`);
      
      return companies;
    } catch (error) {
      console.error('Error fetching companies by category:', error);
      console.log('Falling back to all companies');
      return await this.getServiceCompanies();
    }
  }
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
          ownerName: data.ownerName || '',
          phone: data.phone || '',
          email: data.email || '',
          address: data.address || '',
          businessType: data.businessType || '',
          deliveryZoneId: data.deliveryZoneId || '',
          deliveryZoneName: data.deliveryZoneName || '',
          registrationDate: data.registrationDate,
          isActive: data.isActive || false,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      });

      // Sort by company name on the client side
      companies.sort((a, b) => a.companyName.localeCompare(b.companyName));

      console.log(`Fetched ${companies.length} service companies from Firestore`);
      
      // If no companies found, return demo data
      if (companies.length === 0) {
        console.log('No companies found in Firestore, using demo data');
        return DEMO_COMPANIES;
      }

      return companies;
    } catch (error) {
      console.error('Error fetching service companies from Firestore:', error);
      console.log('Falling back to demo data');
      // Return demo data as fallback
      return DEMO_COMPANIES;
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
          ownerName: data.ownerName || '',
          phone: data.phone || '',
          email: data.email || '',
          address: data.address || '',
          businessType: data.businessType || '',
          deliveryZoneId: data.deliveryZoneId || '',
          deliveryZoneName: data.deliveryZoneName || '',
          registrationDate: data.registrationDate,
          isActive: data.isActive || false,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      });

      // Sort by company name on the client side
      companies.sort((a, b) => a.companyName.localeCompare(b.companyName));

      console.log(`Fetched ${companies.length} service companies for zone ${zoneId}`);
      
      return companies;
    } catch (error) {
      console.error('Error fetching service companies by zone from Firestore:', error);
      console.log('Falling back to demo data');
      // Return demo data as fallback
      return DEMO_COMPANIES;
    }
  }
  static async getServiceCategoryById(categoryId: string): Promise<ServiceCategory | null> {
    try {
      // Check if it's a demo category first
      const demoCategory = DEMO_CATEGORIES.find(cat => cat.id === categoryId);
      if (demoCategory) {
        return demoCategory;
      }

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
      // Try to find in demo data as fallback
      return DEMO_CATEGORIES.find(cat => cat.id === categoryId) || null;
    }
  }
}