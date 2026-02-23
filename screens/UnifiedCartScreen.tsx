import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ScrollView,
  Alert,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useCart } from "../context/CartContext";
import { useServiceCart, ServiceCartItem } from "../context/ServiceCartContext";
import firestore from "@react-native-firebase/firestore";
import { getLastNonCartTab, navigationRef } from "../navigation/rootNavigation";

type UnifiedCartItem = {
  id: string;
  type: 'grocery' | 'service';
  name: string;
  price: number;
  quantity: number;
  image?: string;
  details?: any;
};

export default function UnifiedCartScreen() {
  const navigation = useNavigation<any>();
  const { cart, removeFromCart, increaseQuantity, decreaseQuantity, clearCart: clearGroceryCart } = useCart();
  const { state: serviceState, removeService, clearCart: clearServiceCart, totalAmount: serviceTotalAmount } = useServiceCart();
  
  const [groceryProducts, setGroceryProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch grocery product details
  useEffect(() => {
    const fetchGroceryProducts = async () => {
      try {
        const productIds = Object.keys(cart);
        if (productIds.length === 0) {
          setGroceryProducts([]);
          setLoading(false);
          return;
        }

        const products = await Promise.all(
          productIds.map(async (productId) => {
            const doc = await firestore().collection('products').doc(productId).get();
            if (doc.exists) {
              return { id: productId, ...doc.data() };
            }
            return null;
          })
        );

        setGroceryProducts(products.filter(Boolean));
      } catch (error) {
        console.error('Error fetching grocery products:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGroceryProducts();
  }, [cart]);

  // Create unified cart items
  const unifiedItems: UnifiedCartItem[] = [
    // Grocery items
    ...groceryProducts.map(product => ({
      id: product.id,
      type: 'grocery' as const,
      name: product.name || product.title || 'Unknown Product',
      price: product.price || 0,
      quantity: cart[product.id] || 0,
      image: product.imageUrl || product.image,
      details: product,
    })),
    // Service items
    ...Object.values(serviceState.items).map(service => ({
      id: service.id,
      type: 'service' as const,
      name: service.serviceTitle,
      price: service.company.price,
      quantity: service.quantity,
      details: service,
    }))
  ];

  const groceryTotal = groceryProducts.reduce((total, product) => {
    return total + (product.price * (cart[product.id] || 0));
  }, 0);

  const grandTotal = groceryTotal + serviceTotalAmount;
  const totalItems = unifiedItems.reduce((sum, item) => sum + item.quantity, 0);

  const handleBackPress = () => {
    if (navigation.canGoBack?.()) {
      navigation.goBack();
      return;
    }

    const lastTab = getLastNonCartTab();
    if (navigationRef.isReady?.() && lastTab) {
      try {
        if (lastTab === "ServicesTab") {
          navigationRef.navigate(
            "ServicesTab" as never,
            { screen: "ServicesHome" } as never
          );
          return;
        }
        navigationRef.navigate(lastTab as never);
        return;
      } catch {
        // fall through
      }
    }

    // Cart screens are often opened via `reset`, so there may be no stack history.
    // Use the ROOT navigator as the fallback target.
    const availableRoutes = new Set<string>();
    const collect = (state: any) => {
      if (!state) return;
      (state.routeNames ?? []).forEach((n: string) => availableRoutes.add(n));
      (state.routes ?? []).forEach((r: any) => collect(r.state));
    };
    collect(navigationRef.getRootState?.() ?? (navigationRef as any).getState?.());

    if (navigationRef.isReady?.()) {
      // If we cannot introspect route names, still attempt a sensible exit.
      if (availableRoutes.size === 0) {
        try {
          navigationRef.navigate("HomeTab" as never);
          return;
        } catch {}
      }
      if (availableRoutes.has("HomeTab")) {
        navigationRef.navigate("HomeTab" as never);
        return;
      }
      if (availableRoutes.has("NinjaEatsHomeTab")) {
        navigationRef.navigate("NinjaEatsHomeTab" as never);
        return;
      }
      if (availableRoutes.has("ServicesTab")) {
        navigationRef.navigate("ServicesTab" as never, { screen: "ServicesHome" } as never);
        return;
      }
    }
  };

  const Header = ({ title, right }: { title: string; right?: React.ReactNode }) => (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.headerSafeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBackPress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
          {title}
        </Text>
        {right ?? <View style={styles.headerSpacer} />}
      </View>
    </SafeAreaView>
  );

  const handleRemoveGroceryItem = (productId: string) => {
    Alert.alert(
      "Remove Item",
      "Remove this item from cart?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => removeFromCart(productId) },
      ]
    );
  };

  const handleRemoveServiceItem = (serviceId: string) => {
    Alert.alert(
      "Remove Service",
      "Remove this service from cart?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => removeService(serviceId) },
      ]
    );
  };

  const handleClearAll = () => {
    Alert.alert(
      "Clear Cart",
      "Remove all items from cart?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Clear All", 
          style: "destructive", 
          onPress: () => {
            clearGroceryCart();
            clearServiceCart();
          }
        },
      ]
    );
  };

  const handleCheckout = () => {
    if (groceryProducts.length > 0 && Object.keys(serviceState.items).length > 0) {
      // Both types - show selection
      Alert.alert(
        "Checkout Options",
        "You have both grocery items and services. How would you like to proceed?",
        [
          {
            text: "Grocery Only",
            onPress: () => navigation.navigate("CartPayment")
          },
          {
            text: "Services Only", 
            onPress: () => navigation.navigate("ServiceCheckout", {
              services: Object.values(serviceState.items),
              totalAmount: serviceTotalAmount,
            })
          },
          {
            text: "Separate Checkouts",
            onPress: () => {
              Alert.alert(
                "Checkout Separately",
                "Please checkout grocery items and services separately. Which would you like to checkout first?",
                [
                  { text: "Grocery First", onPress: () => navigation.navigate("CartPayment") },
                  { text: "Services First", onPress: () => navigation.navigate("ServiceCheckout", {
                    services: Object.values(serviceState.items),
                    totalAmount: serviceTotalAmount,
                  })},
                  { text: "Cancel", style: "cancel" }
                ]
              );
            }
          },
          { text: "Cancel", style: "cancel" }
        ]
      );
    } else if (groceryProducts.length > 0) {
      navigation.navigate("CartPayment");
    } else if (Object.keys(serviceState.items).length > 0) {
      navigation.navigate("ServiceCheckout", {
        services: Object.values(serviceState.items),
        totalAmount: serviceTotalAmount,
      });
    }
  };

  const renderCartItem = ({ item }: { item: UnifiedCartItem }) => {
    if (item.type === 'grocery') {
      return (
        <View style={styles.itemCard}>
          <View style={styles.itemHeader}>
            <View style={styles.typeIndicator}>
              <Ionicons name="basket-outline" size={16} color="#4CAF50" />
              <Text style={[styles.typeText, { color: '#4CAF50' }]}>Grocery</Text>
            </View>
          </View>
          
          <View style={styles.itemContent}>
            {item.image && (
              <Image source={{ uri: item.image }} style={styles.itemImage} />
            )}
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemPrice}>₹{item.price}</Text>
            </View>
            
            <View style={styles.quantityControls}>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => decreaseQuantity(item.id)}
              >
                <Ionicons name="remove" size={16} color="#666" />
              </TouchableOpacity>
              <Text style={styles.quantityText}>{item.quantity}</Text>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() => increaseQuantity(item.id, item.details?.quantity || 999)}
              >
                <Ionicons name="add" size={16} color="#666" />
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => handleRemoveGroceryItem(item.id)}
            >
              <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
            </TouchableOpacity>
          </View>
        </View>
      );
    } else {
      const service = item.details as ServiceCartItem;
      return (
        <View style={styles.itemCard}>
          <View style={styles.itemHeader}>
            <View style={styles.typeIndicator}>
              <Ionicons name="construct-outline" size={16} color="#2196F3" />
              <Text style={[styles.typeText, { color: '#2196F3' }]}>Service</Text>
            </View>
          </View>
          
          <View style={styles.itemContent}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.companyName}>{service.company.name}</Text>
              <View style={styles.serviceDetails}>
                <View style={styles.detailRow}>
                  <Ionicons name="calendar-outline" size={14} color="#666" />
                  <Text style={styles.detailText}>
                    {new Date(service.selectedDate).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="time-outline" size={14} color="#666" />
                  <Text style={styles.detailText}>{service.selectedTime}</Text>
                </View>
              </View>
              <Text style={styles.itemPrice}>₹{item.price}</Text>
            </View>
            
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => handleRemoveServiceItem(item.id)}
            >
              <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
            </TouchableOpacity>
          </View>
        </View>
      );
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={["top", "left", "right", "bottom"]}>
        <Text>Loading cart...</Text>
      </SafeAreaView>
    );
  }

  if (unifiedItems.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <Header title="Cart" />
        
        <View style={styles.emptyContainer}>
          <Ionicons name="cart-outline" size={80} color="#ccc" />
          <Text style={styles.emptyText}>Your cart is empty</Text>
          <Text style={styles.emptySubText}>Add some items to get started</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <Header
        title={`Cart (${totalItems} items)`}
        right={
          <TouchableOpacity style={styles.clearButton} onPress={handleClearAll}>
            <Text style={styles.clearText}>Clear All</Text>
          </TouchableOpacity>
        }
      />

      <FlatList
        data={unifiedItems}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        renderItem={renderCartItem}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.footer}>
        <View style={styles.totalContainer}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Grocery Items:</Text>
            <Text style={styles.totalValue}>₹{groceryTotal.toFixed(2)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Services:</Text>
            <Text style={styles.totalValue}>₹{serviceTotalAmount.toFixed(2)}</Text>
          </View>
          <View style={[styles.totalRow, styles.grandTotalRow]}>
            <Text style={styles.grandTotalLabel}>Total:</Text>
            <Text style={styles.grandTotalValue}>₹{grandTotal.toFixed(2)}</Text>
          </View>
        </View>
        
        <TouchableOpacity style={styles.checkoutButton} onPress={handleCheckout}>
          <Text style={styles.checkoutButtonText}>Proceed to Checkout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  headerSafeArea: {
    backgroundColor: '#fff',
  },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },

  backButton: {
    padding: 8,
    width: 44,
    alignItems: 'flex-start',
  },

  headerSpacer: {
    width: 44,
  },
  
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 12,
  },

  clearButton: {
    padding: 8,
    width: 80,
    alignItems: 'flex-end',
  },
  
  clearText: {
    color: '#FF6B6B',
    fontSize: 14,
    fontWeight: '500',
  },
  
  listContainer: {
    padding: 16,
  },
  
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  
  itemHeader: {
    marginBottom: 12,
  },
  
  typeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  
  typeText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  
  itemInfo: {
    flex: 1,
  },
  
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  
  companyName: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  
  itemPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
  },
  
  serviceDetails: {
    marginVertical: 4,
  },
  
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  
  detailText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 12,
    minWidth: 20,
    textAlign: 'center',
  },
  
  removeButton: {
    padding: 8,
  },
  
  footer: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  
  totalContainer: {
    marginBottom: 16,
  },
  
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  
  totalLabel: {
    fontSize: 14,
    color: '#666',
  },
  
  totalValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
  },
  
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    paddingTop: 8,
    marginTop: 8,
  },
  
  grandTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  
  grandTotalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
  },
  
  checkoutButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  
  checkoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  
  emptySubText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
});