import { firestore } from '../firebase.native';

export interface ServiceCategory {
  id: string;
  name: string;
  isActive: boolean;
  masterCategoryId?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface ServiceIssue {
  id: string;
  name: string;
  masterCategoryId: string; // Links to app_categories
  companyId?: string;
  isActive: boolean;
  serviceKey?: string;
  serviceType?: string;
  price?: number;
  packages?: any[];
  createdAt?: any;
  updatedAt?: any;
}

export interface ServiceCompany {
  id: string;
  companyId?: string;
  categoryMasterId?: string;
  serviceName: string; // Service name like "Yoga sessions (beginneradvanced)"
  companyName?: string; // Actual company name
  price?: number;
  isActive: boolean;
  imageUrl?: string | null;
  packages?: any[];
  serviceType?: string;
  adminServiceId?: string;
  description?: string;
  rating?: number;
  reviewCount?: number;
  availability?: string;
  contactInfo?: {
    phone?: string;
    email?: string;
    address?: string;
  };
  createdAt?: any;
  updatedAt?: any;
}

export interface ServiceBooking {
  id: string;
  serviceName: string;
  workName: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  date: string;
  time: string;
  status: 'pending' | 'assigned' | 'started' | 'completed' | 'rejected' | 'expired';
  companyId?: string;
  technicianName?: string;
  technicianId?: string;
  totalPrice?: number;
  addOns?: Array<{
    name: string;
    price: number;
  }>;
  startOtp?: string;
  otpVerified?: boolean;
  assignedAt?: any;
  startedAt?: any;
  completedAt?: any;
  rejectedAt?: any;
  expiredAt?: any;
  createdAt?: any;
  updatedAt?: any;
  // Rating and feedback fields
  customerRating?: number;
  customerFeedback?: string;
  ratedAt?: any;
}

export class FirestoreService {
  /**
   * Fetch all service categories from app_categories collection
   */
  static async getServiceCategories(): Promise<ServiceCategory[]> {
    try {
      console.log('🏷️ Fetching categories from app_categories collection...');
      
      // Only fetch active categories
      const snapshot = await firestore()
        .collection('app_categories')
        .where('isActive', '==', true)
        .get();

      console.log(`Found ${snapshot.size} active categories`);

      const categories: ServiceCategory[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        
        console.log(`Category ${doc.id}:`, {
          name: data.name,
          isActive: data.isActive,
          masterCategoryId: data.masterCategoryId,
        });
        
        categories.push({
          id: doc.id,
          name: data.name || '',
          isActive: data.isActive || false,
          masterCategoryId: data.masterCategoryId,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      });

      // Sort by name on the client side
      categories.sort((a, b) => a.name.localeCompare(b.name));

      console.log(`✅ Fetched ${categories.length} active categories from app_categories`);
      console.log('Categories:', categories.map(c => ({ id: c.id, name: c.name, isActive: c.isActive })));
      
      return categories;
    } catch (error) {
      console.error('❌ Error fetching categories from app_categories:', error);
      throw new Error('Failed to fetch service categories. Please check your internet connection.');
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

      console.log(`🔧 Fetching services from app_services for category: ${categoryId}`);
      
      // UNIVERSAL LOGIC: First, get the category to check if it has a masterCategoryId
      const categoryDoc = await firestore()
        .collection('app_categories')
        .doc(categoryId.trim())
        .get();
      
      let searchCategoryId = categoryId.trim();
      let categoryName = 'Unknown';
      
      if (categoryDoc.exists) {
        const categoryData = categoryDoc.data();
        categoryName = categoryData?.name || 'Unknown';
        
        console.log(`🔧 Category "${categoryName}" data:`, {
          id: categoryDoc.id,
          name: categoryData?.name,
          masterCategoryId: categoryData?.masterCategoryId,
          isActive: categoryData?.isActive
        });
        
        // UNIVERSAL RULE: If category has masterCategoryId, use it for service lookup
        if (categoryData?.masterCategoryId) {
          searchCategoryId = categoryData.masterCategoryId;
          console.log(`🔧 Using masterCategoryId for "${categoryName}" service search: ${searchCategoryId}`);
        } else {
          console.log(`🔧 No masterCategoryId found for "${categoryName}", using category ID: ${searchCategoryId}`);
        }
      } else {
        console.warn(`🔧 Category document not found: ${categoryId}`);
      }
      
      console.log(`🔧 Query: app_services where masterCategoryId == "${searchCategoryId}"`);
      console.log(`🔧 CRITICAL: We will fetch ALL services and then filter out inactive ones manually`);
      
      // GET ALL SERVICES (no isActive filter in query) - then filter manually for better control
      const snapshot = await firestore()
        .collection('app_services')
        .where('masterCategoryId', '==', searchCategoryId)
        .get();

      console.log(`📊 TOTAL services found in category "${categoryName}": ${snapshot.size}`);

      // COMPREHENSIVE ANALYSIS: Check every single service
      let totalServices = 0;
      let activeServices = 0;
      let inactiveServices = 0;
      
      snapshot.forEach(doc => {
        const data = doc.data();
        totalServices++;
        
        console.log(`📋 Service "${data.name}":`, {
          id: doc.id,
          isActive: data.isActive,
          isActiveType: typeof data.isActive,
          isActiveValue: JSON.stringify(data.isActive),
          willBeShown: data.isActive === true
        });
        
        if (data.isActive === true) {
          activeServices++;
          console.log(`✅ "${data.name}" is ACTIVE (isActive: true) - WILL BE SHOWN`);
        } else {
          inactiveServices++;
          console.log(`🚫 "${data.name}" is INACTIVE (isActive: ${data.isActive}) - WILL BE HIDDEN`);
        }
      });
      
      console.log(`📊 SUMMARY for "${categoryName}": ${totalServices} total, ${activeServices} active, ${inactiveServices} inactive`);

      // If no services found, let's debug by checking what services exist
      if (snapshot.size === 0) {
        console.log(`🔍 No active services found for "${categoryName}", debugging...`);
        const debugSnapshot = await firestore()
          .collection('app_services')
          .where('masterCategoryId', '==', searchCategoryId)
          .get();
        
        console.log(`🔍 Found ${debugSnapshot.size} total services (including inactive) for "${categoryName}"`);
        
        debugSnapshot.forEach(doc => {
          const data = doc.data();
          console.log(`🔍 Service ${doc.id}:`, {
            name: data.name,
            masterCategoryId: data.masterCategoryId,
            isActive: data.isActive,
            serviceKey: data.serviceKey,
            serviceType: data.serviceType
          });
        });

        // Also try with the original categoryId if we used masterCategoryId
        if (searchCategoryId !== categoryId.trim()) {
          console.log(`🔍 Also checking with original categoryId for "${categoryName}": ${categoryId.trim()}`);
          const originalSnapshot = await firestore()
            .collection('app_services')
            .where('masterCategoryId', '==', categoryId.trim())
            .get();
          
          console.log(`🔍 Found ${originalSnapshot.size} services with original categoryId for "${categoryName}"`);
        }
      }

      const services: ServiceIssue[] = [];
      const serviceNames = new Set<string>(); // Track unique service names
      
      snapshot.forEach(doc => {
        const data = doc.data();
        
        console.log(`📋 Processing service "${data.name}" (ID: ${doc.id}):`, {
          name: data.name,
          isActive: data.isActive,
          isActiveType: typeof data.isActive,
          isActiveValue: JSON.stringify(data.isActive),
          masterCategoryId: data.masterCategoryId
        });
        
        if (!data.name) {
          console.warn(`❌ Service document ${doc.id} missing name field, skipping`);
          return;
        }

        // 🚫 UNIVERSAL INACTIVE SERVICE BLOCKING 🚫
        // RULE: Only services with isActive === true (boolean) are allowed
        // This applies to ALL services, not just specific ones
        
        if (data.isActive !== true) {
          console.log(`🚫 BLOCKING INACTIVE SERVICE: "${data.name}"`);
          console.log(`   - isActive value: ${JSON.stringify(data.isActive)}`);
          console.log(`   - isActive type: ${typeof data.isActive}`);
          console.log(`   - Reason: isActive is not exactly true (boolean)`);
          console.log(`   - This service will NOT appear in the app until isActive is set to true`);
          return; // BLOCK - Do not add to results
        }

        // Additional safety checks for common inactive values
        if (data.isActive === false || data.isActive === 'false' || data.isActive === 0 || 
            data.isActive === null || data.isActive === undefined || data.isActive === '') {
          console.log(`🚫 SAFETY BLOCK: "${data.name}" has explicitly inactive value`);
          console.log(`   - Value: ${JSON.stringify(data.isActive)}`);
          return;
        }

        console.log(`✅ SERVICE APPROVED: "${data.name}" has isActive: true - WILL BE SHOWN`);

        // Check for duplicate service names - only add if not already added
        if (serviceNames.has(data.name.toLowerCase().trim())) {
          console.log(`⚠️ Skipping duplicate service: ${data.name} (already exists)`);
          return;
        }

        // Add to unique services
        serviceNames.add(data.name.toLowerCase().trim());
        
        services.push({
          id: doc.id,
          name: data.name || '',
          masterCategoryId: data.masterCategoryId || '',
          companyId: data.companyId,
          isActive: data.isActive || false,
          serviceKey: data.serviceKey,
          serviceType: data.serviceType,
          price: data.price,
          packages: data.packages,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      });

      // Sort by name on the client side
      services.sort((a, b) => a.name.localeCompare(b.name));

      console.log(`✅ Fetched ${services.length} unique active services for "${categoryName}"`);
      console.log(`Unique services found for "${categoryName}":`, services.map(s => ({ id: s.id, name: s.name, isActive: s.isActive })));
      
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
    return this.getServicesWithCompanies(categoryId);
  }

  /**
   * Fetch service companies/providers from service_services collection based on selected services
   */
  static async getCompaniesByServiceIssues(issueIds: string[]): Promise<ServiceCompany[]> {
    try {
      console.log(`🏢 Fetching companies from service_services for selected services: ${issueIds.join(', ')}`);
      
      if (issueIds.length === 0) {
        return await this.getServiceCompanies();
      }

      // Get the masterCategoryId and service names from the selected services first
      const servicesSnapshot = await firestore()
        .collection('app_services')
        .where('__name__', 'in', issueIds.slice(0, 10)) // Firestore limit
        .get();

      const categoryIds = new Set<string>();
      const serviceNames = new Set<string>();
      
      servicesSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.masterCategoryId) {
          categoryIds.add(data.masterCategoryId);
        }
        if (data.name) {
          serviceNames.add(data.name.toLowerCase().trim());
        }
      });

      console.log(`Found ${categoryIds.size} unique category IDs from selected services:`, Array.from(categoryIds));
      console.log(`Selected service names:`, Array.from(serviceNames));

      // Now fetch ALL companies from service_services that match these categories and service names
      const companies: ServiceCompany[] = [];
      
      for (const categoryId of categoryIds) {
        console.log(`🏢 Fetching ALL companies for service category: ${categoryId}`);
        
        // Get ALL companies for this category (we'll filter by service name and active status)
        const companiesSnapshot = await firestore()
          .collection('service_services')
          .where('categoryMasterId', '==', categoryId)
          .get();

        console.log(`Found ${companiesSnapshot.size} total companies for service category ${categoryId}`);

        companiesSnapshot.forEach(doc => {
          const data = doc.data();
          
          // Only include active companies
          if (!data.isActive) {
            console.log(`Skipping inactive company: ${data.name || data.companyName || 'Unknown'}`);
            return;
          }

          // Only include companies that provide the selected service names
          if (data.name && serviceNames.has(data.name.toLowerCase().trim())) {
            console.log(`Company data for ${doc.id} (matches selected service):`, {
              serviceName: data.name,
              companyName: data.companyName || `Company ${data.companyId}`,
              categoryMasterId: data.categoryMasterId,
              price: data.price,
              isActive: data.isActive
            });
            
            companies.push({
              id: doc.id,
              companyId: data.companyId,
              categoryMasterId: data.categoryMasterId,
              serviceName: data.name || '', // This is the service name
              companyName: '', // Will be populated below with actual company name
              price: data.price,
              isActive: data.isActive || false,
              imageUrl: data.imageUrl,
              packages: data.packages,
              serviceType: data.serviceType,
              adminServiceId: data.adminServiceId,
              description: data.description,
              rating: data.rating,
              reviewCount: data.reviewCount,
              availability: data.availability,
              contactInfo: {
                phone: data.phone || data.contactPhone,
                email: data.email || data.contactEmail,
                address: data.address || data.contactAddress,
              },
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
            });
          } else {
            console.log(`Skipping company ${doc.id} - service name "${data.name}" doesn't match selected services`);
          }
        });
      }

      // Remove duplicates based on id (in case same company appears multiple times)
      const uniqueCompanies = companies.filter((company, index, self) => 
        index === self.findIndex(c => c.id === company.id)
      );

      // Fetch actual company names for all companies
      const companyIds = [...new Set(uniqueCompanies.map(c => c.companyId).filter((id): id is string => Boolean(id)))];
      if (companyIds.length > 0) {
        console.log(`🏢 Fetching actual company names for ${companyIds.length} companies...`);
        const companyNames = await this.getMultipleCompanyNames(companyIds);
        
        // Update company names with actual names from service_company collection
        uniqueCompanies.forEach(company => {
          if (company.companyId) {
            const actualName = companyNames.get(company.companyId);
            company.companyName = actualName || `Company ${company.companyId}`;
            console.log(`Updated company ${company.companyId} → ${company.companyName}`);
          } else {
            company.companyName = 'Unknown Company';
          }
        });
      }

      // Sort by price (lowest first), then by name
      uniqueCompanies.sort((a, b) => {
        if (a.price && b.price) {
          return a.price - b.price;
        }
        if (a.price && !b.price) return -1;
        if (!a.price && b.price) return 1;
        return (a.companyName || '').localeCompare(b.companyName || '');
      });

      console.log(`✅ Fetched ${uniqueCompanies.length} unique active companies providing selected services`);
      console.log('Companies found:', uniqueCompanies.map(c => ({ id: c.id, companyName: c.companyName, serviceName: c.serviceName, price: c.price })));

      console.log(`✅ Fetched ${uniqueCompanies.length} unique active companies from service_services`);
      console.log('Companies found:', uniqueCompanies.map(c => ({ id: c.id, companyName: c.companyName, serviceName: c.serviceName, price: c.price })));
      
      return uniqueCompanies;
    } catch (error) {
      console.error('❌ Error fetching companies from service_services:', error);
      throw new Error('Failed to fetch service companies. Please check your internet connection.');
    }
  }

  /**
   * Fetch actual company name from service_company collection using companyId
   */
  static async getActualCompanyName(companyId: string): Promise<string> {
    try {
      if (!companyId) return 'Unknown Company';
      
      console.log(`🏢 Looking up company name for ID: ${companyId}`);
      
      // Try service_company collection first (as shown in your screenshot)
      const companyDoc = await firestore()
        .collection('service_company')
        .doc(companyId)
        .get();
      
      if (companyDoc.exists) {
        const data = companyDoc.data();
        const companyName = data?.companyName || data?.name;
        console.log(`✅ Found company name: ${companyName} for ID: ${companyId}`);
        return companyName || `Company ${companyId}`;
      }
      
      console.log(`❌ Company not found in service_company for ID: ${companyId}`);
      return `Company ${companyId}`;
      
    } catch (error) {
      console.error(`❌ Error fetching company name for ${companyId}:`, error);
      return `Company ${companyId}`;
    }
  }

  /**
   * Fetch multiple company names at once for better performance
   */
  static async getMultipleCompanyNames(companyIds: string[]): Promise<Map<string, string>> {
    const companyNames = new Map<string, string>();
    
    try {
      console.log(`🏢 Batch lookup for ${companyIds.length} company names:`, companyIds);
      
      // Process in smaller batches to avoid Firestore limits
      const batchSize = 10;
      for (let i = 0; i < companyIds.length; i += batchSize) {
        const batch = companyIds.slice(i, i + batchSize);
        
        // Use 'in' query for batch fetching
        if (batch.length > 0) {
          const snapshot = await firestore()
            .collection('service_company')
            .where('__name__', 'in', batch)
            .get();
          
          snapshot.forEach(doc => {
            const data = doc.data();
            const companyName = data?.companyName || data?.name || `Company ${doc.id}`;
            companyNames.set(doc.id, companyName);
            console.log(`✅ Mapped ${doc.id} → ${companyName}`);
          });
          
          // Add fallback names for companies not found
          batch.forEach(companyId => {
            if (!companyNames.has(companyId)) {
              companyNames.set(companyId, `Company ${companyId}`);
              console.log(`⚠️ Fallback name for ${companyId}`);
            }
          });
        }
      }
      
      console.log(`✅ Batch lookup complete. Found ${companyNames.size} company names.`);
      return companyNames;
      
    } catch (error) {
      console.error('❌ Error in batch company lookup:', error);
      
      // Fallback: create map with company IDs as names
      companyIds.forEach(id => {
        companyNames.set(id, `Company ${id}`);
      });
      
      return companyNames;
    }
  }
  static async getCompaniesByCategory(categoryId: string): Promise<ServiceCompany[]> {
    try {
      console.log(`🏢 Fetching companies from service_services for category: ${categoryId}`);
      
      // UNIVERSAL LOGIC: First, get the category to check if it has a masterCategoryId
      const categoryDoc = await firestore()
        .collection('app_categories')
        .doc(categoryId.trim())
        .get();
      
      let searchCategoryId = categoryId.trim();
      let categoryName = 'Unknown';
      
      if (categoryDoc.exists) {
        const categoryData = categoryDoc.data();
        categoryName = categoryData?.name || 'Unknown';
        
        console.log(`🏢 Category "${categoryName}" data for companies:`, {
          id: categoryDoc.id,
          name: categoryData?.name,
          masterCategoryId: categoryData?.masterCategoryId,
          isActive: categoryData?.isActive
        });
        
        // UNIVERSAL RULE: If category has masterCategoryId, use it for company lookup
        if (categoryData?.masterCategoryId) {
          searchCategoryId = categoryData.masterCategoryId;
          console.log(`🏢 Using masterCategoryId for "${categoryName}" company search: ${searchCategoryId}`);
        } else {
          console.log(`🏢 No masterCategoryId found for "${categoryName}", using category ID: ${searchCategoryId}`);
        }
      } else {
        console.warn(`🏢 Category document not found: ${categoryId}`);
      }
      
      console.log(`🏢 Query: service_services where categoryMasterId == "${searchCategoryId}" AND isActive == true`);
      
      // Only fetch active companies for the category
      const snapshot = await firestore()
        .collection('service_services')
        .where('categoryMasterId', '==', searchCategoryId)
        .where('isActive', '==', true)
        .get();

      console.log(`Found ${snapshot.size} active companies for "${categoryName}" (search ID: ${searchCategoryId})`);

      // If no companies found, debug what's available
      if (snapshot.size === 0) {
        console.log(`🔍 No active companies found for "${categoryName}", debugging...`);
        const debugSnapshot = await firestore()
          .collection('service_services')
          .where('categoryMasterId', '==', searchCategoryId)
          .get();
        
        console.log(`🔍 Found ${debugSnapshot.size} total companies (including inactive) for "${categoryName}"`);
        
        debugSnapshot.forEach(doc => {
          const data = doc.data();
          console.log(`🔍 Company ${doc.id}:`, {
            name: data.name,
            categoryMasterId: data.categoryMasterId,
            isActive: data.isActive,
            price: data.price,
            companyId: data.companyId
          });
        });

        // Also try with the original categoryId if we used masterCategoryId
        if (searchCategoryId !== categoryId.trim()) {
          console.log(`🔍 Also checking companies with original categoryId for "${categoryName}": ${categoryId.trim()}`);
          const originalSnapshot = await firestore()
            .collection('service_services')
            .where('categoryMasterId', '==', categoryId.trim())
            .get();
          
          console.log(`🔍 Found ${originalSnapshot.size} companies with original categoryId for "${categoryName}"`);
        }
      }

      const companies: ServiceCompany[] = [];
      const companyIds: string[] = [];
      
      // First pass: collect all company data and IDs
      snapshot.forEach(doc => {
        const data = doc.data();
        
        // Only include active companies
        if (!data.isActive) {
          console.log(`Skipping inactive company: ${data.name || data.companyName || 'Unknown'}`);
          return;
        }
        
        console.log(`Company data for ${doc.id} (${categoryName}):`, {
          serviceName: data.name,
          companyName: data.companyName || `Company ${data.companyId}`,
          categoryMasterId: data.categoryMasterId,
          price: data.price,
          isActive: data.isActive,
          companyId: data.companyId
        });
        
        // Collect company ID for batch lookup
        if (data.companyId) {
          companyIds.push(data.companyId);
        }
        
        companies.push({
          id: doc.id,
          companyId: data.companyId,
          categoryMasterId: data.categoryMasterId,
          serviceName: data.name || '', // This is the service name
          companyName: '', // Will be populated below with actual company name
          price: data.price,
          isActive: data.isActive || false,
          imageUrl: data.imageUrl,
          packages: data.packages,
          serviceType: data.serviceType,
          adminServiceId: data.adminServiceId,
          description: data.description,
          rating: data.rating,
          reviewCount: data.reviewCount,
          availability: data.availability,
          contactInfo: {
            phone: data.phone || data.contactPhone,
            email: data.email || data.contactEmail,
            address: data.address || data.contactAddress,
          },
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      });

      // Second pass: fetch actual company names from service_company collection
      if (companyIds.length > 0) {
        console.log(`🏢 Fetching actual company names for ${companyIds.length} companies...`);
        const companyNames = await this.getMultipleCompanyNames([...new Set(companyIds)]);
        
        // Update company names with actual names from service_company collection
        companies.forEach(company => {
          if (company.companyId) {
            const actualName = companyNames.get(company.companyId);
            company.companyName = actualName || `Company ${company.companyId}`;
            console.log(`Updated company ${company.companyId} → ${company.companyName}`);
          } else {
            company.companyName = 'Unknown Company';
          }
        });
      }

      // Sort by company name on the client side
      companies.sort((a, b) => (a.companyName || '').localeCompare(b.companyName || ''));

      console.log(`✅ Fetched ${companies.length} active companies for "${categoryName}"`);
      console.log(`Companies found for "${categoryName}":`, companies.map(c => ({ id: c.id, companyName: c.companyName, serviceName: c.serviceName, price: c.price, isActive: c.isActive })));
      
      return companies;
    } catch (error) {
      console.error('❌ Error fetching companies by category from service_services:', error);
      throw new Error('Failed to fetch companies for this category. Please check your internet connection.');
    }
  }

  /**
   * Fetch all service companies from service_services collection
   */
  static async getServiceCompanies(): Promise<ServiceCompany[]> {
    try {
      console.log('🏢 Fetching all companies from service_services collection...');
      
      // Only fetch active companies
      const snapshot = await firestore()
        .collection('service_services')
        .where('isActive', '==', true)
        .get();

      const companies: ServiceCompany[] = [];
      const companyIds: string[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        
        // Collect company ID for batch lookup
        if (data.companyId) {
          companyIds.push(data.companyId);
        }
        
        companies.push({
          id: doc.id,
          companyId: data.companyId,
          categoryMasterId: data.categoryMasterId,
          serviceName: data.name || '', // This is the service name
          companyName: '', // Will be populated below with actual company name
          price: data.price,
          isActive: data.isActive || false,
          imageUrl: data.imageUrl,
          packages: data.packages,
          serviceType: data.serviceType,
          adminServiceId: data.adminServiceId,
          description: data.description,
          rating: data.rating,
          reviewCount: data.reviewCount,
          availability: data.availability,
          contactInfo: {
            phone: data.phone || data.contactPhone,
            email: data.email || data.contactEmail,
            address: data.address || data.contactAddress,
          },
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      });

      // Fetch actual company names from service_company collection
      if (companyIds.length > 0) {
        console.log(`🏢 Fetching actual company names for ${companyIds.length} companies...`);
        const companyNames = await this.getMultipleCompanyNames([...new Set(companyIds)]);
        
        // Update company names with actual names from service_company collection
        companies.forEach(company => {
          if (company.companyId) {
            const actualName = companyNames.get(company.companyId);
            company.companyName = actualName || `Company ${company.companyId}`;
            console.log(`Updated company ${company.companyId} → ${company.companyName}`);
          } else {
            company.companyName = 'Unknown Company';
          }
        });
      }

      // Sort by company name on the client side
      companies.sort((a, b) => (a.companyName || '').localeCompare(b.companyName || ''));

      console.log(`✅ Fetched ${companies.length} active companies from service_services collection`);
      
      return companies;
    } catch (error) {
      console.error('❌ Error fetching companies from service_services:', error);
      throw new Error('Failed to fetch service companies. Please check your internet connection.');
    }
  }

  /**
   * Fetch service companies by delivery zone (if needed)
   */
  static async getServiceCompaniesByZone(zoneId: string): Promise<ServiceCompany[]> {
    try {
      console.log(`Fetching service companies for zone: ${zoneId}`);
      
      // For now, return all companies since zone filtering might not be in service_services
      return await this.getServiceCompanies();
    } catch (error) {
      console.error('Error fetching service companies by zone:', error);
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
        masterCategoryId: data?.masterCategoryId,
        createdAt: data?.createdAt,
        updatedAt: data?.updatedAt,
      };
    } catch (error) {
      console.error('Error fetching service category by ID:', error);
      throw new Error('Failed to fetch service category. Please check your internet connection.');
    }
  }

  /**
   * Debug method to see data in collections
   */
  static async debugAppServicesData(): Promise<void> {
    try {
      console.log('🔍 DEBUG: Checking app_categories, app_services, and service_services collections...');
      
      // Check app_categories
      console.log('\n=== APP_CATEGORIES COLLECTION ===');
      const categoriesSnapshot = await firestore()
        .collection('app_categories')
        .limit(10)
        .get();

      console.log(`Found ${categoriesSnapshot.size} documents in app_categories collection`);
      
      categoriesSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`Category ${doc.id}:`, {
          name: data.name,
          isActive: data.isActive,
          masterCategoryId: data.masterCategoryId,
          allFields: Object.keys(data)
        });
      });

      // Check app_services
      console.log('\n=== APP_SERVICES COLLECTION ===');
      const servicesSnapshot = await firestore()
        .collection('app_services')
        .limit(10)
        .get();

      console.log(`Found ${servicesSnapshot.size} documents in app_services collection`);
      
      servicesSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`Service ${doc.id}:`, {
          name: data.name,
          masterCategoryId: data.masterCategoryId,
          categoryMasterId: data.categoryMasterId, // Check both field names
          serviceKey: data.serviceKey,
          serviceType: data.serviceType,
          isActive: data.isActive,
          allFields: Object.keys(data)
        });
      });

