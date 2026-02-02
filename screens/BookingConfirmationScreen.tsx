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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Booking Confirmed 🎉</Text>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
      >
        
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
              {companyPhone && (
                <TouchableOpacity onPress={handleCallAgency}>
                  <Text style={styles.phoneText}>📞 {companyPhone}</Text>
                </TouchableOpacity>
              )}
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

          {/* Status with enhanced display */}
          <View style={styles.detailRow}>
            <View style={[styles.iconContainer, { backgroundColor: getStatusInfo(displayData.status).color + '20' }]}>
              <Ionicons 
                name={getStatusInfo(displayData.status).icon as any} 
                size={20} 
                color={getStatusInfo(displayData.status).color} 
              />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Booking Status:</Text>
              <View style={styles.statusContainer}>
                <View style={[styles.statusBadge, { backgroundColor: getStatusInfo(displayData.status).color }]}>
                  <Text style={styles.statusBadgeText}>{getStatusInfo(displayData.status).text}</Text>
                </View>
              </View>
              {/* Show timestamps based on status */}
              {displayData.assignedAt && (
                <Text style={styles.timestampText}>
                  Assigned: {new Date(displayData.assignedAt.toDate()).toLocaleString()}
                </Text>
              )}
              {displayData.startedAt && (
                <Text style={styles.timestampText}>
                  Started: {new Date(displayData.startedAt.toDate()).toLocaleString()}
                </Text>
              )}
              {displayData.completedAt && (
                <Text style={styles.timestampText}>
                  Completed: {new Date(displayData.completedAt.toDate()).toLocaleString()}
                </Text>
              )}
            </View>
          </View>

          {/* Total Amount */}
          <View style={styles.detailRow}>
            <View style={styles.iconContainer}>
              <Ionicons name="cash" size={20} color="#6B7280" />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Total Amount:</Text>
              <Text style={styles.priceValue}>₹{displayData.totalPrice || 0}</Text>
            </View>
          </View>

          {/* Add-On Services */}
          {displayData.addOns && displayData.addOns.length > 0 && (
            <View style={styles.detailRow}>
              <View style={styles.iconContainer}>
                <Ionicons name="add-circle" size={20} color="#6B7280" />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Add-On Services:</Text>
                <View style={styles.addOnContainer}>
                  {displayData.addOns.map((service: any, index: number) => (
                    <View key={index} style={styles.addOnItem}>
                      <Text style={styles.addOnName}>• {service.name}</Text>
                      <Text style={styles.addOnPrice}>₹{service.price}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Created/Updated timestamps */}
          {displayData.createdAt && (
            <View style={styles.timestampRow}>
              <Text style={styles.timestampLabel}>
                Created: {new Date(displayData.createdAt.toDate()).toLocaleString()}
              </Text>
              {displayData.updatedAt && displayData.updatedAt !== displayData.createdAt && (
                <Text style={styles.timestampLabel}>
                  Updated: {new Date(displayData.updatedAt.toDate()).toLocaleString()}
                </Text>
              )}
            </View>
          )}

        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          
          {/* Add-On Services Button */}
          {categoryId && (
            <TouchableOpacity 
              style={styles.addOnButton}
              onPress={handleAddOnServices}
            >
              <Ionicons name="add-circle" size={18} color="#fff" />
              <Text style={styles.addOnButtonText}>Add More Services</Text>
            </TouchableOpacity>
          )}

          {/* Call Agency & Track Booking Row */}
          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={styles.callButton}
              onPress={handleCallAgency}
            >
              <Ionicons name="call" size={18} color="#fff" />
              <Text style={styles.callButtonText}>Call Agency</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.trackButton}
              onPress={handleTrackBooking}
            >
              <Ionicons name="location" size={18} color="#fff" />
              <Text style={styles.trackButtonText}>Track Booking</Text>
            </TouchableOpacity>
          </View>

          {/* Go to Booking History */}
          <TouchableOpacity 
            style={styles.historyButton}
            onPress={handleGoToBookingHistory}
          >
            <Ionicons name="time" size={18} color="#fff" />
            <Text style={styles.historyButtonText}>Go to Booking History</Text>
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
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
  },
  content: {
    flex: 1,
    padding: 20,
  },
  bookingCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 15,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 4,
    fontWeight: "500",
  },
  detailValue: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "600",
  },
  phoneText: {
    fontSize: 14,
    color: "#10B981",
    marginTop: 4,
    fontWeight: "500",
  },
  priceValue: {
    fontSize: 18,
    color: "#10B981",
    fontWeight: "700",
  },
  statusBadge: {
    backgroundColor: "#10B981",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusBadgeText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  actionButtons: {
    gap: 15,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 15,
  },
  callButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#1F2937",
    paddingVertical: 16,
    borderRadius: 12,
  },
  callButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  trackButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#8B5CF6",
    paddingVertical: 16,
    borderRadius: 12,
  },
  trackButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  historyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#10B981",
    paddingVertical: 16,
    borderRadius: 12,
  },
  historyButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
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
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
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
  addOnContainer: {
    marginTop: 4,
  },
  addOnItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  addOnName: {
    fontSize: 14,
    color: "#374151",
    flex: 1,
  },
  addOnPrice: {
    fontSize: 14,
    color: "#10B981",
    fontWeight: "600",
  },
  addOnButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#F59E0B",
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 15,
  },
  addOnButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});