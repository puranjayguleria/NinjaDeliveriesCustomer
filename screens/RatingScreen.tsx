// RatingScreen.tsx

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Alert,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  FlatList,
  ScrollView,
  TextInput,
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import { useRoute, RouteProp, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

// We use Expo Print + Sharing
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

type RatingScreenRouteProp = RouteProp<{ RatingScreen: { orderId: string } }, "RatingScreen">;

interface OrderItem {
  productId: string;
  quantity: number;
  price?: string;
  discount?: string;
  name?: string;
  weight?: string; // e.g. "1 KG" or "500 GM"
}

// COLOR CONSTANTS
const BRAND_GREEN = "#00C853";
const PRIMARY_TEXT = "#333";
const SECONDARY_TEXT = "#666";
const STAR_COLOR = "#FFD700"; // gold for stars
const BACKGROUND_COLOR = "#F2F2F2";
const CARD_BACKGROUND = "#FFF";

const RatingScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RatingScreenRouteProp>();
  const { orderId } = route.params;

  const [loading, setLoading] = useState(true);
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [riderName, setRiderName] = useState("Unknown Rider");
  const [productItems, setProductItems] = useState<(OrderItem & { image?: string })[]>([]);

  // RATING states
  const [showRating, setShowRating] = useState<boolean>(true);
  const [riderRating, setRiderRating] = useState<number>(0);
  const [orderRating, setOrderRating] = useState<number>(0);
  const [feedback, setFeedback] = useState<string>("");

  useEffect(() => {
    let isMounted = true;
    const fetchOrderAndRider = async () => {
      try {
        if (!orderId) {
          Alert.alert("Error", "No order ID was provided.");
          navigation.goBack();
          return;
        }
        // 1) Fetch order
        const orderDoc = await firestore().collection("orders").doc(orderId).get();
        if (!orderDoc.exists) {
          Alert.alert("Error", "Order not found.");
          navigation.goBack();
          return;
        }
        const orderData = orderDoc.data();
        if (!orderData) throw new Error("Order data is empty.");

        // If rating already submitted, hide rating UI
        if (orderData.ratingSubmitted === true) {
          setShowRating(false);
        }

        // Check rider
        const riderId = orderData?.acceptedBy;
        let tempRiderName = "No rider assigned";
        if (riderId) {
          const riderDoc = await firestore().collection("riderDetails").doc(riderId).get();
          if (riderDoc.exists) {
            const rd = riderDoc.data();
            tempRiderName = rd?.name || "Unknown Rider";
          }
        }

        // Items => fetch product images
        const items: OrderItem[] = orderData.items || [];
        const updatedItems: (OrderItem & { image?: string })[] = [];
        for (const item of items) {
          let productImage = "";
          try {
            const productDoc = await firestore()
              .collection("products")
              .doc(item.productId)
              .get();
            if (productDoc.exists) {
              const pData = productDoc.data() || {};
              productImage = pData.image || "";
            }
          } catch (err) {
            console.warn("Could not fetch product doc:", item.productId, err);
          }
          updatedItems.push({ ...item, image: productImage });
        }

        if (isMounted) {
          setOrderDetails(orderData);
          setRiderName(tempRiderName);
          setProductItems(updatedItems);
        }
      } catch (err) {
        console.error("RatingScreen fetch error:", err);
        Alert.alert("Error", "Failed to load order.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchOrderAndRider();
    return () => {
      isMounted = false;
    };
  }, [orderId, navigation]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BRAND_GREEN} />
        <Text style={styles.loadingText}>Loading order details...</Text>
      </View>
    );
  }

  if (!orderDetails) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ color: "red" }}>Order details not available.</Text>
      </View>
    );
  }

  // COSTS
  const deliveryCharge = orderDetails.deliveryCharge ?? 0;
  const discount = orderDetails.discount ?? 0;
  const cgst = orderDetails.cgst ?? 0;
  const sgst = orderDetails.sgst ?? 0;
  const platformFee = orderDetails.platformFee ?? 0;
  const finalTotal = orderDetails.finalTotal ?? 0;

  let status = orderDetails.status ?? "N/A";
  if (status === "tripEnded") {
    status = "Delivery Completed";
  }

  const { createdAt } = orderDetails;
  const dateString = createdAt
    ? new Date(createdAt.seconds * 1000).toLocaleString()
    : "N/A";

  // We'll generate some HTML for printing
  const generatePDFContent = (): string => {
    // Construct items table
    let itemsTableRows = "";
    productItems.forEach((item) => {
      itemsTableRows += `
        <tr>
          <td>${item.name || item.productId}</td>
          <td>${item.quantity}${item.weight ? " (" + item.weight + ")" : ""}</td>
        </tr>
      `;
    });

    const discountRow = discount > 0 ? `<p>Discount: -₹${discount}</p>` : "";
    const cgstRow = cgst > 0 ? `<p>CGST: ₹${cgst.toFixed(2)}</p>` : "";
    const sgstRow = sgst > 0 ? `<p>SGST: ₹${sgst.toFixed(2)}</p>` : "";

    return `
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          body { font-family: Arial, sans-serif; color: #333; margin: 0; padding: 20px; }
          h2 { color: #00C853; margin-bottom: 10px; }
          .header, .summary {
            margin-bottom: 20px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          td, th {
            border: 1px solid #ccc;
            padding: 6px;
            text-align: left;
            white-space: nowrap;
          }
          .summary p {
            margin: 4px 0;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>Ninja Delivery Bill</h2>
          <p><strong>Date:</strong> ${dateString}</p>
          <p><strong>Rider:</strong> ${riderName}</p>
          <p><strong>Status:</strong> ${status}</p>
        </div>

        <h3>Products</h3>
        <table>
          <tr>
            <th>Item</th>
            <th>Qty</th>
          </tr>
          ${itemsTableRows}
        </table>

        <div class="summary">
          <p><strong>Total:</strong> ₹${finalTotal.toFixed(2)}</p>
          <p>Delivery: ₹${deliveryCharge.toFixed(2)}</p>
          <p>Platform Fee: ₹${platformFee.toFixed(2)}</p>
          ${discountRow}
          ${cgstRow}
          ${sgstRow}
        </div>
      </body>
      </html>
    `;
  };

  // We use expo-print + expo-sharing
  const handleDownloadBill = async () => {
    try {
      const htmlContent = generatePDFContent();
      if (!htmlContent) {
        Alert.alert("Error", "Unable to generate PDF content.");
        return;
      }
      // Generate PDF
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      // Now share that PDF
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert("Sharing not available", `PDF generated at: ${uri}`);
      }
    } catch (err) {
      console.error("Print or sharing error:", err);
      Alert.alert("Error", "Failed to create or share PDF.");
    }
  };

  // Rating submission
  const handleSubmitRating = async () => {
    try {
      await firestore().collection("orders").doc(orderId).update({
        ratingSubmitted: true,
        riderRating,
        orderRating,
        userFeedback: feedback,
      });
      setShowRating(false);
      Alert.alert("Thank You", "Your rating and feedback have been submitted.");
    } catch (error) {
      console.error("Error submitting rating:", error);
      Alert.alert("Error", "Failed to submit rating.");
    }
  };

  // Render star row
  const renderStars = (currentValue: number, setValue: (val: number) => void) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <TouchableOpacity
          key={i}
          onPress={() => setValue(i)}
          style={styles.starTouch}
        >
          <Ionicons
            name={i <= currentValue ? "star" : "star-outline"}
            size={28}
            color={STAR_COLOR}
          />
        </TouchableOpacity>
      );
    }
    return <View style={styles.starsRow}>{stars}</View>;
  };

  // Single product row
  const renderProductItem = ({ item }: { item: OrderItem & { image?: string } }) => (
    <View style={styles.productRow}>
      {item.image ? (
        <Image source={{ uri: item.image }} style={styles.productImage} />
      ) : (
        <Ionicons name="image-outline" size={40} color="#ccc" style={styles.productImage} />
      )}
      <View style={styles.productInfo}>
        <Text style={styles.productName}>
          {item.name || item.productId}
          {item.weight ? ` (${item.weight})` : ""}
        </Text>
        <Text style={styles.productQty}>Qty: {item.quantity}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* BILL CARD */}
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Order Bill</Text>
            {orderDetails.status === "tripEnded" && (
              <Ionicons name="checkmark-circle" size={36} color={BRAND_GREEN} />
            )}
          </View>

          {/* Rider / Status / Date */}
          <View style={styles.billInfoRow}>
            <Text style={styles.billInfoLabel}>Rider:</Text>
            <Text style={styles.billInfoValue}>{riderName}</Text>
          </View>
          <View style={styles.billInfoRow}>
            <Text style={styles.billInfoLabel}>Status:</Text>
            <Text style={styles.billInfoValue}>{status}</Text>
          </View>
          <View style={[styles.billInfoRow, { marginBottom: 12 }]}>
            <Text style={styles.billInfoLabel}>Date:</Text>
            <Text style={styles.billInfoValue}>{dateString}</Text>
          </View>

          {/* Products */}
          <Text style={styles.sectionTitle}>Products</Text>
          {productItems.length === 0 ? (
            <Text style={styles.emptyProducts}>No products found.</Text>
          ) : (
            <FlatList
              data={productItems}
              keyExtractor={(item, idx) => `${item.productId}-${idx}`}
              renderItem={renderProductItem}
              style={styles.productList}
              scrollEnabled={false}
            />
          )}

          {/* COSTS */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>₹{finalTotal.toFixed(2)}</Text>
          </View>
          <View style={styles.costRow}>
            <Text style={styles.costLabel}>Delivery</Text>
            <Text style={styles.costValue}>₹{deliveryCharge.toFixed(2)}</Text>
          </View>
          <View style={styles.costRow}>
            <Text style={styles.costLabel}>Platform Fee</Text>
            <Text style={styles.costValue}>₹{platformFee.toFixed(2)}</Text>
          </View>
          {!!discount && discount > 0 && (
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Discount</Text>
              <Text style={styles.costValue}>-₹{discount}</Text>
            </View>
          )}
          {!!cgst && cgst > 0 && (
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>CGST</Text>
              <Text style={styles.costValue}>₹{cgst.toFixed(2)}</Text>
            </View>
          )}
          {!!sgst && sgst > 0 && (
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>SGST</Text>
              <Text style={styles.costValue}>₹{sgst.toFixed(2)}</Text>
            </View>
          )}

          {/* Download Bill => Using expo-print + expo-sharing */}
          <TouchableOpacity style={styles.downloadButton} onPress={handleDownloadBill}>
            <Ionicons name="download-outline" size={18} color="#fff" style={{ marginRight: 4 }} />
            <Text style={styles.downloadButtonText}>Download Bill (PDF)</Text>
          </TouchableOpacity>
        </View>

        {/* RATING UI (stars) */}
        {showRating && (
          <View style={styles.ratingCard}>
            <Text style={styles.ratingHeader}>Rate Your Experience</Text>

            {/* Rider Rating */}
            <Text style={styles.starsLabel}>Rider Rating</Text>
            {renderStars(riderRating, setRiderRating)}

            {/* Order Rating */}
            <Text style={[styles.starsLabel, { marginTop: 14 }]}>Order Rating</Text>
            {renderStars(orderRating, setOrderRating)}

            {/* Feedback */}
            <Text style={[styles.starsLabel, { marginTop: 14 }]}>Your Feedback</Text>
            <TextInput
              style={styles.feedbackInput}
              placeholder="Share your thoughts..."
              multiline
              numberOfLines={4}
              value={feedback}
              onChangeText={setFeedback}
            />

            {/* Submit */}
            <TouchableOpacity style={styles.submitRatingButton} onPress={handleSubmitRating}>
              <Text style={styles.submitRatingText}>Submit Rating</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>

      {/* HELP BUTTON */}
      <TouchableOpacity
        style={styles.helpButton}
        onPress={() => navigation.navigate("ContactUs")}
      >
        <Ionicons name="help-circle" size={26} color="#FFFFFF" style={{ marginRight: 4 }} />
        <Text style={styles.helpBtnText}>Need Help?</Text>
      </TouchableOpacity>
    </View>
  );
};

export default RatingScreen;

// ============================= STYLES ============================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  scrollContent: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
  },

  loadingContainer: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: PRIMARY_TEXT,
  },

  // Bill Card
  card: {
    width: "95%",
    maxWidth: 700,
    backgroundColor: CARD_BACKGROUND,
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#AAA",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: PRIMARY_TEXT,
  },
  billInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 2,
  },
  billInfoLabel: {
    fontSize: 14,
    color: SECONDARY_TEXT,
  },
  billInfoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: PRIMARY_TEXT,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: PRIMARY_TEXT,
    marginTop: 8,
    marginBottom: 4,
  },
  emptyProducts: {
    fontSize: 14,
    color: SECONDARY_TEXT,
    marginTop: 6,
  },
  productList: {
    marginTop: 6,
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAFAFA",
    padding: 8,
    borderRadius: 6,
    marginBottom: 10,
  },
  productImage: {
    width: 50,
    height: 50,
    borderRadius: 6,
    marginRight: 10,
    backgroundColor: "#eee",
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: "600",
    color: PRIMARY_TEXT,
    marginBottom: 2,
  },
  productQty: {
    fontSize: 12,
    color: SECONDARY_TEXT,
  },

  // Costs
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#DDD",
    paddingTop: 10,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: PRIMARY_TEXT,
  },
  totalValue: {
    fontSize: 17,
    fontWeight: "700",
    color: BRAND_GREEN,
  },
  costRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  costLabel: {
    fontSize: 14,
    color: SECONDARY_TEXT,
  },
  costValue: {
    fontSize: 14,
    color: PRIMARY_TEXT,
  },

  downloadButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BRAND_GREEN,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 14,
    alignSelf: "flex-start",
  },
  downloadButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },

  // Rating UI
  ratingCard: {
    width: "95%",
    maxWidth: 700,
    backgroundColor: CARD_BACKGROUND,
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#AAA",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  ratingHeader: {
    fontSize: 18,
    fontWeight: "700",
    color: PRIMARY_TEXT,
    marginBottom: 10,
    textAlign: "center",
  },
  starsLabel: {
    fontSize: 14,
    color: SECONDARY_TEXT,
    marginBottom: 4,
  },
  starsRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  starTouch: {
    marginRight: 8,
  },
  feedbackInput: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 4,
    padding: 8,
    marginTop: 4,
    textAlignVertical: "top",
  },
  submitRatingButton: {
    backgroundColor: BRAND_GREEN,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 14,
    alignSelf: "flex-end",
  },
  submitRatingText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },

  // Help
  helpButton: {
    flexDirection: "row",
    position: "absolute",
    bottom: 250,
    right: 20,
    backgroundColor: BRAND_GREEN,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center",
    elevation: 4,
  },
  helpBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
