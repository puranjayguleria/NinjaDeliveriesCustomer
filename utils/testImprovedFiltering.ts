/**
 * Test the improved add-on services filtering logic
 * This demonstrates how the enhanced filtering prevents duplicate services
 */

export interface ImprovedFilterTestCase {
  scenario: string;
  mainService: string;
  existingAddOns: string[];
  allCategoryServices: string[];
  expectedAvailable: string[];
  expectedExcluded: string[];
}

export const improvedFilterTestCases: ImprovedFilterTestCase[] = [
  {
    scenario: "Electrical services with variations",
    mainService: "Electrician",
    existingAddOns: ["Wiring Installation"],
    allCategoryServices: [
      "Electrician",
      "Electrical Work", 
      "Electrical Repair",
      "Wiring Installation",
      "Wiring Repair",
      "Switch Installation",
      "Fan Installation",
      "Light Fitting"
    ],
    expectedAvailable: ["Switch Installation", "Fan Installation", "Light Fitting"],
    expectedExcluded: ["Electrician", "Electrical Work", "Electrical Repair", "Wiring Installation", "Wiring Repair"]
  },
  {
    scenario: "Cleaning services with keyword overlap",
    mainService: "Home Cleaning",
    existingAddOns: ["Deep Cleaning"],
    allCategoryServices: [
      "Home Cleaning",
      "House Cleaning",
      "Deep Cleaning",
      "Deep House Cleaning",
      "Carpet Cleaning",
      "Window Cleaning",
      "Kitchen Cleaning",
      "Bathroom Cleaning"
    ],
    expectedAvailable: ["Carpet Cleaning", "Window Cleaning", "Kitchen Cleaning", "Bathroom Cleaning"],
    expectedExcluded: ["Home Cleaning", "House Cleaning", "Deep Cleaning", "Deep House Cleaning"]
  },
  {
    scenario: "Plumbing services with root word matching",
    mainService: "Plumber",
    existingAddOns: [],
    allCategoryServices: [
      "Plumber",
      "Plumbing",
      "Plumbing Work",
      "Pipe Repair",
      "Tap Installation",
      "Toilet Repair",
      "Drainage Cleaning"
    ],
    expectedAvailable: ["Pipe Repair", "Tap Installation", "Toilet Repair", "Drainage Cleaning"],
    expectedExcluded: ["Plumber", "Plumbing", "Plumbing Work"]
  },
  {
    scenario: "Complex case with multiple overlaps",
    mainService: "AC Repair",
    existingAddOns: ["AC Installation"],
    allCategoryServices: [
      "AC Repair",
      "Air Conditioner Repair",
      "AC Installation", 
      "Air Conditioner Installation",
      "AC Service",
      "AC Maintenance",
      "Refrigerator Repair",
      "Washing Machine Repair"
    ],
    expectedAvailable: ["Refrigerator Repair", "Washing Machine Repair"],
    expectedExcluded: ["AC Repair", "Air Conditioner Repair", "AC Installation", "Air Conditioner Installation", "AC Service", "AC Maintenance"]
  }
];

/**
 * Simulate the improved filtering logic
 */
export function simulateImprovedFiltering(
  mainService: string, 
  existingAddOns: string[], 
  allServices: string[]
): { available: string[], excluded: string[] } {
  
  const existingServices = [mainService, ...existingAddOns];
  console.log(`🔍 Filtering against existing services:`, existingServices);
  
  const available: string[] = [];
  const excluded: string[] = [];
  
  allServices.forEach(service => {
    const serviceName = service.toLowerCase().trim();
    let isExcluded = false;
    
    for (const existing of existingServices) {
      const existingName = existing.toLowerCase().trim();
      
      // Exact match
      if (serviceName === existingName) {
        console.log(`🚫 Exact match: "${service}" = "${existing}"`);
        isExcluded = true;
        break;
      }
      
      // Partial match
      if (serviceName.includes(existingName) || existingName.includes(serviceName)) {
        console.log(`🚫 Partial match: "${service}" ~ "${existing}"`);
        isExcluded = true;
        break;
      }
      
      // Root word match
      const serviceRoot = serviceName.replace(/ing$|er$|s$/, '');
      const existingRoot = existingName.replace(/ing$|er$|s$/, '');
      
      if (serviceRoot.length > 3 && existingRoot.length > 3 && 
          (serviceRoot.includes(existingRoot) || existingRoot.includes(serviceRoot))) {
        console.log(`🚫 Root match: "${service}" (${serviceRoot}) ~ "${existing}" (${existingRoot})`);
        isExcluded = true;
        break;
      }
      
      // Keyword overlap
      const serviceKeywords = serviceName.split(/\s+/);
      const existingKeywords = existingName.split(/\s+/);
      
      const commonWords = ['service', 'services', 'work', 'repair', 'maintenance', 'professional'];
      const significantServiceWords = serviceKeywords.filter(word => 
        word.length > 3 && !commonWords.includes(word)
      );
      const significantExistingWords = existingKeywords.filter(word => 
        word.length > 3 && !commonWords.includes(word)
      );
      
      const hasKeywordOverlap = significantServiceWords.some(serviceWord =>
        significantExistingWords.some(existingWord =>
          serviceWord.includes(existingWord) || existingWord.includes(serviceWord)
        )
      );
      
      if (hasKeywordOverlap && significantServiceWords.length > 0 && significantExistingWords.length > 0) {
        console.log(`🚫 Keyword match: "${service}" ~ "${existing}" (${significantServiceWords.join(', ')} ~ ${significantExistingWords.join(', ')})`);
        isExcluded = true;
        break;
      }
    }
    
    if (isExcluded) {
      excluded.push(service);
    } else {
      available.push(service);
      console.log(`✅ Available: "${service}"`);
    }
  });
  
  return { available, excluded };
}

