import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  StatusBar,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useServiceCart, ServiceCartItem } from "../context/ServiceCartContext";
import { getBestActiveQuantityOffer } from "../utils/serviceQuantityOffers";

export default function ServiceCartScreen() {
  const navigation = useNavigation<any>();
  const { state, removeService, updateService, clearCart, totalItems, hasServices } = useServiceCart();

  React.useEffect(() => {
    if (!__DEV__) return;
    try {
      const items = Object.values(state.items || {});
      console.log('🧪 [ServiceCartScreen] items debug', items.map((it: any) => ({
        id: it?.id,
        serviceTitle: it?.serviceTitle,
        selectedDate: it?.selectedDate,
        selectedTime: it?.selectedTime,
        quantity: it?.quantity,
        hasQuantityOffers: Array.isArray(it?.additionalInfo?.quantityOffers) && it.additionalInfo.quantityOffers.length > 0,
        appliedOffer: it?.additionalInfo?.appliedQuantityOffer ? {
          discountType: it.additionalInfo.appliedQuantityOffer.discountType,
          minQuantity: it.additionalInfo.appliedQuantityOffer.minQuantity,
          discountValue: it.additionalInfo.appliedQuantityOffer.discountValue,
          newPricePerUnit: it.additionalInfo.appliedQuantityOffer.newPricePerUnit,
          message: it.additionalInfo.appliedQuantityOffer.message,
        } : null,
        startSlot: it?.additionalInfo?.startSlot || null,
        selectedSlotsCount: Array.isArray(it?.additionalInfo?.selectedSlots) ? it.additionalInfo.selectedSlots.length : 0,
        selectedSlotsHead: Array.isArray(it?.additionalInfo?.selectedSlots) ? it.additionalInfo.selectedSlots.slice(0, 2) : null,
      })));
    } catch (e) {
      console.log('🧪 [ServiceCartScreen] items debug failed', e);
    }
  }, [state.items]);
  
  const getDisplayPricing = (item: ServiceCartItem) => {
    const baseUnit = Number(item?.unitPrice) || Number(item?.company?.price) || 0;
    const qty = Number(item?.quantity) || 1;
    const effectiveUnit = Number((item as any)?.additionalInfo?.effectiveUnitPrice);
    const hasOffer = Boolean((item as any)?.additionalInfo?.appliedQuantityOffer);
    const savings = Number((item as any)?.additionalInfo?.quantityOfferSavings) || 0;
  
    const offeredTotal = Number(item?.totalPrice) || baseUnit * qty;
    const originalTotal = baseUnit * qty;
  
    return {
      baseUnit,
      qty,
      hasOffer,
      effectiveUnit: Number.isFinite(effectiveUnit) ? effectiveUnit : baseUnit,
      offeredTotal,
      originalTotal,
      savings,
    };
  };

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

  const changeServiceQuantity = (serviceId: string, delta: number) => {
    const service = state.items[serviceId];
    if (!service) return;

    // Packages (daily/weekly/monthly) represent a plan-like booking; quantity shouldn't be adjustable.
    // We treat any item carrying additionalInfo.package as a package item.
    const hasPkg = Boolean((service as any)?.additionalInfo?.package);
    const pkgUnit = String((service as any)?.additionalInfo?.package?.unit || '').toLowerCase();
    const isAnyPackage = hasPkg || ['day', 'daily', 'week', 'weekly', 'month', 'monthly'].includes(pkgUnit);
    if (isAnyPackage) {
      if ((service.quantity || 1) !== 1) updateService(serviceId, { quantity: 1 });
      return;
    }

    const nextQty = Math.max(1, (Number(service.quantity) || 1) + delta);
    updateService(serviceId, { quantity: nextQty });
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
        {(() => {
          const p = getDisplayPricing(item);
          return (
            <View style={{ alignItems: 'flex-end' }}>
              {p.hasOffer ? (
                <Text style={styles.originalPrice}>₹{Math.round(p.originalTotal)}</Text>
              ) : null}
              <Text style={styles.packagePrice}>₹{Math.round(p.offeredTotal)}</Text>
              {p.hasOffer && p.savings > 0 ? (
                <View style={styles.savingsPill}>
                  <Ionicons name="pricetag" size={14} color="#065f46" />
                  <Text style={styles.savingsText}>Saved ₹{Math.round(p.savings)}</Text>
                </View>
              ) : null}
            </View>
          );
        })()}
      </View>
  
      {/* Quantity offer applied badge */}
      {(() => {
        // If an offer is available but not yet applied (e.g., qty still below minQuantity),
        // we still want to show the user that an offer exists.
        const appliedOffer = (item as any)?.additionalInfo?.appliedQuantityOffer;
        const allOffers = (item as any)?.additionalInfo?.quantityOffers;

        const hasAnyOffers = Array.isArray(allOffers) && allOffers.length > 0;
        const qty = Number(item.quantity) || 1;
        const offer = appliedOffer || (hasAnyOffers ? getBestActiveQuantityOffer(allOffers, qty) : null);
        if (!offer && !hasAnyOffers) return null;

        const msg = offer ? String((offer as any)?.message || '').trim() : '';
        const eligibleText = msg || (appliedOffer ? 'Offer applied!' : 'Offer available');

        // If no eligible tier is found yet (e.g. minQuantity=4 but qty=1), show the first active tier message.
        const firstActive = !offer && hasAnyOffers
          ? (allOffers as any[]).find((o: any) => o && typeof o === 'object' && o.isActive !== false)
          : null;
        const firstMsg = firstActive ? String(firstActive.message || '').trim() : '';
        const minQ = firstActive ? Number(firstActive.minQuantity) : NaN;
        const preEligibleText = firstMsg
          ? (Number.isFinite(minQ) && minQ > qty ? `${firstMsg} (min ${minQ})` : firstMsg)
          : (Number.isFinite(minQ) && minQ > qty ? `Offer available (min ${minQ})` : 'Offer available');

        const text = offer ? eligibleText : preEligibleText;
        return (
          <View style={styles.offerBadge}>
            <Text style={styles.offerBadgeText}>{text}</Text>
          </View>
        );
      })()}
  
      {(() => {
        const hasPkg = Boolean((item as any)?.additionalInfo?.package);
        const pkgUnit = String((item as any)?.additionalInfo?.package?.unit || '').toLowerCase();
        const isAnyPackage = hasPkg || ['day', 'daily', 'week', 'weekly', 'month', 'monthly'].includes(pkgUnit);
        if (isAnyPackage) {
          return (
            <View style={styles.qtyRow}>
              <Text style={styles.qtyLabel}>Quantity</Text>
              <View style={styles.qtyStepper}>
                <View style={[styles.qtyValueBox, { paddingHorizontal: 12 }]}>
                  <Text style={styles.qtyValueText}>1</Text>
                </View>
              </View>
            </View>
          );
        }

        // Quantity stepper (this is where user actually avails the offer)
        return (
          <View style={styles.qtyRow}>
            <Text style={styles.qtyLabel}>Quantity</Text>
            <View style={styles.qtyStepper}>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => changeServiceQuantity(item.id, -1)}
                activeOpacity={0.7}
              >
                <Text style={styles.qtyBtnText}>−</Text>
              </TouchableOpacity>
              <View style={styles.qtyValueBox}>
                <Text style={styles.qtyValueText}>{item.quantity || 1}</Text>
              </View>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => changeServiceQuantity(item.id, +1)}
                activeOpacity={0.7}
              >
                <Text style={styles.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })()}

      <View style={styles.bookingDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={16} color="#666" />
          <Text style={styles.detailText}>
            {(() => {
              // item.selectedDate is stored as YYYY-MM-DD; `new Date('YYYY-MM-DD')` is parsed as UTC
              // in JS, which can show the wrong day in some timezones. Parse as local instead.
              const iso = String(item.selectedDate || '');
              const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
              const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
              return d.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              });
            })()}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={16} color="#666" />
          <View style={{ flex: 1 }}>
            {/* For service flow we show a richer "Slot:" summary below; avoid duplicating the same range twice. */}
            {(() => {
              const start = (item as any)?.additionalInfo?.startSlot;
              const windows = (item as any)?.additionalInfo?.selectedSlots;
              const hasBlock = Boolean(start) || (Array.isArray(windows) && windows.length > 0);
              return hasBlock ? null : (
                <Text style={styles.detailText}>{item.selectedTime}</Text>
              );
            })()}

            {(() => {
              // Always show a slot summary for non-package services.
              // Preferred: derive end time from selectedSlots (atomic windows).
              // Fallback: show item.selectedTime (which is usually already a range).
              const start = (item as any)?.additionalInfo?.startSlot;
              const windows = (item as any)?.additionalInfo?.selectedSlots;

              const fallbackLabel = String(item.selectedTime || '').trim();

              let rangeText: string | null = null;

              if (start && Array.isArray(windows) && windows.length > 0) {
                // windows are like: {date, time: "9:00 AM - 9:30 AM"}
                const last = windows[windows.length - 1];
                const lastLabel = String(last?.time || '');
                const m = lastLabel.match(/\s-\s(.+)$/);
                const endLabel = m?.[1] ? String(m[1]).trim() : null;
                const startLabel = String(start?.time || '').trim();
                if (startLabel && endLabel) rangeText = `Slot: ${startLabel} - ${endLabel}`;
              }

              if (!rangeText && fallbackLabel) rangeText = `Slot: ${fallbackLabel}`;
              if (!rangeText) return null;

              return (
                <Text
                  style={[styles.detailText, { marginTop: 2, color: '#334155', fontWeight: '700' }]}
                  numberOfLines={2}
                >
                  {rangeText}
                </Text>
              );
            })()}

            {(() => {
              // Duration varies per service. We try a few common sources.
              // Expected forms we handle:
              // - number => minutes
              // - string like "30", "30 mins", "1 hr", "1 hour"
              const parseMinutes = (v: any): number | null => {
                if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
                const s = String(v ?? '').trim().toLowerCase();
                if (!s) return null;
                // extract first number
                const m = s.match(/(\d+(?:\.\d+)?)/);
                if (!m) return null;
                const n = Number(m[1]);
                if (!Number.isFinite(n) || n <= 0) return null;
                // if explicitly says hour/hr -> convert
                if (s.includes('hour') || s.includes('hr')) return Math.round(n * 60);
                return Math.round(n);
              };

              const perServiceMinutes =
                parseMinutes((item as any)?.additionalInfo?.duration) ??
                parseMinutes((item as any)?.additionalInfo?.serviceDuration) ??
                parseMinutes((item as any)?.company?.time) ??
                parseMinutes((item as any)?.company?.duration) ??
                null;

              if (!perServiceMinutes) return null;
              const qty = Math.max(1, Number(item.quantity) || 1);
              const totalMinutes = perServiceMinutes * qty;

              const format = (mins: number) => {
                if (mins < 60) return `${mins} min`;
                const h = Math.floor(mins / 60);
                const m2 = mins % 60;
                return m2 ? `${h}h ${m2}m` : `${h}h`;
              };

              return (
                <Text style={[styles.detailText, { marginTop: 2, color: '#475569', fontWeight: '700' }]}>
                  Duration: {format(perServiceMinutes)} × {qty} = {format(totalMinutes)}
                </Text>
              );
            })()}
          </View>
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
    paddingLeft: 8,
    paddingRight: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  backButton: {
    padding: 8,
    width: 44,
    alignItems: 'flex-start',
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
    width: 80,
    alignItems: 'flex-end',
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
    flexDirection: "column",
    gap: 6,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: 'wrap',
  },
  detailText: {
    fontSize: 14,
    color: "#666",
    marginLeft: 4,
    lineHeight: 18,
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
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
    lineHeight: 20,
  },

  packageNameText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    lineHeight: 18,
  },

  packagePrice: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0f172a",
    letterSpacing: 0.2,
  },

  originalPrice: {
    fontSize: 12,
    color: "#64748b",
    textDecorationLine: "line-through",
    marginBottom: 4,
    fontWeight: "800",
  },
  
  savingsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#d1fae5',
    borderColor: '#10b981',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 6,
  },
  
  savingsText: {
    color: '#065f46',
    fontSize: 12,
    fontWeight: '800',
  },
  
  offerBadge: {
    backgroundColor: '#fff7ed',
    borderColor: '#fb923c',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    marginTop: 10,
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 4,
  },
  
  offerBadgeText: {
    color: '#9a3412',
    fontSize: 14,
    fontWeight: '900',
  },
  
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  
  qtyLabel: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '700',
  },
  
  qtyStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  
  qtyBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  
  qtyBtnText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    lineHeight: 18,
  },
  
  qtyValueBox: {
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  
  qtyValueText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
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