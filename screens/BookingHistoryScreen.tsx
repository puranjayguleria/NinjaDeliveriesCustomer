import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
  ScrollView,
  Animated,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { FirestoreService, ServiceBooking } from "../services/firestoreService";
import { FirestoreServiceExtensions } from "../services/firestoreServiceExtensions";
import { BookingUtils } from "../utils/bookingUtils";
import ServiceCancellationModal from "../components/ServiceCancellationModal";
import AsyncStorage from "@react-native-async-storage/async-storage";
import auth from "@react-native-firebase/auth";
import axios from "axios";

const LOG_PREFIX = "📚[SvcPay]";
const log = (...args: any[]) => {
  if (__DEV__) console.log(LOG_PREFIX, ...args);
};
const warn = (...args: any[]) => {
  if (__DEV__) console.warn(LOG_PREFIX, ...args);
};

type FilterStatus = 'all' | 'active' | 'pending' | 'completed' | 'rejected' | 'cancelled';

export default function BookingHistoryScreen() {
  const navigation = useNavigation<any>();
  const [bookings, setBookings] = useState<ServiceBooking[]>([]);
  const [allBookings, setAllBookings] = useState<ServiceBooking[]>([]); // Store all bookings for count calculation
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('all');
  const [tabAnimation] = useState(new Animated.Value(0));
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<{id: string, serviceName: string, totalPrice?: number} | null>(null);

  // Expand/collapse grouped rows (plan group or time slot group)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // If user killed the app during Razorpay verification, we keep a local recovery token.
  // On booking history open, reconcile once so pending bookings become confirmed/paid.
  const SERVICE_PAYMENT_RECOVERY_KEY = "service_payment_recovery";



  const reconcileServicePayments = async () => {
    try {
      const raw = await AsyncStorage.getItem(SERVICE_PAYMENT_RECOVERY_KEY);
      if (!raw) return;

      const recovery = JSON.parse(raw);
      const razorpayOrderId = String(recovery?.razorpayOrderId || "");
      if (!razorpayOrderId) return;

  log("reconcile_start", { razorpayOrderId, recovery });

      const api = axios.create({
        timeout: 20000,
        headers: { "Content-Type": "application/json" },
      });

      const user = auth().currentUser;
      if (!user) return;

      const token = await user.getIdToken(true);
      const headers = { Authorization: `Bearer ${token}` };

      const CLOUD_FUNCTIONS_BASE_URL = "https://asia-south1-ninjadeliveries-91007.cloudfunctions.net";
  const callableUrl = (fnName: string) => `${CLOUD_FUNCTIONS_BASE_URL}/${fnName}:call`;
  const httpUrl = (fnName: string) => `${CLOUD_FUNCTIONS_BASE_URL}/${fnName}`;

      // New API expects { orderIds: [...] }. Keep compatibility on server by only sending new shape.
      let data: any;
      try {
        if (__DEV__) {
          log("fn_post_attempt", { fnName: 'servicePaymentsReconcile', url: httpUrl('servicePaymentsReconcile'), mode: 'http' });
        }
        ({ data } = await api.post(httpUrl('servicePaymentsReconcile'), { orderIds: [razorpayOrderId] }, { headers }));
      } catch (e: any) {
        const status = e?.response?.status;
        if (status === 404) {
          if (__DEV__) {
            log("fn_post_attempt", { fnName: 'servicePaymentsReconcile', url: callableUrl('servicePaymentsReconcile'), mode: 'callable' });
          }
          const resp = await api.post(callableUrl('servicePaymentsReconcile'), { data: { orderIds: [razorpayOrderId] } }, { headers });
          data = resp?.data?.result ?? resp?.data;
        } else {
          throw e;
        }
      }
      log("reconcile_response", data);

      const finalizedOrderIds: string[] = Array.isArray(data?.finalizedOrderIds)
        ? data.finalizedOrderIds.map((x: any) => String(x))
        : [];
      const isFinalizedForThisOrder = finalizedOrderIds.includes(razorpayOrderId);

      // New backend returns: { ok, finalizedIntents, finalizedOrderIds, createdBookings, createdBookingIdsByOrder }
      // Older backend returned: { ok, updatedBookings, alreadyFinalized }
      const shouldClearRecovery =
        (data?.ok && isFinalizedForThisOrder) ||
        (data?.ok && (Number(data?.updatedBookings || 0) > 0 || !!data?.alreadyFinalized)) ||
        (data?.ok && Number(data?.createdBookings || 0) > 0);

      if (shouldClearRecovery) {
        log("reconcile_finalized_remove_recovery", {
          razorpayOrderId,
          updatedBookings: data?.updatedBookings,
          alreadyFinalized: data?.alreadyFinalized,
          finalizedOrderIds,
          createdBookings: data?.createdBookings,
        });
        await AsyncStorage.removeItem(SERVICE_PAYMENT_RECOVERY_KEY);
      }
    } catch (e) {
      warn("reconcile_failed_nonfatal", e);
    }
  };

  // Fetch bookings from Firebase for currently logged-in user only
  const fetchBookings = async (isRefresh = false, filter: FilterStatus = 'all') => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Check if user is logged in
      if (!FirestoreService.isUserLoggedIn()) {
        setError('Please log in to view your bookings');
        return;
      }

      if (__DEV__) {
        // DEBUG: Check current user first
        console.log('👤 DEBUG: Checking current user...');
        await FirestoreService.debugCurrentUser();

        // DEBUG: Show all user bookings
        console.log('🔍 DEBUG: Checking all bookings for current user...');
        await FirestoreService.debugAllUserBookings();
      }
      
      // First, get ALL user bookings for count calculation
      console.log('📊 Getting all user bookings for count calculation...');
      const allUserBookings = await FirestoreService.getSimpleUserBookings(100);
      setAllBookings(allUserBookings);
      
      // Then get filtered bookings for display
      console.log(`📱 Fetching bookings with filter: ${filter}`);
      const fetchedBookings = await FirestoreService.getUserBookingsByStatus(filter, 50);
      setBookings(fetchedBookings);
      
      console.log(`✅ Loaded ${fetchedBookings.length} bookings with filter: ${filter} (${allUserBookings.length} total)`);
    } catch (error: any) {
      console.error('Error fetching user bookings:', error);
      
      if (error?.message?.includes('log in')) {
        setError('Please log in to view your bookings');
      } else {
        setError('Failed to load your booking history. Please check your internet connection.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // Fix any inconsistent booking statuses first
    const fixStatusesAndFetch = async () => {
      try {
        // First reconcile any paid-but-not-finalized online service payments
        await reconcileServicePayments();

        // Fix inconsistent statuses
        await FirestoreServiceExtensions.fixInconsistentBookingStatuses();
        
        // Debug booking statuses
        await FirestoreServiceExtensions.debugBookingStatusesDetailed();
        
        // Then fetch bookings
        fetchBookings(false, activeFilter);
      } catch (error) {
        console.error('Error fixing statuses:', error);
        // Still try to fetch bookings even if fix fails
        fetchBookings(false, activeFilter);
      }
    };

    console.log('📱 Loading booking history and fixing status inconsistencies...');
    fixStatusesAndFetch();
  }, [activeFilter]);

  const onRefresh = () => {
    fetchBookings(true, activeFilter);
  };

  const handleFilterChange = (filter: FilterStatus) => {
    if (filter !== activeFilter) {
      // Animate tab change
      Animated.sequence([
        Animated.timing(tabAnimation, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(tabAnimation, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
      
      setActiveFilter(filter);
    }
  };

  const getFilterCounts = () => {
    // Calculate counts from ALL user bookings
    if (allBookings.length > 0) {
      const all = allBookings.length;
      const active = allBookings.filter(b => ['pending', 'assigned', 'started'].includes(b.status)).length;
      const pending = allBookings.filter(b => b.status === 'pending').length;
      const completed = allBookings.filter(b => b.status === 'completed').length;
      const reject = allBookings.filter(b => b.status === 'rejected' || b.status === 'reject').length;
      const cancelled = allBookings.filter(b => b.status === 'cancelled').length;
      
      console.log(`📊 Filter counts: All=${all}, Active=${active}, Pending=${pending}, Completed=${completed}, Rejected=${reject}, Cancelled=${cancelled}`);
      
      return { all, active, pending, completed, reject, cancelled };
    }
    
    // If no bookings loaded yet, return zeros
    return { all: 0, active: 0, pending: 0, completed: 0, reject: 0, cancelled: 0 };
  };

  // Filters array for sidebar
  const filters: { key: FilterStatus; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'pending', label: 'Pending' },
    { key: 'completed', label: 'Done' },
    { key: 'rejected', label: 'Reject' },
    { key: 'cancelled', label: 'Cancel' },
  ];

  // Get count for a specific filter
  const getFilterCount = (filterKey: FilterStatus): number => {
    const counts = getFilterCounts();
    switch (filterKey) {
      case 'all': return counts.all;
      case 'active': return counts.active;
      case 'pending': return counts.pending;
      case 'completed': return counts.completed;
      case 'rejected': return counts.reject;
      case 'cancelled': return counts.cancelled;
      default: return 0;
    }
  };

  // NOTE: legacy horizontal tabs UI existed earlier; this screen currently uses the left sidebar filters.

  const handleRejectBooking = async (bookingId: string, serviceName: string, totalPrice?: number) => {
    setBookingToCancel({ id: bookingId, serviceName, totalPrice });
    setShowCancellationModal(true);
  };

  const handleConfirmCancellation = async () => {
    if (!bookingToCancel) return;

    try {
      setShowCancellationModal(false);
      setLoading(true);
      await FirestoreService.cancelBookingByUser(bookingToCancel.id);
      
      Alert.alert(
        "Booking Cancelled", 
        "Your booking has been cancelled successfully.",
        [{ text: "OK", onPress: () => fetchBookings(false, activeFilter) }]
      );
    } catch (error: any) {
      console.error('Error cancelling booking:', error);
      Alert.alert(
        "Error", 
        "Failed to cancel booking. Please try again.",
        [{ text: "OK" }]
      );
    } finally {
      setLoading(false);
      setBookingToCancel(null);
    }
  };

  // Legacy per-booking card renderer removed in favor of grouped UI.

  type BookingGroup =
    | {
        id: string;
        kind: 'plan';
        companyId: string;
        companyName: string;
        time: string;
        unit: 'day' | 'week' | 'month' | 'unknown';
        packageName: string;
        totalVisits: number;
        nextUpcomingDate?: string;
        bookings: ServiceBooking[];
      }
    | {
        id: string;
        kind: 'slot';
        companyId: string;
        companyName: string;
        date: string;
        time: string;
        bookings: ServiceBooking[];
      };

  const normalizeUnit = (u: any): 'day' | 'week' | 'month' | 'unknown' => {
    const s = String(u || '').trim().toLowerCase();
    if (s === 'day' || s === 'daily') return 'day';
    if (s === 'week' || s === 'weekly') return 'week';
    if (s === 'month' || s === 'monthly') return 'month';
    return 'unknown';
  };

  const getCompanyKey = (b: ServiceBooking) => String(b.companyId || b.companyName || 'company');
  const getCompanyName = (b: ServiceBooking) => String(b.companyName || 'Service Provider');
  const getTimeLabel = (b: ServiceBooking) => String((b as any)?.time || '');
  const getDateISO = (b: ServiceBooking) => String((b as any)?.date || '');

  const getPackageInfoFromBooking = (b: ServiceBooking) => {
    const selectedPackage: any = (b as any)?.selectedPackage;
    const unit = normalizeUnit(
      (b as any)?.packageType ||
        selectedPackage?.unit ||
        selectedPackage?.type ||
        selectedPackage?.frequency
    );
    const packageName = String(
      (b as any)?.packageName || selectedPackage?.name || (b as any)?.selectedPackageName || ''
    ).trim();
    const packageId = String(
      (b as any)?.packageId || selectedPackage?.id || selectedPackage?.packageId || ''
    ).trim();
    const isPackage = (b as any)?.isPackage === true || (b as any)?.isPackageBooking === true;
    return { isPackage, unit, packageName, packageId };
  };

  const groupBookingsForUI = (list: ServiceBooking[]): BookingGroup[] => {
    const planGroups: Record<string, ServiceBooking[]> = {};
    const slotGroups: Record<string, ServiceBooking[]> = {};

    for (const b of list) {
      const companyKey = getCompanyKey(b);
      const time = getTimeLabel(b);
      const date = getDateISO(b);
      const { isPackage, unit, packageName, packageId } = getPackageInfoFromBooking(b);

      if (isPackage && unit !== 'unknown') {
        // Consumer UX: collapse all occurrences of the same plan into one group
        // Keyed by company + package + time.
        const planKey = `${companyKey}|${packageId || packageName || unit}|${time}`;
        const arr = planGroups[planKey] || [];
        arr.push(b);
        planGroups[planKey] = arr;
      } else {
        // Normal services grouped by company + date + time
        const slotKey = `${companyKey}|${date}|${time}`;
        const arr = slotGroups[slotKey] || [];
        arr.push(b);
        slotGroups[slotKey] = arr;
      }
    }

    const today = new Date();
    const todayISO = today.toISOString().split('T')[0];

    const out: BookingGroup[] = [];

    for (const key of Object.keys(planGroups)) {
      const arr = planGroups[key];
      const sorted = [...arr].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
      const sample = sorted[0];
      const { unit, packageName } = getPackageInfoFromBooking(sample);
      const companyName = getCompanyName(sample);
      const companyId = String(sample.companyId || getCompanyKey(sample));
      const time = getTimeLabel(sample);

      // next upcoming date (>= todayISO)
      const nextUpcoming = sorted.find((x) => String(x.date || '') >= todayISO)?.date;

      out.push({
        id: `plan:${key}`,
        kind: 'plan',
        companyId,
        companyName,
        time,
        unit,
        packageName: packageName || (unit === 'month' ? 'Monthly plan' : unit === 'week' ? 'Weekly plan' : 'Plan'),
        totalVisits: sorted.length,
        nextUpcomingDate: nextUpcoming ? String(nextUpcoming) : undefined,
        bookings: sorted,
      });
    }

    for (const key of Object.keys(slotGroups)) {
      const arr = slotGroups[key];
      const sorted = [...arr].sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      const sample = sorted[0];
      const companyName = getCompanyName(sample);
      const companyId = String(sample.companyId || getCompanyKey(sample));
      const time = getTimeLabel(sample);
      const date = getDateISO(sample);
      out.push({
        id: `slot:${key}`,
        kind: 'slot',
        companyId,
        companyName,
        date,
        time,
        bookings: sorted,
      });
    }

    // Sort: upcoming first by nextUpcomingDate/date
    out.sort((a, b) => {
      const aDate = a.kind === 'plan' ? (a.nextUpcomingDate || a.bookings?.[0]?.date || '') : a.date;
      const bDate = b.kind === 'plan' ? (b.nextUpcomingDate || b.bookings?.[0]?.date || '') : b.date;
      if (aDate !== bDate) return String(aDate).localeCompare(String(bDate));

      const aTime = a.kind === 'plan' ? a.time : a.time;
      const bTime = b.kind === 'plan' ? b.time : b.time;
      return String(aTime).localeCompare(String(bTime));
    });

    return out;
  };

  const groupedBookings = groupBookingsForUI(bookings);

  const toggleGroupExpansion = (groupId: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const renderGroup = ({ item }: { item: BookingGroup }) => {
    const isExpanded = expandedGroups[item.id] === true;

    if (item.kind === 'plan') {
      const unitLabel = item.unit === 'month' ? 'Monthly plan' : item.unit === 'week' ? 'Weekly plan' : item.unit === 'day' ? 'Daily plan' : 'Plan';
      const title = `${unitLabel} – ${item.totalVisits} visits @ ${item.time}`;
      const nextDateLabel = item.nextUpcomingDate
        ? new Date(item.nextUpcomingDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : '—';

      return (
        <View style={styles.groupCardWrap}>
          <TouchableOpacity
            style={styles.groupCard}
            activeOpacity={0.85}
            onPress={() => toggleGroupExpansion(item.id)}
          >
            <View style={styles.groupHeaderRow}>
              <View style={styles.groupIcon}>
                <Ionicons name="calendar" size={18} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.groupTitle} numberOfLines={2}>{title}</Text>
                <Text style={styles.groupSubtitle} numberOfLines={1}>{item.companyName} • Next: {nextDateLabel}</Text>
              </View>
              <View style={styles.groupRight}>
                <View style={styles.groupCountPill}>
                  <Text style={styles.groupCountPillText}>{item.totalVisits}</Text>
                </View>
                <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#64748B" />
              </View>
            </View>
          </TouchableOpacity>

          {isExpanded && (
            <View style={styles.groupChildren}>
              {item.bookings.map((b) => (
                <React.Fragment key={b.id}>
                  <View style={styles.groupChildRow}>
                    <View style={styles.groupChildDot} />
                    <Text style={styles.groupChildText}>
                      {new Date(b.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} • {b.time}
                    </Text>
                    <Text style={styles.groupChildStatus}>
                      {BookingUtils.getStatusText(b.status)}
                    </Text>
                  </View>
                </React.Fragment>
              ))}
            </View>
          )}
        </View>
      );
    }

    // slot group
    const dateLabel = new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const title = `${item.companyName} – ${dateLabel} @ ${item.time}`;
    const count = item.bookings.length;

    return (
      <View style={styles.groupCardWrap}>
        <TouchableOpacity
          style={styles.groupCard}
          activeOpacity={0.85}
          onPress={() => toggleGroupExpansion(item.id)}
        >
          <View style={styles.groupHeaderRow}>
            <View style={styles.groupIcon}>
              <Ionicons name="business" size={18} color="#0F766E" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.groupTitle} numberOfLines={2}>{title}</Text>
              <Text style={styles.groupSubtitle} numberOfLines={1}>{count} booking{count === 1 ? '' : 's'}</Text>
            </View>
            <View style={styles.groupRight}>
              <View style={styles.groupCountPill}>
                <Text style={styles.groupCountPillText}>{count}</Text>
              </View>
              <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#64748B" />
            </View>
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.groupChildren}>
            {item.bookings.map((b) => (
              <TouchableOpacity
                key={b.id}
                style={styles.groupChildTouchable}
                activeOpacity={0.8}
                onPress={() => {
                  const formattedDate = BookingUtils.formatBookingDate(b.date);
                  const formattedTime = BookingUtils.formatBookingTime(b.time);
                  navigation.navigate("TrackBooking", {
                    bookingId: b.id,
                    serviceTitle: b.serviceName,
                    selectedDate: formattedDate,
                    selectedTime: formattedTime,
                    company: { name: b.technicianName || "Service Provider" },
                    issues: [b.workName],
                    totalPrice: b.totalPrice || 0,
                    bookingType: "service",
                    paymentMethod: "cash",
                    notes: b.workName,
                  });
                }}
              >
                <View style={styles.groupChildRow}>
                  <View style={styles.groupChildDot} />
                  <Text style={styles.groupChildText} numberOfLines={1}>{b.serviceName}</Text>
                  <Text style={styles.groupChildStatus}>{BookingUtils.getStatusText(b.status)}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking History</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Main Content: Sidebar + Bookings */}
      <View style={styles.mainContent}>
        {/* Left Sidebar - Filter Tabs */}
        <View style={styles.sidebar}>
          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sidebarContent}
          >
            {filters.map((filter) => {
              const isActive = activeFilter === filter.key;
              const count = getFilterCount(filter.key);
              
              return (
                <TouchableOpacity
                  key={filter.key}
                  style={[
                    styles.filterTab,
                    isActive && styles.filterTabActive
                  ]}
                  onPress={() => {
                    setActiveFilter(filter.key);
                    fetchBookings(false, filter.key);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.filterTabText,
                    isActive && styles.filterTabTextActive
                  ]}>
                    {filter.label}
                  </Text>
                  {count > 0 && (
                    <View style={[
                      styles.filterBadge,
                      isActive && styles.filterBadgeActive
                    ]}>
                      <Text style={[
                        styles.filterBadgeText,
                        isActive && styles.filterBadgeTextActive
                      ]}>
                        {count}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Right Side - Bookings List */}
        <View style={styles.bookingsContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3b82f6" />
              <Text style={styles.loadingText}>Loading bookings...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Ionicons 
                name={error.includes('log in') ? "person-outline" : "alert-circle"} 
                size={48} 
                color="#EF4444" 
              />
              <Text style={styles.errorText}>{error}</Text>
              
              {error.includes('log in') ? (
                <TouchableOpacity 
                  style={styles.loginButton} 
                  onPress={() => navigation.navigate("Login")}
                >
                  <Text style={styles.loginText}>Go to Login</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.retryButton} onPress={() => fetchBookings(false, activeFilter)}>
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : bookings.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={64} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>No Bookings Found</Text>
              <Text style={styles.emptyText}>
                {activeFilter === 'all' 
                  ? "You haven't made any service bookings yet."
                  : `No ${activeFilter} bookings found.`
                }
              </Text>
              
              <TouchableOpacity
                style={styles.browseButton}
                onPress={() => navigation.navigate("ServicesHome")}
              >
                <Text style={styles.browseText}>Browse Services</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              style={{ flex: 1 }}
              data={groupedBookings}
              keyExtractor={(item) => item.id}
              renderItem={renderGroup}
              contentContainerStyle={{ paddingBottom: 5, paddingTop: 18, paddingHorizontal: 8 }}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#3b82f6']}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
        </View>
      </View>

      {/* Service Cancellation Modal */}
      <ServiceCancellationModal
        visible={showCancellationModal}
        onClose={() => {
          setShowCancellationModal(false);
          setBookingToCancel(null);
        }}
        onConfirmCancel={handleConfirmCancellation}
        totalAmount={bookingToCancel?.totalPrice || 0}
        deductionPercentage={25}
      />
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "white",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },

  backButton: {
    padding: 4,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
    flex: 1,
  },

  headerSpacer: {
    width: 20,
  },

  // Main Content Layout
  mainContent: {
    flex: 1,
    flexDirection: "row",
  },

  // Grouped list UI
  groupCardWrap: {
    marginBottom: 10,
  },
  groupCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  groupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  groupIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  groupTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  groupSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: '#64748B',
  },
  groupRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 8,
  },
  groupCountPill: {
    minWidth: 34,
    paddingHorizontal: 10,
    height: 22,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupCountPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3730A3',
  },
  groupChildren: {
    marginTop: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 8,
  },
  groupChildTouchable: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  groupChildRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupChildDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#94A3B8',
    marginRight: 10,
  },
  groupChildText: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
  },
  groupChildStatus: {
    fontSize: 12,
    color: '#64748B',
    marginLeft: 10,
  },

  // Left Sidebar - Filter Tabs
  sidebar: {
    width: 120,
    backgroundColor: "#ffffff",
    borderRightWidth: 1,
    borderRightColor: "#e2e8f0",
  },

  sidebarContent: {
    paddingVertical: 30,
    paddingHorizontal: 14,
  },

  filterTab: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#e2e8f0",
    alignItems: "center",
  },

  filterTabActive: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
    shadowColor: '#3b82f6',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },

  filterTabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
    textAlign: "center",
    marginBottom: 4,
  },

  filterTabTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },

  filterBadge: {
    backgroundColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: "center",
  },

  filterBadgeActive: {
    backgroundColor: "#ffffff",
  },

  filterBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
  },

  filterBadgeTextActive: {
    color: "#3b82f6",
  },

  // Right Side - Bookings Container
  bookingsContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },

  filterContainer: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },

  tabScrollContainer: {
    paddingHorizontal: 16,
    gap: 12,
    alignItems: "center",
  },

  activeFilterTab: {
    borderColor: "transparent",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
    transform: [{ translateY: -2 }],
  },

  tabContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  tabIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  activeTabIconContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    borderColor: "rgba(255, 255, 255, 0.3)",
  },

  tabTextContainer: {
    flexDirection: "row",
    alignItems: "center",
  },

  filterText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
    textAlign: "center",
    letterSpacing: 0.2,
  },

  activeFilterText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  countBadge: {
    marginLeft: 8,
    backgroundColor: "#EF4444",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    minWidth: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },

  activeCountBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },

  countText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
  },

  activeCountText: {
    color: "#374151",
    fontWeight: "900",
  },

  card: {
    backgroundColor: "white",
    borderRadius: 16,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },

  cardContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 8,
  },

  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  details: {
    flex: 1,
  },

  service: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 8,
    lineHeight: 22,
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    flexShrink: 0,
  },

  statusText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  issue: {
    fontSize: 15,
    color: "#4B5563",
    marginBottom: 10,
    lineHeight: 22,
    flexWrap: "wrap",
    fontWeight: "500",
  },

  customerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    flexWrap: "wrap",
  },

  customer: {
    fontSize: 14,
    color: "#4B5563",
    marginLeft: 6,
    flex: 1,
    flexWrap: "wrap",
    fontWeight: "500",
  },

  timeInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    flexWrap: "wrap",
  },

  dateTimeItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },

  dateTime: {
    fontSize: 13,
    color: "#4B5563",
    fontWeight: "600",
    marginLeft: 4,
  },

  otpContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EBF8FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 8,
    alignSelf: "flex-start",
  },

  otpText: {
    fontSize: 12,
    color: "#3B82F6",
    fontWeight: "700",
    marginLeft: 6,
  },

  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },

  bookingId: {
    fontSize: 13,
    color: "#9CA3AF",
    fontWeight: "600",
    fontFamily: "monospace",
    flex: 1,
  },

  price: {
    fontSize: 20,
    color: "#059669",
    fontWeight: "800",
    flexShrink: 0,
    letterSpacing: 0.3,
  },

  arrowContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingLeft: 8,
  },

  actionButtonsContainer: {
    flexDirection: "row",
    marginTop: 6,
    marginBottom: 4,
  },

  rejectButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#FFE5E5",
    paddingHorizontal: 0,
    paddingVertical: 0,
    overflow: "hidden",
  },

  rejectButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(255, 71, 87, 0.05)",
  },

  rejectButtonText: {
    fontSize: 11,
    color: "#FF4757",
    fontWeight: "600",
    marginLeft: 4,
    letterSpacing: 0.1,
  },

  // Loading states
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },

  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6B7280",
    fontWeight: "500",
  },

  // Error states
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },

  errorText: {
    fontSize: 16,
    color: "#EF4444",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 24,
  },

  retryButton: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#6D28D9",
    shadowColor: "#6D28D9",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },

  retryText: {
    color: "#6D28D9",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },

  loginButton: {
    backgroundColor: "#6D28D9",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: "#6D28D9",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },

  loginText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },

  // Empty states
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },

  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 12,
    marginTop: 16,
  },

  emptyText: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 24,
  },

  browseButton: {
    backgroundColor: "#6D28D9",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    shadowColor: "#6D28D9",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },

  browseText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },

  backBtn: {
    position: "absolute",
    bottom: 16,
    left: 12,
    right: 12,
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#6D28D9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },

  backText: {
    color: "#6D28D9",
    fontWeight: "600",
    textAlign: "center",
    fontSize: 14,
  },
});
