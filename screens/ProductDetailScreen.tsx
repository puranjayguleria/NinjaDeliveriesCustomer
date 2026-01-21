import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Dimensions,
  TextInput,
  Modal,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRestaurantCart } from "@/context/RestaurantCartContext";

const { width } = Dimensions.get("window");

type AddOn = {
  name: string;
  price: number;
  selected: boolean;
};

type RouteParams = {
  restaurantId: string;
  restaurantName: string;
  item: {
    id: string;
    name: string;
    description?: string;
    price?: number;
    isVeg?: boolean;
    imageUrl?: string;
  };
};

const ProductDetailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { restaurantId, restaurantName, item } = (route.params || {}) as RouteParams;
  
  const { addItem, increase, decrease, getItemQty } = useRestaurantCart();
  const [selectedSize, setSelectedSize] = useState<string>("Regular");
  const [selectedAddOns, setSelectedAddOns] = useState<AddOn[]>([
    { name: "Extra Cheese", price: 45, selected: false },
    { name: "Extra Spicy", price: 20, selected: false },
    { name: "Less Oil", price: 10, selected: false },
    { name: "Extra Sauce", price: 25, selected: false },
    { name: "Double Portion", price: 120, selected: false },
    { name: "Red Chilli", price: 50, selected: false },
  ]);
  const [specialInstructions, setSpecialInstructions] = useState<string>("");
  const [showInstructionsModal, setShowInstructionsModal] = useState<boolean>(false);
  
  const qty = getItemQty(item.id);
  const price = item.price || 0;
  const isVeg = item.isVeg ?? true;

  // Mock data for customization options
  const sizes = [
    { name: "Regular", price: price, selected: selectedSize === "Regular" },
    { name: "Medium", price: price + 40, selected: selectedSize === "Medium" },
    { name: "Large", price: price + 80, selected: selectedSize === "Large" },
  ];

  const toggleAddOn = (index: number) => {
    const updatedAddOns = [...selectedAddOns];
    updatedAddOns[index].selected = !updatedAddOns[index].selected;
    setSelectedAddOns(updatedAddOns);
  };

  const getCurrentPrice = () => {
    const sizePrice = sizes.find(s => s.name === selectedSize)?.price || price;
    const addOnsPrice = selectedAddOns
      .filter(addon => addon.selected)
      .reduce((total, addon) => total + addon.price, 0);
    return sizePrice + addOnsPrice;
  };

  const getSelectedAddOnsText = () => {
    const selected = selectedAddOns.filter(addon => addon.selected);
    return selected.length > 0 ? selected.map(addon => addon.name).join(", ") : "";
  };

  const handleAdd = () => {
    if (!restaurantId) return;
    
    const itemWithCustomizations = {
      id: `${item.id}_${selectedSize}_${getSelectedAddOnsText()}_${specialInstructions}`,
      name: item.name,
      price: getCurrentPrice(),
      isVeg,
      imageUrl: item.imageUrl,
      size: selectedSize,
      addOns: selectedAddOns.filter(addon => addon.selected),
      specialInstructions: specialInstructions.trim(),
      baseItemId: item.id,
    };
    
    addItem(restaurantId, itemWithCustomizations);
  };

  const handleAddToCart = () => {
    handleAdd();
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {restaurantName}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Product Image */}
        <View style={styles.imageContainer}>
          {item.imageUrl ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.productImage}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.productImage, styles.imagePlaceholder]}>
              <MaterialIcons name="restaurant" size={64} color="#ccc" />
            </View>
          )}
          
          {/* Veg/Non-veg indicator */}
          <View style={styles.vegIndicator}>
            <View
              style={[
                styles.vegBox,
                { borderColor: isVeg ? "#2e7d32" : "#b71c1c" },
              ]}
            >
              <View
                style={[
                  styles.vegDot,
                  { backgroundColor: isVeg ? "#2e7d32" : "#b71c1c" },
                ]}
              />
            </View>
          </View>
        </View>

        {/* Product Info */}
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{item.name}</Text>
          
          {item.description && (
            <Text style={styles.productDescription}>{item.description}</Text>
          )}

          <Text style={styles.productPrice}>₹{getCurrentPrice()}</Text>

          {/* Size Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Choose Size</Text>
            {sizes.map((size) => (
              <TouchableOpacity
                key={size.name}
                style={[
                  styles.optionRow,
                  size.selected && styles.optionRowSelected,
                ]}
                onPress={() => setSelectedSize(size.name)}
              >
                <View style={styles.optionLeft}>
                  <View
                    style={[
                      styles.radioButton,
                      size.selected && styles.radioButtonSelected,
                    ]}
                  >
                    {size.selected && <View style={styles.radioButtonInner} />}
                  </View>
                  <Text style={styles.optionName}>{size.name}</Text>
                </View>
                <Text style={styles.optionPrice}>₹{size.price}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Add-ons */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Customize (Optional)</Text>
            {selectedAddOns.map((addon, index) => (
              <TouchableOpacity 
                key={index} 
                style={[
                  styles.optionRow,
                  addon.selected && styles.optionRowSelected,
                ]}
                onPress={() => toggleAddOn(index)}
              >
                <View style={styles.optionLeft}>
                  <View style={styles.checkbox}>
                    <MaterialIcons 
                      name={addon.selected ? "check-box" : "check-box-outline-blank"} 
                      size={20} 
                      color={addon.selected ? "#00b4a0" : "#ccc"} 
                    />
                  </View>
                  <Text style={styles.optionName}>{addon.name}</Text>
                </View>
                <Text style={[
                  styles.optionPrice,
                  addon.price === 0 && styles.freePrice
                ]}>
                  {addon.price > 0 ? `+₹${addon.price}` : "Free"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Special Instructions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Special Instructions</Text>
            <TouchableOpacity 
              style={styles.instructionsBox}
              onPress={() => setShowInstructionsModal(true)}
            >
              <Text style={[
                styles.instructionsPlaceholder,
                specialInstructions && styles.instructionsText
              ]}>
                {specialInstructions || "Any specific requests? (Optional)"}
              </Text>
              <MaterialIcons name="edit" size={16} color="#999" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Special Instructions Modal */}
      <Modal
        visible={showInstructionsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowInstructionsModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowInstructionsModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Special Instructions</Text>
            <TouchableOpacity onPress={() => setShowInstructionsModal(false)}>
              <Text style={styles.modalDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.modalContent}>
            <TextInput
              style={styles.instructionsInput}
              placeholder="Add any special requests for your order..."
              placeholderTextColor="#999"
              value={specialInstructions}
              onChangeText={setSpecialInstructions}
              multiline
              textAlignVertical="top"
              maxLength={200}
            />
            <Text style={styles.characterCount}>
              {specialInstructions.length}/200 characters
            </Text>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Bottom Add to Cart */}
      <View style={styles.bottomContainer}>
        {qty > 0 && (
          <View style={styles.qtyControls}>
            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={() => decrease(item.id)}
            >
              <MaterialIcons name="remove" size={20} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.qtyText}>{qty}</Text>
            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={() => increase(item.id)}
            >
              <MaterialIcons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
        
        <TouchableOpacity style={styles.addToCartBtn} onPress={handleAddToCart}>
          <Text style={styles.addToCartText}>
            {qty > 0 ? `Update Cart • ₹${getCurrentPrice() * qty}` : `Add to Cart • ₹${getCurrentPrice()}`}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default ProductDetailScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    flex: 1,
    textAlign: "center",
  },
  content: {
    flex: 1,
  },
  imageContainer: {
    position: "relative",
  },
  productImage: {
    width: width,
    height: 250,
    backgroundColor: "#f5f5f5",
  },
  imagePlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  vegIndicator: {
    position: "absolute",
    top: 16,
    left: 16,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 8,
    padding: 8,
  },
  vegBox: {
    width: 16,
    height: 16,
    borderRadius: 2,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  vegDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  productInfo: {
    padding: 16,
  },
  productName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#333",
    marginBottom: 8,
  },
  productDescription: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    marginBottom: 12,
  },
  productPrice: {
    fontSize: 20,
    fontWeight: "700",
    color: "#00b4a0",
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#eee",
  },
  optionRowSelected: {
    borderColor: "#00b4a0",
    backgroundColor: "#f0fffe",
  },
  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#ccc",
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  radioButtonSelected: {
    borderColor: "#00b4a0",
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#00b4a0",
  },
  checkbox: {
    marginRight: 12,
  },
  optionName: {
    fontSize: 14,
    color: "#333",
    flex: 1,
  },
  optionPrice: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  freePrice: {
    color: "#2e7d32",
    fontWeight: "500",
  },
  instructionsBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 8,
    padding: 12,
    minHeight: 50,
  },
  instructionsPlaceholder: {
    fontSize: 14,
    color: "#999",
    flex: 1,
  },
  instructionsText: {
    color: "#333",
  },
  bottomContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    backgroundColor: "#fff",
  },
  qtyControls: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#00b4a0",
    overflow: "hidden",
  },
  qtyBtn: {
    backgroundColor: "#00b4a0",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  qtyText: {
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  addToCartBtn: {
    flex: 1,
    backgroundColor: "#00b4a0",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  addToCartText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  modalCancelText: {
    fontSize: 16,
    color: "#666",
  },
  modalDoneText: {
    fontSize: 16,
    color: "#00b4a0",
    fontWeight: "600",
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  instructionsInput: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#333",
    height: 120,
    backgroundColor: "#f9f9f9",
    textAlignVertical: "top",
  },
  characterCount: {
    fontSize: 12,
    color: "#999",
    textAlign: "right",
    marginTop: 8,
  },
});