      // Check service_services with enhanced logging
      console.log('\n=== SERVICE_SERVICES COLLECTION (Enhanced) ===');
      const companiesSnapshot = await firestore()
        .collection('service_services')
        .limit(10)
        .get();

      console.log(`Found ${companiesSnapshot.size} documents in service_services collection`);
      
      companiesSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`Company ${doc.id}:`, {
          name: data.name,
          categoryMasterId: data.categoryMasterId,
          masterCategoryId: data.masterCategoryId, // Check both field names
          companyId: data.companyId,
          price: data.price,
          serviceType: data.serviceType,
          isActive: data.isActive,
          description: data.description,
          rating: data.rating,
          reviewCount: data.reviewCount,
          availability: data.availability,
          phone: data.phone,
          email: data.email,
          address: data.address,
          packages: data.packages ? `${data.packages.length} packages` : 'No packages',
          allFields: Object.keys(data)
        });
      });
      
    } catch (error) {
      console.error('❌ Error in debug method:', error);
    }
  }

  /**
   * 🚫 UNIVERSAL TEST: Test that ALL inactive services are blocked
   */
  static async testUniversalInactiveBlocking(categoryId: string): Promise<void> {
    try {
      console.log('🚫🚫🚫 UNIVERSAL INACTIVE SERVICE TEST STARTED 🚫🚫🚫');
      
      // Step 1: Check raw Firestore data
      const categoryDoc = await firestore()
        .collection('app_categories')
        .doc(categoryId)
        .get();
      
      let searchCategoryId = categoryId;
      if (categoryDoc.exists) {
        const categoryData = categoryDoc.data();
        if (categoryData?.masterCategoryId) {
          searchCategoryId = categoryData.masterCategoryId;
        }
      }
      
      console.log(`🔍 Checking ALL services in Firestore for category: ${searchCategoryId}`);
      
      const snapshot = await firestore()
        .collection('app_services')
        .where('masterCategoryId', '==', searchCategoryId)
        .get();
      
      let totalServices = 0;
      let activeInFirestore = 0;
      let inactiveInFirestore = 0;
      const inactiveServices: string[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        totalServices++;
        
        if (data.isActive === true) {
          activeInFirestore++;
          console.log(`✅ ACTIVE in Firestore: "${data.name}"`);
        } else {
          inactiveInFirestore++;
          inactiveServices.push(data.name);
          console.log(`🚫 INACTIVE in Firestore: "${data.name}" (isActive: ${JSON.stringify(data.isActive)})`);
        }
      });
      
      // Step 2: Test our service method
      console.log(`🧪 Testing getServicesWithCompanies method...`);
      const services = await this.getServicesWithCompanies(categoryId);
      
      let activeInResults = 0;
      let inactiveInResults = 0;
      const leakedInactiveServices: string[] = [];
      
      services.forEach(service => {
        if (service.isActive === true) {
          activeInResults++;
          console.log(`✅ ACTIVE in results: "${service.name}"`);
        } else {
          inactiveInResults++;
          leakedInactiveServices.push(service.name);
          console.log(`🚨 INACTIVE LEAKED: "${service.name}" (should not be in results!)`);
        }
      });
      
      // Results
      console.log(`📊 UNIVERSAL TEST RESULTS:`);
      console.log(`   - Total services in Firestore: ${totalServices}`);
      console.log(`   - Active in Firestore: ${activeInFirestore}`);
      console.log(`   - Inactive in Firestore: ${inactiveInFirestore}`);
      console.log(`   - Active in results: ${activeInResults}`);
      console.log(`   - Inactive leaked to results: ${inactiveInResults}`);
      
      if (inactiveInResults === 0) {
        console.log(`✅ SUCCESS: All ${inactiveInFirestore} inactive services are properly blocked!`);
      } else {
        console.log(`❌ FAILURE: ${inactiveInResults} inactive services leaked to results:`);
        leakedInactiveServices.forEach(name => {
          console.log(`   - "${name}"`);
        });
      }
      
      console.log('🚫🚫🚫 UNIVERSAL INACTIVE SERVICE TEST COMPLETED 🚫🚫🚫');
      
    } catch (error) {
      console.error('❌ Universal test failed:', error);
    }
  }

  /**
   * 🚨 EMERGENCY TEST: Specifically test yoga service blocking
   */
  static async emergencyYogaTest(categoryId: string): Promise<void> {
    try {
      console.log('🚨🚨🚨 EMERGENCY YOGA TEST STARTED 🚨🚨🚨');
      
      // Step 1: Check raw Firestore data
      const categoryDoc = await firestore()
        .collection('app_categories')
        .doc(categoryId)
        .get();
      
      let searchCategoryId = categoryId;
      if (categoryDoc.exists) {
        const categoryData = categoryDoc.data();
        if (categoryData?.masterCategoryId) {
          searchCategoryId = categoryData.masterCategoryId;
        }
      }
      
      console.log(`🔍 Checking raw Firestore data for category: ${searchCategoryId}`);
      
      const snapshot = await firestore()
        .collection('app_services')
        .where('masterCategoryId', '==', searchCategoryId)
        .get();
      
      let yogaFoundInFirestore = false;
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.name && data.name.toLowerCase().includes('yoga')) {
          yogaFoundInFirestore = true;
          console.log(`🚨 YOGA IN FIRESTORE: "${data.name}"`);
          console.log(`   - isActive: ${data.isActive}`);
          console.log(`   - Type: ${typeof data.isActive}`);
          console.log(`   - Should be blocked: ${data.isActive !== true}`);
        }
      });
      
      // Step 2: Test our service method
      console.log(`🧪 Testing getServicesWithCompanies method...`);
      const services = await this.getServicesWithCompanies(categoryId);
      
      let yogaFoundInResults = false;
      services.forEach(service => {
        if (service.name && service.name.toLowerCase().includes('yoga')) {
          yogaFoundInResults = true;
          console.log(`🚨 YOGA IN RESULTS: "${service.name}"`);
          console.log(`   - This should NOT happen!`);
        }
      });
      
      // Results
      console.log(`📊 EMERGENCY TEST RESULTS:`);
      console.log(`   - Yoga found in Firestore: ${yogaFoundInFirestore}`);
      console.log(`   - Yoga found in results: ${yogaFoundInResults}`);
      
      if (yogaFoundInFirestore && !yogaFoundInResults) {
        console.log(`✅ SUCCESS: Yoga service exists in Firestore but is properly blocked from results!`);
      } else if (!yogaFoundInFirestore) {
        console.log(`ℹ️ INFO: No yoga service found in Firestore for this category`);
      } else {
        console.log(`❌ FAILURE: Yoga service is still appearing in results!`);
      }
      
      console.log('🚨🚨🚨 EMERGENCY YOGA TEST COMPLETED 🚨🚨🚨');
      
    } catch (error) {
      console.error('❌ Emergency yoga test failed:', error);
    }
  }

  /**
   * FINAL TEST: Verify that "Yoga sessions (beginner/advanced)" is blocked
   */
  static async testYogaBlocking(categoryId: string): Promise<boolean> {
    try {
      console.log('🧪 FINAL TEST: Checking if Yoga sessions are properly blocked...');
      
      const services = await this.getServicesWithCompanies(categoryId);
      
      console.log(`🧪 Retrieved ${services.length} services from getServicesWithCompanies`);
      
      let yogaFound = false;
      services.forEach(service => {
        console.log(`🧪 Service: "${service.name}" (isActive: ${service.isActive})`);
        
        if (service.name && service.name.toLowerCase().includes('yoga')) {
          yogaFound = true;
          console.log(`🚨 YOGA SERVICE FOUND IN RESULTS: "${service.name}"`);
          console.log(`   This should NOT happen if isActive is false!`);
        }
      });
      
      if (!yogaFound) {
        console.log(`✅ SUCCESS: No yoga services found in results - inactive services are properly blocked!`);
        return true;
      } else {
        console.log(`❌ FAILURE: Yoga service found in results - blocking is not working!`);
        return false;
      }
      
    } catch (error) {
      console.error('❌ Test failed:', error);
      return false;
    }
  }

  /**
   * EMERGENCY DEBUG: Call this method to see exactly what's happening with services
   */
  static async emergencyDebugServices(categoryId: string): Promise<void> {
    try {
      console.log('🚨🚨🚨 EMERGENCY DEBUG STARTED 🚨🚨🚨');
      console.log(`Category ID: ${categoryId}`);
      
      // Step 1: Check the category
      const categoryDoc = await firestore()
        .collection('app_categories')
        .doc(categoryId)
        .get();
      
      let searchCategoryId = categoryId;
      if (categoryDoc.exists) {
        const categoryData = categoryDoc.data();
        console.log('📁 Category data:', categoryData);
        if (categoryData?.masterCategoryId) {
          searchCategoryId = categoryData.masterCategoryId;
          console.log(`🔄 Using masterCategoryId: ${searchCategoryId}`);
        }
      }
      
      // Step 2: Get ALL services (no filtering)
      const allSnapshot = await firestore()
        .collection('app_services')
        .where('masterCategoryId', '==', searchCategoryId)
        .get();
      
      console.log(`📊 TOTAL services found: ${allSnapshot.size}`);
      
      allSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`📋 Service: "${data.name}"`, {
          id: doc.id,
          isActive: data.isActive,
          type: typeof data.isActive,
          value: JSON.stringify(data.isActive),
          shouldShow: data.isActive === true
        });
      });
      
      // Step 3: Test the main method
      console.log('🧪 Testing getServicesWithCompanies...');
      const services = await this.getServicesWithCompanies(categoryId);
      console.log(`🧪 getServicesWithCompanies returned ${services.length} services:`);
      services.forEach(service => {
        console.log(`  - "${service.name}" (isActive: ${service.isActive})`);
      });
      
      console.log('🚨🚨🚨 EMERGENCY DEBUG COMPLETED 🚨🚨🚨');
      
    } catch (error) {
      console.error('❌ Emergency debug failed:', error);
    }
  }

  /**
   * Emergency method to specifically check and block the "Yoga sessions" service
   */
  static async checkYogaSessionsService(categoryId: string): Promise<void> {
    try {
      console.log('🚨 EMERGENCY CHECK: Looking for "Yoga sessions" service...');
      
      // Get the category's masterCategoryId
      const categoryDoc = await firestore()
        .collection('app_categories')
        .doc(categoryId.trim())
        .get();
      
      let searchCategoryId = categoryId.trim();
      if (categoryDoc.exists) {
        const categoryData = categoryDoc.data();
        if (categoryData?.masterCategoryId) {
          searchCategoryId = categoryData.masterCategoryId;
        }
      }
      
      // Get ALL services in this category
      const snapshot = await firestore()
        .collection('app_services')
        .where('masterCategoryId', '==', searchCategoryId)
        .get();
      
      console.log(`🚨 Found ${snapshot.size} total services in category`);
      
      let yogaFound = false;
      
      snapshot.forEach(doc => {
        const data = doc.data();
        
        // Check if this is the yoga service
        if (data.name && data.name.toLowerCase().includes('yoga')) {
          yogaFound = true;
          console.log(`🚨 FOUND YOGA SERVICE:`, {
            id: doc.id,
            name: data.name,
            isActive: data.isActive,
            isActiveType: typeof data.isActive,
            isActiveValue: JSON.stringify(data.isActive),
            shouldBeBlocked: data.isActive !== true
          });
          
          if (data.isActive !== true) {
            console.log(`🚫 YOGA SERVICE IS INACTIVE AND SHOULD BE BLOCKED!`);
          } else {
            console.log(`✅ Yoga service is active and should be shown`);
          }
        }
      });
      
      if (!yogaFound) {
        console.log(`ℹ️ No yoga service found in category ${searchCategoryId}`);
      }
      
    } catch (error) {
      console.error('❌ Error in checkYogaSessionsService:', error);
    }
  }

  /**
   * Method to verify that only active services are returned for a category
   */
  static async verifyActiveServicesOnly(categoryId: string): Promise<boolean> {
    try {
      console.log(`🧪 VERIFICATION: Checking that only active services are returned for category: ${categoryId}`);
      
      // Get services using the main method
      const services = await this.getServicesWithCompanies(categoryId);
      
      console.log(`🧪 Retrieved ${services.length} services from getServicesWithCompanies`);
      
      // Check each service
      let allActive = true;
      services.forEach(service => {
        if (service.isActive !== true) {
          console.error(`🚫 VERIFICATION FAILED: Found inactive service: ${service.name} (isActive: ${service.isActive})`);
          allActive = false;
        } else {
          console.log(`✅ Service "${service.name}" is properly active`);
        }
      });
      
      if (allActive) {
        console.log(`✅ VERIFICATION PASSED: All ${services.length} services are active`);
      } else {
        console.error(`❌ VERIFICATION FAILED: Some inactive services were returned`);
      }
      
      return allActive;
      
    } catch (error) {
      console.error('❌ Error in verifyActiveServicesOnly:', error);
      return false;
    }
  }

  /**
   * Debug method to check for inactive services that might be showing up
   */
  static async debugInactiveServices(categoryId?: string): Promise<void> {
    try {
      console.log('🔍 DEBUG: Checking for inactive services that might be showing...');
      
      let query;
      
      if (categoryId) {
        // First check the category to get masterCategoryId
        const categoryDoc = await firestore()
          .collection('app_categories')
          .doc(categoryId)
          .get();
        
        let searchCategoryId = categoryId;
        if (categoryDoc.exists) {
          const categoryData = categoryDoc.data();
          if (categoryData?.masterCategoryId) {
            searchCategoryId = categoryData.masterCategoryId;
          }
        }
        
        query = firestore()
          .collection('app_services')
          .where('masterCategoryId', '==', searchCategoryId);
        console.log(`🔍 Checking services for category: ${searchCategoryId}`);
      } else {
        query = firestore().collection('app_services');
      }
      
      const snapshot = await query.get();
      
      console.log(`🔍 Found ${snapshot.size} total services`);
      
      interface ServiceInfo {
        id: string;
        name: string;
        isActive: any;
        isActiveType: string;
        masterCategoryId: string;
      }
      
      const activeServices: ServiceInfo[] = [];
      const inactiveServices: ServiceInfo[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        const serviceInfo = {
          id: doc.id,
          name: data.name,
          isActive: data.isActive,
          isActiveType: typeof data.isActive,
          masterCategoryId: data.masterCategoryId
        };
        
        if (data.isActive === true) {
          activeServices.push(serviceInfo);
        } else {
          inactiveServices.push(serviceInfo);
        }
      });
      
      console.log(`✅ ACTIVE services (${activeServices.length}):`, activeServices);
      console.log(`🚫 INACTIVE services (${inactiveServices.length}):`, inactiveServices);
      
      if (inactiveServices.length > 0) {
        console.warn(`⚠️ WARNING: Found ${inactiveServices.length} inactive services that should NOT be displayed in the app!`);
        inactiveServices.forEach(service => {
          console.warn(`🚫 INACTIVE: "${service.name}" (ID: ${service.id}, isActive: ${service.isActive})`);
        });
      }
      
    } catch (error) {
      console.error('❌ Error in debugInactiveServices:', error);
    }
  }

  /**
   * Test method to verify company name lookup is working
   */
  static async testCompanyLookup(companyId?: string): Promise<void> {
    try {
      const testId = companyId || 'MMbY4RdZgrX2qeVo5nYXwFJkZ4V2'; // Use the ID from your screenshot
      
      console.log(`🧪 Testing company lookup for ID: ${testId}`);
      
      const companyName = await this.getActualCompanyName(testId);
      console.log(`🧪 Result: ${testId} → ${companyName}`);
      
      // Also test batch lookup
      const batchResult = await this.getMultipleCompanyNames([testId]);
      console.log(`🧪 Batch result:`, Object.fromEntries(batchResult));
      
    } catch (error) {
      console.error('🧪 Error in testCompanyLookup:', error);
    }
  }

  /**
   * Debug method to check what company name fields are available in service_services
   */
  static async debugCompanyNames(): Promise<void> {
    try {
      console.log('🔍 DEBUG: Checking company name fields in service_services...');
      
      const snapshot = await firestore()
        .collection('service_services')
        .limit(10)
        .get();

      console.log(`Found ${snapshot.size} documents in service_services collection`);
      
      snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`🔍 Document ${doc.id}:`, {
          serviceName: data.name,
          companyName: data.companyName,
          businessName: data.businessName,
          providerName: data.providerName,
          companyId: data.companyId,
          isActive: data.isActive,
          availableFields: Object.keys(data).filter(key => 
            key.toLowerCase().includes('name') || 
            key.toLowerCase().includes('company') ||
            key.toLowerCase().includes('business') ||
            key.toLowerCase().includes('provider')
          )
        });
      });
      
    } catch (error) {
      console.error('❌ Error in debugCompanyNames:', error);
    }
  }

  /**
   * Test method to fetch and display sample data from service_services collection
   */
  static async testServiceServicesData(categoryId?: string): Promise<void> {
    try {
      console.log('🧪 TESTING: Fetching sample data from service_services collection...');
      
      let snapshot;
      
      if (categoryId) {
        console.log(`🧪 Testing with categoryId: ${categoryId}`);
        snapshot = await firestore()
          .collection('service_services')
          .where('categoryMasterId', '==', categoryId)
          .limit(5)
          .get();
      } else {
        snapshot = await firestore()
          .collection('service_services')
          .limit(5)
          .get();
      }
      
      console.log(`🧪 Found ${snapshot.size} documents in service_services collection`);
      
      snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`🧪 Company ${doc.id}:`, {
          serviceName: data.name,
          companyName: data.companyName || `Company ${data.companyId}`,
          categoryMasterId: data.categoryMasterId,
          companyId: data.companyId,
          price: data.price,
          serviceType: data.serviceType,
          isActive: data.isActive,
          description: data.description,
          rating: data.rating,
          reviewCount: data.reviewCount,
          availability: data.availability,
          packages: data.packages ? `${Array.isArray(data.packages) ? data.packages.length : 'Invalid'} packages` : 'No packages',
          contactInfo: {
            phone: data.phone || data.contactPhone,
            email: data.email || data.contactEmail,
            address: data.address || data.contactAddress,
          },
          allAvailableFields: Object.keys(data).sort()
        });
      });
      
      if (snapshot.size === 0) {
        console.log('🧪 No documents found. Checking if collection exists...');
        const allSnapshot = await firestore().collection('service_services').limit(1).get();
        console.log(`🧪 Total documents in service_services: ${allSnapshot.size}`);
      }
      
    } catch (error) {
      console.error('🧪 Error testing service_services data:', error);
    }
  }

  /**
   * Fetch service bookings from service_bookings collection
   */
  static async getServiceBookings(limit: number = 20): Promise<ServiceBooking[]> {
    try {
      console.log(`🔥 Fetching ${limit} service bookings from service_bookings collection...`);
      
      const snapshot = await firestore()
        .collection('service_bookings')
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      console.log(`Found ${snapshot.size} bookings in service_bookings collection`);

      const bookings: ServiceBooking[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        
        console.log(`📋 Booking ${doc.id}:`, {
          serviceName: data.serviceName,
          customerName: data.customerName,
          status: data.status,
          date: data.date,
          time: data.time
        });
        
        bookings.push({
          id: doc.id,
          serviceName: data.serviceName || '',
          workName: data.workName || data.serviceName || '',
          customerName: data.customerName || '',
          customerPhone: data.customerPhone || data.phone,
          customerAddress: data.customerAddress || data.address,
          date: data.date || '',
          time: data.time || '',
          status: data.status || 'pending',
          companyId: data.companyId,
          technicianName: data.technicianName,
          technicianId: data.technicianId,
          totalPrice: data.totalPrice,
          addOns: data.addOns || [],
          startOtp: data.startOtp,
          otpVerified: data.otpVerified,
          assignedAt: data.assignedAt,
          startedAt: data.startedAt,
          completedAt: data.completedAt,
          rejectedAt: data.rejectedAt,
          expiredAt: data.expiredAt,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      });

      console.log(`✅ Fetched ${bookings.length} service bookings from Firebase`);
      return bookings;
    } catch (error) {
      console.error('❌ Error fetching service bookings:', error);
      throw new Error('Failed to fetch service bookings. Please check your internet connection.');
    }
  }

  /**
   * Fetch a specific service booking by ID
   */
  static async getServiceBookingById(bookingId: string): Promise<ServiceBooking | null> {
    try {
      console.log(`🔥 Fetching booking ${bookingId} from service_bookings collection...`);
      
      const doc = await firestore()
        .collection('service_bookings')
        .doc(bookingId)
        .get();

      if (!doc.exists) {
        console.log(`❌ Booking ${bookingId} not found`);
        return null;
      }

      const data = doc.data();
      if (!data) {
        console.log(`❌ Booking ${bookingId} has no data`);
        return null;
      }
      
      console.log(`✅ Found booking ${bookingId}:`, {
        serviceName: data.serviceName,
        customerName: data.customerName,
        status: data.status,
        date: data.date,
        time: data.time
      });
      
      return {
        id: doc.id,
        serviceName: data.serviceName || '',
        workName: data.workName || data.serviceName || '',
        customerName: data.customerName || '',
        customerPhone: data.customerPhone || data.phone,
        customerAddress: data.customerAddress || data.address,
        date: data.date || '',
        time: data.time || '',
        status: data.status || 'pending',
        companyId: data.companyId,
        technicianName: data.technicianName,
        technicianId: data.technicianId,
        totalPrice: data.totalPrice,
        addOns: data.addOns || [],
        startOtp: data.startOtp,
        otpVerified: data.otpVerified,
        assignedAt: data.assignedAt,
        startedAt: data.startedAt,
        completedAt: data.completedAt,
        rejectedAt: data.rejectedAt,
        expiredAt: data.expiredAt,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    } catch (error) {
      console.error(`❌ Error fetching booking ${bookingId}:`, error);
      throw new Error('Failed to fetch booking details. Please check your internet connection.');
    }
  }

  /**
   * Update booking status
   */
  static async updateBookingStatus(
    bookingId: string, 
    status: ServiceBooking['status'], 
    additionalData?: Partial<ServiceBooking>
  ): Promise<void> {
    try {
      console.log(`🔥 Updating booking ${bookingId} status to ${status}...`);
      
      const updateData: any = {
        status,
        updatedAt: new Date(),
        ...additionalData
      };

      await firestore()
        .collection('service_bookings')
        .doc(bookingId)
        .update(updateData);

      console.log(`✅ Updated booking ${bookingId} status to ${status}`);
    } catch (error) {
      console.error(`❌ Error updating booking ${bookingId} status:`, error);
      throw new Error('Failed to update booking status. Please check your internet connection.');
    }
  }

  /**
   * Submit customer rating and feedback for a completed booking
   */
  static async submitBookingRating(
    bookingId: string,
    rating: number,
    feedback?: string
  ): Promise<void> {
    try {
      console.log(`⭐ Submitting rating ${rating} for booking ${bookingId}...`);
      console.log(`📝 Feedback: "${feedback}"`);

      const updateData: any = {
        customerRating: rating,
        ratedAt: new Date(),
        updatedAt: new Date(),
      };

      if (feedback && feedback.trim()) {
        updateData.customerFeedback = feedback.trim();
      }

      console.log(`🔥 Update data:`, updateData);

      await firestore()
        .collection('service_bookings')
        .doc(bookingId)
        .update(updateData);

      console.log(`✅ Rating submitted for booking ${bookingId}`);
    } catch (error) {
      console.error(`❌ Error submitting rating for booking ${bookingId}:`, error);
      throw new Error('Failed to submit rating. Please check your internet connection.');
    }
  }

  /**
   * Create a new service booking
   */
  static async createServiceBooking(bookingData: Omit<ServiceBooking, 'id'>): Promise<string> {
    try {
      console.log(`🔥 Creating new service booking...`);
      
      const docRef = await firestore()
        .collection('service_bookings')
        .add({
          ...bookingData,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

      console.log(`✅ Created booking with ID: ${docRef.id}`);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error creating service booking:', error);
      throw new Error('Failed to create service booking. Please check your internet connection.');
    }
  }

  static async getCompaniesFromServiceCompany(): Promise<any[]> {
    try {
      console.log('🏢 Fetching all companies from service_company collection...');
      
      const snapshot = await firestore()
        .collection('service_company')
        .get();

      const companies: any[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        companies.push({
          id: doc.id,
          ...data,
        });
      });

      console.log(`✅ Found ${companies.length} companies in service_company collection`);
      return companies;
    } catch (error) {
      console.error('❌ Error fetching companies from service_company:', error);
      throw new Error('Failed to fetch companies from service_company. Please check your internet connection.');
    }
  }

  /**
   * Listen to real-time updates for a specific service booking
   */
  static listenToServiceBooking(
    bookingId: string,
    onUpdate: (booking: ServiceBooking | null) => void,
    onError?: (error: Error) => void
  ): () => void {
    console.log(`🔥 Setting up real-time listener for booking ${bookingId}...`);

    const unsubscribe = firestore()
      .collection('service_bookings')
      .doc(bookingId)
      .onSnapshot(
        (doc) => {
          if (!doc.exists) {
            console.log(`❌ Booking ${bookingId} not found in real-time listener`);
            onUpdate(null);
            return;
          }

          const data = doc.data();
          if (!data) {
            console.log(`❌ Booking ${bookingId} has no data in real-time listener`);
            onUpdate(null);
            return;
          }

          const booking: ServiceBooking = {
            id: doc.id,
            ...data,
          } as ServiceBooking;

          console.log(`🔄 Real-time update for booking ${bookingId}: status = ${booking.status}`);
          onUpdate(booking);
        },
        (error) => {
          console.error(`❌ Error in real-time listener for booking ${bookingId}:`, error);
          if (onError) {
            onError(error);
          }
        }
      );

    return unsubscribe;
  }
}