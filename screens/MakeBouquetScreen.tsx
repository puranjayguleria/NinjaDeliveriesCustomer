import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Image,
  Dimensions,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import firestore from "@react-native-firebase/firestore";
import { useCart } from "../context/CartContext";
import { Image as ExpoImage } from "expo-image";
import { useLocationContext } from "../context/LocationContext";

const { width } = Dimensions.get("window");
const EMPTY_FLOWER = { id: "", name: "", price: 0, image: "" };

// Updated flower options with new prices
const ROSE_OPTIONS = [
  { id: "red_rose", name: "Red Rose", price: 70, image: "https://firebasestorage.googleapis.com/v0/b/ninjadeliveries-91007.firebasestorage.app/o/valentine%20week%2Frose%20bouquets%2Fmake%20your%20bouquet%2Fphoto-1678540184907-a5fe66786589.avif?alt=media&token=b2988dae-a10c-44f4-b074-ff6dba26ad3c" },
  { id: "yellow_rose", name: "Yellow Rose", price: 80, image: "https://firebasestorage.googleapis.com/v0/b/ninjadeliveries-91007.firebasestorage.app/o/valentine%20week%2Frose%20bouquets%2Fmake%20your%20bouquet%2Fphoto-1673277848241-86e145cd7112.avif?alt=media&token=5d7dc416-9aa4-4d65-800c-d9a2c3a11689" },
  { id: "pink_rose", name: "Pink Rose", price: 80, image: "https://firebasestorage.googleapis.com/v0/b/ninjadeliveries-91007.firebasestorage.app/o/valentine%20week%2Frose%20bouquets%2Fmake%20your%20bouquet%2Fphoto-1694620131938-0f88d08610a4.avif?alt=media&token=3d05d3b9-bbba-44f4-90cd-66af7a6b356c" },
  { id: "carnation_white", name: "White Carnation", price: 70, image: "https://firebasestorage.googleapis.com/v0/b/ninjadeliveries-91007.firebasestorage.app/o/valentine%20week%2Frose%20bouquets%2Fmake%20your%20bouquet%2Fphoto-1715520578911-05d2b82ad5a8.avif?alt=media&token=a905f76e-0ae2-4d38-8383-fe1642b24def" },
  { id: "carnation_red", name: "Red Carnation", price: 70, image: "https://firebasestorage.googleapis.com/v0/b/ninjadeliveries-91007.firebasestorage.app/o/valentine%20week%2Frose%20bouquets%2Fmake%20your%20bouquet%2Fphoto-1717621959619-1039838d8061.avif?alt=media&token=ed1c2532-f291-4dd8-bc07-68f72da34c01" },
  { id: "carnation_pink", name: "Pink Carnation", price: 70, image: "https://firebasestorage.googleapis.com/v0/b/ninjadeliveries-91007.firebasestorage.app/o/valentine%20week%2Frose%20bouquets%2Fmake%20your%20bouquet%2Fpremium_photo-1670601070138-1271415a7893.avif?alt=media&token=1d472c3c-8169-4893-a14b-185196f45078" },
  { id: "carnation_purple", name: "Purple Carnation", price: 70, image: "https://firebasestorage.googleapis.com/v0/b/ninjadeliveries-91007.firebasestorage.app/o/valentine%20week%2Frose%20bouquets%2Fmake%20your%20bouquet%2Fphoto-1693324295386-a627b3406e05.avif?alt=media&token=aab65426-cf9e-416e-a34a-a1e1a554f0e8" },
  { id: "sunflower", name: "Sunflower", price: 220, image: "https://firebasestorage.googleapis.com/v0/b/ninjadeliveries-91007.firebasestorage.app/o/valentine%20week%2Frose%20bouquets%2Fmake%20your%20bouquet%2Fphoto-1526547541286-73a7aaa08f2a.avif?alt=media&token=0b352590-fe6d-4d98-83b9-0da159bdc76d" },
];

// Bouquet configurations
const BOUQUET_SHAPES = {
  front: { 
    id: "front", 
    label: "Front Face", 
    sizes: [5, 7, 9, 11, 13],
    icon: "layers-outline" // Placeholder icon name
  },
  round: { 
    id: "round", 
    label: "Round Shape", 
    sizes: [7, 11],
    icon: "radio-button-on-outline" // Placeholder icon name
  },
};

