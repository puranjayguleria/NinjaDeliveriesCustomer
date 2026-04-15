import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import firestore from '@react-native-firebase/firestore';
import { Image } from 'expo-image';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const ORANGE = '#FC8019';
const DARK   = '#282C3F';
const GRAY   = '#93959F';
const GREEN  = '#3d9b6d';

export default function FoodOrderBillScreen() {
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();
  const insets     = useSafeAreaInsets();
  const { orderId } = route.params ?? {};

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [pdfUri, setPdfUri] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    firestore().collection('restaurant_Orders').doc(orderId).get()
      .then(doc => { if (doc.exists) setOrder({ id: doc.id, ...doc.data() }); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [orderId]);

  const handleDownloadBill = async () => {
    if (!order) return;
    setDownloading(true);
    try {
      const shortId = (order.orderId ?? order.id).slice(-8).toUpperCase();
      const dateStr = order.createdAt?.toDate?.()?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) ?? '';
      const timeStr = order.createdAt?.toDate?.()?.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) ?? '';

      const itemsHtml = (order.items ?? []).map((item: any, i: number) => `
        <tr style="background:${i % 2 === 0 ? '#fff' : '#fafafa'};">
          <td style="padding:10px 12px;">
            <div style="font-weight:600;font-size:13px;color:#282C3F;">${item.name}</div>
            ${item.variant ? `<div style="font-size:11px;color:#93959F;margin-top:2px;">${item.variant}</div>` : ''}
            ${(item.addons ?? []).map((a: any) => `<div style="font-size:11px;color:#FC8019;margin-top:1px;">+ ${a.name} · ₹${a.price}</div>`).join('')}
          </td>
          <td style="padding:10px 12px;text-align:center;font-size:13px;color:#93959F;">×${item.qty}</td>
          <td style="padding:10px 12px;text-align:right;font-size:13px;font-weight:700;color:#282C3F;">₹${item.price * item.qty}</td>
        </tr>
      `).join('');

      const html = `
        <!DOCTYPE html>
        <html><head><meta charset="utf-8"/>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background: #f4f6f9; color: #282C3F; padding: 30px 20px; }
          .page { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.10); }

          /* Header */
          .header { background: linear-gradient(135deg, #FC8019 0%, #e86c00 100%); padding: 32px 28px 24px; }
          .header-top { display: flex; justify-content: space-between; align-items: flex-start; }
          .brand { color: #fff; }
          .brand-name { font-size: 22px; font-weight: 800; letter-spacing: 0.5px; }
          .brand-sub { font-size: 12px; opacity: 0.85; margin-top: 2px; }
          .invoice-label { background: rgba(255,255,255,0.2); color: #fff; padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; letter-spacing: 1px; }
          .header-bottom { margin-top: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
          .restaurant-name { color: #fff; font-size: 16px; font-weight: 700; }
          .order-meta { text-align: right; color: rgba(255,255,255,0.9); font-size: 12px; line-height: 1.6; }

          /* Status Banner */
          .status-banner { background: #f0fdf4; border-left: 4px solid #3d9b6d; margin: 20px 28px; padding: 12px 16px; border-radius: 0 8px 8px 0; display: flex; align-items: center; gap: 10px; }
          .status-dot { width: 10px; height: 10px; background: #3d9b6d; border-radius: 50%; flex-shrink: 0; }
          .status-text { font-size: 13px; font-weight: 700; color: #3d9b6d; }

          /* Section */
          .section { margin: 0 28px 20px; }
          .section-title { font-size: 11px; font-weight: 700; color: #93959F; letter-spacing: 1.2px; text-transform: uppercase; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 2px solid #f0f0f0; }

          /* Items Table */
          table { width: 100%; border-collapse: collapse; border-radius: 10px; overflow: hidden; border: 1px solid #f0f0f0; }
          thead tr { background: #fff8f3; }
          thead th { padding: 10px 12px; font-size: 11px; font-weight: 700; color: #FC8019; letter-spacing: 0.8px; text-transform: uppercase; }
          thead th:last-child { text-align: right; }
          thead th:nth-child(2) { text-align: center; }

          /* Bill Summary */
          .bill-box { background: #fafafa; border: 1px solid #f0f0f0; border-radius: 10px; overflow: hidden; }
          .bill-row { display: flex; justify-content: space-between; padding: 9px 16px; font-size: 13px; border-bottom: 1px solid #f0f0f0; }
          .bill-row:last-child { border-bottom: none; }
          .bill-label { color: #93959F; }
          .bill-value { font-weight: 600; color: #282C3F; }
          .bill-free { font-weight: 600; color: #3d9b6d; }
          .bill-total-row { display: flex; justify-content: space-between; padding: 14px 16px; background: #fff8f3; border-top: 2px solid #FC8019; }
          .bill-total-label { font-size: 15px; font-weight: 800; color: #282C3F; }
          .bill-total-value { font-size: 17px; font-weight: 800; color: #FC8019; }

          /* Payment */
          .payment-badge { display: inline-flex; align-items: center; gap: 6px; background: #f1f5f9; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; color: #475569; }

          /* Address */
          .address-box { background: #fafafa; border: 1px solid #f0f0f0; border-radius: 10px; padding: 12px 16px; font-size: 13px; color: #555; line-height: 1.6; }

          /* Footer */
          .footer { background: #282C3F; padding: 18px 28px; text-align: center; }
          .footer-text { color: rgba(255,255,255,0.6); font-size: 11px; line-height: 1.8; }
          .footer-brand { color: #FC8019; font-weight: 700; font-size: 13px; }
        </style>
        </head>
        <body>
        <div class="page">

          <!-- Header -->
          <div class="header">
            <div class="header-top">
              <div class="brand">
                <div class="brand-name">🍴 NinjaFood</div>
                <div class="brand-sub">Fast Food Delivery</div>
              </div>
              <div class="invoice-label">INVOICE</div>
            </div>
            <div class="header-bottom">
              <div class="restaurant-name">${order.restaurantName ?? ''}</div>
              <div class="order-meta">
                <div>#${shortId}</div>
                <div>${dateStr}</div>
                <div>${timeStr}</div>
              </div>
            </div>
          </div>

          <!-- Status -->
          <div class="status-banner">
            <div class="status-dot"></div>
            <div class="status-text">Order Completed Successfully</div>
          </div>

          <!-- Items -->
          <div class="section">
            <div class="section-title">Items Ordered</div>
            <table>
              <thead>
                <tr>
                  <th style="text-align:left;">Item</th>
                  <th>Qty</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>${itemsHtml}</tbody>
            </table>
          </div>

          <!-- Bill Summary -->
          <div class="section">
            <div class="section-title">Bill Summary</div>
            <div class="bill-box">
              <div class="bill-row"><span class="bill-label">Item Total</span><span class="bill-value">₹${order.subtotal}</span></div>
              <div class="bill-row"><span class="bill-label">Delivery Fee</span><span class="${order.deliveryFee === 0 ? 'bill-free' : 'bill-value'}">${order.deliveryFee === 0 ? 'FREE' : `₹${order.deliveryFee}`}</span></div>
              <div class="bill-row"><span class="bill-label">Taxes & Charges</span><span class="bill-value">₹${order.taxes}</span></div>
              <div class="bill-total-row"><span class="bill-total-label">Total Paid</span><span class="bill-total-value">₹${order.grandTotal}</span></div>
            </div>
          </div>

          <!-- Payment -->
          <div class="section">
            <div class="section-title">Payment</div>
            <div class="payment-badge">💳 ${order.paymentMethod}</div>
          </div>

          ${order.deliveryAddress ? `
          <!-- Address -->
          <div class="section">
            <div class="section-title">Delivered To</div>
            <div class="address-box">📍 ${order.deliveryAddress}</div>
          </div>` : ''}

          <!-- Footer -->
          <div class="footer">
            <div class="footer-brand">NinjaFood</div>
            <div class="footer-text">Thank you for your order!<br/>For support, contact us at support@ninjafood.in</div>
          </div>

        </div>
        </body></html>
      `;

      const { uri: tempUri } = await Print.printToFileAsync({ html, base64: false });
      const fileName = `NinjaFood_Bill_${shortId}.pdf`;
      const destUri = (FileSystem.documentDirectory ?? '') + fileName;
      await FileSystem.copyAsync({ from: tempUri, to: destUri });
      setPdfUri(destUri);
      setShowSuccessModal(true);
    } catch {
      Alert.alert('Error', 'Could not generate bill. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return (
    <View style={s.loader}>
      <ActivityIndicator size="large" color={ORANGE} />
    </View>
  );

  if (!order) return (
    <View style={s.loader}>
      <Text style={{ color: GRAY }}>Order not found</Text>
    </View>
  );

  const createdDate = order.createdAt?.toDate?.()?.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  }) ?? '';
  const createdTime = order.createdAt?.toDate?.()?.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  }) ?? '';

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color={DARK} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Order Bill</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* Completed Banner */}
        <View style={s.completedBanner}>
          <View style={s.completedIconCircle}>
            <Ionicons name="checkmark-circle" size={36} color={GREEN} />
          </View>
          <Text style={s.completedTitle}>Order Completed</Text>
          <Text style={s.completedSub}>{order.restaurantName}</Text>
          <Text style={s.completedDate}>{createdDate} · {createdTime}</Text>
          <View style={s.orderIdBadge}>
            <Text style={s.orderIdText}>#{(order.orderId ?? order.id).slice(-8).toUpperCase()}</Text>
          </View>
        </View>

        {/* Items Card */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Ionicons name="restaurant" size={14} color={ORANGE} />
            <Text style={s.cardTitle}>Items Ordered</Text>
          </View>
          {(order.items ?? []).map((item: any, idx: number) => (
            <View key={idx}>
              {idx > 0 && <View style={s.divider} />}
              <View style={s.itemRow}>
                {item.image ? (
                  <Image source={{ uri: item.image }} style={s.itemImg} contentFit="cover" />
                ) : (
                  <View style={[s.itemImg, s.itemImgPlaceholder]}>
                    <Ionicons name="fast-food-outline" size={15} color={ORANGE} />
                  </View>
                )}
                <View style={s.itemInfo}>
                  <Text style={s.itemName}>{item.name}</Text>
                  {!!item.variant && <Text style={s.itemVariant}>{item.variant}</Text>}
                  {!!item.description && <Text style={s.itemDesc} numberOfLines={1}>{item.description}</Text>}
                  {(item.addons ?? []).map((a: any, ai: number) => (
                    <Text key={ai} style={s.addonText}>+ {a.name} · ₹{a.price}</Text>
                  ))}
                </View>
                <View style={s.itemPriceCol}>
                  <Text style={s.itemQty}>×{item.qty}</Text>
                  <Text style={s.itemPrice}>₹{item.price * item.qty}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Bill Card */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Ionicons name="receipt-outline" size={14} color={ORANGE} />
            <Text style={s.cardTitle}>Bill Details</Text>
          </View>
          <View style={s.billRow}>
            <Text style={s.billLabel}>Item Total</Text>
            <Text style={s.billValue}>₹{order.subtotal}</Text>
          </View>
          <View style={s.billRow}>
            <Text style={s.billLabel}>Delivery Fee</Text>
            <Text style={[s.billValue, order.deliveryFee === 0 && { color: GREEN }]}>
              {order.deliveryFee === 0 ? 'FREE' : `₹${order.deliveryFee}`}
            </Text>
          </View>
          <View style={s.billRow}>
            <Text style={s.billLabel}>Taxes & Charges</Text>
            <Text style={s.billValue}>₹{order.taxes}</Text>
          </View>
          <View style={s.billDivider} />
          <View style={s.billRow}>
            <Text style={s.billTotalLabel}>Total Paid</Text>
            <Text style={s.billTotalValue}>₹{order.grandTotal}</Text>
          </View>
          <View style={[s.billRow, { marginTop: 4 }]}>
            <Text style={s.billLabel}>Payment Method</Text>
            <Text style={s.billValue}>{order.paymentMethod}</Text>
          </View>
        </View>

        {/* Delivery Address */}
        {!!order.deliveryAddress && (
          <View style={s.card}>
            <View style={s.cardHeader}>
              <Ionicons name="location-outline" size={14} color={ORANGE} />
              <Text style={s.cardTitle}>Delivered To</Text>
            </View>
            <Text style={s.addressText}>{order.deliveryAddress}</Text>
          </View>
        )}

        {/* Buttons */}
        <View style={s.btnRow}>
          <TouchableOpacity style={s.backBtn2} onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <Ionicons name="arrow-back" size={18} color={ORANGE} />
            <Text style={s.backBtnText}>Go Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.downloadBtn, downloading && { opacity: 0.7 }]}
            onPress={handleDownloadBill}
            activeOpacity={0.85}
            disabled={downloading}
          >
            {downloading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="download-outline" size={18} color="#fff" />
            }
            <Text style={s.downloadBtnText}>{downloading ? 'Generating…' : 'Download Bill'}</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Success Modal */}
      <Modal visible={showSuccessModal} transparent animationType="fade" onRequestClose={() => setShowSuccessModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <View style={s.modalIconCircle}>
              <Ionicons name="checkmark-circle" size={52} color={GREEN} />
            </View>
            <Text style={s.modalTitle}>Bill Ready!</Text>
            <Text style={s.modalSub}>Your bill has been generated. Save it to your device or share it.</Text>
            <TouchableOpacity
              style={s.modalBtn}
              activeOpacity={0.85}
              onPress={async () => {
                if (pdfUri && await Sharing.isAvailableAsync()) {
                  await Sharing.shareAsync(pdfUri, {
                    mimeType: 'application/pdf',
                    UTI: 'com.adobe.pdf',
                    dialogTitle: `NinjaFood_Bill_${(order.orderId ?? order.id).slice(-8).toUpperCase()}.pdf`,
                  });
                }
              }}
            >
              <Ionicons name="share-outline" size={18} color="#fff" />
              <Text style={s.modalBtnText}>Save / Share</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowSuccessModal(false)} style={{ marginTop: 12 }}>
              <Text style={{ color: GRAY, fontSize: 13 }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#f8f9fa' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0', elevation: 2,
  },
  backBtn:     { width: 40 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: DARK },

  completedBanner: {
    backgroundColor: '#fff', margin: 10, marginTop: 20, borderRadius: 14, padding: 14,
    alignItems: 'center',
    elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8,
  },
  completedIconCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#f0fdf4', justifyContent: 'center', alignItems: 'center', marginBottom: 6,
  },
  completedTitle: { fontSize: 15, fontWeight: '800', color: DARK, marginBottom: 2 },
  completedSub:   { fontSize: 12, color: GRAY, marginBottom: 2 },
  completedDate:  { fontSize: 11, color: GRAY },
  orderIdBadge:   { marginTop: 6, backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  orderIdText:    { fontSize: 11, fontWeight: '700', color: '#475569', letterSpacing: 1 },

  card: {
    backgroundColor: '#fff', marginHorizontal: 10, marginTop: 8,
    borderRadius: 12, padding: 12,
    elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 8, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  cardTitle: { fontSize: 12, fontWeight: '700', color: DARK },

  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 6 },

  itemRow:            { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  itemImg:            { width: 40, height: 40, borderRadius: 8 },
  itemImgPlaceholder: { backgroundColor: '#fff5f0', justifyContent: 'center', alignItems: 'center' },
  itemInfo:           { flex: 1 },
  itemName:           { fontSize: 12, fontWeight: '600', color: DARK },
  itemVariant:        { fontSize: 10, color: GRAY, marginTop: 1 },
  itemDesc:           { fontSize: 10, color: GRAY, marginTop: 1 },
  addonText:          { fontSize: 10, color: ORANGE, marginTop: 1 },
  itemPriceCol:       { alignItems: 'flex-end' },
  itemQty:            { fontSize: 11, color: GRAY },
  itemPrice:          { fontSize: 12, fontWeight: '700', color: DARK, marginTop: 2 },

  billRow:        { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  billLabel:      { fontSize: 12, color: GRAY },
  billValue:      { fontSize: 12, fontWeight: '600', color: DARK },
  billDivider:    { height: 1, backgroundColor: '#f0f0f0', marginVertical: 6 },
  billTotalLabel: { fontSize: 13, fontWeight: '700', color: DARK },
  billTotalValue: { fontSize: 14, fontWeight: '800', color: ORANGE },

  addressText: { fontSize: 12, color: GRAY, lineHeight: 18 },

  btnRow: {
    flexDirection: 'row', gap: 10,
    marginHorizontal: 10, marginTop: 14,
  },
  backBtn2: {
    flex: 1, borderWidth: 1.5, borderColor: ORANGE,
    borderRadius: 12, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  backBtnText: { color: ORANGE, fontSize: 13, fontWeight: '700' },

  downloadBtn: {
    flex: 1.4, backgroundColor: ORANGE,
    borderRadius: 12, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    elevation: 4, shadowColor: ORANGE, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6,
  },
  downloadBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 32,
  },
  modalBox: {
    backgroundColor: '#fff', borderRadius: 20, padding: 28,
    alignItems: 'center', width: '100%',
    elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 16,
  },
  modalIconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#f0fdf4', justifyContent: 'center', alignItems: 'center', marginBottom: 14,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: DARK, marginBottom: 6 },
  modalSub:   { fontSize: 13, color: GRAY, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  modalBtn: {
    backgroundColor: ORANGE, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 40,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    elevation: 3, shadowColor: ORANGE, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6,
  },
  modalBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
