import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRoute, useNavigation, useFocusEffect } from "@react-navigation/native";
import { FirestoreService, ServiceCompany } from "../services/firestoreService";
import { useServiceCart } from "../context/ServiceCartContext";

export default function CompanySelectionScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { addService } = useServiceCart();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<any | null>(null);
  const [companies, setCompanies] = useState<ServiceCompany[]>([]);
  const [loading, setLoading] = useState(true);

  const { serviceTitle, categoryId, issues, selectedIssueIds, selectedIssues, selectedDate, selectedTime, selectedDateFull } = route.params;

  // Fetch companies from Firestore based on selected issues
  useEffect(() => {
    fetchServiceCompanies();
  }, [selectedIssueIds]);



  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('🔄 Screen focused - Refreshing company availability...');
      fetchServiceCompanies();
      // reset package selection when screen refocuses
      setSelectedPackage(null);
    }, [selectedIssueIds])
  );

  // Check if a company has active workers
  const checkCompanyHasActiveWorkers = async (companyId: string): Promise<boolean> => {
    try {
      const { firestore } = require('../firebase.native');
      
      const workersQuery = await firestore()
        .collection('service_workers')
        .where('companyId', '==', companyId)
        .where('isActive', '==', true)
        .get();
      
      const activeWorkers = workersQuery.docs.length;
      console.log(`👷 Company ${companyId} has ${activeWorkers} active workers`);
      
      return activeWorkers > 0;
    } catch (error) {
      console.error(`❌ Error checking active workers for company ${companyId}:`, error);
      return false; // If error, assume no active workers to be safe
    }
  };

  // Check real-time availability for a specific date and time
  const checkRealTimeAvailability = async (companyId: string, date: string, time: string, serviceIds?: string[]): Promise<boolean> => {
    try {
      console.log(`🔍 DETAILED CHECK - Company ${companyId}:`);
      console.log(`   Date: ${date}, Time: ${time}`);
      console.log(`   Selected Service IDs:`, serviceIds);
      console.log(`   Service Title:`, serviceTitle);
      
      // 🔥 CRITICAL: Pass service IDs for proper worker filtering
      const result: any = await FirestoreService.checkCompanyWorkerAvailability(
        companyId, 
        date, 
        time, 
        serviceIds || selectedIssueIds, // Pass service IDs array
        serviceTitle // Pass service title as fallback
      );
      
      // Ensure we have the expected object structure
      if (typeof result === 'boolean') {
        console.warn('⚠️ Got boolean result instead of object, using fallback');
        return result;
      }
      
      console.log(`📊 RESULT - Company ${companyId}:`, {
        available: result.available,
        status: result.status,
        availableWorkers: result.availableWorkers,
        totalWorkers: result.totalWorkers,
        serviceIds: serviceIds || selectedIssueIds
      });
      
      return result.available;
    } catch (error) {
      console.error(`❌ Error checking real-time availability for company ${companyId}:`, error);
      return false; // If error, assume not available to be safe
    }
  };

  // Filter companies that have active workers and are available for the selected time
  const filterCompaniesWithAvailability = async (companies: ServiceCompany[], checkTimeSlot: boolean = false): Promise<ServiceCompany[]> => {
    if (!checkTimeSlot || !selectedDate || !selectedTime) {
      // If not checking time slots, use the old logic for backward compatibility
      const availableCompanies: ServiceCompany[] = [];
      
      for (const company of companies) {
        const companyId = company.companyId || company.id;
        
        // Check if company has any active workers
        const hasActiveWorkers = await checkCompanyHasActiveWorkers(companyId);
        if (!hasActiveWorkers) {
          console.log(`🚫 Filtering out company ${company.companyName || company.serviceName} - no active workers`);
          continue;
        }
        
        availableCompanies.push({
          ...company,
          availability: 'Available now'
        });
      }
      
      return availableCompanies;
    }
    
    // Use new slot-based availability system
    console.log(`🎯 Using slot-based availability for ${selectedDate} at ${selectedTime}`);
    console.log(`🔍 Service filtering details:`, {
      serviceTitle,
      selectedIssues: Array.isArray(selectedIssues) ? selectedIssues.map(s => s.name || s) : selectedIssues,
      issues: Array.isArray(issues) ? issues : [issues],
      selectedIssueIds,
      routeParams: { serviceTitle, categoryId, issues, selectedIssueIds, selectedIssues }
    });
    
    // Determine the exact service name to use for worker filtering
    const exactServiceName = (Array.isArray(selectedIssues) && selectedIssues.length > 0 && selectedIssues[0].name) 
      ? selectedIssues[0].name 
      : (Array.isArray(issues) && issues.length > 0 ? issues[0] : serviceTitle);
    
    console.log(`🎯 Using exact service name for worker filtering: "${exactServiceName}"`);
    
    try {
      const companiesWithSlotAvailability = await FirestoreService.getCompaniesWithSlotAvailability(
        categoryId,
        selectedIssueIds,
        selectedDate,
        selectedTime,
        exactServiceName // Pass the exact service name for precise worker filtering
      );
      
      // Transform to match expected format
      return companiesWithSlotAvailability.map(company => ({
        ...company,
        availability: company.availabilityInfo.statusMessage,
        // Add visual indicators for different statuses
        isAllWorkersBusy: company.availabilityInfo.status === 'all_busy',
        availableWorkerCount: company.availabilityInfo.availableWorkers,
        totalWorkerCount: company.availabilityInfo.totalWorkers
      }));
      
    } catch (error) {
      console.error('❌ Error using slot-based availability, falling back to basic check:', error);
      
      // Fallback to basic availability check
      const availableCompanies: ServiceCompany[] = [];
      
      for (const company of companies) {
        const companyId = company.companyId || company.id;
        const hasActiveWorkers = await checkCompanyHasActiveWorkers(companyId);
        
        // Only show companies that have active workers (no busy workers shown)
        if (hasActiveWorkers) {
          // Additional check: verify workers are actually available for the time slot
          if (selectedDate && selectedTime) {
            const exactServiceName = (Array.isArray(selectedIssues) && selectedIssues.length > 0 && selectedIssues[0].name) 
              ? selectedIssues[0].name 
              : (Array.isArray(issues) && issues.length > 0 ? issues[0] : serviceTitle);
            
            console.log(`🔍 Fallback check using service name: "${exactServiceName}"`);
            
            const isAvailableAtTime = await checkRealTimeAvailability(companyId, selectedDate, selectedTime, exactServiceName);
            if (isAvailableAtTime) {
              availableCompanies.push({
                ...company,
                availability: 'Available now'
              });
            }
            // If not available at time, don't add to list (hide company)
          } else {
            availableCompanies.push({
              ...company,
              availability: 'Available now'
            });
          }
        }
        // If no active workers, don't add to list (hide company)
      }
      
      return availableCompanies;
    }
  };

  const fetchServiceCompanies = async () => {
    try {
      setLoading(true);
      console.log('🏢 Fetching companies for:', { serviceTitle, categoryId, selectedIssueIds });
      
      let fetchedCompanies: ServiceCompany[];
      
      if (selectedIssueIds && selectedIssueIds.length > 0) {
        console.log('🏢 Fetching companies with detailed packages by selected issue IDs:', selectedIssueIds);
        // 🏢 NEW: Use enhanced method to get companies with detailed packages
        fetchedCompanies = await FirestoreService.getCompaniesWithDetailedPackages(selectedIssueIds);
      } else if (categoryId) {
        console.log('🏢 Fetching companies by category ID:', categoryId);
        // Fetch companies that provide services in this category
        fetchedCompanies = await FirestoreService.getCompaniesByCategory(categoryId);
        // Enhance with detailed packages
        fetchedCompanies = await FirestoreService.getDetailedPackagesForCompanies(fetchedCompanies);
      } else {
        console.log('🏢 Fetching all companies as fallback');
        // Fallback to all companies
        fetchedCompanies = await FirestoreService.getServiceCompanies();
        // Enhance with detailed packages
        fetchedCompanies = await FirestoreService.getDetailedPackagesForCompanies(fetchedCompanies);
      }
      
      console.log(`🏢 Found ${fetchedCompanies.length} companies:`, 
        fetchedCompanies.map(c => ({ 
          id: c.id, 
          companyName: c.companyName,
          serviceName: c.serviceName, 
          price: c.price, 
          serviceType: c.serviceType,
          companyId: c.companyId,
          isActive: c.isActive,
          packagesCount: c.packages?.length || 0,
          packageDetails: c.packages?.slice(0, 2).map(p => ({
            name: typeof p === 'string' ? p : p.name,
            price: typeof p === 'object' ? p.price : c.price
          }))
        }))
      );
      
      // Filter companies to only show those with active workers and check slot availability
      const companiesWithActiveWorkers = await filterCompaniesWithAvailability(fetchedCompanies, true); // Enable time slot checking
      
      console.log(`🏢 After filtering: ${companiesWithActiveWorkers.length} companies with worker availability:`, 
        companiesWithActiveWorkers.map(c => ({ 
          id: c.id, 
          companyName: c.companyName,
          serviceName: c.serviceName,
          companyId: c.companyId
        }))
      );
      
      setCompanies(companiesWithActiveWorkers);
    } catch (error) {
      console.error('❌ Error fetching service companies:', error);
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  const selectedCompany = companies.find(c => c.id === selectedCompanyId);

  const selectCompany = () => {
    if (!selectedCompany) return;
    
    // Determine booking type based on service title
    let bookingType: 'electrician' | 'plumber' | 'cleaning' | 'health' | 'dailywages' | 'carwash' = 'electrician';
    const lowerTitle = serviceTitle?.toLowerCase() || '';
    
    if (lowerTitle.includes('plumber')) bookingType = 'plumber';
    else if (lowerTitle.includes('cleaning')) bookingType = 'cleaning';
    else if (lowerTitle.includes('health')) bookingType = 'health';
    else if (lowerTitle.includes('daily') || lowerTitle.includes('wages')) bookingType = 'dailywages';
    else if (lowerTitle.includes('car') || lowerTitle.includes('wash')) bookingType = 'carwash';

    // Calculate price: prefer selected package price, then selected issues total, then company.price
    let packageInfo = null;
    if (selectedCompany.packages && Array.isArray(selectedCompany.packages) && selectedPackage) {
      // selectedPackage should be an object from the package list
      packageInfo = selectedPackage;
    }

    const issueTotalPrice = Array.isArray(selectedIssues)
      ? selectedIssues.reduce((s: number, it: any) => s + (typeof it.price === 'number' ? it.price : 0), 0)
      : 0;

    const computedPrice = packageInfo?.price ?? (issueTotalPrice > 0 ? issueTotalPrice : (selectedCompany?.price || 0));

    // Add service to cart (include package info when available)
    addService({
      serviceTitle,
      issues: Array.isArray(issues) ? issues : [issues].filter(Boolean),
      company: {
        id: selectedCompany.id,
        companyId: selectedCompany.companyId || selectedCompany.id,
        name: selectedCompany.companyName || selectedCompany.serviceName,
        price: selectedCompany.price,
        rating: selectedCompany.rating,
        verified: selectedCompany.isActive,
      },
      selectedDate: selectedDate,
      selectedTime: selectedTime,
      bookingType,
      unitPrice: computedPrice,
      totalPrice: computedPrice,
      additionalInfo: packageInfo ? { package: { id: packageInfo.id, name: packageInfo.name, price: packageInfo.price, description: packageInfo.description } } : undefined,
    });

    Alert.alert(
      "Added to Cart",
      `${serviceTitle} service has been added to your cart for ${selectedDateFull || selectedDate} at ${selectedTime}.`,
      [
        {
          text: "Continue Services",
          onPress: () => navigation.navigate("ServicesHome"),
        },
        {
          text: "View Cart",
          onPress: () => navigation.navigate("ServiceCart"),
        },
      ]
    );
    // Reset package selection after adding
    setSelectedPackage(null);
  }; 

  return (
    <View style={styles.container}>
      {/* Modern Header */}
      <View style={styles.headerSection}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        
        <Text style={styles.header}>Select Service Provider</Text>
        <Text style={styles.subHeader}>
          Showing providers for your selected services ({companies.length} available)
        </Text>
      </View>

      {/* Compact Service Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <Text style={styles.summaryTitle}>{serviceTitle}</Text>
          {selectedDate && selectedTime && (
            <View style={styles.slotBadge}>
              <Text style={styles.slotBadgeText}>
                {selectedDateFull || selectedDate} at {selectedTime}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.issuesRow}>
          <Text style={styles.issuesLabel}>Selected Issues:</Text>
          <View style={styles.issuesChips}>
            {Array.isArray(issues) && issues.length > 0 ? (
              issues.map((issue: string, index: number) => (
                <View key={index} style={styles.issueChip}>
                  <Text style={styles.issueChipText}>{issue}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.noIssuesText}>No issues selected</Text>
            )}
          </View>
        </View>
      </View>

      {/* Companies List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading service providers...</Text>
        </View>
      ) : companies.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No Companies Available</Text>
          <Text style={styles.emptyText}>
            Please try choosing different slots or check back later.
             {'\n'}
          </Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.retryText}>Choose Different Slot</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={companies}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isSelected = item.id === selectedCompanyId;
            const isBusy = (item as any).isBusy === true;
            const hasPackages = item.packages && Array.isArray(item.packages) && item.packages.length > 0;
            
            return (
              <TouchableOpacity
                style={[
                  styles.providerCard, 
                  isSelected && styles.providerCardSelected,
                  isBusy && styles.providerCardBusy
                ]}
                activeOpacity={isBusy ? 0.3 : 0.7}
                onPress={() => {
                  if (!isBusy) {
                    setSelectedCompanyId(item.id);
                  }
                }}
                disabled={isBusy}
              >
                {/* Provider Header */}
                <View style={styles.providerHeader}>
                  <View style={styles.providerInfo}>
                    <Text style={styles.providerName}>{item.companyName || item.serviceName}</Text>
                    {item.isActive && (
                      <View style={styles.verifiedBadge}>
                        <Text style={styles.verifiedText}>✓</Text>
                      </View>
                    )}
                  </View>
                  
                  {isSelected ? (
                    <View style={styles.selectedIndicator}>
                      <Text style={styles.selectedIndicatorText}>✓</Text>
                    </View>
                  ) : (
                    <View style={styles.selectCircle} />
                  )}
                </View>

                {/* Availability Status */}
                <View style={[
                  styles.statusBadge,
                  (item as any).isAllWorkersBusy ? styles.statusBusy : styles.statusAvailable
                ]}>
                  <Text style={[
                    styles.statusText,
                    (item as any).isAllWorkersBusy ? styles.statusTextBusy : styles.statusTextAvailable
                  ]}>
                    {item.availability || 'Available'}
                  </Text>
                </View>

                {/* Package or Price Display */}
                {hasPackages ? (
                  <View style={styles.packageSection}>
                    <Text style={styles.packageLabel}>
                      📦 {item.packages?.length || 0} Package{(item.packages?.length || 0) > 1 ? 's' : ''} Available
                    </Text>
                    
                    {isSelected && (
                      <View style={styles.packageGrid}>
                        {item.packages?.map((pkg: any, idx: number) => {
                          const pkgObj = typeof pkg === 'string' 
                            ? { id: `${item.id}_pkg_${idx}`, name: pkg, price: item.price || 0 } 
                            : pkg;
                          const isPkgSelected = selectedPackage && selectedPackage.id === pkgObj.id;
                          
                          return (
                            <TouchableOpacity
                              key={pkgObj.id}
                              style={[
                                styles.packageOption,
                                isPkgSelected && styles.packageOptionSelected
                              ]}
                              onPress={() => setSelectedPackage(pkgObj)}
                            >
                              <View style={styles.packageOptionHeader}>
                                <Text style={styles.packageOptionName}>{pkgObj.name}</Text>
                                {isPkgSelected && (
                                  <View style={styles.packageCheckmark}>
                                    <Text style={styles.packageCheckmarkText}>✓</Text>
                                  </View>
                                )}
                              </View>
                              <Text style={styles.packageOptionPrice}>₹{pkgObj.price}</Text>
                              {pkgObj.description && (
                                <Text style={styles.packageOptionDesc} numberOfLines={2}>
                                  {pkgObj.description}
                                </Text>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                ) : (
                  item.price && (
                    <View style={styles.priceSection}>
                      <Text style={styles.priceLabel}>Service Price</Text>
                      <Text style={styles.priceValue}>₹{item.price}</Text>
                    </View>
                  )
                )}

                {/* Additional Info */}
                {(item.rating || (item as any).totalWorkerCount) && (
                  <View style={styles.metaRow}>
                    {item.rating && (
                      <View style={styles.ratingBadge}>
                        <Text style={styles.ratingBadgeText}>⭐ {item.rating.toFixed(1)}</Text>
                      </View>
                    )}
                    {(item as any).totalWorkerCount && (
                      <Text style={styles.workerInfo}>
                        {(item as any).availableWorkerCount || 0}/{(item as any).totalWorkerCount} available
                      </Text>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={fetchServiceCompanies}
        />
      )}

      {/* Modern Bottom Action Bar */}
      {selectedCompany && (
        <View style={styles.bottomActionBar}>
          <View style={styles.selectedSummary}>
            <Text style={styles.selectedLabel}>Selected Provider</Text>
            <Text style={styles.selectedProviderName}>
              {selectedCompany.companyName || selectedCompany.serviceName}
            </Text>
          </View>
          
          <TouchableOpacity
            style={[
              styles.addToCartButton,
              selectedCompany && (selectedCompany as any).isBusy && styles.addToCartButtonDisabled
            ]}
            activeOpacity={selectedCompany && (selectedCompany as any).isBusy ? 0.3 : 0.7}
            onPress={selectCompany}
          >
            <Text style={styles.addToCartButtonText}>Add to Cart</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#f8fafc" 
  },

  // Modern Header
  headerSection: {
    backgroundColor: "white",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },

  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    marginBottom: 12,
  },

  backButtonText: {
    color: "#3b82f6",
    fontSize: 16,
    fontWeight: "600",
  },

  header: { 
    fontSize: 24, 
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 6,
  },

  subHeader: { 
    color: "#64748b", 
    fontSize: 14, 
    fontWeight: "500",
  },

  // Compact Summary Card
  summaryCard: {
    backgroundColor: "white",
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },

  summaryHeader: {
    marginBottom: 12,
  },

  summaryTitle: { 
    fontSize: 16, 
    fontWeight: "600", 
    color: "#1e293b",
    marginBottom: 8,
  },

  slotBadge: {
    backgroundColor: "#eff6ff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },

  slotBadgeText: {
    fontSize: 12,
    color: "#1e40af",
    fontWeight: "600",
  },

  issuesRow: {
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 12,
  },

  issuesLabel: { 
    fontSize: 12, 
    color: "#64748b", 
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  issuesChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },

  issueChip: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },

  issueChipText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "500",
  },

  noIssuesText: {
    fontSize: 13,
    color: "#94a3b8",
    fontStyle: "italic",
  },

  // Provider Cards
  listContent: {
    paddingBottom: 120,
  },

  providerCard: {
    backgroundColor: "white",
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 2,
    borderColor: "transparent",
  },

  providerCardSelected: {
    borderColor: "#3b82f6",
    backgroundColor: "#f0f9ff",
  },

  providerCardBusy: {
    opacity: 0.6,
    borderColor: "#fca5a5",
  },

  providerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  providerInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  providerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginRight: 8,
  },

  verifiedBadge: {
    backgroundColor: "#dcfce7",
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  verifiedText: {
    fontSize: 12,
    color: "#16a34a",
    fontWeight: "700",
  },

  selectCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#cbd5e1",
  },

  selectedIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
  },

  selectedIndicatorText: {
    color: "white",
    fontSize: 14,
    fontWeight: "700",
  },

  // Status Badge
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },

  statusAvailable: {
    backgroundColor: "#dcfce7",
  },

  statusBusy: {
    backgroundColor: "#fee2e2",
  },

  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },

  statusTextAvailable: {
    color: "#16a34a",
  },

  statusTextBusy: {
    color: "#dc2626",
  },

  // Package Section
  packageSection: {
    marginTop: 4,
  },

  packageLabel: {
    fontSize: 13,
    color: "#6366f1",
    fontWeight: "600",
    marginBottom: 12,
  },

  packageGrid: {
    gap: 8,
  },

  packageOption: {
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    padding: 12,
    borderWidth: 2,
    borderColor: "#e2e8f0",
  },

  packageOptionSelected: {
    backgroundColor: "#eef2ff",
    borderColor: "#6366f1",
  },

  packageOptionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },

  packageOptionName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
    flex: 1,
  },

  packageCheckmark: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#6366f1",
    alignItems: "center",
    justifyContent: "center",
  },

  packageCheckmarkText: {
    color: "white",
    fontSize: 11,
    fontWeight: "700",
  },

  packageOptionPrice: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },

  packageOptionDesc: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 16,
  },

  // Price Section
  priceSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 4,
  },

  priceLabel: {
    fontSize: 13,
    color: "#15803d",
    fontWeight: "500",
  },

  priceValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#15803d",
  },

  // Meta Row
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 12,
  },

  ratingBadge: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },

  ratingBadgeText: {
    fontSize: 12,
    color: "#92400e",
    fontWeight: "600",
  },

  workerInfo: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },

  // Loading & Empty States
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 64,
  },

  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
  },

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 48,
    paddingVertical: 64,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 8,
    textAlign: "center",
  },

  emptyText: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },

  retryButton: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },

  retryText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },

  // Modern Bottom Action Bar
  bottomActionBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "white",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: -2 },
    shadowRadius: 8,
    elevation: 8,
  },

  selectedSummary: {
    flex: 1,
    marginRight: 12,
  },

  selectedLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },

  selectedProviderName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
  },

  addToCartButton: {
    backgroundColor: "#3b82f6",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    shadowColor: '#3b82f6',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },

  addToCartButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },

  addToCartButtonDisabled: {
    backgroundColor: "#94a3b8",
    shadowOpacity: 0,
    elevation: 0,
  },
});
