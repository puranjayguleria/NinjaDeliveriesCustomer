import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ScrollView,
  Alert,
  TextInput,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useServiceCart, ServiceCartItem } from "../context/ServiceCartContext";
import { useLocationContext } from "../context/LocationContext";
import { FirestoreService } from "../services/firestoreService";
import { formatDateToDDMMYYYY } from "../utils/dateUtils";

export default function ServiceCheckoutScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { clearCart } = useServiceCart();
  const { location } = useLocationContext();
  
  const { services, totalAmount } = route.params;
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [loading, setLoading] = useState(false);
  
  // Address management states
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showAddAddressModal, setShowAddAddressModal] = useState(false);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  
  // New address form states
  const [newAddress, setNewAddress] = useState({
    fullAddress: "",
    houseNo: "",
    landmark: "",
    addressType: "Home", // Home, Office, Other
    isDefault: false
  });

  // Load saved addresses on component mount
  useEffect(() => {
    loadSavedAddresses();
  }, []);

  const loadSavedAddresses = async () => {
    try {
      setLoadingAddresses(true);
      const addresses = await FirestoreService.getUserSavedAddressesFromBookings();
      setSavedAddresses(addresses || []);
      
      // Auto-select default address if available
      const defaultAddress = addresses?.find(addr => addr.isDefault);
      if (defaultAddress) {
        setSelectedAddressId(defaultAddress.id);
      } else if (addresses && addresses.length > 0) {
        setSelectedAddressId(addresses[0].id);
      }
      
      console.log(`📍 Loaded ${addresses?.length || 0} saved addresses from bookings`);
    } catch (error) {
      console.error('❌ Error loading saved addresses:', error);
      setSavedAddresses([]);
    } finally {
      setLoadingAddresses(false);
    }
  };

  const saveNewAddress = async () => {
    if (!newAddress.fullAddress.trim()) {
      Alert.alert("Address Required", "Please enter a complete address");
      return;
    }

    try {
      setLoading(true);
      
      const addressData = {
        id: `addr_${Date.now()}`, // Generate unique ID
        fullAddress: newAddress.fullAddress.trim(),
        houseNo: newAddress.houseNo.trim(),
        landmark: newAddress.landmark.trim(),
        addressType: newAddress.addressType,
        isDefault: newAddress.isDefault || savedAddresses.length === 0, // First address is default
        createdAt: new Date(),
      };

      // Add to local state immediately
      const updatedAddresses = [...savedAddresses, addressData];
      setSavedAddresses(updatedAddresses);
      setSelectedAddressId(addressData.id);
      
      // Reset form and close modal
      setNewAddress({
        fullAddress: "",
        houseNo: "",
        landmark: "",
        addressType: "Home",
        isDefault: false
      });
      setShowAddAddressModal(false);
      
      Alert.alert("Success", "Address added successfully!");
    } catch (error) {
      console.error('❌ Error adding address:', error);
      Alert.alert("Error", "Failed to add address. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getSelectedAddress = () => {
    return savedAddresses.find(addr => addr.id === selectedAddressId);
  };

  const handleProceedToPayment = async () => {
    // Validate that user has selected an address
    if (!selectedAddressId || !getSelectedAddress()) {
      Alert.alert(
        "Address Required",
        "Please select or add a service address before proceeding with the booking.",
        [
          {
            text: "Add Address",
            onPress: () => setShowAddAddressModal(true)
          },
          {
            text: "Cancel",
            style: "cancel"
          }
        ]
      );
      return;
    }

    const selectedAddress = getSelectedAddress();
    
    if (paymentMethod === "online") {
      // For online payment, directly open Razorpay payment
      await handleRazorpayPayment();
    } else {
      // For cash payment, create bookings directly
      Alert.alert(
        "Confirm Booking",
        `You are about to book ${services.length} service${services.length > 1 ? 's' : ''} for ₹${totalAmount}.\n\nService will be provided at:\n${selectedAddress.fullAddress}\n\nContinue?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Confirm Cash Booking",
            onPress: async () => {
              await createBookings();
            },
          },
        ]
      );
    }
  };

  const handleRazorpayPayment = async () => {
    setLoading(true);
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
      console.log("Creating Razorpay order for services - Amount:", totalAmount);
      const user = auth().currentUser;
      if (!user) throw new Error("Not logged in");

      const amountPaise = toPaise(totalAmount);
      const headers = await getAuthHeaders();

      const requestData = {
        amountPaise,
        currency: "INR",
        receipt: `service_${user.uid}_${Date.now()}`,
        notes: { uid: user.uid, type: "service_booking" },
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
        name: "Ninja Services",
        description: "Service booking payment",
        prefill: {
          contact,
          email: "",
          name: "",
        },
        onSuccess: async (response: any) => {
          try {
            console.log("Payment successful:", response);
            
            // Verify payment on server
            const VERIFY_RZP_PAYMENT_URL = `${CLOUD_FUNCTIONS_BASE_URL}/verifyRazorpayPayment`;
            const verifyHeaders = await getAuthHeaders();
            const { data: verifyData } = await api.post(VERIFY_RZP_PAYMENT_URL, response, { headers: verifyHeaders });

            if (!verifyData?.verified) {
              throw new Error(verifyData?.error || "Payment verification failed");
            }
            
            console.log("Payment verified, creating bookings with payment details...");
            
            // Create bookings with paid status and Razorpay response
            await createBookings("paid", response);
            
          } catch (error) {
            console.error("Payment verification failed:", error);
            Alert.alert("Payment Verification Failed", "Please contact support.");
          }
        },
        onFailure: (error: any) => {
          console.log("Payment failed:", error);
          Alert.alert("Payment Failed", error?.description || "Payment was not completed.");
        },
      });

    } catch (error: any) {
      console.error("Razorpay payment error:", error);
      let message = "Payment failed. Please try again.";
      
      if (error?.description) {
        message = error.description;
      } else if (error?.message) {
        message = error.message;
      }
      
      Alert.alert("Payment Failed", message, [
        { text: "OK" },
        {
          text: "Use Cash Payment",
          onPress: () => {
            setPaymentMethod("cash");
          }
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const createBookings = async (paymentStatus: string = "pending", razorpayResponse?: any) => {
    setLoading(true);
    try {
      console.log(`🔍 Starting booking creation process...`);
      console.log(`📍 Current location data:`, JSON.stringify(location, null, 2));
      console.log(`💳 Payment status: ${paymentStatus}, method: ${paymentMethod}`);
      
      // Get actual customer information from Firebase
      let customerData = {
        name: "Customer",
        phone: "",
        address: location.address || "" // Use address from LocationContext
      };

      try {
        const currentUser = await FirestoreService.getCurrentUser();
        if (currentUser) {
          customerData = {
            name: currentUser.name || currentUser.displayName || `Customer ${currentUser.phone?.slice(-4) || ''}`,
            phone: currentUser.phone || currentUser.phoneNumber || "",
            address: location.address || currentUser.address || currentUser.location || currentUser.fullAddress || ""
          };
      console.log(`📱 Retrieved customer data: ${customerData.name}, ${customerData.phone}`);
      console.log(`📍 Using service address: ${customerData.address}`);
      console.log(`🛒 Services to book: ${services.length}`);
      
      // Validate services array
      if (!services || services.length === 0) {
        throw new Error('No services to book');
      }
      
      // Log each service for debugging
      services.forEach((service, index) => {
        console.log(`🔧 Service ${index + 1}:`, {
          title: service.serviceTitle,
          issues: service.issues,
          company: service.company?.name || service.company?.id,
          date: service.selectedDate,
          time: service.selectedTime,
          price: service.totalPrice
        });
      });
        }
      } catch (userError) {
        console.error("Error fetching user data:", userError);
        // Continue with location address from context
        customerData.address = location.address || "";
      }

      // Create bookings in Firebase service_bookings collection
      const bookingPromises = services.map(async (service: ServiceCartItem) => {
        const selectedAddress = getSelectedAddress();
        
        // Ensure all required fields have valid values
        const bookingData = {
          serviceName: service.serviceTitle || "Service",
          workName: (service.issues && service.issues.length > 0) ? service.issues.join(', ') : (service.serviceTitle || "Service"),
          customerName: customerData.name || "Customer",
          customerPhone: customerData.phone || "",
          customerAddress: selectedAddress?.fullAddress || "", // Use saved address
          date: service.selectedDate || new Date().toISOString().split('T')[0],
          time: service.selectedTime || "10:00 AM",
          status: 'pending' as const,
          companyId: service.company?.companyId || service.company?.id || "",
          totalPrice: service.totalPrice || 0,
          addOns: service.addOns || [],
          // Add detailed address data for website access
          serviceAddress: {
            id: selectedAddress?.id || "",
            fullAddress: selectedAddress?.fullAddress || "",
            houseNo: selectedAddress?.houseNo || "",
            landmark: selectedAddress?.landmark || "",
            addressType: selectedAddress?.addressType || "Home",
            // Include location coordinates if available
            lat: (location.lat !== null && location.lat !== undefined) ? location.lat : null,
            lng: (location.lng !== null && location.lng !== undefined) ? location.lng : null,
          },
          paymentMethod: paymentMethod || "cash",
          paymentStatus: paymentStatus || "pending",
          notes: notes || "",
        };

        console.log(`📋 About to create booking with data:`, JSON.stringify(bookingData, null, 2));
        console.log(`📍 Using saved address: "${selectedAddress?.fullAddress}"`);

        const bookingId = await FirestoreService.createServiceBooking(bookingData);
        console.log(`✅ Created booking ${bookingId} for ${service.serviceTitle}`);
        console.log(`📍 Address data saved for website access`);
        
        // Create payment record in service_payments collection
        // Ensure all required fields have valid values
        if (!bookingId) {
          throw new Error('Failed to create booking - no booking ID returned');
        }
        
        const paymentData = {
          bookingId,
          amount: service.totalPrice || 0,
          paymentMethod: paymentMethod as 'cash' | 'online',
          paymentStatus: paymentStatus as 'pending' | 'paid',
          serviceName: service.serviceTitle || 'Service',
          companyName: service.company?.name || 'Service Provider',
          companyId: service.company?.companyId || service.company?.id || '',
          paymentGateway: paymentMethod === 'online' ? 'razorpay' as const : 'cash' as const,
          // Add Razorpay details if payment was successful
          ...(razorpayResponse && paymentStatus === 'paid' && {
            transactionId: razorpayResponse.razorpay_payment_id || '',
            razorpayOrderId: razorpayResponse.razorpay_order_id || '',
            razorpaySignature: razorpayResponse.razorpay_signature || '',
          }),
        };

        console.log('Creating payment record with data:', paymentData);
        const paymentId = await FirestoreService.createServicePayment(paymentData);
        console.log(`✅ Created payment record ${paymentId} for booking ${bookingId}`);
        
        return {
          ...service,
          bookingId,
          paymentId,
          notes,
          paymentMethod,
        };
      });

      const bookings = await Promise.all(bookingPromises);
      
      // Clear cart after successful booking creation
      clearCart();

      // Navigate to booking confirmation screen with the first booking details
      const firstBooking = bookings[0];
      navigation.navigate("BookingConfirmation", {
        bookingId: firstBooking.bookingId,
        paymentMethod,
        paymentStatus,
        totalAmount,
      });

    } catch (error: any) {
      console.error('❌ Error creating bookings:', error);
      
      // Check if error is due to busy workers
      if (error.message && error.message.includes('BOOKING BLOCKED')) {
        Alert.alert(
          "Booking Blocked - Workers Busy",
          "All workers for this company are currently busy with the selected service. This prevents overbooking.\n\nPlease select another company or try again later.",
          [
            {
              text: "Select Another Company",
              onPress: () => navigation.goBack()
            },
            {
              text: "OK",
              style: "cancel"
            }
          ]
        );
      } else if (error.message && error.message.includes('All workers for this company are currently busy')) {
        Alert.alert(
          "Workers Busy for Service",
          "All workers for the selected company are currently busy with this service. Please select another company or try again later.",
          [
            {
              text: "Select Another Company",
              onPress: () => navigation.goBack()
            },
            {
              text: "OK",
              style: "cancel"
            }
          ]
        );
      } else {
        Alert.alert(
          "Booking Failed",
          "Failed to create your bookings. Please try again.",
          [{ text: "OK" }]
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const renderServiceItem = ({ item }: { item: ServiceCartItem }) => (
    <View style={styles.serviceCard}>
      <View style={styles.serviceHeader}>
        <Text style={styles.serviceTitle}>{item.serviceTitle}</Text>
        <Text style={styles.servicePrice}>₹{item.totalPrice}</Text>
      </View>

      <View style={styles.serviceDetails}>
        <Text style={styles.companyName}>{item.company.name}</Text>
        <View style={styles.ratingContainer}>
          <Text style={styles.rating}>{item.company.rating}</Text>
          <Text style={styles.experience}>{item.company.experience}</Text>
          {item.company.verified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.bookingInfo}>
        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={16} color="#666" />
          <Text style={styles.infoText}>{formatDateToDDMMYYYY(item.selectedDate)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={16} color="#666" />
          <Text style={styles.infoText}>{item.selectedTime}</Text>
        </View>
      </View>

      <View style={styles.issuesContainer}>
        <Text style={styles.issuesTitle}>Issues:</Text>
        <View style={styles.issuesList}>
          {(item.issues || []).map((issue, index) => (
            <View key={index} style={styles.issueTag}>
              <Text style={styles.issueText}>{issue}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Service Checkout</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Services ({services.length})</Text>
        
        <FlatList
          data={services}
          renderItem={renderServiceItem}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          contentContainerStyle={styles.servicesList}
        />

        {/* Service Address Section */}
        <View style={styles.addressSection}>
          <View style={styles.addressHeader}>
            <Text style={styles.sectionTitle}>Service Address</Text>
            <TouchableOpacity 
              style={styles.addAddressButton}
              onPress={() => setShowAddAddressModal(true)}
            >
              <Ionicons name="add-circle-outline" size={20} color="#4CAF50" />
              <Text style={styles.addAddressText}>Add New</Text>
            </TouchableOpacity>
          </View>

          {loadingAddresses ? (
            <View style={styles.loadingAddressContainer}>
              <ActivityIndicator size="small" color="#4CAF50" />
              <Text style={styles.loadingAddressText}>Loading addresses...</Text>
            </View>
          ) : savedAddresses.length === 0 ? (
            <View style={styles.noAddressContainer}>
              <Ionicons name="location-outline" size={48} color="#ccc" />
              <Text style={styles.noAddressTitle}>No Saved Addresses</Text>
              <Text style={styles.noAddressText}>Add your first address to continue</Text>
              <TouchableOpacity 
                style={styles.addFirstAddressButton}
                onPress={() => setShowAddAddressModal(true)}
              >
                <Ionicons name="add-circle" size={16} color="#fff" />
                <Text style={styles.addFirstAddressText}>Add Address</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={savedAddresses}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.addressCard,
                    selectedAddressId === item.id && styles.addressCardSelected
                  ]}
                  onPress={() => setSelectedAddressId(item.id)}
                >
                  <View style={styles.addressCardHeader}>
                    <View style={styles.addressTypeContainer}>
                      <Ionicons 
                        name={item.addressType === 'Home' ? 'home' : item.addressType === 'Office' ? 'business' : 'location'} 
                        size={16} 
                        color="#4CAF50" 
                      />
                      <Text style={styles.addressType}>{item.addressType}</Text>
                      {item.isDefault && (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultText}>Default</Text>
                        </View>
                      )}
                    </View>
                    {selectedAddressId === item.id && (
                      <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                    )}
                  </View>
                  
                  <Text style={styles.addressText}>{item.fullAddress}</Text>
                  
                  {item.houseNo && (
                    <Text style={styles.addressDetail}>House/Flat: {item.houseNo}</Text>
                  )}
                  
                  {item.landmark && (
                    <Text style={styles.addressDetail}>Landmark: {item.landmark}</Text>
                  )}
                </TouchableOpacity>
              )}
              scrollEnabled={false}
            />
          )}
        </View>

        <View style={styles.notesSection}>
          <Text style={styles.sectionTitle}>Additional Notes (Optional)</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Any special instructions or requirements..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.paymentSection}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          
          <TouchableOpacity
            style={[
              styles.paymentOption,
              paymentMethod === "cash" && styles.paymentOptionSelected,
            ]}
            onPress={() => setPaymentMethod("cash")}
          >
            <View style={styles.paymentOptionContent}>
              <View style={styles.cashIconContainer}>
                <Ionicons name="cash-outline" size={24} color="#FF9800" />
              </View>
              <View style={styles.paymentOptionTextContainer}>
                <Text style={styles.paymentOptionText}>Cash on Service</Text>
                <Text style={styles.paymentOptionSubtext}>Pay when service is completed</Text>
              </View>
            </View>
            {paymentMethod === "cash" && (
              <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.paymentOption,
              paymentMethod === "online" && styles.paymentOptionSelected,
            ]}
            onPress={() => setPaymentMethod("online")}
          >
            <View style={styles.paymentOptionContent}>
              <View style={styles.onlineIconContainer}>
                <Ionicons name="card-outline" size={24} color="#4CAF50" />
              </View>
              <View style={styles.paymentOptionTextContainer}>
                <Text style={styles.paymentOptionText}>Pay Online</Text>
                <Text style={styles.paymentOptionSubtext}>UPI, Cards, Net Banking via Razorpay</Text>
              </View>
            </View>
            {paymentMethod === "online" && (
              <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            )}
          </TouchableOpacity>

          {paymentMethod === "online" && (
            <View style={styles.paymentNote}>
              <Ionicons name="information-circle-outline" size={16} color="#2563eb" />
              <Text style={styles.paymentNoteText}>
                Secure payment via Razorpay. Supports UPI (Google Pay, PhonePe, Paytm), Credit/Debit Cards, and Net Banking.
              </Text>
            </View>
          )}

          {paymentMethod === "cash" && (
            <View style={styles.cashPaymentNote}>
              <Ionicons name="cash-outline" size={16} color="#FF9800" />
              <Text style={styles.cashPaymentNoteText}>
                Pay directly to the technician when the service is completed. No advance payment required.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.summarySection}>
          <Text style={styles.sectionTitle}>Booking Summary</Text>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Services ({services.length})</Text>
            <Text style={styles.summaryValue}>₹{totalAmount}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Service Address</Text>
            <Text style={[styles.summaryValue, styles.summaryAddressValue]}>
              {(() => {
                const selectedAddress = getSelectedAddress();
                if (selectedAddress) {
                  const address = selectedAddress.fullAddress;
                  return address.length > 30 ? 
                    `${address.substring(0, 30)}...` : 
                    address;
                } else {
                  return "Not selected";
                }
              })()}
            </Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Service Charges</Text>
            <Text style={styles.summaryValue}>₹0</Text>
          </View>
          
          <View style={styles.summaryDivider} />
          
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>₹{totalAmount}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.totalContainer}>
          <Text style={styles.footerTotalLabel}>Total: ₹{totalAmount}</Text>
          <Text style={styles.footerServiceCount}>{services.length} service{services.length > 1 ? 's' : ''}</Text>
        </View>
        
        {paymentMethod === "cash" ? (
          <TouchableOpacity
            style={[styles.cashPayButton, loading && styles.proceedButtonDisabled]}
            onPress={handleProceedToPayment}
            disabled={loading}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.proceedButtonText}>Creating Bookings...</Text>
              </View>
            ) : (
              <View style={styles.cashPayButtonContent}>
                <Ionicons name="cash-outline" size={20} color="#fff" />
                <Text style={styles.proceedButtonText}>Pay as Cash</Text>
              </View>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.proceedButton, loading && styles.proceedButtonDisabled]}
            onPress={handleProceedToPayment}
            disabled={loading}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.proceedButtonText}>Processing Payment...</Text>
              </View>
            ) : (
              <View style={styles.onlinePayButtonContent}>
                <Ionicons name="card-outline" size={20} color="#fff" />
                <Text style={styles.proceedButtonText}>Pay ₹{totalAmount} Online</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Add Address Modal */}
      <Modal
        visible={showAddAddressModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddAddressModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setShowAddAddressModal(false)}
            >
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add New Address</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Complete Address *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Enter your complete address..."
                placeholderTextColor="#999"
                value={newAddress.fullAddress}
                onChangeText={(text) => setNewAddress(prev => ({ ...prev, fullAddress: text }))}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>House/Flat/Building No.</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g., 123, Apartment Name"
                placeholderTextColor="#999"
                value={newAddress.houseNo}
                onChangeText={(text) => setNewAddress(prev => ({ ...prev, houseNo: text }))}
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Landmark (Optional)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g., Near Metro Station, Mall"
                placeholderTextColor="#999"
                value={newAddress.landmark}
                onChangeText={(text) => setNewAddress(prev => ({ ...prev, landmark: text }))}
              />
            </View>

            <View style={styles.formSection}>
              <Text style={styles.formLabel}>Address Type</Text>
              <View style={styles.addressTypeOptions}>
                {['Home', 'Office', 'Other'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.addressTypeOption,
                      newAddress.addressType === type && styles.addressTypeOptionSelected
                    ]}
                    onPress={() => setNewAddress(prev => ({ ...prev, addressType: type }))}
                  >
                    <Ionicons 
                      name={type === 'Home' ? 'home' : type === 'Office' ? 'business' : 'location'} 
                      size={16} 
                      color={newAddress.addressType === type ? "#fff" : "#666"} 
                    />
                    <Text style={[
                      styles.addressTypeOptionText,
                      newAddress.addressType === type && styles.addressTypeOptionTextSelected
                    ]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={styles.defaultAddressOption}
              onPress={() => setNewAddress(prev => ({ ...prev, isDefault: !prev.isDefault }))}
            >
              <Ionicons 
                name={newAddress.isDefault ? "checkbox" : "checkbox-outline"} 
                size={20} 
                color="#4CAF50" 
              />
              <Text style={styles.defaultAddressText}>Set as default address</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowAddAddressModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.saveAddressButton, loading && styles.saveAddressButtonDisabled]}
              onPress={saveNewAddress}
              disabled={loading || !newAddress.fullAddress.trim()}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveAddressButtonText}>Save Address</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    paddingTop: 50,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginLeft: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 16,
    marginTop: 8,
  },
  servicesList: {
    marginBottom: 24,
  },
  serviceCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  serviceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  serviceTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    flex: 1,
  },
  servicePrice: {
    fontSize: 16,
    fontWeight: "600",
    color: "#4CAF50",
  },
  serviceDetails: {
    marginBottom: 12,
  },
  companyName: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  rating: {
    fontSize: 14,
    color: "#333",
    marginLeft: 4,
  },
  experience: {
    fontSize: 14,
    color: "#666",
    marginLeft: 4,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
  },
  verifiedText: {
    fontSize: 12,
    color: "#4CAF50",
    marginLeft: 2,
  },
  bookingInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  infoText: {
    fontSize: 14,
    color: "#666",
    marginLeft: 4,
  },
  issuesContainer: {
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    paddingTop: 12,
  },
  issuesTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
    marginBottom: 8,
  },
  issuesList: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  issueTag: {
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
    marginBottom: 4,
  },
  issueText: {
    fontSize: 12,
    color: "#666",
  },
  // Address Section Styles
  addressSection: {
    marginBottom: 24,
  },
  addressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  addAddressButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#f0f9ff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#4CAF50",
  },
  addAddressText: {
    fontSize: 14,
    color: "#4CAF50",
    fontWeight: "500",
    marginLeft: 4,
  },
  loadingAddressContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    backgroundColor: "#fff",
    borderRadius: 12,
  },
  loadingAddressText: {
    fontSize: 14,
    color: "#666",
    marginLeft: 8,
  },
  noAddressContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderStyle: "dashed",
  },
  noAddressTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginTop: 12,
    marginBottom: 4,
  },
  noAddressText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 16,
  },
  addFirstAddressButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4CAF50",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  addFirstAddressText: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "600",
    marginLeft: 4,
  },
  addressCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  addressCardSelected: {
    borderColor: "#4CAF50",
    backgroundColor: "#f8fff8",
  },
  addressCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  addressTypeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  addressType: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginLeft: 6,
  },
  defaultBadge: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  defaultText: {
    fontSize: 10,
    color: "#fff",
    fontWeight: "600",
  },
  addressText: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
    marginBottom: 4,
  },
  addressDetail: {
    fontSize: 12,
    color: "#666",
    marginBottom: 2,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    paddingTop: 50,
  },
  modalCloseButton: {
    padding: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formSection: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#333",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    minHeight: 44,
  },
  addressTypeOptions: {
    flexDirection: "row",
    gap: 12,
  },
  addressTypeOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    backgroundColor: "#fff",
  },
  addressTypeOptionSelected: {
    backgroundColor: "#4CAF50",
    borderColor: "#4CAF50",
  },
  addressTypeOptionText: {
    fontSize: 14,
    color: "#666",
    marginLeft: 6,
    fontWeight: "500",
  },
  addressTypeOptionTextSelected: {
    color: "#fff",
  },
  defaultAddressOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  defaultAddressText: {
    fontSize: 14,
    color: "#333",
    marginLeft: 8,
    fontWeight: "500",
  },
  modalFooter: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    backgroundColor: "#fff",
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    color: "#666",
    fontWeight: "500",
  },
  saveAddressButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#4CAF50",
    alignItems: "center",
  },
  saveAddressButtonDisabled: {
    backgroundColor: "#A5D6A7",
  },
  saveAddressButtonText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
  },
  summaryAddressValue: {
    fontSize: 12,
    color: "#666",
    textAlign: "right",
    flex: 1,
    marginLeft: 8,
  },
  notesSection: {
    marginBottom: 24,
  },
  notesInput: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#333",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    minHeight: 80,
  },
  paymentSection: {
    marginBottom: 24,
  },
  paymentOption: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  paymentOptionSelected: {
    borderColor: "#4CAF50",
    backgroundColor: "#f8fff8",
  },
  paymentOptionContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  cashIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFF3E0",
    justifyContent: "center",
    alignItems: "center",
  },
  onlineIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E8F5E8",
    justifyContent: "center",
    alignItems: "center",
  },
  paymentOptionTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  paymentOptionText: {
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
  paymentOptionSubtext: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  paymentNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#f0f9ff",
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#e0f2fe",
  },
  paymentNoteText: {
    fontSize: 12,
    color: "#2563eb",
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },
  cashPaymentNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFF8E1",
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#FFE0B2",
  },
  cashPaymentNoteText: {
    fontSize: 12,
    color: "#FF9800",
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },
  summarySection: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 100,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: "#666",
  },
  summaryValue: {
    fontSize: 14,
    color: "#333",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "#e0e0e0",
    marginVertical: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  totalValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  totalContainer: {
    flex: 1,
  },
  footerTotalLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  footerServiceCount: {
    fontSize: 14,
    color: "#666",
  },
  proceedButton: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  cashPayButton: {
    backgroundColor: "#FF9800",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  cashPayButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  onlinePayButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  proceedButtonDisabled: {
    backgroundColor: "#A5D6A7",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  proceedButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});