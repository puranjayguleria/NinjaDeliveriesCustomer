import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { FirestoreService, ServiceBooking } from "../services/firestoreService";
import { FirestoreServiceExtensions } from "../services/firestoreServiceExtensions";
import { BookingUtils } from "../utils/bookingUtils";
import ServiceCancellationModal from "../components/ServiceCancellationModal";
import AsyncStorage from "@react-native-async-storage/async-storage";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import axios from "axios";

const LOG_PREFIX = "📚[SvcPay]";
const log = (...args: any[]) => {
  if (__DEV__) console.log(LOG_PREFIX, ...args);
};
const warn = (...args: any[]) => {
  if (__DEV__) console.warn(LOG_PREFIX, ...args);
};

type FilterStatus = 'all' | 'active' | 'pending' | 'completed' | 'rejected' | 'cancelled';

const summarizeBookingForDebug = (b: any) => {
  if (!b) return b;
  return {
    id: String(b.id || ''),
    status: String(b.status || ''),
    companyId: String(b.companyId || ''),
    companyName: String(b.companyName || ''),
    date: String(b.date || ''),
    time: String(b.time || ''),
    planGroupId: String((b as any).planGroupId || ''),
    isPackageBooking: (b as any).isPackageBooking,
    packageUnit: String((b as any).packageUnit || ''),
  };
};