const MakeBouquetScreen = () => {
  const navigation = useNavigation<any>();
  const { location } = useLocationContext();
  
  // State
  const [bouquetShape, setBouquetShape] = useState<"front" | "round">("front");
  const [flowerOptions, setFlowerOptions] = useState<any[]>([]);
  const [selectedRose, setSelectedRose] = useState<any>(EMPTY_FLOWER);
  // Initialize size with the first available size for the default shape
  const [bouquetSize, setBouquetSize] = useState(BOUQUET_SHAPES.front.sizes[0]);
  const [addingToCart, setAddingToCart] = useState(false);
  const [loadingFlowerOptions, setLoadingFlowerOptions] = useState(true);
  const [readyMadeBouquet, setReadyMadeBouquet] = useState<{
    subcategoryId: string;
    categoryId: string;
  } | null>(null);
  
  // Custom Mix State
  const [isCustomMix, setIsCustomMix] = useState(false);
  const [customComposition, setCustomComposition] = useState<{ [id: string]: number }>({});
  
  const { addToCart } = useCart();

  useEffect(() => {
    const storeId = location?.storeId;
    if (!storeId) {
      setLoadingFlowerOptions(false);
      setFlowerOptions([]);
      setSelectedRose(EMPTY_FLOWER);
      setCustomComposition({});
      return;
    }

    setLoadingFlowerOptions(true);

    let cancelled = false;
    let unsubProducts: (() => void) | null = null;

    firestore()
      .collection("subcategories")
      .where("storeId", "==", storeId)
      .where("name", "==", "Fresh Flowers")
      .limit(1)
      .get()
      .then((subSnap) => {
        if (cancelled) return;
        if (subSnap.empty) {
          setFlowerOptions([]);
          setSelectedRose(EMPTY_FLOWER);
          setCustomComposition({});
          setLoadingFlowerOptions(false);
          return;
        }

        const subDoc = subSnap.docs[0];
        const subId = subDoc.id;

        unsubProducts = firestore()
          .collection("products")
          .where("storeId", "==", storeId)
          .where("subcategoryId", "==", subId)
          .onSnapshot(
            (prodSnap) => {
              const rows = prodSnap.docs
                .map((d) => {
                  const data: any = d.data() || {};
                  const name = String(data.name || "").trim();
                  if (!name) return null;

                  const rawImg =
                    data.imageUrl || data.image || (Array.isArray(data.images) ? data.images[0] : "");
                  const image = String(rawImg || "").replace(/`/g, "").trim();
                  if (!image) return null;

                  const basePrice = Number(data.price ?? 0) - Number(data.discount ?? 0);
                  const taxed =
                    (Number.isFinite(basePrice) ? basePrice : 0) +
                    Number(data.CGST ?? 0) +
                    Number(data.SGST ?? 0) +
                    Number(data.cess ?? 0);
                  const price = Number.isFinite(taxed) ? taxed : Number(data.price ?? 0);
                  if (!Number.isFinite(price) || price <= 0) return null;

                  const qty = Number(data.quantity ?? 0);
                  const isActive = data.isActive !== false;
                  if (!isActive) return null;
                  if (Number.isFinite(qty) && qty <= 0) return null;

                  return { id: d.id, name, price, image };
                })
                .filter(Boolean) as any[];

              if (!rows.length) {
                setFlowerOptions([]);
                setSelectedRose(EMPTY_FLOWER);
                setCustomComposition({});
                setLoadingFlowerOptions(false);
                return;
              }

              setFlowerOptions(rows);
              setSelectedRose((prev: any) => rows.find((r) => r.id === prev?.id) || rows[0]);
              setLoadingFlowerOptions(false);
            },
            () => {
              setFlowerOptions([]);
              setSelectedRose(EMPTY_FLOWER);
              setCustomComposition({});
              setLoadingFlowerOptions(false);
            }
          );
      })
      .catch(() => {
        if (cancelled) return;
        setFlowerOptions([]);
        setSelectedRose(EMPTY_FLOWER);
        setCustomComposition({});
        setLoadingFlowerOptions(false);
      });

    return () => {
      cancelled = true;
      if (unsubProducts) unsubProducts();
    };
  }, [location?.storeId]);

  useEffect(() => {
    const storeId = location?.storeId;
    if (!storeId) {
      setReadyMadeBouquet(null);
      return;
    }

    let cancelled = false;

    const findSubcategory = async () => {
      const namesToTry = ["bouquet", "Bouquet"];
      for (const name of namesToTry) {
        const snap = await firestore()
          .collection("subcategories")
          .where("storeId", "==", storeId)
          .where("name", "==", name)
          .limit(1)
          .get();
        if (!snap.empty) return snap.docs[0];
      }
      return null;
    };

    findSubcategory()
      .then((doc) => {
        if (cancelled) return;
        if (!doc) {
          setReadyMadeBouquet(null);
          return;
        }
        const data: any = doc.data() || {};
        const categoryId = String(data.categoryId || "Gift Shop").replace(/`/g, "").trim();
        setReadyMadeBouquet({ subcategoryId: doc.id, categoryId });
      })
      .catch(() => {
        if (!cancelled) setReadyMadeBouquet(null);
      });

    return () => {
      cancelled = true;
    };
  }, [location?.storeId]);

  const openReadyMadeBouquets = () => {
    if (readyMadeBouquet) {
      navigation.navigate("ProductListingFromHome", {
        categoryId: readyMadeBouquet.categoryId,
        categoryName: "bouquet",
        subcategoryId: readyMadeBouquet.subcategoryId,
      });
      return;
    }

    navigation.navigate("ProductListingFromHome", {
      categoryId: "Gift Shop",
      categoryName: "bouquet",
      searchQuery: "bouquet",
    });
  };

  useEffect(() => {
    if (flowerOptions.length) {
      if (selectedRose && flowerOptions.some((f) => f.id === selectedRose.id)) return;
      setSelectedRose(flowerOptions[0]);
      return;
    }
    setSelectedRose(EMPTY_FLOWER);
  }, [flowerOptions, selectedRose]);

  // Derived state for custom mix
  const totalSelectedCount = Object.values(customComposition).reduce((sum, count) => sum + count, 0);
  const remainingSlots = bouquetSize - totalSelectedCount;
  
  const bouquetDesignCost = (() => {
    if (bouquetShape === "front") return 200;
    if (bouquetShape !== "round") return 0;
    if (bouquetSize === 7) return 280;
    if (bouquetSize === 11) return 440;
    return 0;
  })();

  // Price Calculation
  const flowersSubtotal = isCustomMix
    ? Object.entries(customComposition).reduce((total, [id, count]) => {
        const rose = flowerOptions.find((r) => r.id === id);
        return total + (rose ? rose.price * count : 0);
      }, 0)
    : (selectedRose?.price || 0) * bouquetSize;

  const calculatedPrice = flowersSubtotal + bouquetDesignCost;

  // Handlers
  const handleShapeChange = (shape: "front" | "round") => {
    setBouquetShape(shape);
    setBouquetSize(BOUQUET_SHAPES[shape].sizes[0]);
    setCustomComposition({}); // Reset mix when shape/size logic changes
  };

  const handleQuantityChange = (roseId: string, delta: number) => {
    setCustomComposition(prev => {
      const currentTotalSelectedCount = Object.values(prev).reduce(
        (sum, count) => sum + count,
        0
      );
      const current = prev[roseId] || 0;
      const next = Math.max(0, current + delta);
      
      // Don't exceed bouquet size
      if (delta > 0 && currentTotalSelectedCount >= bouquetSize) return prev;
      
      const newComp = { ...prev, [roseId]: next };
      if (next === 0) delete newComp[roseId];
      return newComp;
    });
  };

  const handleAddToCart = async () => {
    if (addingToCart) return;
    
    // Validation for custom mix
    if (isCustomMix && totalSelectedCount !== bouquetSize) {
      alert(`Please select exactly ${bouquetSize} flowers. You have ${remainingSlots} slots remaining.`);
      return;
    }
    if (!isCustomMix && !selectedRose?.id) {
      alert("No flowers available right now.");
      return;
    }

    setAddingToCart(true);

    try {
      let description = "";
      let name = "";
      let image = "";

      const shapeLabel = BOUQUET_SHAPES[bouquetShape].label;

      if (isCustomMix) {
        name = `${bouquetSize} Stem Custom Mix (${shapeLabel})`;
        // Use the image of the first selected flower or default
        const firstId = Object.keys(customComposition)[0];
        image = flowerOptions.find(r => r.id === firstId)?.image || flowerOptions[0]?.image || ROSE_OPTIONS[0].image;
        
        // Build description
        const parts = Object.entries(customComposition).map(([id, count]) => {
          const rose = flowerOptions.find(r => r.id === id);
          return `${count} ${rose?.name}`;
        });
        description = `Custom Mix (${shapeLabel}): ${parts.join(", ")}${bouquetDesignCost ? `. Design cost: ₹${bouquetDesignCost}` : ""}`;
      } else {
        name = `${bouquetSize} ${selectedRose.name} Bouquet (${shapeLabel})`;
        description = `${shapeLabel} bouquet with ${bouquetSize} stems of ${selectedRose.name}${bouquetDesignCost ? `. Design cost: ₹${bouquetDesignCost}` : ""}`;
        image = selectedRose.image;
      }

      // 1. Create a temporary product in Firestore so CartScreen can fetch it
      const productData = {
        name,
        description,
        price: calculatedPrice,
        image,
        categoryName: "Custom Bouquet",
        quantity: 100, // Stock
        isActive: true,
        isCustom: true,
        shape: bouquetShape,
        bouquetDesignCost,
        createdAt: firestore.FieldValue.serverTimestamp(),
      };

      const docRef = await firestore().collection("products").add(productData);
      
      // 2. Add to local cart context
      addToCart(docRef.id, 100);

      // 3. Navigate to Cart (inside AppTabs -> CartFlow)
      navigation.navigate("AppTabs", { screen: "CartFlow" });
      
    } catch (error) {
      console.error("Error adding bouquet to cart:", error);
      alert("Failed to add bouquet to cart. Please try again.");
    } finally {
      setAddingToCart(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Make Your Bouquet</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={styles.readyMadeBtn} onPress={openReadyMadeBouquets}>
          <Text style={styles.readyMadeTxt}>Ready Made</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Mode Switcher */}
        <View style={styles.modeSwitcher}>
           <TouchableOpacity 
             style={[styles.modeButton, !isCustomMix && styles.activeModeButton]}
             onPress={() => setIsCustomMix(false)}
           >
             <Text style={[styles.modeText, !isCustomMix && styles.activeModeText]}>Single Variety</Text>
           </TouchableOpacity>
           <TouchableOpacity 
             style={[styles.modeButton, isCustomMix && styles.activeModeButton]}
             onPress={() => setIsCustomMix(true)}
           >
             <Text style={[styles.modeText, isCustomMix && styles.activeModeText]}>Custom Mix</Text>
           </TouchableOpacity>
        </View>

        {/* Step 1: Select Bouquet Size */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Select Bouquet Size</Text>
          <Text style={styles.sectionSubtitle}>
             Available sizes for {BOUQUET_SHAPES[bouquetShape].label}
          </Text>
          
          <View style={styles.sizeGrid}>
            {BOUQUET_SHAPES[bouquetShape].sizes.map((size) => (
              <TouchableOpacity
                key={size}
                style={[
                  styles.sizeOption,
                  bouquetSize === size && styles.selectedSizeOption
                ]}
                onPress={() => {
                  setBouquetSize(size);
                  setCustomComposition({});
                }}
              >
                <Text style={[
                  styles.sizeText,
                  bouquetSize === size && styles.selectedSizeText
                ]}>{size} Stems</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Step 2: Select Bouquet */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Select Bouquet</Text>
          <Text style={styles.sectionSubtitle}>Choose the arrangement style</Text>
          
          <View style={styles.shapeGrid}>
            {(Object.keys(BOUQUET_SHAPES) as Array<keyof typeof BOUQUET_SHAPES>).map((shapeKey) => {
              const shape = BOUQUET_SHAPES[shapeKey];
              const isSelected = bouquetShape === shapeKey;
              return (
                <TouchableOpacity
                  key={shapeKey}
                  style={[styles.shapeOption, isSelected && styles.selectedShapeOption]}
                  onPress={() => handleShapeChange(shapeKey)}
                >
                  <Ionicons 
                    name={shape.icon as any} 
                    size={24} 
                    color={isSelected ? "#D81B60" : "#555"} 
                    style={{marginBottom: 8}}
                  />
                  <Text style={[styles.shapeText, isSelected && styles.selectedShapeText]}>
                    {shape.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Step 3: Select Flowers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Select Flowers</Text>
          {loadingFlowerOptions ? (
            <View style={{ paddingVertical: 12, alignItems: "center" }}>
              <ActivityIndicator color="#D81B60" />
            </View>
          ) : isCustomMix ? (
             <View>
                <Text style={styles.sectionSubtitle}>
                   Mix and match! Selected: <Text style={{fontWeight:'bold', color: remainingSlots === 0 ? 'green' : 'red'}}>{totalSelectedCount}/{bouquetSize}</Text>
                   {remainingSlots > 0 ? ` (Pick ${remainingSlots} more)` : " (Full)"}
                </Text>

                {!flowerOptions.length ? (
                  <Text style={{ color: "#999", fontStyle: "italic", textAlign: "center", paddingVertical: 12 }}>
                    No flowers available right now.
                  </Text>
                ) : null}

                {flowerOptions.map((rose) => {
                   const count = customComposition[rose.id] || 0;
                   return (
                     <View key={rose.id} style={styles.mixRow}>
                       <ExpoImage source={{ uri: rose.image }} style={styles.mixImage} contentFit="cover" />
                        <View style={{flex: 1}}>
                           <Text style={styles.mixName}>{rose.name}</Text>
                           <Text style={styles.mixPrice}>₹{rose.price}/stem</Text>
                        </View>
                        
                        <View style={styles.counterControl}>
                           <TouchableOpacity 
                             onPress={() => handleQuantityChange(rose.id, -1)}
                             style={[styles.counterBtn, count === 0 && styles.disabledBtn]}
                             disabled={count === 0}
                           >
                              <Ionicons name="remove" size={20} color={count === 0 ? "#ccc" : "#333"} />
                           </TouchableOpacity>
                           <Text style={styles.counterValue}>{count}</Text>
                           <TouchableOpacity 
                             onPress={() => handleQuantityChange(rose.id, 1)}
                             style={[styles.counterBtn, remainingSlots === 0 && styles.disabledBtn]}
                             disabled={remainingSlots === 0}
                           >
                              <Ionicons name="add" size={20} color={remainingSlots === 0 ? "#ccc" : "#333"} />
                           </TouchableOpacity>
                        </View>
                     </View>
                   );
                })}
             </View>
          ) : (
             <View>
               <Text style={styles.sectionSubtitle}>Choose the base flower for your bouquet</Text>
               {!flowerOptions.length ? (
                 <Text style={{ color: "#999", fontStyle: "italic", textAlign: "center", paddingVertical: 12 }}>
                   No flowers available right now.
                 </Text>
               ) : (
                 <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.roseList}>
                  {flowerOptions.map((rose) => (
                    <TouchableOpacity
                      key={rose.id}
                      style={[
                        styles.roseCard,
                        selectedRose?.id === rose.id && styles.selectedRoseCard
                      ]}
                      onPress={() => setSelectedRose(rose)}
                    >
                      <ExpoImage source={{ uri: rose.image }} style={styles.roseImage} contentFit="cover" />
                      <View style={styles.roseInfo}>
                        <Text style={styles.roseName}>{rose.name}</Text>
                        <Text style={styles.rosePrice}>₹{rose.price}/stem</Text>
                      </View>
                      {selectedRose?.id === rose.id && (
                        <View style={styles.checkIcon}>
                          <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
               )}
             </View>
          )}
        </View>

        {/* Price Calculator Display */}
        <View style={styles.priceSection}>
           <Text style={styles.priceTitle}>Calculated Price</Text>
           {isCustomMix ? (
              <View>
                 {Object.entries(customComposition).map(([id, count]) => {
                    const rose = flowerOptions.find(r => r.id === id) || ROSE_OPTIONS.find(r => r.id === id);
                    if (!rose) return null;
                    return (
                       <View key={id} style={styles.priceCalculationRow}>
                          <Text style={styles.calcText}>{rose.name} (x{count})</Text>
                          <Text style={styles.calcText}>₹ {rose.price * count}</Text>
                       </View>
                    );
                 })}
                 {totalSelectedCount === 0 && <Text style={{color:'#999', fontStyle:'italic', textAlign:'center'}}>No flowers selected yet</Text>}
              </View>
           ) : (
              <View style={styles.priceCalculationRow}>
                  <Text style={styles.calcText}>{selectedRose.name} (₹{selectedRose.price})</Text>
                  <Text style={styles.calcText}>x {bouquetSize}</Text>
              </View>
           )}

           {bouquetDesignCost > 0 && (
             <View style={styles.priceCalculationRow}>
               <Text style={styles.calcText}>Bouquet Making & Premium Wrapping</Text>
               <Text style={styles.calcText}>₹ {bouquetDesignCost}</Text>
             </View>
           )}
           
           <View style={styles.divider} />
           <View style={styles.totalRow}>
             <Text style={styles.totalLabel}>Total Estimate:</Text>
             <Text style={styles.totalPrice}>₹ {calculatedPrice}</Text>
           </View>
        </View>

      </ScrollView>

      {/* Footer Action */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.actionButton, addingToCart && { backgroundColor: "#ccc" }]} 
          onPress={handleAddToCart}
          disabled={addingToCart}
        >
          {addingToCart ? (
             <ActivityIndicator color="#fff" />
          ) : (
             <Text style={styles.actionButtonText}>Add to Cart - ₹ {calculatedPrice}</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9f9f9",
    paddingTop: Platform.OS === "android" ? 24 : 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  backButton: {
    padding: 4,
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  readyMadeBtn: {
    backgroundColor: "#D81B60",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
  },
  readyMadeTxt: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#757575",
    marginBottom: 16,
  },
  roseList: {
    marginHorizontal: -8, // compensate for padding
  },
  roseCard: {
    width: 140,
    marginRight: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "transparent",
    overflow: "hidden",
    backgroundColor: "#f5f5f5",
    position: "relative",
  },
  selectedRoseCard: {
    borderColor: "#D81B60",
    backgroundColor: "#fff0f6",
  },
  roseImage: {
    width: "100%",
    height: 120,
    resizeMode: "cover",
  },
  roseInfo: {
    padding: 8,
  },
  roseName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  rosePrice: {
    fontSize: 12,
    color: "#D81B60",
    fontWeight: "bold",
  },
  checkIcon: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#fff",
    borderRadius: 12,
  },
  shapeGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  shapeOption: {
    width: "48%",
    backgroundColor: "#f5f5f5",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  selectedShapeOption: {
    borderColor: "#D81B60",
    backgroundColor: "#fff0f6",
  },
  shapeText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
  },
  selectedShapeText: {
    color: "#D81B60",
  },
  sizeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    gap: 8,
  },
  sizeOption: {
    width: "30%",
    backgroundColor: "#f5f5f5",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
    marginRight: "3%",
  },
  selectedSizeOption: {
    borderColor: "#D81B60",
    backgroundColor: "#fff0f6",
  },
  sizeText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
  },
  selectedSizeText: {
    color: "#D81B60",
  },
  priceSection: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  priceTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
    textAlign: "center",
  },
  priceCalculationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  calcText: {
    fontSize: 14,
    color: "#555",
  },
  divider: {
    height: 1,
    backgroundColor: "#eee",
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  totalPrice: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#D81B60",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    elevation: 10,
  },
  actionButton: {
    backgroundColor: "#D81B60",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  // Mode Switcher Styles
  modeSwitcher: {
    flexDirection: "row",
    backgroundColor: "#e0e0e0",
    borderRadius: 8,
    padding: 4,
    marginBottom: 24,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 6,
  },
  activeModeButton: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  modeText: {
    fontSize: 14,
    color: "#757575",
    fontWeight: "600",
  },
  activeModeText: {
    color: "#D81B60",
    fontWeight: "bold",
  },
  // Mix Row Styles
  mixRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#eee",
  },
  mixImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  mixName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  mixPrice: {
    fontSize: 12,
    color: "#757575",
  },
  counterControl: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  counterBtn: {
    padding: 6,
  },
  disabledBtn: {
    opacity: 0.3,
  },
  counterValue: {
    fontSize: 14,
    fontWeight: "bold",
    marginHorizontal: 10,
    minWidth: 16,
    textAlign: "center",
  },
});

export default MakeBouquetScreen;
