import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TouchableOpacity,
  Dimensions,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import firestore from "@react-native-firebase/firestore";
import { useNavigation } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { useCart } from "@/context/CartContext";
import Toast from "react-native-toast-message";

const { width } = Dimensions.get("window");
const CARD_WIDTH = width * 0.24;

const ValentineSpecialSection = ({ storeId }: { storeId: string }) => {
  const navigation = useNavigation<any>();
  const [products, setProducts] = useState<any[]>([]);
  const { getItemQuantity, addToCart, decreaseQuantity } = useCart();

  useEffect(() => {
    if (!storeId) return;

    // Fetch products relevant to Valentine's + user requested categories
    const fetchProducts = async () => {
      try {
        // Fetch a larger pool of products to filter from client-side
        // We look for items matching: valentine, love, heart, chocolate, water, ice cream, sexual wellness
        const snap = await firestore()
          .collection("products")
          .where("storeId", "==", storeId)
          .where("quantity", ">", 0)
          .limit(200)
          .get();

        const allItems = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        
        const keywords = [
          "valentine", "love", "heart", "gift", "rose", "teddy", // Valentine core
          "chocolate", "choco", "cadbury", "ferrero", // Chocolates
          "water", "bisleri", "aquafina", "bottle", // Water
          "ice cream", "icecream", "magnum", "cornetto", "cone", "cup", "amul", // Ice Cream
          "sexual", "condom", "contraceptive", "lube", "durex", "manforce", "wellness" // Sexual Wellness
        ];

        const filtered = allItems.filter((p: any) => {
           const text = [
             p.name, 
             p.description, 
             p.categoryName, 
             p.subCategoryName, 
             ...(p.keywords || [])
           ].join(" ").toLowerCase();
           
           return keywords.some(k => text.includes(k));
        });

        // Randomize or sort? Let's just take top 10 matches to be safe
        setProducts(filtered.slice(0, 10));
      } catch (e) {
        console.error("Failed to load valentine items", e);
      }
    };

    fetchProducts();
  }, [storeId]);

  if (!products.length) return null;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#ffe6e9", "#fff0f5", "#fff"]}
        style={styles.background}
      />
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <View style={styles.titleRow}>
             <MaterialIcons name="favorite" size={18} color="#D81B60" style={{ marginRight: 4 }} />
             <Text style={styles.title}> Nearby Favourites</Text>
             <MaterialIcons name="favorite" size={14} color="#F48FB1" style={{ marginLeft: 4, opacity: 0.6 }} />
          </View>
          <Text style={styles.subtitle}>From Dharamshala Today 💌</Text>
        </View>
        <TouchableOpacity 
          onPress={() =>
            navigation.navigate("CategoriesTab", {
              screen: "CategoriesHome",
              params: { autoOpenFirstCategory: true },
            })
          }
          style={styles.seeMoreBtn}
        >
          <Text style={styles.seeMoreTxt}>See More {">"}</Text>
        </TouchableOpacity>
      </View>

      {/* Products List */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      >
        {products.map((item) => {
           const count = getItemQuantity(item.id);
           const price = Number(item.price || 0);
           const discount = Number(item.discount || 0);
           const finalPrice = price + (Number(item.CGST||0) + Number(item.SGST||0)) - discount;
           const oldPrice = price + (Number(item.CGST||0) + Number(item.SGST||0));
           const imgUrl = item.imageUrl || item.image || (item.images && item.images[0]);

           return (
            <View
              key={item.id}
              style={styles.card}
            >
              <View style={styles.imageContainer}>
                <Image
                  source={{ uri: imgUrl }}
                  style={styles.productImage}
                  resizeMode="cover"
                  resizeMethod="resize"
                />
                <View style={styles.badge}>
                  <MaterialIcons name="favorite" size={10} color="#fff" style={{ marginRight: 2 }} />
                  <Text style={styles.badgeTxt}>Ninja Local Pick</Text>
                </View>
              </View>

              <View style={styles.infoContainer}>
                <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.vendorName} numberOfLines={1}>{item.brand || "Local Fresh"}</Text>
                
                <View style={styles.priceRow}>
                  <Text style={styles.finalPrice}>₹{finalPrice}</Text>
                  {discount > 0 && (
                    <Text style={styles.oldPrice}>₹{oldPrice}</Text>
                  )}
                </View>

                {count === 0 ? (
                  <TouchableOpacity
                    style={styles.addBtn}
                    onPress={() => addToCart(item.id, item.quantity)}
                  >
                    <Text style={styles.addBtnTxt}>ADD</Text>
                  </TouchableOpacity>
                ) : (
                   <View style={styles.qtyRow}>
                      <TouchableOpacity onPress={() => decreaseQuantity(item.id)} style={styles.qtyBtn}>
                        <Text style={styles.qtyBtnTxt}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.qtyTxt}>{count}</Text>
                      <TouchableOpacity 
                        onPress={() => {
                          if (count >= 3) { // Limit to 3
                             Toast.show({
                               type: "info",
                               text1: "Limit Reached",
                               text2: "You can only select up to 3 units."
                             });
                             return;
                          }
                          addToCart(item.id, item.quantity);
                        }} 
                        style={styles.qtyBtn}
                      >
                        <Text style={styles.qtyBtnTxt}>+</Text>
                      </TouchableOpacity>
                   </View>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    marginHorizontal: 12,
    borderRadius: 12,
    overflow: "hidden",
    minHeight: 160,
    backgroundColor: "#fff0f5",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#880E4F",
  },
  subtitle: {
    fontSize: 10,
    color: "#AD1457",
    marginTop: 1,
    fontWeight: "500",
  },
  seeMoreBtn: {
    paddingVertical: 2,
  },
  seeMoreTxt: {
    fontSize: 10,
    fontWeight: "600",
    color: "#C2185B",
  },
  listContent: {
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: "#fff",
    borderRadius: 8,
    marginRight: 8,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  imageContainer: {
    height: CARD_WIDTH,
    width: "100%",
    position: "relative",
  },
  productImage: {
    width: "100%",
    height: "100%",
  },
  badge: {
    position: "absolute",
    top: 4,
    left: 4,
    backgroundColor: "#F06292",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    flexDirection: "row",
    alignItems: "center",
  },
  badgeTxt: {
    fontSize: 8,
    fontWeight: "700",
    color: "#fff",
  },
  infoContainer: {
    padding: 6,
  },
  productName: {
    fontSize: 10,
    fontWeight: "600",
    color: "#333",
    marginBottom: 2,
    height: 28, 
  },
  vendorName: {
    fontSize: 8,
    color: "#757575",
    marginBottom: 2,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 4,
  },
  finalPrice: {
    fontSize: 11,
    fontWeight: "700",
    color: "#C2185B",
    marginRight: 4,
  },
  oldPrice: {
    fontSize: 9,
    color: "#9E9E9E",
    textDecorationLine: "line-through",
  },
  addBtn: {
    backgroundColor: "#C2185B",
    paddingVertical: 4,
    borderRadius: 4,
    alignItems: "center",
  },
  addBtnTxt: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FCE4EC",
    borderRadius: 4,
  },
  qtyBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  qtyBtnTxt: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#C2185B",
  },
  qtyTxt: {
    fontSize: 10,
    fontWeight: "600",
    color: "#880E4F",
  }
});

export default ValentineSpecialSection;