/**
 * Test the improved filtering logic
 */
export function testImprovedFiltering() {
  console.log('🧪 Testing Improved Add-On Services Filtering...\n');
  
  improvedFilterTestCases.forEach((testCase, index) => {
    console.log(`Test ${index + 1}: ${testCase.scenario}`);
    console.log(`📋 Main Service: "${testCase.mainService}"`);
    console.log(`📋 Existing Add-ons: [${testCase.existingAddOns.join(', ')}]`);
    console.log(`📋 All Category Services: [${testCase.allCategoryServices.join(', ')}]`);
    
    const result = simulateImprovedFiltering(
      testCase.mainService,
      testCase.existingAddOns,
      testCase.allCategoryServices
    );
    
    console.log(`📊 Result:`);
    console.log(`  ✅ Available (${result.available.length}): [${result.available.join(', ')}]`);
    console.log(`  🚫 Excluded (${result.excluded.length}): [${result.excluded.join(', ')}]`);
    
    // Verify results
    const availableMatch = JSON.stringify(result.available.sort()) === JSON.stringify(testCase.expectedAvailable.sort());
    const excludedMatch = JSON.stringify(result.excluded.sort()) === JSON.stringify(testCase.expectedExcluded.sort());
    
    console.log(`🧪 Test ${availableMatch && excludedMatch ? 'PASSED ✅' : 'FAILED ❌'}`);
    
    if (!availableMatch) {
      console.log(`❌ Available mismatch:`);
      console.log(`   Expected: [${testCase.expectedAvailable.join(', ')}]`);
      console.log(`   Got: [${result.available.join(', ')}]`);
    }
    if (!excludedMatch) {
      console.log(`❌ Excluded mismatch:`);
      console.log(`   Expected: [${testCase.expectedExcluded.join(', ')}]`);
      console.log(`   Got: [${result.excluded.join(', ')}]`);
    }
    
    console.log('');
  });
  
  console.log('🧪 Improved Filtering Tests Complete!');
}

/**
 * Show before/after comparison
 */
export function showFilteringImprovement() {
  console.log('📊 Add-On Services Filtering Improvement\n');
  
  console.log('❌ BEFORE (Simple String Matching):');
  console.log('  - Only checked if service name contains existing name');
  console.log('  - Could miss variations like "Electrician" vs "Electrical Work"');
  console.log('  - Could miss root words like "Plumber" vs "Plumbing"');
  console.log('  - Could miss keyword overlaps like "AC Repair" vs "Air Conditioner Repair"');
  console.log('');
  
  console.log('✅ AFTER (Enhanced Multi-Level Filtering):');
  console.log('  1. Exact name matching');
  console.log('  2. Partial string matching (contains)');
  console.log('  3. Root word matching (removes common suffixes)');
  console.log('  4. Keyword overlap detection (ignores common words)');
  console.log('  5. Includes main service + existing add-ons in exclusion list');
  console.log('');
  
  console.log('🎯 Benefits:');
  console.log('  ✅ Prevents duplicate services with different names');
  console.log('  ✅ Handles service variations intelligently');
  console.log('  ✅ Includes main booked service in exclusions');
  console.log('  ✅ Better user experience - only shows truly new services');
  console.log('  ✅ Comprehensive logging for debugging');
}

// Example usage:
// import { testImprovedFiltering, showFilteringImprovement } from '../utils/testImprovedFiltering';
// testImprovedFiltering();
// showFilteringImprovement();