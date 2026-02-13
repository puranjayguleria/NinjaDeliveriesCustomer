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
  companyId?: string; // Filter services by specific company
  workerId?: string; // Filter services by specific worker (more specific than companyId)
}

export default function AddOnServicesModal({
  visible,
  onClose,
  onAddServices,
  categoryId,
  existingServices,
  bookingId,
  companyId,
  workerId, // Add workerId parameter
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
      console.log(`🔧 AddOnServicesModal opened with:`, {
        categoryId,
        companyId,
        workerId,
        existingServices,
        bookingId
      });
      fetchAddOnServices();
    }
  }, [visible, categoryId, workerId]);

  const fetchAddOnServices = async () => {
    try {
      setLoading(true);
      console.log(`🔧 Fetching add-on services for category: ${categoryId}`);
      if (workerId) {
        console.log(`👷 Filtering by specific worker: ${workerId}`);
      } else if (companyId) {
        console.log(`🏢 Filtering by specific company: ${companyId}`);
      }
      
      // If workerId is provided, fetch worker's assigned services first
      let workerAssignedServiceIds: string[] = [];
      let workerAssignedServiceNames: string[] = [];
      let workerServicePrices: Map<string, number> = new Map(); // Map service name to price
      
      if (workerId) {
        try {
          const firestore = require('@react-native-firebase/firestore').default;
          const workerDoc = await firestore()
            .collection('service_workers')
            .doc(workerId)
            .get();
          
          if (workerDoc.exists) {
            const workerData = workerDoc.data();
            workerAssignedServiceIds = workerData?.assignedServices || [];
            console.log(`👷 Worker assigned services (${workerAssignedServiceIds.length} items):`, workerAssignedServiceIds);
            
            // Fetch actual service names AND prices from service_services collection
            console.log(`📦 Fetching service details from service_services collection...`);
            const serviceDetailsPromises = workerAssignedServiceIds.map(async (serviceId) => {
              try {
                const serviceDoc = await firestore()
                  .collection('service_services')
                  .doc(serviceId)
                  .get();
                
                if (serviceDoc.exists) {
                  const serviceData = serviceDoc.data();
                  const serviceName = serviceData?.serviceName || serviceData?.name;
                  const servicePrice = serviceData?.price;
                  
                  if (serviceName) {
                    console.log(`  ✅ ${serviceId} → "${serviceName}" (₹${servicePrice || 'N/A'})`);
                    
                    // Store price if available
                    if (servicePrice && servicePrice > 0) {
                      workerServicePrices.set(serviceName.toLowerCase().trim(), servicePrice);
                    }
                    
                    return serviceName;
                  }
                }
                console.log(`  ⚠️ ${serviceId} → No service details found`);
                return null;
              } catch (error) {
                console.error(`  ❌ Error fetching ${serviceId}:`, error);
                return null;
              }
            });
            
            const serviceNames = await Promise.all(serviceDetailsPromises);
            workerAssignedServiceNames = serviceNames.filter(name => name !== null) as string[];
            
            console.log(`📋 Worker can provide these services:`, workerAssignedServiceNames);
            console.log(`💰 Worker service prices:`, Object.fromEntries(workerServicePrices));
          } else {
            console.warn(`⚠️ Worker ${workerId} not found`);
          }
        } catch (error) {
          console.error('Error fetching worker data:', error);
        }
      }
      
      // Fetch all services for the category with complete details
      const allServices = await FirestoreService.getServicesWithCompanies(categoryId);
      console.log(`📊 Total services in category: ${allServices.length}`);
      
      // Get service IDs to fetch companies
      const serviceIds = allServices.map(service => service.id);
      let companiesData: any[] = [];
      
      if (serviceIds.length > 0) {
        try {
          // Pass companyId to filter services by specific company
          companiesData = await FirestoreService.getCompaniesByServiceIssues(serviceIds, companyId);
          console.log(`📊 Found ${companiesData.length} companies for services${companyId ? ` (filtered by company: ${companyId})` : ''}`);
          
          // Log detailed company data for debugging
          if (companiesData.length > 0) {
            console.log(`📊 Company data details:`, companiesData.map(c => ({
              id: c.id,
              companyId: c.companyId,
              serviceName: c.serviceName,
              price: c.price
            })));
          }
        } catch (error) {
          console.warn("Could not fetch companies for pricing, using default prices", error);
        }
      }
      
      // Filter services based on worker or company
      let filteredServices = allServices;
      
      // Priority 1: Filter by worker's assigned services (most specific)
      if (workerId && workerAssignedServiceNames.length > 0) {
        console.log(`👷 Filtering services by worker's assigned service names`);
        console.log(`👷 Worker can provide ${workerAssignedServiceNames.length} services`);
        console.log(`📊 Checking against ${allServices.length} services in category`);
        console.log(`📊 Category services:`, allServices.map(s => s.name));
        
        filteredServices = allServices.filter(service => {
          const serviceName = service.name.toLowerCase().trim();
          
          console.log(`\n🔍 Checking service: "${service.name}"`);
          
          // Check if any assigned service matches this service
          const isAssigned = workerAssignedServiceNames.some(assigned => {
            const assignedLower = String(assigned).toLowerCase().trim();
            
            console.log(`  Comparing with assigned: "${assigned}"`);
            
            // Strategy 1: Exact match (ID or name)
            if (assignedLower === serviceName || assignedLower === service.id) {
              console.log(`  ✅ EXACT match!`);
              return true;
            }
            
            // Strategy 2: Partial match (name contains or is contained)
            if (assignedLower.includes(serviceName) || serviceName.includes(assignedLower)) {
              console.log(`  ✅ PARTIAL match!`);
              return true;
            }
            
            // Strategy 3: Normalize and compare (remove special chars, extra spaces)
            const normalizeStr = (str: string) => str
              .toLowerCase()
              .replace(/[^\w\s]/g, '') // Remove special characters
              .replace(/\s+/g, ' ')     // Normalize spaces
              .trim();
            
            const normalizedService = normalizeStr(serviceName);
            const normalizedAssigned = normalizeStr(assignedLower);
            
            console.log(`  Normalized: "${normalizedService}" vs "${normalizedAssigned}"`);
            
            if (normalizedService === normalizedAssigned) {
              console.log(`  ✅ NORMALIZED match!`);
              return true;
            }
            
            // Strategy 4: Check if main keywords match
            const serviceWords = normalizedService.split(' ').filter(w => w.length > 3);
            const assignedWords = normalizedAssigned.split(' ').filter(w => w.length > 3);
            
            if (serviceWords.length > 0 && assignedWords.length > 0) {
              const matchingWords = serviceWords.filter(sw => 
                assignedWords.some(aw => sw === aw || sw.includes(aw) || aw.includes(sw))
              );
              
              // If majority of words match (>60%), consider it a match
              const matchPercentage = matchingWords.length / Math.min(serviceWords.length, assignedWords.length);
              console.log(`  Keywords: ${matchingWords.length}/${Math.min(serviceWords.length, assignedWords.length)} match (${Math.round(matchPercentage * 100)}%)`);
              
              if (matchPercentage > 0.6) {
                console.log(`  ✅ KEYWORD match!`);
                return true;
              }
            }
            
            return false;
          });
          
          if (!isAssigned) {
            console.log(`  ❌ NO MATCH - Service NOT assigned to worker`);
          }
          
          return isAssigned;
        });
        
        console.log(`📊 After worker filter: ${filteredServices.length} services available`);
      }
      // Priority 2: Filter by company (if no worker specified)
      else if (companyId && companiesData.length > 0) {
        console.log(`🏢 Filtering services by company ID: ${companyId}`);
        
        // Create a map of service names offered by this company
        const companyServiceNames = new Set(
          companiesData.map(company => company.serviceName?.toLowerCase().trim()).filter(Boolean)
        );
        
        // Also create a map of service IDs offered by this company
        const companyServiceIds = new Set(
          companiesData.map(company => company.serviceId || company.issueId).filter(Boolean)
        );
        
        console.log(`🏢 Company offers these services:`, Array.from(companyServiceNames));
        console.log(`🏢 Company service IDs:`, Array.from(companyServiceIds));
        
        filteredServices = allServices.filter(service => {
          const serviceName = service.name.toLowerCase().trim();
          
          // Check 1: Exact service name match
          if (companyServiceNames.has(serviceName)) {
            console.log(`✅ Service "${service.name}" - exact name match`);
            return true;
          }
          
          // Check 2: Service ID match
          if (companyServiceIds.has(service.id)) {
            console.log(`✅ Service "${service.name}" - ID match`);
            return true;
          }
          
          // Check 3: Partial name match (company service name contains service name or vice versa)
          for (const companyServiceName of companyServiceNames) {
            if (serviceName.includes(companyServiceName) || companyServiceName.includes(serviceName)) {
              console.log(`✅ Service "${service.name}" - partial match with "${companyServiceName}"`);
              return true;
            }
          }
          
          console.log(`🚫 Service "${service.name}" not offered by selected company`);
          return false;
        });
        
        console.log(`📊 After company filter: ${filteredServices.length} services available`);
      } else {
        if (!companyId) {
          console.log(`⚠️ No companyId provided - showing all services`);
        } else if (companiesData.length === 0) {
          console.log(`⚠️ No companies data found - showing all services`);
        }
      }
      
      // Filter out services that are already booked (main service + add-ons)
      console.log(`🔍 Existing services to exclude:`, existingServices);
      
      const availableServices = filteredServices.filter(service => {
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
          const commonWords = ['service', 'services', 'work', 'repair', 'maintenance', 'professional', 'and', 'the', 'a', 'an', 'or', '&'];
          const significantServiceWords = serviceKeywords.filter(word => 
            word.length > 3 && !commonWords.includes(word)
          );
          const significantExistingWords = existingKeywords.filter(word => 
            word.length > 3 && !commonWords.includes(word)
          );
          
          // Only exclude if MAJORITY of keywords match (at least 60% overlap)
          // This prevents false positives like "Project Reports" vs "Academic & project Assistance"
          if (significantServiceWords.length > 0 && significantExistingWords.length > 0) {
            const matchingKeywords = significantServiceWords.filter(serviceWord =>
              significantExistingWords.some(existingWord =>
                serviceWord.includes(existingWord) || existingWord.includes(serviceWord)
              )
            );
            
            const overlapPercentage = matchingKeywords.length / Math.min(significantServiceWords.length, significantExistingWords.length);
            
            // Only exclude if more than 60% keywords match
            if (overlapPercentage > 0.6) {
              console.log(`🚫 Excluding keyword match: "${service.name}" ~ "${existing}" (${matchingKeywords.length}/${Math.min(significantServiceWords.length, significantExistingWords.length)} keywords match: ${matchingKeywords.join(', ')})`);
              return true;
            } else if (matchingKeywords.length > 0) {
              console.log(`✅ Allowing "${service.name}" despite keyword overlap with "${existing}" (only ${Math.round(overlapPercentage * 100)}% match: ${matchingKeywords.join(', ')})`);
            }
          }
          
          return false;
        });
        
        if (!isAlreadyBooked) {
          console.log(`✅ Available add-on service: "${service.name}"`);
        }
        
        return !isAlreadyBooked;
      });

      console.log(`📊 Final available services after all filters: ${availableServices.length}`);

      // Convert to AddOnService format with proper pricing from companies
      const addOnServices: AddOnService[] = availableServices.map(service => {
        let bestPrice = service.price || 500; // Default fallback
        const serviceName = service.name.toLowerCase().trim();
        
        // Priority 1: If workerId is provided, use worker's service price from service_services
        if (workerId && workerServicePrices.size > 0) {
          const workerPrice = workerServicePrices.get(serviceName);
          
          if (workerPrice) {
            bestPrice = workerPrice;
            console.log(`💰 Service "${service.name}" - Using worker's price: ₹${bestPrice}`);
          } else {
            // Try partial match
            for (const [name, price] of workerServicePrices.entries()) {
              if (serviceName.includes(name) || name.includes(serviceName)) {
                bestPrice = price;
                console.log(`💰 Service "${service.name}" - Using worker's price (partial match): ₹${bestPrice}`);
                break;
              }
            }
            
            if (bestPrice === (service.price || 500)) {
              console.log(`  ⚠️ No worker price found for "${service.name}", using default: ₹${bestPrice}`);
            }
          }
        }
        // Priority 2: If companyId is provided, try to get price from the specific company
        else if (companyId && companiesData.length > 0) {
          console.log(`💰 Looking for price of "${service.name}" from specific company ${companyId}`);
          
          // Find the company entry for this specific service
          const companyService = companiesData.find(company => {
            const companyServiceName = company.serviceName?.toLowerCase().trim();
            
            // Match by name
            return companyServiceName === serviceName || 
                   companyServiceName?.includes(serviceName) || 
                   serviceName.includes(companyServiceName || '');
          });
          
          if (companyService && companyService.price) {
            bestPrice = companyService.price;
            console.log(`  ✅ Found company-specific price: ₹${bestPrice}`);
          } else {
            console.log(`  ⚠️ No company-specific price found, using default: ₹${bestPrice}`);
          }
        }
        // Priority 3: No specific worker/company, find the best price from all companies
        else {
          const serviceCompanies = companiesData.filter(company => 
            company.serviceName && 
            company.serviceName.toLowerCase().includes(service.name.toLowerCase())
          );
          
          if (serviceCompanies.length > 0) {
            const prices = serviceCompanies
              .map(company => company.price)
              .filter(price => price && price > 0);
            
            if (prices.length > 0) {
              bestPrice = Math.min(...prices);
              console.log(`💰 Service "${service.name}" - Best price: ₹${bestPrice} (from ${serviceCompanies.length} companies)`);
            }
          }
        }

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
    
    // Proceed directly to online payment
    handleRazorpayPayment(selected, totalAmount);
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
        customerId: currentBooking.customerId || '',
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
      activeOpacity={0.7}
    >
      <View style={styles.serviceContent}>
        <View style={styles.serviceInfo}>
          <Text style={styles.serviceName}>{item.name}</Text>
          <Text style={styles.serviceDescription}>
            Professional {item.name.toLowerCase()} service
          </Text>
          <View style={styles.priceContainer}>
            <Text style={styles.servicePrice}>₹{item.price}</Text>
            <Text style={styles.priceLabel}>/ service</Text>
          </View>
        </View>
        <View style={[styles.checkbox, item.selected && styles.checkboxSelected]}>
          {item.selected && (
            <Ionicons name="checkmark" size={18} color="#fff" />
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

        <View style={styles.subtitleContainer}>
          <Ionicons name="add-circle" size={20} color="#10B981" />
          <Text style={styles.subtitle}>
            Select additional services from the same category
          </Text>
        </View>

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
              activeOpacity={0.8}
            >
              {paymentLoading ? (
                <View style={styles.loadingButtonContent}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.addButtonText}>Processing Payment...</Text>
                </View>
              ) : (
                <View style={styles.loadingButtonContent}>
                  <Ionicons name="card" size={20} color="#fff" />
                  <Text style={styles.addButtonText}>
                    Pay ₹{getTotalPrice()} & Add {getSelectedCount()} Service{getSelectedCount() > 1 ? 's' : ''}
                  </Text>
                </View>
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
    backgroundColor: "#F3F4F6",
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  placeholder: {
    width: 40,
  },
  subtitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    gap: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#6B7280",
    fontWeight: "500",
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
    paddingTop: 8,
  },
  serviceItem: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  serviceItemSelected: {
    borderColor: "#10B981",
    backgroundColor: "#F0FDF4",
    shadowColor: "#10B981",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  serviceContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  serviceInfo: {
    flex: 1,
    paddingRight: 12,
  },
  serviceName: {
    fontSize: 17,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 6,
    lineHeight: 22,
  },
  serviceDescription: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 10,
    lineHeight: 20,
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  servicePrice: {
    fontSize: 18,
    color: "#10B981",
    fontWeight: "800",
    marginRight: 4,
  },
  priceLabel: {
    fontSize: 12,
    color: "#059669",
    fontWeight: "600",
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  checkboxSelected: {
    backgroundColor: "#10B981",
    borderColor: "#10B981",
  },
  summaryContainer: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 4,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  summaryText: {
    fontSize: 16,
    color: "#374151",
    fontWeight: "600",
  },
  summaryPrice: {
    fontSize: 22,
    color: "#10B981",
    fontWeight: "800",
  },
  addButton: {
    backgroundColor: "#10B981",
    marginHorizontal: 20,
    marginVertical: 20,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: "center",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  addButtonDisabled: {
    backgroundColor: "#D1D5DB",
    shadowOpacity: 0,
    elevation: 0,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  loadingButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
});