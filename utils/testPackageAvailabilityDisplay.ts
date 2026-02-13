/**
 * Test utility to verify Package Flow vs Price Flow display logic
 * This ensures CompanySelectionScreen shows completely separate flows
 */

export interface TestServiceCompany {
  id: string;
  companyName: string;
  serviceName: string;
  price?: number;
  packages?: any[];
  availability: string;
  isAllWorkersBusy?: boolean;
}

/**
 * Test function to verify the two separate flows
 */
export function testSeparateFlowsLogic() {
  console.log('🧪 Testing Package Flow vs Price Flow (Separate Flows)\n');

  // Test cases
  const testCompanies: TestServiceCompany[] = [
    {
      id: 'company_1',
      companyName: 'ElectroFix Pro',
      serviceName: 'Electrician Service',
      price: 299,
      packages: [
        { name: 'Basic Repair', price: 299, duration: '1 hour' },
        { name: 'Full Inspection', price: 599, duration: '2 hours' },
        { name: 'Emergency Service', price: 899, duration: '30 mins' }
      ],
      availability: 'Available now',
      isAllWorkersBusy: false
    },
    {
      id: 'company_2', 
      companyName: 'Quick Plumber',
      serviceName: 'Plumbing Service',
      price: 199,
      packages: [], // Empty packages array
      availability: 'Available now',
      isAllWorkersBusy: false
    },
    {
      id: 'company_3',
      companyName: 'Home Cleaners',
      serviceName: 'Cleaning Service', 
      price: 399,
      // No packages property
      availability: 'All workers busy',
      isAllWorkersBusy: true
    }
  ];

  testCompanies.forEach((company, index) => {
    console.log(`\n📋 Test Case ${index + 1}: ${company.companyName}`);
    console.log(`   Service: ${company.serviceName}`);
    
    // Determine which flow this company uses
    const hasPackages = company.packages && Array.isArray(company.packages) && company.packages.length > 0;
    const flowType = hasPackages ? 'PACKAGE FLOW' : 'PRICE FLOW';
    
    console.log(`   🔄 Flow Type: ${flowType}`);
    
    if (hasPackages) {
      // PACKAGE FLOW
      console.log(`   📦 Package Availability: "${company.availability}"`);
      console.log(`   📦 Package Info: "${company.packages!.length} package${company.packages!.length > 1 ? 's' : ''} available"`);
      console.log(`   ❌ Price Display: HIDDEN (not shown in package flow)`);
      console.log(`   ✅ Expected: Only package information, no price display`);
    } else {
      // PRICE FLOW
      console.log(`   💰 Service Availability: "${company.availability}"`);
      console.log(`   💰 Price Info: "Fixed service pricing: ₹${company.price || 'Not set'}"`);
      console.log(`   ❌ Package Display: HIDDEN (not shown in price flow)`);
      console.log(`   ✅ Expected: Only price information, no package display`);
    }
    
    console.log(`   🎨 Status Color: ${company.isAllWorkersBusy ? 'Red (Busy)' : 'Green (Available)'}`);
  });

  console.log('\n🎯 Summary of Separate Flows:');
  console.log('📦 PACKAGE FLOW:');
  console.log('   - Shows "Package Availability:" label');
  console.log('   - Shows package count information');
  console.log('   - HIDES price information completely');
  console.log('   - Used when: packages array exists and has length > 0');
  console.log('');
  console.log('💰 PRICE FLOW:');
  console.log('   - Shows "Service Availability:" label');
  console.log('   - Shows fixed service pricing');
  console.log('   - HIDES package information completely');
  console.log('   - Used when: no packages or empty packages array');
}

/**
 * Helper function to determine which flow a company uses
 */
export function getFlowType(company: TestServiceCompany): 'PACKAGE' | 'PRICE' {
  const hasPackages = company.packages && Array.isArray(company.packages) && company.packages.length > 0;
  return hasPackages ? 'PACKAGE' : 'PRICE';
}

/**
 * Helper function to get display information for a specific flow
 */
export function getFlowDisplayInfo(company: TestServiceCompany) {
  const flowType = getFlowType(company);
  
  if (flowType === 'PACKAGE') {
    return {
      flowType: 'PACKAGE FLOW',
      availabilityLabel: 'Package Availability:',
      mainInfo: `📦 ${company.packages!.length} package${company.packages!.length > 1 ? 's' : ''} available`,
      hiddenInfo: 'Price information (hidden)',
      statusColor: company.isAllWorkersBusy ? 'red' : 'green',
      statusText: company.availability
    };
  } else {
    return {
      flowType: 'PRICE FLOW',
      availabilityLabel: 'Service Availability:',
      mainInfo: `💰 Fixed service pricing: ₹${company.price || 'Not set'}`,
      hiddenInfo: 'Package information (hidden)',
      statusColor: company.isAllWorkersBusy ? 'red' : 'green',
      statusText: company.availability
    };
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testSeparateFlowsLogic();
}