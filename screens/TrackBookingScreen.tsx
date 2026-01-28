import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

type BookingStatus = 
  | "confirmed" 
  | "assigned" 
  | "on_the_way" 
  | "arrived" 
  | "in_progress" 
  | "completed" 
  | "cancelled";

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
  
  const {
    bookingId = "BK001",
    serviceTitle = "Service Booking",
    selectedDate = "Tomorrow",
    selectedTime = "1:00 PM - 3:00 PM",
    company,
    agency,
    issues = [],
    totalPrice = 0,
    bookingType = "electrician",
    paymentMethod = "cash",
    notes = "",
  } = route.params || {};

  // Determine booking status based on date and time
  const calculateBookingStatus = () => {
    const now = new Date();
    const currentDate = now.toDateString();
    
    console.log("=== BOOKING STATUS CALCULATION ===");
    console.log("Current time:", now.toString());
    console.log("Selected date:", selectedDate);
    console.log("Selected time:", selectedTime);
    
    // Parse booking date
    let bookingDate: Date;
    let dateType: 'today' | 'tomorrow' | 'future' | 'past' = 'future';
    
    if (selectedDate === "Today") {
      bookingDate = new Date();
      dateType = 'today';
    } else if (selectedDate === "Tomorrow") {
      bookingDate = new Date();
      bookingDate.setDate(bookingDate.getDate() + 1);
      dateType = 'tomorrow';
    } else {
      // Handle formatted dates like "Wednesday, January 29, 2025"
      bookingDate = new Date(selectedDate);
      if (isNaN(bookingDate.getTime())) {
        // Fallback to tomorrow if date parsing fails
        bookingDate = new Date();
        bookingDate.setDate(bookingDate.getDate() + 1);
        dateType = 'tomorrow';
      } else {
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const bookingStart = new Date(bookingDate.getFullYear(), bookingDate.getMonth(), bookingDate.getDate());
        
        const dayDiff = Math.floor((bookingStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
        
        if (dayDiff === 0) dateType = 'today';
        else if (dayDiff === 1) dateType = 'tomorrow';
        else if (dayDiff > 1) dateType = 'future';
        else dateType = 'past';
      }
    }
    
    console.log("Date type:", dateType);
    console.log("Booking date:", bookingDate.toDateString());
    
    // Return status based on date type
    switch (dateType) {
      case 'future':
      case 'tomorrow':
        return {
          status: "confirmed" as BookingStatus,
          progress: 5,
          message: dateType === 'tomorrow' 
            ? `Your booking is confirmed for tomorrow at ${selectedTime.split(' - ')[0]}. We'll assign a technician tomorrow morning.`
            : `Your booking is confirmed for ${selectedDate} at ${selectedTime.split(' - ')[0]}. We'll assign a technician on the service day.`,
          showCountdown: true,
          isActive: false
        };
        
      case 'past':
        return {
          status: "completed" as BookingStatus,
          progress: 100,
          message: `Your service was completed successfully on ${selectedDate}. Thank you for choosing our service!`,
          showCountdown: false,
          isActive: false
        };
        
      case 'today':
        // For today's bookings, check time progression
        return calculateTodayStatus(selectedTime);
        
      default:
        return {
          status: "confirmed" as BookingStatus,
          progress: 5,
          message: "Your booking is confirmed. We'll update the status shortly.",
          showCountdown: true,
          isActive: false
        };
    }
  };

  const calculateTodayStatus = (timeSlot: string) => {
    const now = new Date();
    const [startTimeStr] = timeSlot.split(' - ');
    
    try {
      // Parse booking time
      const [time, period] = startTimeStr.trim().split(' ');
      const [hours, minutes] = time.split(':').map(Number);
      
      let hour24 = hours;
      if (period === 'PM' && hours !== 12) hour24 += 12;
      if (period === 'AM' && hours === 12) hour24 = 0;
      
      const bookingTime = new Date();
      bookingTime.setHours(hour24, minutes || 0, 0, 0);
      
      // Calculate key times
      const assignTime = new Date(bookingTime.getTime() - 90 * 60 * 1000); // 1.5 hours before
      const departTime = new Date(bookingTime.getTime() - 30 * 60 * 1000); // 30 mins before
      const arriveTime = new Date(bookingTime.getTime() - 5 * 60 * 1000);  // 5 mins before
      const endTime = new Date(bookingTime.getTime() + 2 * 60 * 60 * 1000); // 2 hours after
      
      console.log("Today's time progression:");
      console.log("- Current:", now.toLocaleTimeString());
      console.log("- Assignment:", assignTime.toLocaleTimeString());
      console.log("- Departure:", departTime.toLocaleTimeString());
      console.log("- Arrival:", arriveTime.toLocaleTimeString());
      console.log("- Service start:", bookingTime.toLocaleTimeString());
      console.log("- Service end:", endTime.toLocaleTimeString());
      
      if (now < assignTime) {
        return {
          status: "confirmed" as BookingStatus,
          progress: 10,
          message: `Your booking is confirmed for today at ${startTimeStr}. We'll assign a technician soon.`,
          showCountdown: false,
          isActive: true
        };
      } else if (now < departTime) {
        return {
          status: "assigned" as BookingStatus,
          progress: 25,
          message: `Raj Kumar has been assigned to your service and will arrive at ${startTimeStr}.`,
          showCountdown: false,
          isActive: true
        };
      } else if (now < arriveTime) {
        return {
          status: "on_the_way" as BookingStatus,
          progress: 50,
          message: `Raj Kumar is on the way to your location. Expected arrival: ${startTimeStr}.`,
          showCountdown: false,
          isActive: true
        };
      } else if (now < bookingTime) {
        return {
          status: "arrived" as BookingStatus,
          progress: 70,
          message: "Technician has arrived at your location and will begin the service shortly.",
          showCountdown: false,
          isActive: true
        };
      } else if (now < endTime) {
        return {
          status: "in_progress" as BookingStatus,
          progress: 85,
          message: "Service work is currently in progress. Our technician is working on your issues.",
          showCountdown: false,
          isActive: true
        };
      } else {
        return {
          status: "completed" as BookingStatus,
          progress: 100,
          message: "Your service has been completed successfully. Thank you for choosing our service!",
          showCountdown: false,
          isActive: false
        };
      }
    } catch (error) {
      console.log("Time parsing error:", error);
      return {
        status: "confirmed" as BookingStatus,
        progress: 10,
        message: "Your booking is confirmed for today. We'll update the status shortly.",
        showCountdown: false,
        isActive: true
      };
    }
  };

  const bookingStatus = calculateBookingStatus();
  const [currentStatus, setCurrentStatus] = useState<BookingStatus>(bookingStatus.status);
  const [progressPercentage, setProgressPercentage] = useState<number>(bookingStatus.progress);
  const [statusMessage, setStatusMessage] = useState<string>(bookingStatus.message);
  const [showCountdown, setShowCountdown] = useState<boolean>(bookingStatus.showCountdown);
  const [isActive, setIsActive] = useState<boolean>(bookingStatus.isActive);

  // Update status every minute for active bookings
  useEffect(() => {
    if (!isActive) return;
    
    const updateStatus = () => {
      const newStatus = calculateBookingStatus();
      setCurrentStatus(newStatus.status);
      setProgressPercentage(newStatus.progress);
      setStatusMessage(newStatus.message);
      setShowCountdown(newStatus.showCountdown);
      setIsActive(newStatus.isActive);
    };

    const interval = setInterval(updateStatus, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [isActive, selectedDate, selectedTime]);

  // Generate timeline steps
  const generateTimelineSteps = (): TrackingStep[] => {
    if (showCountdown) {
      // For future bookings, show planning timeline
      return [
        {
          id: "confirmed",
          title: "Booking Confirmed",
          description: `Your ${serviceTitle} booking has been confirmed`,
          timestamp: "Today, " + new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
          status: "completed",
          icon: "checkmark-circle",
        },
        {
          id: "assigned",
          title: "Technician Assignment",
          description: "We'll assign a technician on the service day",
          status: "pending",
          icon: "person-circle",
        },
        {
          id: "on_the_way",
          title: "On the Way",
          description: "Technician will head to your location",
          status: "pending",
          icon: "car",
        },
        {
          id: "service",
          title: "Service Completion",
          description: "Service will be performed and completed",
          status: "pending",
          icon: "checkmark-done-circle",
        },
      ];
    }

    // For active/completed bookings, show detailed timeline
    return [
      {
        id: "confirmed",
        title: "Booking Confirmed",
        description: `Your ${serviceTitle} booking has been confirmed`,
        timestamp: "Today, 12:30 PM",
        status: "completed",
        icon: "checkmark-circle",
      },
      {
        id: "assigned",
        title: "Technician Assigned",
        description: "Raj Kumar has been assigned to your booking",
        timestamp: currentStatus === "confirmed" ? undefined : "Today, 1:15 PM",
        status: currentStatus === "confirmed" ? "pending" : "completed",
        icon: "person-circle",
      },
      {
        id: "on_the_way",
        title: "On the Way",
        description: "Technician is heading to your location",
        timestamp: ["on_the_way", "arrived", "in_progress", "completed"].includes(currentStatus) ? "Today, 2:00 PM" : undefined,
        status: ["on_the_way", "arrived", "in_progress", "completed"].includes(currentStatus) ? "completed" : 
                currentStatus === "assigned" ? "current" : "pending",
        icon: "car",
      },
      {
        id: "arrived",
        title: "Arrived",
        description: "Technician has arrived at your location",
        timestamp: ["arrived", "in_progress", "completed"].includes(currentStatus) ? "Today, 2:25 PM" : undefined,
        status: ["arrived", "in_progress", "completed"].includes(currentStatus) ? "completed" : 
                currentStatus === "on_the_way" ? "current" : "pending",
        icon: "location",
      },
      {
        id: "in_progress",
        title: "Work in Progress",
        description: "Service work has started",
        timestamp: ["in_progress", "completed"].includes(currentStatus) ? "Today, 2:30 PM" : undefined,
        status: ["in_progress", "completed"].includes(currentStatus) ? "completed" : 
                currentStatus === "arrived" ? "current" : "pending",
        icon: "construct",
      },
      {
        id: "completed",
        title: "Service Completed",
        description: "Your service has been completed successfully",
        timestamp: currentStatus === "completed" ? "Today, 4:15 PM" : undefined,
        status: currentStatus === "completed" ? "completed" : 
                currentStatus === "in_progress" ? "current" : "pending",
        icon: "checkmark-done-circle",
      },
    ];
  };

  const timelineSteps = generateTimelineSteps();

  const getStatusColor = (status: "completed" | "current" | "pending") => {
    switch (status) {
      case "completed": return "#10B981";
      case "current": return "#3B82F6";
      case "pending": return "#9CA3AF";
    }
  };

  const handleCallTechnician = () => {
    Alert.alert(
      "Call Technician",
      "Call Raj Kumar at +91 98765 43210?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Call", onPress: () => console.log("Calling technician...") },
      ]
    );
  };

  const handleCancelBooking = () => {
    Alert.alert(
      "Cancel Booking",
      "Are you sure you want to cancel this booking?",
      [
        { text: "No", style: "cancel" },
        { 
          text: "Yes, Cancel", 
          style: "destructive",
          onPress: () => {
            setCurrentStatus("cancelled");
            setStatusMessage("This booking has been cancelled.");
            Alert.alert("Booking Cancelled", "Your booking has been cancelled successfully.");
          }
        },
      ]
    );
  };

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
        {/* Booking Info Card */}
        <View style={styles.bookingCard}>
          <View style={styles.bookingHeader}>
            <Text style={styles.bookingId}>#{bookingId}</Text>
            <View style={[styles.statusBadge, { 
              backgroundColor: currentStatus === "completed" ? "#10B981" : 
                             currentStatus === "cancelled" ? "#EF4444" : "#3B82F6" 
            }]}>
              <Text style={styles.statusText}>
                {currentStatus === "completed" ? "Completed" : 
                 currentStatus === "cancelled" ? "Cancelled" : "Active"}
              </Text>
            </View>
          </View>
          
          <Text style={styles.serviceTitle}>{serviceTitle}</Text>
          
          <View style={styles.bookingDetails}>
            <View style={styles.detailRow}>
              <Ionicons name="calendar" size={16} color="#6B7280" />
              <Text style={styles.detailText}>{selectedDate}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="time" size={16} color="#6B7280" />
              <Text style={styles.detailText}>{selectedTime}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="business" size={16} color="#6B7280" />
              <Text style={styles.detailText}>
                {company?.name || agency?.name || "Service Provider"}
              </Text>
            </View>
          </View>
        </View>

        {/* Current Status */}
        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>Current Status</Text>
          <Text style={styles.statusMessage}>{statusMessage}</Text>
          
          {/* Show countdown for future bookings */}
          {showCountdown && (
            <View style={styles.countdownContainer}>
              <Ionicons name="calendar-outline" size={20} color="#6B7280" />
              <Text style={styles.countdownText}>
                Booking scheduled for {selectedDate} at {selectedTime.split(' - ')[0]}
              </Text>
            </View>
          )}
          
          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progressPercentage}%` }]} />
            </View>
            <Text style={styles.progressText}>{progressPercentage}% Complete</Text>
          </View>
          
          {currentStatus === "on_the_way" && (
            <View style={styles.etaContainer}>
              <Ionicons name="time-outline" size={20} color="#3B82F6" />
              <Text style={styles.etaText}>Estimated arrival: {selectedTime.split(' - ')[0]}</Text>
            </View>
          )}
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

        {/* Action Buttons */}
        {currentStatus !== "completed" && currentStatus !== "cancelled" && (
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={styles.callButton} 
              onPress={handleCallTechnician}
            >
              <Ionicons name="call" size={20} color="white" />
              <Text style={styles.callButtonText}>Call Technician</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.cancelButton} 
              onPress={handleCancelBooking}
            >
              <Ionicons name="close-circle" size={20} color="#EF4444" />
              <Text style={styles.cancelButtonText}>Cancel Booking</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
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
    fontWeight: "600",
    color: "#000",
    marginBottom: 8,
  },
  statusMessage: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
  },
  countdownContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
  },
  countdownText: {
    fontSize: 14,
    color: "#92400E",
    fontWeight: "500",
  },
  progressContainer: {
    marginTop: 16,
  },
  progressBar: {
    height: 6,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#10B981",
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 8,
    textAlign: "center",
  },
  etaContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: "#EBF8FF",
    borderRadius: 8,
  },
  etaText: {
    fontSize: 14,
    color: "#3B82F6",
    fontWeight: "500",
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
});