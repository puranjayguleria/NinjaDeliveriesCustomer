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
  Image,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useServiceCart } from "../context/ServiceCartContext";
import { Ionicons } from '@expo/vector-icons';

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

export default function SelectDateTimeScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { addService } = useServiceCart();

  const { serviceTitle, categoryId, issues, selectedIssueIds, selectedIssues, allCategories, fromServiceServices } = route.params;

  // Calculate price from selected issue objects (they include optional `price`)
  const issueTotalPrice = Array.isArray(selectedIssues)
    ? selectedIssues.reduce((s: number, it: any) => s + (typeof it.price === 'number' ? it.price : 0), 0)
    : 0;

  const slots = [
    "9:00 AM - 11:00 AM",
    "11:00 AM - 1:00 PM", 
    "1:00 PM - 3:00 PM",
    "3:00 PM - 5:00 PM",
    "5:00 PM - 7:00 PM",
    "7:00 PM - 9:00 PM",
  ];

  const [time, setTime] = useState(slots[2]);
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Select Date & Time</Text>
      </View>

      {/* Main Content: Sidebar + Slots */}
      <View style={styles.mainContent}>
        {/* Left Sidebar - Selected Service Only */}
        <View style={styles.sidebar}>
          <View style={styles.sidebarContent}>
            <TouchableOpacity 
              style={styles.serviceLabelCard}
              activeOpacity={0.7}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.serviceLabelText}>SERVICE</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Right Side - Date & Time Selection */}
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
      </View>

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
            });
          }}
        >
          <Text style={styles.continueBtnText}>Continue</Text>
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

  // Main Content Layout
  mainContent: {
    flex: 1,
    flexDirection: "row",
  },

  // Left Sidebar - Service Display Only
  sidebar: {
    width: 100,
    backgroundColor: "#ffffff",
    borderRightWidth: 1,
    borderRightColor: "#e2e8f0",
    paddingVertical: 20,
    alignItems: "center",
    justifyContent: "flex-start",
    marginRight: 8,
  },

  sidebarContent: {
    alignItems: "center",
    paddingHorizontal: 8,
  },

  // Service Label Card
  serviceLabelCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: '#3b82f6',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
    minHeight: 80,
  },

  serviceLabelText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#0a0000ff",
    textAlign: "center",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },

  serviceNameText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
    textAlign: "center",
    lineHeight: 16,
  },

  serviceDisplayContainer: {
    alignItems: "center",
  },

  serviceLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  serviceTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
    lineHeight: 18,
  },

  categoryItem: {
    alignItems: "center",
  },

  categoryItemSelected: {
    backgroundColor: "#f0f9ff",
  },

  categoryIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },

  categoryIconContainerSelected: {
    backgroundColor: "#3b82f6",
  },

  categoryIconText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#ffffff",
  },

  categoryIconTextSelected: {
    color: "#ffffff",
  },

  categoryName: {
    fontSize: 11,
    fontWeight: "600",
    color: "#0f172a",
    textAlign: "center",
    lineHeight: 14,
    paddingHorizontal: 8,
  },

  categoryNameSelected: {
    color: "#3b82f6",
    fontWeight: "700",
  },

  // Service Name in Sidebar
  serviceNameContainer: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingHorizontal: 8,
    alignItems: "center",
  },

  serviceNameLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  serviceNameText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0f172a",
    textAlign: "center",
    lineHeight: 16,
  },

  serviceIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },

  serviceIconText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#64748b",
  },

  serviceName: {
    fontSize: 11,
    fontWeight: "600",
    color: "#0f172a",
    textAlign: "center",
    lineHeight: 14,
    paddingHorizontal: 8,
  },

  // Right Side - Slots Container
  slotsContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingLeft: 8,
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
    paddingRight: 16,
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
});
