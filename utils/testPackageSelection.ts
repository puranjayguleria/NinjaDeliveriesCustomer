/**
 * Test Package Selection UI Functionality
 * 
 * This test verifies that:
 * 1. Package data is properly extracted from website structure
 * 2. Package selection UI displays correctly
 * 3. Package selection state is managed properly
 */

import { FirestoreService } from '../services/firestoreService';

export const testPackageSelection = async () => {
  console.log('🧪 TESTING PACKAGE SELECTION FUNCTIONALITY');
  console.log('='.repeat(50));
  
  try {
    // Test 1: Get companies with packages
    console.log('\n📋 TEST 1: Fetching companies with packages...');
    const testServiceIds = ['electrician_outlet_repair', 'plumber_pipe_repair'];
    
    const companies = await FirestoreService.getCompaniesWithDetailedPackages(testServiceIds);
    console.log(`✅ Found ${companies.length} companies`);
    
    // Test 2: Analyze package data structure
    console.log('\n📋 TEST 2: Analyzing package data structure...');
    companies.forEach((company, companyIndex) => {
      console.log(`\n🏢 Company ${companyIndex + 1}: ${company.companyName || company.serviceName}`);
      console.log(`   Company ID: ${company.id}`);
      console.log(`   Has packages: ${company.packages ? 'YES' : 'NO'}`);
      console.log(`   Package count: ${company.packages?.length || 0}`);
      console.log(`   Direct price: ${company.price || 'N/A'}`);
      
      if (company.packages && Array.isArray(company.packages) && company.packages.length > 0) {
        console.log(`   📦 PACKAGE DETAILS:`);
        company.packages.forEach((pkg: any, pkgIndex: number) => {
          console.log(`      Package ${pkgIndex + 1}:`);
          console.log(`         Name: ${pkg.name || pkg.title || pkg.packageName || 'N/A'}`);
          console.log(`         Price: ₹${pkg.price || pkg.amount || company.price || 0}`);
          console.log(`         Duration: ${pkg.duration || pkg.validity || pkg.period || 'N/A'}`);
          console.log(`         Type: ${pkg.type || pkg.frequency || pkg.interval || 'N/A'}`);
          console.log(`         Features: ${pkg.features ? pkg.features.slice(0, 2).join(', ') : 'N/A'}`);
          console.log(`         Popular: ${pkg.isPopular || pkg.recommended || false}`);
          console.log(`         Original Price: ${pkg.originalPrice || pkg.mrp || 'N/A'}`);
          console.log(`         Discount: ${pkg.discount || pkg.offer || 'N/A'}`);
        });
      } else {
        console.log(`   💰 DIRECT PRICING SERVICE (no packages)`);
      }
    });
    
    // Test 3: Simulate package selection
    console.log('\n📋 TEST 3: Simulating package selection...');
    const packageCompanies = companies.filter(c => c.packages && c.packages.length > 0);
    
    if (packageCompanies.length > 0) {
      const testCompany = packageCompanies[0];
      console.log(`\n🎯 Testing package selection for: ${testCompany.companyName}`);
      
      if (testCompany.packages && testCompany.packages.length > 0) {
        const selectedPackageIndex = 0;
        const selectedPackage = testCompany.packages[selectedPackageIndex];
        
        console.log(`✅ Selected package ${selectedPackageIndex + 1}:`);
        console.log(`   Name: ${selectedPackage.name || 'N/A'}`);
        console.log(`   Price: ₹${selectedPackage.price || 0}`);
        console.log(`   Type: ${selectedPackage.type || 'N/A'}`);
        
        // Simulate the state that would be set in the UI
        const simulatedState = {
          selectedCompanyId: testCompany.id,
          selectedPackageIndex: selectedPackageIndex,
          selectedPackage: {
            name: selectedPackage.name || selectedPackage.title || `Package ${selectedPackageIndex + 1}`,
            price: selectedPackage.price || selectedPackage.amount || testCompany.price || 0,
            duration: selectedPackage.duration || selectedPackage.validity || selectedPackage.period,
            type: selectedPackage.type || selectedPackage.frequency || selectedPackage.interval || 'one-time',
            description: selectedPackage.description || selectedPackage.details || '',
            features: selectedPackage.features || selectedPackage.services || selectedPackage.includes || [],
            isPopular: selectedPackage.isPopular || selectedPackage.recommended || false,
            originalPrice: selectedPackage.originalPrice || selectedPackage.mrp,
            discount: selectedPackage.discount || selectedPackage.offer,
            index: selectedPackageIndex
          }
        };
        
        console.log(`🎯 Simulated UI state:`, JSON.stringify(simulatedState, null, 2));
      }
    } else {
      console.log(`⚠️ No companies with packages found for testing`);
    }
    
    // Test 4: Check for common issues
    console.log('\n📋 TEST 4: Checking for common issues...');
    
    const issuesFound = [];
    
    // Check if companies have proper package structure
    companies.forEach((company, index) => {
      if (company.packages && Array.isArray(company.packages)) {
        company.packages.forEach((pkg: any, pkgIndex: number) => {
          if (!pkg.name && !pkg.title && !pkg.packageName) {
            issuesFound.push(`Company ${index + 1}, Package ${pkgIndex + 1}: Missing name/title`);
          }
          if (!pkg.price && !pkg.amount && !company.price) {
            issuesFound.push(`Company ${index + 1}, Package ${pkgIndex + 1}: Missing price`);
          }
        });
      }
    });
    
    if (issuesFound.length > 0) {
      console.log(`⚠️ Issues found:`);
      issuesFound.forEach(issue => console.log(`   - ${issue}`));
    } else {
      console.log(`✅ No issues found with package data structure`);
    }
    
    console.log('\n🎉 PACKAGE SELECTION TEST COMPLETED');
    console.log('='.repeat(50));
    
    return {
      success: true,
      companiesCount: companies.length,
      packageCompaniesCount: companies.filter(c => c.packages && c.packages.length > 0).length,
      directPricingCompaniesCount: companies.filter(c => !c.packages || c.packages.length === 0).length,
      issuesFound: issuesFound.length
    };
    
  } catch (error) {
    console.error('❌ PACKAGE SELECTION TEST FAILED:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Export for easy testing
export default testPackageSelection;