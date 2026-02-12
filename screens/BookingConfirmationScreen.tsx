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
  const [addOnServices, setAddOnServices] = useState<any[]>([]);
  const [totalWithAddOns, setTotalWithAddOns] = useState<number>(0);

  // Set up real-time listener for booking data instead of manual fetch
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
        setTotalWithAddOns(booking.totalPrice || 0);
        
        // Fetch company name if companyId exists
        if (booking.companyId) {
          try {
            const companyNameFetched = await FirestoreService.getActualCompanyName(booking.companyId);
            setCompanyName(companyNameFetched);
            
            // Try to get company phone from service_company collection
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

        // Try to determine category ID for add-on services
        await determineCategoryId(booking.serviceName);
        
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

  // Helper function to get status color and icon
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

  // Helper function to format date and time
  const formatDateTime = (date: string, time: string) => {
    if (!date) return 'Not scheduled';
    
    try {
      // Try to parse and format the date nicely
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

  // Get display data - prioritize real booking data over fallback
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
        status: bookingData.status, // Real-time status from Firebase
        totalPrice: bookingData.totalPrice || 0,
        addOns: bookingData.addOns || [],
        technicianName: bookingData.technicianName,
        technicianId: bookingData.technicianId,
        estimatedDuration: bookingData.estimatedDuration,
        companyId: bookingData.companyId, // Add company ID
        createdAt: bookingData.createdAt,
        updatedAt: bookingData.updatedAt,
        assignedAt: bookingData.assignedAt,
        startedAt: bookingData.startedAt,
        completedAt: bookingData.completedAt,
      };
    }
    
    // Fallback to route params if no booking data
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
      companyId: fallbackData.companyId, // Add company ID from fallback
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

  // Helper function to check if technician is assigned
  const isTechnicianAssigned = (): boolean => {
    if (!bookingData) return false;
    
    // Check multiple conditions to determine if technician is assigned
    const hasAssignedStatus = bookingData.status === 'assigned' || 
                             bookingData.status === 'started' || 
                             bookingData.status === 'completed';
    
    const hasTechnicianInfo = !!(bookingData.technicianName || 
                                bookingData.technicianId || 
                                bookingData.workerName || 
                                bookingData.workerId);
    
    const hasAssignmentTimestamp = !!bookingData.assignedAt;
    
    // Technician is considered assigned if any of these conditions are met
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
      const newTotal = (bookingData?.totalPrice || 0) + addOnTotal;
      setTotalWithAddOns(newTotal);
      
      console.log(`✅ Add-on services confirmed with payment: ${selectedServices.length} services, ₹${addOnTotal}`);
      
      // Refresh booking data to show updated add-ons
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
      {/* Header with gradient effect */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.successIconContainer}>
            <Ionicons name="checkmark-circle" size={48} color="#10B981" />
          </View>
          <Text style={styles.headerTitle}>Booking Confirmed!</Text>
          <Text style={styles.headerSubtitle}>Your service has been scheduled</Text>
        </View>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
      >
        
        {/* Status Banner */}
        <View style={[styles.statusBanner, { backgroundColor: getStatusInfo(displayData.status).color }]}>
          <Ionicons 
            name={getStatusInfo(displayData.status).icon as any} 
            size={24} 
            color="#fff" 
          />
          <Text style={styles.statusBannerText}>
            Status: {getStatusInfo(displayData.status).text}
          </Text>
        </View>

        {/* Booking Details Card */}
        <View style={styles.bookingCard}>
          
          {/* Booking ID */}
          <View style={styles.detailRow}>
            <View style={styles.iconContainer}>
              <Ionicons name="document-text" size={20} color="#6B7280" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Booking ID:</Text>
              <Text style={styles.detailValue}>{displayData.bookingId || "-"}</Text>
            </View>
          </View>

          {/* Service Name */}
          <View style={styles.detailRow}>
            <View style={styles.iconContainer}>
              <Ionicons name="construct" size={20} color="#6B7280" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Service:</Text>
              <Text style={styles.detailValue}>{displayData.serviceName || "-"}</Text>
              {displayData.workName && displayData.workName !== displayData.serviceName && (
                <Text style={styles.workNameText}>Work: {displayData.workName}</Text>
              )}
            </View>
          </View>

          {/* Service Date & Time */}
          <View style={styles.detailRow}>
            <View style={styles.iconContainer}>
              <Ionicons name="calendar" size={20} color="#6B7280" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Scheduled:</Text>
              <Text style={styles.detailValue}>
                {formatDateTime(displayData.selectedDate, displayData.selectedTime)}
              </Text>
              {displayData.estimatedDuration && (
                <Text style={styles.durationText}>
                  Duration: {displayData.estimatedDuration} hour{displayData.estimatedDuration > 1 ? 's' : ''}
                </Text>
              )}
            </View>
          </View>

          {/* Company */}
          <View style={styles.detailRow}>
            <View style={styles.iconContainer}>
              <Ionicons name="business" size={20} color="#6B7280" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Service Provider:</Text>
              <Text style={styles.detailValue}>{companyName || "Assigning..."}</Text>
            </View>
          </View>

          {/* Technician Information */}
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

          {/* Customer Info */}
          {displayData.customerName && (
            <View style={styles.detailRow}>
              <View style={styles.iconContainer}>
                <Ionicons name="person-circle" size={20} color="#6B7280" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Customer:</Text>
                <Text style={styles.detailValue}>{displayData.customerName}</Text>
                {displayData.customerPhone && (
                  <Text style={styles.customerInfoText}>📱 {displayData.customerPhone}</Text>
                )}
                {displayData.customerAddress && (
                  <Text style={styles.customerInfoText}>📍 {displayData.customerAddress}</Text>
                )}
              </View>
            </View>
          )}

          {/* Timeline - Show timestamps based on status */}
          {(displayData.assignedAt || displayData.startedAt || displayData.completedAt) && (
            <View style={styles.timelineSection}>
              <Text style={styles.sectionTitle}>Booking Timeline</Text>
              
              {displayData.createdAt && (
                <View style={styles.timelineItem}>
                  <View style={styles.timelineDot} />
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineLabel}>Booking Created</Text>
                    <Text style={styles.timelineTime}>
                      {new Date(displayData.createdAt.toDate()).toLocaleString()}
                    </Text>
                  </View>
                </View>
              )}
              
              {displayData.assignedAt && (
                <View style={styles.timelineItem}>
                  <View style={[styles.timelineDot, { backgroundColor: '#3B82F6' }]} />
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineLabel}>Technician Assigned</Text>
                    <Text style={styles.timelineTime}>
                      {new Date(displayData.assignedAt.toDate()).toLocaleString()}
                    </Text>
                  </View>
                </View>
              )}
              
              {displayData.startedAt && (
                <View style={styles.timelineItem}>
                  <View style={[styles.timelineDot, { backgroundColor: '#8B5CF6' }]} />
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineLabel}>Service Started</Text>
                    <Text style={styles.timelineTime}>
                      {new Date(displayData.startedAt.toDate()).toLocaleString()}
                    </Text>
                  </View>
                </View>
              )}
              
              {displayData.completedAt && (
                <View style={styles.timelineItem}>
                  <View style={[styles.timelineDot, { backgroundColor: '#10B981' }]} />
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineLabel}>Service Completed</Text>
                    <Text style={styles.timelineTime}>
                      {new Date(displayData.completedAt.toDate()).toLocaleString()}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Total Amount - Highlighted */}
          <View style={styles.priceCard}>
            <View style={styles.priceHeader}>
              <Ionicons name="cash-outline" size={24} color="#10B981" />
              <Text style={styles.priceLabel}>Total Amount</Text>
            </View>
            <Text style={styles.priceValue}>₹{displayData.totalPrice || 0}</Text>
            {displayData.addOns && displayData.addOns.length > 0 && (
              <Text style={styles.priceNote}>Includes {displayData.addOns.length} add-on service(s)</Text>
            )}
          </View>

          {/* Add-On Services */}
          {displayData.addOns && displayData.addOns.length > 0 && (
            <View style={styles.addOnSection}>
              <View style={styles.sectionHeader}>
                <Ionicons name="add-circle" size={20} color="#F59E0B" />
                <Text style={styles.sectionTitle}>Add-On Services</Text>
              </View>
              <View style={styles.addOnList}>
                {displayData.addOns.map((service: any, index: number) => (
                  <View key={index} style={styles.addOnCard}>
                    <View style={styles.addOnIconWrapper}>
                      <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                    </View>
                    <View style={styles.addOnDetails}>
                      <Text style={styles.addOnName}>{service.name}</Text>
                      <Text style={styles.addOnPrice}>₹{service.price}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          
          {/* Add-On Services Button - Only show when technician is assigned */}
          {categoryId && isTechnicianAssigned() && (
            <TouchableOpacity 
              style={styles.addOnButton}
              onPress={handleAddOnServices}
            >
              <View style={styles.buttonIconWrapper}>
                <Ionicons name="add-circle" size={22} color="#fff" />
              </View>
              <View style={styles.buttonTextWrapper}>
                <Text style={styles.addOnButtonText}>Add More Services</Text>
                <Text style={styles.buttonSubtext}>Enhance your booking</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#fff" />
            </TouchableOpacity>
          )}

          {/* Primary Actions Grid */}
          <View style={styles.primaryActionsGrid}>
            <TouchableOpacity 
              style={styles.gridButton}
              onPress={handleTrackBooking}
            >
              <View style={[styles.gridIconContainer, { backgroundColor: '#8B5CF6' }]}>
                <Ionicons name="location" size={28} color="#fff" />
              </View>
              <Text style={styles.gridButtonText}>Track</Text>
              <Text style={styles.gridButtonSubtext}>Live Location</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.gridButton}
              onPress={handleCallAgency}
            >
              <View style={[styles.gridIconContainer, { backgroundColor: '#3B82F6' }]}>
                <Ionicons name="call" size={28} color="#fff" />
              </View>
              <Text style={styles.gridButtonText}>Call</Text>
              <Text style={styles.gridButtonSubtext}>Contact Agency</Text>
            </TouchableOpacity>
          </View>

          {/* Secondary Action */}
          <TouchableOpacity 
            style={styles.secondaryButton}
            onPress={handleGoToBookingHistory}
          >
            <Ionicons name="time-outline" size={20} color="#6B7280" />
            <Text style={styles.secondaryButtonText}>View Booking History</Text>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>

        </View>

        {/* Bottom spacing */}
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
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  header: {
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 20,
    backgroundColor: "#fff",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  headerContent: {
    alignItems: "center",
  },
  successIconContainer: {
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusBannerText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  bookingCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 18,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 13,
    color: "#9CA3AF",
    marginBottom: 5,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "700",
    lineHeight: 22,
  },
  phoneText: {
    fontSize: 14,
    color: "#10B981",
    marginTop: 6,
    fontWeight: "600",
  },
  priceCard: {
    backgroundColor: "#F0FDF4",
    borderRadius: 16,
    padding: 20,
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "#10B981",
  },
  priceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 14,
    color: "#059669",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  priceValue: {
    fontSize: 32,
    color: "#10B981",
    fontWeight: "900",
    marginBottom: 4,
  },
  priceNote: {
    fontSize: 12,
    color: "#059669",
    fontWeight: "500",
  },
  actionButtons: {
    gap: 12,
    marginBottom: 20,
  },
  addOnButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F59E0B",
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 16,
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonTextWrapper: {
    flex: 1,
    marginLeft: 12,
  },
  addOnButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 2,
  },
  buttonSubtext: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 12,
    fontWeight: "500",
  },
  primaryActionsGrid: {
    flexDirection: "row",
    gap: 12,
  },
  gridButton: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  gridIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  gridButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },
  gridButtonSubtext: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#fff",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
  },
  secondaryButtonText: {
    color: "#374151",
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6B7280",
  },
  workNameText: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 4,
    fontStyle: "italic",
  },
  durationText: {
    fontSize: 12,
    color: "#8B5CF6",
    marginTop: 2,
  },
  customerInfoText: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  technicianNote: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
    fontStyle: "italic",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  addOnSection: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  addOnList: {
    gap: 10,
  },
  addOnCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    padding: 14,
    borderRadius: 12,
    gap: 12,
  },
  addOnIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
  },
  addOnDetails: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  addOnName: {
    fontSize: 15,
    color: "#374151",
    fontWeight: "600",
    flex: 1,
  },
  addOnPrice: {
    fontSize: 16,
    color: "#10B981",
    fontWeight: "700",
  },
  timelineSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  timelineItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 12,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#10B981",
    marginTop: 4,
    marginRight: 12,
  },
  timelineContent: {
    flex: 1,
  },
  timelineLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 2,
  },
  timelineTime: {
    fontSize: 12,
    color: "#6B7280",
  },
  timestampRow: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 12,
    marginTop: 12,
  },
  timestampLabel: {
    fontSize: 11,
    color: "#9CA3AF",
    marginBottom: 4,
  },
  timestampText: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
});