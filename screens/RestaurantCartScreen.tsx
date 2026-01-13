import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useRestaurantCart } from '../context/RestaurantCartContext';

const { width } = Dimensions.get('window');

type CartItemProps = {
  item: any;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
};

const CartItem: React.FC<CartItemProps> = ({ item, onUpdateQuantity, onRemoveItem }) => {
  const handleDecrease = () => {
    if (item.quantity > 1) {
      onUpdateQuantity(item.id, item.quantity - 1);
    } else {
      onRemoveItem(item.id);
    }
  };

  const handleIncrease = () => {
    onUpdateQuantity(item.id, item.quantity + 1);
  };

  return (
    <View style={styles.cartItem}>
      <View style={styles.itemImageContainer}>
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.itemImage}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.itemImage, styles.placeholderImage]}>
            <MaterialIcons name="restaurant" size={24} color="#ccc" />
          </View>
        )}
      </View>

      <View style={styles.itemDetails}>
        <Text style={styles.itemName} numberOfLines={2}>
          {item.name}
        </Text>
        
        {item.description && (
          <Text style={styles.itemDescription} numberOfLines={1}>
            {item.description}
          </Text>
        )}

        <View style={styles.priceQuantityRow}>
          <Text style={styles.itemPrice}>₹{item.price}</Text>
          
          <View style={styles.quantityControls}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={handleDecrease}
            >
              <MaterialIcons name="remove" size={18} color="#00b4a0" />
            </TouchableOpacity>
            
            <Text style={styles.quantityText}>{item.quantity}</Text>
            
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={handleIncrease}
            >
              <MaterialIcons name="add" size={18} color="#00b4a0" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => onRemoveItem(item.id)}
      >
        <MaterialIcons name="delete-outline" size={20} color="#e74c3c" />
      </TouchableOpacity>
    </View>
  );
};

const RestaurantCartScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { cartItems, updateQuantity, removeFromCart, clearCart, getCartTotal, getCartItemsCount } = useRestaurantCart();
  
  const [isLoading, setIsLoading] = useState(false);

  const handleUpdateQuantity = useCallback((itemId: string, quantity: number) => {
    updateQuantity(itemId, quantity);
  }, [updateQuantity]);

  const handleRemoveItem = useCallback((itemId: string) => {
    Alert.alert(
      'Remove Item',
      'Are you sure you want to remove this item from cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeFromCart(itemId) },
      ]
    );
  }, [removeFromCart]);

  const handleClearCart = useCallback(() => {
    Alert.alert(
      'Clear Cart',
      'Are you sure you want to remove all items from cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear All', style: 'destructive', onPress: clearCart },
      ]
    );
  }, [clearCart]);

  const handleProceedToCheckout = useCallback(() => {
    if (cartItems.length === 0) {
      Alert.alert('Empty Cart', 'Please add items to cart before proceeding.');
      return;
    }
    
    navigation.navigate('RestaurantCheckout');
  }, [cartItems.length, navigation]);

  const renderCartItem = useCallback(({ item }: { item: any }) => (
    <CartItem
      item={item}
      onUpdateQuantity={handleUpdateQuantity}
      onRemoveItem={handleRemoveItem}
    />
  ), [handleUpdateQuantity, handleRemoveItem]);

  const cartTotal = getCartTotal();
  const itemsCount = getCartItemsCount();

  if (cartItems.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Your Cart</Text>
        </View>
        
        <View style={styles.emptyCartContainer}>
          <MaterialIcons name="shopping-cart" size={80} color="#ccc" />
          <Text style={styles.emptyCartTitle}>Your cart is empty</Text>
          <Text style={styles.emptyCartSubtitle}>
            Add some delicious items from restaurants to get started
          </Text>
          
          <TouchableOpacity
            style={styles.browseButton}
            onPress={() => navigation.navigate('NinjaEatsHomeTab')}
          >
            <Text style={styles.browseButtonText}>Browse Restaurants</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Your Cart</Text>
        <TouchableOpacity onPress={handleClearCart}>
          <Text style={styles.clearAllText}>Clear All</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={cartItems}
        keyExtractor={(item) => item.id}
        renderItem={renderCartItem}
        contentContainerStyle={styles.cartList}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.footer}>
        <View style={styles.totalContainer}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Items ({itemsCount})</Text>
            <Text style={styles.totalValue}>₹{cartTotal}</Text>
          </View>
          
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Delivery Fee</Text>
            <Text style={styles.totalValue}>₹40</Text>
          </View>
          
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Taxes & Charges</Text>
            <Text style={styles.totalValue}>₹{Math.round(cartTotal * 0.05)}</Text>
          </View>
          
          <View style={[styles.totalRow, styles.grandTotalRow]}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={styles.grandTotalValue}>
              ₹{cartTotal + 40 + Math.round(cartTotal * 0.05)}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.checkoutButton, isLoading && styles.checkoutButtonDisabled]}
          onPress={handleProceedToCheckout}
          disabled={isLoading}
        >
          <Text style={styles.checkoutButtonText}>
            {isLoading ? 'Processing...' : 'Proceed to Checkout'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  clearAllText: {
    fontSize: 14,
    color: '#e74c3c',
    fontWeight: '600',
  },
  cartList: {
    paddingVertical: 8,
  },
  cartItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  itemImageContainer: {
    marginRight: 12,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemDetails: {
    flex: 1,
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 12,
    color: '#777',
    marginBottom: 8,
  },
  priceQuantityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#00b4a0',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#00b4a0',
    borderRadius: 6,
  },
  quantityButton: {
    padding: 6,
    minWidth: 32,
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    minWidth: 30,
    textAlign: 'center',
  },
  removeButton: {
    padding: 4,
    alignSelf: 'flex-start',
  },
  emptyCartContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyCartTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyCartSubtitle: {
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  browseButton: {
    backgroundColor: '#00b4a0',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  browseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  totalContainer: {
    marginBottom: 16,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 14,
    color: '#666',
  },
  totalValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 8,
    marginTop: 8,
  },
  grandTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  grandTotalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#00b4a0',
  },
  checkoutButton: {
    backgroundColor: '#00b4a0',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  checkoutButtonDisabled: {
    backgroundColor: '#ccc',
  },
  checkoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default RestaurantCartScreen;