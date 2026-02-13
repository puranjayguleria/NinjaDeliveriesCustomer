import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  FlatList,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { FirestoreService, ServiceCompany } from '../services/firestoreService';

const { width } = Dimensions.get('window');

interface BookingRejectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectCompany: (company: ServiceCompany) => void;
  rejectedBooking: {
    id: string;
    serviceName: string;
    categoryId?: string;
    selectedIssueIds?: string[];
    issues?: string[];
    date: string;
    time: string;
    customerAddress?: string;
  } | null;
}

const BookingRejectionModal: React.FC<BookingRejectionModalProps> = ({
  visible,
  onClose,
  onSelectCompany,
  rejectedBooking,
}) => {
  const [companies, setCompanies] = useState<ServiceCompany[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  
  const scaleValue = React.useRef(new Animated.Value(0)).current;
  const fadeValue = React.useRef(new Animated.Value(0)).current;

  // Animation effects
  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleValue, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(fadeValue, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleValue, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeValue, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // Fetch available companies when modal opens
  useEffect(() => {
    if (visible && rejectedBooking) {
      fetchAvailableCompanies();
    }
  }, [visible, rejectedBooking]);

  const fetchAvailableCompanies = async () => {
    if (!rejectedBooking) return;

    try {
      setLoading(true);
      console.log('🏢 Fetching alternative companies for rejected booking:', rejectedBooking);
      
      let availableCompanies: ServiceCompany[] = [];
      
      // Try to get companies based on selected issues first
      if (rejectedBooking.selectedIssueIds && rejectedBooking.selectedIssueIds.length > 0) {
        console.log('🏢 Fetching companies by selected issue IDs:', rejectedBooking.selectedIssueIds);
        availableCompanies = await FirestoreService.getCompaniesWithDetailedPackages(rejectedBooking.selectedIssueIds);
        console.log('🏢 Found companies by issue IDs:', availableCompanies.length);
      } 
      // Fallback to category-based search
      else if (rejectedBooking.categoryId) {
        console.log('🏢 Fetching companies by category ID:', rejectedBooking.categoryId);
        availableCompanies = await FirestoreService.getCompaniesByCategory(rejectedBooking.categoryId);
        availableCompanies = await FirestoreService.getDetailedPackagesForCompanies(availableCompanies);
        console.log('🏢 Found companies by category:', availableCompanies.length);
      }
      // Final fallback - get all companies and filter by service name
      else {
        console.log('🏢 Fetching all companies and filtering by service name:', rejectedBooking.serviceName);
        const allCompanies = await FirestoreService.getServiceCompanies();
        console.log('🏢 Total companies in database:', allCompanies.length);
        
        // Filter companies that provide the same service type
        availableCompanies = allCompanies.filter(company => {
          const serviceName = rejectedBooking.serviceName.toLowerCase();
          const companyService = (company.serviceName || company.serviceType || '').toLowerCase();
          
          console.log(`🔍 Checking company: ${company.companyName || company.serviceName} - Service: ${companyService}`);
          
          // Check if company provides the same service
          const matches = companyService.includes(serviceName) || 
                 serviceName.includes(companyService) ||
                 // Check for common service types
                 (serviceName.includes('electric') && companyService.includes('electric')) ||
                 (serviceName.includes('plumb') && companyService.includes('plumb')) ||
                 (serviceName.includes('clean') && companyService.includes('clean')) ||
                 (serviceName.includes('repair') && companyService.includes('repair'));
          
          if (matches) {
            console.log(`✅ Company ${company.companyName || company.serviceName} matches service ${serviceName}`);
          }
          
          return matches;
        });
        
        console.log('🏢 Companies after service filtering:', availableCompanies.length);
        availableCompanies = await FirestoreService.getDetailedPackagesForCompanies(availableCompanies);
      }

      console.log('🏢 Companies before availability filtering:', availableCompanies.length);

      // For debugging: Let's first show companies without availability filtering
      if (availableCompanies.length > 0) {
        console.log('🏢 Companies found (before availability check):');
        availableCompanies.forEach((company, index) => {
          console.log(`  ${index + 1}. ${company.companyName || company.serviceName} - Service: ${company.serviceName || company.serviceType}`);
        });
      }

      // Filter companies that have active workers and are available for the selected time
      const companiesWithActiveWorkers = await filterCompaniesWithAvailability(
        availableCompanies, 
        rejectedBooking.date, 
        rejectedBooking.time
      );
      
      console.log(`🏢 Found ${companiesWithActiveWorkers.length} alternative companies with active workers`);
      
      // For testing: If no companies with active workers, show all matching companies anyway
      if (companiesWithActiveWorkers.length === 0 && availableCompanies.length > 0) {
        console.log('⚠️ No companies with active workers found, showing all matching companies for testing');
        setCompanies(availableCompanies.map(company => ({
          ...company,
          availability: 'Availability not verified'
        })));
      } else {
        setCompanies(companiesWithActiveWorkers);
      }
    } catch (error) {
      console.error('❌ Error fetching alternative companies:', error);
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  // Check if a company has active workers
  const checkCompanyHasActiveWorkers = async (companyId: string): Promise<boolean> => {
    try {
      const { firestore } = require('../firebase.native');
      
      const workersQuery = await firestore()
        .collection('service_workers')
        .where('companyId', '==', companyId)
        .where('isActive', '==', true)
        .get();
      
      return workersQuery.docs.length > 0;
    } catch (error) {
      console.error(`❌ Error checking active workers for company ${companyId}:`, error);
      return false;
    }
  };

  // Check real-time availability for a specific date and time
  const checkRealTimeAvailability = async (companyId: string, date: string, time: string): Promise<boolean> => {
    try {
      const available = await FirestoreService.checkCompanyWorkerAvailability(companyId, date, time);
      return available;
    } catch (error) {
      console.error(`❌ Error checking availability for company ${companyId}:`, error);
      return false;
    }
  };

  // Filter companies with availability
  const filterCompaniesWithAvailability = async (
    companies: ServiceCompany[], 
    date: string, 
    time: string
  ): Promise<ServiceCompany[]> => {
    console.log(`🔍 Filtering ${companies.length} companies for availability on ${date} at ${time}`);
    const availableCompanies: ServiceCompany[] = [];
    
    for (const company of companies) {
      const companyId = company.companyId || company.id;
      console.log(`🔍 Checking company: ${company.companyName || company.serviceName} (ID: ${companyId})`);
      
      // Check if company has active workers
      const hasActiveWorkers = await checkCompanyHasActiveWorkers(companyId);
      if (!hasActiveWorkers) {
        console.log(`❌ Company ${company.companyName || company.serviceName} has no active workers`);
        continue;
      }
      
      console.log(`✅ Company ${company.companyName || company.serviceName} has active workers`);
      
      // Check availability for the specific time slot
      const isAvailableAtTime = await checkRealTimeAvailability(companyId, date, time);
      if (!isAvailableAtTime) {
        console.log(`❌ Company ${company.companyName || company.serviceName} is not available at ${date} ${time}`);
        continue;
      }
      
      console.log(`✅ Company ${company.companyName || company.serviceName} is available at ${date} ${time}`);
      
      // Company passed all checks
      availableCompanies.push({
        ...company,
        availability: `Available on ${date} at ${time}`
      });
    }
    
    console.log(`🏢 Final result: ${availableCompanies.length} companies available`);
    return availableCompanies;
  };

  const handleSelectCompany = () => {
    const selectedCompany = companies.find(c => c.id === selectedCompanyId);
    if (selectedCompany) {
      onSelectCompany(selectedCompany);
      onClose();
    }
  };

  const renderCompanyItem = ({ item }: { item: ServiceCompany }) => {
    const isSelected = item.id === selectedCompanyId;
    
    return (
      <TouchableOpacity
        style={[styles.companyCard, isSelected && styles.companyCardSelected]}
        activeOpacity={0.7}
        onPress={() => setSelectedCompanyId(item.id)}
      >
        <View style={styles.companyHeader}>
          <View style={styles.companyLeft}>
            {/* Company Logo */}
            {item.imageUrl ? (
              <Image 
                source={{ uri: item.imageUrl }} 
                style={styles.companyLogo}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.companyLogoPlaceholder}>
                <Text style={styles.companyLogoText}>
                  {(item.companyName || item.serviceName).charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.companyInfo}>
              <Text style={styles.companyName}>{item.companyName || item.serviceName}</Text>
              {item.isActive && (
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedText}>✓ Verified</Text>
                </View>
              )}
            </View>
          </View>
          
          <View style={styles.companyRight}>
            {isSelected ? (
              <View style={styles.selectedBadge}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
              </View>
            ) : (
              <View style={styles.selectCircle} />
            )}
          </View>
        </View>

        {/* Service Details */}
        {rejectedBooking?.issues && rejectedBooking.issues.length > 0 ? (
          <View style={styles.serviceDetails}>
            <Text style={styles.serviceLabel}>Services:</Text>
            <Text style={styles.serviceText}>{rejectedBooking.issues.join(', ')}</Text>
          </View>
        ) : (
          <View style={styles.serviceDetails}>
            <Text style={styles.serviceLabel}>Service:</Text>
            <Text style={styles.serviceText}>{rejectedBooking?.serviceName || 'Service'}</Text>
          </View>
        )}

        {/* Price */}
        {item.price && (
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Starting Price:</Text>
            <Text style={styles.price}>₹{item.price}</Text>
          </View>
        )}

        {/* Availability */}
        {item.availability && (
          <View style={styles.availabilityRow}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            <Text style={styles.availabilityText}>{item.availability}</Text>
          </View>
        )}

        {/* Rating if available */}
        {item.rating && (
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={16} color="#FFD700" />
            <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
            {item.reviewCount && (
              <Text style={styles.reviewCount}>({item.reviewCount} reviews)</Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.overlay, { opacity: fadeValue }]}>
        <Animated.View 
          style={[
            styles.modalWrapper,
            {
              transform: [{ scale: scaleValue }],
            },
          ]}
        >
          <LinearGradient
            colors={['#FFFFFF', '#F0F9FF', '#EBF8FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.modalContainer}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <Ionicons name="business" size={32} color="#3B82F6" />
              </View>
              <Text style={styles.title}>Booking Rejected</Text>
              <Text style={styles.subtitle}>
                Your booking was rejected by the admin. We're automatically finding alternative service providers for you.
              </Text>
            </View>

            {/* Booking Info */}
            {rejectedBooking && (
              <View style={styles.bookingInfo}>
                <Text style={styles.bookingInfoTitle}>Booking Details</Text>
                <View style={styles.bookingInfoRow}>
                  <Ionicons name="construct" size={16} color="#6B7280" />
                  <Text style={styles.bookingInfoText}>{rejectedBooking.serviceName}</Text>
                </View>
                <View style={styles.bookingInfoRow}>
                  <Ionicons name="calendar" size={16} color="#6B7280" />
                  <Text style={styles.bookingInfoText}>{rejectedBooking.date} at {rejectedBooking.time}</Text>
                </View>
                {rejectedBooking.customerAddress && (
                  <View style={styles.bookingInfoRow}>
                    <Ionicons name="location" size={16} color="#6B7280" />
                    <Text style={styles.bookingInfoText} numberOfLines={1}>
                      {rejectedBooking.customerAddress}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Companies List */}
            <View style={styles.companiesSection}>
              <Text style={styles.companiesTitle}>
                Available Service Providers ({companies.length})
              </Text>
              
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#3B82F6" />
                  <Text style={styles.loadingText}>Finding available companies...</Text>
                </View>
              ) : companies.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="business-outline" size={48} color="#CBD5E1" />
                  <Text style={styles.emptyTitle}>No Companies Available</Text>
                  <Text style={styles.emptyText}>
                    No service providers are currently available for your selected time slot ({rejectedBooking?.date} at {rejectedBooking?.time}). 
                    {'\n\n'}This could be because:
                    {'\n'}• All providers are busy at this time
                    {'\n'}• No active workers available
                    {'\n'}• Service not available in your area
                    {'\n\n'}Please try selecting a different time or contact support for assistance.
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={companies}
                  keyExtractor={(item) => item.id}
                  renderItem={renderCompanyItem}
                  style={styles.companiesList}
                  showsVerticalScrollIndicator={false}
                  maxHeight={300}
                />
              )}
            </View>

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={onClose}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.button, 
                  styles.selectButton,
                  (!selectedCompanyId || companies.length === 0) && styles.selectButtonDisabled
                ]}
                onPress={handleSelectCompany}
                disabled={!selectedCompanyId || companies.length === 0}
              >
                <Text style={[
                  styles.selectButtonText,
                  (!selectedCompanyId || companies.length === 0) && styles.selectButtonTextDisabled
                ]}>
                  Select Company
                </Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalWrapper: {
    width: width * 0.95,
    maxWidth: 450,
    maxHeight: '90%',
  },
  modalContainer: {
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EBF8FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  bookingInfo: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  bookingInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  bookingInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  bookingInfoText: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  companiesSection: {
    marginBottom: 20,
  },
  companiesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  companiesList: {
    maxHeight: 300,
  },
  companyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  companyCardSelected: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  companyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  companyLeft: {
    flex: 1,
    marginRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  companyLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },

  companyLogoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  companyLogoText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 4,
  },
  verifiedBadge: {
    backgroundColor: '#DCFDF7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#065F46',
  },
  companyRight: {
    alignItems: 'center',
  },
  selectCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
  },
  selectedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceDetails: {
    marginBottom: 8,
  },
  serviceLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 4,
  },
  serviceText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  priceLabel: {
    fontSize: 12,
    color: '#0369A1',
    fontWeight: '500',
    marginRight: 8,
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0C4A6E',
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  availabilityText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '500',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  reviewCount: {
    fontSize: 11,
    color: '#6B7280',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  selectButton: {
    backgroundColor: '#10B981',
  },
  selectButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  selectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  selectButtonTextDisabled: {
    color: '#9CA3AF',
  },
});

export default BookingRejectionModal;