export default function BookingHistoryScreen() {
  const navigation = useNavigation<any>();
  const [bookings, setBookings] = useState<ServiceBooking[]>([]);
  const [allBookings, setAllBookings] = useState<ServiceBooking[]>([]); // Store all bookings for count calculation
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('all');

  // List UX: sorting and time filtering for better navigation through history
  const [timeFilter, setTimeFilter] = useState<'all' | 'upcoming' | 'past'>('all');
  const [sortOrder, setSortOrder] = useState<'upcomingFirst' | 'newestFirst' | 'oldestFirst'>('upcomingFirst');
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

      // Keep noise low: history screen should be quiet in dev unless we're debugging grouping.
      
  // First, get ALL user bookings for count calculation
      const allUserBookings = await FirestoreService.getSimpleUserBookings(100);
      setAllBookings(allUserBookings);
      
  // Then get filtered bookings for display
      const fetchedBookings = await FirestoreService.getUserBookingsByStatus(filter, 50);
      setBookings(fetchedBookings);

      if (__DEV__) {
        const planLike = fetchedBookings.filter((b: any) => !!(b as any)?.planGroupId);
        console.log('🧪 DEBUG(history): fetched bookings sample', {
          filter,
          fetchedCount: fetchedBookings.length,
          planGroupIdCount: planLike.length,
          uniquePlanGroupIds: Array.from(new Set(planLike.map((b: any) => String((b as any).planGroupId || '')))).filter(Boolean).length,
          sample0: summarizeBookingForDebug(fetchedBookings[0]),
          sample1: summarizeBookingForDebug(fetchedBookings[1]),
        });
      }
      
      if (__DEV__) {
        console.log(`🧪 DEBUG(history): loaded bookings`, {
          filter,
          fetched: fetchedBookings.length,
          total: allUserBookings.length,
        });
      }
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

    fixStatusesAndFetch();
  }, [activeFilter]);

  const onRefresh = () => {
    fetchBookings(true, activeFilter);
  };

  // Filter is set directly from sidebar UI; legacy handler removed.

  const getFilterCounts = () => {
    // Calculate counts from ALL user bookings
    if (allBookings.length > 0) {
      const all = allBookings.length;
      const active = allBookings.filter(b => ['pending', 'assigned', 'started'].includes(b.status)).length;
      const pending = allBookings.filter(b => b.status === 'pending').length;
      const completed = allBookings.filter(b => b.status === 'completed').length;
      const reject = allBookings.filter(b => b.status === 'rejected' || b.status === 'reject').length;
      const cancelled = allBookings.filter(b => b.status === 'cancelled').length;
      
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
    const planGroupId = String((b as any)?.planGroupId || '').trim();
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
    const isPackage =
      (b as any)?.isPackage === true ||
      (b as any)?.isPackageBooking === true ||
      !!planGroupId;
    return { isPackage, unit, packageName, packageId, planGroupId };
  };

  const groupBookingsForUI = (list: ServiceBooking[]): BookingGroup[] => {
    const planGroups: Record<string, ServiceBooking[]> = {};
    const slotGroups: Record<string, ServiceBooking[]> = {};

    for (const b of list) {
      const companyKey = getCompanyKey(b);
      const time = getTimeLabel(b);
      const date = getDateISO(b);
      const { isPackage, unit, packageName, packageId, planGroupId } = getPackageInfoFromBooking(b);

      if (isPackage && (planGroupId || unit !== 'unknown')) {
        // Consumer UX: collapse all occurrences of the same plan into one group
        // Prefer planGroupId (server-stamped) so different bookings of the same plan always group.
        // Fallback to packageId/name/unit.
        const planKey = `${companyKey}|${planGroupId || packageId || packageName || unit}|${time}`;
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

  const groupedBookingsBase = groupBookingsForUI(bookings);

  const groupedBookings = React.useMemo(() => {
    const todayISO = new Date().toISOString().split('T')[0];

    const getGroupDateISO = (g: BookingGroup) =>
      String(g.kind === 'plan' ? (g.nextUpcomingDate || g.bookings?.[0]?.date || '') : g.date || '');

    const isGroupUpcoming = (g: BookingGroup) => {
      const d = getGroupDateISO(g);
      return !!d && d >= todayISO;
    };

    const compareGroupsByDateTimeAsc = (a: BookingGroup, b: BookingGroup) => {
      const aDate = getGroupDateISO(a);
      const bDate = getGroupDateISO(b);
      if (aDate !== bDate) return String(aDate).localeCompare(String(bDate));
      return String(a.time || '').localeCompare(String(b.time || ''));
    };

    const compareGroupsByDateTimeDesc = (a: BookingGroup, b: BookingGroup) => -compareGroupsByDateTimeAsc(a, b);

    let list = [...groupedBookingsBase];

    // Time filter
    if (timeFilter !== 'all') {
      const wantUpcoming = timeFilter === 'upcoming';
      list = list.filter((g) => isGroupUpcoming(g) === wantUpcoming);
    }

    // Sort
    if (sortOrder === 'upcomingFirst') {
      list.sort((a, b) => {
        const aUp = isGroupUpcoming(a);
        const bUp = isGroupUpcoming(b);
        if (aUp !== bUp) return aUp ? -1 : 1;
        // Within upcoming: earlier first. Within past: newest first.
        return aUp ? compareGroupsByDateTimeAsc(a, b) : compareGroupsByDateTimeDesc(a, b);
      });
    } else if (sortOrder === 'newestFirst') {
      list.sort(compareGroupsByDateTimeDesc);
    } else {
      list.sort(compareGroupsByDateTimeAsc);
    }

    return list;
  }, [groupedBookingsBase, timeFilter, sortOrder]);

  const normalizeStatus = (raw: any) => {
    const s = String(raw || '').trim().toLowerCase();
    // Handle common variants seen in mixed client/server setups
    if (s === 'reject') return 'rejected';
    if (s === 'canceled') return 'cancelled';
    if (s === 'payment_pending' || s === 'payment-pending' || s === 'pending_payment') return 'pending';
    if (s === 'unassigned') return 'pending';
    return s;
  };

  const canDeleteBooking = (b: ServiceBooking) => {
    const s = normalizeStatus((b as any)?.status);
    // Safety: allow only non-finalized bookings from the client UI.
    // If you want to allow deleting completed/confirmed, we can extend this list.
    return ['pending', 'cancelled', 'rejected'].includes(s);
  };

  const deleteBookings = async (bookingsToDelete: ServiceBooking[]) => {
    if (!bookingsToDelete?.length) return;

    const notAllowed = bookingsToDelete.filter((b) => !canDeleteBooking(b));
    if (notAllowed.length > 0) {
      const statusSummary = notAllowed
        .map((b) => ({ id: String((b as any)?.id || ''), status: String((b as any)?.status || ''), normalized: normalizeStatus((b as any)?.status) }))
        .slice(0, 8);
      Alert.alert(
        'Can\'t delete',
        `Some bookings in this group are not deletable.\n\nAllowed: Pending / Cancelled / Rejected.\n\nBlocked sample: ${statusSummary
          .map((x) => `${x.status}→${x.normalized}`)
          .join(', ')}`
      );
      return;
    }

    try {
      setLoading(true);

      // Delete in chunks (Firestore batch max 500 ops)
      const ids = bookingsToDelete.map((b) => String(b.id));
      const chunkSize = 450;
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const batch = firestore().batch();
        chunk.forEach((id) => {
          batch.delete(firestore().collection('service_bookings').doc(id));
        });
        await batch.commit();
      }

      Alert.alert('Deleted', `Deleted ${ids.length} booking${ids.length === 1 ? '' : 's'}.`, [
        { text: 'OK', onPress: () => fetchBookings(false, activeFilter) },
      ]);
    } catch (e) {
      console.error('Error deleting bookings:', e);
      Alert.alert('Error', 'Failed to delete booking(s). Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = (title: string, bookingsToDelete: ServiceBooking[]) => {
    Alert.alert(
      'Delete booking',
      `Delete ${title}?\n\nThis will permanently remove it from your history.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteBookings(bookingsToDelete),
        },
      ]
    );
  };


  useEffect(() => {
    if (!__DEV__) return;
    try {
      const planGroups = groupedBookings.filter((g: any) => g?.kind === 'plan');
      const slotGroups = groupedBookings.filter((g: any) => g?.kind === 'slot');

      const planDebug = planGroups.slice(0, 8).map((g: any) => {
        const sample = Array.isArray(g.bookings) ? g.bookings[0] : undefined;
        const inferredPlanGroupId = String((sample as any)?.planGroupId || '');
        return {
          id: String(g.id || ''),
          companyId: String(g.companyId || ''),
          companyName: String(g.companyName || ''),
          time: String(g.time || ''),
          unit: String(g.unit || ''),
          totalVisits: Number(g.totalVisits || 0),
          inferredPlanGroupId,
        };
      });

      console.log('🧪 DEBUG(history): grouping summary', {
        rawBookings: bookings.length,
        groupedTotal: groupedBookings.length,
        planGroups: planGroups.length,
        slotGroups: slotGroups.length,
        planGroupsSample: planDebug,
      });
    } catch (e) {
      console.log('🧪 DEBUG(history): grouping summary failed', e);
    }
  }, [bookings.length, groupedBookings]);

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
        <View style={styles.headerTopRow}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={22} color="#0f172a" />
          </TouchableOpacity>

          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Bookings</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              Track, manage, and review
            </Text>
          </View>

          <View style={styles.headerRight}>
            <View style={styles.headerChip}>
              <Ionicons name="calendar-outline" size={14} color="#1D4ED8" />
              <Text style={styles.headerChipText}>{allBookings.length}</Text>
            </View>
          </View>
        </View>
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
          {/* Sorting + time filter */}
          <View style={styles.sortBar}>
            <View style={styles.sortBarRow}>
              <Text style={styles.sortBarLabel}>Show</Text>
              {([
                { key: 'all', label: 'All' },
                { key: 'upcoming', label: 'Upcoming' },
                { key: 'past', label: 'Past' },
              ] as const).map((opt) => {
                const active = timeFilter === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.pill, active && styles.pillActive]}
                    onPress={() => setTimeFilter(opt.key)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={[styles.sortBarRow, { marginTop: 8 }]}>
              <Text style={styles.sortBarLabel}>Sort</Text>
              {([
                { key: 'upcomingFirst', label: 'Upcoming first' },
                { key: 'newestFirst', label: 'Newest' },
                { key: 'oldestFirst', label: 'Oldest' },
              ] as const).map((opt) => {
                const active = sortOrder === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.pill, active && styles.pillActive]}
                    onPress={() => setSortOrder(opt.key)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
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
              contentContainerStyle={{ paddingBottom: 5, paddingTop: 12, paddingHorizontal: 8 }}
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

  // Sorting/filters bar (right pane)
  sortBar: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 8,
    marginTop: 10,
    marginBottom: 8,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  sortBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  sortBarLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
    marginRight: 4,
  },
  pill: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillActive: {
    borderColor: '#2563EB',
    backgroundColor: '#DBEAFE',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
  },
  pillTextActive: {
    color: '#1D4ED8',
  },

  // Header
  header: {
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },

  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },

  headerSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginTop: 2,
  },

  headerRight: {
    width: 64,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },

  headerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#DBEAFE',
    borderWidth: 1,
    borderColor: '#93C5FD',
  },

  headerChipText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#1D4ED8',
  },

  backButton: {
    padding: 4,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
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
