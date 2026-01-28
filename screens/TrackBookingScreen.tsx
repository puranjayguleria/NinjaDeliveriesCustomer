import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Alert,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { getTrackingConfig, formatTimeSlot, BookingType } from "../utils/trackingConfig";

const { width: screenWidth } = Dimensions.get("window");

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
    selectedDate = "Today",
    selectedTime = "1:00 PM - 3:00 PM",
    company,
    agency,
    issues = [],
    totalPrice = 0,
    bookingType = "electrician",
    paymentMethod = "cash",
    notes = "",
  } = route.params || {};

  // Get configuration based on booking type
  const config = getTrackingConfig(bookingType as BookingType);
  const { date, time } = formatTimeSlot(selectedDate || "Today", selectedTime || "1:00 PM - 3:00 PM");

  const [currentStatus, setCurrentStatus] = useState<BookingStatus>("confirmed");
  const [estimatedArrival, setEstimatedArrival] = useState<string>("2:30 PM");
  const [technicianName, setTechnicianName] = useState<string>("Raj Kumar");
  const [technicianPhone, setTechnicianPhone] = useState<string>("+91 98765 43210");

  // Generate tracking steps based on booking type and current status
  const generateTrackingSteps = (): TrackingStep[] => {
    const baseSteps: TrackingStep[] = [
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
        description: `${technicianName} has been assigned to your booking`,
        timestamp: currentStatus === "confirmed" ? undefined : "Today, 1:15 PM",
        status: currentStatus === "confirmed" ? "pending" : "completed",
        icon: "person-circle",
      },
      {
        id: "on_the_way",
        title: "On the Way",
        description: `Technician is heading to your location`,
        timestamp: currentStatus && ["on_the_way", "arrived", "in_progress", "completed"].includes(currentStatus) ? "Today, 2:00 PM" : undefined,
        status: currentStatus && ["on_the_way", "arrived", "in_progress", "completed"].includes(currentStatus) ? "completed" : 
                currentStatus === "assigned" ? "current" : "pending",
        icon: "car",
      },
      {
        id: "arrived",
        title: "Arrived",
        description: "Technician has arrived at your location",
        timestamp: currentStatus && ["arrived", "in_progress", "completed"].includes(currentStatus) ? "Today, 2:25 PM" : undefined,
        status: currentStatus && ["arrived", "in_progress", "completed"].includes(currentStatus) ? "completed" : 
                currentStatus === "on_the_way" ? "current" : "pending",
        icon: "location",
      },
      {
        id: "in_progress",
        title: "Work in Progress",
        description: "Service work has started",
        timestamp: currentStatus && ["in_progress", "completed"].includes(currentStatus) ? "Today, 2:30 PM" : undefined,
        status: currentStatus && ["in_progress", "completed"].includes(currentStatus) ? "completed" : 
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

    return baseSteps;
  };

  const trackingSteps = generateTrackingSteps();

  // Simulate status updates (in real app, this would come from API)
  useEffect(() => {
    if (!currentStatus) return;
    
    const statusProgression: BookingStatus[] = [
      "confirmed", "assigned", "on_the_way", "arrived", "in_progress", "completed"
    ];
    
    let currentIndex = statusProgression.indexOf(currentStatus);
    
    const interval = setInterval(() => {
      if (currentIndex < statusProgression.length - 1) {
        currentIndex++;
        setCurrentStatus(statusProgression[currentIndex]);
      } else {
        clearInterval(interval);
      }
    }, config.statusUpdateInterval * 1000); // Use config interval

    return () => clearInterval(interval);
  }, [currentStatus, config.statusUpdateInterval]);

  const getStatusColor = (status: "completed" | "current" | "pending") => {
    switch (status) {
      case "completed": return "#10B981";
      case "current": return "#3B82F6";
      case "pending": return "#9CA3AF";
    }
  };

  const getStatusMessage = () => {
    if (!currentStatus) return "Tracking your booking status";
    
    switch (currentStatus) {
      case "confirmed": return "Your booking is confirmed and being processed";
      case "assigned": return `${technicianName} has been assigned to your service`;
      case "on_the_way": return `${technicianName} is on the way to your location`;
      case "arrived": return "Technician has arrived at your location";
      case "in_progress": return "Service work is currently in progress";
      case "completed": return "Your service has been completed successfully";
      case "cancelled": return "This booking has been cancelled";
      default: return "Tracking your booking status";
    }
  };

  const handleCallTechnician = () => {
    Alert.alert(
      "Call Technician",
      `Call ${technicianName} at ${technicianPhone}?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Call", onPress: () => console.log("Calling technician...") },
      ]
    );
  };

  const handleCancelBooking = () => {
    if (!config.allowCancellation) {
      Alert.alert(
        "Cannot Cancel",
        "This type of booking cannot be cancelled. Please contact support if needed.",
        [{ text: "OK" }]
      );
      return;
    }

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
            <View style={[styles.statusBadge, { backgroundColor: currentStatus === "completed" ? "#10B981" : "#3B82F6" }]}>
              <Text style={styles.statusText}>
                {currentStatus === "completed" ? "Completed" : "Active"}
              </Text>
            </View>
          </View>
          
          <Text style={styles.serviceTitle}>{serviceTitle}</Text>
          
          <View style={styles.bookingDetails}>
            <View style={styles.detailRow}>
              <Ionicons name="calendar" size={16} color="#6B7280" />
              <Text style={styles.detailText}>{date}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="time" size={16} color="#6B7280" />
              <Text style={styles.detailText}>{time}</Text>
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
          <Text style={styles.statusMessage}>{getStatusMessage()}</Text>
          
          {config.showETA && currentStatus === "on_the_way" && (
            <View style={styles.etaContainer}>
              <Ionicons name="time-outline" size={20} color="#3B82F6" />
              <Text style={styles.etaText}>Estimated arrival: {estimatedArrival}</Text>
            </View>
          )}
        </View>

        {/* Tracking Timeline */}
        <View style={styles.timelineCard}>
          <Text style={styles.timelineTitle}>Booking Progress</Text>
          
          {trackingSteps.map((step, index) => (
            <View key={step.id} style={styles.timelineItem}>
              <View style={styles.timelineLeft}>
                <View style={[styles.timelineIcon, { backgroundColor: getStatusColor(step.status) }]}>
                  <Ionicons 
                    name={step.icon} 
                    size={16} 
                    color="white" 
                  />
                </View>
                {index < trackingSteps.length - 1 && (
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
            {config.technicianCallEnabled && (
              <TouchableOpacity 
                style={styles.callButton} 
                onPress={handleCallTechnician}
              >
                <Ionicons name="call" size={20} color="white" />
                <Text style={styles.callButtonText}>Call Technician</Text>
              </TouchableOpacity>
            )}
            
            {config.allowCancellation && (
              <TouchableOpacity 
                style={[styles.cancelButton, !config.technicianCallEnabled && { flex: 1 }]} 
                onPress={handleCancelBooking}
              >
                <Ionicons name="close-circle" size={20} color="#EF4444" />
                <Text style={styles.cancelButtonText}>Cancel Booking</Text>
              </TouchableOpacity>
            )}
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