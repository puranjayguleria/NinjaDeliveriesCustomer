import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Dimensions,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import {
  SafeAreaView,
} from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { MaterialIcons, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { QuickTile } from "@/components/QuickTile";
import { ProductGridSkeleton } from "@/components/Skeleton";
import { useLocationContext } from "@/context/LocationContext";
import { useToggleContext } from "@/context/ToggleContext";
import { Colors } from "@/constants/colors";
import { Image } from "expo-image";
import { FirestoreService, ServiceBooking } from "../../services/firestoreService";
import { FirestoreServiceExtensions } from "../../services/firestoreServiceExtensions";
import { BookingUtils } from "../../utils/bookingUtils";
import ServiceCancellationModal from "../../components/ServiceCancellationModal";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const ITEM_SPACING = 8;
const ITEM_WIDTH = (SCREEN_WIDTH - ITEM_SPACING * 4) / 3;

type FilterStatus = 'all' | 'active' | 'pending' | 'completed' | 'rejected' | 'cancelled';

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

const BuyAgainScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { location } = useLocationContext();
  const { activeMode } = useToggleContext();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // --- Booking History State ---
  const [allBookings, setAllBookings] = useState<ServiceBooking[]>([]);
  const [bookings, setBookings] = useState<ServiceBooking[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'upcoming' | 'past'>('all');
  const [sortOrder, setSortOrder] = useState<'upcomingFirst' | 'newestFirst' | 'oldestFirst'>('upcomingFirst');
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<{id: string, serviceName: string, totalPrice?: number} | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const SERVICE_PAYMENT_RECOVERY_KEY = "service_payment_recovery";
  const activeFilterRef = useRef<FilterStatus>(activeFilter);
  const didRunBackgroundFixesRef = useRef(false);

  const reconcileServicePayments = async () => {
    try {
      const raw = await AsyncStorage.getItem(SERVICE_PAYMENT_RECOVERY_KEY);
      if (!raw) return;

      const recovery = JSON.parse(raw);
      const razorpayOrderId = String(recovery?.razorpayOrderId || "");
      if (!razorpayOrderId) return;

      const api = axios.create({
        timeout: 20000,
        headers: { "Content-Type": "application/json" },
      });

      const user = auth().currentUser;
      if (!user) return;

      const token = await user.getIdToken(true);
      const headers = { Authorization: `Bearer ${token}` };

      const CLOUD_FUNCTIONS_BASE_URL = "https://asia-south1-ninjadeliveries-91007.cloudfunctions.net";
      const httpUrl = (fnName: string) => `${CLOUD_FUNCTIONS_BASE_URL}/${fnName}`;

      const { data } = await api.post(httpUrl('servicePaymentsReconcile'), { orderIds: [razorpayOrderId] }, { headers });

      const finalizedOrderIds: string[] = Array.isArray(data?.finalizedOrderIds)
        ? data.finalizedOrderIds.map((x: any) => String(x))
        : [];
      const isFinalizedForThisOrder = finalizedOrderIds.includes(razorpayOrderId);

      if ((data?.ok && isFinalizedForThisOrder) || (data?.ok && (Number(data?.updatedBookings || 0) > 0 || !!data?.alreadyFinalized)) || (data?.ok && Number(data?.createdBookings || 0) > 0)) {
        await AsyncStorage.removeItem(SERVICE_PAYMENT_RECOVERY_KEY);
      }
    } catch (e) {
      console.warn("reconcile_failed_nonfatal", e);
    }
  };

  useEffect(() => {
    if (activeMode !== 'service' || didRunBackgroundFixesRef.current || allBookings.length === 0) return;
    didRunBackgroundFixesRef.current = true;

    const run = async () => {
      try {
        await reconcileServicePayments();
        const hasIssues = allBookings.some((b: any) => {
          const status = String(b?.status || '').toLowerCase();
          return status === 'reject' || status === 'cancel' || status === 'canceled';
        });
        if (hasIssues) {
          await FirestoreServiceExtensions.fixInconsistentBookingStatuses();
          fetchBuyAgainData();
        }
      } catch (e) {
        console.error('Error running background booking fixes:', e);
      }
    };
    setTimeout(run, 0);
  }, [activeMode, allBookings, fetchBuyAgainData]);

  useEffect(() => {
    activeFilterRef.current = activeFilter;
  }, [activeFilter]);

  const fetchBuyAgainData = useCallback(async () => {
    const currentUser = auth().currentUser;
    if (!currentUser) {
      setProducts([]);
      setAllBookings([]);
      setBookings([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      if (activeMode === 'service') {
        setLoading(true);
        setError(null);
        
        const allUserBookings = await FirestoreService.getSimpleUserBookings(100);
        setAllBookings(allUserBookings);
        
        const filtered = filterBookingsByStatus(allUserBookings, activeFilter);
        setBookings(filtered.slice(0, 50));
        setProducts([]);
      } else {
        // Grocery or Food Products logic
        const [snap1, snap2] = await Promise.all([
          firestore()
            .collection("orders")
            .where("orderedBy", "==", currentUser.uid)
            .get(),
          firestore()
            .collection("orders")
            .where("userId", "==", currentUser.uid)
            .get()
        ]);

        const allDocs = [...snap1.docs, ...snap2.docs];
        
        if (allDocs.length === 0) {
          setProducts([]);
          setLoading(false);
          setRefreshing(false);
          return;
        }

        const allProductIds = new Set<string>();
        const allProductNames = new Set<string>();
        
        allDocs.forEach((doc) => {
          const orderData = doc.data();
          const items: any[] = orderData.items || [];
          items.forEach((it: any) => {
            const id = it.productId || it.productID || it.pId || it.product?.id || it.id;
            const name = it.name || it.productName || it.title || it.product?.name;
            if (id) allProductIds.add(String(id));
            if (name) allProductNames.add(String(name).trim());
          });
        });

        const productIds = Array.from(allProductIds);
        const productNames = Array.from(allProductNames);

        if (productIds.length === 0 && productNames.length === 0) {
          setProducts([]);
          setLoading(false);
          setRefreshing(false);
          return;
        }

        const idChunks: string[][] = [];
        for (let i = 0; i < productIds.length; i += 10) {
          idChunks.push(productIds.slice(i, i + 10));
        }

        const fetchedById: Record<string, any> = {};
        for (const chunk of idChunks) {
          let query = firestore()
            .collection("products")
            .where(firestore.FieldPath.documentId(), "in", chunk);
          
          if (activeMode === 'grocery' && location.storeId) {
            query = query.where("storeId", "==", location.storeId);
          }
          
          const prodSnap = await query.get();
          prodSnap.docs.forEach(doc => {
            fetchedById[doc.id] = { id: doc.id, ...doc.data() };
          });
        }

        const foundNames = new Set(Object.values(fetchedById).map(p => String(p.name).trim()));
        const remainingNames = productNames.filter(name => !foundNames.has(name));

        const nameChunks: string[][] = [];
        for (let i = 0; i < remainingNames.length; i += 10) {
          nameChunks.push(remainingNames.slice(i, i + 10));
        }

        const fetchedByName: Record<string, any> = {};
        for (const chunk of nameChunks) {
          let query = firestore()
            .collection("products")
            .where("name", "in", chunk);
            
          if (activeMode === 'grocery' && location.storeId) {
            query = query.where("storeId", "==", location.storeId);
          }

          const prodSnap = await query.get();
          prodSnap.docs.forEach(doc => {
            fetchedByName[doc.id] = { id: doc.id, ...doc.data() };
          });
        }

        const finalProductsMap = new Map();
        [...Object.values(fetchedById), ...Object.values(fetchedByName)].forEach(p => {
          // If in food mode, only include products that are likely food
          if (activeMode === 'food') {
            const isFood = p.isFood === true || 
                           p.categoryName?.toLowerCase().includes('food') || 
                           p.category?.toLowerCase().includes('food') ||
                           p.isFoodProduct === true;
            if (isFood) {
              finalProductsMap.set(p.id, p);
            }
          } else {
            finalProductsMap.set(p.id, p);
          }
        });

        setProducts(Array.from(finalProductsMap.values()));
        setAllBookings([]);
        setBookings([]);
      }
    } catch (err) {
      console.error("Error fetching buy again data:", err);
      setError("Failed to load your history. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [location.storeId, activeMode, activeFilter]);

  useEffect(() => {
    fetchBuyAgainData();
  }, [fetchBuyAgainData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchBuyAgainData();
  };

  // --- Booking Helpers ---
  const filterBookingsByStatus = (all: ServiceBooking[], status: FilterStatus): ServiceBooking[] => {
    if (status === 'all') return all;
    if (status === 'active') {
      return all.filter((booking) => ['pending', 'assigned', 'started'].includes(booking.status));
    }
    if (status === 'pending') return all.filter((booking) => booking.status === 'pending');
    if (status === 'completed') return all.filter((booking) => booking.status === 'completed');
    if (status === 'rejected') {
      return all.filter((booking) => booking.status === 'rejected' || booking.status === 'reject');
    }
    if (status === 'cancelled') return all.filter((booking) => booking.status === 'cancelled');
    return all.filter((booking) => booking.status === status);
  };

  const getFilterCounts = () => {
    if (allBookings.length > 0) {
      const all = allBookings.length;
      const active = allBookings.filter(b => ['pending', 'assigned', 'started'].includes(b.status)).length;
      const pending = allBookings.filter(b => b.status === 'pending').length;
      const completed = allBookings.filter(b => b.status === 'completed').length;
      const reject = allBookings.filter(b => b.status === 'rejected' || b.status === 'reject').length;
      const cancelled = allBookings.filter(b => b.status === 'cancelled').length;
      return { all, active, pending, completed, reject, cancelled };
    }
    return { all: 0, active: 0, pending: 0, completed: 0, reject: 0, cancelled: 0 };
  };

  const filters: { key: FilterStatus; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'pending', label: 'Pending' },
    { key: 'completed', label: 'Done' },
    { key: 'rejected', label: 'Reject' },
    { key: 'cancelled', label: 'Cancel' },
  ];

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

  const normalizeUnit = (u: any): 'day' | 'week' | 'month' | 'unknown' => {
    const s = String(u || '').trim().toLowerCase();
    if (s === 'day' || s === 'daily') return 'day';
    if (s === 'week' || s === 'weekly') return 'week';
    if (s === 'month' || s === 'monthly') return 'month';
    return 'unknown';
  };

  const groupBookingsForUI = (list: ServiceBooking[]): BookingGroup[] => {
    const planGroups: Record<string, ServiceBooking[]> = {};
    const slotGroups: Record<string, ServiceBooking[]> = {};

    for (const b of list) {
      const companyKey = String(b.companyId || b.companyName || 'company');
      const time = String((b as any)?.time || '');
      const date = String((b as any)?.date || '');
      
      const selectedPackage: any = (b as any)?.selectedPackage;
      const planGroupId = String((b as any)?.planGroupId || '').trim();
      const unit = normalizeUnit((b as any)?.packageType || selectedPackage?.unit || selectedPackage?.type || selectedPackage?.frequency);
      const packageName = String((b as any)?.packageName || selectedPackage?.name || (b as any)?.selectedPackageName || '').trim();
      const packageId = String((b as any)?.packageId || selectedPackage?.id || selectedPackage?.packageId || '').trim();
      const isPackage = (b as any)?.isPackage === true || (b as any)?.isPackageBooking === true || !!planGroupId;

      if (isPackage && (planGroupId || unit !== 'unknown')) {
        const planKey = `${companyKey}|${planGroupId || packageId || packageName || unit}|${time}`;
        const arr = planGroups[planKey] || [];
        arr.push(b);
        planGroups[planKey] = arr;
      } else {
        const slotKey = `${companyKey}|${date}|${time}`;
        const arr = slotGroups[slotKey] || [];
        arr.push(b);
        slotGroups[slotKey] = arr;
      }
    }

    const todayISO = new Date().toISOString().split('T')[0];
    const out: BookingGroup[] = [];

    for (const key of Object.keys(planGroups)) {
      const arr = planGroups[key];
      const sorted = [...arr].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
      const sample = sorted[0];
      const companyName = String(sample.companyName || 'Service Provider');
      const companyId = String(sample.companyId || 'company');
      const time = String((sample as any)?.time || '');
      const { unit, packageName } = (function() {
        const sel: any = (sample as any)?.selectedPackage;
        const u = normalizeUnit((sample as any)?.packageType || sel?.unit || sel?.type || sel?.frequency);
        const pn = String((sample as any)?.packageName || sel?.name || (sample as any)?.selectedPackageName || '').trim();
        return { unit: u, packageName: pn };
      })();

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
      out.push({
        id: `slot:${key}`,
        kind: 'slot',
        companyId: String(sample.companyId || 'company'),
        companyName: String(sample.companyName || 'Service Provider'),
        date: String((sample as any)?.date || ''),
        time: String((sample as any)?.time || ''),
        bookings: sorted,
      });
    }

    return out;
  };

  const groupedBookings = useMemo(() => {
    const todayISO = new Date().toISOString().split('T')[0];
    const base = groupBookingsForUI(bookings);

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

    let list = [...base];

    if (timeFilter !== 'all') {
      const wantUpcoming = timeFilter === 'upcoming';
      list = list.filter((g) => isGroupUpcoming(g) === wantUpcoming);
    }

    if (sortOrder === 'upcomingFirst') {
      list.sort((a, b) => {
        const aUp = isGroupUpcoming(a);
        const bUp = isGroupUpcoming(b);
        if (aUp !== bUp) return aUp ? -1 : 1;
        return aUp ? compareGroupsByDateTimeAsc(a, b) : compareGroupsByDateTimeDesc(a, b);
      });
    } else if (sortOrder === 'newestFirst') {
      list.sort(compareGroupsByDateTimeDesc);
    } else {
      list.sort(compareGroupsByDateTimeAsc);
    }

    return list;
  }, [bookings, timeFilter, sortOrder]);

  const toggleGroupExpansion = (groupId: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const renderProductItem = ({ item }: { item: any }) => (
    <View style={styles.itemContainer}>
      <QuickTile
        p={item}
        isPan={item.categoryId === "panCorner"}
        onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
      />
    </View>
  );

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
                <View key={b.id} style={styles.groupChildRow}>
                  <View style={styles.groupChildDot} />
                  <Text style={styles.groupChildText}>
                    {new Date(b.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} • {b.time}
                  </Text>
                  <Text style={styles.groupChildStatus}>
                    {BookingUtils.getStatusText(b.status)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      );
    }

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

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate("HomeTab");
    }
  };

  const renderServiceMode = () => (
    <View style={styles.mainContent}>
      <View style={styles.sidebar}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sidebarContent}>
          {filters.map((filter) => {
            const isActive = activeFilter === filter.key;
            const count = getFilterCount(filter.key);
            return (
              <TouchableOpacity
                key={filter.key}
                style={[styles.filterTab, isActive && styles.filterTabActive]}
                onPress={() => setActiveFilter(filter.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>{filter.label}</Text>
                {count > 0 && (
                  <View style={[styles.filterBadge, isActive && styles.filterBadgeActive]}>
                    <Text style={[styles.filterBadgeText, isActive && styles.filterBadgeTextActive]}>{count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.bookingsContainer}>
        <View style={styles.sortBar}>
          <View style={styles.sortBarRow}>
            <Text style={styles.sortBarLabel}>Show</Text>
            {([{ key: 'all', label: 'All' }, { key: 'upcoming', label: 'Upcoming' }, { key: 'past', label: 'Past' }] as const).map((opt) => {
              const active = timeFilter === opt.key;
              return (
                <TouchableOpacity key={opt.key} style={[styles.pill, active && styles.pillActive]} onPress={() => setTimeFilter(opt.key)}>
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={[styles.sortBarRow, { marginTop: 8 }]}>
            <Text style={styles.sortBarLabel}>Sort</Text>
            {([{ key: 'upcomingFirst', label: 'Upcoming first' }, { key: 'newestFirst', label: 'Newest' }, { key: 'oldestFirst', label: 'Oldest' }] as const).map((opt) => {
              const active = sortOrder === opt.key;
              return (
                <TouchableOpacity key={opt.key} style={[styles.pill, active && styles.pillActive]} onPress={() => setSortOrder(opt.key)}>
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <FlatList
          data={groupedBookings}
          keyExtractor={(item) => item.id}
          renderItem={renderGroup}
          contentContainerStyle={{ paddingBottom: 5, paddingTop: 12, paddingHorizontal: 8 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#3b82f6']} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={64} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>No Bookings Found</Text>
              <Text style={styles.emptySubtitle}>You haven't made any service bookings yet.</Text>
              <TouchableOpacity style={styles.shopNowButton} onPress={() => navigation.navigate("HomeTab")}>
                <Text style={styles.shopNowText}>Browse Services</Text>
              </TouchableOpacity>
            </View>
          }
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <MaterialIcons name="arrow-back" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>{activeMode === 'service' ? 'Bookings' : 'Buy Again'}</Text>
            {activeMode === 'service' && <Text style={styles.headerSubtitle}>Track, manage, and review</Text>}
          </View>
          {activeMode === 'service' && (
            <View style={styles.headerRight}>
              <View style={styles.headerChip}>
                <Ionicons name="calendar-outline" size={14} color="#1D4ED8" />
                <Text style={styles.headerChipText}>{allBookings.length}</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : activeMode === 'service' ? (
        renderServiceMode()
      ) : (
        <FlatList
          data={products}
          renderItem={renderProductItem}
          numColumns={3}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.columnWrapper}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="history" size={64} color="#ccc" />
              <Text style={styles.emptyTitle}>No Recent Orders Found</Text>
              <Text style={styles.emptySubtitle}>Items you've ordered before will appear here for quick reordering.</Text>
              <TouchableOpacity style={styles.shopNowButton} onPress={() => navigation.navigate("HomeTab")}>
                <Text style={styles.shopNowText}>Start Shopping</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background.default,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.text.primary,
  },
  listContent: {
    paddingHorizontal: ITEM_SPACING,
    paddingTop: 16,
    paddingBottom: 24,
  },
  columnWrapper: {
    justifyContent: "flex-start",
  },
  itemContainer: {
    width: ITEM_WIDTH,
    marginBottom: 20,
    marginHorizontal: ITEM_SPACING / 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.text.muted,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  shopNowButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  shopNowText: {
    color: Colors.white,
    fontWeight: "700",
    fontSize: 16,
  },
  // --- Booking History Styles ---
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
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
  mainContent: {
    flex: 1,
    flexDirection: "row",
  },
  sidebar: {
    width: 100,
    backgroundColor: "#ffffff",
    borderRightWidth: 1,
    borderRightColor: "#e2e8f0",
  },
  sidebarContent: {
    paddingVertical: 20,
    paddingHorizontal: 8,
  },
  filterTab: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#e2e8f0",
    alignItems: "center",
  },
  filterTabActive: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  filterTabText: {
    fontSize: 12,
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
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: "center",
  },
  filterBadgeActive: {
    backgroundColor: "#ffffff",
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748b",
  },
  filterBadgeTextActive: {
    color: "#3b82f6",
  },
  bookingsContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  sortBar: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginHorizontal: 8,
    marginTop: 10,
    marginBottom: 8,
  },
  sortBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  sortBarLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
    marginRight: 4,
  },
  pill: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillActive: {
    borderColor: '#2563EB',
    backgroundColor: '#DBEAFE',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
  },
  pillTextActive: {
    color: '#1D4ED8',
  },
  groupCardWrap: {
    marginBottom: 10,
  },
  groupCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  groupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  groupIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  groupSubtitle: {
    marginTop: 2,
    fontSize: 11,
    color: '#64748B',
  },
  groupRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
  },
  groupCountPill: {
    minWidth: 28,
    paddingHorizontal: 8,
    height: 20,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupCountPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3730A3',
  },
  groupChildren: {
    marginTop: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 6,
  },
  groupChildTouchable: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  groupChildRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  groupChildDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#94A3B8',
    marginRight: 8,
  },
  groupChildText: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
  },
  groupChildStatus: {
    fontSize: 11,
    color: '#64748B',
    marginLeft: 8,
  },
});

export default BuyAgainScreen;
