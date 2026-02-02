import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AvailabilityIndicator } from './AvailabilityIndicator';

interface ServiceCardProps {
  service: {
    id: string;
    name: string;
    description?: string;
    availableProviders?: number;
    totalProviders?: number;
  };
  onPress: (service: any) => void;
  style?: any;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({
  service,
  onPress,
  style
}) => {
  const hasAvailableProviders = (service.availableProviders || 0) > 0;
  
  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={() => onPress(service)}
      disabled={!hasAvailableProviders}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <Text style={styles.serviceName}>{service.name}</Text>
      </View>
      
      {service.description && (
        <Text style={styles.description}>{service.description}</Text>
      )}
      
      {/* Availability Indicator */}
      <AvailabilityIndicator
        availableProviders={service.availableProviders || 0}
        totalProviders={service.totalProviders}
        showDetails={false}
        style={styles.availability}
      />
      
      <TouchableOpacity
        style={[
          styles.bookButton,
          !hasAvailableProviders && styles.bookButtonDisabled
        ]}
        onPress={() => onPress(service)}
        disabled={!hasAvailableProviders}
      >
        <Text
          style={[
            styles.bookButtonText,
            !hasAvailableProviders && styles.bookButtonTextDisabled
          ]}
        >
          {hasAvailableProviders ? 'Book Now' : 'Not Available'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  
  header: {
    marginBottom: 8,
  },
  
  serviceName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    letterSpacing: -0.2,
  },
  
  description: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    marginBottom: 12,
  },
  
  availability: {
    marginBottom: 16,
  },
  
  bookButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  
  bookButtonDisabled: {
    backgroundColor: '#e2e8f0',
  },
  
  bookButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  
  bookButtonTextDisabled: {
    color: '#94a3b8',
  },
});

export default ServiceCard;