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

      // DEBUG: Check current user first
      console.log('👤 DEBUG: Checking current user...');
      await FirestoreService.debugCurrentUser();
      
      // DEBUG: Show all user bookings
      console.log('🔍 DEBUG: Checking all bookings for current user...');
      await FirestoreService.debugAllUserBookings();
      
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

  const renderFilterTabs = () => {
    const counts = getFilterCounts();
    const filters: { key: FilterStatus; label: string; count: number; icon: string; color: string; gradient: string[] }[] = [
      { key: 'all', label: 'All', count: counts.all, icon: 'apps', color: '#6366F1', gradient: ['#6366F1', '#8B5CF6'] },
      { key: 'active', label: 'Active', count: counts.active, icon: 'pulse', color: '#10B981', gradient: ['#10B981', '#059669'] },
      { key: 'pending', label: 'Pending', count: counts.pending, icon: 'time', color: '#F59E0B', gradient: ['#F59E0B', '#D97706'] },
      { key: 'completed', label: 'Done', count: counts.completed, icon: 'checkmark-circle', color: '#059669', gradient: ['#059669', '#047857'] },
      { key: 'rejected', label: 'Reject', count: counts.reject, icon: 'close-circle', color: '#EF4444', gradient: ['#EF4444', '#DC2626'] },
      { key: 'cancelled', label: 'Cancel', count: counts.cancelled, icon: 'remove-circle', color: '#F97316', gradient: ['#F97316', '#EA580C'] },
    ];

    return (
      <View style={styles.filterContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScrollContainer}
          decelerationRate="fast"
          snapToInterval={112} // Approximate tab width + gap
          snapToAlignment="start"
        >
          {filters.map((filter, index) => {
            const isActive = activeFilter === filter.key;
            const animatedScale = tabAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0.95],
            });

            return (
              <Animated.View
                key={filter.key}
                style={[
                  { transform: [{ scale: isActive ? animatedScale : 1 }] }
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.filterTab,
                    isActive && styles.activeFilterTab,
                    isActive && { 
                      backgroundColor: filter.color,
                      shadowColor: filter.color,
                    }
                  ]}
                  onPress={() => handleFilterChange(filter.key)}
                  activeOpacity={0.8}
                >
                  <View style={styles.tabContent}>
                    <View style={[
                      styles.tabIconContainer,
                      isActive && styles.activeTabIconContainer
                    ]}>
                      <Ionicons 
                        name={filter.icon as any} 
                        size={16} 
                        color={isActive ? '#FFFFFF' : filter.color} 
                      />
                    </View>
                    
                    <View style={styles.tabTextContainer}>
                      <Text style={[
                        styles.filterText,
                        isActive && styles.activeFilterText
                      ]}>
                        {filter.label}
                      </Text>
                      
                      {filter.count > 0 && (
                        <View style={[
                          styles.countBadge,
                          isActive && styles.activeCountBadge
                        ]}>
                          <Text style={[
                            styles.countText,
                            isActive && styles.activeCountText
                          ]}>
                            {filter.count}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </ScrollView>
      </View>
    );
  };

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

  const renderItem = ({ item }: { item: ServiceBooking }) => {
    const isActive = BookingUtils.isActiveBooking(item.status);
    const statusColor = BookingUtils.getStatusColor(item.status);
    const statusText = BookingUtils.getStatusText(item.status);
    const formattedDate = BookingUtils.formatBookingDate(item.date);
    const formattedTime = BookingUtils.formatBookingTime(item.time);
    const canReject = ['pending', 'assigned'].includes(item.status);

    return (
      <TouchableOpacity 
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => navigation.navigate("TrackBooking", {
          bookingId: item.id,
          serviceTitle: item.serviceName,
          selectedDate: formattedDate,
          selectedTime: formattedTime,
          company: { name: item.technicianName || "Service Provider" },
          issues: [item.workName],
          totalPrice: item.totalPrice || 0,
          bookingType: "service",
          paymentMethod: "cash",
          notes: item.workName,
        })}
      >
        <View style={styles.cardContent}>
          {/* Service Icon */}
          <View style={[styles.iconContainer, { backgroundColor: statusColor + '15' }]}>
            <Ionicons 
              name="construct" 
              size={24} 
              color={statusColor} 
            />
          </View>
          
          <View style={styles.details}>
            {/* Header with service name and status */}
            <View style={styles.cardHeader}>
              <Text style={styles.service} numberOfLines={1}>{item.serviceName}</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                <Text style={styles.statusText}>{statusText}</Text>
              </View>
            </View>
            
            {/* Work description */}
            <Text style={styles.issue} numberOfLines={2}>{item.workName}</Text>
            
            {/* Customer info */}
            <View style={styles.customerRow}>
              <Ionicons name="person-outline" size={14} color="#6B7280" />
              <Text style={styles.customer}>{item.customerName}</Text>
            </View>
            
            {/* Date and time */}
            <View style={styles.timeInfo}>
              <View style={styles.dateTimeItem}>
                <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                <Text style={styles.dateTime}>{new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
              </View>
              <View style={styles.dateTimeItem}>
                <Ionicons name="time-outline" size={14} color="#6B7280" />
                <Text style={styles.dateTime}>{item.time}</Text>
              </View>
            </View>

            {/* Show completion OTP for started services */}
            {item.status === 'started' && (item.completionOtp || item.startOtp) && (
              <View style={styles.otpContainer}>
                <Ionicons name="key" size={12} color="#3B82F6" />
                <Text style={styles.otpText}>
                  OTP: {item.completionOtp || item.startOtp}
                </Text>
              </View>
            )}

            {/* Action buttons for cancellable bookings */}
            {canReject && (
              <View style={styles.actionButtonsContainer}>
                <TouchableOpacity
                  style={styles.rejectButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleRejectBooking(item.id, item.serviceName, item.totalPrice);
                  }}
                  activeOpacity={0.9}
                >
                  <View style={styles.rejectButtonContent}>
                    <Ionicons name="close-outline" size={14} color="#FF4757" />
                    <Text style={styles.rejectButtonText}>Cancel</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {/* Bottom row with booking ID and price */}
            <View style={styles.bottomRow}>
              <Text style={styles.bookingId}>#{item.id?.substring(0, 8)}</Text>
              {item.totalPrice && (
                <Text style={styles.price}>₹{item.totalPrice}</Text>
              )}
            </View>
          </View>

          {/* Arrow indicator */}
          <View style={styles.arrowContainer}>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking History</Text>
        <View style={{ width: 24 }} />
      </View>

      {renderFilterTabs()}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6D28D9" />
          <Text style={styles.loadingText}>Loading booking history...</Text>
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
          data={bookings}
          keyExtractor={(item) => item.id || ''}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 100, paddingTop: 10 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#6D28D9']}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

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

      <TouchableOpacity
        style={styles.backBtn}
        activeOpacity={0.9}
        onPress={() => navigation.navigate("ServicesHome")}
      >
        <Text style={styles.backText}>Back to Services</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#F8FAFC",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1F2937",
  },

  filterContainer: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 20,
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

  filterTab: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 18,
    minWidth: 100,
    borderWidth: 2,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
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
    marginHorizontal: 16,
    marginBottom: 12,
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
    padding: 16,
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

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },

  service: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
    flex: 1,
    marginRight: 8,
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },

  statusText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  issue: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 8,
    lineHeight: 20,
  },

  customerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },

  customer: {
    fontSize: 13,
    color: "#6B7280",
    marginLeft: 6,
  },

  timeInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },

  dateTimeItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },

  dateTime: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
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
  },

  bookingId: {
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "600",
    fontFamily: "monospace",
  },

  price: {
    fontSize: 16,
    color: "#059669",
    fontWeight: "700",
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
