import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
  ActivityIndicator,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { FirestoreService, ServiceBooking } from "../services/firestoreService";
import firestore from "@react-native-firebase/firestore";
import AddOnServicesModal from "../components/AddOnServicesModal";
import TechnicianInfo from "../components/TechnicianInfo";

export default function BookingConfirmationScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  
  const { bookingId } = route.params || {};
  
  const [loading, setLoading] = useState(true);
  const [bookingData, setBookingData] = useState<ServiceBooking | null>(null);
  const [companyName, setCompanyName] = useState<string>("");
  const [companyPhone, setCompanyPhone] = useState<string>("");
  const [showAddOnModal, setShowAddOnModal] = useState(false);
  const [categoryId, setCategoryId] = useState<string>("");

  // Set up real-time listener for booking data
  useEffect(() => {
    if (!bookingId) {
      console.error("No bookingId provided");
      setLoading(false);
      return;
    }

    console.log(`📱 Setting up real-time listener for booking ${bookingId}...`);
    
    const unsubscribe = FirestoreService.listenToServiceBooking(
      bookingId,
      async (booking) => {
        if (!booking) {
          Alert.alert("Error", "Booking not found");
          setLoading(false);
          return;
        }

        setBookingData(booking);
        
        console.log('📦 [BookingConfirmation] Booking package info:', {
          isPackage: booking.isPackage,
          packageName: booking.packageName,
          packageId: booking.packageId,
          packageType: booking.packageType,
          bookingType: booking.bookingType
        });
        
        console.log('⏱️ [BookingConfirmation] Duration info:', {
          estimatedDuration: booking.estimatedDuration,
          selectedSlots: (booking as any).selectedSlots,
          selectedSlotsLength: Array.isArray((booking as any).selectedSlots) ? (booking as any).selectedSlots.length : 0,
          time: booking.time
        });
        
        // Fetch company name if companyId exists
        if (booking.companyId) {
          try {
            const companyNameFetched = await FirestoreService.getActualCompanyName(booking.companyId);
            setCompanyName(companyNameFetched);
            
            const companyDoc = await firestore()
              .collection('service_company')
              .doc(booking.companyId)
              .get();
            
            if (companyDoc.exists) {
              const companyData = companyDoc.data();
              setCompanyPhone(companyData?.phone || companyData?.contactInfo?.phone || "");
            }
          } catch (error) {
            console.error("Error fetching company data:", error);
            setCompanyName(`Company ${booking.companyId}`);
          }
        }

        if (booking.categoryId) {
          setCategoryId(booking.categoryId);
          console.log(`📱 Using booking.categoryId for add-ons: ${booking.categoryId}`);
        } else {
          await determineCategoryId(booking.serviceName);
        }
        
        console.log(`🔄 Real-time update: ${booking.serviceName} - Status: ${booking.status}`);
        setLoading(false);
      },
      (error) => {
        console.error('❌ Error in real-time listener:', error);
        Alert.alert("Error", "Failed to load booking details");
        setLoading(false);
      }
    );

    return () => {
      console.log(`🔥 Cleaning up real-time listener for booking ${bookingId}...`);
      unsubscribe();
    };
  }, [bookingId]);

  const getStatusInfo = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return { color: '#F59E0B', icon: 'time-outline', text: 'Pending' };
      case 'assigned':
        return { color: '#3B82F6', icon: 'person-outline', text: 'Assigned' };
      case 'started':
        return { color: '#8B5CF6', icon: 'play-outline', text: 'In Progress' };
      case 'completed':
        return { color: '#10B981', icon: 'checkmark-circle-outline', text: 'Completed' };
      case 'rejected':
        return { color: '#EF4444', icon: 'close-circle-outline', text: 'Rejected' };
      case 'expired':
        return { color: '#6B7280', icon: 'time-outline', text: 'Expired' };
      default:
        return { color: '#6B7280', icon: 'help-circle-outline', text: status || 'Unknown' };
    }
  };

  const formatDateTime = (date: string, time: string) => {
    if (!date) return 'Not scheduled';
    
    try {
      const dateObj = new Date(date);
      if (!isNaN(dateObj.getTime())) {
        const formattedDate = dateObj.toLocaleDateString('en-US', {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
        return `${formattedDate} at ${time || 'Time TBD'}`;
      }
    } catch (error) {
      console.log('Date parsing error:', error);
    }
    
    return `${date} at ${time || 'Time TBD'}`;
  };

  const formatEstimatedDuration = (raw: any, selectedSlots?: any[], timeSlot?: string): string | null => {
    // First, try to parse duration from time slot string (e.g., "9:00 AM - 9:30 AM")
    if (timeSlot && typeof timeSlot === 'string' && timeSlot.includes('-')) {
      try {
        const [startTime, endTime] = timeSlot.split('-').map(t => t.trim());
        
        const parseTime = (timeStr: string): number => {
          const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
          if (!match) return 0;
          
          let hours = parseInt(match[1]);
          const minutes = parseInt(match[2]);
          const period = match[3].toUpperCase();
          
          if (period === 'PM' && hours !== 12) hours += 12;
          if (period === 'AM' && hours === 12) hours = 0;
          
          return hours * 60 + minutes;
        };
        
        const startMinutes = parseTime(startTime);
        const endMinutes = parseTime(endTime);
        
        if (startMinutes > 0 || endMinutes > 0) {
          const durationMinutes = endMinutes - startMinutes;
          
          if (durationMinutes > 0) {
            if (durationMinutes < 60) return `${durationMinutes} min`;
            
            const h = Math.floor(durationMinutes / 60);
            const m = durationMinutes % 60;
            if (m === 0) return `${h} hour${h !== 1 ? 's' : ''}`;
            return `${h}h ${m}m`;
          }
        }
      } catch (error) {
        console.log('Error parsing time slot:', error);
      }
    }
    
    // Second, try to calculate duration from selectedSlots
    if (Array.isArray(selectedSlots) && selectedSlots.length > 0) {
      // Each slot is typically 30 minutes
      const slotDurationMinutes = 30;
      const totalMinutes = selectedSlots.length * slotDurationMinutes;
      
      if (totalMinutes < 60) return `${totalMinutes} min`;
      
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      if (m === 0) return `${h} hour${h !== 1 ? 's' : ''}`;
      return `${h}h ${m}m`;
    }
    
    // Fallback to raw duration value
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return null;

    const minutes = n >= 12 ? Math.round(n) : Math.round(n * 60);
    if (minutes < 60) return `${minutes} min`;

    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (m === 0) return `${h} hour${h !== 1 ? 's' : ''}`;
    return `${h}h ${m}m`;
  };

  const determineCategoryId = async (serviceName: string) => {
    try {
      if (categoryId) return;
      const categories = await FirestoreService.getServiceCategories();
      
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

  const getDisplayData = () => {
    const fallbackData = route.params || {};
    
    if (bookingData) {
      return {
        bookingId: bookingData.id || bookingId,
        serviceName: bookingData.serviceName,
        workName: bookingData.workName,
        customerName: bookingData.customerName,
        customerPhone: bookingData.customerPhone,
        customerAddress: bookingData.customerAddress,
        selectedDate: bookingData.date,
        selectedTime: bookingData.time,
        status: bookingData.status,
        totalPrice: bookingData.totalPrice || 0,
        addOns: bookingData.addOns || [],
        technicianName: bookingData.technicianName,
        technicianId: bookingData.technicianId,
        estimatedDuration: bookingData.estimatedDuration,
        selectedSlots: (bookingData as any).selectedSlots || [], // Get selectedSlots from booking data
        companyId: bookingData.companyId,
        createdAt: bookingData.createdAt,
        updatedAt: bookingData.updatedAt,
        assignedAt: bookingData.assignedAt,
        startedAt: bookingData.startedAt,
        completedAt: bookingData.completedAt,
      };
    }
    
    return {
      bookingId: fallbackData.bookingId || bookingId,
      serviceName: fallbackData.serviceName || "",
      workName: fallbackData.workName || fallbackData.serviceName || "",
      customerName: fallbackData.customerName || "",
      customerPhone: fallbackData.customerPhone || "",
      customerAddress: fallbackData.customerAddress || "",
      selectedDate: fallbackData.selectedDate || "",
      selectedTime: fallbackData.selectedTime || "",
      status: fallbackData.status || "pending",
      totalPrice: fallbackData.totalAmount || fallbackData.totalPrice || 0,
      addOns: [],
      selectedSlots: fallbackData.selectedSlots || [],
      companyId: fallbackData.companyId,
    };
  };

  const displayData = getDisplayData();

  const handleTrackBooking = () => {
    navigation.navigate("TrackBooking", {
      bookingId: bookingId,
    });
  };

  const handleCallAgency = () => {
    if (companyPhone) {
      Alert.alert(
        "Call Company",
        `Call ${companyName || "Service Provider"} at ${companyPhone}?`,
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Call", 
            onPress: () => {
              Linking.openURL(`tel:${companyPhone}`);
            }
          },
        ]
      );
    } else {
      Alert.alert(
        "Contact Information",
        "Company contact information is not available at the moment.",
        [{ text: "OK" }]
      );
    }
  };

  const handleGoToBookingHistory = () => {
    navigation.navigate("BookingHistory");
  };

  const isTechnicianAssigned = (): boolean => {
    if (!bookingData) return false;
    
    const hasAssignedStatus = bookingData.status === 'assigned' || 
                             bookingData.status === 'started' || 
                             bookingData.status === 'completed';
    
    const hasTechnicianInfo = !!(bookingData.technicianName || 
                                bookingData.technicianId || 
                                bookingData.workerName || 
                                bookingData.workerId);
    
    const hasAssignmentTimestamp = !!bookingData.assignedAt;
    
    const isAssigned = hasAssignedStatus || hasTechnicianInfo || hasAssignmentTimestamp;
    
    console.log(`🔍 Checking technician assignment:`, {
      status: bookingData.status,
      hasAssignedStatus,
      hasTechnicianInfo,
      hasAssignmentTimestamp,
      technicianName: bookingData.technicianName,
      workerName: bookingData.workerName,
      isAssigned
    });
    
    return isAssigned;
  };

  const handleAddOnServices = () => {
    const effectiveWorkerId = bookingData?.workerId || bookingData?.technicianId;
    if (!effectiveWorkerId && !categoryId) {
      Alert.alert(
        "Add-On Services Unavailable",
        "Unable to load add-on services because the assigned worker or service category is missing."
      );
      return;
    }
    
    console.log('🔍 [BookingConfirmation] Add-on services button clicked:', {
      workerId: bookingData?.workerId,
      technicianId: bookingData?.technicianId,
      workerName: bookingData?.workerName,
      technicianName: bookingData?.technicianName,
      companyId: bookingData?.companyId
    });
    
    setShowAddOnModal(true);
  };

  const handleAddServicesConfirm = async (selectedServices: any[]) => {
    try {
      console.log(`✅ Add-on services confirmed with payment: ${selectedServices.length} services`);
      
      if (bookingId) {
        try {
          const updatedBooking = await FirestoreService.getServiceBookingById(bookingId);
          if (updatedBooking) {
            setBookingData(updatedBooking);
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading booking details...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.successIcon}>
          <Ionicons name="checkmark" size={50} color="#fff" />
        </View>
        <Text style={styles.headerTitle}>Booking Confirmed!</Text>
        <Text style={styles.headerSubtitle}>Your service has been scheduled</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Status Banner */}
        <View style={[styles.statusBanner, { backgroundColor: getStatusInfo(displayData.status).color }]}>
          <Ionicons 
            name={getStatusInfo(displayData.status).icon as any} 
            size={22} 
            color="#fff" 
          />
          <Text style={styles.statusText}>
            Status: {getStatusInfo(displayData.status).text}
          </Text>
        </View>

        {/* Main Details Card */}
        <View style={styles.detailsCard}>
          
          {/* Booking ID */}
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Booking ID</Text>
            <Text style={styles.detailValue}>{displayData.bookingId}</Text>
          </View>

          {/* Service */}
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Service</Text>
            <Text style={styles.detailValue}>{displayData.serviceName}</Text>
            {displayData.workName && displayData.workName !== displayData.serviceName && (
              <Text style={styles.detailSubValue}>{displayData.workName}</Text>
            )}
          </View>

          {/* Scheduled */}
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Scheduled</Text>
            <Text style={styles.detailValue}>
              {formatDateTime(displayData.selectedDate, displayData.selectedTime)}
            </Text>
          </View>

          {/* Duration */}
          {!!formatEstimatedDuration(displayData.estimatedDuration, displayData.selectedSlots, displayData.selectedTime) && (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Duration</Text>
              <Text style={styles.detailValue}>{formatEstimatedDuration(displayData.estimatedDuration, displayData.selectedSlots, displayData.selectedTime)}</Text>
            </View>
          )}

          {/* Service Provider */}
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>Service Provider</Text>
            <Text style={styles.detailValue}>{companyName || "Assigning..."}</Text>
          </View>

          {/* Technician Info */}
          <TechnicianInfo 
            booking={{
              ...displayData,
              id: displayData.bookingId,
              date: displayData.selectedDate,
              time: displayData.selectedTime,
            } as ServiceBooking}
            onCallTechnician={() => {
              if (displayData.technicianName) {
                Alert.alert(
                  "Call Technician",
                  `Call ${displayData.technicianName}?`,
                  [
                    { text: "Cancel", style: "cancel" },
                    { text: "Call", onPress: () => console.log("Calling technician...") },
                  ]
                );
              }
            }}
            compact={true}
          />

          {/* Customer */}
          {displayData.customerName && (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Customer</Text>
              <Text style={styles.detailValue}>{displayData.customerName}</Text>
            </View>
          )}

          {/* Add-On Services */}
          {displayData.addOns && displayData.addOns.length > 0 && (
            <View style={styles.addOnSection}>
              <Text style={styles.detailLabel}>Add-On Services</Text>
              {displayData.addOns.map((service: any, index: number) => (
                <View key={index} style={styles.addOnItem}>
                  <Text style={styles.addOnName}>• {service.name}</Text>
                  <Text style={styles.addOnPrice}>₹{service.price}</Text>
                </View>
              ))}
            </View>
          )}

        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          
          {/* Add More Services Button */}
          {(() => {
            const isPackageBooking = bookingData?.isPackage === true || 
                                     !!(bookingData?.packageName) || 
                                     !!(bookingData?.packageId) ||
                                     !!(bookingData?.packageType) ||
                                     bookingData?.serviceName?.toLowerCase().includes('package') ||
                                     bookingData?.serviceName?.toLowerCase().includes('monthly') ||
                                     bookingData?.serviceName?.toLowerCase().includes('weekly') ||
                                     bookingData?.serviceName?.toLowerCase().includes('gym') ||
                                     bookingData?.serviceName?.toLowerCase().includes('yoga') ||
                                     bookingData?.serviceName?.toLowerCase().includes('fitness');

            const effectiveWorkerId = bookingData?.workerId || bookingData?.technicianId;
            const shouldShowAddOn = isTechnicianAssigned() && !isPackageBooking && !!(effectiveWorkerId || categoryId);
            
            return shouldShowAddOn ? (
              <TouchableOpacity 
                style={styles.primaryButton}
                onPress={handleAddOnServices}
              >
                <Ionicons name="add-circle-outline" size={20} color="#fff" />
                <Text style={styles.primaryButtonText}>Add More Services</Text>
              </TouchableOpacity>
            ) : null;
          })()}

          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={handleTrackBooking}
          >
            <Ionicons name="location-outline" size={20} color="#fff" />
            <Text style={styles.primaryButtonText}>Track Booking</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.outlineButton}
            onPress={handleCallAgency}
          >
            <Ionicons name="call-outline" size={20} color="#007AFF" />
            <Text style={styles.outlineButtonText}>Call Service Provider</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.outlineButton}
            onPress={handleGoToBookingHistory}
          >
            <Ionicons name="time-outline" size={20} color="#007AFF" />
            <Text style={styles.outlineButtonText}>View Booking History</Text>
          </TouchableOpacity>

        </View>

        <View style={{ height: 30 }} />

      </ScrollView>

      {/* Add-On Services Modal */}
      <AddOnServicesModal
        visible={showAddOnModal}
        onClose={() => setShowAddOnModal(false)}
        onAddServices={handleAddServicesConfirm}
        categoryId={categoryId}
        existingServices={[
          ...(displayData.serviceName ? [displayData.serviceName] : []),
          ...(displayData.workName && displayData.workName !== displayData.serviceName ? [displayData.workName] : []),
          ...(displayData.addOns?.map(addon => addon.name) || [])
        ]}
        bookingId={bookingId}
        companyId={displayData.companyId}
        workerId={bookingData?.workerId || bookingData?.technicianId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    backgroundColor: "#fff",
    paddingTop: 50,
    paddingBottom: 25,
    paddingHorizontal: 20,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#666",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  statusText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  detailsCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  detailSection: {
    marginBottom: 18,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  detailLabel: {
    fontSize: 13,
    color: "#888",
    marginBottom: 6,
  },
  detailValue: {
    fontSize: 16,
    color: "#1a1a1a",
    fontWeight: "600",
  },
  detailSubValue: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  addOnSection: {
    marginTop: 8,
  },
  addOnItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    marginTop: 8,
  },
  addOnName: {
    fontSize: 15,
    color: "#333",
    flex: 1,
  },
  addOnPrice: {
    fontSize: 15,
    fontWeight: "600",
    color: "#10B981",
  },
  actionButtons: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: "#007AFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 10,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  outlineButton: {
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#007AFF",
  },
  outlineButtonText: {
    color: "#007AFF",
    fontSize: 16,
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
});
