import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { FirestoreService, ServiceCompany } from "../services/firestoreService";

export default function CompanySelectionScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<ServiceCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  const { serviceTitle, categoryId, issues, selectedIssueIds, selectedIssues } = route.params;

  // Fetch companies from Firestore based on selected issues
  useEffect(() => {
    fetchServiceCompanies();
  }, [selectedIssueIds]);

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
  const checkRealTimeAvailability = async (companyId: string, date: string, time: string): Promise<boolean> => {
    try {
      console.log(`🔍 Checking real-time availability for company ${companyId} on ${date} at ${time}`);
      
      // Use the FirestoreService method for consistency
      const available = await FirestoreService.checkCompanyWorkerAvailability(companyId, date, time);
      
      console.log(`📊 Company ${companyId} availability: ${available ? 'Available' : 'All workers busy'}`);
      return available;
    } catch (error) {
      console.error(`❌ Error checking real-time availability for company ${companyId}:`, error);
      return false; // If error, assume not available to be safe
    }
  };

  // Filter companies that have active workers and are available for the selected time
  const filterCompaniesWithAvailability = async (companies: ServiceCompany[], checkTimeSlot: boolean = false): Promise<ServiceCompany[]> => {
    const availableCompanies: ServiceCompany[] = [];
    
    for (const company of companies) {
      const companyId = company.companyId || company.id;
      
      // First check if company has any active workers
      const hasActiveWorkers = await checkCompanyHasActiveWorkers(companyId);
      if (!hasActiveWorkers) {
        console.log(`🚫 Filtering out company ${company.companyName || company.serviceName} - no active workers`);
        continue;
      }
      
      // If we need to check specific time slot availability
      if (checkTimeSlot && selectedDate && selectedTime) {
        const isAvailableAtTime = await checkRealTimeAvailability(companyId, selectedDate, selectedTime);
        if (!isAvailableAtTime) {
          console.log(`🚫 Filtering out company ${company.companyName || company.serviceName} - all workers busy at ${selectedDate} ${selectedTime}`);
          continue;
        }
      }
      
      // Company passed all checks
      availableCompanies.push({
        ...company,
        // Add availability info to display
        availability: checkTimeSlot && selectedDate && selectedTime 
          ? `Available on ${selectedDate} at ${selectedTime}`
          : 'Available now'
      });
    }
    
    return availableCompanies;
  };

  const fetchServiceCompanies = async () => {
    try {
      setLoading(true);
      console.log('🏢 Fetching companies for:', { serviceTitle, categoryId, selectedIssueIds });
      
      let fetchedCompanies: ServiceCompany[];
      
      // 🏢 NEW: Use pre-fetched companies with packages if available
      if (allCompanies && allCompanies.length > 0) {
        console.log('🏢 Using pre-fetched companies with packages:', allCompanies.length);
        fetchedCompanies = allCompanies;
      } else if (selectedIssueIds && selectedIssueIds.length > 0) {
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
      
      // Filter companies to only show those with active workers
      const companiesWithActiveWorkers = await filterCompaniesWithAvailability(fetchedCompanies);
      
      console.log(`🏢 After filtering: ${companiesWithActiveWorkers.length} companies with active workers:`, 
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
    
    navigation.navigate("SelectDateTime", {
      serviceTitle,
      categoryId,
      // Keep the existing `issues` (names) for backward compatibility but also pass the full objects
      issues: Array.isArray(selectedIssues) ? selectedIssues.map(s => s.name) : issues,
      selectedIssues: selectedIssues || [],
      company: selectedCompany,
      selectedIssueIds,
    });
  }; 

  return (
    <View style={styles.container}>
      {/* Header Section */}
      <View style={styles.headerSection}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        
        <Text style={styles.header}>Select Service Provider</Text>
        <Text style={styles.subHeader}>
          {selectedIssueIds && selectedIssueIds.length > 0 
            ? `Showing providers for your selected services (${companies.length} available)`
            : "Choose from verified professionals"
          }
        </Text>
      </View>

      {/* Service Info Card */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>{serviceTitle} Service</Text>
        
        <View style={styles.issuesSection}>
          <Text style={styles.issuesTitle}>Selected Issues:</Text>
          <ScrollView 
            style={styles.issuesScroll}
            showsVerticalScrollIndicator={false}
          >
            {Array.isArray(issues) && issues.length > 0 ? (
              issues.map((issue: string, index: number) => (
                <View key={index} style={styles.issueTag}>
                  <Text style={styles.issueText}>{issue}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.noIssuesText}>No issues selected</Text>
            )}
          </ScrollView>
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
          <Text style={styles.emptyTitle}>No Service Providers Found</Text>
          <Text style={styles.emptyText}>
            No companies currently provide the selected services in your area. This could be because:
            {'\n'}• No providers are registered for these services
            {'\n'}• All providers are currently inactive
            {'\n'}• Services exist but categoryMasterId doesn't match
            {'\n'}
            {'\n'}Please try selecting different services or contact support for assistance.
          </Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => fetchServiceCompanies()}
          >
            <Text style={styles.retryText}>Retry Loading</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={companies}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isSelected = item.id === selectedCompanyId;
            
            return (
              <TouchableOpacity
                style={[styles.companyCard, isSelected && styles.companyCardSelected]}
                activeOpacity={0.7}
                onPress={() => setSelectedCompanyId(item.id)}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardLeft}>
                    <View style={styles.nameRow}>
                      <Text style={styles.companyName}>{item.companyName || item.serviceName}</Text>
                      {item.isActive && (
                        <View style={styles.verifiedBadge}>
                          <Text style={styles.verifiedText}>✓ Verified</Text>
                        </View>
                      )}
                    </View>
                    
                    {/* Show Selected Services */}
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Selected Services:</Text>
                      <Text style={styles.detailValue}>
                        {Array.isArray(issues) ? issues.join(', ') : 'Service selected'}
                      </Text>
                    </View>
                    
                    {/* Price */}
                    {item.price && (
                      <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Starting Price:</Text>
                        <Text style={styles.price}>₹{item.price}</Text>
                      </View>
                    )}
                    
                    {/* Packages if available - Enhanced Display */}
                    {item.packages && Array.isArray(item.packages) && item.packages.length > 0 && (
                      <View style={styles.packagesRow}>
                        <Text style={styles.detailLabel}>Available Packages:</Text>
                        <View style={styles.packagesList}>
                          {item.packages.slice(0, 3).map((pkg: any, index: number) => {
                            const packageName = typeof pkg === 'string' ? pkg : pkg.name || `Package ${index + 1}`;
                            const packagePrice = typeof pkg === 'object' && pkg.price ? pkg.price : null;
                            
                            return (
                              <View key={index} style={styles.packageTag}>
                                <Text style={styles.packageText}>{packageName}</Text>
                                {packagePrice && (
                                  <Text style={styles.packagePriceTag}>₹{packagePrice}</Text>
                                )}
                              </View>
                            );
                          })}
                          {item.packages.length > 3 && (
                            <Text style={styles.morePackages}>+{item.packages.length - 3} more</Text>
                          )}
                        </View>
                        
                        {/* Show package features if available */}
                        {item.packages[0] && typeof item.packages[0] === 'object' && item.packages[0].features && (
                          <View style={styles.featuresRow}>
                            <Text style={styles.featuresLabel}>Features:</Text>
                            <View style={styles.featuresList}>
                              {item.packages[0].features.slice(0, 3).map((feature: string, index: number) => (
                                <Text key={index} style={styles.featureText}>• {feature}</Text>
                              ))}
                            </View>
                          </View>
                        )}
                      </View>
                    )}
                    
                    {/* Description if available */}
                    {item.description && (
                      <View style={styles.descriptionRow}>
                        <Text style={styles.detailLabel}>Description:</Text>
                        <Text style={styles.descriptionText} numberOfLines={2}>
                          {item.description}
                        </Text>
                      </View>
                    )}
                    
                    {/* Rating and Reviews if available */}
                    {(item.rating || item.reviewCount) && (
                      <View style={styles.ratingRow}>
                        {item.rating && (
                          <View style={styles.ratingContainer}>
                            <Text style={styles.ratingText}>⭐ {item.rating.toFixed(1)}</Text>
                          </View>
                        )}
                        {item.reviewCount && (
                          <Text style={styles.reviewCount}>({item.reviewCount} reviews)</Text>
                        )}
                      </View>
                    )}
                    
                    {/* Contact Info if available */}
                    {item.contactInfo && (item.contactInfo.phone || item.contactInfo.email) && (
                      <View style={styles.contactRow}>
                        {item.contactInfo.phone && (
                          <Text style={styles.contactText}>📞 {item.contactInfo.phone}</Text>
                        )}
                        {item.contactInfo.email && (
                          <Text style={styles.contactText}>✉️ {item.contactInfo.email}</Text>
                        )}
                      </View>
                    )}
                    
                    {/* Availability if available */}
                    {item.availability && (
                      <View style={styles.availabilityRow}>
                        <Text style={styles.detailLabel}>Available:</Text>
                        <Text style={styles.availabilityText}>{item.availability}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.cardRight}>
                    {isSelected ? (
                      <View style={styles.selectedBadge}>
                        <Text style={styles.selectedText}>Selected</Text>
                      </View>
                    ) : (
                      <Text style={styles.selectText}>Select</Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={fetchServiceCompanies}
        />
      )}

      {/* Bottom Action Bar */}
      {selectedCompany && (
        <View style={styles.bottomBar}>
          <View style={styles.selectedInfo}>
            <Text style={styles.selectedCompanyName}>{selectedCompany.companyName || selectedCompany.serviceName}</Text>
            <View style={styles.selectedDetailsRow}>
              {selectedCompany.serviceType && (
                <Text style={styles.selectedDetail}>{selectedCompany.serviceType}</Text>
              )}
              {selectedCompany.price && (
                <Text style={styles.selectedPrice}>₹{selectedCompany.price}</Text>
              )}
            </View>
          </View>
          
          <TouchableOpacity
            style={styles.continueBtn}
            activeOpacity={0.7}
            onPress={selectCompany}
          >
            <Text style={styles.continueText}>Continue</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#fafbfc" 
  },

  // Header Section
  headerSection: {
    backgroundColor: "white",
    paddingHorizontal: 24,
    paddingTop: 50,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },

  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },

  backButtonText: {
    color: "#2563eb",
    fontSize: 16,
    fontWeight: "500",
  },

  header: { 
    fontSize: 28, 
    fontWeight: "600",
    color: "#0f172a",
    letterSpacing: -0.6,
    marginBottom: 8,
  },

  subHeader: { 
    color: "#64748b", 
    fontSize: 16, 
    fontWeight: "400",
    lineHeight: 24,
  },

  // Info Card
  infoCard: {
    backgroundColor: "white",
    marginHorizontal: 24,
    marginTop: 20,
    marginBottom: 24,
    borderRadius: 16,
    padding: 24,
    elevation: 0,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  infoTitle: { 
    fontSize: 18, 
    fontWeight: "500", 
    color: "#0f172a",
    letterSpacing: -0.3,
    marginBottom: 16,
  },

  issuesSection: {
    marginTop: 8,
  },

  issuesTitle: { 
    fontSize: 14, 
    color: "#64748b", 
    fontWeight: "500",
    marginBottom: 12,
  },

  issuesScroll: {
    maxHeight: 120,
  },

  issueTag: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 8,
    alignSelf: "flex-start",
  },

  issueText: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "500",
  },

  noIssuesText: {
    fontSize: 14,
    color: "#94a3b8",
    fontStyle: "italic",
  },

  // Company Cards
  listContent: {
    paddingBottom: 120,
  },

  companyCard: {
    backgroundColor: "white",
    marginHorizontal: 24,
    marginBottom: 16,
    borderRadius: 16,
    padding: 24,
    elevation: 0,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  companyCardSelected: {
    borderColor: "#2563eb",
    backgroundColor: "#f8faff",
    elevation: 1,
    shadowOpacity: 0.08,
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },

  cardLeft: {
    flex: 1,
    marginRight: 16,
  },

  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    flexWrap: "wrap",
  },

  companyName: {
    fontSize: 18,
    fontWeight: "500",
    color: "#0f172a",
    letterSpacing: -0.3,
    marginRight: 12,
  },

  verifiedBadge: {
    backgroundColor: "#dcfdf7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },

  verifiedText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#065f46",
  },

  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },

  rating: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginRight: 12,
  },

  experience: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "400",
  },

  ownerRow: {
    marginBottom: 8,
  },

  ownerName: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "400",
  },

  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    flexWrap: "wrap",
  },

  phone: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
    marginRight: 16,
  },

  zone: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "400",
  },

  businessRow: {
    marginBottom: 8,
  },

  businessType: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "400",
    textTransform: "capitalize",
  },

  // New enhanced styles for service_services collection fields
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    flexWrap: "wrap",
  },

  detailLabel: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
    marginRight: 8,
    minWidth: 80,
  },

  detailValue: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "500",
    textTransform: "capitalize",
    flex: 1,
  },

  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    backgroundColor: "#f0f9ff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0f2fe",
  },

  priceLabel: {
    fontSize: 13,
    color: "#0369a1",
    fontWeight: "500",
    marginRight: 8,
  },

  price: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0c4a6e",
    letterSpacing: -0.2,
  },

  packagesRow: {
    marginTop: 8,
    marginBottom: 4,
  },

  packagesList: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 6,
    gap: 6,
  },

  packageTag: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#fbbf24",
    marginRight: 6,
    marginBottom: 4,
  },

  packageText: {
    fontSize: 11,
    color: "#92400e",
    fontWeight: "500",
    marginBottom: 2,
  },

  packagePriceTag: {
    fontSize: 10,
    color: "#059669",
    fontWeight: "700",
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: "flex-start",
  },

  featuresRow: {
    marginTop: 8,
  },

  featuresLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
    marginBottom: 4,
  },

  featuresList: {
    marginLeft: 8,
  },

  featureText: {
    fontSize: 11,
    color: "#374151",
    fontWeight: "400",
    lineHeight: 16,
    marginBottom: 2,
  },

  morePackages: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "500",
    fontStyle: "italic",
    alignSelf: "center",
    marginLeft: 4,
  },

  descriptionRow: {
    marginTop: 8,
    marginBottom: 6,
  },

  descriptionText: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "400",
    lineHeight: 18,
    marginTop: 4,
    fontStyle: "italic",
  },

  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    marginBottom: 6,
  },

  ratingContainer: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },

  ratingText: {
    fontSize: 12,
    color: "#92400e",
    fontWeight: "600",
  },

  reviewCount: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },

  contactRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 6,
    marginBottom: 6,
    gap: 12,
  },

  contactText: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "500",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },

  availabilityRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    marginBottom: 4,
  },

  availabilityText: {
    fontSize: 13,
    color: "#059669",
    fontWeight: "600",
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },

  time: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "400",
    marginLeft: 8,
  },

  cardRight: {
    alignItems: "center",
  },

  selectText: {
    color: "#2563eb",
    fontSize: 14,
    fontWeight: "500",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#2563eb",
    borderRadius: 8,
    textAlign: "center",
    minWidth: 80,
  },

  selectedBadge: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: "center",
  },

  selectedText: {
    color: "white",
    fontSize: 14,
    fontWeight: "500",
  },

  specialtiesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  specialtyTag: {
    backgroundColor: "#f8fafc",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  specialtyText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },

  // Bottom Action Bar
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "white",
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  selectedInfo: {
    flex: 1,
    marginRight: 16,
  },

  selectedCompanyName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
    letterSpacing: -0.2,
    marginBottom: 4,
  },

  selectedDetailsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },

  selectedDetail: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
    marginRight: 12,
    textTransform: "capitalize",
  },

  selectedPrice: {
    fontSize: 14,
    fontWeight: "600",
    color: "#059669",
    letterSpacing: -0.1,
  },

  // Loading states
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 64,
  },

  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#64748b",
    fontWeight: "500",
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 48,
    paddingVertical: 64,
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 12,
    textAlign: "center",
  },

  emptyText: {
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
  },

  retryButton: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },

  retryText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },

  continueBtn: {
    backgroundColor: "#2563eb",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    elevation: 0,
    shadowColor: '#2563eb',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },

  continueText: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
    letterSpacing: -0.2,
  },
});
