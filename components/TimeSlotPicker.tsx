import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { AvailabilityUtils } from '../utils/availabilityUtils';

interface TimeSlotPickerProps {
  selectedService?: any;
  selectedDate: string;
  onTimeSelect: (time: string) => void;
  availableCompanies?: any[];
  style?: any;
}

const TIME_SLOTS = [
  "9:00 AM - 11:00 AM",
  "11:00 AM - 1:00 PM", 
  "1:00 PM - 3:00 PM",
  "3:00 PM - 5:00 PM",
  "5:00 PM - 7:00 PM",
  "7:00 PM - 9:00 PM",
];

export const TimeSlotPicker: React.FC<TimeSlotPickerProps> = ({
  selectedService,
  selectedDate,
  onTimeSelect,
  availableCompanies = [],
  style
}) => {
  const [loading, setLoading] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [slotAvailability, setSlotAvailability] = useState<Record<string, boolean>>({});

  const handleTimeSelect = async (time: string) => {
    if (!selectedService?.id) {
      onTimeSelect(time);
      return;
    }

    setLoading(true);
    setSelectedTime(time);

    try {
      // Real-time availability check
      const availability = await AvailabilityUtils.checkRealTimeAvailability(
        selectedService.id,
        selectedDate,
        time
      );

      if (availability.available && availability.data) {
        onTimeSelect(time);
        AvailabilityUtils.displayAvailableProviders(availability.data.companies);
        
        // Update slot availability cache
        setSlotAvailability(prev => ({
          ...prev,
          [time]: true
        }));
      } else {
        // Show unavailable message with suggestions
        const suggestions = availability.data?.suggestions || [
          'Try selecting a different time slot',
          'Check availability for tomorrow',
          'Consider booking for later in the day'
        ];
        
        Alert.alert(
          "Time Slot Unavailable",
          `All providers are busy at ${time} on ${selectedDate}.\n\nSuggestions:\n${suggestions.map(s => `• ${s}`).join('\n')}`,
          [{ text: "OK" }]
        );
        
        // Update slot availability cache
        setSlotAvailability(prev => ({
          ...prev,
          [time]: false
        }));
      }
    } catch (error) {
      console.error('❌ Error checking time slot availability:', error);
      Alert.alert(
        "Error",
        "Failed to check availability. Please try again.",
        [{ text: "OK" }]
      );
    } finally {
      setLoading(false);
      setSelectedTime(null);
    }
  };

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.title}>Available Time Slots</Text>
      
      <View style={styles.slotsContainer}>
        {TIME_SLOTS.map((slot) => {
          const isSelected = selectedTime === slot;
          const isLoading = loading && isSelected;
          const isAvailable = slotAvailability[slot];
          const isUnavailable = slotAvailability[slot] === false;
          
          return (
            <TouchableOpacity
              key={slot}
              style={[
                styles.slotButton,
                isSelected && styles.slotButtonSelected,
                isUnavailable && styles.slotButtonUnavailable
              ]}
              onPress={() => handleTimeSelect(slot)}
              disabled={isLoading || isUnavailable}
              activeOpacity={0.7}
            >
              <View style={styles.slotContent}>
                <Text
                  style={[
                    styles.slotText,
                    isSelected && styles.slotTextSelected,
                    isUnavailable && styles.slotTextUnavailable
                  ]}
                >
                  {slot}
                </Text>
                
                <View style={styles.slotStatus}>
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#2563eb" />
                  ) : isAvailable ? (
                    <Text style={styles.availableText}>Available</Text>
                  ) : isUnavailable ? (
                    <Text style={styles.unavailableText}>All Busy</Text>
                  ) : (
                    <Text style={styles.defaultText}>Check Availability</Text>
                  )}
                </View>
              </View>

              {isSelected && !isLoading && (
                <View style={styles.selectedBadge}>
                  <Text style={styles.selectedText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
      
      {loading && (
        <View style={styles.loadingOverlay}>
          <Text style={styles.loadingText}>Checking availability...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
  },
  
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 16,
  },
  
  slotsContainer: {
    gap: 12,
  },
  
  slotButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  
  slotButtonSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#f8faff',
    elevation: 2,
    shadowOpacity: 0.1,
  },
  
  slotButtonUnavailable: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    opacity: 0.6,
  },
  
  slotContent: {
    flex: 1,
  },
  
  slotText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#0f172a',
    marginBottom: 4,
  },
  
  slotTextSelected: {
    color: '#2563eb',
  },
  
  slotTextUnavailable: {
    color: '#94a3b8',
  },
  
  slotStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  availableText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '500',
  },
  
  unavailableText: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '500',
  },
  
  defaultText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '400',
  },
  
  selectedBadge: {
    backgroundColor: '#2563eb',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  selectedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  loadingText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 8,
  },
});

export default TimeSlotPicker;