import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  computeQuantityOfferPricing,
  getBestActiveQuantityOffer,
} from "../utils/serviceQuantityOffers";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, useNavigation, useFocusEffect } from "@react-navigation/native";
import { firestore } from "../firebase.native";
import { FirestoreService, ServiceCompany } from "../services/firestoreService";
import { useServiceCart } from "../context/ServiceCartContext";
import ServiceAddedModal from "../components/ServiceAddedModal";

export default function CompanySelectionScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { addService } = useServiceCart();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<any | null>(null);
  const [offerCelebrationText, setOfferCelebrationText] = useState<string | null>(null);
  const navInFlightRef = useRef(false);

  const getOfferPreviewText = (quantityOffers: any, qty: unknown, baseUnitPrice: unknown) => {
    if (!Array.isArray(quantityOffers) || quantityOffers.length === 0) return null;
    const q = Number(qty);
    const unitPrice = Number(baseUnitPrice);
    const safeQty = Number.isFinite(q) && q > 0 ? q : 1;
    const safeUnitPrice = Number.isFinite(unitPrice) && unitPrice > 0 ? unitPrice : 0;

    const best = getBestActiveQuantityOffer(quantityOffers, safeQty);
    if (!best) return null;

    const msg = String((best as any)?.message || '').trim();
    if (msg) return msg;

    const pricing = computeQuantityOfferPricing({
      quantity: safeQty,
      baseUnitPrice: safeUnitPrice,
      offers: quantityOffers,
    });

    const savings = pricing?.savings;
    // Fallback if message isn't provided by Firestore.
    return Number.isFinite(savings) && savings > 0 ? `Offer unlocked • Save ₹${Math.round(savings)}` : `Offer available`;
  };
  const [companies, setCompanies] = useState<ServiceCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [logoErrorIds, setLogoErrorIds] = useState<Record<string, true>>({});

  const getCompanyLogoUrl = (c: any) => {
    const raw = c?.imageUrl ?? c?.logoUrl ?? c?.photoUrl ?? c?.companyLogoUrl;
    let u = typeof raw === 'string' ? raw.trim() : '';
    if (!u) return null;

    // React Native <Image> can’t load gs:// URIs; surface it clearly in logs.
    if (/^gs:\/\//i.test(u)) return u;

    // Android often blocks cleartext HTTP by default; prefer https if possible.
    if (/^http:\/\//i.test(u)) u = u.replace(/^http:\/\//i, 'https://');

    return u;
  };

  // Log the raw/resolved logo URLs whenever the companies list changes.
  useEffect(() => {
    if (!Array.isArray(companies) || companies.length === 0) return;
    console.log('🖼️ Company logos (debug):', companies.map((c: any) => ({
      id: c?.id,
      companyId: c?.companyId,
      name: c?.companyName,
      raw: c?.imageUrl ?? c?.logoUrl,
      resolved: getCompanyLogoUrl(c),
    })));
  }, [companies]);

  // When service_services documents don't include a `price` in the objects passed via navigation,
  // we fetch the authoritative `price` by id so cart totals don't end up as ₹0.
  const [pricedSelectedIssues, setPricedSelectedIssues] = useState<any[] | null>(null);

  const { 
    serviceTitle, 
    categoryId, 
    issues, 
    selectedIssueIds, 
    selectedIssues, 
    selectedDate, 
    selectedTime, 
    selectedDateFull,
    fromServiceServices,
    isPackageBooking,
    selectedPackage: routeSelectedPackage,
    selectedCompanyId: routeSelectedCompanyId,
    serviceQuantities,
    selectedSlots,
    startSlot,
  } = route.params || {};

  const effectiveSelectedPackage = selectedPackage || routeSelectedPackage;

  // When coming back from SelectDateTime in package flow, preselect the chosen company
  // so user doesn't have to tap it again.
  useEffect(() => {
    if (isPackageBooking === true && typeof routeSelectedCompanyId === 'string' && routeSelectedCompanyId) {
      setSelectedCompanyId(routeSelectedCompanyId);
    }
  }, [isPackageBooking, routeSelectedCompanyId]);

  // Package flow UX: show a single list of (company + package + price) options,
  // so user doesn't have to pick a company in a separate step.
  type PackageOption = { id: string; company: ServiceCompany; pkg: any };
  const packageOptions: PackageOption[] = (isPackageBooking === true)
    ? companies.flatMap((company) => {
        const pkgs = (company as any).packages;
        if (!Array.isArray(pkgs) || pkgs.length === 0) return [];
        return pkgs.map((pkg: any) => {
          const pkgId = String(pkg?.id ?? pkg?.name ?? 'pkg');
          return {
            id: `${company.id}::${pkgId}`,
            company,
            pkg,
          };
        });
      })
    : [];

  useEffect(() => {
    let isActive = true;

    const enrichSelectedIssuesWithPrices = async () => {
      try {
        if (!Array.isArray(selectedIssueIds) || selectedIssueIds.length === 0) {
          if (isActive) setPricedSelectedIssues(Array.isArray(selectedIssues) ? selectedIssues : null);
          return;
        }

        const snaps = await Promise.all(
          selectedIssueIds.map((id: string) =>
            firestore().collection('service_services').doc(id).get()
          )
        );

        const priceMap = new Map<string, { price?: number; name?: string }>();
        snaps.forEach((snap: any) => {
          if (!snap?.exists) return;
          const data: any = snap.data() || {};
          const priceCandidate =
            typeof data.price === 'number' ? data.price :
            (typeof data.amount === 'number' ? data.amount :
            (typeof data.basePrice === 'number' ? data.basePrice :
            (typeof data.servicePrice === 'number' ? data.servicePrice : undefined)));
          priceMap.set(snap.id, { price: priceCandidate, name: data.name });
        });

        // If selectedIssues is missing ids (or has incomplete data), we still create a priced list
        // based on selectedIssueIds so we can always recover Firestore prices.
        const baseIssues = Array.isArray(selectedIssues) && selectedIssues.length > 0
          ? selectedIssues
          : [];

        const enrichedFromIds = selectedIssueIds.map((id: string) => {
          const existing = baseIssues.find((x: any) => x?.id === id);
          const mapped = priceMap.get(id);
          return {
            ...(existing || {}),
            id,
            name: existing?.name ?? mapped?.name,
            price: (typeof existing?.price === 'number' ? existing.price : mapped?.price),
          };
        });

        const enriched = enrichedFromIds.length > 0 ? enrichedFromIds : baseIssues;

        if (isActive) setPricedSelectedIssues(enriched);
      } catch (e) {
        console.log('⚠️ Failed to enrich selectedIssues with prices:', e);
        if (isActive) setPricedSelectedIssues(Array.isArray(selectedIssues) ? selectedIssues : null);
      }
    };

    enrichSelectedIssuesWithPrices();
    return () => {
      isActive = false;
    };
  }, [selectedIssueIds, selectedIssues]);

  // 🔍 DEBUG: Log all params on mount
  useEffect(() => {
    console.log('🚀 ========== CompanySelectionScreen MOUNTED ==========');
    console.log('📋 All Route Params:', JSON.stringify(route.params, null, 2));
    console.log('📋 Extracted Params:', {
      serviceTitle,
      categoryId,
      issues,
      selectedIssueIds,
      selectedIssues: selectedIssues?.map((s: any) => ({ id: s.id, name: s.name })),
      selectedDate,
      selectedTime,
      fromServiceServices,
      isPackageBooking,
      hasRouteSelectedPackage: !!routeSelectedPackage
    });
    console.log('========================================\n');
  }, [categoryId, fromServiceServices, isPackageBooking, issues, route.params, routeSelectedPackage, selectedDate, selectedIssueIds, selectedIssues, selectedTime, serviceTitle]);

  // NOTE: Effects that call `fetchServiceCompanies` are declared after the callback is defined
  // to avoid “used before declaration” errors.

  // Check if a company has active workers
  const checkCompanyHasActiveWorkers = async (companyId: string): Promise<boolean> => {
    try {
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
  const checkRealTimeAvailability = useCallback(async (companyId: string, date: string, time: string, serviceIds?: string[]): Promise<boolean> => {
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
  }, [selectedIssueIds, serviceTitle]);

  // --- Performance helpers (bounded concurrency + per-selection caching) ---
  const pLimit = <T,>(concurrency: number) => {
    let activeCount = 0;
    const queue: (() => void)[] = [];

    const next = () => {
      activeCount--;
      const run = queue.shift();
      if (run) run();
    };

    return (fn: () => Promise<T>): Promise<T> =>
      new Promise<T>((resolve, reject) => {
        const run = () => {
          activeCount++;
          fn()
            .then(resolve)
            .catch(reject)
            .finally(next);
        };

        if (activeCount < concurrency) run();
        else queue.push(run);
      });
  };

  const selectionKey = `${selectedDate || ''}|${selectedTime || ''}|${(selectedIssueIds || []).join(',')}|${serviceTitle || ''}`;
  const activeWorkersCacheRef = useRef(new Map<string, boolean>());
  const availabilityCacheRef = useRef(new Map<string, boolean>());

  useEffect(() => {
    activeWorkersCacheRef.current.clear();
    availabilityCacheRef.current.clear();
  }, [selectionKey]);

  const checkCompanyHasActiveWorkersCached = useCallback(async (companyId: string): Promise<boolean> => {
    const cached = activeWorkersCacheRef.current.get(companyId);
    if (typeof cached === 'boolean') return cached;
    const has = await checkCompanyHasActiveWorkers(companyId);
    activeWorkersCacheRef.current.set(companyId, has);
    return has;
  }, []);

  const checkRealTimeAvailabilityCached = useCallback(
    async (companyId: string, date: string, time: string, serviceIds?: string[]): Promise<boolean> => {
      const idsKey = (serviceIds || selectedIssueIds || []).join(',');
      const key = `${companyId}|${date}|${time}|${idsKey}`;
      const cached = availabilityCacheRef.current.get(key);
      if (typeof cached === 'boolean') return cached;
      const ok = await checkRealTimeAvailability(companyId, date, time, serviceIds);
      availabilityCacheRef.current.set(key, ok);
      return ok;
    },
    [checkRealTimeAvailability, selectedIssueIds]
  );

  // Filter companies that have active workers and are available for the selected time
  const filterCompaniesWithAvailability = useCallback(async (companies: ServiceCompany[], checkTimeSlot: boolean = false): Promise<ServiceCompany[]> => {
    if (!checkTimeSlot || !selectedDate || !selectedTime) {
      // If not checking time slots, use the old logic for backward compatibility
      const availableCompanies: ServiceCompany[] = [];
      
      for (const company of companies) {
        const companyId = company.companyId || company.id;
        
        // Check if company has any active workers
        const hasActiveWorkers = await checkCompanyHasActiveWorkersCached(companyId);
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

    // For predefined/direct-price services, SelectDateTime now sends an auto-generated contiguous
    // block of slots (based on accumulated duration/quantity). We validate the company is
    // available for ALL of them.
    const multiSlotPairs: { date: string; time: string }[] =
      (isPackageBooking === true)
        ? []
        : (Array.isArray(selectedSlots) ? selectedSlots : []);
    
    // Use new slot-based availability system
    if (__DEV__) {
      console.log(`🎯 Using slot-based availability for ${selectedDate} at ${selectedTime}`);
      console.log(`🔍 Service filtering details:`, {
        serviceTitle,
        selectedIssues: Array.isArray(selectedIssues) ? selectedIssues.map(s => s.name || s) : selectedIssues,
        issues: Array.isArray(issues) ? issues : [issues],
        selectedIssueIds,
        routeParams: { serviceTitle, categoryId, issues, selectedIssueIds, selectedIssues }
      });
    }
    
    // Determine the exact service name to use for worker filtering
    const exactServiceName = (Array.isArray(selectedIssues) && selectedIssues.length > 0 && selectedIssues[0].name) 
      ? selectedIssues[0].name 
      : (Array.isArray(issues) && issues.length > 0 ? issues[0] : serviceTitle);
    
    if (__DEV__) {
      console.log(`🎯 Using exact service name for worker filtering: "${exactServiceName}"`);
    }
    
    try {
      // If a slot-block is present (predefined services), we require a company to be available for ALL.
      // The existing helper `getCompaniesWithSlotAvailability` only supports a single (date,time), so we bypass it.
      if (multiSlotPairs.length > 0) {
        const requiredPairs = multiSlotPairs;

        const limit = pLimit(6);
        const results = await Promise.all(
          companies.map(company =>
            limit(async () => {
              const companyId = company.companyId || company.id;
              const hasActiveWorkers = await checkCompanyHasActiveWorkersCached(companyId);
              if (!hasActiveWorkers) return null;

              const slotLimit = pLimit(4);
              const checks = await Promise.all(
                requiredPairs.map(pair =>
                  slotLimit(() =>
                    checkRealTimeAvailabilityCached(companyId, pair.date, pair.time, selectedIssueIds)
                  )
                )
              );

              if (!checks.every(Boolean)) return null;

              return {
                ...company,
                availability: `Available for ${requiredPairs.length} slot block`,
              } as ServiceCompany;
            })
          )
        );

        return results.filter(Boolean) as ServiceCompany[];
      }

      const companiesWithSlotAvailability = await FirestoreService.getCompaniesWithSlotAvailability(
        categoryId,
        selectedIssueIds,
        selectedDate,
        selectedTime,
        exactServiceName, // Pass the exact service name for precise worker filtering
        fromServiceServices // Pass the data source flag
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
        const hasActiveWorkers = await checkCompanyHasActiveWorkersCached(companyId);
        
        // Only show companies that have active workers (no busy workers shown)
        if (hasActiveWorkers) {
          // Additional check: verify workers are actually available for the time slot
          if (selectedDate && selectedTime) {
            const exactServiceName = (Array.isArray(selectedIssues) && selectedIssues.length > 0 && selectedIssues[0].name) 
              ? selectedIssues[0].name 
              : (Array.isArray(issues) && issues.length > 0 ? issues[0] : serviceTitle);
            
            if (__DEV__) {
              console.log(`🔍 Fallback check using service name: "${exactServiceName}"`);
            }
            
            // If multi-slot flow, require all selected pairs; else just the single selectedDate/selectedTime.
            const requiredPairs = (multiSlotPairs.length > 0)
              ? multiSlotPairs
              : [{ date: selectedDate, time: selectedTime }];

            let okForAll = true;
            for (const pair of requiredPairs) {
              const ok = await checkRealTimeAvailabilityCached(companyId, pair.date, pair.time, selectedIssueIds);
              if (!ok) {
                okForAll = false;
                break;
              }
            }

            const isAvailableAtTime = okForAll;
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
  }, [categoryId, checkCompanyHasActiveWorkersCached, checkRealTimeAvailabilityCached, fromServiceServices, isPackageBooking, issues, selectedDate, selectedIssueIds, selectedIssues, selectedSlots, selectedTime, serviceTitle]);

  const fetchServiceCompanies = useCallback(async () => {
    try {
      setLoading(true);
      console.log('🏢 ========== FETCHING COMPANIES ==========');
      console.log('🏢 Service Title:', serviceTitle);
      console.log('🏢 Category ID:', categoryId);
      console.log('🏢 Selected Issue IDs:', selectedIssueIds);
      console.log('🏢 Issues:', issues);
      console.log('🏢 All Route Params:', JSON.stringify(route.params, null, 2));
      
      let fetchedCompanies: ServiceCompany[];
      
      // Check if this is from service_services collection (both packages and direct-price)
      const fromServiceServices = route.params?.fromServiceServices === true;
      
      console.log('🔍 ========== ROUTE PARAMS CHECK ==========');
      console.log('🔍 fromServiceServices:', fromServiceServices);
      console.log('🔍 fromServiceServicesRaw:', route.params?.fromServiceServices);
      console.log('🔍 hasIssues:', !!issues);
      console.log('🔍 issuesLength:', issues?.length);
      console.log('🔍 issuesValue:', issues);
      console.log('🔍 hasSelectedIssueIds:', !!selectedIssueIds);
      console.log('🔍 selectedIssueIdsLength:', selectedIssueIds?.length);
      console.log('🔍 selectedIssueIdsValue:', selectedIssueIds);
      
      if (fromServiceServices) {
        console.log('✅ ========== USING SERVICE_SERVICES FLOW ==========');
        console.log('✅ This is from service_services collection');
        
        // For services from service_services, we need to use service IDs
        if (selectedIssueIds && selectedIssueIds.length > 0) {
          console.log('🏢 Strategy: Using service IDs:', selectedIssueIds);
          console.log('🏢 Calling: FirestoreService.getCompaniesByServiceIds()');
          // Fetch companies by service IDs from service_services
          fetchedCompanies = await FirestoreService.getCompaniesByServiceIds(selectedIssueIds, categoryId);
          console.log('🏢 Result: Got', fetchedCompanies.length, 'companies');
        } else if (issues && issues.length > 0) {
          console.log('🏢 Strategy: Using service names (fallback):', issues);
          console.log('🏢 Calling: FirestoreService.getCompaniesByServiceNames()');
          // Fallback: fetch by service names
          const validCategoryId = categoryId && categoryId.trim() !== '' ? categoryId : undefined;
          fetchedCompanies = await FirestoreService.getCompaniesByServiceNames(issues, validCategoryId);
          console.log('🏢 Result: Got', fetchedCompanies.length, 'companies');
        } else {
          console.error('❌ ERROR: No service IDs or names provided');
          console.error('❌ Cannot fetch companies without service identifiers');
          fetchedCompanies = [];
        }
      } else {
        console.log('❌ ========== USING OLD FLOW (APP_SERVICES) ==========');
        console.log('❌ This is from app_services collection (legacy)');
        
        if (selectedIssueIds && selectedIssueIds.length > 0) {
          console.log('🏢 Strategy: Fetching companies with detailed packages by selected issue IDs:', selectedIssueIds);
          console.log('🏢 Calling: FirestoreService.getCompaniesWithDetailedPackages()');
          // For app_services (old flow)
          fetchedCompanies = await FirestoreService.getCompaniesWithDetailedPackages(selectedIssueIds);
          console.log('🏢 Result: Got', fetchedCompanies.length, 'companies');
        } else if (categoryId) {
          console.log('🏢 Strategy: Fetching companies by category ID:', categoryId);
          console.log('🏢 Calling: FirestoreService.getCompaniesByCategory()');
          // Fetch companies that provide services in this category
          fetchedCompanies = await FirestoreService.getCompaniesByCategory(categoryId);
          console.log('🏢 Result: Got', fetchedCompanies.length, 'companies (before enhancement)');
          // Enhance with detailed packages
          console.log('🏢 Enhancing with detailed packages...');
          fetchedCompanies = await FirestoreService.getDetailedPackagesForCompanies(fetchedCompanies);
          console.log('🏢 Result: Got', fetchedCompanies.length, 'companies (after enhancement)');
        } else {
          console.log('🏢 Strategy: Fetching all companies as fallback');
          console.log('🏢 Calling: FirestoreService.getServiceCompanies()');
          // Fallback to all companies
          fetchedCompanies = await FirestoreService.getServiceCompanies();
          console.log('🏢 Result: Got', fetchedCompanies.length, 'companies (before enhancement)');
          // Enhance with detailed packages
          console.log('🏢 Enhancing with detailed packages...');
          fetchedCompanies = await FirestoreService.getDetailedPackagesForCompanies(fetchedCompanies);
          console.log('🏢 Result: Got', fetchedCompanies.length, 'companies (after enhancement)');
        }
      }
      
      console.log(`\n🏢 ========== INITIAL FETCH COMPLETE ==========`);
      console.log(`🏢 Found ${fetchedCompanies.length} companies BEFORE filtering:`, 
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
      
      // Sort packages within each company: monthly first, then weekly, then others
      fetchedCompanies = fetchedCompanies.map(company => {
        if (company.packages && Array.isArray(company.packages) && company.packages.length > 0) {
          const sortedPackages = [...company.packages].sort((a, b) => {
            const aName = (typeof a === 'string' ? a : a.name || '').toLowerCase();
            const bName = (typeof b === 'string' ? b : b.name || '').toLowerCase();
            
            // Priority order: monthly (1), weekly (2), others (3)
            const getPriority = (name: string) => {
              if (name.includes('monthly') || name.includes('month')) return 1;
              if (name.includes('weekly') || name.includes('week')) return 2;
              return 3;
            };
            
            const aPriority = getPriority(aName);
            const bPriority = getPriority(bName);
            
            return aPriority - bPriority;
          });
          
          return {
            ...company,
            packages: sortedPackages
          };
        }
        return company;
      });
      
      console.log(`📦 ========== SORTING PACKAGES ==========`);
      console.log(`📦 Packages sorted by frequency (monthly, weekly first)`);
      
      // Filter companies to only show those with active workers and check slot availability
      console.log(`\n🔍 ========== FILTERING FOR AVAILABILITY ==========`);
      console.log(`🔍 Selected Date: ${selectedDate}`);
      console.log(`🔍 Selected Time: ${selectedTime}`);
      console.log(`🔍 Will check slot-based availability: ${!!selectedDate && !!selectedTime}`);
      
      const companiesWithActiveWorkers = await filterCompaniesWithAvailability(fetchedCompanies, true); // Enable time slot checking
      
      console.log(`\n✅ ========== FINAL RESULT ==========`);
      console.log(`✅ After filtering: ${companiesWithActiveWorkers.length} companies with worker availability:`, 
        companiesWithActiveWorkers.map(c => ({ 
          id: c.id, 
          companyName: c.companyName,
          serviceName: c.serviceName,
          companyId: c.companyId,
          availability: c.availability
        }))
      );
      console.log(`✅ ========== COMPANIES SET TO STATE ==========\n`);
      
      setCompanies(companiesWithActiveWorkers);
    } catch (error) {
      console.error('❌ ========== ERROR FETCHING COMPANIES ==========');
      console.error('❌ Error details:', error);
      console.error('❌ Error message:', error instanceof Error ? error.message : 'Unknown error');
      console.error('❌ ========================================\n');
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, [categoryId, filterCompaniesWithAvailability, issues, route.params, selectedDate, selectedIssueIds, selectedTime, serviceTitle]);

  // Fetch companies from Firestore based on selected issues
  useEffect(() => {
    // Validate required params
    if (!serviceTitle) {
      console.error('❌ Missing required param: serviceTitle');
      setLoading(false);
      return;
    }

    if (!selectedIssueIds?.length && !issues?.length && !categoryId) {
      console.error('❌ Missing required params: Need at least one of selectedIssueIds, issues, or categoryId');
      setLoading(false);
      return;
    }

    fetchServiceCompanies();
  }, [categoryId, fetchServiceCompanies, issues?.length, selectedIssueIds, serviceTitle]);

  // Refresh loop guard:
  // We already fetch on mount/param-change via the useEffect above.
  // Calling fetch again on focus causes duplicate calls and can look like a loop
  // when SelectDateTime navigates back here.
  useFocusEffect(
    useCallback(() => {
      // reset package selection when screen refocuses
      setSelectedPackage(null);
    }, [])
  );

  const selectedCompany = companies.find(c => c.id === selectedCompanyId);

  const selectCompany = () => {
    // In the new package flow we rely on selectedCompanyId + selectedPackage.
    // Resolve selectedCompany from the id so this works even if selectedCompany isn't derived yet.
    const resolvedCompany = selectedCompany || companies.find(c => c.id === selectedCompanyId);
    if (!resolvedCompany) return;

    // ✅ Singular service flow fix:
    // For NON-package services, after picking a company/provider we must show the slot screen.
    // We pass the chosen `service_services` document id (resolvedCompany.id).
    if (isPackageBooking !== true) {
      (navigation as any).navigate('SelectDateTime', {
        ...route.params,
        fromServiceServices: true,
        isPackageBooking: false,
        selectedIssueIds: [resolvedCompany.id],
        // Keep these for downstream UI/cart and for cases where SelectDateTime needs context.
        // IMPORTANT: pass the real company id (service_company doc id) for downstream cart/worker checks.
        selectedCompanyId: resolvedCompany.companyId,
        // Also pass the full object so SelectDateTime can add to cart without re-fetch.
        selectedCompany: resolvedCompany,
      });
      return;
    }
    
  // Determine booking type based on service title
    let bookingType: 'electrician' | 'plumber' | 'cleaning' | 'health' | 'dailywages' | 'carwash' = 'electrician';
    const lowerTitle = serviceTitle?.toLowerCase() || '';
    
    if (lowerTitle.includes('plumber')) bookingType = 'plumber';
    else if (lowerTitle.includes('cleaning')) bookingType = 'cleaning';
    else if (lowerTitle.includes('health')) bookingType = 'health';
    else if (lowerTitle.includes('daily') || lowerTitle.includes('wages')) bookingType = 'dailywages';
    else if (lowerTitle.includes('car') || lowerTitle.includes('wash')) bookingType = 'carwash';

    // Calculate price: if this is a package booking, ALWAYS take it from selected package.
    // Otherwise use selected issues total (or company.price fallback).
    const packageInfo = isPackageBooking ? effectiveSelectedPackage : null;

    // 🔧 FIX: Store issues with their individual prices and quantities
    const issuesSource = (Array.isArray(pricedSelectedIssues) && pricedSelectedIssues.length > 0)
      ? pricedSelectedIssues
      : selectedIssues;

    const issuesWithPrices = Array.isArray(issuesSource) && issuesSource.length > 0
      ? issuesSource.map((issue: any) => ({
          name: issue.name || issue,
          // Some service_services docs don't have price on each issue; fallback to company price
          // so the cart never shows ₹0 incorrectly.
          price: typeof issue.price === 'number'
            ? issue.price
            : (typeof resolvedCompany?.price === 'number' ? resolvedCompany.price : 0),
          quantity: 1, // Initialize with quantity 1
        }))
      : (Array.isArray(issues) ? issues : [issues]).filter(Boolean).map((issue: any) => ({
          name: typeof issue === 'string' ? issue : issue.name || issue,
          price: typeof issue === 'object' && typeof issue.price === 'number' ? issue.price : (resolvedCompany?.price || 0),
          quantity: 1, // Initialize with quantity 1
        }));

    const issueTotalPrice = issuesWithPrices.reduce(
      (sum: number, issue: any) => sum + (Number(issue.price) || 0) * (Number(issue.quantity) || 1),
      0
    );

    const packagePrice = Number((packageInfo as any)?.price);
    // For non-package services, offers are typically applied per-unit on the *base service price*.
    // `issueTotalPrice` can represent a one-time aggregate across selected issues, which would make
    // per-unit discounts look like they aren't being deducted correctly.
    const baseServiceUnitPrice = typeof resolvedCompany?.price === 'number' ? resolvedCompany.price : 0;
    const computedPrice = (isPackageBooking && Number.isFinite(packagePrice) && packagePrice > 0)
      ? packagePrice
      : (baseServiceUnitPrice > 0 ? baseServiceUnitPrice : (issueTotalPrice > 0 ? issueTotalPrice : 0));

    // Add service to cart (include package info when available)
    // Quantity offers should be company-specific.
    // In our data model they're stored on service_services docs, which already encode (serviceId + companyId).
    const rawQuantityOffers = (packageInfo as any)?.quantityOffers || (resolvedCompany as any)?.quantityOffers || null;
    const bestOffer = rawQuantityOffers
      ? getBestActiveQuantityOffer(rawQuantityOffers, Number(serviceQuantities ?? 1))
      : null;

    const selectedQty = Math.max(
      1,
      Number(
        (serviceQuantities as any)?.[(Array.isArray(selectedIssueIds) && selectedIssueIds[0]) ? selectedIssueIds[0] : resolvedCompany.id]
      ) || 1
    );

    addService({
      // For package bookings, serviceTitle is the category (e.g. "Home GYM"). Keep it for display,
      // but make sure the actual package price is included below.
      serviceTitle,
      categoryId, // Add categoryId for add-on services filtering
      issues: issuesWithPrices, // Store issues with prices
      company: {
        id: resolvedCompany.id,
        companyId: resolvedCompany.companyId || resolvedCompany.id,
        name: resolvedCompany.companyName || resolvedCompany.serviceName,
        price: resolvedCompany.price,
        rating: resolvedCompany.rating,
        verified: resolvedCompany.isActive,
      },
      selectedDate: selectedDate,
      selectedTime: selectedTime,
      bookingType,
      unitPrice: computedPrice,
      totalPrice: computedPrice,
  quantity: selectedQty,
      additionalInfo: {
        ...(packageInfo ? {
          isPackageService: true,
          packageName: (packageInfo as any)?.name,
          packageType: (packageInfo as any)?.type,
          packageDuration: (packageInfo as any)?.duration,
          packageFeatures: (packageInfo as any)?.features,
          package: {
            id: (packageInfo as any)?.id,
            name: (packageInfo as any)?.name,
            price: (packageInfo as any)?.price,
            description: (packageInfo as any)?.description,
            duration: (packageInfo as any)?.duration,
            unit: (packageInfo as any)?.unit,
            frequency: (packageInfo as any)?.frequency,
            type: (packageInfo as any)?.type,
          },
        } : {}),

        // Service-flow accumulated block (used for quantity/duration scheduling)
        ...(isPackageBooking ? {} : {
          serviceQuantities: serviceQuantities || null,
          startSlot: startSlot || null,
          selectedSlots: Array.isArray(selectedSlots) ? selectedSlots : null,
        }),

        // Quantity offers (stored on service_services documents).
        // We keep the raw offers so the cart can compute the best eligible offer when quantity changes.
        // Also persist the chosen base unit so offer calculations can't drift if other totals change.
        baseOfferUnitPrice: computedPrice,
        quantityOffers: rawQuantityOffers,
      },
    });

    // Show success modal instead of Alert
    if (bestOffer) {
      const msg = String((bestOffer as any)?.message || '').trim();
      setOfferCelebrationText(msg || 'Offer applied!');
    } else {
      setOfferCelebrationText(null);
    }
    setShowSuccessModal(true);
    // Reset package selection after adding
    setSelectedPackage(null);
  }; 

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerSection}>
        <Text style={styles.header}>Select Service Company </Text>
      </View>

      {/* Main Content: Companies List */}
      <View style={styles.companiesContainer}>
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
                {selectedDate && selectedTime 
                  ? 'No service providers are available for the selected time slot. Please try choosing a different slot.'
                  : 'No service providers found for this service. Please check back later or try a different service.'
                }
                {'\n'}
              </Text>
              
              <View style={styles.emptyActions}>
                {selectedDate && selectedTime && (
                  <TouchableOpacity 
                    style={styles.retryButton}
                    onPress={() => navigation.goBack()}
                  >
                    <Text style={styles.retryText}>Choose Different Slot</Text>
                  </TouchableOpacity>
                )}
                
                <TouchableOpacity 
                  style={[styles.retryButton, styles.retryButtonSecondary]}
                  onPress={fetchServiceCompanies}
                >
                  <Text style={[styles.retryText, styles.retryTextSecondary]}>Retry</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : isPackageBooking === true ? (
            <FlatList
              data={packageOptions}
              keyExtractor={(opt) => opt.id}
              renderItem={({ item: opt }) => {
                const company = opt.company;
                const pkgObj = opt.pkg;
                const isSelected = selectedCompanyId === company.id && (
                  (effectiveSelectedPackage as any)?.id === pkgObj?.id ||
                  (effectiveSelectedPackage as any)?.name === pkgObj?.name
                );
                const isBusy = (company as any).isBusy === true;

                return (
                  <TouchableOpacity
                    style={[
                      styles.providerCard,
                      isSelected && styles.providerCardSelected,
                      isBusy && styles.providerCardBusy,
                    ]}
                    activeOpacity={isBusy ? 0.3 : 0.7}
                    disabled={isBusy}
                    onPress={() => {
                      if (isBusy) return;
                      if (navInFlightRef.current) return;
                      navInFlightRef.current = true;
                      setSelectedCompanyId(company.id);
                      setSelectedPackage(pkgObj);
                      // Ensure company details render on the slot screen.
                      // (We already have company data here; pass it through.)
                      navigation.replace("SelectDateTime", {
                        serviceTitle,
                        categoryId,
                        issues,
                        selectedIssueIds,
                        selectedIssues,
                        fromServiceServices,
                        isPackageBooking: true,
                        selectedPackage: pkgObj,
                        selectedCompanyId: company.id,
                        selectedCompany: company,
                      });
                    }}
                  >
                    <View style={styles.providerHeader}>
                      <View style={styles.providerTitleRow}>
                        {getCompanyLogoUrl(company) && !logoErrorIds[company.id] ? (
                          <Image
                            source={{ uri: getCompanyLogoUrl(company) as string }}
                            style={styles.companyLogo}
                            resizeMode="contain"
                            onError={() => setLogoErrorIds((p) => ({ ...p, [company.id]: true }))}
                          />
                        ) : (
                          <View style={styles.companyLogoPlaceholder}>
                            <Text style={styles.companyLogoText}>
                              {(company.companyName || company.serviceName).charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.providerName}>{company.companyName || company.serviceName}</Text>
                          {(typeof (company as any)?.description === 'string' && String((company as any).description).trim().length > 0) ? (
                            <Text style={styles.companyDescription} numberOfLines={2}>
                              {String((company as any).description).trim()}
                            </Text>
                          ) : null}
                          <Text style={styles.packageOptionName} numberOfLines={1}>
                            {pkgObj?.name ?? 'Package'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.priceSection}>
                      <Text style={styles.priceLabel}>Package Price</Text>
                      <Text style={styles.priceValue}>₹{pkgObj?.price ?? company.price}</Text>
                    </View>

                    {pkgObj?.description ? (
                      <Text style={styles.packageOptionDesc} numberOfLines={2}>
                        {pkgObj.description}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              }}
              contentContainerStyle={{ paddingBottom: 120 }}
              showsVerticalScrollIndicator={false}
            />
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
                  <View style={styles.providerTitleRow}>
                    {/* Company Logo */}
                    {getCompanyLogoUrl(item) && !logoErrorIds[item.id] ? (
                      <Image 
                        source={{ uri: getCompanyLogoUrl(item) as string }} 
                        style={styles.companyLogo}
                        resizeMode="contain"
                        onError={() => setLogoErrorIds((p) => ({ ...p, [item.id]: true }))}
                      />
                    ) : (
                      <View style={styles.companyLogoPlaceholder}>
                        <Text style={styles.companyLogoText}>
                          {(item.companyName || item.serviceName).charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.providerName}>{item.companyName || item.serviceName}</Text>
                  </View>
                  {(typeof (item as any)?.description === 'string' && String((item as any).description).trim().length > 0) ? (
                    <Text style={styles.companyDescription} numberOfLines={2}>
                      {String((item as any).description).trim()}
                    </Text>
                  ) : null}
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
                       {item.packages?.length || 0} Package{(item.packages?.length || 0) > 1 ? 's' : ''} Available
                    </Text>
                    
                    {isSelected && (
                      <View style={styles.packageGrid}>
                        {item.packages?.map((pkg: any, idx: number) => {
                          const pkgObj = typeof pkg === 'string' 
                            ? { id: `${item.id}_pkg_${idx}`, name: pkg, price: item.price || 0 } 
                            : pkg;
                          const isPkgSelected = selectedPackage && selectedPackage.id === pkgObj.id;
                          
                          // 🔍 DEBUG: Log package data to verify unit field
                          console.log(`📦 Package ${idx} data:`, {
                            name: pkgObj.name,
                            price: pkgObj.price,
                            unit: pkgObj.unit,
                            frequency: pkgObj.frequency,
                            type: pkgObj.type,
                            fullObject: pkgObj
                          });
                          
                          // Determine frequency type from package data
                          // Priority: 1. unit field, 2. frequency field, 3. type field, 4. name parsing
                          let frequencyBadge = null;
                          let frequencyColor = '#64748b';
                          
                          // Check if package has explicit unit, frequency or type field
                          const explicitFrequency = pkgObj.unit || pkgObj.frequency || pkgObj.type || pkgObj.subscriptionType;
                          const duration = pkgObj.duration; // Get duration (e.g., 2, 3, 6, 12)
                          
                          console.log(`🔍 Frequency detection for "${pkgObj.name}":`, {
                            explicitFrequency,
                            duration,
                            unit: pkgObj.unit,
                            frequency: pkgObj.frequency,
                            type: pkgObj.type
                          });
                          
                          if (explicitFrequency) {
                            const freqLower = explicitFrequency.toLowerCase();
                            if (freqLower.includes('month')) {
                              // Show duration if available (e.g., "3 Months")
                              if (duration && typeof duration === 'number' && duration > 0) {
                                frequencyBadge = duration === 1 ? '1 Month' : `${duration} Months`;
                              } else {
                                frequencyBadge = 'Monthly';
                              }
                              frequencyColor = '#8b5cf6';
                            } else if (freqLower.includes('week')) {
                              if (duration && typeof duration === 'number' && duration > 0) {
                                frequencyBadge = duration === 1 ? '1 Week' : `${duration} Weeks`;
                              } else {
                                frequencyBadge = 'Weekly';
                              }
                              frequencyColor = '#3b82f6';
                            } else if (freqLower.includes('day')) {
                              if (duration && typeof duration === 'number' && duration > 0) {
                                frequencyBadge = duration === 1 ? '1 Day' : `${duration} Days`;
                              } else {
                                frequencyBadge = 'Daily';
                              }
                              frequencyColor = '#10b981';
                            } else if (freqLower.includes('year') || freqLower.includes('annual')) {
                              if (duration && typeof duration === 'number' && duration > 0) {
                                frequencyBadge = duration === 1 ? '1 Year' : `${duration} Years`;
                              } else {
                                frequencyBadge = 'Yearly';
                              }
                              frequencyColor = '#f59e0b';
                            }
                          } else {
                            // Fallback: parse from package name
                            const pkgName = (pkgObj.name || '').toLowerCase();
                            if (pkgName.includes('monthly') || pkgName.includes('month')) {
                              frequencyBadge = 'Monthly';
                              frequencyColor = '#8b5cf6';
                            } else if (pkgName.includes('weekly') || pkgName.includes('week')) {
                              frequencyBadge = 'Weekly';
                              frequencyColor = '#3b82f6';
                            } else if (pkgName.includes('daily') || pkgName.includes('day')) {
                              frequencyBadge = 'Daily';
                              frequencyColor = '#10b981';
                            } else if (pkgName.includes('yearly') || pkgName.includes('year') || pkgName.includes('annual')) {
                              frequencyBadge = 'Yearly';
                              frequencyColor = '#f59e0b';
                            }
                          }
                          
                          if (__DEV__) {
                            console.log(`✅ Final badge for "${pkgObj.name}": ${frequencyBadge || 'None'}`);
                          }
                          
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
                                <View style={styles.packageNameRow}>
                                  <Text style={styles.packageOptionName}>{pkgObj.name}</Text>
                                  {frequencyBadge && (
                                    <View style={[styles.frequencyBadge, { backgroundColor: frequencyColor }]}>
                                      <Text style={styles.frequencyBadgeText}>{frequencyBadge}</Text>
                                    </View>
                                  )}
                                </View>
                                {isPkgSelected && (
                                  <View style={styles.packageCheckmark}>
                                    <Text style={styles.packageCheckmarkText}>✓</Text>
                                  </View>
                                )}
                              </View>
                              <Text style={styles.packageOptionPrice}>₹{pkgObj.price}</Text>
                              {(() => {
                                const offerText = getOfferPreviewText(
                                  (pkgObj as any)?.quantityOffers,
                                  // serviceQuantities is a map keyed by serviceId in non-package flow; for package cards
                                  // we fall back to the selectedIssueIds first (or 1) to decide eligibility.
                                  (Array.isArray(selectedIssueIds) && selectedIssueIds[0])
                                    ? (serviceQuantities as any)?.[selectedIssueIds[0]]
                                    : 1,
                                  (pkgObj as any)?.price
                                );
                                return offerText ? (
                                  <View style={styles.offerPillRow}>
                                    <View style={styles.offerPill}>
                                      <Ionicons name="pricetag" size={14} color="#0e7490" />
                                      <Text style={styles.offerPillText} numberOfLines={2}>
                                        {offerText}
                                      </Text>
                                    </View>
                                  </View>
                                ) : null;
                              })()}
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

                {(() => {
                  const offerText = getOfferPreviewText(
                    (item as any)?.quantityOffers,
                    (serviceQuantities as any)?.[item.id],
                    (item as any)?.price
                  );
                  return offerText ? (
                    <View style={styles.offerPillRow}>
                      <View style={styles.offerPill}>
                        <Ionicons name="flash" size={14} color="#0e7490" />
                        <Text style={styles.offerPillText} numberOfLines={2}>
                          {offerText}
                        </Text>
                      </View>
                    </View>
                  ) : null;
                })()}
                {/* Additional Info */}
                {item.rating && (
                  <View style={styles.metaRow}>
                    <View style={styles.ratingBadge}>
                      <Text style={styles.ratingBadgeText}>⭐ {item.rating.toFixed(1)}</Text>
                    </View>
                  </View>
                )}

                {/* Select Button at Bottom */}
                <TouchableOpacity
                  style={[
                    styles.selectButton,
                    isSelected && styles.selectButtonSelected
                  ]}
                  onPress={() => {
                    if (!isBusy) {
                      setSelectedCompanyId(item.id);
                    }
                  }}
                  disabled={isBusy}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.selectButtonText,
                    isSelected && styles.selectButtonTextSelected
                  ]}>
                    {isSelected ? '✓ Selected' : 'Select'}
                  </Text>
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshing={loading}
              onRefresh={fetchServiceCompanies}
            />
          )}
        </View>

      {/* Modern Bottom Action Bar */}
      {isPackageBooking === true ? (
        effectiveSelectedPackage && selectedCompanyId ? (
          <View style={styles.bottomActionBar}>
            <View style={styles.selectedSummary}>
              <Text style={styles.selectedLabel}>Selected Package</Text>
              <Text style={styles.selectedProviderName} numberOfLines={1}>
                {(effectiveSelectedPackage as any)?.name ?? 'Package'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.addToCartButton}
              activeOpacity={0.7}
              onPress={selectCompany}
            >
              <Text style={styles.addToCartButtonText}>Add to Cart</Text>
            </TouchableOpacity>
          </View>
        ) : null
      ) : (
        selectedCompany && (
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
        )
      )}

      {/* Success Modal */}
      <ServiceAddedModal
        visible={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        serviceTitle={serviceTitle}
        selectedDate={selectedDateFull || selectedDate}
        selectedTime={selectedTime}
  offerText={offerCelebrationText}
        onContinueServices={() => {
          setShowSuccessModal(false);
          navigation.navigate("ServicesHome");
        }}
        onViewCart={() => {
          setShowSuccessModal(false);
          navigation.navigate("ServiceCart");
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#f8fafc" 
  },

  // Header
  headerSection: {
    backgroundColor: "white",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    alignItems: "center",
  },

  header: { 
    fontSize: 20, 
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
  },

  // Companies Container
  companiesContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
    paddingTop: 16,
  },

  // Provider Cards
  listContent: {
    paddingBottom: 100,
    paddingHorizontal: 16,
  },

  providerCard: {
    backgroundColor: "white",
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 2,
    borderColor: "transparent",
  },

  providerCardSelected: {
    borderColor: "#3b82f6",
    backgroundColor: "#f0f9ff",
    shadowColor: '#3b82f6',
    shadowOpacity: 0.2,
  },

  providerCardBusy: {
    opacity: 0.6,
    borderColor: "#fca5a5",
  },

  providerHeader: {
    marginBottom: 12,
  },

  providerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },

  companyDescription: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
    marginLeft: 12,
    lineHeight: 16,
  },

  companyLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    overflow: 'hidden',
  },

  companyLogoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
  },

  companyLogoText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
  },

  providerInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  providerName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
    letterSpacing: 0.3,
  },

  selectButton: {
    backgroundColor: "#3b82f6",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 16,
    alignItems: "center",
    shadowColor: '#3b82f6',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },

  selectButtonSelected: {
    backgroundColor: "#10b981",
    shadowColor: '#10b981',
  },

  selectButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 0.5,
  },

  selectButtonTextSelected: {
    color: "#ffffff",
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

  packageNameRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 8,
    flexWrap: "wrap",
  },

  packageOptionName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
  },

  frequencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },

  frequencyBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "white",
    textTransform: "uppercase",
    letterSpacing: 0.5,
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

  offerRow: {
    marginTop: 2,
    marginBottom: 6,
  },

  offerText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0e7490",
  },

  offerPillRow: {
    marginTop: 6,
    marginBottom: 6,
  },

  offerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    backgroundColor: "#ecfeff",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#06b6d4",
  },

  offerPillText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0e7490",
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
    marginHorizontal: 4,
  },

  retryButtonSecondary: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#3b82f6",
  },

  retryText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },

  retryTextSecondary: {
    color: "#3b82f6",
  },

  emptyActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
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
    backgroundColor: "#4CAF50",
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
