import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ScrollView,
  Alert,
  Dimensions,
  Platform,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useServiceCart } from "../context/ServiceCartContext";

const { height: screenHeight } = Dimensions.get('window');

export default function SelectDateTimeScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { addService } = useServiceCart();

  const { serviceTitle, issues, selectedIssues, company } = route.params;

  // Calculate price from selected issue objects (they include optional `price`)
  const issueTotalPrice = Array.isArray(selectedIssues)
    ? selectedIssues.reduce((s: number, it: any) => s + (typeof it.price === 'number' ? it.price : 0), 0)
    : 0;

  const [time, setTime] = useState("1:00 PM - 3:00 PM");
  const [selectedDate, setSelectedDate] = useState(() => {
    // Default to tomorrow instead of today
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  });

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


  const slots = [
    "9:00 AM - 11:00 AM",
    "11:00 AM - 1:00 PM", 
    "1:00 PM - 3:00 PM",
    "3:00 PM - 5:00 PM",
    "5:00 PM - 7:00 PM",
    "7:00 PM - 9:00 PM",
  ];

  return (
    <View style={styles.container}>
      {/* Header Section */}
      <View style={styles.headerSection}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        
        <Text style={styles.header}>Select Time Slot</Text>
        <Text style={styles.subHeader}>Choose your preferred time</Text>
      </View>

      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Service Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>{serviceTitle} Service</Text>

          {company?.name && (
            <Text style={styles.companyText}>
              {company.name} • ₹{company.price}
            </Text>
          )}

          {Array.isArray(issues) && issues.length > 0 && (
            <View style={styles.issuesSection}>
              <Text style={styles.issuesTitle}>Selected Issues:</Text>
              <ScrollView 
                style={styles.issuesScroll} 
                showsVerticalScrollIndicator={false}
              >
                {issues.map((issue: string, index: number) => (
                  <View key={index} style={styles.issueTag}>
                    <Text style={styles.issueText}>{issue}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Slots Section */}
        <View style={styles.slotsSection}>
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

          {/* Time Slots */}
          <Text style={[styles.sectionTitle, styles.timeSlotsTitle]}>Available Time Slots</Text>

          <FlatList
            data={slots}
            keyExtractor={(item) => item}
            renderItem={({ item }) => {
              const isSelected = time === item;
              return (
                <TouchableOpacity
                  style={[styles.slotCard, isSelected && styles.slotCardSelected]}
                  onPress={() => setTime(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.slotContent}>
                    <Text
                      style={[
                        styles.slotText,
                        isSelected && styles.slotTextSelected,
                      ]}
                    >
                      {item}
                    </Text>
                    <Text
                      style={[
                        styles.slotSubText,
                        isSelected && styles.slotSubTextSelected,
                      ]}
                    >
                      Available
                    </Text>
                  </View>

                  {isSelected && (
                    <View style={styles.selectedBadge}>
                      <Text style={styles.selectedText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
            scrollEnabled={false}
            contentContainerStyle={styles.listContent}
          />
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.selectedInfo}>
          <Text style={styles.selectedSlotTime}>{time}</Text>
        </View>
        
        <TouchableOpacity
          style={styles.confirmBtn}
          activeOpacity={0.7}
          onPress={() => {
            const selected = dates.find(d => d.key === selectedDate);
            
            // Determine booking type based on service title
            let bookingType: 'electrician' | 'plumber' | 'cleaning' | 'health' | 'dailywages' | 'carwash' = 'electrician';
            const lowerTitle = serviceTitle?.toLowerCase() || '';
            
            if (lowerTitle.includes('plumber')) bookingType = 'plumber';
            else if (lowerTitle.includes('cleaning')) bookingType = 'cleaning';
            else if (lowerTitle.includes('health')) bookingType = 'health';
            else if (lowerTitle.includes('daily') || lowerTitle.includes('wages')) bookingType = 'dailywages';
            else if (lowerTitle.includes('car') || lowerTitle.includes('wash')) bookingType = 'carwash';

            // Add service to cart
            const computedPrice = issueTotalPrice > 0 ? issueTotalPrice : (company?.price || 99);

            addService({
              serviceTitle,
              issues: Array.isArray(issues) ? issues : [issues].filter(Boolean),
              company,
              selectedDate: selected?.full || selectedDate,
              selectedTime: time,
              bookingType,
              totalPrice: computedPrice,
            });

            Alert.alert(
              "Added to Cart",
              `${serviceTitle} service has been added to your cart.`,
              [
                {
                  text: "Continue Services",
                  onPress: () => navigation.navigate("ServicesHome"),
                },
                {
                  text: "View Cart",
                  onPress: () => navigation.navigate("ServiceCart"),
                },
              ]
            );
          }}
        >
          <Text style={styles.confirmText}>Add to Cart</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#f8fafc",
  },

  // Scroll container styles
  scrollContainer: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: 100, // Space for bottom bar
  },

  // Date card styles
  dateCard: {
    width: 64,
    height: 64,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginRight: 10,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },

  dateCardActive: {
    borderColor: "#2563eb",
    backgroundColor: "#f8faff",
  },

  dateDay: {
    fontSize: 10,
    fontWeight: "600",
    color: "#0f172a",
  },

  dateDayActive: {
    color: "#2563eb",
  },

  dateText: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 1,
  },

  dateTextActive: {
    color: "#2563eb",
  },

  dateScrollContainer: {
    marginBottom: 32,
  },

  dateScrollContent: {
    paddingHorizontal: 4,
  },

  // Header Section
  headerSection: {
    backgroundColor: "white",
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },

  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },

  backButtonText: {
    color: "#2563eb",
    fontSize: 16,
    fontWeight: "500",
  },

  header: { 
    fontSize: 28, 
    fontWeight: "600",
    color: "#0f172a",
    letterSpacing: -0.6,
    marginBottom: 8,
  },

  subHeader: { 
    color: "#64748b", 
    fontSize: 16, 
    fontWeight: "400",
    lineHeight: 24,
  },

  // Service Info Card
  infoCard: {
    backgroundColor: "white",
    marginHorizontal: 24,
    marginTop: 20,
    marginBottom: 32,
    borderRadius: 16,
    padding: 24,
    elevation: 0,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  
  infoTitle: { 
    fontSize: 18, 
    fontWeight: "500", 
    color: "#0f172a",
    letterSpacing: -0.3,
    marginBottom: 12,
  },

  companyText: {
    fontSize: 14,
    color: "#2563eb",
    fontWeight: "500",
    marginBottom: 16,
  },

  issuesSection: {
    marginTop: 8,
  },

  issuesTitle: { 
    fontSize: 14, 
    color: "#64748b", 
    fontWeight: "500",
    marginBottom: 12,
  },

  issuesScroll: {
    maxHeight: 120,
  },

  issueTag: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 8,
    alignSelf: "flex-start",
  },

  issueText: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "500",
  },

  // Slots Section
  slotsSection: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "500",
    color: "#0f172a",
    letterSpacing: -0.3,
    marginBottom: 20,
  },

  timeSlotsTitle: {
    marginTop: 8,
  },

  listContent: {
    paddingBottom: 20,
  },

  slotCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 0,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: "white",
  },
  
  slotCardSelected: { 
    backgroundColor: "white", 
    borderWidth: 2, 
    borderColor: "#2563eb",
    elevation: 1,
    shadowOpacity: 0.08,
  },

  slotContent: {
    flex: 1,
  },

  slotText: { 
    fontSize: 16, 
    fontWeight: "500", 
    color: "#0f172a",
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  
  slotTextSelected: { 
    color: "#2563eb" 
  },

  slotSubText: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "400",
  },

  slotSubTextSelected: {
    color: "#2563eb",
  },

  selectedBadge: {
    backgroundColor: "#2563eb",
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  selectedText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },

  // Bottom Action Bar
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#cce1e7ff",
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  selectedInfo: {
    flex: 1,
    marginRight: 16,
  },

  selectedSlotTitle: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
    marginBottom: 2,
  },

  selectedSlotTime: {
    fontSize: 14,
    fontWeight: "500",
    color: "#0f172a",
    letterSpacing: -0.2,
  },

  confirmBtn: {
    backgroundColor: "#2563eb",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    elevation: 0,
    shadowColor: '#2563eb',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  
  confirmText: {
    color: "white",
    fontWeight: "500",
    fontSize: 14,
    letterSpacing: -0.2,
  },
});
