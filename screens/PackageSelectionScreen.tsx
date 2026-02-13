import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  ScrollView,
  Modal,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { FirestoreService, ServiceIssue } from "../services/firestoreService";
import { firestore } from "../firebase.native";

interface Package {
  id?: string;
  name: string;
  price: number;
  duration?: string;
  description?: string;
  features?: string[];
  isPopular?: boolean;
}

export default function PackageSelectionScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const { serviceTitle, categoryId, allCategories, serviceId, serviceName } = route.params;

  const [loading, setLoading] = useState(true);
  const [packageBasedServices, setPackageBasedServices] = useState<ServiceIssue[]>([]);
  const [directPriceServices, setDirectPriceServices] = useState<ServiceIssue[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<ServiceIssue | null>(null);
  const [selectedDirectService, setSelectedDirectService] = useState<ServiceIssue | null>(null);
  
  // Modal states
  const [showPackagesModal, setShowPackagesModal] = useState(false);
  const [showServicesModal, setShowServicesModal] = useState(false);

  useEffect(() => {
    // If serviceId is provided, fetch only that service's packages
    if (serviceId && serviceName) {
      fetchSingleServicePackages();
    } else {
      // Otherwise, fetch ALL services (both package-based and direct-price) for the category
      fetchAllServices();
    }
  }, [categoryId, serviceId]);

  const fetchSingleServicePackages = async () => {
    try {
      setLoading(true);
      console.log(`📦 Fetching packages for specific service: "${serviceName}" (ID: ${serviceId})`);

      const serviceDoc = await firestore()
        .collection('service_services')
        .doc(serviceId)
        .get();

      if (!serviceDoc.exists) {
        console.error('❌ Service not found');
        Alert.alert('Error', 'Service not found. Please try again.');
        navigation.goBack();
        return;
      }

      const data = serviceDoc.data();
      
      if (!data?.packages || !Array.isArray(data.packages) || data.packages.length === 0) {
        console.error('❌ No packages found for this service');
        Alert.alert('Error', 'No packages available for this service.');
        navigation.goBack();
        return;
      }

      console.log(`📦 Found ${data.packages.length} packages for "${serviceName}"`);

      const serviceWithPackages = {
        id: serviceDoc.id,
        name: data.name || serviceName,
        masterCategoryId: data.categoryMasterId,
        isActive: data.isActive || false,
        imageUrl: data.imageUrl || null,
        packages: data.packages,
        price: data.price,
        serviceType: data.serviceType,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };

      setPackageBasedServices([serviceWithPackages]);
      setSelectedService(serviceWithPackages);

    } catch (error) {
      console.error('❌ Error fetching service packages:', error);
      Alert.alert('Error', 'Failed to load packages. Please try again.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const fetchAllServices = async () => {
    try {
      setLoading(true);
      console.log('📦 Fetching ALL services (packages + direct-price) from service_services for category:', categoryId);

      // Get the category to check if it has a masterCategoryId
      const categoryDoc = await firestore()
        .collection('app_categories')
        .doc(categoryId.trim())
        .get();
      
      let searchCategoryId = categoryId.trim();
      
      if (categoryDoc.exists) {
        const categoryData = categoryDoc.data();
        if (categoryData?.masterCategoryId) {
          searchCategoryId = categoryData.masterCategoryId;
          console.log(`📦 Using masterCategoryId: ${searchCategoryId}`);
        }
      }

      // Fetch ALL services from service_services collection
      console.log(`📦 Querying service_services where categoryMasterId == "${searchCategoryId}"`);
      
      const servicesSnapshot = await firestore()
        .collection('service_services')
        .where('categoryMasterId', '==', searchCategoryId)
        .where('isActive', '==', true)
        .get();

      console.log(`📦 Found ${servicesSnapshot.size} total services in service_services collection`);

      const withPackages: any[] = [];
      const withoutPackages: any[] = [];

      servicesSnapshot.forEach(doc => {
        const data = doc.data();
        const hasPackages = data.packages && Array.isArray(data.packages) && data.packages.length > 0;
        
        console.log(`📋 Service: "${data.name}" - Has packages: ${hasPackages}`);
        
        const serviceObj = {
          id: doc.id,
          name: data.name || '',
          masterCategoryId: searchCategoryId,
          isActive: data.isActive || false,
          imageUrl: data.imageUrl || null,
          packages: data.packages,
          price: data.price,
          serviceType: data.serviceType,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        };

        if (hasPackages) {
          console.log(`   ✅ Package-based: ${data.packages.length} packages`);
          withPackages.push(serviceObj);
        } else {
          console.log(`   💰 Direct-price: ₹${data.price}`);
          withoutPackages.push(serviceObj);
        }
      });

      console.log(`📊 Summary:`);
      console.log(`   - Package-based services: ${withPackages.length}`);
      console.log(`   - Direct-price services: ${withoutPackages.length}`);
      
      setPackageBasedServices(withPackages);
      setDirectPriceServices(withoutPackages);

    } catch (error) {
      console.error('❌ Error fetching services:', error);
      Alert.alert('Error', 'Failed to load services. Please try again.');
      setPackageBasedServices([]);
      setDirectPriceServices([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePackageSelect = (service: ServiceIssue, pkg: any) => {
    console.log('✅ Package selected:', {
      service: service.name,
      package: pkg.name,
      price: pkg.price
    });
    setSelectedService(service);
    setSelectedPackage(pkg.id || pkg.name || JSON.stringify(pkg));
    setSelectedDirectService(null); // Clear direct service selection
  };

  const handleDirectServiceSelect = (service: ServiceIssue) => {
    console.log('✅ Direct-price service selected:', {
      service: service.name,
      price: service.price
    });
    setSelectedDirectService(service);
    setSelectedService(null); // Clear package selection
    setSelectedPackage(null);
  };

  const handleContinue = () => {
    // Check if package is selected
    if (selectedService && selectedPackage) {
      const selectedPkg = selectedService.packages?.find(
        (p: any) => (p.id || p.name || JSON.stringify(p)) === selectedPackage
      );

      console.log('📦 Navigating with package-based service:', {
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        packageName: selectedPkg?.name,
        fromServiceServices: true
      });

      // Navigate to SelectDateTime with package info
      navigation.navigate("SelectDateTime", {
        serviceTitle,
        categoryId,
        issues: [selectedService.name],
        selectedIssueIds: [selectedService.id], // ✅ Pass service ID, not name
        selectedIssues: [selectedService],
        selectedPackage: selectedPkg,
        isPackageBooking: true,
        allCategories,
        fromServiceServices: true,
      });
      return;
    }

    // Check if direct-price service is selected
    if (selectedDirectService) {
      console.log('💰 Navigating with direct-price service:', {
        serviceId: selectedDirectService.id,
        serviceName: selectedDirectService.name,
        fromServiceServices: true
      });

      // Navigate to SelectDateTime with direct-price service
      navigation.navigate("SelectDateTime", {
        serviceTitle,
        categoryId,
        issues: [selectedDirectService.name],
        selectedIssueIds: [selectedDirectService.id], // ✅ Pass service ID, not name
        selectedIssues: [selectedDirectService],
        allCategories,
        fromServiceServices: true,
        isPackageBooking: false, // ✅ Explicitly mark as NOT a package booking
      });
      return;
    }

    // Nothing selected
    Alert.alert("Select Service", "Please select a package or service to continue.");
  };

  const renderPackageCard = (pkg: any, service: ServiceIssue, index: number) => {
    // Handle different package data structures
    let packageName = pkg.name || pkg.packageName || `Package ${index + 1}`;
    let packagePrice = pkg.price || 0;
    let packageDuration = pkg.duration || '';
    
    // 🔥 NEW: Check for unit field from Firebase (month, week, year, day)
    const packageUnit = pkg.unit || pkg.frequency || pkg.type || '';
    
    // If package name contains price info like "1 month(s) - ₹998", parse it
    if (packageName.includes('-') && packageName.includes('₹')) {
      const parts = packageName.split('-');
      packageName = parts[0].trim(); // "1 month(s)"
      const priceMatch = parts[1].match(/₹?(\d+)/);
      if (priceMatch) {
        packagePrice = parseInt(priceMatch[1]);
      }
    }
    
    // Determine proper duration text from unit field, duration field, OR package name
    let durationText = '';
    let fullDurationText = ''; // For showing complete duration like "3 months", "2 weeks"
    
    // 🔥 PRIORITY 1: Use unit field if available
    if (packageUnit) {
      const unitLower = packageUnit.toLowerCase();
      
      // Parse duration number
      let durationCount = 1;
      if (packageDuration) {
        const durationNum = parseInt(packageDuration.toString());
        if (!isNaN(durationNum) && durationNum > 0) {
          durationCount = durationNum;
        }
      }
      
      // Determine unit type
      if (unitLower.includes('month')) {
        fullDurationText = durationCount === 1 ? '1 month' : `${durationCount} months`;
      } else if (unitLower.includes('week')) {
        fullDurationText = durationCount === 1 ? '1 week' : `${durationCount} weeks`;
      } else if (unitLower.includes('day')) {
        fullDurationText = durationCount === 1 ? '1 day' : `${durationCount} days`;
      } else if (unitLower.includes('year')) {
        fullDurationText = durationCount === 1 ? '1 year' : `${durationCount} years`;
      } else {
        // If unit is not recognized, use as-is
        fullDurationText = `${durationCount} ${packageUnit}`;
      }
    }
    // PRIORITY 2: Try to get from duration field
    else if (packageDuration) {
      const durationLower = packageDuration.toString().toLowerCase();
      
      // Check for month/monthly
      if (durationLower.includes('month')) {
        durationText = 'month';
        // Try to extract number of months
        const monthMatch = durationLower.match(/(\d+)\s*month/);
        if (monthMatch) {
          const count = parseInt(monthMatch[1]);
          fullDurationText = count === 1 ? '1 month' : `${count} months`;
        } else {
          fullDurationText = packageDuration;
        }
      } 
      // Check for year/yearly
      else if (durationLower.includes('year')) {
        durationText = 'year';
        const yearMatch = durationLower.match(/(\d+)\s*year/);
        if (yearMatch) {
          const count = parseInt(yearMatch[1]);
          fullDurationText = count === 1 ? '1 year' : `${count} years`;
        } else {
          fullDurationText = packageDuration;
        }
      }
      // Check for week/weekly
      else if (durationLower.includes('week')) {
        durationText = 'week';
        const weekMatch = durationLower.match(/(\d+)\s*week/);
        if (weekMatch) {
          const count = parseInt(weekMatch[1]);
          fullDurationText = count === 1 ? '1 week' : `${count} weeks`;
        } else {
          fullDurationText = packageDuration;
        }
      }
      // Check for day/daily
      else if (durationLower.includes('day')) {
        durationText = 'day';
        const dayMatch = durationLower.match(/(\d+)\s*day/);
        if (dayMatch) {
          const count = parseInt(dayMatch[1]);
          fullDurationText = count === 1 ? '1 day' : `${count} days`;
        } else {
          fullDurationText = packageDuration;
        }
      }
      // If it's just a number, try to infer from package name
      else if (!isNaN(Number(packageDuration))) {
        const nameLower = packageName.toLowerCase();
        if (nameLower.includes('month')) {
          durationText = 'month';
          fullDurationText = `${packageDuration} month${packageDuration > 1 ? 's' : ''}`;
        } else if (nameLower.includes('year')) {
          durationText = 'year';
          fullDurationText = `${packageDuration} year${packageDuration > 1 ? 's' : ''}`;
        } else if (nameLower.includes('week')) {
          durationText = 'week';
          fullDurationText = `${packageDuration} week${packageDuration > 1 ? 's' : ''}`;
        } else if (nameLower.includes('day')) {
          durationText = 'day';
          fullDurationText = `${packageDuration} day${packageDuration > 1 ? 's' : ''}`;
        } else {
          durationText = 'month'; // Default to month
          fullDurationText = `${packageDuration} month${packageDuration > 1 ? 's' : ''}`;
        }
      } else {
        durationText = packageDuration; // Use as-is if it's already text
        fullDurationText = packageDuration;
      }
    } 
    // PRIORITY 3: If no duration field, try to extract from package name
    else {
      const nameLower = packageName.toLowerCase();
      
      // Check for patterns like "3 months", "2 weeks", etc.
      const durationMatch = nameLower.match(/(\d+)\s*(month|week|day|year)/);
      if (durationMatch) {
        const count = parseInt(durationMatch[1]);
        const unit = durationMatch[2];
        durationText = unit;
        fullDurationText = count === 1 ? `1 ${unit}` : `${count} ${unit}s`;
      }
      // Check package name for duration keywords without numbers
      else if (nameLower.includes('month') || nameLower.includes('monthly')) {
        durationText = 'month';
        fullDurationText = '1 month';
      } else if (nameLower.includes('year') || nameLower.includes('yearly') || nameLower.includes('annual')) {
        durationText = 'year';
        fullDurationText = '1 year';
      } else if (nameLower.includes('week') || nameLower.includes('weekly')) {
        durationText = 'week';
        fullDurationText = '1 week';
      } else if (nameLower.includes('day') || nameLower.includes('daily')) {
        durationText = 'day';
        fullDurationText = '1 day';
      } else if (nameLower.includes('quarter') || nameLower.includes('quarterly')) {
        durationText = 'quarter';
        fullDurationText = '3 months';
      } else if (nameLower.includes('half') && nameLower.includes('year')) {
        durationText = 'half year';
        fullDurationText = '6 months';
      }
    }
    
    // Create consistent package ID for selection
    const packageId = pkg.id || pkg.name || JSON.stringify(pkg);
    const isSelected = selectedService?.id === service.id && selectedPackage === packageId;

    console.log('🎨 Rendering package card:', {
      serviceName: service.name,
      packageName,
      price: packagePrice,
      duration: packageDuration,
      unit: packageUnit,
      durationText,
      fullDurationText,
      isSelected,
      packageId,
      selectedPackage,
      rawPackage: pkg
    });

    return (
      <TouchableOpacity
        key={`${service.id}-${packageId}`}
        style={[
          styles.packageCard,
          isSelected && styles.packageCardSelected,
          pkg.isPopular && styles.popularPackageCard,
        ]}
        onPress={() => {
          console.log('📦 Package clicked:', packageName);
          handlePackageSelect(service, { ...pkg, id: packageId, name: packageName, price: packagePrice });
        }}
        activeOpacity={0.7}
      >
        {pkg.isPopular && (
          <View style={styles.popularBadge}>
            <Text style={styles.popularBadgeText}>POPULAR</Text>
          </View>
        )}

        <Text style={styles.packageName}>{packageName}</Text>
        
        <View style={styles.priceContainer}>
          <Text style={styles.priceSymbol}>₹</Text>
          <Text style={styles.priceAmount}>{packagePrice}</Text>
          {fullDurationText && (
            <Text style={styles.priceDurationDetail}> ({fullDurationText})</Text>
          )}
        </View>

        {pkg.description && (
          <Text style={styles.packageDescription}>{pkg.description}</Text>
        )}

        {pkg.features && pkg.features.length > 0 && (
          <View style={styles.featuresContainer}>
            {pkg.features.map((feature: string, idx: number) => (
              <View key={idx} style={styles.featureRow}>
                <Text style={styles.featureBullet}>✓</Text>
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
          {isSelected && <Text style={styles.checkmark}>✓</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  const renderServiceWithPackages = ({ item }: { item: ServiceIssue }) => {
    if (!item.packages || item.packages.length === 0) return null;

    console.log('📋 Rendering service section:', {
      serviceName: item.name,
      packagesCount: item.packages.length,
      packages: item.packages
    });

    return (
      <View style={styles.serviceSection}>
        <Text style={styles.serviceName}>{item.name}</Text>
        <View style={styles.packagesGrid}>
          {item.packages.map((pkg: any, index: number) => renderPackageCard(pkg, item, index))}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{serviceTitle}</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{serviceTitle}</Text>
        <Text style={styles.headerSubtitle}>Choose a package or service</Text>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Packages Section Button */}
        {packageBasedServices.length > 0 && (
          <TouchableOpacity 
            style={[styles.sectionButton, styles.packagesSectionButton]}
            onPress={() => {
              console.log('📦 Opening Packages Modal');
              console.log('Package-based services:', packageBasedServices.length);
              setShowPackagesModal(true);
            }}
            activeOpacity={0.7}
          >
            <View style={styles.sectionButtonContent}>
              <Text style={styles.sectionButtonIcon}>📦</Text>
              <View style={styles.sectionButtonTextContainer}>
                <Text style={[styles.sectionButtonTitle, styles.packagesSectionTitle]}>Packages</Text>
                <Text style={styles.sectionButtonSubtitle}>
                  {packageBasedServices.length} package{packageBasedServices.length > 1 ? 's' : ''} available
                </Text>
              </View>
              <Text style={styles.sectionButtonArrow}>›</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Services Section Button */}
        {directPriceServices.length > 0 && (
          <TouchableOpacity 
            style={[styles.sectionButton, styles.servicesSectionButton]}
            onPress={() => {
              console.log('💰 Opening Services Modal');
              console.log('Direct-price services:', directPriceServices.length);
              setShowServicesModal(true);
            }}
            activeOpacity={0.7}
          >
            <View style={styles.sectionButtonContent}>
              <Text style={styles.sectionButtonIcon}>💰</Text>
              <View style={styles.sectionButtonTextContainer}>
                <Text style={[styles.sectionButtonTitle, styles.servicesSectionTitle]}>Services</Text>
                <Text style={styles.sectionButtonSubtitle}>
                  {directPriceServices.length} service{directPriceServices.length > 1 ? 's' : ''} available
                </Text>
              </View>
              <Text style={styles.sectionButtonArrow}>›</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Empty State */}
        {packageBasedServices.length === 0 && directPriceServices.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No Services Available</Text>
            <Text style={styles.emptyText}>
              This category doesn't have any services available at the moment.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Packages Modal */}
      <Modal
        visible={showPackagesModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPackagesModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowPackagesModal(false)}
        >
          <TouchableOpacity 
            style={[styles.modalContainer, styles.packagesModalContainer]}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <View style={[styles.modalHeader, styles.packagesModalHeader]}>
              <Text style={[styles.modalTitle, styles.packagesModalTitle]}>📦 Select Package</Text>
              <TouchableOpacity 
                onPress={() => setShowPackagesModal(false)}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Modal Content */}
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {packageBasedServices.length > 0 ? (
                packageBasedServices.map((service) => (
                  <View key={service.id} style={styles.serviceSection}>
                    <Text style={styles.serviceName}>{service.name}</Text>
                    <View style={styles.packagesGrid}>
                      {service.packages?.map((pkg: any, index: number) => 
                        renderPackageCard(pkg, service, index)
                      )}
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyModalContent}>
                  <Text style={styles.emptyModalText}>No packages available</Text>
                </View>
              )}
            </ScrollView>

            {/* Modal Footer */}
            {selectedPackage && (
              <View style={styles.modalFooter}>
                <TouchableOpacity 
                  style={styles.modalContinueBtn}
                  onPress={() => {
                    setShowPackagesModal(false);
                    handleContinue();
                  }}
                >
                  <Text style={styles.modalContinueBtnText}>Continue with Package</Text>
                </TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Services Modal */}
      <Modal
        visible={showServicesModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowServicesModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowServicesModal(false)}
        >
          <TouchableOpacity 
            style={[styles.modalContainer, styles.servicesModalContainer]}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <View style={[styles.modalHeader, styles.servicesModalHeader]}>
              <Text style={[styles.modalTitle, styles.servicesModalTitle]}>💰 Select Service</Text>
              <TouchableOpacity 
                onPress={() => setShowServicesModal(false)}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Modal Content */}
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {directPriceServices.length > 0 ? (
                directPriceServices.map((service) => (
                  <TouchableOpacity
                    key={service.id}
                    style={[
                      styles.directServiceCard,
                      selectedDirectService?.id === service.id && styles.directServiceCardSelected
                    ]}
                    onPress={() => handleDirectServiceSelect(service)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.directServiceInfo}>
                      <Text style={styles.directServiceName}>{service.name}</Text>
                      {service.serviceType && (
                        <Text style={styles.directServiceType}>{service.serviceType}</Text>
                      )}
                    </View>
                    
                    <View style={styles.directServicePriceContainer}>
                      <Text style={styles.directServicePrice}>₹{service.price}</Text>
                    </View>

                    <View style={[
                      styles.checkbox, 
                      selectedDirectService?.id === service.id && styles.checkboxChecked
                    ]}>
                      {selectedDirectService?.id === service.id && (
                        <Text style={styles.checkmark}>✓</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyModalContent}>
                  <Text style={styles.emptyModalText}>No services available</Text>
                </View>
              )}
            </ScrollView>

            {/* Modal Footer */}
            {selectedDirectService && (
              <View style={styles.modalFooter}>
                <TouchableOpacity 
                  style={styles.modalContinueBtn}
                  onPress={() => {
                    setShowServicesModal(false);
                    handleContinue();
                  }}
                >
                  <Text style={styles.modalContinueBtnText}>Continue with Service</Text>
                </TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Bottom Continue Button */}
      {(selectedPackage || selectedDirectService) && (
        <View style={styles.bottomBar}>
          <TouchableOpacity 
            style={styles.continueBtn}
            onPress={handleContinue}
          >
            <Text style={styles.continueBtnText}>
              {selectedPackage ? 'Continue with Package' : 'Continue with Service'}
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
    backgroundColor: "#f8fafc",
  },

  header: {
    backgroundColor: "white",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
    marginBottom: 4,
  },

  headerSubtitle: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    marginTop: 4,
  },

  listContent: {
    padding: 16,
    paddingBottom: 100,
  },

  serviceSection: {
    marginBottom: 24,
  },

  serviceName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 12,
    paddingHorizontal: 4,
  },

  packagesGrid: {
    gap: 12,
  },

  packageCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#e2e8f0",
    position: "relative",
  },

  packageCardSelected: {
    borderColor: "#4CAF50",
    backgroundColor: "#f0fdf4",
  },

  popularPackageCard: {
    borderColor: "#f59e0b",
  },

  popularBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "#f59e0b",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },

  popularBadgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  packageName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 12,
  },

  priceContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 12,
  },

  priceSymbol: {
    fontSize: 20,
    fontWeight: "600",
    color: "#2563eb",
    marginRight: 2,
  },

  priceAmount: {
    fontSize: 32,
    fontWeight: "700",
    color: "#2563eb",
  },

  priceDuration: {
    fontSize: 16,
    color: "#64748b",
    marginLeft: 4,
  },

  priceDurationDetail: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
    marginLeft: 6,
  },

  packageDescription: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 16,
    lineHeight: 20,
  },

  featuresContainer: {
    marginTop: 8,
  },

  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },

  featureBullet: {
    fontSize: 16,
    color: "#4CAF50",
    marginRight: 8,
    fontWeight: "700",
  },

  featureText: {
    fontSize: 14,
    color: "#475569",
    flex: 1,
    lineHeight: 20,
  },

  checkbox: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
  },

  checkboxChecked: {
    backgroundColor: "#4CAF50",
    borderColor: "#4CAF50",
  },

  checkmark: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
  },

  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "white",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },

  skipBtn: {
    width: "100%",
    backgroundColor: "#f1f5f9",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },

  skipBtnText: {
    color: "#475569",
    fontSize: 15,
    fontWeight: "600",
  },

  continueBtn: {
    width: "100%",
    backgroundColor: "#4CAF50",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },

  continueBtnText: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
  },

  continueToServicesBtn: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
  },

  continueToServicesBtnText: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
    paddingHorizontal: 32,
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 8,
    textAlign: "center",
  },

  emptyText: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 20,
  },

  scrollContent: {
    paddingBottom: 100,
    paddingTop: 16,
  },

  // Section Buttons (replacing old section containers)
  sectionButton: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  packagesSectionButton: {
    backgroundColor: "#f0fdf4",
    borderColor: "#4CAF50",
  },

  servicesSectionButton: {
    backgroundColor: "#fef2f2",
    borderColor: "#ef4444",
  },

  sectionButtonContent: {
    flexDirection: "row",
    alignItems: "center",
  },

  sectionButtonIcon: {
    fontSize: 32,
    marginRight: 16,
  },

  sectionButtonTextContainer: {
    flex: 1,
  },

  sectionButtonTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },

  packagesSectionTitle: {
    color: "#15803d",
  },

  servicesSectionTitle: {
    color: "#dc2626",
  },

  sectionButtonSubtitle: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
  },

  sectionButtonArrow: {
    fontSize: 28,
    color: "#64748b",
    fontWeight: "300",
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },

  modalContainer: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: "85%",
    maxHeight: "85%",
    paddingBottom: 20,
  },

  // Packages Modal - Green Theme
  packagesModalContainer: {
    backgroundColor: "#f0fdf4",
  },

  packagesModalHeader: {
    backgroundColor: "#dcfce7",
    borderBottomColor: "#4CAF50",
  },

  packagesModalTitle: {
    color: "#15803d",
  },

  // Services Modal - Red Theme
  servicesModalContainer: {
    backgroundColor: "#fef2f2",
  },

  servicesModalHeader: {
    backgroundColor: "#fee2e2",
    borderBottomColor: "#ef4444",
  },

  servicesModalTitle: {
    color: "#dc2626",
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },

  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
  },

  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },

  modalCloseText: {
    fontSize: 20,
    color: "#64748b",
    fontWeight: "600",
  },

  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },

  modalFooter: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },

  modalContinueBtn: {
    backgroundColor: "#4CAF50",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },

  modalContinueBtnText: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
  },

  emptyModalContent: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyModalText: {
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
  },

  sectionContainer: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },

  directServiceCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },

  directServiceCardSelected: {
    borderColor: "#4CAF50",
    backgroundColor: "#f0fdf4",
  },

  directServiceInfo: {
    flex: 1,
  },

  directServiceName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 4,
  },

  directServiceType: {
    fontSize: 12,
    color: "#64748b",
    textTransform: "capitalize",
  },

  directServicePriceContainer: {
    marginRight: 40,
  },

  directServicePrice: {
    fontSize: 20,
    fontWeight: "700",
    color: "#4CAF50",
  },
});
