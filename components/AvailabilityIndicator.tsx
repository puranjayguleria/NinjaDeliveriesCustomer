import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface AvailabilityIndicatorProps {
  availableProviders: number;
  totalProviders?: number;
  showDetails?: boolean;
  style?: any;
}

export const AvailabilityIndicator: React.FC<AvailabilityIndicatorProps> = ({
  availableProviders,
  totalProviders,
  showDetails = true,
  style
}) => {
  const isAvailable = availableProviders > 0;
  
  return (
    <View style={[styles.container, style]}>
      <View style={styles.availabilityStatus}>
        {isAvailable ? (
          <View style={styles.availableContainer}>
            <Text style={styles.availableIcon}>✅</Text>
            <Text style={styles.availableText}>
              {availableProviders} provider{availableProviders !== 1 ? 's' : ''} available
            </Text>
          </View>
        ) : (
          <View style={styles.unavailableContainer}>
            <Text style={styles.unavailableIcon}>❌</Text>
            <Text style={styles.unavailableText}>No providers available</Text>
          </View>
        )}
      </View>
      
      {showDetails && totalProviders && (
        <Text style={styles.detailsText}>
          {availableProviders} of {totalProviders} providers available
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  
  availabilityStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  availableContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  unavailableContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  availableIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  
  unavailableIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  
  availableText: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '500',
  },
  
  unavailableText: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '500',
  },
  
  detailsText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    marginLeft: 24,
  },
});

export default AvailabilityIndicator;