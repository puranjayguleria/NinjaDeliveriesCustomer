import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FirestoreService, ServiceIssue } from "../services/firestoreService";

interface AddOnService extends ServiceIssue {
  selected: boolean;
  price: number;
}

interface AddOnServicesModalProps {
  visible: boolean;
  onClose: () => void;
  onAddServices: (selectedServices: AddOnService[]) => void;
  categoryId: string;
  existingServices: string[]; // Services already booked
}

export default function AddOnServicesModal({
  visible,
  onClose,
  onAddServices,
  categoryId,
  existingServices,
}: AddOnServicesModalProps) {
  const [services, setServices] = useState<AddOnService[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedServices, setSelectedServices] = useState<AddOnService[]>([]);

  useEffect(() => {
    if (visible && categoryId) {
      fetchAddOnServices();
    }
  }, [visible, categoryId]);

  const fetchAddOnServices = async () => {
    try {
      setLoading(true);
      console.log(`🔧 Fetching add-on services for category: ${categoryId}`);
      
      // Fetch all services for the category with complete details
      const allServices = await FirestoreService.getServicesWithCompanies(categoryId);
      
      // Filter out services that are already booked
      const availableServices = allServices.filter(service => 
        !existingServices.some(existing => 
          existing.toLowerCase().includes(service.name.toLowerCase()) ||
          service.name.toLowerCase().includes(existing.toLowerCase())
        )
      );

      // Get companies for these services to get proper pricing
      const serviceIds = availableServices.map(service => service.id);
      let companiesData: any[] = [];
      
      if (serviceIds.length > 0) {
        try {
          companiesData = await FirestoreService.getCompaniesByServiceIssues(serviceIds);
          console.log(`📊 Found ${companiesData.length} companies for add-on services`);
        } catch (error) {
          console.warn("Could not fetch companies for pricing, using default prices");
        }
      }

      // Convert to AddOnService format with proper pricing from companies
      const addOnServices: AddOnService[] = availableServices.map(service => {
        // Find the best price from companies offering this service
        const serviceCompanies = companiesData.filter(company => 
          company.serviceName && 
          company.serviceName.toLowerCase().includes(service.name.toLowerCase())
        );
        
        // Get the lowest price from available companies, or use service price, or default
        let bestPrice = service.price || 500; // Default fallback
        
        if (serviceCompanies.length > 0) {
          const prices = serviceCompanies
            .map(company => company.price)
            .filter(price => price && price > 0);
          
          if (prices.length > 0) {
            bestPrice = Math.min(...prices);
          }
        }

        console.log(`💰 Service "${service.name}" - Price: ₹${bestPrice} (from ${serviceCompanies.length} companies)`);

        return {
          ...service,
          selected: false,
          price: bestPrice,
        };
      });

      setServices(addOnServices);
      console.log(`✅ Found ${addOnServices.length} available add-on services with pricing`);
    } catch (error) {
      console.error("Error fetching add-on services:", error);
      Alert.alert("Error", "Failed to load add-on services. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const toggleServiceSelection = (serviceId: string) => {
    setServices(prevServices =>
      prevServices.map(service =>
        service.id === serviceId
          ? { ...service, selected: !service.selected }
          : service
      )
    );
  };

  const handleAddServices = () => {
    const selected = services.filter(service => service.selected);
    
    if (selected.length === 0) {
      Alert.alert("No Services Selected", "Please select at least one add-on service.");
      return;
    }

    setSelectedServices(selected);
    onAddServices(selected);
    onClose();
  };

  const getTotalPrice = () => {
    return services
      .filter(service => service.selected)
      .reduce((total, service) => total + service.price, 0);
  };

  const getSelectedCount = () => {
    return services.filter(service => service.selected).length;
  };

  const renderServiceItem = ({ item }: { item: AddOnService }) => (
    <TouchableOpacity
      style={[styles.serviceItem, item.selected && styles.serviceItemSelected]}
      onPress={() => toggleServiceSelection(item.id)}
    >
      <View style={styles.serviceContent}>
        <View style={styles.serviceInfo}>
          <Text style={styles.serviceName}>{item.name}</Text>
          <Text style={styles.serviceDescription}>
            Professional {item.name.toLowerCase()} service
          </Text>
          <View style={styles.priceContainer}>
            <Text style={styles.servicePrice}>₹{item.price}</Text>
            <Text style={styles.priceLabel}>per service</Text>
          </View>
        </View>
        <View style={[styles.checkbox, item.selected && styles.checkboxSelected]}>
          {item.selected && (
            <Ionicons name="checkmark" size={16} color="#fff" />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add-On Services</Text>
          <View style={styles.placeholder} />
        </View>

        <Text style={styles.subtitle}>
          Select additional services from the same category
        </Text>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading services...</Text>
          </View>
        ) : services.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="construct-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No Additional Services</Text>
            <Text style={styles.emptyText}>
              All available services from this category are already included in your booking.
            </Text>
          </View>
        ) : (
          <>
            <FlatList
              data={services}
              renderItem={renderServiceItem}
              keyExtractor={(item) => item.id}
              style={styles.servicesList}
              showsVerticalScrollIndicator={false}
            />

            {/* Selection Summary */}
            {getSelectedCount() > 0 && (
              <View style={styles.summaryContainer}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryText}>
                    {getSelectedCount()} service{getSelectedCount() > 1 ? 's' : ''} selected
                  </Text>
                  <Text style={styles.summaryPrice}>₹{getTotalPrice()}</Text>
                </View>
              </View>
            )}

            {/* Add Services Button */}
            <TouchableOpacity
              style={[
                styles.addButton,
                getSelectedCount() === 0 && styles.addButtonDisabled
              ]}
              onPress={handleAddServices}
              disabled={getSelectedCount() === 0}
            >
              <Text style={styles.addButtonText}>
                Add {getSelectedCount()} Service{getSelectedCount() > 1 ? 's' : ''} to Booking
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  placeholder: {
    width: 32,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6B7280",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
  servicesList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  serviceItem: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  serviceItemSelected: {
    borderColor: "#007AFF",
    backgroundColor: "#F0F9FF",
  },
  serviceContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#111827",
    marginBottom: 4,
  },
  serviceDescription: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 8,
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  servicePrice: {
    fontSize: 16,
    color: "#10B981",
    fontWeight: "700",
  },
  priceLabel: {
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "400",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  summaryContainer: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryText: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "500",
  },
  summaryPrice: {
    fontSize: 18,
    color: "#10B981",
    fontWeight: "700",
  },
  addButton: {
    backgroundColor: "#007AFF",
    marginHorizontal: 20,
    marginVertical: 20,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  addButtonDisabled: {
    backgroundColor: "#D1D5DB",
  },
  addButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});