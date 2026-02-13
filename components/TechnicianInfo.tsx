import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ServiceBooking } from '../services/firestoreService';

interface TechnicianInfoProps {
  booking: ServiceBooking;
  onCallTechnician?: () => void;
  showCallButton?: boolean;
  compact?: boolean;
}

export default function TechnicianInfo({ 
  booking, 
  onCallTechnician, 
  showCallButton = true,
  compact = false 
}: TechnicianInfoProps) {
  
  const getTechnicianStatus = () => {
    if (booking.technicianName || booking.workerName) {
      const workerName = booking.technicianName || booking.workerName;
      switch (booking.status) {
        case 'assigned':
          return {
            title: 'Worker Assigned',
            message: `${workerName} has been assigned to your service`,
            submessage: 'Worker will contact you before service',
            color: '#10B981',
            icon: 'person-circle' as const,
            showCall: true
          };
        case 'started':
          return {
            title: 'Service In Progress',
            message: `${workerName} is working on your service`,
            submessage: 'Service currently in progress',
            color: '#8B5CF6',
            icon: 'construct' as const,
            showCall: true
          };
        case 'completed':
          return {
            title: 'Service Completed',
            message: `Service completed by ${workerName}`,
            submessage: 'Thank you for choosing our service',
            color: '#10B981',
            icon: 'checkmark-done-circle' as const,
            showCall: false
          };
        default:
          return {
            title: 'Worker Assigned',
            message: `Worker: ${workerName}`,
            submessage: '',
            color: '#3B82F6',
            icon: 'person' as const,
            showCall: true
          };
      }
    } else if (booking.companyId) {
      switch (booking.status) {
        case 'assigned':
          return {
            title: 'Service Provider Assigned',
            message: `Service provider has been assigned to your booking`,
            submessage: 'Company will contact you before service',
            color: '#10B981',
            icon: 'business' as const,
            showCall: true
          };
        case 'started':
          return {
            title: 'Service In Progress',
            message: `Service provider is working on your service`,
            submessage: 'Service currently in progress',
            color: '#8B5CF6',
            icon: 'construct' as const,
            showCall: true
          };
        case 'completed':
          return {
            title: 'Service Completed',
            message: `Service completed successfully`,
            submessage: 'Thank you for choosing our service',
            color: '#10B981',
            icon: 'checkmark-done-circle' as const,
            showCall: false
          };
        default:
          return {
            title: 'Service Provider Assigned',
            message: `Service provider assigned`,
            submessage: '',
            color: '#3B82F6',
            icon: 'business' as const,
            showCall: true
          };
      }
    } else {
      return {
        title: 'Finding Service Provider',
        message: 'We\'re finding the best service provider for your service',
        submessage: 'You\'ll be notified once assigned',
        color: '#F59E0B',
        icon: 'search' as const,
        showCall: false
      };
    }
  };

  const status = getTechnicianStatus();

  if (compact) {
    return (
      <View style={[styles.compactContainer, { borderLeftColor: status.color }]}>
        <View style={[styles.iconContainer, { backgroundColor: status.color + '20' }]}>
          <Ionicons name={status.icon} size={16} color={status.color} />
        </View>
        <View style={styles.compactContent}>
          <Text style={[styles.compactTitle, { color: status.color }]}>
            {status.title}
          </Text>
          <Text style={styles.compactMessage}>{status.message}</Text>
        </View>
        {status.showCall && showCallButton && onCallTechnician && (
          <TouchableOpacity style={[styles.callButton, { backgroundColor: status.color }]} onPress={onCallTechnician}>
            <Ionicons name="call" size={14} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { borderLeftColor: status.color }]}>
      <View style={styles.header}>
        <View style={[styles.iconContainerLarge, { backgroundColor: status.color }]}>
          <Ionicons name={status.icon} size={24} color="#fff" />
        </View>
        <View style={styles.content}>
          <Text style={styles.title}>{status.title}</Text>
          <Text style={styles.message}>{status.message}</Text>
          {status.submessage && (
            <Text style={styles.submessage}>{status.submessage}</Text>
          )}
        </View>
        {status.showCall && showCallButton && onCallTechnician && (
          <TouchableOpacity 
            style={[styles.callButtonLarge, { backgroundColor: status.color }]} 
            onPress={onCallTechnician}
          >
            <Ionicons name="call" size={16} color="#fff" />
            <Text style={styles.callText}>Call</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    marginVertical: 8,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    marginVertical: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconContainerLarge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  content: {
    flex: 1,
  },
  compactContent: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  compactTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  message: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  compactMessage: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  submessage: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    fontStyle: 'italic',
  },
  callButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  callButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  callText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});