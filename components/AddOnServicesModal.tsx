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
import { useNavigation } from "@react-navigation/native";
import { FirestoreService, ServiceIssue } from "../services/firestoreService";
import ServiceAddedSuccessModal from "./ServiceAddedSuccessModal";

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
  bookingId?: string; // Add booking ID for payment integration
}

export default function AddOnServicesModal({
  visible,
  onClose,
  onAddServices,
  categoryId,
  existingServices,
  bookingId,
}: AddOnServicesModalProps) {
  const navigation = useNavigation<any>();
  const [services, setServices] = useState<AddOnService[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedServices, setSelectedServices] = useState<AddOnService[]>([]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalData, setSuccessModalData] = useState<{
    serviceCount: number;
    amount: number;
    paymentMethod: "cash" | "online";
  } | null>(null);

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
      
      // Filter out services that are already booked (main service + add-ons)
      console.log(`🔍 Existing services to exclude:`, existingServices);
      
      const availableServices = allServices.filter(service => {
        const serviceName = service.name.toLowerCase().trim();
        
        // Check if this service is already booked
        const isAlreadyBooked = existingServices.some(existing => {
          const existingName = existing.toLowerCase().trim();
          
          // Exact match
          if (serviceName === existingName) {
            console.log(`🚫 Excluding exact match: "${service.name}" = "${existing}"`);
            return true;
          }
          
          // Check if service name contains existing service name or vice versa
          if (serviceName.includes(existingName) || existingName.includes(serviceName)) {
            console.log(`🚫 Excluding partial match: "${service.name}" ~ "${existing}"`);
            return true;
          }
          
          // Check for common service variations (e.g., "Plumber" vs "Plumbing")
          const serviceRoot = serviceName.replace(/ing$|er$|s$/, '');
          const existingRoot = existingName.replace(/ing$|er$|s$/, '');
          
          if (serviceRoot.length > 3 && existingRoot.length > 3 && 
              (serviceRoot.includes(existingRoot) || existingRoot.includes(serviceRoot))) {
            console.log(`🚫 Excluding root match: "${service.name}" (${serviceRoot}) ~ "${existing}" (${existingRoot})`);
            return true;
          }
          
          // Check for common service variations and keywords
          const serviceKeywords = serviceName.split(/\s+/);
          const existingKeywords = existingName.split(/\s+/);
          
          // Check if any significant keywords overlap (ignore common words)
          const commonWords = ['service', 'services', 'work', 'repair', 'maintenance', 'professional'];
          const significantServiceWords = serviceKeywords.filter(word => 
            word.length > 3 && !commonWords.includes(word)
          );
          const significantExistingWords = existingKeywords.filter(word => 
            word.length > 3 && !commonWords.includes(word)
          );
          
          const hasKeywordOverlap = significantServiceWords.some(serviceWord =>
            significantExistingWords.some(existingWord =>
              serviceWord.includes(existingWord) || existingWord.includes(serviceWord)
            )
          );
          
          if (hasKeywordOverlap && significantServiceWords.length > 0 && significantExistingWords.length > 0) {
            console.log(`🚫 Excluding keyword match: "${service.name}" ~ "${existing}" (keywords: ${significantServiceWords.join(', ')} ~ ${significantExistingWords.join(', ')})`);
            return true;
          }
          
          return false;
        });
        
        if (!isAlreadyBooked) {
          console.log(`✅ Available add-on service: "${service.name}"`);
        }
        
        return !isAlreadyBooked;
      });

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
      console.log(`📊 Summary: ${allServices.length} total services, ${allServices.length - addOnServices.length} excluded, ${addOnServices.length} available`);
      
      if (addOnServices.length === 0) {
        console.log(`ℹ️ No add-on services available - all services from this category are already booked`);
      }
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

  const handleAddServices = async () => {
    const selected = services.filter(service => service.selected);
    
    if (selected.length === 0) {
      Alert.alert("No Services Selected", "Please select at least one add-on service.");
      return;
    }

    const totalAmount = getTotalPrice();
    
    // Show confirmation with payment options
    Alert.alert(
      "Confirm Add-On Services",
      `You are about to add ${selected.length} service${selected.length > 1 ? 's' : ''} for ₹${totalAmount}.\n\nChoose your payment method:`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Pay as Cash", 
          onPress: () => handleCashPayment(selected, totalAmount)
        },
        { 
          text: "Pay Now", 
          onPress: () => handleRazorpayPayment(selected, totalAmount)
        },
      ]
    );
  };

  const handleCashPayment = async (selectedAddOns: AddOnService[], totalAmount: number) => {
    setPaymentLoading(true);
    try {
      console.log(`💰 Processing cash payment for ${selectedAddOns.length} add-on services - Amount: ₹${totalAmount}`);
      
      // Update booking with add-on services and cash payment info
      await updateBookingWithAddOns(selectedAddOns, totalAmount, null, 'cash');
      
      // Close modal and notify parent
      onAddServices(selectedAddOns);
      onClose();
      
      // Show custom success modal
      setSuccessModalData({
        serviceCount: selectedAddOns.length,
        amount: totalAmount,
        paymentMethod: "cash",
      });
      setShowSuccessModal(true);
      
    } catch (error: any) {
      console.error("Cash payment processing error:", error);
      Alert.alert("Error", "Failed to add services with cash payment. Please try again.");
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleRazorpayPayment = async (selectedAddOns: AddOnService[], totalAmount: number) => {
    setPaymentLoading(true);
    try {
      // Import auth and axios here to avoid issues
      const auth = require("@react-native-firebase/auth").default;
      const axios = require("axios").default;

      // API Configuration for Razorpay
      const api = axios.create({
        timeout: 20000,
        headers: { "Content-Type": "application/json" },
      });

      const CLOUD_FUNCTIONS_BASE_URL = "https://asia-south1-ninjadeliveries-91007.cloudfunctions.net";
      const CREATE_RZP_ORDER_URL = `${CLOUD_FUNCTIONS_BASE_URL}/createRazorpayOrder`;

      const getAuthHeaders = async () => {
        const user = auth().currentUser;
        if (!user) throw new Error("Not logged in");
        const token = await user.getIdToken(true);
        return { Authorization: `Bearer ${token}` };
      };

      const toPaise = (amountRupees: number) => Math.round(Number(amountRupees) * 100);

      // Create Razorpay order
      console.log("Creating Razorpay order for add-on services - Amount:", totalAmount);
      const user = auth().currentUser;
      if (!user) throw new Error("Not logged in");

      const amountPaise = toPaise(totalAmount);
      const headers = await getAuthHeaders();

      const requestData = {
        amountPaise,
        currency: "INR",
        receipt: `addon_${bookingId}_${Date.now()}`,
        notes: { 
          uid: user.uid, 
          type: "addon_payment",
          bookingId: bookingId || "",
          serviceCount: selectedAddOns.length
        },
      };

      const { data } = await api.post(CREATE_RZP_ORDER_URL, requestData, { headers });

      if (!data?.orderId || !data?.keyId) {
        throw new Error(data?.error || "Failed to create Razorpay order");
      }

      const contact = (user.phoneNumber || "").replace("+91", "");

      // Navigate directly to Razorpay WebView
      navigation.navigate("RazorpayWebView", {
        orderId: String(data.orderId),
        amount: totalAmount,
        keyId: String(data.keyId),
        currency: String(data.currency ?? "INR"),
        name: "Ninja Add-On Services",
        description: `Add-on services payment for booking ${bookingId}`,
        prefill: {
          contact,
          email: "",
          name: "",
        },
        onSuccess: async (response: any) => {
          try {
            console.log("Add-on payment successful:", response);
            
            // Verify payment on server
            const VERIFY_RZP_PAYMENT_URL = `${CLOUD_FUNCTIONS_BASE_URL}/verifyRazorpayPayment`;
            const verifyHeaders = await getAuthHeaders();
            const { data: verifyData } = await api.post(VERIFY_RZP_PAYMENT_URL, response, { headers: verifyHeaders });

            if (!verifyData?.verified) {
              throw new Error(verifyData?.error || "Payment verification failed");
            }
            
            console.log("Add-on payment verified, updating booking...");
            
            // Update booking with add-on services and payment info
            await updateBookingWithAddOns(selectedAddOns, totalAmount, response, 'online');
            
            // Close modal and notify parent
            onAddServices(selectedAddOns);
            onClose();
            
            // Show custom success modal
            setSuccessModalData({
              serviceCount: selectedAddOns.length,
              amount: totalAmount,
              paymentMethod: "online",
            });
            setShowSuccessModal(true);
            
          } catch (error) {
            console.error("Add-on payment verification failed:", error);
            Alert.alert("Payment Verification Failed", "Please contact support.");
          }
        },
        onFailure: (error: any) => {
          console.log("Add-on payment failed:", error);
          Alert.alert("Payment Failed", error?.description || "Payment was not completed.");
        },
      });

    } catch (error: any) {
      console.error("Razorpay add-on payment error:", error);
      let message = "Payment failed. Please try again.";
      
      if (error?.description) {
        message = error.description;
      } else if (error?.message) {
        message = error.message;
      }
      
      Alert.alert("Payment Failed", message);
    } finally {
      setPaymentLoading(false);
    }
  };

  const updateBookingWithAddOns = async (selectedAddOns: AddOnService[], totalAmount: number, razorpayResponse: any, paymentMethod: 'online' | 'cash' = 'online') => {
    try {
      if (!bookingId) {
        console.warn("No booking ID provided for add-on update");
        return;
      }

      // Get current booking data
      const currentBooking = await FirestoreService.getServiceBookingById(bookingId);
      if (!currentBooking) {
        throw new Error("Booking not found");
      }

      // Prepare updated add-ons
      const newAddOns = selectedAddOns.map(service => ({
        name: service.name,
        price: service.price
      }));

      const updatedAddOns = [
        ...(currentBooking.addOns || []),
        ...newAddOns
      ];

      const newTotalPrice = (currentBooking.totalPrice || 0) + totalAmount;

      // Update booking with add-ons
      await FirestoreService.updateServiceBooking(bookingId, {
        addOns: updatedAddOns,
        totalPrice: newTotalPrice,
        updatedAt: new Date()
      });

      // Create payment record for add-on services
      const paymentData = {
        bookingId: bookingId,
        amount: totalAmount,
        paymentMethod: paymentMethod,
        paymentStatus: paymentMethod === 'cash' ? 'pending' as const : 'paid' as const,
        serviceName: `Add-on Services (${selectedAddOns.length} services)`,
        companyName: 'Ninja Services',
        companyId: currentBooking.companyId || '',
        paymentGateway: paymentMethod === 'online' ? 'razorpay' as const : undefined,
        transactionId: razorpayResponse?.razorpay_payment_id || '',
        razorpayOrderId: razorpayResponse?.razorpay_order_id || '',
        razorpaySignature: razorpayResponse?.razorpay_signature || '',
      };

      await FirestoreService.createServicePayment(paymentData);
      
      console.log(`✅ Updated booking ${bookingId} with ${selectedAddOns.length} add-on services and ${paymentMethod} payment record`);
      
    } catch (error) {
      console.error("Error updating booking with add-ons:", error);
      throw error;
    }
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
    <>
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
            <Text style={styles.emptyTitle}>No Additional Services Available</Text>
            <Text style={styles.emptyText}>
              All services from this category are already included in your booking. You can add services from other categories if needed.
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
                (getSelectedCount() === 0 || paymentLoading) && styles.addButtonDisabled
              ]}
              onPress={handleAddServices}
              disabled={getSelectedCount() === 0 || paymentLoading}
            >
              {paymentLoading ? (
                <View style={styles.loadingButtonContent}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.addButtonText}>Processing...</Text>
                </View>
              ) : (
                <Text style={styles.addButtonText}>
                  Add {getSelectedCount()} Service{getSelectedCount() > 1 ? 's' : ''} - ₹{getTotalPrice()}
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </Modal>

    {/* Success Modal */}
    {successModalData && (
      <ServiceAddedSuccessModal
        visible={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        serviceCount={successModalData.serviceCount}
        amount={successModalData.amount}
        paymentMethod={successModalData.paymentMethod}
      />
    )}
    </>
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
  loadingButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});