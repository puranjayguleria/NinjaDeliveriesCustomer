import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { FirestoreService, ServiceBooking } from "../services/firestoreService";
import { BookingUtils } from "../utils/bookingUtils";
import { firestore } from '../firebase.native';

interface TrackingStep {
  id: string;
  title: string;
  description: string;
  timestamp?: string;
  status: "completed" | "current" | "pending";
  icon: keyof typeof Ionicons.glyphMap;
}

export default function TrackBookingScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  
  const { bookingId } = route.params || {};
  
  const [booking, setBooking] = useState<ServiceBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Fetch booking data from Firebase
  const fetchBookingData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      if (!bookingId) {
        throw new Error('Booking ID is required');
      }

      console.log('🔍 Fetching booking data for ID:', bookingId);
      const bookingData = await FirestoreService.getServiceBookingById(bookingId);
      
      if (!bookingData) {
        throw new Error('Booking not found');
      }

      setBooking(bookingData);
      setLastUpdated(new Date());
      console.log('✅ Booking data fetched:', bookingData);
      console.log('📊 Current status:', bookingData.status);
    } catch (err: any) {
      console.error('❌ Error fetching booking:', err);
      setError(err?.message || 'Failed to load booking details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!bookingId) {
      setError('Booking ID is required');
      setLoading(false);
      return;
    }

    console.log('🔥 Setting up real-time listener for booking:', bookingId);
    
    // Set up real-time Firebase listener
    const unsubscribe = firestore()
      .collection('service_bookings')
      .doc(bookingId)
      .onSnapshot(
        (doc) => {
          console.log('📡 Real-time update received for booking:', bookingId);
          
          if (doc.exists) {
            const data = doc.data();
            const bookingData: ServiceBooking = {
              id: doc.id,
              companyId: data?.companyId || '',
              customerName: data?.customerName || '',
              serviceName: data?.serviceName || '',
              date: data?.date || '',
              time: data?.time || '',
              status: data?.status || 'pending',
              phone: data?.phone || '',
              address: data?.address || '',
              totalPrice: data?.totalPrice || 0,
              addOns: data?.addOns || [],
              startOtp: data?.startOtp || null,
              otpVerified: data?.otpVerified || false,
              technicianName: data?.technicianName || null,
              workName: data?.workName || `${data?.serviceName} service`,
              otherVerified: data?.otherVerified || false,
              createdAt: data?.createdAt,
              startedAt: data?.startedAt,
              completedAt: data?.completedAt,
              expiredAt: data?.expiredAt,
            };
            
            console.log('✅ Real-time booking data updated:', {
              id: bookingData.id,
              status: bookingData.status,
              technicianName: bookingData.technicianName,
              startOtp: bookingData.startOtp
            });
            
            setBooking(bookingData);
            setLastUpdated(new Date());
            setError(null);
            setLoading(false);
          } else {
            console.log('❌ Booking document does not exist');
            setError('Booking not found');
            setBooking(null);
            setLoading(false);
          }
        },
        (error) => {
          console.error('❌ Real-time listener error:', error);
          setError('Failed to load booking details');
          setLoading(false);
        }
      );

    // Cleanup listener on unmount
    return () => {
      console.log('🧹 Cleaning up real-time listener');
      unsubscribe();
    };
  }, [bookingId]);

  const onRefresh = () => {
    console.log('🔄 Manual refresh triggered');
    fetchBookingData(true);
  };

  // Generate tracking steps based on actual booking status
  const generateTrackingSteps = (booking: ServiceBooking): TrackingStep[] => {
    const formatTimestamp = (timestamp: any) => {
      if (!timestamp) return undefined;
      
      try {
        // Handle Firestore timestamp
        if (timestamp && typeof timestamp.toDate === 'function') {
          return timestamp.toDate().toLocaleString();
        }
        // Handle regular Date object
        if (timestamp instanceof Date) {
          return timestamp.toLocaleString();
        }
        // Handle string timestamp
        if (typeof timestamp === 'string') {
          return new Date(timestamp).toLocaleString();
        }
        return undefined;
      } catch (error) {
        console.log('Error formatting timestamp:', error);
        return undefined;
      }
    };

    const steps: TrackingStep[] = [
      {
        id: "confirmed",
        title: "Booking Confirmed",
        description: `Your ${booking.serviceName} service has been booked`,
        timestamp: formatTimestamp(booking.createdAt),
        status: "completed",
        icon: "checkmark-circle",
      },
      {
        id: "assigned",
        title: "Technician Assigned",
        description: booking.technicianName 
          ? `${booking.technicianName} has been assigned to your service`
          : "Waiting for technician assignment",
        timestamp: ['assigned', 'started', 'completed'].includes(booking.status) 
          ? formatTimestamp(booking.createdAt) || "Assigned" : undefined,
        status: booking.status === 'pending' ? "pending" : "completed",
        icon: "person",
      },
      {
        id: "started",
        title: "Service Started",
        description: booking.status === 'started' 
          ? `${booking.technicianName || 'Technician'} has started working on your service`
          : "Service will start soon",
        timestamp: formatTimestamp(booking.startedAt),
        status: booking.status === 'started' ? "current" : 
               booking.status === 'completed' ? "completed" : "pending",
        icon: "construct",
      },
      {
        id: "completed",
        title: "Service Completed",
        description: booking.status === 'completed' 
          ? "Your service has been completed successfully"
          : "Service completion pending",
        timestamp: formatTimestamp(booking.completedAt),
        status: booking.status === 'completed' ? "completed" : "pending",
        icon: "checkmark-done",
      },
    ];

    // Handle rejected/expired status
    if (booking.status === 'rejected' || booking.status === 'expired') {
      steps.push({
        id: "cancelled",
        title: booking.status === 'rejected' ? "Booking Rejected" : "Booking Expired",
        description: booking.status === 'rejected' 
          ? "This booking has been rejected"
          : "This booking has expired",
        timestamp: formatTimestamp(booking.expiredAt),
        status: "completed",
        icon: "close-circle",
      });
    }

    return steps;
  };

  const getProgressPercentage = (status: ServiceBooking['status']): number => {
    switch (status) {
      case 'pending': return 25;
      case 'assigned': return 50;
      case 'started': return 75;
      case 'completed': return 100;
      case 'rejected':
      case 'expired': return 100;
      default: return 0;
    }
  };

  const getStatusMessage = (booking: ServiceBooking): string => {
    switch (booking.status) {
      case 'pending':
        return `Your ${booking.serviceName} service is confirmed for ${booking.date} at ${booking.time}. We'll assign a technician soon.`;
      case 'assigned':
        return `${booking.technicianName || 'A technician'} has been assigned to your service scheduled for ${booking.date} at ${booking.time}.`;
      case 'started':
        return `${booking.technicianName || 'The technician'} has started working on your ${booking.serviceName} service.`;
      case 'completed':
        return `Your ${booking.serviceName} service has been completed successfully. Thank you for choosing our service!`;
      case 'rejected':
        return `Unfortunately, your booking has been rejected. Please contact support for assistance.`;
      case 'expired':
        return `This booking has expired. Please create a new booking if you still need the service.`;
      default:
        return 'Booking status unknown. Please contact support.';
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Track Booking</Text>
        </View>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading booking details...</Text>
        </View>
      </View>
    );
  }

  if (error || !booking) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Track Booking</Text>
        </View>
        
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#ef4444" />
          <Text style={styles.errorTitle}>Booking Not Found</Text>
          <Text style={styles.errorText}>{error || 'Unable to load booking details'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchBookingData()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const trackingSteps = generateTrackingSteps(booking);
  const progress = getProgressPercentage(booking.status);
  const statusMessage = getStatusMessage(booking);
  const statusColor = BookingUtils.getStatusColor(booking.status);
  const statusIcon = BookingUtils.getStatusIcon(booking.status);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Track Booking</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={onRefresh}
          disabled={refreshing}
        >
          <View style={styles.refreshContainer}>
            <Ionicons 
              name="refresh" 
              size={20} 
              color={refreshing ? "#ccc" : "#2563eb"} 
            />
            <View style={[styles.liveIndicator, { backgroundColor: '#10b981' }]} />
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2563eb']}
          />
        }
      >
        {/* Booking Info Card */}
        <View style={styles.bookingCard}>
          <View style={styles.bookingHeader}>
            <View>
              <Text style={styles.bookingId}>#{booking.id?.substring(0, 8)}...</Text>
              <Text style={styles.lastUpdated}>
                Last updated: {lastUpdated.toLocaleTimeString()}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
              <Text style={styles.statusIcon}>{statusIcon}</Text>
              <Text style={styles.statusText}>{BookingUtils.getStatusText(booking.status)}</Text>
            </View>
          </View>
          
          <Text style={styles.serviceName}>{booking.serviceName}</Text>
          <Text style={styles.customerName}>Customer: {booking.customerName}</Text>
          
          <View style={styles.bookingDetails}>
            <View style={styles.detailRow}>
              <Ionicons name="calendar" size={16} color="#666" />
              <Text style={styles.detailText}>{BookingUtils.formatBookingDate(booking.date)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="time" size={16} color="#666" />
              <Text style={styles.detailText}>{BookingUtils.formatBookingTime(booking.time)}</Text>
            </View>
            {booking.technicianName && (
              <View style={styles.detailRow}>
                <Ionicons name="person" size={16} color="#666" />
                <Text style={styles.detailText}>{booking.technicianName}</Text>
              </View>
            )}
            {booking.totalPrice && (
              <View style={styles.detailRow}>
                <Ionicons name="cash" size={16} color="#666" />
                <Text style={styles.detailText}>₹{booking.totalPrice}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressText}>{progress}% Complete</Text>
        </View>

        {/* Status Message */}
        <View style={styles.messageCard}>
          <Text style={styles.messageText}>{statusMessage}</Text>
        </View>

        {/* Tracking Steps */}
        <View style={styles.trackingContainer}>
          <Text style={styles.trackingTitle}>Booking Timeline</Text>
          
          {trackingSteps.map((step, index) => (
            <View key={step.id} style={styles.stepContainer}>
              <View style={styles.stepIndicator}>
                <View style={[
                  styles.stepIcon,
                  step.status === 'completed' && styles.stepIconCompleted,
                  step.status === 'current' && styles.stepIconCurrent,
                ]}>
                  <Ionicons 
                    name={step.icon} 
                    size={20} 
                    color={
                      step.status === 'completed' ? '#fff' :
                      step.status === 'current' ? '#fff' : '#ccc'
                    } 
                  />
                </View>
                {index < trackingSteps.length - 1 && (
                  <View style={[
                    styles.stepLine,
                    step.status === 'completed' && styles.stepLineCompleted
                  ]} />
                )}
              </View>
              
              <View style={styles.stepContent}>
                <Text style={[
                  styles.stepTitle,
                  step.status === 'current' && styles.stepTitleCurrent
                ]}>
                  {step.title}
                </Text>
                <Text style={styles.stepDescription}>{step.description}</Text>
                {step.timestamp && (
                  <Text style={styles.stepTimestamp}>{step.timestamp}</Text>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* OTP Section (if service is started) */}
        {booking.status === 'started' && booking.startOtp && (
          <View style={styles.otpCard}>
            <Text style={styles.otpTitle}>Service Verification</Text>
            <Text style={styles.otpDescription}>
              Your technician will use this OTP to complete the service:
            </Text>
            <Text style={styles.otpCode}>{booking.startOtp}</Text>
          </View>
        )}

        {/* Contact Support */}
        <TouchableOpacity style={styles.supportButton}>
          <Ionicons name="headset" size={20} color="#2563eb" />
          <Text style={styles.supportText}>Contact Support</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  
  backButton: {
    padding: 8,
  },
  
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0f172a",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 16,
  },
  
  refreshButton: {
    padding: 8,
    position: "relative",
  },
  
  refreshContainer: {
    position: "relative",
  },
  
  liveIndicator: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#fff",
  },
  
  content: {
    flex: 1,
    padding: 16,
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
    fontSize: 16,
    color: "#64748b",
    fontWeight: "500",
  },
  
  // Error states
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  
  errorTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#0f172a",
    marginTop: 16,
    marginBottom: 8,
  },
  
  errorText: {
    fontSize: 16,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
  },
  
  retryButton: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  
  retryText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  
  // Booking card
  bookingCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  
  bookingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  
  bookingId: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
  },
  
  lastUpdated: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "400",
    marginTop: 2,
  },
  
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  
  statusIcon: {
    marginRight: 4,
    fontSize: 12,
  },
  
  statusText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  
  serviceName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  
  customerName: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 16,
  },
  
  bookingDetails: {
    gap: 8,
  },
  
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  
  detailText: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
  },
  
  // Progress bar
  progressContainer: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  
  progressBar: {
    height: 8,
    backgroundColor: "#e2e8f0",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  
  progressFill: {
    height: "100%",
    backgroundColor: "#2563eb",
    borderRadius: 4,
  },
  
  progressText: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
    textAlign: "center",
  },
  
  // Message card
  messageCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  
  messageText: {
    fontSize: 16,
    color: "#374151",
    lineHeight: 24,
    textAlign: "center",
  },
  
  // Tracking steps
  trackingContainer: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  
  trackingTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 20,
  },
  
  stepContainer: {
    flexDirection: "row",
    marginBottom: 20,
  },
  
  stepIndicator: {
    alignItems: "center",
    marginRight: 16,
  },
  
  stepIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  
  stepIconCompleted: {
    backgroundColor: "#10b981",
  },
  
  stepIconCurrent: {
    backgroundColor: "#2563eb",
  },
  
  stepLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#e2e8f0",
  },
  
  stepLineCompleted: {
    backgroundColor: "#10b981",
  },
  
  stepContent: {
    flex: 1,
    paddingTop: 8,
  },
  
  stepTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 4,
  },
  
  stepTitleCurrent: {
    color: "#2563eb",
  },
  
  stepDescription: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 20,
    marginBottom: 4,
  },
  
  stepTimestamp: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "500",
  },
  
  // OTP card
  otpCard: {
    backgroundColor: "#fef3c7",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#fbbf24",
  },
  
  otpTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#92400e",
    marginBottom: 8,
  },
  
  otpDescription: {
    fontSize: 14,
    color: "#92400e",
    marginBottom: 12,
  },
  
  otpCode: {
    fontSize: 24,
    fontWeight: "700",
    color: "#92400e",
    textAlign: "center",
    backgroundColor: "#fff",
    paddingVertical: 12,
    borderRadius: 8,
    letterSpacing: 4,
  },
  
  // Support button
  supportButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 32,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  
  supportText: {
    fontSize: 16,
    color: "#2563eb",
    fontWeight: "600",
    marginLeft: 8,
  },
});