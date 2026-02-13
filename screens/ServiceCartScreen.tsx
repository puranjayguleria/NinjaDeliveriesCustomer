import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ScrollView,
  Alert,
  SafeAreaView,
  StatusBar,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useServiceCart, ServiceCartItem } from "../context/ServiceCartContext";

export default function ServiceCartScreen() {
  const navigation = useNavigation<any>();
  const { state, removeService, updateService, clearCart, totalItems, totalAmount, hasServices } = useServiceCart();

  // Defensive total calculation: some older cart items may have totalPrice=0 even though
  // issues/package/unitPrice exist. This keeps the UI correct and prevents showing ₹0.
  const computedTotalAmount = React.useMemo(() => {
    return Object.values(state.items).reduce((sum, item) => {
      const explicit = Number(item.totalPrice);
      if (Number.isFinite(explicit) && explicit > 0) return sum + explicit;

      // Derive from issues if present
      const issuesTotal = (item.issues || []).reduce((issueSum: number, issue: any) => {
        const obj = typeof issue === 'object' ? issue : { name: issue, price: item.unitPrice, quantity: 1 };
        const p = Number(obj?.price) || 0;
        const q = Number(obj?.quantity) || 1;
        return issueSum + p * q;
      }, 0);
      if (issuesTotal > 0) return sum + issuesTotal;

      // Package price fallback
      const pkgPrice = Number(item.additionalInfo?.package?.price);
      if (Number.isFinite(pkgPrice) && pkgPrice > 0) return sum + pkgPrice;

      const unit = Number(item.unitPrice) || Number(item.company?.price) || 0;
      const qty = Number(item.quantity) || 1;
      return sum + unit * qty;
    }, 0);
  }, [state.items]);

  const handleRemoveService = (serviceId: string) => {
    Alert.alert(
      "Remove Service",
      "Are you sure you want to remove this service from your cart?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => removeService(serviceId) },
      ]
    );
  };

  const handleUpdateIssueQuantity = (serviceId: string, issueIndex: number, newQuantity: number) => {
    const service = state.items[serviceId];
    if (!service) return;
    
    // Create a copy of issues with updated quantity
    const updatedIssues = [...service.issues].map((issue, idx) => {
      if (idx === issueIndex) {
        // Convert to object format if it's a string
        const issueObj = typeof issue === 'object' 
          ? { ...issue } 
          : { name: issue, price: service.unitPrice, quantity: 1 };
        
        return {
          ...issueObj,
          quantity: Math.max(1, newQuantity), // Minimum quantity is 1
        };
      }
      // Ensure all issues have quantity field
      if (typeof issue === 'object') {
        return { ...issue, quantity: issue.quantity || 1 };
      }
      return { name: issue, price: service.unitPrice, quantity: 1 };
    });
    
    // Calculate new total price based on all issues
    const newTotalPrice = updatedIssues.reduce((sum, issue) => {
      const issueObj = typeof issue === 'object' ? issue : { name: issue, price: service.unitPrice, quantity: 1 };
      const issuePrice = issueObj.price || 0;
      const issueQty = issueObj.quantity || 1;
      return sum + (issuePrice * issueQty);
    }, 0);
    
    // Update service with new issues and total price
    updateService(serviceId, {
      issues: updatedIssues,
      totalPrice: newTotalPrice,
    });
  };

  const handleRemoveIssue = (serviceId: string, issueIndex: number) => {
    const service = state.items[serviceId];
    if (!service) return;
    
    // If only one issue left, remove the entire service
    if (service.issues.length <= 1) {
      handleRemoveService(serviceId);
      return;
    }
    
    Alert.alert(
      "Remove Issue",
      "Are you sure you want to remove this issue?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Remove", 
          style: "destructive", 
          onPress: () => {
            const updatedIssues = service.issues.filter((_, idx) => idx !== issueIndex);
            
            // Calculate new total price
            const newTotalPrice = updatedIssues.reduce((sum, issue) => {
              const issueObj = typeof issue === 'object' 
                ? issue 
                : { name: issue, price: service.unitPrice, quantity: 1 };
              const issuePrice = issueObj.price || 0;
              const issueQty = issueObj.quantity || 1;
              return sum + (issuePrice * issueQty);
            }, 0);
            
            updateService(serviceId, {
              issues: updatedIssues,
              totalPrice: newTotalPrice,
            });
          }
        },
      ]
    );
  };

  const handleClearCart = () => {
    Alert.alert(
      "Clear Cart",
      "Are you sure you want to remove all services from your cart?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Clear All", style: "destructive", onPress: clearCart },
      ]
    );
  };

  const handleProceedToCheckout = () => {
    if (!hasServices) return;
    
    navigation.navigate("ServiceCheckout", {
      services: Object.values(state.items),
      totalAmount: computedTotalAmount,
    });
  };

  const renderServiceItem = ({ item }: { item: ServiceCartItem }) => (
    <View style={styles.serviceCard}>
      <View style={styles.serviceHeader}>
        <View style={styles.serviceInfo}>
          <Text style={styles.serviceTitle}>{item.serviceTitle}</Text>
          <Text style={styles.companyName}>{item.company.name}</Text>
          <View style={styles.ratingContainer}>
            <Text style={styles.rating}>{item.company.rating}</Text>
            <Text style={styles.experience}>{item.company.experience}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemoveService(item.id)}
        >
          <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
        </TouchableOpacity>
      </View>

      {/* Package/Service Name and Price */}
      <View style={styles.packageSection}>
        <View style={styles.packageInfo}>
          {/* Show selected issues/services */}
          {item.issues && item.issues.length > 0 && (
            <Text style={styles.serviceTitleText}>
              {item.issues.map((issue, idx) => {
                const issueName = typeof issue === 'object' ? issue.name : issue;
                return idx === 0 ? issueName : `, ${issueName}`;
              }).join('')}
            </Text>
          )}
          {item.additionalInfo?.packageName && (
            <Text style={styles.packageNameText}>{item.additionalInfo.packageName}</Text>
          )}
        </View>
        <Text style={styles.packagePrice}>₹{item.totalPrice}</Text>
      </View>

      <View style={styles.bookingDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={16} color="#666" />
          <Text style={styles.detailText}>
            {new Date(item.selectedDate).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={16} color="#666" />
          <Text style={styles.detailText}>{item.selectedTime}</Text>
        </View>
      </View>
    </View>
  );

  if (!hasServices) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={false} />
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Service Cart</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="construct-outline" size={80} color="#ccc" />
          <Text style={styles.emptyTitle}>Your service cart is empty</Text>
          <Text style={styles.emptySubtitle}>
            Browse our services and add them to your cart
          </Text>
          <TouchableOpacity
            style={styles.browseButton}
            onPress={() => navigation.navigate("ServicesHome")}
          >
            <Text style={styles.browseButtonText}>Browse Services</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={false} />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Service Cart</Text>
        <TouchableOpacity
          style={styles.clearButton}
          onPress={handleClearCart}
        >
          <Text style={styles.clearButtonText}>Clear All</Text>
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={Object.values(state.items)}
        renderItem={renderServiceItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.footer}>
        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>Total Amount:</Text>
          <Text style={styles.totalAmount}>₹{computedTotalAmount}</Text>
        </View>
        <TouchableOpacity
          style={styles.checkoutButton}
          onPress={handleProceedToCheckout}
        >
          <Text style={styles.checkoutButtonText}>
            Proceed to Checkout ({totalItems} services)
          </Text>
        </TouchableOpacity>
      </View>
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
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 16,
  },
  clearButton: {
    padding: 8,
  },
  clearButtonText: {
    color: "#FF6B6B",
    fontSize: 14,
    fontWeight: "500",
  },
  listContainer: {
    padding: 16,
  },
  serviceCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  serviceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  companyName: {
    fontSize: 16,
    color: "#666",
    marginBottom: 6,
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
  removeButton: {
    padding: 8,
  },
  serviceDetails: {
    marginBottom: 12,
  },
  detailsTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
    marginBottom: 8,
  },
  issuesContainer: {
    gap: 8,
  },
  issueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8f9fa",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  issueInfo: {
    flex: 1,
    marginRight: 8,
  },
  issueNamePrice: {
    marginBottom: 4,
  },
  issueActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
    fontSize: 14,
    color: "#333",
    fontWeight: "600",
    marginBottom: 2,
  },
  issuePrice: {
    fontSize: 12,
    color: "#6c757d",
    fontWeight: "500",
  },
  issueTotalPrice: {
    fontSize: 15,
    color: "#4CAF50",
    fontWeight: "700",
  },
  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#dee2e6",
  },
  quantityButton: {
    padding: 6,
    paddingHorizontal: 10,
  },
  quantityText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    minWidth: 24,
    textAlign: "center",
  },
  removeIssueButton: {
    padding: 4,
  },
  subtotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e9ecef",
  },
  subtotalLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#495057",
  },
  subtotalAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: "#4CAF50",
  },
  bookingDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailText: {
    fontSize: 14,
    color: "#666",
    marginLeft: 4,
  },
  priceText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#4CAF50",
    marginLeft: 4,
  },
  specialtyText: {
    fontSize: 12,
    color: "#666",
    marginRight: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
  },
  browseButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  browseButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  footer: {
    backgroundColor: "#fff",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  totalContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 16,
    color: "#666",
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
  },
  checkoutButton: {
    backgroundColor: "#4CAF50",
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  checkoutButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },

  // Package Section Styles
  packageSection: {
    backgroundColor: "#f0f9ff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },

  packageInfo: {
    flex: 1,
    marginRight: 12,
  },

  serviceTitleText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1e40af",
    marginBottom: 4,
  },

  packageNameText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#3b82f6",
  },

  packagePrice: {
    fontSize: 18,
    fontWeight: "700",
    color: "#4CAF50",
  },

  // 🔧 NEW: Package Information Styles
  packageInfoContainer: {
    backgroundColor: "#f8f9ff",
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#e0e7ff",
  },

  packageInfoTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4338ca",
    marginBottom: 8,
  },

  packageInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  packageName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
    flex: 1,
  },

  packageTypeBadge: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },

  packageTypeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#ffffff",
    letterSpacing: 0.5,
  },

  packageDuration: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 6,
  },

  packageFeatures: {
    marginTop: 6,
  },

  packageFeaturesTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 4,
  },

  packageFeature: {
    fontSize: 11,
    color: "#6b7280",
    lineHeight: 16,
    marginBottom: 2,
  },

  moreFeatures: {
    fontSize: 10,
    color: "#3b82f6",
    fontWeight: "500",
    marginTop: 2,
    fontStyle: "italic",
  },
});