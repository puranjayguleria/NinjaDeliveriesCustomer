/**
 * Test file to demonstrate the enhanced package functionality
 * This file shows how to use the new package-related methods
 */

import { FirestoreService } from '../services/firestoreService';

export class EnhancedPackageTest {
  /**
   * Test the enhanced package functionality for a specific category
   */
  static async testEnhancedPackages(categoryId: string): Promise<void> {
    try {
      console.log('🧪 Testing Enhanced Package Functionality');
      console.log('=====================================');
      
      // Step 1: Get services for the category
      console.log(`\n1. Fetching services for category: ${categoryId}`);
      const services = await FirestoreService.getServicesWithCompanies(categoryId);
      console.log(`   Found ${services.length} services`);
      
      if (services.length === 0) {
        console.log('   ❌ No services found for this category');
        return;
      }
      
      // Step 2: Test enhanced package fetching for each service
      for (const service of services.slice(0, 3)) { // Test first 3 services
        console.log(`\n2. Testing service: "${service.name}" (ID: ${service.id})`);
        
        // Get companies with detailed packages
        const companiesWithPackages = await FirestoreService.getCompaniesWithDetailedPackages([service.id]);
        console.log(`   Found ${companiesWithPackages.length} companies with packages`);
        
        companiesWithPackages.forEach((company, index) => {
          console.log(`   Company ${index + 1}: ${company.companyName}`);
          console.log(`     - Base Price: ₹${company.price || 'Not set'}`);
          console.log(`     - Packages: ${company.packages?.length || 0}`);
          
          if (company.packages && company.packages.length > 0) {
            company.packages.forEach((pkg: any, pkgIndex: number) => {
              if (typeof pkg === 'string') {
                console.log(`       Package ${pkgIndex + 1}: ${pkg} (₹${company.price || 0})`);
              } else {
                console.log(`       Package ${pkgIndex + 1}: ${pkg.name || 'Unnamed'} (₹${pkg.price || company.price || 0})`);
                if (pkg.features) {
                  console.log(`         Features: ${pkg.features.join(', ')}`);
                }
              }
            });
          }
        });
        
        // Get pricing summary
        const pricingSummary = await FirestoreService.getPackagePricingSummary(service.id);
        console.log(`   Pricing Summary:`, pricingSummary);
      }
      
      console.log('\n✅ Enhanced Package Test Completed Successfully!');
      
    } catch (error) {
      console.error('❌ Enhanced Package Test Failed:', error);
    }
  }
  
  /**
   * Test package pricing summary for multiple services
   */
  static async testPricingSummaries(serviceIds: string[]): Promise<void> {
    try {
      console.log('🧪 Testing Package Pricing Summaries');
      console.log('===================================');
      
      for (const serviceId of serviceIds) {
        console.log(`\nService ID: ${serviceId}`);
        const summary = await FirestoreService.getPackagePricingSummary(serviceId);
        console.log('Pricing Summary:', {
          minPrice: summary.minPrice ? `₹${summary.minPrice}` : 'N/A',
          maxPrice: summary.maxPrice ? `₹${summary.maxPrice}` : 'N/A',
          averagePrice: summary.averagePrice ? `₹${summary.averagePrice}` : 'N/A',
          totalPackages: summary.totalPackages,
          companiesCount: summary.companiesCount,
        });
      }
      
    } catch (error) {
      console.error('❌ Pricing Summary Test Failed:', error);
    }
  }
  
  /**
   * Demonstrate the complete flow from service selection to package display
   */
  static async demonstrateCompleteFlow(categoryId: string): Promise<void> {
    try {
      console.log('🧪 Demonstrating Complete Enhanced Package Flow');
      console.log('==============================================');
      
      // Step 1: Simulate ServiceCategoryScreen behavior
      console.log('\n📱 Step 1: ServiceCategoryScreen - Fetching services with company packages');
      const services = await FirestoreService.getServicesWithCompanies(categoryId);
      
      const companiesMap = new Map();
      for (const service of services) {
        if (service.id !== 'other') {
          const companies = await FirestoreService.getCompaniesWithDetailedPackages([service.id]);
          if (companies.length > 0) {
            companiesMap.set(service.id, companies);
          }
        }
      }
      
      console.log(`   Services with companies: ${companiesMap.size}`);
      
      // Step 2: Simulate user selection
      const selectedServiceIds = Array.from(companiesMap.keys()).slice(0, 2);
      console.log(`\n👤 Step 2: User selects services: ${selectedServiceIds.join(', ')}`);
      
      // Step 3: Simulate CompanySelectionScreen behavior
      console.log('\n🏢 Step 3: CompanySelectionScreen - Displaying enhanced company packages');
      const allCompanies: any[] = [];
      selectedServiceIds.forEach(serviceId => {
        const companies = companiesMap.get(serviceId) || [];
        allCompanies.push(...companies);
      });
      
      console.log(`   Total companies to display: ${allCompanies.length}`);
      
      allCompanies.forEach((company, index) => {
        console.log(`\n   Company ${index + 1}: ${company.companyName}`);
        console.log(`     Service: ${company.serviceName}`);
        console.log(`     Base Price: ₹${company.price || 'Not set'}`);
        
        if (company.packages && company.packages.length > 0) {
          console.log(`     Packages (${company.packages.length}):`);
          company.packages.forEach((pkg: any, pkgIndex: number) => {
            if (typeof pkg === 'object') {
              console.log(`       - ${pkg.name}: ₹${pkg.price || company.price} (${pkg.duration || 'Duration not set'})`);
              if (pkg.features && pkg.features.length > 0) {
                console.log(`         Features: ${pkg.features.slice(0, 3).join(', ')}${pkg.features.length > 3 ? '...' : ''}`);
              }
            } else {
              console.log(`       - ${pkg}: ₹${company.price || 0}`);
            }
          });
        }
      });
      
      console.log('\n✅ Complete Flow Demonstration Finished!');
      
    } catch (error) {
      console.error('❌ Complete Flow Demonstration Failed:', error);
    }
  }
}

// Example usage:
// EnhancedPackageTest.testEnhancedPackages('your-category-id');
// EnhancedPackageTest.demonstrateCompleteFlow('your-category-id');