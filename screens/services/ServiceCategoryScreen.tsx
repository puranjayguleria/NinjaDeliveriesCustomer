import React, { useCallback, useMemo, useState, useEffect, useRef } from "react";
import ServicesTabBar from "../../components/ServicesTabBar";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  Animated,
  Dimensions,
  Platform,
  PanResponder,
} from "react-native";

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { ServiceIssue, ServiceCategory } from "../../services/firestoreService";
import { dedupeServicesByCategoryAndName } from "../../utils/serviceDedupe";
import { firestore } from "../../firebase.native";
import { useLocationContext } from "../../context/LocationContext";

export default function ServiceCategoryScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { location } = useLocationContext();

  const { serviceTitle, categoryId } = route.params;

  console.log('ServiceCategoryScreen params:', { serviceTitle, categoryId });

  // Quantity-based states (replacing multi-select)
  const [serviceQuantities, setServiceQuantities] = useState<Record<string, number>>({});
  const [showAll, setShowAll] = useState(false);
  const [issues, setIssues] = useState<ServiceIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [zoneCompanyIdsKey, setZoneCompanyIdsKey] = useState('');
  const [zoneCompanyNamesKey, setZoneCompanyNamesKey] = useState('');
  const [zoneCompaniesLoading, setZoneCompaniesLoading] = useState(true);
  
  // Ref for FlatList to enable scrolling
  const flatListRef = React.useRef<FlatList>(null);

  // Description bottom-sheet modal
  const [descriptionModal, setDescriptionModal] = useState<{
    visible: boolean;
    title: string;
    description: string;
    imageUrl: string | null;
    itemId: string;
  }>({ visible: false, title: '', description: '', imageUrl: null, itemId: '' });

  // Bottom-sheet slide animation
  const sheetAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // Custom scrollbar state for sheet description
  const sheetScrollRef = useRef<ScrollView>(null);
  const sheetScrollIndicator = useRef(new Animated.Value(0)).current;
  const [sheetThumbHeight, setSheetThumbHeight] = useState(0);
  const [sheetIsScrollable, setSheetIsScrollable] = useState(false);
  const sheetContentH = useRef(0);
  const sheetLayoutH = useRef(0);

  const handleSheetLayout = (e: any) => {
    const h = e.nativeEvent.layout.height;
    sheetLayoutH.current = h;
    if (sheetContentH.current > 0) {
      const ratio = h / sheetContentH.current;
      setSheetThumbHeight(Math.max(30, h * ratio));
      setSheetIsScrollable(sheetContentH.current > h + 10);
    }
  };

  const handleSheetContentSize = (_: number, contentH: number) => {
    sheetContentH.current = contentH;
    if (sheetLayoutH.current > 0) {
      const ratio = sheetLayoutH.current / contentH;
      setSheetThumbHeight(Math.max(30, sheetLayoutH.current * ratio));
      setSheetIsScrollable(contentH > sheetLayoutH.current + 10);
    }
  };

  const handleSheetScroll = (e: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    if (contentSize.height <= layoutMeasurement.height) return;
    const maxScroll = contentSize.height - layoutMeasurement.height;
    const maxTravel = layoutMeasurement.height - sheetThumbHeight;
    sheetScrollIndicator.setValue((contentOffset.y / maxScroll) * maxTravel);
    // dismiss on overscroll down
    if (contentOffset.y < -50) closeSheet();
  };

  const openSheet = (item: any) => {
    const desc = typeof item?.description === 'string' ? item.description.trim() : '';
    setDescriptionModal({
      visible: true,
      title: String(item?.name || 'Service'),
      description: desc,
      imageUrl: item?.imageUrl || null,
      itemId: item?.id || '',
    });
    Animated.spring(sheetAnim, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
  };

  const closeSheet = () => {
    Animated.timing(sheetAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 280,
      useNativeDriver: true,
    }).start(() => {
      setDescriptionModal((p) => ({ ...p, visible: false }));
    });
  };

  // Drag-to-dismiss: swipe down on the sheet closes it
  const dragY = useRef(new Animated.Value(0)).current;
  const sheetPan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        gs.dy > 8 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) dragY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 80 || gs.vy > 0.5) {
          // dismiss
          Animated.timing(sheetAnim, {
            toValue: SCREEN_HEIGHT,
            duration: 260,
            useNativeDriver: true,
          }).start(() => {
            dragY.setValue(0);
            setDescriptionModal((p) => ({ ...p, visible: false }));
          });
        } else {
          // snap back
          Animated.spring(dragY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 6,
          }).start();
        }
      },
    })
  ).current;

  // 🆕 New states for category sidebar
  const [categories] = useState<ServiceCategory[]>([]);
  const [selectedCategoryId] = useState<string>(categoryId || "");
  const [categoryMasterId, setCategoryMasterId] = useState<string>(categoryId || "");

  // Load zone-specific companies
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const zid = String(location?.storeId || '').trim();
      
      if (!zid) {
        setZoneCompanyIdsKey('');
        setZoneCompanyNamesKey('');
        setZoneCompaniesLoading(false);
        return;
      }

      try {
        setZoneCompaniesLoading(true);

        // 1) Try matching by deliveryZoneId
        let snap = await firestore()
          .collection('service_company')
          .where('deliveryZoneId', '==', zid)
          .get();

        // 2) Fallback: match by deliveryZoneName
        if (snap.empty) {
          try {
            const zoneDoc = await firestore().collection('delivery_zones').doc(zid).get();
            const zoneName = String(zoneDoc.data()?.name || '').trim();
            if (zoneName) {
              snap = await firestore()
                .collection('service_company')
                .where('deliveryZoneName', '==', zoneName)
                .get();
            }
          } catch {
            // ignore
          }
        }

        if (cancelled) return;

        const ids = new Set<string>();
        const names = new Set<string>();

        snap.forEach((doc) => {
          const data = doc.data() as any;
          if (data?.isActive === false) return;

          const docId = String(doc.id || '').trim();
          if (docId) ids.add(docId);
          const dataCompanyId = String(data?.companyId || '').trim();
          if (dataCompanyId) ids.add(dataCompanyId);

          const nm = String(data?.companyName || data?.name || '').trim();
          if (nm) names.add(nm);
        });

        const zoneIdsKey = Array.from(ids).filter(Boolean).sort().join('|');
        const zoneNamesKey = Array.from(names).filter(Boolean).sort().join('|');
        
        setZoneCompanyIdsKey(zoneIdsKey);
        setZoneCompanyNamesKey(zoneNamesKey);

        console.log(`✅ Zone companies loaded: ids=${ids.size}, names=${names.size}`);
      } catch (e) {
        console.error('❌ Failed to load zone companies:', e);
      } finally {
        if (!cancelled) setZoneCompaniesLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [location?.storeId]);

  const fetchServiceIssues = useCallback(async () => {
    // Wait for zone companies to load first
    if (zoneCompaniesLoading) {
      console.log('⏳ Waiting for zone companies to load...');
      return;
    }

    try {
      setLoading(true);
      
      console.log('🔧 Fetching ALL services (both direct-price and package-based) for category:', selectedCategoryId);

      if (!selectedCategoryId) {
        console.error('No categoryId provided');
        setIssues([]);
        setLoading(false);
        return;
      }

      const zid = String(location?.storeId || '').trim();
      if (!zid) {
        console.log('❌ No zone selected');
        setIssues([]);
        setLoading(false);
        return;
      }

      // Get zone companies
      const zoneCompanyIds = zoneCompanyIdsKey
        ? zoneCompanyIdsKey.split('|').map((s) => String(s).trim()).filter(Boolean)
        : [];
      
      const zoneCompanyNames = zoneCompanyNamesKey
        ? zoneCompanyNamesKey.split('|').map((s) => String(s).trim()).filter(Boolean)
        : [];

      if (zoneCompanyIds.length === 0 && zoneCompanyNames.length === 0) {
        console.log('❌ No companies available in this zone');
        setIssues([]);
        setLoading(false);
        return;
      }

      const zoneCompanyIdSet = new Set(zoneCompanyIds);
      const zoneCompanyNameSet = new Set(zoneCompanyNames);

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
      console.log(`🔍 Querying service_services where categoryMasterId == "${searchCategoryId}"`);
      
      const servicesSnapshot = await firestore()
        .collection('service_services')
        .where('categoryMasterId', '==', searchCategoryId)
        .get();

      console.log(`� Found ${servicesSnapshot.size} total services in service_services`);

      const directPriceServices: ServiceIssue[] = [];
      const packageBasedServices: ServiceIssue[] = [];

      servicesSnapshot.forEach(doc => {
        const data = doc.data();
        
        // Check if company is active in this zone
        const companyId = String(data?.companyId || '').trim();
        const companyName = String(data?.companyName || '').trim();
        
        const isCompanyInZone = 
          (companyId && zoneCompanyIdSet.has(companyId)) ||
          (companyName && zoneCompanyNameSet.has(companyName));
        
        if (!isCompanyInZone) {
          console.log(`⏭️ Skipping service "${data.name}" - company not in zone`);
          return;
        }

        const hasPackages = data.packages && Array.isArray(data.packages) && data.packages.length > 0;
        
        console.log(`📋 Service: "${data.name}"`);
        console.log(`   - Has packages: ${hasPackages}`);
        console.log(`   - Company in zone: ✅`);
        
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
      console.log(`   - Total services (zone-filtered): ${allServices.length}`);
      
      setIssues(allServices);
      
    } catch (error) {
      console.error('Error fetching services:', error);
      
      // Set empty array on error
      setIssues([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCategoryId, location?.storeId, zoneCompanyIdsKey, zoneCompanyNamesKey, zoneCompaniesLoading]);

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
      <TouchableOpacity
        style={[styles.serviceCard, hasQuantity && styles.serviceCardSelected]}
        onPress={() => openSheet(item)}
        activeOpacity={0.75}
      >
        {/* Service Image */}
        {item.imageUrl ? (
          <Image 
            source={{ uri: item.imageUrl }} 
            style={styles.serviceImage}
            contentFit="cover"
            cachePolicy="disk"
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
              <Text style={styles.seeMoreText}>See more</Text>
            </View>
          )}
        </View>
        
        {/* Quantity Controls — stop propagation so tapping +/- doesn't open sheet */}
        {!hasQuantity ? (
          <TouchableOpacity
            style={styles.addButton}
            onPress={(e) => { e.stopPropagation?.(); addService(item.id); }}
            activeOpacity={0.7}
          >
            <Text style={styles.addButtonText}>ADD</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.quantityContainer}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={(e) => { e.stopPropagation?.(); removeService(item.id); }}
              activeOpacity={0.7}
            >
              <Text style={styles.quantityButtonText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.quantityText}>{quantity}</Text>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={(e) => { e.stopPropagation?.(); addService(item.id); }}
              activeOpacity={0.7}
            >
              <Text style={styles.quantityButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        )}
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
      {/* Description Bottom-Sheet Modal */}
      <Modal
        visible={descriptionModal.visible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeSheet}
      >
        {/* Backdrop */}
        <Pressable style={styles.sheetBackdrop} onPress={closeSheet} />

        {/* Sheet */}
        <Animated.View
          style={[
            styles.sheetContainer,
            { transform: [{ translateY: Animated.add(sheetAnim, dragY) }] },
          ]}
        >
          {/* ── Hero: full-width image with service name overlaid ── */}
          <View style={styles.sheetHero} {...sheetPan.panHandlers}>
            {/* Background image */}
            {descriptionModal.imageUrl ? (
              <Image
                source={{ uri: descriptionModal.imageUrl }}
                style={StyleSheet.absoluteFillObject as any}
                contentFit="cover"
                cachePolicy="disk"
              />
            ) : (
              <View style={styles.sheetHeroFallback}>
                <Text style={styles.sheetHeroFallbackText}>
                  {descriptionModal.title.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}

            {/* Gradient-like dark overlay so text is readable */}
            <View style={styles.sheetHeroOverlay} />

            {/* Drag pill */}
            <View style={styles.sheetHandleWrap}>
              <View style={styles.sheetHandle} />
            </View>

            {/* Close button */}
            <TouchableOpacity
              style={styles.sheetCloseBtn}
              onPress={closeSheet}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={18} color="#fff" />
            </TouchableOpacity>

            {/* Service name */}
            <Text style={styles.sheetHeroTitle} numberOfLines={3}>
              {descriptionModal.title}
            </Text>
          </View>

          {/* ── Scrollable body ── */}
          <View style={styles.sheetBodyWrapper}>
            <ScrollView
              ref={sheetScrollRef}
              style={styles.sheetBody}
              contentContainerStyle={styles.sheetBodyContent}
              showsVerticalScrollIndicator={false}
              bounces={true}
              scrollEventThrottle={16}
              onLayout={handleSheetLayout}
              onContentSizeChange={handleSheetContentSize}
              onScroll={handleSheetScroll}
              onScrollEndDrag={(e) => {
                if (e.nativeEvent.contentOffset.y < -30) closeSheet();
              }}
            >
              <Text style={styles.sheetDescLabel}>About this service</Text>
              <Text style={styles.sheetDescription}>
                {descriptionModal.description || 'No description available.'}
              </Text>
            </ScrollView>

            {/* Custom right-side scrollbar */}
            {sheetIsScrollable && (
              <View style={styles.sheetScrollbar}>
                <Animated.View
                  style={[
                    styles.sheetScrollbarThumb,
                    {
                      height: sheetThumbHeight,
                      transform: [{ translateY: sheetScrollIndicator }],
                    },
                  ]}
                />
              </View>
            )}
          </View>

          {/* ── Footer: ADD button or stepper + Continue ── */}
          <View style={styles.sheetFooter}>
            {(() => {
              const qty = serviceQuantities[descriptionModal.itemId] || 0;
              if (qty === 0) {
                return (
                  <TouchableOpacity
                    style={styles.sheetAddBtn}
                    activeOpacity={0.8}
                    onPress={() => addService(descriptionModal.itemId)}
                  >
                    <Text style={styles.sheetAddBtnText}>ADD</Text>
                  </TouchableOpacity>
                );
              }
              return (
                <View style={styles.sheetFooterRow}>
                  {/* Stepper */}
                  <View style={styles.sheetStepper}>
                    <TouchableOpacity
                      style={styles.sheetStepBtn}
                      onPress={() => removeService(descriptionModal.itemId)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.sheetStepBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.sheetStepCount}>{qty}</Text>
                    <TouchableOpacity
                      style={styles.sheetStepBtn}
                      onPress={() => addService(descriptionModal.itemId)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.sheetStepBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Continue */}
                  <TouchableOpacity
                    style={styles.sheetContinueBtn}
                    activeOpacity={0.85}
                    onPress={() => { closeSheet(); onContinue(); }}
                  >
                    <Text style={styles.sheetContinueBtnText}>Continue</Text>
                    <Ionicons name="arrow-forward" size={16} color="#fff" style={{ marginLeft: 6 }} />
                  </TouchableOpacity>
                </View>
              );
            })()}
          </View>
        </Animated.View>
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
        {(loading || zoneCompaniesLoading) ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.loadingText}>Loading services...</Text>
          </View>
        ) : displayedIssues.length === 0 && !loading && !zoneCompaniesLoading ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>
              {searchQuery.trim() ? 'No Matching Services' : 'No Services Available'}
            </Text>
            <Text style={styles.emptyText}>
              {searchQuery.trim() 
                ? 'Try adjusting your search terms.' 
                : 'No services available for this category in your area.'}
            </Text>
          </View>
        ) : displayedIssues.length > 0 ? (
          <FlatList
            ref={flatListRef}
            data={displayedIssues}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            ListFooterComponent={ListFooter}
            contentContainerStyle={{ paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
            refreshing={loading && !zoneCompaniesLoading}
            onRefresh={fetchServiceIssues}
          />
        ) : null}
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
      <ServicesTabBar activeTab="explore" />
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
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 8,
    marginHorizontal: 10,
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  serviceCardSelected: {
    borderColor: "#4CAF50",
    backgroundColor: "#f0fdf4",
    elevation: 2,
    shadowOpacity: 0.08,
    shadowColor: '#4CAF50',
  },

  // Quantity Controls (Zomato-style)
  addButton: {
    backgroundColor: "white",
    borderWidth: 1.5,
    borderColor: "#4CAF50",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 7,
    marginLeft: 8,
    shadowColor: '#4CAF50',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },

  addButtonText: {
    color: "#4CAF50",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  quantityContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4CAF50",
    borderRadius: 7,
    paddingHorizontal: 3,
    paddingVertical: 3,
    marginLeft: 8,
    shadowColor: '#4CAF50',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
  },

  quantityButton: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
    borderRadius: 5,
  },

  quantityButtonText: {
    color: "#4CAF50",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 18,
  },

  quantityText: {
    color: "white",
    fontSize: 14,
    fontWeight: "700",
    marginHorizontal: 8,
    minWidth: 16,
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
    width: 46,
    height: 46,
    borderRadius: 10,
    marginRight: 10,
    flexShrink: 0,
    backgroundColor: "#f8fafc",
  },

  serviceImagePlaceholder: {
    width: 46,
    height: 46,
    borderRadius: 10,
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dbeafe",
    flexShrink: 0,
  },

  placeholderText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2563eb",
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
    marginTop: 1,
  },

  serviceDescription: {
    fontSize: 11,
    lineHeight: 15,
    color: "#64748b",
  },

  seeMoreText: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: "700",
    color: "#2563eb",
    textDecorationLine: "underline",
  },

  // ── Bottom-sheet modal ──────────────────────────────────────────────────────
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: SCREEN_HEIGHT * 0.78,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 16,
    overflow: 'hidden',
  },

  // Hero section
  sheetHero: {
    height: 210,
    width: '100%',
    justifyContent: 'flex-end',
    backgroundColor: '#dbeafe',
  },
  sheetHeroFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetHeroFallbackText: {
    fontSize: 72,
    fontWeight: '700',
    color: '#2563eb',
    opacity: 0.25,
  },
  sheetHeroOverlay: {
    ...StyleSheet.absoluteFillObject,
    // bottom-heavy gradient simulation: transparent top → dark bottom
    backgroundColor: 'transparent',
    // We use a simple semi-transparent layer; for a real gradient use expo-linear-gradient
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  sheetHandleWrap: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  sheetCloseBtn: {
    position: 'absolute',
    top: 12,
    right: 14,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetHeroTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 26,
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 40,
    // dark-to-transparent gradient effect via background
    backgroundColor: 'rgba(0,0,0,0.18)',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // Body
  sheetBodyWrapper: {
    flexShrink: 1,
    position: 'relative',
  },
  sheetBody: {
    flexShrink: 1,
  },
  sheetBodyContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    paddingRight: 28, // leave room for scrollbar
  },
  sheetDescLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  sheetDescription: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
    fontWeight: '400',
  },
  sheetScrollbar: {
    position: 'absolute',
    right: 6,
    top: 16,
    bottom: 16,
    width: 4,
    backgroundColor: '#dcfce7',
    borderRadius: 2,
  },
  sheetScrollbarThumb: {
    width: 4,
    backgroundColor: '#4CAF50',
    borderRadius: 2,
    minHeight: 30,
  },

  // Footer
  sheetFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#fff',
  },
  sheetFooterRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  // ADD button — matches card style exactly
  sheetAddBtn: {
    backgroundColor: 'white',
    borderWidth: 1.5,
    borderColor: '#4CAF50',
    paddingHorizontal: 28,
    paddingVertical: 8,
    borderRadius: 7,
    shadowColor: '#4CAF50',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  sheetAddBtnText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  // Stepper — matches card style exactly
  sheetStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 7,
    paddingHorizontal: 3,
    paddingVertical: 3,
    shadowColor: '#4CAF50',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
  },
  sheetStepBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRadius: 5,
  },
  sheetStepBtnText: {
    color: '#4CAF50',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
  },
  sheetStepCount: {
    color: 'white',
    fontSize: 15,
    fontWeight: '700',
    marginHorizontal: 10,
    minWidth: 18,
    textAlign: 'center',
  },
  sheetContinueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 20,
    shadowColor: '#4CAF50',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
  },
  sheetContinueBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  serviceTitle: { 
    fontSize: 14, 
    fontWeight: "700", 
    color: "#0f172a",
    marginBottom: 3,
    flexWrap: "wrap",
    letterSpacing: -0.1,
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
    bottom: 60,
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

