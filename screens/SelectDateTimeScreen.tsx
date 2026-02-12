import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { firestore } from "../firebase.native";

export default function SelectDateTimeScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const { serviceTitle, categoryId, issues, selectedIssueIds, selectedIssues, fromServiceServices, isPackageBooking, selectedPackage } = route.params;

  // Debug: Log all route params immediately
  console.log('🚀 SelectDateTimeScreen MOUNTED with params:', JSON.stringify({
    serviceTitle,
    categoryId,
    issues,
    selectedIssueIds,
    selectedIssues: selectedIssues?.map((s: any) => s.name),
    fromServiceServices,
    isPackageBooking,
    selectedPackage: selectedPackage ? {
      name: selectedPackage.name,
      price: selectedPackage.price,
      id: selectedPackage.id
    } : null
  }, null, 2));

  // State for slots
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);

  // Predefined slots for services (non-package bookings)
  const defaultSlots = [
    "9:00 AM - 11:00 AM",
    "11:00 AM - 1:00 PM", 
    "1:00 PM - 3:00 PM",
    "3:00 PM - 5:00 PM",
    "5:00 PM - 7:00 PM",
    "7:00 PM - 9:00 PM",
  ];

  const [time, setTime] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => {
    // Default to tomorrow instead of today
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  });

  // Fetch slots based on booking type
  useEffect(() => {
    const fetchSlots = async () => {
      try {
        setLoadingSlots(true);
        
        console.log('🔍 SelectDateTimeScreen - Route params:', {
          isPackageBooking,
          isPackageBookingType: typeof isPackageBooking,
          isPackageBookingTruthy: !!isPackageBooking,
          selectedPackage: selectedPackage?.name,
          hasSelectedPackage: !!selectedPackage,
          serviceId: selectedIssueIds?.[0],
          fromServiceServices
        });
        
        // Check if this is a package booking (explicit true check)
        if (isPackageBooking === true && selectedPackage) {
          // For packages: fetch slots from Firestore
          console.log('📦 PACKAGE BOOKING - Fetching slots from Firestore for package:', selectedPackage.name);
          
          // Get the service ID from selectedIssueIds
          const serviceId = selectedIssueIds?.[0];
          
          if (serviceId) {
            console.log('📦 Querying service_services collection for serviceId:', serviceId);
            const serviceDoc = await firestore()
              .collection('service_services')
              .doc(serviceId)
              .get();
            
            if (serviceDoc.exists) {
              const serviceData = serviceDoc.data();
              console.log('📦 Full service data from Firestore:', JSON.stringify(serviceData, null, 2));
              
              let packageSlots: string[] = [];
              
              // Check if service has packages array
              if (serviceData?.packages && Array.isArray(serviceData.packages)) {
                console.log('📦 Found packages array in service, searching for matching package...');
                
                // Find the selected package in the packages array
                const matchingPackage = serviceData.packages.find((pkg: any) => 
                  pkg.id === selectedPackage.id || 
                  pkg.name === selectedPackage.name ||
                  JSON.stringify(pkg) === JSON.stringify(selectedPackage)
                );
                
                if (matchingPackage) {
                  console.log('📦 Found matching package:', matchingPackage);
                  
                  // Check for availability.timeSlots structure (as shown in screenshot)
                  if (matchingPackage.availability?.timeSlots && Array.isArray(matchingPackage.availability.timeSlots)) {
                    console.log('📦 Found availability.timeSlots in package');
                    packageSlots = matchingPackage.availability.timeSlots.map((slot: any) => {
                      // Convert 24-hour format to 12-hour format with AM/PM
                      const formatTime = (time: string) => {
                        const [hours, minutes] = time.split(':');
                        const hour = parseInt(hours);
                        const ampm = hour >= 12 ? 'PM' : 'AM';
                        const hour12 = hour % 12 || 12;
                        return `${hour12}:${minutes} ${ampm}`;
                      };
                      
                      return `${formatTime(slot.startTime)} - ${formatTime(slot.endTime)}`;
                    });
                  }
                  // Fallback: Check for direct slots array
                  else if (matchingPackage.slots && Array.isArray(matchingPackage.slots)) {
                    console.log('📦 Found direct slots array in package');
                    packageSlots = matchingPackage.slots;
                  }
                  // Fallback: Check for timeSlots array
                  else if (matchingPackage.timeSlots && Array.isArray(matchingPackage.timeSlots)) {
                    console.log('📦 Found timeSlots array in package');
                    packageSlots = matchingPackage.timeSlots;
                  }
                }
              }
              
              // If no slots found in packages array, try service-level slots
              if (packageSlots.length === 0) {
                console.log('📦 No slots in package, checking service-level slots...');
                packageSlots = serviceData?.slots || serviceData?.timeSlots || serviceData?.availableSlots || [];
              }
              
              // If still no slots, check selectedPackage object directly
              if (packageSlots.length === 0 && selectedPackage.availability?.timeSlots) {
                console.log('📦 Checking selectedPackage.availability.timeSlots from route params');
                packageSlots = selectedPackage.availability.timeSlots.map((slot: any) => {
                  const formatTime = (time: string) => {
                    const [hours, minutes] = time.split(':');
                    const hour = parseInt(hours);
                    const ampm = hour >= 12 ? 'PM' : 'AM';
                    const hour12 = hour % 12 || 12;
                    return `${hour12}:${minutes} ${ampm}`;
                  };
                  return `${formatTime(slot.startTime)} - ${formatTime(slot.endTime)}`;
                });
              }
              
              console.log('📦 Final packageSlots:', packageSlots);
              
              if (packageSlots.length > 0) {
                console.log('✅ Found slots from Firestore:', packageSlots);
                setSlots(packageSlots);
                setTime(packageSlots[0]); // Set first slot as default
              } else {
                console.log('⚠️ No slots found anywhere for package, using default slots as fallback');
                setSlots(defaultSlots);
                setTime(defaultSlots[2]); // Set middle slot as default
              }
            } else {
              console.log('⚠️ Service document not found in Firestore, using default slots');
              setSlots(defaultSlots);
              setTime(defaultSlots[2]);
            }
          } else {
            console.log('⚠️ No service ID provided for package, using default slots');
            setSlots(defaultSlots);
            setTime(defaultSlots[2]);
          }
        } else {
          // For services: use predefined slots
          console.log('💰 SERVICE BOOKING (NOT PACKAGE) - Using predefined slots');
          setSlots(defaultSlots);
          setTime(defaultSlots[2]); // Set middle slot as default
        }
      } catch (error) {
        console.error('❌ Error fetching slots:', error);
        // Fallback to default slots on error
        setSlots(defaultSlots);
        setTime(defaultSlots[2]);
      } finally {
        setLoadingSlots(false);
      }
    };

    fetchSlots();
  }, [isPackageBooking, selectedPackage, selectedIssueIds]);

  const getNext7Days = () => {
    const days = [];
    const today = new Date();

    // Start from tomorrow (i = 1) instead of today (i = 0)
    for (let i = 1; i < 8; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);

      days.push({
        key: d.toISOString().split("T")[0],
        label: {
          day: d.toLocaleDateString("en-US", { weekday: "short" }), // Mon, Tue
          date: d.toLocaleDateString("en-US", { day: "numeric", month: "short" }), // 22 Jan
        },
        full: d.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
      });
    }

    return days;
  };

  const dates = getNext7Days();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Select Date & Time</Text>
      </View>

      {loadingSlots ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading available slots...</Text>
        </View>
      ) : (
        <>
          {/* Main Content: Date & Time Selection */}
        <ScrollView 
          style={styles.slotsContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Date Selection */}
          <Text style={styles.sectionTitle}>Select Date</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.dateScrollContainer}
            contentContainerStyle={styles.dateScrollContent}
          >
            {dates.map((d) => (
              <TouchableOpacity
                key={d.key}
                onPress={() => setSelectedDate(d.key)}
                style={[
                  styles.dateCard,
                  selectedDate === d.key && styles.dateCardActive,
                ]}
              >
                <Text
                  style={[
                    styles.dateDay,
                    selectedDate === d.key && styles.dateDayActive,
                  ]}
                >
                  {d.label.day}
                </Text>
                <Text
                  style={[
                    styles.dateText,
                    selectedDate === d.key && styles.dateTextActive,
                  ]}
                >
                  {d.label.date}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Available Slots Section - Vertical Scroller */}
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Available Slots</Text>

          {/* All Slots - Vertical Layout */}
          <View style={styles.slotsVerticalContainer}>
            {slots.map((slot) => {
              const isSelected = time === slot;
              return (
                <TouchableOpacity
                  key={slot}
                  style={[styles.slotCardVertical, isSelected && styles.slotCardVerticalSelected]}
                  onPress={() => setTime(slot)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.slotTextVertical,
                      isSelected && styles.slotTextVerticalSelected,
                    ]}
                  >
                    {slot}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

      {/* Bottom Continue Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.continueBtn}
          activeOpacity={0.7}
          onPress={() => {
            const selected = dates.find(d => d.key === selectedDate);
            
            console.log('🎯 Navigating to CompanySelection with slot data:', {
              serviceTitle,
              categoryId,
              selectedIssueIds,
              selectedIssues,
              issues,
              selectedDate,
              selectedTime: time,
              selectedDateFull: selected?.full
            });

            navigation.navigate("CompanySelection", {
              serviceTitle,
              categoryId,
              selectedIssueIds,
              selectedIssues,
              issues,
              selectedDate,
              selectedTime: time,
              selectedDateFull: selected?.full,
              fromServiceServices, // Pass the flag forward
              isPackageBooking, // Pass package flag
              selectedPackage, // Pass package info
            });
          }}
        >
          <Text style={styles.continueBtnText}>Continue</Text>
        </TouchableOpacity>
      </View>
      </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#f8fafc",
  },

  // Header
  header: {
    backgroundColor: "white",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    alignItems: "center",
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
  },

  // Right Side - Slots Container
  slotsContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 16,
    paddingTop: 20,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 12,
  },

  // Date Selection
  dateScrollContainer: {
    marginBottom: 8,
  },

  dateScrollContent: {
    paddingRight: 18,
  },

  dateCard: {
    backgroundColor: "white",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    minWidth: 80,
  },

  dateCardActive: {
    backgroundColor: "#0f8e35ff",
    borderColor: "#0f8e35ff",
  },

  dateDay: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 4,
  },

  dateDayActive: {
    color: "#ffffff",
  },

  dateText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },

  dateTextActive: {
    color: "#ffffff",
  },

  // Slots - Vertical Layout
  slotsVerticalContainer: {
    marginTop: 12,
    marginBottom: 20,
  },

  slotCardVertical: {
    backgroundColor: "white",
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
  },

  slotCardVerticalSelected: {
    backgroundColor: "#4CAF50",
    borderColor: "#4CAF50",
    elevation: 2,
    shadowColor: '#10b981',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },

  slotTextVertical: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
  },

  slotTextVerticalSelected: {
    color: "#ffffff",
    fontWeight: "700",
  },

  // Recommended Slot (Center, Green)
  recommendedSlot: {
    backgroundColor: "#4CAF50",
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginTop: 12,
    marginBottom: 16,
    alignItems: "center",
    elevation: 2,
    shadowColor: '#10b981',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },

  recommendedSlotSelected: {
    backgroundColor: "#4CAF50",
  },

  recommendedLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  recommendedTime: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
  },

  // Other Slots - Horizontal Scroller
  slotsScrollContainer: {
    marginBottom: 20,
  },

  slotsScrollContent: {
    paddingRight: 16,
  },

  slotCard: {
    backgroundColor: "white",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    minWidth: 150,
    alignItems: "center",
  },

  slotCardSelected: {
    backgroundColor: "#4CAF50",
    borderColor: "#4CAF50",
    borderWidth: 2,
  },

  slotText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },

  slotTextSelected: {
    color: "#3b82f6",
  },

  // Bottom Bar
  bottomBar: {
    backgroundColor: "white",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: -2 },
    shadowRadius: 8,
    elevation: 8,
  },

  continueBtn: {
    backgroundColor: "#4CAF50",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },

  continueBtnText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },

  // Loading Container
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 64,
  },

  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
  },
});
