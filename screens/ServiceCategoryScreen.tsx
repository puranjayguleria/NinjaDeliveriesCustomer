import React, { useCallback, useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
  TextInput,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { ServiceIssue, ServiceCategory } from "../services/firestoreService";
import { dedupeServicesByCategoryAndName } from "../utils/serviceDedupe";
import { firestore } from "../firebase.native";

export default function ServiceCategoryScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const { serviceTitle, categoryId } = route.params;

  console.log('ServiceCategoryScreen params:', { serviceTitle, categoryId });

  // Quantity-based states (replacing multi-select)
  const [serviceQuantities, setServiceQuantities] = useState<Record<string, number>>({});
  const [showAll, setShowAll] = useState(false);
  const [issues, setIssues] = useState<ServiceIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Description modal
  const [descriptionModal, setDescriptionModal] = useState<{
    visible: boolean;
    title: string;
    description: string;
  }>({ visible: false, title: '', description: '' });
  
  // 🆕 New states for category sidebar
  const [categories] = useState<ServiceCategory[]>([]);
  const [selectedCategoryId] = useState<string>(categoryId || "");
  const [categoryMasterId, setCategoryMasterId] = useState<string>(categoryId || "");

  const fetchServiceIssues = useCallback(async () => {
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

      setCategoryMasterId(searchCategoryId);

      // Fetch DIRECTLY from service_services collection
      console.log(`� Querying service_services where categoryMasterId == "${searchCategoryId}"`);
      
      const servicesSnapshot = await firestore()
        .collection('service_services')
        .where('categoryMasterId', '==', searchCategoryId)

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
          // Not part of ServiceIssue type (yet), but we keep it on the object for UI use.
          description: data.description || '',
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
      
      // Combine both types of services.
      // IMPORTANT: service_services is company-specific, so the same service can appear multiple times.
      // De-dupe for UI by (category master + name).
      const allServices = dedupeServicesByCategoryAndName([
        ...directPriceServices,
        ...packageBasedServices,
      ]);
      
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
  }, [selectedCategoryId]);

  // Fetch issues when category changes
  useEffect(() => {
    if (selectedCategoryId) {
      fetchServiceIssues();
    }
  }, [fetchServiceIssues, selectedCategoryId]);

  // ✅ Remove the old hardcoded issues logic and replace with dynamic data
  const displayedIssues = useMemo(() => {
    if (!issues || !Array.isArray(issues)) return [];
    const q = searchQuery.trim().toLowerCase();
    const filtered = q.length === 0
      ? issues
      : issues.filter((s: any) => {
          const name = String(s?.name || '').toLowerCase();
          const desc = String(s?.description || '').toLowerCase();
          return name.includes(q) || desc.includes(q);
        });

    // Sort alphabetically by name
    const sorted = [...filtered].sort((a, b) => {
      const nameA = String(a?.name || '').toLowerCase();
      const nameB = String(b?.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });

    if (showAll || q.length > 0) return sorted;
    return sorted.slice(0, 5);
  }, [issues, searchQuery, showAll]);

  const hasMoreItems = issues.length > 5;

  // Add service quantity
  const addService = (id: string) => {
    setServiceQuantities(prev => ({
      ...prev,
      [id]: (prev[id] || 0) + 1
    }));
  };

  // Remove service quantity
  const removeService = (id: string) => {
    setServiceQuantities(prev => {
      const newQuantities = { ...prev };
      if (newQuantities[id] > 1) {
        newQuantities[id] -= 1;
      } else {
        delete newQuantities[id];
      }
      return newQuantities;
    });
  };

  // Get selected services with quantities
  const selectedServices = useMemo(() => {
    return Object.entries(serviceQuantities).map(([id, quantity]) => {
      const service = issues.find(issue => issue.id === id);
      return { id, quantity, service };
    }).filter(item => item.service);
  }, [serviceQuantities, issues]);

  const totalSelectedCount = useMemo(() => {
    return Object.values(serviceQuantities).reduce((sum, qty) => sum + qty, 0);
  }, [serviceQuantities]);

  const onContinue = async () => {
    if (selectedServices.length === 0) {
      Alert.alert("Select Services", "Please add at least one service.");
      return;
    }

    try {
      // Get all selected services with quantities
      const selectedIssueObjects = selectedServices.map(item => item.service!);
      
      if (selectedIssueObjects.length === 0) {
        Alert.alert("Error", "Selected services not found.");
        return;
      }

      // Check if ANY of the selected services has packages
      console.log(`🔍 Checking ${selectedIssueObjects.length} selected services for packages...`);
      
      let hasAnyPackages = false;
      
      for (const service of selectedIssueObjects) {
        const serviceDoc = await firestore()
          .collection('service_services')
          .doc(service.id)
          .get();
        
        const serviceData = serviceDoc.data();
        const hasPackages = serviceData?.packages && Array.isArray(serviceData.packages) && serviceData.packages.length > 0;
        
        if (hasPackages) {
          hasAnyPackages = true;
          console.log(`📦 Service "${service.name}" has packages`);
        }
      }

      if (hasAnyPackages) {
        // If any service has packages, show alert
        Alert.alert(
          "Package Services Selected", 
          "One or more selected services have package options. Please select services with packages separately.",
          [{ text: "OK" }]
        );
        return;
      }

  // All services are direct-price - navigate to CompanySelection first.
  // This avoids duplicate services when multiple companies provide the same service.
  console.log(`💰 Navigating to CompanySelection with ${selectedIssueObjects.length} direct-price services`);
      const serviceNames = selectedIssueObjects.map(s => s.name);

      // Ensure SelectDateTime receives per-service quantities directly on each service object.
      // This avoids ID-mismatch issues and makes duration×qty deterministic.
      const selectedIssuesWithQty = selectedServices.map((s) => ({
        ...(s.service as any),
        id: s.id,
        quantity: s.quantity,
      }));
      
      navigation.navigate("CompanySelection", {
        serviceTitle,
        // IMPORTANT: CompanySelection provider lookup for service_services expects categoryMasterId.
        // Passing the app_categories doc id would filter out all providers.
        categoryId: categoryMasterId,
        // Prefer showing providers for the *base service*.
        // CompanySelectionScreen can use these names/ids to query service_services.
        issues: serviceNames.map((n) => String(n || '').trim()).filter(Boolean),
        // IMPORTANT: `service_services` docs are company-specific. After de-duping the service list,
        // passing a single service_services doc id would incorrectly constrain CompanySelection to
        // just that one company. For singular service flow we intentionally fetch providers by
        // service name (and category) instead.
        selectedIssueIds: [],
        selectedIssues: selectedIssuesWithQty,
        serviceQuantities,
        allCategories: categories,
        fromServiceServices: true,
        isPackageBooking: false,
      });
    } catch (error) {
      console.error('Error checking service types:', error);
      Alert.alert("Error", "Failed to load service details. Please try again.");
    }
  };

  const renderItem = ({ item }: any) => {
    const quantity = serviceQuantities[item.id] || 0;
    const hasQuantity = quantity > 0;
    const desc = typeof item?.description === 'string' ? item.description.trim() : '';

    return (
      <View
        style={[styles.serviceCard, hasQuantity && styles.serviceCardSelected]}
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

          {/* Price is company-specific (service_services). Don't show it at service level. */}

          {!!desc && (
            <View style={styles.descriptionContainer}>
              <Text style={styles.serviceDescription} numberOfLines={2}>
                {desc}
              </Text>
              <Pressable
                onPress={() =>
                  setDescriptionModal({
                    visible: true,
                    title: String(item?.name || 'Service'),
                    description: desc,
                  })
                }
                hitSlop={8}
              >
                <Text style={styles.seeMoreText}>See more</Text>
              </Pressable>
            </View>
          )}
        </View>
        
        {/* Quantity Controls */}
        {!hasQuantity ? (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => addService(item.id)}
            activeOpacity={0.7}
          >
            <Text style={styles.addButtonText}>ADD</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.quantityContainer}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => removeService(item.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.quantityButtonText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.quantityText}>{quantity}</Text>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => addService(item.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.quantityButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
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
      {/* Description Modal */}
      <Modal
        visible={descriptionModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setDescriptionModal((p) => ({ ...p, visible: false }))}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setDescriptionModal((p) => ({ ...p, visible: false }))}
        >
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>{descriptionModal.title}</Text>
              <Pressable
                onPress={() => setDescriptionModal((p) => ({ ...p, visible: false }))}
                hitSlop={10}
              >
                <Text style={styles.modalCloseText}>Close</Text>
              </Pressable>
            </View>
            <Text style={styles.modalDescription}>{descriptionModal.description}</Text>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Services</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search services…"
          placeholderTextColor="#94a3b8"
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      {/* Main Content: Services Only */}
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

      {/* Bottom Continue Button */}
      {totalSelectedCount > 0 && (
        <View style={styles.bottomBar}>
          <View style={styles.bottomBarContent}>
            <View>
              <Text style={styles.itemCountText}>
                {totalSelectedCount} {totalSelectedCount === 1 ? 'item' : 'items'}
              </Text>
              <Text style={styles.serviceCountText}>
                {selectedServices.length} {selectedServices.length === 1 ? 'service' : 'services'}
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.continueBtn} 
              onPress={onContinue}
            >
              <Text style={styles.continueBtnText}>Continue</Text>
            </TouchableOpacity>
          </View>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  backButton: {
    padding: 8,
    marginLeft: -8,
  },

  headerSpacer: {
    width: 38,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
    flex: 1,
  },

  searchContainer: {
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
  },

  searchInput: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0f172a",
  },

  // Main Content Layout
  mainContent: {
    flex: 1,
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
    borderColor: "#4CAF50",
    backgroundColor: "#f0fdf4",
    elevation: 2,
  },

  // Quantity Controls (Zomato-style)
  addButton: {
    backgroundColor: "white",
    borderWidth: 1.5,
    borderColor: "#4CAF50",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 12,
  },

  addButtonText: {
    color: "#4CAF50",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  quantityContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4CAF50",
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 4,
    marginLeft: 12,
  },

  quantityButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
    borderRadius: 6,
  },

  quantityButtonText: {
    color: "#4CAF50",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 20,
  },

  quantityText: {
    color: "white",
    fontSize: 15,
    fontWeight: "700",
    marginHorizontal: 12,
    minWidth: 20,
    textAlign: "center",
  },

  servicePriceText: {
    fontSize: 14,
    color: "#4CAF50",
    fontWeight: "600",
    marginTop: 2,
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

  descriptionContainer: {
    marginTop: 6,
  },

  serviceDescription: {
    fontSize: 12,
    lineHeight: 16,
    color: "#475569",
  },

  seeMoreText: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "600",
    color: "#2563eb",
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    padding: 18,
    justifyContent: "center",
  },

  modalCard: {
    backgroundColor: "white",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },

  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  modalTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    paddingRight: 10,
  },

  modalCloseText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563eb",
  },

  modalDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: "#334155",
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

  bottomBarContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  itemCountText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },

  serviceCountText: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },

  continueBtn: {
    backgroundColor: "#4CAF50",
    paddingVertical: 14,
    paddingHorizontal: 32,
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
