import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { FirestoreService, ServiceIssue, ServiceCategory } from "../services/firestoreService";
import { firestore } from "../firebase.native";

const { width } = Dimensions.get('window');

export default function ServiceCategoryScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const { serviceTitle, categoryId } = route.params;

  console.log('ServiceCategoryScreen params:', { serviceTitle, categoryId });

  // Single-select states
  const [selectedId, setSelectedId] = useState<string>("");
  const [showAll, setShowAll] = useState(false);
  const [issues, setIssues] = useState<ServiceIssue[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 🆕 New states for category sidebar
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(categoryId || "");
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  // Fetch categories for sidebar
  useEffect(() => {
    fetchCategories();
  }, []);

  // Fetch issues when category changes
  useEffect(() => {
    if (selectedCategoryId) {
      fetchServiceIssues();
    }
  }, [selectedCategoryId]);

  const fetchCategories = async () => {
    try {
      setCategoriesLoading(true);
      const fetchedCategories = await FirestoreService.getServiceCategories();
      setCategories(fetchedCategories || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setCategories([]);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const fetchServiceIssues = async () => {
    try {
      setLoading(true);
      
      console.log('🔧 Fetching ALL services (both direct-price and package-based) for category:', selectedCategoryId);

      if (!selectedCategoryId) {
        console.error('No categoryId provided');
        setIssues([]);
        return;
      }

      // Get the category to check if it has a masterCategoryId
      const categoryDoc = await firestore()
        .collection('app_categories')
        .doc(selectedCategoryId.trim())
        .get();
      
      let searchCategoryId = selectedCategoryId.trim();
      
      if (categoryDoc.exists) {
        const categoryData = categoryDoc.data();
        if (categoryData?.masterCategoryId) {
          searchCategoryId = categoryData.masterCategoryId;
          console.log(`🔧 Using masterCategoryId: ${searchCategoryId}`);
        }
      }

      // Fetch DIRECTLY from service_services collection
      console.log(`� Querying service_services where categoryMasterId == "${searchCategoryId}"`);
      
      const servicesSnapshot = await firestore()
        .collection('service_services')
        .where('categoryMasterId', '==', searchCategoryId)
        .where('isActive', '==', true)
        .get();

      console.log(`� Found ${servicesSnapshot.size} total services in service_services`);

      const directPriceServices: ServiceIssue[] = [];
      const packageBasedServices: ServiceIssue[] = [];

      servicesSnapshot.forEach(doc => {
        const data = doc.data();
        const hasPackages = data.packages && Array.isArray(data.packages) && data.packages.length > 0;
        
        console.log(`📋 Service: "${data.name}"`);
        console.log(`   - Has packages: ${hasPackages}`);
        
        const serviceIssue: ServiceIssue = {
          id: doc.id,
          name: data.name || '',
          masterCategoryId: searchCategoryId,
          isActive: data.isActive || false,
          imageUrl: data.imageUrl || null,
          price: data.price,
          serviceType: data.serviceType,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        };
        
        if (!hasPackages) {
          console.log(`   ✅ Direct-price service: "${data.name}"`);
          directPriceServices.push(serviceIssue);
        } else {
          console.log(`   📦 Package-based service: "${data.name}" (has ${data.packages.length} packages)`);
          packageBasedServices.push(serviceIssue);
        }
      });
      
      // Combine both types of services
      const allServices = [...directPriceServices, ...packageBasedServices];
      
      console.log(`📊 Summary:`);
      console.log(`   - Direct-price services: ${directPriceServices.length}`);
      console.log(`   - Package-based services: ${packageBasedServices.length}`);
      console.log(`   - Total services: ${allServices.length}`);
      
      setIssues(allServices);
      
    } catch (error) {
      console.error('Error fetching services:', error);
      
      // Set empty array on error
      setIssues([]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Remove the old hardcoded issues logic and replace with dynamic data
  const displayedIssues = useMemo(() => {
    if (!issues || !Array.isArray(issues)) return [];
    if (showAll) return issues;
    return issues.slice(0, 5);
  }, [issues, showAll]);

  const hasMoreItems = issues.length > 5;

  const toggleSelect = (id: string) => {
    // Single selection - if same id clicked, deselect it, otherwise select new one
    if (selectedId === id) {
      setSelectedId("");
    } else {
      setSelectedId(id);
    }
  };

  const selectedIssueTitles = useMemo(() => {
    if (!issues || !Array.isArray(issues) || !selectedId) return [];
    
    const selectedIssue = issues.find((x) => x.id === selectedId);
    if (!selectedIssue) return [];

    return [selectedIssue.name];
  }, [issues, selectedId]);

  const onContinue = async () => {
    if (!selectedId) {
      Alert.alert("Select Issue", "Please select an issue.");
      return;
    }

    try {
      // Get the selected service
      const selectedIssueObject = issues.find(i => i.id === selectedId);
      
      if (!selectedIssueObject) {
        Alert.alert("Error", "Selected service not found.");
        return;
      }

      // Check if this service has packages by querying service_services
      console.log(`🔍 Checking if service "${selectedIssueObject.name}" has packages...`);
      
      const serviceDoc = await firestore()
        .collection('service_services')
        .doc(selectedId)
        .get();
      
      const serviceData = serviceDoc.data();
      const hasPackages = serviceData?.packages && Array.isArray(serviceData.packages) && serviceData.packages.length > 0;
      
      console.log(`📦 Service "${selectedIssueObject.name}" has packages: ${hasPackages}`);

      if (hasPackages) {
        // Package-based service - navigate to PackageSelection screen
        console.log(`📦 Navigating to PackageSelection for package-based service`);
        navigation.navigate("PackageSelection", {
          serviceTitle,
          categoryId: selectedCategoryId,
          serviceId: selectedId,
          serviceName: selectedIssueObject.name,
          selectedIssues: [selectedIssueObject],
          allCategories: categories,
        });
      } else {
        // Direct-price service - navigate to SelectDateTime
        console.log(`💰 Navigating to SelectDateTime for direct-price service`);
        const serviceNames = [selectedIssueObject.name];
        
        navigation.navigate("SelectDateTime", {
          serviceTitle,
          categoryId: selectedCategoryId,
          issues: serviceNames, // Service names
          selectedIssueIds: serviceNames, // Pass names as IDs for compatibility
          selectedIssues: [selectedIssueObject], // pass as array for compatibility
          allCategories: categories, // 🆕 Pass all categories for sidebar
          // Add flag to indicate this is from service_services (direct-price)
          fromServiceServices: true,
        });
      }
    } catch (error) {
      console.error('Error checking service type:', error);
      Alert.alert("Error", "Failed to load service details. Please try again.");
    }
  };

  const issueIcon =
    serviceTitle?.toLowerCase() === "plumber"
      ? require("../assets/images/icon_cleaning.png")
      : require("../assets/images/icon_home_repair.png");

  // Get selected category details
  const selectedCategory = categories.find(cat => cat.id === selectedCategoryId);

  // Function to get icon based on category name (same as ServicesScreen)
  const getCategoryIcon = (categoryName: string) => {
    const name = categoryName?.toLowerCase() || '';
    
    if (name.includes("electric")) return "flash-outline";
    if (name.includes("plumb")) return "water-outline";
    if (name.includes("car") || name.includes("wash")) return "car-outline";
    if (name.includes("clean")) return "sparkles-outline";
    if (name.includes("health")) return "fitness-outline";
    if (name.includes("daily") || name.includes("wage")) return "people-outline";
    
    return "construct-outline";
  };

  const renderItem = ({ item }: any) => {
    const checked = selectedId === item.id;

    return (
      <TouchableOpacity
        style={[styles.serviceCard, checked && styles.serviceCardSelected]}
        activeOpacity={0.7}
        onPress={() => toggleSelect(item.id)}
      >
        {/* Service Image */}
        {item.imageUrl ? (
          <Image 
            source={{ uri: item.imageUrl }} 
            style={styles.serviceImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.serviceImagePlaceholder}>
            <Text style={styles.placeholderText}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        
        <View style={styles.serviceTextContainer}>
          <Text style={styles.serviceTitle}>{item.name}</Text>
          <Text style={styles.serviceSubTitle}>
            {checked ? "Selected" : "Tap to select"}
          </Text>
        </View>
        
        {/* Checkbox on Right */}
        <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
          {checked && <Text style={styles.checkmark}>✓</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  const ListFooter = () => {
    return (
      <View>
        {/* View More Button */}
        {hasMoreItems && !showAll && (
          <TouchableOpacity 
            style={styles.viewMoreBtn} 
            onPress={() => setShowAll(true)}
          >
            <Text style={styles.viewMoreText}>View More Services</Text>
          </TouchableOpacity>
        )}
        
        {/* Show Less Button */}
        {showAll && hasMoreItems && (
          <TouchableOpacity 
            style={styles.viewLessBtn} 
            onPress={() => setShowAll(false)}
          >
            <Text style={styles.viewLessText}>Show Less</Text>
          </TouchableOpacity>
        )}
        
        <View style={{ height: 80 }} />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Select Services</Text>
      </View>

      {/* Main Content: Sidebar + Services */}
      <View style={styles.mainContent}>
        {/* Left Sidebar - Selected Category Only */}
        <View style={styles.sidebar}>
          {categoriesLoading ? (
            <ActivityIndicator size="small" color="#2563eb" style={{ marginTop: 20 }} />
          ) : selectedCategory ? (
            <TouchableOpacity 
              style={styles.selectedCategoryContainer}
              activeOpacity={0.7}
              onPress={() => navigation.goBack()}
            >
              {selectedCategory.imageUrl ? (
                <Image 
                  source={{ uri: selectedCategory.imageUrl }} 
                  style={styles.categoryImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.categoryIconContainer}>
                  <Text style={styles.categoryIconText}>
                    {selectedCategory.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={styles.selectedCategoryName} numberOfLines={2}>
                {selectedCategory.name}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Right Side - Services */}
        <View style={styles.servicesContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2563eb" />
              <Text style={styles.loadingText}>Loading services...</Text>
            </View>
          ) : issues.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No Direct-Price Services</Text>
              <Text style={styles.emptyText}>
                No direct-price services available for this category. Check package plans instead.
              </Text>
            </View>
          ) : (
            <FlatList
              data={displayedIssues}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              ListFooterComponent={ListFooter}
              contentContainerStyle={{ paddingBottom: 100 }}
              showsVerticalScrollIndicator={false}
              refreshing={loading}
              onRefresh={fetchServiceIssues}
            />
          )}
        </View>
      </View>

      {/* Bottom Continue Button */}
      {selectedId && (
        <View style={styles.bottomBar}>
          <TouchableOpacity 
            style={styles.continueBtn} 
            onPress={onContinue}
          >
            <Text style={styles.continueBtnText}>
              Continue (1 selected)
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

  // Header
  header: {
    backgroundColor: "white",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    alignItems: "center",
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
  },

  // Main Content Layout
  mainContent: {
    flex: 1,
    flexDirection: "row",
  },

  // Left Sidebar
  sidebar: {
    width: 90,
    backgroundColor: "#ffffff",
    borderRightWidth: 1,
    borderRightColor: "#e2e8f0",
    paddingVertical: 20,
    alignItems: "center",
  },

  sidebarContent: {
    paddingVertical: 8,
  },

  // Selected Category Display
  selectedCategoryContainer: {
    alignItems: "center",
    paddingHorizontal: 8,
  },

  categoryImage: {
    width: 60,
    height: 60,
    borderRadius: 16,
    marginBottom: 8,
  },

  categoryIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },

  categoryIconText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#64748b",
  },

  selectedCategoryName: {
    fontSize: 11,
    fontWeight: "600",
    color: "#0f172a",
    textAlign: "center",
    lineHeight: 14,
  },

  categoryItem: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginVertical: 4,
    marginHorizontal: 8,
    borderRadius: 12,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },

  categoryItemSelected: {
    backgroundColor: "white",
    borderLeftWidth: 3,
    borderLeftColor: "#2563eb",
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },

  categoryText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#64748b",
    textAlign: "center",
    lineHeight: 16,
  },

  categoryTextSelected: {
    color: "#2563eb",
    fontWeight: "700",
  },

  // Right Side - Services Container
  servicesContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },

  // Service Cards
  serviceCard: {
    backgroundColor: "white",
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginBottom: 8,
    marginHorizontal: 8,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  serviceCardSelected: {
    borderColor: "#0fcf0fff",
    backgroundColor: "#f0f9ff",
    elevation: 2,
  },

  // Checkbox
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#cbd5e1",
    marginLeft: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
    flexShrink: 0,
  },

  checkboxChecked: {
    backgroundColor: "#1ec30fff",
    borderColor: "#22e118ff",
  },

  checkmark: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
  },

  serviceIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    marginRight: 12,
    flexShrink: 0,
  },

  serviceImage: {
    width: 50,
    height: 50,
    borderRadius: 12,
    marginRight: 12,
    flexShrink: 0,
  },

  serviceImagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 12,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e0e7ff",
    flexShrink: 0,
  },

  placeholderText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#4f46e5",
  },

  serviceIconPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 12,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  serviceIconText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#64748b",
  },

  serviceTextContainer: {
    flex: 1,
    minWidth: 0,
  },

  serviceTitle: { 
    fontSize: 15, 
    fontWeight: "600", 
    color: "#0f172a",
    marginBottom: 4,
    flexWrap: "wrap",
  },

  serviceSubTitle: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "400",
    flexWrap: "wrap",
  },

  // Bottom Bar
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
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: -2 },
    shadowRadius: 8,
    elevation: 8,
  },

  continueBtn: {
    backgroundColor: "#4CAF50",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },

  continueBtnText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },

  otherBox: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  
  otherTitle: { 
    fontWeight: "600", 
    fontSize: 14, 
    color: "#0f172a",
    marginBottom: 12,
  },
  
  input: {
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    padding: 12,
    minHeight: 80,
    fontWeight: "400",
    color: "#0f172a",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    textAlignVertical: "top",
  },

  viewMoreBtn: {
    backgroundColor: "#f0f9ff",
    borderWidth: 1,
    borderColor: "#2563eb",
    paddingVertical: 12,
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
  },

  viewMoreText: {
    color: "#2563eb",
    textAlign: "center",
    fontWeight: "600",
    fontSize: 14,
  },

  viewLessBtn: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingVertical: 10,
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
  },

  viewLessText: {
    color: "#64748b",
    textAlign: "center",
    fontWeight: "500",
    fontSize: 13,
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
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 64,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
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

  retryButton: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 16,
  },

  retryButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },

  btnDisabled: {
    opacity: 0.6,
  },

  // Old styles kept for compatibility
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 24,
    paddingTop: 50,
    paddingBottom: 8,
  },
  
  subHeader: { 
    color: "#64748b", 
    fontSize: 16, 
    fontWeight: "400",
    paddingHorizontal: 24,
    marginBottom: 32,
    lineHeight: 24,
  },

  card: {
    backgroundColor: "white",
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginBottom: 12,
    marginHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 0,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  cardSelected: {
    borderColor: "#4CAF50",
    backgroundColor: "#f8faff",
    elevation: 1,
    shadowOpacity: 0.08,
  },

  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  icon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    marginRight: 16,
  },

  textContainer: {
    flex: 1,
  },

  title: { 
    fontSize: 16, 
    fontWeight: "500", 
    color: "#0f172a",
    letterSpacing: -0.2,
    marginBottom: 4,
  },

  subTitle: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "400",
    lineHeight: 20,
  },

  btn: {
    backgroundColor: "#2563eb",
    paddingVertical: 16,
    borderRadius: 12,
    marginHorizontal: 24,
    marginTop: 24,
    marginBottom: 32,
    elevation: 0,
    shadowColor: '#2563eb',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  
  btnText: { 
    color: "#fff", 
    textAlign: "center", 
    fontWeight: "500",
    fontSize: 16,
    letterSpacing: -0.2,
  },
});
