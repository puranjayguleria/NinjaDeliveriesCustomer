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

  const { serviceTitle, categoryId, allCategories } = route.params;

  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<ServiceIssue[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<ServiceIssue | null>(null);

  useEffect(() => {
    fetchServicesWithPackages();
  }, [categoryId]);

  const fetchServicesWithPackages = async () => {
    try {
      setLoading(true);
      console.log('📦 Fetching package-based services DIRECTLY from service_services for category:', categoryId);

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

      // Fetch DIRECTLY from service_services collection (not app_services)
      console.log(`📦 Querying service_services where categoryMasterId == "${searchCategoryId}"`);
      
      const servicesSnapshot = await firestore()
        .collection('service_services')
        .where('categoryMasterId', '==', searchCategoryId)
        .where('isActive', '==', true)
        .get();

      console.log(`📦 Found ${servicesSnapshot.size} services in service_services collection`);

      const servicesWithPackages: any[] = [];

      servicesSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`📦 Service: "${data.name}"`);
        console.log(`   - Has packages: ${!!(data.packages && Array.isArray(data.packages) && data.packages.length > 0)}`);
        
        if (data.packages && Array.isArray(data.packages) && data.packages.length > 0) {
          console.log(`   - Packages count: ${data.packages.length}`);
          data.packages.forEach((pkg: any, idx: number) => {
            console.log(`   - Package ${idx + 1}:`, pkg);
          });

          servicesWithPackages.push({
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
          });
        } else {
          console.log(`   - ⚠️ No packages found, skipping`);
        }
      });

      console.log(`📦 Total package-based services: ${servicesWithPackages.length}`);
      
      setServices(servicesWithPackages);

      // If no package-based services found, redirect to ServiceCategory
      if (servicesWithPackages.length === 0) {
        console.log('📦 No package-based services, redirecting to ServiceCategory');
        setTimeout(() => {
          handleSkipToServices();
        }, 500);
      }
    } catch (error) {
      console.error('❌ Error fetching services with packages:', error);
      Alert.alert('Error', 'Failed to load packages. Please try again.');
      setServices([]);
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
  };

  const handleContinue = () => {
    if (!selectedService || !selectedPackage) {
      Alert.alert("Select Package", "Please select a package to continue.");
      return;
    }

    const selectedPkg = selectedService.packages?.find(
      (p: any) => (p.id || p.name || JSON.stringify(p)) === selectedPackage
    );

    // Pass service NAME instead of ID for service_services compatibility
    const serviceName = selectedService.name;

    // Navigate to SelectDateTime with package info
    navigation.navigate("SelectDateTime", {
      serviceTitle,
      categoryId,
      issues: [serviceName], // Service name
      selectedIssueIds: [serviceName], // Pass name as ID for compatibility
      selectedIssues: [selectedService],
      selectedPackage: selectedPkg,
      isPackageBooking: true,
      allCategories,
      // Add flag to indicate this is from service_services
      fromServiceServices: true,
    });
  };

  const handleSkipToServices = () => {
    // Navigate to regular service selection
    navigation.navigate("ServiceCategory", {
      serviceTitle,
      categoryId,
      allCategories,
    });
  };

  const renderPackageCard = (pkg: any, service: ServiceIssue, index: number) => {
    // Handle different package data structures
    let packageName = pkg.name || pkg.packageName || `Package ${index + 1}`;
    let packagePrice = pkg.price || 0;
    let packageDuration = pkg.duration || '';
    
    // If package name contains price info like "1 month(s) - ₹998", parse it
    if (packageName.includes('-') && packageName.includes('₹')) {
      const parts = packageName.split('-');
      packageName = parts[0].trim(); // "1 month(s)"
      const priceMatch = parts[1].match(/₹?(\d+)/);
      if (priceMatch) {
        packagePrice = parseInt(priceMatch[1]);
      }
    }
    
    const isSelected = selectedService?.id === service.id && selectedPackage === (pkg.id || pkg.name || index);

    console.log('🎨 Rendering package card:', {
      serviceName: service.name,
      packageName,
      price: packagePrice,
      duration: packageDuration,
      isSelected,
      rawPackage: pkg
    });

    return (
      <TouchableOpacity
        key={`${service.id}-${pkg.id || pkg.name || index}`}
        style={[
          styles.packageCard,
          isSelected && styles.packageCardSelected,
          pkg.isPopular && styles.popularPackageCard,
        ]}
        onPress={() => handlePackageSelect(service, { ...pkg, name: packageName, price: packagePrice })}
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
          {packageDuration && (
            <Text style={styles.priceDuration}>/{packageDuration}</Text>
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
          <Text style={styles.headerTitle}>Select Package</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading packages...</Text>
        </View>
      </View>
    );
  }

  // If no packages available, redirect to service selection
  if (services.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Select Package</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No Package Plans Available</Text>
          <Text style={styles.emptyText}>
            This category doesn't have package plans. You can select services with direct pricing instead.
          </Text>
          <TouchableOpacity 
            style={styles.continueToServicesBtn}
            onPress={handleSkipToServices}
          >
            <Text style={styles.continueToServicesBtnText}>View Direct-Price Services</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Select Package</Text>
        <Text style={styles.headerSubtitle}>Choose a package plan that suits your needs</Text>
      </View>

      {/* Packages List */}
      <FlatList
        data={services}
        keyExtractor={(item) => item.id}
        renderItem={renderServiceWithPackages}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Bottom Actions */}
      <View style={styles.bottomBar}>
        {/* Only show "View Direct-Price Services" button if package is NOT selected */}
        {!selectedPackage && (
          <TouchableOpacity 
            style={styles.skipBtn}
            onPress={handleSkipToServices}
          >
            <Text style={styles.skipBtnText}>View Direct-Price Services</Text>
          </TouchableOpacity>
        )}

        {selectedPackage && (
          <TouchableOpacity 
            style={styles.continueBtn}
            onPress={handleContinue}
          >
            <Text style={styles.continueBtnText}>Continue with Package</Text>
          </TouchableOpacity>
        )}
      </View>
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
});
