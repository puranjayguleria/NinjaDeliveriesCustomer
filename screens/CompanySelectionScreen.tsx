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

    // 🔧 FIXED: Calculate price properly for both packages and simple services
    let computedPrice: number;
    let serviceDescription: string;
    let packageInfo: any = null;

    // Check if user selected a package
    if ((selectedCompany as any).selectedPackage) {
      // PACKAGE FLOW: Use selected package price
      const selectedPackage = (selectedCompany as any).selectedPackage;
      computedPrice = selectedPackage.price || selectedCompany?.price || 99;
      serviceDescription = `${serviceTitle} - ${selectedPackage.name}`;
      packageInfo = {
        packageName: selectedPackage.name,
        packageType: selectedPackage.type,
        packageDuration: selectedPackage.duration,
        packageFeatures: selectedPackage.features,
        isPackageService: true
      };
      
      console.log(`💰 PACKAGE PRICING: Selected "${selectedPackage.name}" for ₹${computedPrice}`);
    } else {
      // SIMPLE SERVICE FLOW: Use issue prices or company price
      const issueTotalPrice = Array.isArray(selectedIssues)
        ? selectedIssues.reduce((s: number, it: any) => s + (typeof it.price === 'number' ? it.price : 0), 0)
        : 0;
      computedPrice = issueTotalPrice > 0 ? issueTotalPrice : (selectedCompany?.price || 99);
      serviceDescription = serviceTitle;
      
      console.log(`💰 SIMPLE SERVICE PRICING: ₹${computedPrice} (issues: ₹${issueTotalPrice}, company: ₹${selectedCompany?.price})`);
    }

    // Add service to cart with correct pricing
    addService({
      serviceTitle: serviceDescription, // Include package name in title if applicable
      issues: Array.isArray(issues) ? issues : [issues].filter(Boolean),
      company: {
        id: selectedCompany.id,
        companyId: selectedCompany.companyId || selectedCompany.id,
        name: selectedCompany.companyName || selectedCompany.serviceName,
        price: selectedCompany.price, // Keep original company price for reference
        rating: selectedCompany.rating,
        verified: selectedCompany.isActive,
      },
      selectedDate: selectedDate,
      selectedTime: selectedTime,
      bookingType,
      unitPrice: computedPrice, // ✅ CORRECT: Package price or service price
      totalPrice: computedPrice, // ✅ CORRECT: Same as unit price for quantity 1
      additionalInfo: packageInfo, // Store package details for cart display
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
  }; 

  return (
    <View style={styles.container}>
      {/* Header Section */}
      <View style={styles.headerSection}>
        <View style={styles.headerRow}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        </View>
        
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
        
        {/* Selected Slot Info */}
        {selectedDate && selectedTime && (
          <View style={styles.slotInfoSection}>
            <Text style={styles.slotInfoTitle}>Selected Slot:</Text>
            <Text style={styles.slotInfoText}>
              {selectedDateFull || selectedDate} at {selectedTime}
            </Text>
          </View>
        )}
        
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
            
            return (
              <TouchableOpacity
                style={[
                  styles.companyCard, 
                  isSelected && styles.companyCardSelected,
                  isBusy && styles.companyCardBusy
                ]}
                activeOpacity={isBusy ? 0.3 : 0.7}
                onPress={() => {
                  if (!isBusy) {
                    setSelectedCompanyId(item.id);
                  }
                }}
                disabled={isBusy}
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
                    
                    {/* Price - Only show for simple services (no packages) */}
                    {item.price && !(item.packages && Array.isArray(item.packages) && item.packages.length > 0) && (
                      <View style={styles.priceRow}>
                        <Text style={styles.priceLabel}>Service Price:</Text>
                        <Text style={styles.price}>₹{item.price}</Text>
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
                    
                    {/* Service/Package Availability Status - Two separate flows */}
                    {item.packages && Array.isArray(item.packages) && item.packages.length > 0 ? (
                      // PACKAGE FLOW
                      <>
                        <View style={styles.availabilityStatusRow}>
                          <Text style={styles.detailLabel}>Package Options:</Text>
                          <View style={[
                            styles.availabilityBadge,
                            (item as any).isAllWorkersBusy ? styles.busyAvailabilityBadge : styles.availableBadge
                          ]}>
                            <Text style={[
                              styles.availabilityStatusText,
                              (item as any).isAllWorkersBusy ? styles.busyText : styles.availableText
                            ]}>
                              {item.availability || 'Available'}
                            </Text>
                          </View>
                        </View>
                        
                        {/* Enhanced Package Selection Modal */}
                        <View style={styles.packageListContainer}>
                          <Text style={styles.packageHeaderText}>
                            📦 Choose Your Package
                          </Text>
                          <Text style={styles.packageSubHeaderText}>
                            Select the package that best fits your needs
                          </Text>
                          
                          {/* Package Options Grid */}
                          <View style={styles.packageGrid}>
                            {item.packages.map((pkg: any, index: number) => {
                              // Extract package information from website data
                              const packageName = pkg.name || pkg.title || pkg.packageName || `Package ${index + 1}`;
                              const packagePrice = pkg.price || pkg.amount || item.price || 0;
                              const packageDuration = pkg.duration || pkg.validity || pkg.period;
                              const packageType = pkg.type || pkg.frequency || pkg.interval || 'one-time';
                              const packageDescription = pkg.description || pkg.details || '';
                              const packageFeatures = pkg.features || pkg.services || pkg.includes || [];
                              const isPopular = pkg.isPopular || pkg.recommended || false;
                              const originalPrice = pkg.originalPrice || pkg.mrp;
                              const discount = pkg.discount || pkg.offer;
                              
                              const isSelected = (item as any).selectedPackageIndex === index;
                              
                              return (
                                <TouchableOpacity 
                                  key={index} 
                                  style={[
                                    styles.packageCard,
                                    isSelected && styles.packageCardSelected,
                                    isPopular && styles.packageCardPopular
                                  ]}
                                  onPress={() => {
                                    // Store selected package info
                                    const updatedCompanies = companies.map(c => {
                                      if (c.id === item.id) {
                                        return {
                                          ...c,
                                          selectedPackageIndex: index,
                                          selectedPackage: {
                                            name: packageName,
                                            price: packagePrice,
                                            duration: packageDuration,
                                            type: packageType,
                                            description: packageDescription,
                                            features: packageFeatures,
                                            isPopular: isPopular,
                                            originalPrice: originalPrice,
                                            discount: discount,
                                            index: index
                                          }
                                        } as any;
                                      }
                                      return c;
                                    });
                                    setCompanies(updatedCompanies);
                                    setSelectedCompanyId(item.id);
                                  }}
                                >
                                  {/* Popular Badge */}
                                  {isPopular && (
                                    <View style={styles.popularBadge}>
                                      <Text style={styles.popularText}>POPULAR</Text>
                                    </View>
                                  )}
                                  
                                  {/* Package Header */}
                                  <View style={styles.packageCardHeader}>
                                    <View style={styles.packageTitleRow}>
                                      <Text style={styles.packageCardTitle}>{packageName}</Text>
                                      {isSelected && (
                                        <View style={styles.selectedPackageBadge}>
                                          <Text style={styles.selectedPackageText}>✓</Text>
                                        </View>
                                      )}
                                    </View>
                                    
                                    {/* Package Type Badge */}
                                    <View style={[
                                      styles.packageTypeBadge,
                                      packageType === 'weekly' && styles.weeklyBadge,
                                      packageType === 'monthly' && styles.monthlyBadge,
                                      packageType === 'yearly' && styles.yearlyBadge
                                    ]}>
                                      <Text style={styles.packageTypeText}>
                                        {packageType.toUpperCase()}
                                      </Text>
                                    </View>
                                  </View>
                                  
                                  {/* Package Price */}
                                  <View style={styles.packagePriceSection}>
                                    <View style={styles.priceRow}>
                                      <Text style={styles.packageMainPrice}>₹{packagePrice}</Text>
                                      {originalPrice && originalPrice > packagePrice && (
                                        <Text style={styles.packageOriginalPrice}>₹{originalPrice}</Text>
                                      )}
                                    </View>
                                    
                                    {packageDuration && (
                                      <Text style={styles.packageDurationText}>
                                        {packageDuration}
                                      </Text>
                                    )}
                                    
                                    {discount && (
                                      <View style={styles.discountBadge}>
                                        <Text style={styles.discountText}>{discount}% OFF</Text>
                                      </View>
                                    )}
                                  </View>
                                  
                                  {/* Package Description */}
                                  {packageDescription && (
                                    <Text style={styles.packageDescription} numberOfLines={2}>
                                      {packageDescription}
                                    </Text>
                                  )}
                                  
                                  {/* Package Features */}
                                  {packageFeatures && packageFeatures.length > 0 && (
                                    <View style={styles.packageFeaturesSection}>
                                      <Text style={styles.featuresTitle}>Includes:</Text>
                                      {packageFeatures.slice(0, 3).map((feature: string, fIndex: number) => (
                                        <View key={fIndex} style={styles.featureItem}>
                                          <Text style={styles.featureBullet}>•</Text>
                                          <Text style={styles.featureText}>{feature}</Text>
                                        </View>
                                      ))}
                                      {packageFeatures.length > 3 && (
                                        <Text style={styles.moreFeatures}>
                                          +{packageFeatures.length - 3} more features
                                        </Text>
                                      )}
                                    </View>
                                  )}
                                  
                                  {/* Selection Indicator */}
                                  <View style={[
                                    styles.packageSelectionIndicator,
                                    isSelected && styles.packageSelectionIndicatorSelected
                                  ]}>
                                    <Text style={[
                                      styles.packageSelectionText,
                                      isSelected && styles.packageSelectionTextSelected
                                    ]}>
                                      {isSelected ? 'SELECTED' : 'SELECT'}
                                    </Text>
                                  </View>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                          
                          {/* Package Selection Status */}
                          <View style={styles.packageSelectionStatus}>
                            {(item as any).selectedPackage ? (
                              <View style={styles.selectionConfirmed}>
                                <Text style={styles.selectionConfirmedText}>
                                  ✅ You selected: {(item as any).selectedPackage.name}
                                </Text>
                                <Text style={styles.selectionConfirmedPrice}>
                                  ₹{(item as any).selectedPackage.price}
                                  {(item as any).selectedPackage.type && ` (${(item as any).selectedPackage.type})`}
                                </Text>
                              </View>
                            ) : (
                              <View style={styles.selectionPending}>
                                <Text style={styles.selectionPendingText}>
                                  👆 Please select a package to continue
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </>
                    ) : (
                      // PRICE FLOW (Simple Service)
                      <>
                        <View style={styles.availabilityStatusRow}>
                          <Text style={styles.detailLabel}>Service Availability:</Text>
                          <View style={[
                            styles.availabilityBadge,
                            (item as any).isAllWorkersBusy ? styles.busyAvailabilityBadge : styles.availableBadge
                          ]}>
                            <Text style={[
                              styles.availabilityStatusText,
                              (item as any).isAllWorkersBusy ? styles.busyText : styles.availableText
                            ]}>
                              {item.availability || 'Checking availability...'}
                            </Text>
                          </View>
                        </View>
                        
                        {/* Simple Service Information - NO PACKAGE INFO */}
                        {item.price && (
                          <View style={styles.simpleServiceRow}>
                            <Text style={styles.simpleServiceText}>
                              💰 Fixed service pricing: ₹{item.price}
                            </Text>
                          </View>
                        )}
                      </>
                    )}
                    
                    {/* Worker Count Details */}
                    {(item as any).totalWorkerCount && (
                      <View style={styles.workerCountRow}>
                        <Text style={styles.workerCountText}>
                          {(item as any).availableWorkerCount || 0} of {(item as any).totalWorkerCount} workers available
                        </Text>
                      </View>
                    )}
                    
                    {/* Availability if available (legacy) */}
                    {item.availability && !(item as any).totalWorkerCount && (
                      <View style={styles.availabilityRow}>
                        <Text style={styles.detailLabel}>Available:</Text>
                        <Text style={styles.availabilityText}>{item.availability}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.cardRight}>
                    {isBusy ? (
                      <View style={styles.busyBadge}>
                        <Text style={styles.busyBadgeText}>Busy</Text>
                      </View>
                    ) : isSelected ? (
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
              {(selectedCompany as any).selectedPackage ? (
                // Show selected package details
                <>
                  <Text style={styles.selectedDetail}>
                    📦 {(selectedCompany as any).selectedPackage.name}
                  </Text>
                  <Text style={styles.selectedPrice}>
                    ₹{(selectedCompany as any).selectedPackage.price}
                    {(selectedCompany as any).selectedPackage.type && `/${(selectedCompany as any).selectedPackage.type}`}
                  </Text>
                </>
              ) : (
                // Show simple service details
                <>
                  {selectedCompany.serviceType && (
                    <Text style={styles.selectedDetail}>{selectedCompany.serviceType}</Text>
                  )}
                  {selectedCompany.price && (
                    <Text style={styles.selectedPrice}>₹{selectedCompany.price}</Text>
                  )}
                </>
              )}
            </View>
          </View>
          
          <TouchableOpacity
            style={styles.continueBtn}
            activeOpacity={0.7}
            onPress={selectCompany}
          >
            <Text style={styles.continueText}>
              {selectedCompany && (selectedCompany as any).isBusy 
                ? 'Book with Limited Availability' 
                : 'Add to Cart'
              }
            </Text>
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

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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

  slotInfoSection: {
    backgroundColor: "#f0f9ff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e0f2fe",
  },

  slotInfoTitle: {
    fontSize: 13,
    color: "#0369a1",
    fontWeight: "500",
    marginBottom: 4,
  },

  slotInfoText: {
    fontSize: 15,
    color: "#0c4a6e",
    fontWeight: "600",
    letterSpacing: -0.2,
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

  companyCardBusy: {
    borderColor: "#ef4444",
    backgroundColor: "#fef2f2",
    opacity: 0.7,
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

  // New availability status styles
  availabilityStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 6,
  },

  availabilityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },

  availableBadge: {
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
  },

  busyAvailabilityBadge: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
  },

  availabilityStatusText: {
    fontSize: 13,
    fontWeight: "600",
  },

  availableText: {
    color: "#059669",
  },

  workerCountRow: {
    marginTop: 4,
    marginBottom: 6,
  },

  workerCountText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
    fontStyle: "italic",
  },

  // Package and Simple Service Info Styles
  packageInfoRow: {
    marginTop: 6,
    marginBottom: 4,
  },

  packageInfoText: {
    fontSize: 12,
    color: "#7c3aed",
    fontWeight: "600",
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },

  simpleServiceRow: {
    marginTop: 6,
    marginBottom: 4,
  },

  simpleServiceText: {
    fontSize: 12,
    color: "#059669",
    fontWeight: "600",
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#bbf7d0",
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

  busyBadge: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: "center",
  },

  busyBadgeText: {
    color: "white",
    fontSize: 14,
    fontWeight: "500",
  },

  busyText: {
    color: "#ef4444",
    fontWeight: "600",
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

  previewAvailability: {
    fontSize: 12,
    color: "#059669",
    fontWeight: "500",
  },

  // ✅ NEW: Enhanced preview styles for separated pricing
  packagePreview: {
    backgroundColor: "#eff6ff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 4,
  },

  directPreview: {
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 4,
  },

  previewSubtext: {
    fontSize: 11,
    color: "#64748b",
    fontStyle: "italic",
    marginTop: 2,
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

  continueBtnDisabled: {
    backgroundColor: "#94a3b8",
    shadowOpacity: 0,
    elevation: 0,
  },

  continueTextDisabled: {
    color: "#f1f5f9",
  },

  // Enhanced Package Selection Styles
  packageListContainer: {
    marginTop: 12,
    backgroundColor: "#f8f9ff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e0e7ff",
  },

  packageHeaderText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4338ca",
    marginBottom: 8,
    textAlign: "center",
  },

  packageSubHeaderText: {
    fontSize: 12,
    color: "#6366f1",
    marginBottom: 12,
    textAlign: "center",
    fontStyle: "italic",
  },

  packageItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },

  packageItemSelected: {
    backgroundColor: "#f0f9ff",
    borderColor: "#3b82f6",
    borderWidth: 2,
  },

  packageInfo: {
    flex: 1,
    marginRight: 12,
  },

  packageNameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },

  packageName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    flex: 1,
  },

  selectedPackageBadge: {
    backgroundColor: "#10b981",
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  selectedPackageText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },

  packageDetailsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    gap: 12,
  },

  packageDuration: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "500",
  },

  packageType: {
    fontSize: 12,
    color: "#7c3aed",
    fontWeight: "600",
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },

  packageFeaturesRow: {
    marginTop: 4,
  },

  packageFeaturesText: {
    fontSize: 11,
    color: "#6b7280",
    fontStyle: "italic",
    lineHeight: 16,
  },

  packagePriceContainer: {
    alignItems: "center",
    justifyContent: "center",
  },

  packagePrice: {
    fontSize: 16,
    fontWeight: "700",
    color: "#7c3aed",
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    textAlign: "center",
    minWidth: 80,
  },

  packagePriceType: {
    fontSize: 10,
    color: "#6b7280",
    marginTop: 2,
    textAlign: "center",
  },

  morePackagesButton: {
    backgroundColor: "#f3f4f6",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginTop: 8,
    alignItems: "center",
  },

  morePackagesText: {
    fontSize: 12,
    color: "#4338ca",
    fontWeight: "500",
  },

  packageSelectionStatus: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
  },

  packageSelectionText: {
    fontSize: 12,
    color: "#10b981",
    fontWeight: "600",
    textAlign: "center",
  },

  packageSelectionTextPending: {
    fontSize: 12,
    color: "#f59e0b",
    fontWeight: "500",
    textAlign: "center",
  },

  // Enhanced Package Selection Grid Styles
  packageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 8,
  },

  packageCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    flex: 1,
    minWidth: "45%",
    position: "relative",
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },

  packageCardSelected: {
    borderColor: "#3b82f6",
    borderWidth: 2,
    backgroundColor: "#f0f9ff",
    elevation: 2,
    shadowOpacity: 0.1,
  },

  packageCardPopular: {
    borderColor: "#f59e0b",
    borderWidth: 2,
    backgroundColor: "#fffbeb",
  },

  popularBadge: {
    position: "absolute",
    top: -8,
    right: 8,
    backgroundColor: "#f59e0b",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
  },

  popularText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  packageCardHeader: {
    marginBottom: 12,
  },

  packageTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },

  packageCardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    flex: 1,
    marginRight: 8,
  },

  packageTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#f3f4f6",
  },

  weeklyBadge: {
    backgroundColor: "#dcfdf7",
  },

  monthlyBadge: {
    backgroundColor: "#dbeafe",
  },

  yearlyBadge: {
    backgroundColor: "#fef3c7",
  },

  packageTypeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#374151",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  packagePriceSection: {
    marginBottom: 12,
  },

  packageMainPrice: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1f2937",
    marginRight: 8,
  },

  packageOriginalPrice: {
    fontSize: 14,
    color: "#9ca3af",
    textDecorationLine: "line-through",
  },

  packageDurationText: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },

  discountBadge: {
    backgroundColor: "#dc2626",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: "flex-start",
    marginTop: 4,
  },

  discountText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "600",
  },

  packageDescription: {
    fontSize: 12,
    color: "#6b7280",
    lineHeight: 16,
    marginBottom: 12,
  },

  packageFeaturesSection: {
    marginBottom: 12,
  },

  featuresTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },

  featureItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
  },

  featureBullet: {
    fontSize: 12,
    color: "#10b981",
    marginRight: 6,
    marginTop: 1,
  },

  featureText: {
    fontSize: 11,
    color: "#6b7280",
    flex: 1,
    lineHeight: 14,
  },

  moreFeatures: {
    fontSize: 10,
    color: "#3b82f6",
    fontWeight: "500",
    marginTop: 4,
    fontStyle: "italic",
  },

  packageSelectionIndicator: {
    backgroundColor: "#f3f4f6",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
  },

  packageSelectionIndicatorSelected: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },

  packageSelectionTextSelected: {
    color: "#ffffff",
    fontWeight: "600",
  },

  selectionConfirmed: {
    backgroundColor: "#f0fdf4",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },

  selectionConfirmedText: {
    fontSize: 13,
    color: "#059669",
    fontWeight: "600",
    marginBottom: 4,
  },

  selectionConfirmedPrice: {
    fontSize: 16,
    color: "#047857",
    fontWeight: "700",
  },

  selectionPending: {
    backgroundColor: "#fef3c7",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#fde68a",
  },

  selectionPendingText: {
    fontSize: 12,
    color: "#d97706",
    fontWeight: "500",
    textAlign: "center",
  },
});
