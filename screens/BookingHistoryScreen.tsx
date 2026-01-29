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
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { FirestoreService, ServiceBooking } from "../services/firestoreService";
import { BookingUtils } from "../utils/bookingUtils";

export default function BookingHistoryScreen() {
  const navigation = useNavigation<any>();
  const [bookings, setBookings] = useState<ServiceBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch bookings from Firebase
  const fetchBookings = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const fetchedBookings = await FirestoreService.getServiceBookings(20);
      setBookings(fetchedBookings);
      
      console.log(`Fetched ${fetchedBookings.length} bookings from Firebase`);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      setError('Failed to load booking history. Please check your internet connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const onRefresh = () => {
    fetchBookings(true);
  };

  const renderItem = ({ item }: { item: ServiceBooking }) => {
    const isActive = BookingUtils.isActiveBooking(item.status);
    const statusColor = BookingUtils.getStatusColor(item.status);
    const statusText = BookingUtils.getStatusText(item.status);
    const formattedDate = BookingUtils.formatBookingDate(item.date);
    const formattedTime = BookingUtils.formatBookingTime(item.time);

    return (
      <TouchableOpacity 
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => navigation.navigate("TrackBooking", {
          bookingId: item.id,
          serviceTitle: `${item.serviceName} - ${item.workName}`,
          selectedDate: formattedDate,
          selectedTime: formattedTime,
          company: { name: item.customerName }, // You might want to fetch company details
          issues: item.workName.split(', '),
          totalPrice: 299, // You might want to add price to booking data
          bookingType: item.serviceName.toLowerCase(),
          paymentMethod: "cash",
          notes: item.workName,
        })}
      >
        <View style={styles.cardContent}>
          <View style={styles.iconContainer}>
            <Image 
              source={require("../assets/images/icon_home_repair.png")} 
              style={styles.icon}
            />
          </View>
          
          <View style={styles.details}>
            <View style={styles.cardHeader}>
              <Text style={styles.service}>{item.serviceName}</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                <Text style={styles.statusText}>{statusText}</Text>
              </View>
            </View>
            
            <Text style={styles.issue}>{item.workName}</Text>
            <Text style={styles.customer}>Customer: {item.customerName}</Text>
            
            <View style={styles.timeInfo}>
              <Text style={styles.date}>{formattedDate}</Text>
              <Text style={styles.time}>{formattedTime}</Text>
            </View>
            
            <Text style={styles.bookingId}>Booking ID: {item.id?.substring(0, 8)}...</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Booking History</Text>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6D28D9" />
          <Text style={styles.loadingText}>Loading booking history...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchBookings()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : bookings.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No Bookings Found</Text>
          <Text style={styles.emptyText}>You haven't made any service bookings yet.</Text>
          <TouchableOpacity
            style={styles.browseButton}
            onPress={() => navigation.navigate("ServicesHome")}
          >
            <Text style={styles.browseText}>Browse Services</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          style={{ marginTop: 14 }}
          data={bookings}
          keyExtractor={(item) => item.id || ''}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 100 }}
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
    backgroundColor: "#fff", 
    padding: 16,
    paddingTop: 50,
  },

  header: { 
    fontSize: 22, 
    fontWeight: "900",
    marginBottom: 20,
  },

  card: {
    backgroundColor: "#f6f6f6",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },

  cardContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },

  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },

  icon: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },

  details: {
    flex: 1,
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },

  service: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
    flex: 1,
  },

  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },

  statusText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#fff",
  },

  issue: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },

  customer: {
    fontSize: 12,
    color: "#888",
    marginBottom: 8,
  },

  timeInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },

  date: {
    fontSize: 12,
    color: "#555",
    fontWeight: "600",
  },

  time: {
    fontSize: 12,
    color: "#555",
    fontWeight: "600",
  },

  bookingId: {
    fontSize: 10,
    color: "#999",
    fontStyle: "italic",
  },

  // Loading states
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 50,
  },

  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
    fontWeight: "500",
  },

  // Error states
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 50,
    paddingHorizontal: 20,
  },

  errorText: {
    fontSize: 16,
    color: "#ef4444",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 24,
  },

  retryButton: {
    backgroundColor: "#6D28D9",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },

  retryText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },

  // Empty states
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 50,
    paddingHorizontal: 20,
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
    marginBottom: 12,
  },

  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 24,
  },

  browseButton: {
    backgroundColor: "#6D28D9",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },

  browseText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },

  backBtn: {
    position: "absolute",
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: "#6D28D9",
    paddingVertical: 14,
    borderRadius: 16,
  },

  backText: {
    color: "white",
    fontWeight: "900",
    textAlign: "center",
    fontSize: 14,
  },
});
