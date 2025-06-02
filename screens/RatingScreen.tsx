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
import { SafeAreaView } from "react-native-safe-area-context";
import firestore from "@react-native-firebase/firestore";
import { useRoute, RouteProp, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

type RatingScreenRouteProp = RouteProp<{ RatingScreen: { orderId: string } }, "RatingScreen">;

interface OrderItem {
  productId: string;
  quantity: number;
  price?: number;
  discount?: number;
  name?: string;
  weight?: string;
  CGST?: number; // product-level CGST
  SGST?: number; // product-level SGST
  cess?: number; // product-level CESS
}

interface CompanyInfo {
  name: string;
  FSSAI: string;
  GSTIN: string;
  businessAddress: string;
}

export default function RatingScreen() {
  const navigation = useNavigation();
  const route = useRoute<RatingScreenRouteProp>();
  const { orderId } = route.params;

  // Loading states
  const [loading, setLoading] = useState(true);

  // Fetched order doc
  const [orderDetails, setOrderDetails] = useState<any>(null);

  // Rider
  const [riderName, setRiderName] = useState("Unknown Rider");

  // Product items from order
  const [productItems, setProductItems] = useState<(OrderItem & { image?: string })[]>([]);

  // Company info from the "company" collection
  const [companyData, setCompanyData] = useState<CompanyInfo | null>(null);

  // Recalculated totals
  const [productSubtotal, setProductSubtotal] = useState(0);
  const [productCGST, setProductCGST] = useState(0);
  const [productSGST, setProductSGST] = useState(0);
  const [productCess, setProductCess] = useState(0);

  const [discount, setDiscount] = useState(0);
  const [distance, setDistance] = useState(0);
  const [deliveryCharge, setDeliveryCharge] = useState(0);
  const [rideCGST, setRideCGST] = useState(0);    
  const [rideSGST, setRideSGST] = useState(0);    
  const [platformFee, setPlatformFee] = useState(0);
  const [finalTotal, setFinalTotal] = useState(0);

  // Rating states
  const [showRating, setShowRating] = useState(true);
  const [riderRating, setRiderRating] = useState(0);
  const [orderRating, setOrderRating] = useState(0);
  const [feedback, setFeedback] = useState("");

  // ---------------------------------
  // Fetch order, rider, company data
  // ---------------------------------
  useEffect(() => {
    let isMounted = true;

    async function fetchOrderAndRider() {
      try {
        if (!orderId) {
          Alert.alert("Error", "No order ID was provided.");
          navigation.goBack();
          return;
        }

        // 1) Fetch order doc
        const orderDoc = await firestore().collection("orders").doc(orderId).get();
        if (!orderDoc.exists) {
          Alert.alert("Error", "Order not found.");
          navigation.goBack();
          return;
        }
        const orderData = orderDoc.data();
        if (!orderData) throw new Error("Order data is empty.");

        // If rating was already submitted, hide rating UI
        if (orderData.ratingSubmitted === true) {
          setShowRating(false);
        }

        // 2) Check for assigned rider
        const riderId = orderData.acceptedBy;
        let tempRiderName = "No rider assigned";
        if (riderId) {
          const riderSnap = await firestore().collection("riderDetails").doc(riderId).get();
          if (riderSnap.exists) {
            const rd = riderSnap.data();
            tempRiderName = rd?.name || "Unknown Rider";
          }
        }

        // 3) Build product items (fetch images if needed)
        const rawItems: OrderItem[] = orderData.items || [];
        const resolvedItems: (OrderItem & { image?: string })[] = [];
        for (const it of rawItems) {
          let imgUri = "";
          try {
            const pSnap = await firestore().collection("products").doc(it.productId).get();
            if (pSnap.exists) {
              const pData = pSnap.data() || {};
              imgUri = pData.image || "";
            }
          } catch {}
          resolvedItems.push({ ...it, image: imgUri });
        }

        if (isMounted) {
          setOrderDetails(orderData);
          setRiderName(tempRiderName);
          setProductItems(resolvedItems);
        }
      } catch (err) {
        console.error("RatingScreen fetch error:", err);
        Alert.alert("Error", "Failed to load order details.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    async function fetchCompanyDoc() {
      try {
        const snap = await firestore().collection("company").limit(1).get();
        if (!snap.empty) {
          const doc = snap.docs[0];
          const cData = doc.data() as CompanyInfo;
          setCompanyData(cData);
        }
      } catch (err) {
        console.warn("Error fetching company doc:", err);
      }
    }

    fetchOrderAndRider();
    fetchCompanyDoc();

    return () => {
      isMounted = false;
    };
  }, [orderId, navigation]);

  // ---------------------------------
  // Recompute totals once we have doc & items
  // ---------------------------------
  useEffect(() => {
    if (!orderDetails || productItems.length === 0) return;
    recalcTotals();
  }, [orderDetails, productItems]);

  function recalcTotals() {
    // 1) Sum product-level values
    let sub = 0;
    let pCgst = 0;
    let pSgst = 0;
    let pCess = 0;

    productItems.forEach((item) => {
      const realPrice = (item.price ?? 0) - (item.discount ?? 0);
      sub += realPrice * item.quantity;
      pCgst += (item.CGST ?? 0) * item.quantity;
      pSgst += (item.SGST ?? 0) * item.quantity;
      pCess += (item.cess ?? 0) * item.quantity;
    });

    // 2) Document-level fields (do not round off)
    const docDiscount = orderDetails.discount ?? 0;
    const docDistance = orderDetails.distance ?? 0;
    const docDelivery = orderDetails.deliveryCharge ?? 0;
    const docRideCgst = orderDetails.rideCgst ?? 0;
    const docRideSgst = orderDetails.rideSgst ?? 0;
    const docPlatformFee = orderDetails.platformFee ?? 0;

    // 3) Calculate item total and final total
    let itemTotal = sub - docDiscount;
    if (itemTotal < 0) itemTotal = 0; // prevent negative

    let final =
      itemTotal +
      pCgst +
      pSgst +
      pCess +
      docDelivery +
      docRideCgst +
      docRideSgst +
      docPlatformFee;

    // Update state with exact (decimal) values
    setProductSubtotal(sub);
    setProductCGST(pCgst);
    setProductSGST(pSgst);
    setProductCess(pCess);

    setDiscount(docDiscount);
    setDistance(docDistance);
    setDeliveryCharge(docDelivery);

    setRideCGST(docRideCgst);
    setRideSGST(docRideSgst);
    setPlatformFee(docPlatformFee);

    setFinalTotal(final);
  }

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

  let status = orderDetails.status ?? "N/A";
  if (status === "tripEnded") status = "Delivery Completed";

  const { createdAt } = orderDetails;
  const dateString = createdAt
    ? new Date(createdAt.seconds * 1000).toLocaleString()
    : "N/A";

  function generatePDFContent(): string {
    // 1) Create a "Products Table" with more columns
    let productTableRows = `
      <tr>
        <th style="width:25%">Item</th>
        <th style="width:10%">Qty</th>
        <th style="width:15%">Unit Price</th>
        <th style="width:15%">Discount</th>
        <th style="width:15%">Line Total</th>
      </tr>
    `;

    productItems.forEach((it) => {
      const unitPrice = (it.price ?? 0).toFixed(2);
      const discountAmt = (it.discount ?? 0).toFixed(2);
      const realPrice = (it.price ?? 0) - (it.discount ?? 0);
      const lineTotal = realPrice * it.quantity;
      productTableRows += `
        <tr>
          <td>${it.name || it.productId}${it.weight ? " (" + it.weight + ")" : ""}</td>
          <td>${it.quantity}</td>
          <td>₹${unitPrice}</td>
          <td>₹${discountAmt}</td>
          <td>₹${lineTotal.toFixed(2)}</td>
        </tr>
      `;
    });

    // 2) "Cost Summary" table
    let costSummaryRows = `
      <tr>
        <th style="text-align:left; width:50%">Description</th>
        <th style="text-align:right; width:50%">Amount</th>
      </tr>
    `;
    costSummaryRows += `
      <tr>
        <td>Product Subtotal</td>
        <td style="text-align:right;">₹${productSubtotal.toFixed(2)}</td>
      </tr>
    `;
    if (productCGST > 0) {
      costSummaryRows += `
        <tr>
          <td>Product CGST</td>
          <td style="text-align:right;">₹${productCGST.toFixed(2)}</td>
        </tr>
      `;
    }
    if (productSGST > 0) {
      costSummaryRows += `
        <tr>
          <td>Product SGST</td>
          <td style="text-align:right;">₹${productSGST.toFixed(2)}</td>
        </tr>
      `;
    }
    if (productCess > 0) {
      costSummaryRows += `
        <tr>
          <td>Product CESS</td>
          <td style="text-align:right;">₹${productCess.toFixed(2)}</td>
        </tr>
      `;
    }
    if (discount > 0) {
      costSummaryRows += `
        <tr>
          <td>Discount</td>
          <td style="text-align:right;">-₹${discount.toFixed(2)}</td>
        </tr>
      `;
    }
    if (distance > 0) {
      costSummaryRows += `
        <tr>
          <td>Distance (km)</td>
          <td style="text-align:right;">${distance.toFixed(2)}</td>
        </tr>
      `;
    }
    if (deliveryCharge > 0) {
      costSummaryRows += `
        <tr>
          <td>Delivery Charge</td>
          <td style="text-align:right;">₹${deliveryCharge.toFixed(2)}</td>
        </tr>
      `;
    }
    if (rideCGST > 0) {
      costSummaryRows += `
        <tr>
          <td>Ride CGST</td>
          <td style="text-align:right;">₹${rideCGST.toFixed(2)}</td>
        </tr>
      `;
    }
    if (rideSGST > 0) {
      costSummaryRows += `
        <tr>
          <td>Ride SGST</td>
          <td style="text-align:right;">₹${rideSGST.toFixed(2)}</td>
        </tr>
      `;
    }
    if (platformFee > 0) {
      costSummaryRows += `
        <tr>
          <td>Platform Fee</td>
          <td style="text-align:right;">₹${platformFee.toFixed(2)}</td>
        </tr>
      `;
    }
    costSummaryRows += `
      <tr style="border-top:2px solid #555;">
        <td style="font-weight:bold;">Grand Total</td>
        <td style="text-align:right; font-weight:bold;">₹${finalTotal.toFixed(2)}</td>
      </tr>
    `;

    // 3) Company info
    let companyHTML = "";
    if (companyData) {
      const { name, FSSAI, GSTIN, businessAddress } = companyData;
      companyHTML = `
        <div style="margin-bottom:15px;">
          <h2 style="color:#00C853; margin-bottom:5px;">${name}</h2>
          <p><strong>FSSAI:</strong> ${FSSAI}</p>
          <p><strong>GSTIN:</strong> ${GSTIN}</p>
          <p><strong>Address:</strong> ${businessAddress}</p>
        </div>
      `;
    }

    // 4) Putting it all together
    return `
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          body {
            font-family: Arial, sans-serif;
            color: #333;
            margin: 0;
            padding: 20px;
          }
          h2 {
            color: #00C853;
            margin-bottom: 10px;
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
          }
          .header {
            margin-bottom: 15px;
          }
          .billSection {
            margin-bottom: 20px;
          }
          .summaryContainer {
            margin-top: 10px;
          }
        </style>
      </head>
      <body>

      ${companyHTML}

      <div class="header">
        <h2>Ninja Delivery Bill</h2>
        <p><strong>Date:</strong> ${dateString}</p>
        <p><strong>Rider:</strong> ${riderName}</p>
        <p><strong>Status:</strong> ${status}</p>
      </div>

      <div class="billSection">
        <h3>Products</h3>
        <table>
          ${productTableRows}
        </table>
      </div>

      <div class="billSection summaryContainer">
        <h3>Cost Summary</h3>
        <table>
          ${costSummaryRows}
        </table>
      </div>

      </body>
      </html>
    `;
  }

  async function handleDownloadBill() {
    try {
      const htmlContent = generatePDFContent();
      if (!htmlContent) {
        Alert.alert("Error", "Unable to generate PDF content.");
        return;
      }
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert("Sharing not available", `PDF created at: ${uri}`);
      }
    } catch (err) {
      console.error("Print/Share error:", err);
      Alert.alert("Error", "Failed to create or share PDF.");
    }
  }

  async function handleSubmitRating() {
    try {
      await firestore().collection("orders").doc(orderId).update({
        ratingSubmitted: true,
        riderRating,
        orderRating,
        userFeedback: feedback,
      });
      setShowRating(false);
      Alert.alert("Thank You", "Your rating and feedback have been submitted.");
    } catch (err) {
      console.error("Error submitting rating:", err);
      Alert.alert("Error", "Failed to submit rating.");
    }
  }

  function renderStars(value: number, setValue: (v: number) => void) {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <TouchableOpacity
          key={i}
          onPress={() => setValue(i)}
          style={styles.starTouch}
        >
          <Ionicons
            name={i <= value ? "star" : "star-outline"}
            size={28}
            color="#FFD700"
          />
        </TouchableOpacity>
      );
    }
    return <View style={styles.starsRow}>{stars}</View>;
  }

  function renderProductItem({ item }: { item: OrderItem & { image?: string } }) {
    return (
      <View style={styles.productRow}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.productImage} />
        ) : (
          <Ionicons
            name="image-outline"
            size={40}
            color="#ccc"
            style={styles.productImage}
          />
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
  }

  // UI
  return (
    <SafeAreaView style={styles.safeArea}>
    
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
              keyExtractor={(it, idx) => `${it.productId}-${idx}`}
              renderItem={renderProductItem}
              style={styles.productList}
              scrollEnabled={false}
            />
          )}

          {/* SUMMARY of taxes & total */}
          <View style={styles.summaryRowTop}>
            <Text style={styles.summaryLabel}>Product Subtotal</Text>
            <Text style={styles.summaryValue}>₹{productSubtotal.toFixed(2)}</Text>
          </View>

          {productCGST > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Product CGST</Text>
              <Text style={styles.summaryValue}>₹{productCGST.toFixed(2)}</Text>
            </View>
          )}
          {productSGST > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Product SGST</Text>
              <Text style={styles.summaryValue}>₹{productSGST.toFixed(2)}</Text>
            </View>
          )}
          {productCess > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Product CESS</Text>
              <Text style={styles.summaryValue}>₹{productCess.toFixed(2)}</Text>
            </View>
          )}

          {discount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Discount</Text>
              <Text style={styles.discountValue}>-₹{discount.toFixed(2)}</Text>
            </View>
          )}

          {distance > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Distance (km)</Text>
              <Text style={styles.summaryValue}>{distance.toFixed(2)}</Text>
            </View>
          )}

          {deliveryCharge !== 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Delivery Charge</Text>
              <Text style={styles.summaryValue}>₹{deliveryCharge.toFixed(2)}</Text>
            </View>
          )}

          {rideCGST > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Ride CGST</Text>
              <Text style={styles.summaryValue}>₹{rideCGST.toFixed(2)}</Text>
            </View>
          )}
          {rideSGST > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Ride SGST</Text>
              <Text style={styles.summaryValue}>₹{rideSGST.toFixed(2)}</Text>
            </View>
          )}

          {platformFee !== 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Platform Fee</Text>
              <Text style={styles.summaryValue}>₹{platformFee.toFixed(2)}</Text>
            </View>
          )}

          <View style={styles.summaryRowTotal}>
            <Text style={styles.summaryLabelTotal}>Grand Total</Text>
            <Text style={styles.summaryValueTotal}>₹{finalTotal.toFixed(2)}</Text>
          </View>

          <TouchableOpacity style={styles.downloadButton} onPress={handleDownloadBill}>
            <Ionicons name="download-outline" size={18} color="#fff" style={{ marginRight: 4 }} />
            <Text style={styles.downloadButtonText}>Download Bill (PDF)</Text>
          </TouchableOpacity>
        </View>

        {/* RATING UI */}
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

            <TouchableOpacity style={styles.submitRatingButton} onPress={handleSubmitRating}>
              <Text style={styles.submitRatingText}>Submit Rating</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* HELP BUTTON */}
      <TouchableOpacity style={styles.helpButton} onPress={() => navigation.navigate("ContactUs")}>
        <Ionicons name="help-circle" size={26} color="#FFFFFF" style={{ marginRight: 4 }} />
        <Text style={styles.helpBtnText}>Need Help?</Text>
      </TouchableOpacity>
    </View>
    </SafeAreaView>
  );
}

// ---------------------------------
// STYLES
// ---------------------------------
const BRAND_GREEN = "#00C853";
const PRIMARY_TEXT = "#333";
const SECONDARY_TEXT = "#666";
const BACKGROUND_COLOR = "#F2F2F2";
const CARD_BACKGROUND = "#FFF";

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f2f2f2",
  },
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

  // Summary Rows
  summaryRowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#DDD",
    paddingTop: 10,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  summaryRowTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#ccc",
    paddingTop: 8,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
  },
  summaryLabelTotal: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000",
  },
  summaryValueTotal: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000",
  },
  discountValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#e74c3c",
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

  // Help button
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

