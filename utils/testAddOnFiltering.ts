/**
 * Test utility to verify add-on services filtering logic
 * This helps ensure only unboooked services are shown as add-ons
 */

export interface ServiceFilterTestCase {
  scenario: string;
  allServices: Array<{
    id: string;
    name: string;
  }>;
  existingServices: string[];
  expectedAvailable: string[];
  expectedExcluded: string[];
}

export const serviceFilterTestCases: ServiceFilterTestCase[] = [
  {
    scenario: "Basic filtering - exact matches",
    allServices: [
      { id: "1", name: "Electrician" },
      { id: "2", name: "Plumber" },
      { id: "3", name: "Carpenter" },
      { id: "4", name: "Painter" }
    ],
    existingServices: ["Electrician", "Plumber"],
    expectedAvailable: ["Carpenter", "Painter"],
    expectedExcluded: ["Electrician", "Plumber"]
  },
  {
    scenario: "Partial matching - service variations",
    allServices: [
      { id: "1", name: "Electrical Work" },
      { id: "2", name: "Electrician" },
      { id: "3", name: "Plumbing" },
      { id: "4", name: "Plumber" },
      { id: "5", name: "Cleaning" },
      { id: "6", name: "Deep Cleaning" }
    ],
    existingServices: ["Electrician", "Plumber"],
    expectedAvailable: ["Cleaning", "Deep Cleaning"],
    expectedExcluded: ["Electrical Work", "Electrician", "Plumbing", "Plumber"]
  },
  {
    scenario: "Complex case with main service and add-ons",
    allServices: [
      { id: "1", name: "Home Cleaning" },
      { id: "2", name: "Deep Cleaning" },
      { id: "3", name: "Carpet Cleaning" },
      { id: "4", name: "Window Cleaning" },
      { id: "5", name: "Kitchen Cleaning" },
      { id: "6", name: "Bathroom Cleaning" }
    ],
    existingServices: ["Home Cleaning", "Deep Cleaning"], // Main service + 1 add-on
    expectedAvailable: ["Carpet Cleaning", "Window Cleaning", "Kitchen Cleaning", "Bathroom Cleaning"],
    expectedExcluded: ["Home Cleaning", "Deep Cleaning"]
  },
  {
    scenario: "All services already booked",
    allServices: [
      { id: "1", name: "Electrician" },
      { id: "2", name: "Electrical Repair" },
      { id: "3", name: "Wiring" }
    ],
    existingServices: ["Electrician", "Electrical Repair", "Wiring"],
    expectedAvailable: [],
    expectedExcluded: ["Electrician", "Electrical Repair", "Wiring"]
  }
];

/**
 * Simulate the filtering logic from AddOnServicesModal
 */
export function simulateServiceFiltering(allServices: any[], existingServices: string[]) {
  console.log(`🔍 Filtering ${allServices.length} services against ${existingServices.length} existing services`);
  console.log(`📋 Existing services:`, existingServices);
  
  const availableServices = allServices.filter(service => {
    const serviceName = service.name.toLowerCase().trim();
    
    // Check if this service is already booked
    const isAlreadyBooked = existingServices.some(existing => {
      const existingName = existing.toLowerCase().trim();
      
      // Exact match
      if (serviceName === existingName) {
        console.log(`🚫 Excluding exact match: "${service.name}" = "${existing}"`);
        return true;
      }
      
      // Check if service name contains existing service name or vice versa
      if (serviceName.includes(existingName) || existingName.includes(serviceName)) {
        console.log(`🚫 Excluding partial match: "${service.name}" ~ "${existing}"`);
        return true;
      }
      
      // Check for common service variations (e.g., "Plumber" vs "Plumbing")
      const serviceRoot = serviceName.replace(/ing$|er$|s$/, '');
      const existingRoot = existingName.replace(/ing$|er$|s$/, '');
      
      if (serviceRoot.length > 3 && existingRoot.length > 3 && 
          (serviceRoot.includes(existingRoot) || existingRoot.includes(serviceRoot))) {
        console.log(`🚫 Excluding root match: "${service.name}" (${serviceRoot}) ~ "${existing}" (${existingRoot})`);
        return true;
      }
      
      return false;
    });
    
    if (!isAlreadyBooked) {
      console.log(`✅ Available add-on service: "${service.name}"`);
    }
    
    return !isAlreadyBooked;
  });
  
  const excludedServices = allServices.filter(service => 
    !availableServices.some(available => available.id === service.id)
  );
  
  return {
    available: availableServices.map(s => s.name),
    excluded: excludedServices.map(s => s.name),
    availableCount: availableServices.length,
    excludedCount: excludedServices.length
  };
}

/**
 * Test the service filtering logic
 */
export function testServiceFiltering() {
  console.log('🧪 Testing Add-On Services Filtering Logic...\n');
  
  serviceFilterTestCases.forEach((testCase, index) => {
    console.log(`Test ${index + 1}: ${testCase.scenario}`);
    console.log(`📊 Input: ${testCase.allServices.length} total services, ${testCase.existingServices.length} existing`);
    
    const result = simulateServiceFiltering(testCase.allServices, testCase.existingServices);
    
    console.log(`📊 Result: ${result.availableCount} available, ${result.excludedCount} excluded`);
    console.log(`✅ Available:`, result.available);
    console.log(`🚫 Excluded:`, result.excluded);
    
    // Verify against expected results
    const availableMatch = JSON.stringify(result.available.sort()) === JSON.stringify(testCase.expectedAvailable.sort());
    const excludedMatch = JSON.stringify(result.excluded.sort()) === JSON.stringify(testCase.expectedExcluded.sort());
    
    console.log(`🧪 Test ${availableMatch && excludedMatch ? 'PASSED' : 'FAILED'}`);
    
    if (!availableMatch) {
      console.log(`❌ Available mismatch - Expected:`, testCase.expectedAvailable, `Got:`, result.available);
    }
    if (!excludedMatch) {
      console.log(`❌ Excluded mismatch - Expected:`, testCase.expectedExcluded, `Got:`, result.excluded);
    }
    
    console.log('');
  });
  
  console.log('🧪 Service Filtering Tests Complete!');
}

/**
 * Example of how the filtering works in practice
 */
export function demonstrateFiltering() {
  console.log('📋 Add-On Services Filtering Demonstration\n');
  
  console.log('🎯 Goal: Show only services that user hasn\'t already booked\n');
  
  console.log('📝 Example Scenario:');
  console.log('  - User booked "Electrician" as main service');
  console.log('  - User added "Deep Cleaning" as add-on');
  console.log('  - Category has: Electrician, Electrical Repair, Plumber, Deep Cleaning, Carpet Cleaning');
  console.log('');
  
  const example = {
    allServices: [
      { id: "1", name: "Electrician" },
      { id: "2", name: "Electrical Repair" },
      { id: "3", name: "Plumber" },
      { id: "4", name: "Deep Cleaning" },
      { id: "5", name: "Carpet Cleaning" }
    ],
    existingServices: ["Electrician", "Deep Cleaning"]
  };
  
  const result = simulateServiceFiltering(example.allServices, example.existingServices);
  
  console.log('🔍 Filtering Result:');
  console.log(`  ✅ Available for add-on: ${result.available.join(', ')}`);
  console.log(`  🚫 Excluded (already booked): ${result.excluded.join(', ')}`);
  console.log('');
  console.log('✨ This ensures users only see services they can actually add!');
}

// Example usage:
// import { testServiceFiltering, demonstrateFiltering } from '../utils/testAddOnFiltering';
// testServiceFiltering();
// demonstrateFiltering();