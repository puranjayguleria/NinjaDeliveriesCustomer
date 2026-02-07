import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Animated,
  TextInput,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { FirestoreService, ServiceBooking } from "../services/firestoreService";
import { BookingUtils } from "../utils/bookingUtils";
import TechnicianInfo from "../components/TechnicianInfo";
import ServiceCancellationModal from "../components/ServiceCancellationModal";
import BookingRejectionModal from "../components/BookingRejectionModal";
import AddOnServicesModal from "../components/AddOnServicesModal";

type BookingStatus = ServiceBooking['status'];

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

  // State for real booking data
  const [booking, setBooking] = useState<ServiceBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Rating and Feedback states
  const [userRating, setUserRating] = useState<number>(0);
  const [userFeedback, setUserFeedback] = useState<string>("");
  const [ratingLoading, setRatingLoading] = useState(false);
  const [hasAlreadyRated, setHasAlreadyRated] = useState(false);
  const [checkingRatingStatus, setCheckingRatingStatus] = useState(false);
  const [workerPhone, setWorkerPhone] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>("");
  const [animatedProgress] = useState(new Animated.Value(0));
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [previousStatus, setPreviousStatus] = useState<BookingStatus | null>(null);
  const [showAddOnModal, setShowAddOnModal] = useState(false);
  const [categoryId, setCategoryId] = useState<string>("");
  const [addOnServices, setAddOnServices] = useState<any[]>([]);
  const [totalWithAddOns, setTotalWithAddOns] = useState<number>(0);

  // Helper function to determine category ID based on service name
  const determineCategoryId = async (serviceName: string) => {
    try {
      // Fetch all categories and find the one that matches the service
      const categories = await FirestoreService.getServiceCategories();
      
      // Simple matching logic - you might need to improve this based on your data structure
      const matchingCategory = categories.find(category => 
        serviceName.toLowerCase().includes(category.name.toLowerCase()) ||
        category.name.toLowerCase().includes(serviceName.toLowerCase())
      );

      if (matchingCategory) {
        setCategoryId(matchingCategory.id);
        console.log(`📱 Found matching category: ${matchingCategory.name} (${matchingCategory.id})`);
      } else {
        console.log(`📱 No matching category found for service: ${serviceName}`);
      }
    } catch (error) {
      console.error("Error determining category ID:", error);
    }
  };

  // Helper function to check if technician is assigned
  const isTechnicianAssigned = (): boolean => {
    if (!booking) return false;
    
    // Check multiple conditions to determine if technician is assigned
    const hasAssignedStatus = booking.status === 'assigned' || 
                             booking.status === 'started' || 
                             booking.status === 'completed';
    
    const hasTechnicianInfo = !!(booking.technicianName || 
                                booking.technicianId || 
                                booking.workerName || 
                                booking.workerId);
    
    const hasAssignmentTimestamp = !!booking.assignedAt;
    
    // Technician is considered assigned if any of these conditions are met
    const isAssigned = hasAssignedStatus || hasTechnicianInfo || hasAssignmentTimestamp;
    
    console.log(`🔍 Checking technician assignment:`, {
      status: booking.status,
      hasAssignedStatus,
      hasTechnicianInfo,
      hasAssignmentTimestamp,
      technicianName: booking.technicianName,
      workerName: booking.workerName,
      isAssigned
    });
    
    return isAssigned;
  };

  const handleAddOnServices = () => {
    if (!categoryId) {
      Alert.alert(
        "Category Not Found", 
        "Unable to determine service category for add-on services."
      );
      return;
    }
    setShowAddOnModal(true);
  };

  const handleAddServicesConfirm = async (selectedServices: any[]) => {
    try {
      // Add-on services are now handled with immediate payment in the modal
      // This function is called after successful payment
      setAddOnServices(selectedServices);
      const addOnTotal = selectedServices.reduce((sum, service) => sum + service.price, 0);
      const newTotal = (booking?.totalPrice || 0) + addOnTotal;
      setTotalWithAddOns(newTotal);
      
      console.log(`✅ Add-on services confirmed with payment: ${selectedServices.length} services, ₹${addOnTotal}`);
      
      // Refresh booking data to show updated add-ons
      if (bookingId) {
        try {
          const updatedBooking = await FirestoreService.getServiceBookingById(bookingId);
          if (updatedBooking) {
            setBooking(updatedBooking);
            console.log("✅ Refreshed booking data with add-ons");
          }
        } catch (refreshError) {
          console.error("Error refreshing booking data:", refreshError);
        }
      }
      
    } catch (error) {
      console.error("Error handling add-on services confirmation:", error);
      Alert.alert("Error", "Failed to confirm add-on services. Please try again.");
    }
  };

  // Fetch company phone number for calling
  const fetchCompanyPhone = async (companyId: string) => {
    if (!companyId) return;
    
    try {
      console.log(`📞 Fetching company phone for ID: ${companyId}`);
      
      // Import firestore from the firebase config
      const { firestore } = require('../firebase.native');
      
      const companyDoc = await firestore()
        .collection('service_company')
        .doc(companyId)
        .get();
      
      if (companyDoc.exists) {
        const companyData = companyDoc.data();
        const phone = companyData?.phone || 
                     companyData?.contactPhone || 
                     companyData?.mobile || 
                     companyData?.phoneNumber || 
                     companyData?.contactNumber || 
                     "";
        
        const name = companyData?.companyName || 
                    companyData?.name || 
                    companyData?.businessName ||
                    `Company ${companyId}`;
        
        setWorkerPhone(phone); // Reusing the same state variable for simplicity
        setCompanyName(name);
        console.log(`📞 Company phone found: ${phone}, Name: ${name}`);
      } else {
        console.log(`📞 No company document found for ID: ${companyId}`);
        setCompanyName(`Company ${companyId}`);
      }
    } catch (error) {
      console.error(`📞 Error fetching company phone:`, error);
      setCompanyName(`Company ${companyId}`);
    }
  };

  const handleCallCompany = () => {
    if (!workerPhone) {
      Alert.alert(
        "Phone Number Not Available", 
        `Sorry, we don't have a phone number for the service provider. Please contact support for assistance.`,
        [{ text: "OK" }]
      );
      return;
    }

    Alert.alert(
      "Call Service Provider",
      `Call service provider at ${workerPhone}?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Call", 
          onPress: () => {
            console.log(`📞 Calling service provider at ${workerPhone}`);
            Linking.openURL(`tel:${workerPhone}`).catch((error) => {
              console.error('📞 Error making phone call:', error);
              Alert.alert("Error", "Unable to make phone call. Please try again.");
            });
          }
        },
      ]
    );
  };

  // Check if booking has already been rated
  const checkRatingStatus = async (bookingData: ServiceBooking) => {
    if (bookingData.status !== 'completed') {
      setHasAlreadyRated(false);
      return;
    }

    try {
      setCheckingRatingStatus(true);
      
      // First check if booking already has rating data
      if (bookingData.customerRating && bookingData.ratedAt) {
        console.log(`📊 Booking already has rating: ${bookingData.customerRating} stars`);
        setHasAlreadyRated(true);
        setUserRating(bookingData.customerRating);
        setUserFeedback(bookingData.customerFeedback || "");
        return;
      }

      // Check via FirestoreService method
      const alreadyRated = await FirestoreService.hasBookingBeenRated(bookingData.id);
      setHasAlreadyRated(alreadyRated);
      
      if (alreadyRated) {
        console.log(`📊 User has already rated booking ${bookingData.id}`);
      }
    } catch (error) {
      console.error('Error checking rating status:', error);
      setHasAlreadyRated(false);
    } finally {
      setCheckingRatingStatus(false);
    }
  };

  // Fetch booking data from Firebase (initial load)
  const fetchBookingData = async () => {
    if (!bookingId) {
      setError('No booking ID provided');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log(`🔥 Fetching booking data for ID: ${bookingId}`);
      const bookingData = await FirestoreService.getServiceBookingById(bookingId);
      
      if (!bookingData) {
        setError('Booking not found');
        return;
      }

      setBooking(bookingData);
      
      // Try to determine category ID for add-on services
      await determineCategoryId(bookingData.serviceName);
      
      // Check rating status for completed bookings
      await checkRatingStatus(bookingData);
      
      // Fetch company phone for calling functionality
      const companyId = bookingData.companyId;
      if (companyId) {
        await fetchCompanyPhone(companyId);
      }
      
      // Animate progress bar
      const progress = BookingUtils.getProgressPercentage(bookingData.status);
      Animated.timing(animatedProgress, {
        toValue: progress,
        duration: 1000,
        useNativeDriver: false,
      }).start();
      
      console.log(`✅ Loaded booking: ${bookingData.serviceName} - Status: ${bookingData.status}`);
    } catch (err) {
      console.error('❌ Error fetching booking:', err);
      setError('Failed to load booking details. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!bookingId) {
      setError('No booking ID provided');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    console.log(`🔥 Setting up real-time listener for booking ${bookingId}...`);

    const unsubscribe = FirestoreService.listenToServiceBooking(
      bookingId,
      async (bookingData) => {
        if (!bookingData) {
          setError('Booking not found');
          setLoading(false);
          return;
        }

        // Check if booking was just rejected or cancelled (only after initial load)
        if (previousStatus !== null && previousStatus !== 'rejected' && previousStatus !== 'cancelled' && 
            (bookingData.status === 'rejected' || bookingData.status === 'cancelled')) {
          console.log(`🚫 Booking was ${bookingData.status}, handling accordingly`);
          
          // Only show rejection modal for admin rejections, not user cancellations
          if (bookingData.status === 'rejected') {
            console.log('🚫 Admin rejected booking, opening alternative companies modal');
            setShowRejectionModal(true);
          } else if (bookingData.status === 'cancelled') {
            console.log('🚫 User cancelled booking, no alternative companies modal needed');
          }
        }

        // Update previous status for next comparison (set after the rejection check)
        setPreviousStatus(bookingData.status);
        setBooking(bookingData);

        // Try to determine category ID for add-on services
        await determineCategoryId(bookingData.serviceName);

        // If this is the first load and booking is already rejected, show modal
        if (previousStatus === null && bookingData.status === 'rejected') {
          console.log('🚫 Booking is already rejected on first load, opening modal');
          setTimeout(() => {
            setShowRejectionModal(true);
          }, 1000); // Longer delay for initial load
        }

        // Check rating status for completed bookings
        await checkRatingStatus(bookingData);

        // Fetch company phone for calling functionality
        const companyId = bookingData.companyId;
        if (companyId) {
          await fetchCompanyPhone(companyId);
        }

        // Animate progress bar
        const progress = BookingUtils.getProgressPercentage(bookingData.status);
        Animated.timing(animatedProgress, {
          toValue: progress,
          duration: 1000,
          useNativeDriver: false,
        }).start();

        console.log(`🔄 Real-time update: ${bookingData.serviceName} - Status: ${bookingData.status}`);
        setLoading(false);
      },
      (error) => {
        console.error('❌ Error in real-time listener:', error);
        setError('Failed to load booking details. Please check your internet connection.');
        setLoading(false);
      }
    );

    return () => {
      console.log(`🔥 Cleaning up real-time listener for booking ${bookingId}...`);
      unsubscribe();
    };
  }, [bookingId]);

  // Generate booking steps based on current status
  const generateTimelineSteps = (): TrackingStep[] => {
    if (!booking) return [];

    const statusSequence: BookingStatus[] = ["pending", "assigned", "started", "completed"];
    const currentStatusIndex = statusSequence.indexOf(booking.status);
    
    console.log(`📍 Timeline: Current status index = ${currentStatusIndex} (${booking.status})`);
    
    const allSteps: TrackingStep[] = [
      {
        id: "pending",
        title: "Booking Confirmed",
        description: `Your ${booking.serviceName} booking has been confirmed`,
        timestamp: booking.createdAt ? formatTimestamp(booking.createdAt) : "Just now",
        status: "completed",
        icon: "checkmark-circle",
      },
      {
        id: "assigned",
        title: "Technician Assigned",
        description: booking.technicianName 
          ? `${booking.technicianName} has been assigned to your booking and will contact you soon`
          : "We're finding the best technician for your service",
        timestamp: currentStatusIndex >= 1 && booking.assignedAt ? formatTimestamp(booking.assignedAt) : undefined,
        status: currentStatusIndex > 1 ? "completed" : currentStatusIndex === 1 ? "current" : "pending",
        icon: "person-circle",
      },
      {
        id: "started",
        title: "Work Started",
        description: "Service work is currently in progress",
        timestamp: currentStatusIndex >= 2 && booking.startedAt ? formatTimestamp(booking.startedAt) : undefined,
        status: currentStatusIndex > 2 ? "completed" : currentStatusIndex === 2 ? "current" : "pending",
        icon: "construct",
      },
      {
        id: "completed",
        title: "Service Completed",
        description: "Your service has been completed successfully",
        timestamp: currentStatusIndex >= 3 && booking.completedAt ? formatTimestamp(booking.completedAt) : undefined,
        status: currentStatusIndex >= 3 ? "completed" : "pending",
        icon: "checkmark-done-circle",
      },
    ];

    // Handle rejected/expired/cancelled bookings
    if (booking.status === 'rejected' || booking.status === 'expired' || booking.status === 'cancelled') {
      const statusStep: TrackingStep = {
        id: booking.status,
        title: booking.status === 'rejected' ? 'Booking Rejected by Admin' : 
               booking.status === 'cancelled' ? 'Booking Cancelled by You' : 'Booking Expired',
        description: booking.status === 'rejected' 
          ? 'This booking has been rejected by the admin. You can find alternative service providers below.'
          : booking.status === 'cancelled'
          ? 'You have cancelled this booking. You can create a new booking if needed.'
          : 'This booking has expired. Please create a new booking.',
        timestamp: booking.status === 'rejected' && booking.rejectedAt 
          ? formatTimestamp(booking.rejectedAt)
          : booking.status === 'cancelled' && booking.cancelledAt
          ? formatTimestamp(booking.cancelledAt)
          : booking.status === 'expired' && booking.expiredAt 
          ? formatTimestamp(booking.expiredAt)
          : "Recently",
        status: "completed" as const,
        icon: booking.status === 'rejected' ? 'close-circle' : 
              booking.status === 'cancelled' ? 'remove-circle' : 'time',
      };

      return [
        allSteps[0], // Keep confirmed step
        statusStep
      ];
    }
    
    return allSteps;
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp: any): string => {
    if (!timestamp) return "";
    
    try {
      let date: Date;
      if (timestamp.toDate) {
        // Firestore Timestamp
        date = timestamp.toDate();
      } else if (timestamp instanceof Date) {
        date = timestamp;
      } else if (typeof timestamp === 'string') {
        date = new Date(timestamp);
      } else {
        return "";
      }
      
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return "";
    }
  };

  const timelineSteps = generateTimelineSteps();

  const getStatusColor = (status: "completed" | "current" | "pending") => {
    switch (status) {
      case "completed": return "#10B981";
      case "current": return "#3B82F6";
      case "pending": return "#9CA3AF";
    }
  };

  // Submit rating to Firebase (create a separate rating record)
  const handleSubmitRating = async () => {
    if (!userRating || !booking) {
      Alert.alert("Rating Required", "Please select a rating before submitting");
      return;
    }

    if (hasAlreadyRated) {
      Alert.alert("Already Rated", "You have already rated this booking");
      return;
    }

    setRatingLoading(true);
    try {
      console.log(`⭐ Submitting rating ${userRating} for booking ${booking.id}...`);
      
      // Use the FirestoreService method to submit rating to serviceRatings collection
      await FirestoreService.submitBookingRating(
        booking.id,
        userRating,
        userFeedback || undefined
      );

      Alert.alert("✅ Rating Submitted", "Thank you for your feedback!");
      
      // Mark as already rated to prevent future submissions
      setHasAlreadyRated(true);
    } catch (error: any) {
      console.error("Error submitting rating:", error);
      
      if (error.message === 'You have already rated this booking') {
        Alert.alert("Already Rated", "You have already rated this booking");
        setHasAlreadyRated(true);
      } else {
        Alert.alert("Error", "Failed to submit rating. Please try again.");
      }
    } finally {
      setRatingLoading(false);
    }
  };

  // const handleCallTechnician = () => {
  //   const workerName = booking?.workerName || booking?.technicianName || "the worker";
    
  //   if (!workerPhone) {
  //     Alert.alert(
  //       "Phone Number Not Available", 
  //       `Sorry, we don't have a phone number for ${workerName}. Please contact support for assistance.`,
  //       [{ text: "OK" }]
  //     );
  //     return;
  //   }

  //   Alert.alert(
  //     "Call Worker",
  //     `Call ${workerName} at ${workerPhone}?`,
  //     [
  //       { text: "Cancel", style: "cancel" },
  //       { 
  //         text: "Call", 
  //         onPress: () => {
  //           console.log(`📞 Calling ${workerName} at ${workerPhone}`);
  //           Linking.openURL(`tel:${workerPhone}`).catch((error) => {
  //             console.error('📞 Error making phone call:', error);
  //             Alert.alert("Error", "Unable to make phone call. Please try again.");
  //           });
  //         }
  //       },
  //     ]
  //   );
  // };

  const handleCancelBooking = async () => {
    if (!booking || !BookingUtils.canCancelBooking(booking.status)) {
      Alert.alert("Cannot Cancel", "This booking cannot be cancelled at this stage.");
      return;
    }

    setShowCancellationModal(true);
  };

  const handleConfirmCancellation = async () => {
    if (!booking) return;

    try {
      setShowCancellationModal(false);
      await FirestoreService.cancelBookingByUser(booking.id);
      Alert.alert("Booking Cancelled", "Your booking has been cancelled successfully.");
      fetchBookingData(); // Refresh data
    } catch (error) {
      Alert.alert("Error", "Failed to cancel booking. Please try again.");
    }
  };

  const handleSelectNewCompany = async (selectedCompany: any) => {
    if (!booking) return;

    try {
      console.log('🏢 User selected new company:', selectedCompany.companyName || selectedCompany.serviceName);
      
      // Since we don't have the original booking flow parameters, 
      // we'll navigate to a simplified rebooking flow
      navigation.navigate("CompanySelection", {
        serviceTitle: booking.serviceName,
        // Use the service name to try to find the category
        categoryId: undefined,
        issues: [booking.serviceName], // Use service name as the issue
        selectedIssues: [{ name: booking.serviceName }],
        selectedIssueIds: [],
        // Pass the selected company to pre-select it
        preSelectedCompany: selectedCompany,
        // Pass original booking data for reference
        originalBookingId: booking.id,
        isRebooking: true,
        // Pass the original date/time as defaults
        defaultDate: booking.date,
        defaultTime: booking.time,
      });
      
      setShowRejectionModal(false);
    } catch (error) {
      console.error('❌ Error handling company selection:', error);
      Alert.alert("Error", "Failed to proceed with selected company. Please try again.");
    }
  };

  // Loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Track Booking</Text>
          <View style={{ width: 24 }} />
        </View>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6D28D9" />
          <Text style={styles.loadingText}>Loading booking details...</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error || !booking) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Track Booking</Text>
          <View style={{ width: 24 }} />
        </View>
        
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#ef4444" />
          <Text style={styles.errorText}>{error || 'Booking not found'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchBookingData()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const progressPercentage = BookingUtils.getProgressPercentage(booking.status);
  const isActive = BookingUtils.isActiveBooking(booking.status);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Track Booking</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Current Status */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={styles.statusLeft}>
              <View style={[styles.statusIconBG, { backgroundColor: BookingUtils.getStatusColor(booking.status) }]}>
                <Ionicons name="construct" size={18} color="#fff" />
              </View>
              <Text style={styles.statusTitle}>Current Status</Text>
            </View>

            <View style={[styles.statusBadgeSmall, { backgroundColor: BookingUtils.getStatusColor(booking.status) }]}>
              <Text style={styles.statusBadgeText}>{BookingUtils.getStatusText(booking.status)}</Text>
            </View>
          </View>

          {/* Progress Row */}
          <View style={styles.progressWrap}>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>Progress</Text>
              <Text style={styles.progressTextSmall}>{progressPercentage}%</Text>
            </View>

            <View style={styles.progressBar}>
              <Animated.View 
                style={[
                  styles.progressFill, 
                  {
                    width: animatedProgress.interpolate({
                      inputRange: [0, 100],
                      outputRange: ["0%", "100%"],
                    }),
                    backgroundColor: BookingUtils.getStatusColor(booking.status),
                  }
                ]} 
              />
            </View>
          </View>

          {/* Show completion OTP for started bookings */}
          {booking.status === "started" && (booking.completionOtp || booking.startOtp) && (
            <View style={styles.otpContainer}>
              <Ionicons name="key-outline" size={18} color="#3B82F6" />
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.otpLabel}>Service Completion OTP</Text>
                <Text style={styles.otpValue}>
                  {booking.completionOtp || booking.startOtp}
                </Text>
                <Text style={styles.otpNote}>Give this OTP to the company when service is completed</Text>
              </View>
            </View>
          )}

          {/* Fallback: Always show OTP section for started services */}
          {booking.status === "started" && !booking.completionOtp && !booking.startOtp && (
            <View style={styles.otpContainer}>
              <Ionicons name="warning-outline" size={18} color="#EF4444" />
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.otpLabel}>OTP Not Available</Text>
                <Text style={styles.otpNote}>Contact support for service completion OTP</Text>
              </View>
            </View>
          )}

          {/* Company Information */}
          <TechnicianInfo 
            booking={booking}
            onCallTechnician={undefined}
            showCallButton={false}
          />
        </View>

        {/* Tracking Timeline */}
        <View style={styles.timelineCard}>
          <Text style={styles.timelineTitle}>Booking Progress</Text>
          
          {timelineSteps.map((step, index) => (
            <View key={step.id} style={styles.timelineItem}>
              <View style={styles.timelineLeft}>
                <View style={[styles.timelineIcon, { backgroundColor: getStatusColor(step.status) }]}>
                  <Ionicons 
                    name={step.icon} 
                    size={16} 
                    color="white" 
                  />
                </View>
                {index < timelineSteps.length - 1 && (
                  <View style={[styles.timelineLine, { backgroundColor: getStatusColor(step.status) }]} />
                )}
              </View>
              
              <View style={styles.timelineContent}>
                <Text style={[styles.timelineStepTitle, { 
                  color: step.status === "pending" ? "#9CA3AF" : "#000" 
                }]}>
                  {step.title}
                </Text>
                <Text style={[styles.timelineStepDesc, { 
                  color: step.status === "pending" ? "#9CA3AF" : "#6B7280" 
                }]}>
                  {step.description}
                </Text>
                {step.timestamp && (
                  <Text style={styles.timelineTimestamp}>{step.timestamp}</Text>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Booking Info Card */}
        <View style={styles.bookingCard}>
          <View style={styles.bookingHeader}>
            <Text style={styles.bookingId}>#{booking.id.substring(0, 8)}</Text>
            <View style={[styles.statusBadge, { 
              backgroundColor: BookingUtils.getStatusColor(booking.status)
            }]}>
              <Text style={styles.statusText}>
                {BookingUtils.getStatusText(booking.status)}
              </Text>
            </View>
          </View>
          
          <Text style={styles.serviceTitle}>{booking.serviceName}</Text>
          
          {booking.workName && booking.workName !== booking.serviceName && (
            <Text style={styles.workDescription}>{booking.workName}</Text>
          )}
          
          {/* Essential Details - Always Visible */}
          <View style={styles.essentialDetails}>
            <View style={styles.detailRow}>
              <Ionicons name="calendar" size={16} color="#6B7280" />
              <Text style={styles.detailText}>{BookingUtils.formatBookingDate(booking.date)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="time" size={16} color="#6B7280" />
              <Text style={styles.detailText}>{BookingUtils.formatBookingTime(booking.time)}</Text>
            </View>
            {booking.customerAddress && (
              <View style={styles.detailRow}>
                <Ionicons name="location" size={16} color="#6B7280" />
                <Text style={styles.detailText} numberOfLines={1} ellipsizeMode="tail">
                  {booking.customerAddress}
                </Text>
              </View>
            )}
          </View>

          {/* More Details Button */}
          <TouchableOpacity 
            style={styles.moreDetailsButton}
            onPress={() => setShowMoreDetails(!showMoreDetails)}
          >
            <Text style={styles.moreDetailsText}>
              {showMoreDetails ? 'Less Details' : 'More Details'}
            </Text>
            <Ionicons 
              name={showMoreDetails ? "chevron-up" : "chevron-down"} 
              size={16} 
              color="#6D28D9" 
            />
          </TouchableOpacity>

          {/* Expandable Details Section */}
          {showMoreDetails && (
            <View style={styles.expandedDetails}>
              <View style={styles.detailsDivider} />
              
              <View style={styles.detailRow}>
                <Ionicons name="person" size={16} color="#6B7280" />
                <Text style={styles.detailText}>Customer: {booking.customerName}</Text>
              </View>
              
              {booking.customerPhone && (
                <View style={styles.detailRow}>
                  <Ionicons name="call" size={16} color="#6B7280" />
                  <Text style={styles.detailText}>{booking.customerPhone}</Text>
                </View>
              )}
              
              {booking.customerAddress && (
                <View style={styles.detailRow}>
                  <Ionicons name="location" size={16} color="#6B7280" />
                  <Text style={styles.detailText}>Full Address: {booking.customerAddress}</Text>
                </View>
              )}
              
              {booking.technicianName && (
                <View style={styles.detailRow}>
                  <Ionicons name="construct" size={16} color="#6B7280" />
                  <Text style={styles.detailText}>Technician: {booking.technicianName}</Text>
                </View>
              )}
              
              {booking.companyId && companyName && (
                <View style={styles.detailRow}>
                  <Ionicons name="business" size={16} color="#6B7280" />
                  <Text style={styles.detailText}>Company: {companyName}</Text>
                </View>
              )}
              
              {booking.createdAt && (
                <View style={styles.detailRow}>
                  <Ionicons name="time-outline" size={16} color="#6B7280" />
                  <Text style={styles.detailText}>
                    Booked: {formatTimestamp(booking.createdAt)}
                  </Text>
                </View>
              )}
              
              {booking.assignedAt && (
                <View style={styles.detailRow}>
                  <Ionicons name="checkmark-circle-outline" size={16} color="#6B7280" />
                  <Text style={styles.detailText}>
                    Assigned: {formatTimestamp(booking.assignedAt)}
                  </Text>
                </View>
              )}
              
              {booking.startedAt && (
                <View style={styles.detailRow}>
                  <Ionicons name="play-circle-outline" size={16} color="#6B7280" />
                  <Text style={styles.detailText}>
                    Started: {formatTimestamp(booking.startedAt)}
                  </Text>
                </View>
              )}
              
              {booking.completedAt && (
                <View style={styles.detailRow}>
                  <Ionicons name="checkmark-done-circle-outline" size={16} color="#6B7280" />
                  <Text style={styles.detailText}>
                    Completed: {formatTimestamp(booking.completedAt)}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Booking Details Card */}
        {(booking.totalPrice || booking.addOns?.length) && (
          <View style={styles.detailsCard}>
            <Text style={styles.detailsTitle}>Booking Details</Text>
            
            {booking.totalPrice && (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Total Amount</Text>
                <Text style={styles.priceValue}>₹{booking.totalPrice}</Text>
              </View>
            )}
            
            {booking.addOns && booking.addOns.length > 0 && (
              <View style={styles.addOnsSection}>
                <Text style={styles.addOnsTitle}>Add-ons:</Text>
                {booking.addOns.map((addon, index) => (
                  <View key={index} style={styles.addonItem}>
                    <Text style={styles.addonName}>• {addon.name}</Text>
                    <Text style={styles.addonPrice}>₹{addon.price}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Rating Card - Show when completed */}
        {booking.status === "completed" && (
          <View style={styles.ratingCard}>
            {hasAlreadyRated ? (
              // Show existing rating
              <View>
                <Text style={styles.ratingTitle}>✅ Your Rating</Text>
                
                {/* Show technician info if available */}
                {(booking.workerName || booking.technicianName || booking.companyId) && (
                  <View style={styles.ratingTechnicianInfo}>
                    <Ionicons name="person-circle" size={20} color="#6B7280" />
                    <Text style={styles.ratingTechnicianText}>
                      Rated: {booking.workerName || booking.technicianName || `${booking.serviceName} Provider`}
                    </Text>
                  </View>
                )}
                
                <View style={styles.starsContainer}>
                  {[1, 2, 3, 4, 5].map((num) => (
                    <Ionicons
                      key={num}
                      name={userRating >= num ? "star" : "star-outline"}
                      size={40}
                      color={userRating >= num ? "#FFD700" : "#CCCCCC"}
                    />
                  ))}
                </View>
                <Text style={styles.ratingValue}>{userRating} out of 5 stars</Text>
                {userFeedback && (
                  <View style={styles.existingFeedbackContainer}>
                    <Text style={styles.existingFeedbackLabel}>Your Feedback:</Text>
                    <Text style={styles.existingFeedbackText}>{userFeedback}</Text>
                  </View>
                )}
                <Text style={styles.alreadyRatedNote}>Thank you for rating this service!</Text>
              </View>
            ) : checkingRatingStatus ? (
              // Show loading while checking rating status
              <View>
                <Text style={styles.ratingTitle}>⭐ Rate This Service</Text>
                <View style={styles.ratingLoadingContainer}>
                  <ActivityIndicator size="small" color="#6D28D9" />
                  <Text style={styles.ratingLoadingText}>Checking rating status...</Text>
                </View>
              </View>
            ) : (
              // Show rating interface for new ratings
              <View>
                <Text style={styles.ratingTitle}>⭐ Rate This Service</Text>
                
                {/* Show technician info if available */}
                {(booking.workerName || booking.technicianName || booking.companyId) && (
                  <View style={styles.ratingTechnicianInfo}>
                    <Ionicons name="person-circle" size={20} color="#6B7280" />
                    <Text style={styles.ratingTechnicianText}>
                      Rating: {booking.workerName || booking.technicianName || `${booking.serviceName} Provider`}
                    </Text>
                  </View>
                )}
                
                <View style={styles.starsContainer}>
                  {[1, 2, 3, 4, 5].map((num) => (
                    <TouchableOpacity
                      key={num}
                      onPress={() => setUserRating(num)}
                    >
                      <Ionicons
                        name={userRating >= num ? "star" : "star-outline"}
                        size={40}
                        color={userRating >= num ? "#FFD700" : "#CCCCCC"}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
                {userRating > 0 && (
                  <Text style={styles.ratingValue}>{userRating} out of 5 stars</Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* Feedback Textarea - Show after rating selected and not already rated */}
        {booking.status === "completed" && userRating > 0 && !hasAlreadyRated && !checkingRatingStatus && (
          <View style={styles.feedbackContainer}>
            <Text style={styles.feedbackLabel}>Share Your Feedback</Text>
            <TextInput
              style={styles.feedbackInput}
              placeholder="Tell us about your experience..."
              placeholderTextColor="#999"
              multiline={true}
              numberOfLines={4}
              value={userFeedback}
              onChangeText={setUserFeedback}
              maxLength={500}
            />
            <Text style={styles.feedbackCounter}>
              {userFeedback.length}/500 characters
            </Text>
          </View>
        )}

        {/* Rating Submit Button - Only show if not already rated */}
        {booking.status === "completed" && userRating > 0 && !hasAlreadyRated && !checkingRatingStatus && (
          <View style={styles.ratingButtonContainer}>
            <TouchableOpacity
              style={[styles.submitRatingButton, ratingLoading && { opacity: 0.6 }]}
              onPress={handleSubmitRating}
              disabled={ratingLoading}
            >
              {ratingLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-done" size={20} color="#fff" />
                  <Text style={styles.submitRatingText}>Submit Rating</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Add-On Services Button - Only show when technician is assigned and booking is active */}
        {categoryId && isTechnicianAssigned() && isActive && (
          <View style={styles.addOnSection}>
            <TouchableOpacity 
              style={styles.addOnButton}
              onPress={handleAddOnServices}
              activeOpacity={0.8}
            >
              <View style={styles.addOnButtonContent}>
                <View style={styles.addOnIconWrapper}>
                  <Ionicons name="add-circle" size={24} color="#fff" />
                </View>
                <View style={styles.addOnTextWrapper}>
                  <Text style={styles.addOnButtonText}>Add More Services</Text>
                  <Text style={styles.addOnButtonSubtext}>Enhance your booking</Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color="#fff" />
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Action Buttons */}
        {isActive && (
          <View style={styles.actionButtons}>
            {workerPhone && (
              <TouchableOpacity 
                style={styles.callButton} 
                onPress={handleCallCompany}
              >
                <Ionicons name="call" size={20} color="white" />
                <Text style={styles.callButtonText}>Call Company</Text>
              </TouchableOpacity>
            )}
            
            {BookingUtils.canCancelBooking(booking.status) && (
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={handleCancelBooking}
              >
                <Ionicons name="close-circle" size={20} color="#EF4444" />
                <Text style={styles.cancelButtonText}>Cancel Booking</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Alternative Companies Button for Rejected Bookings */}
        {booking.status === 'rejected' && (
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={styles.findAlternativesButton} 
              onPress={() => setShowRejectionModal(true)}
            >
              <Ionicons name="business" size={20} color="white" />
              <Text style={styles.findAlternativesButtonText}>Find Alternative Companies</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Bottom spacing */}
        <View style={{ height: 30 }} />
      </ScrollView>

      {/* Service Cancellation Modal */}
      <ServiceCancellationModal
        visible={showCancellationModal}
        onClose={() => setShowCancellationModal(false)}
        onConfirmCancel={handleConfirmCancellation}
        totalAmount={booking?.totalPrice || 0}
        deductionPercentage={25}
      />

      {/* Booking Rejection Modal */}
      <BookingRejectionModal
        visible={showRejectionModal}
        onClose={() => setShowRejectionModal(false)}
        onSelectCompany={handleSelectNewCompany}
        rejectedBooking={booking ? {
          id: booking.id,
          serviceName: booking.serviceName,
          categoryId: undefined, // ServiceBooking doesn't have this field
          selectedIssueIds: undefined, // ServiceBooking doesn't have this field  
          issues: undefined, // ServiceBooking doesn't have this field
          date: booking.date,
          time: booking.time,
          customerAddress: booking.customerAddress,
        } : null}
      />

      {/* Add-On Services Modal */}
      <AddOnServicesModal
        visible={showAddOnModal}
        onClose={() => setShowAddOnModal(false)}
        onAddServices={handleAddServicesConfirm}
        categoryId={categoryId}
        existingServices={[
          ...(booking?.serviceName ? [booking.serviceName] : []),
          ...(booking?.workName && booking.workName !== booking.serviceName ? [booking.workName] : []),
          ...(booking?.addOns?.map(addon => addon.name) || [])
        ]}
        bookingId={bookingId}
        companyId={booking?.companyId} // Pass company ID to filter services
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
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
    marginTop: 16,
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
  bookingCard: {
    backgroundColor: "white",
    margin: 20,
    padding: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bookingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  bookingId: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  serviceTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
    marginBottom: 8,
  },
  workDescription: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 16,
    fontStyle: "italic",
  },
  bookingDetails: {
    gap: 8,
  },
  essentialDetails: {
    gap: 8,
    marginBottom: 12,
  },
  expandedDetails: {
    gap: 8,
    marginTop: 8,
  },
  detailsDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 8,
  },
  moreDetailsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    gap: 4,
  },
  moreDetailsText: {
    fontSize: 14,
    color: "#6D28D9",
    fontWeight: "600",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: "#6B7280",
  },
  statusCard: {
    backgroundColor: "white",
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  statusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  statusLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusIconBG: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#3B82F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  statusBadgeSmall: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  statusBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  progressWrap: {
    marginTop: 6,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 13,
    color: "#6B7280",
  },
  progressTextSmall: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "700",
  },
  progressBar: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 8,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#3B82F6",
    borderRadius: 8,
  },
  otpContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 12,
    padding: 12,
    backgroundColor: "#EBF8FF",
    borderRadius: 8,
  },
  otpLabel: {
    fontSize: 13,
    color: "#3B82F6",
    fontWeight: "500",
  },
  otpValue: {
    fontSize: 18,
    color: "#0F172A",
    fontWeight: "700",
    letterSpacing: 2,
  },
  otpNote: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  etaContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    padding: 12,
    backgroundColor: "#EBF8FF",
    borderRadius: 8,
  },
  etaText: {
    fontSize: 13,
    color: "#3B82F6",
    fontWeight: "500",
  },
  etaTime: {
    fontSize: 15,
    color: "#0F172A",
    fontWeight: "700",
  },
  callTechBtn: {
    marginLeft: "auto",
    backgroundColor: "#10B981",
    padding: 8,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  callTechText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  technicianContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: "#F0F9FF",
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#10B981",
  },
  technicianHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  technicianIconBG: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  technicianInfo: {
    flex: 1,
  },
  technicianLabel: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  technicianName: {
    fontSize: 16,
    color: "#0F172A",
    fontWeight: "700",
    marginTop: 2,
  },
  timelineCard: {
    backgroundColor: "white",
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 20,
  },
  timelineItem: {
    flexDirection: "row",
    marginBottom: 20,
  },
  timelineLeft: {
    alignItems: "center",
    marginRight: 16,
  },
  timelineIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 8,
  },
  timelineContent: {
    flex: 1,
    paddingTop: 4,
  },
  timelineStepTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  timelineStepDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  timelineTimestamp: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  detailsCard: {
    backgroundColor: "white",
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  priceLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  priceValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#10B981",
  },
  addOnsSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  addOnsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  addonItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  addonName: {
    fontSize: 13,
    color: "#6B7280",
  },
  addonPrice: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
  },
  ratingCard: {
    backgroundColor: "white",
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 18,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  ratingTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginBottom: 16,
  },
  starsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginBottom: 12,
  },
  ratingValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFD700",
    textAlign: "center",
  },
  ratingLoadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 20,
  },
  ratingLoadingText: {
    fontSize: 14,
    color: "#666",
  },
  existingFeedbackContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#F0F9FF",
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: "#10B981",
  },
  existingFeedbackLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },
  existingFeedbackText: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
  },
  alreadyRatedNote: {
    fontSize: 13,
    color: "#10B981",
    textAlign: "center",
    marginTop: 12,
    fontWeight: "500",
  },
  feedbackContainer: {
    backgroundColor: "#f8f9ff",
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 14,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#6366F1",
  },
  feedbackLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
    marginBottom: 10,
  },
  feedbackInput: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: "#333",
    textAlignVertical: "top",
    marginBottom: 6,
  },
  feedbackCounter: {
    fontSize: 11,
    color: "#999",
    textAlign: "right",
  },
  ratingButtonContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  submitRatingButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#10B981",
    paddingVertical: 14,
    borderRadius: 8,
  },
  submitRatingText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  callButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#10B981",
    paddingVertical: 14,
    borderRadius: 8,
  },
  callButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "white",
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#EF4444",
  },
  cancelButtonText: {
    color: "#EF4444",
    fontSize: 16,
    fontWeight: "600",
  },
  findAlternativesButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#3B82F6",
    paddingVertical: 14,
    borderRadius: 8,
  },
  findAlternativesButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  ratingTechnicianInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#F0F9FF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0F2FE",
  },
  ratingTechnicianText: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
  },
  addOnSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  addOnButton: {
    backgroundColor: "#F59E0B",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  addOnButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  addOnIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  addOnTextWrapper: {
    flex: 1,
    marginLeft: 14,
  },
  addOnButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 2,
  },
  addOnButtonSubtext: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 13,
    fontWeight: "500",
  },
});