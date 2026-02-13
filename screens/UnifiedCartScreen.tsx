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
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useCart } from "../context/CartContext";
import { useServiceCart, ServiceCartItem } from "../context/ServiceCartContext";
import firestore from "@react-native-firebase/firestore";

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
      <View style={styles.loadingContainer}>
        <Text>Loading cart...</Text>
      </View>
    );
  }

  if (unifiedItems.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cart</Text>
          <View style={{ width: 24 }} />
        </View>
        
        <View style={styles.emptyContainer}>
          <Ionicons name="cart-outline" size={80} color="#ccc" />
          <Text style={styles.emptyText}>Your cart is empty</Text>
          <Text style={styles.emptySubText}>Add some items to get started</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cart ({totalItems} items)</Text>
        <TouchableOpacity onPress={handleClearAll}>
          <Text style={styles.clearText}>Clear All</Text>
        </TouchableOpacity>
      </View>

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
    </View>
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
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 50,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
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