export type QuantityOffer = {
  // NOTE: The backend/admin may send different strings (e.g. 'flat', 'percent', or
  // simplified flags). We keep the type wide but handle variants in logic.
  discountType?: 'newPrice' | 'flat' | 'percent' | string;
  discountValue?: number;
  isActive?: boolean;
  minQuantity?: number;
  newPricePerUnit?: number;
  message?: string;
};

export type QuantityOfferPricing = {
  baseUnitPrice: number;
  quantity: number;
  appliedOffer?: QuantityOffer;
  effectiveUnitPrice: number;
  totalPrice: number;
  savings: number;
};

const asNumber = (v: any): number | null => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

export const getBestActiveQuantityOffer = (
  offers: any,
  quantity: number
): QuantityOffer | undefined => {
  if (!Array.isArray(offers) || offers.length === 0) return undefined;
  const q = Math.max(0, Number(quantity) || 0);
  if (q <= 0) return undefined;

  const eligible: QuantityOffer[] = offers
    .filter((o: any) => o && typeof o === 'object')
    .filter((o: any) => o.isActive !== false)
    .filter((o: any) => {
      const minQ = asNumber(o.minQuantity);
      return minQ != null && minQ > 0 && q >= minQ;
    });

  if (eligible.length === 0) return undefined;

  // Prefer highest minQuantity (typical tier system). If ties, prefer bigger benefit (lower effective unit price).
  eligible.sort((a, b) => {
    const aMin = asNumber(a.minQuantity) ?? 0;
    const bMin = asNumber(b.minQuantity) ?? 0;
    if (bMin !== aMin) return bMin - aMin;
    return 0;
  });

  return eligible[0];
};

export const computeQuantityOfferPricing = (params: {
  baseUnitPrice: number;
  quantity: number;
  offers?: any;
}): QuantityOfferPricing => {
  const baseUnitPrice = Math.max(0, Number(params.baseUnitPrice) || 0);
  const quantity = Math.max(0, Number(params.quantity) || 0);

  const appliedOffer = getBestActiveQuantityOffer(params.offers, quantity);

  let effectiveUnitPrice = baseUnitPrice;

  if (appliedOffer) {
    const type = String(appliedOffer.discountType || '').toLowerCase();

    if (type === 'newprice') {
      const newPrice = asNumber((appliedOffer as any).newPricePerUnit);
      if (newPrice != null && newPrice >= 0) {
        // "newPrice" can mean the backend sends an explicit new unit price.
        effectiveUnitPrice = newPrice;
      } else {
        // In the latest schema, many offers keep discountType="newPrice" but provide
        // `discountValue` as a per-unit discount (and omit `newPricePerUnit`).
        // Example: "Get ₹10 Off per installation" => discountValue: 10.
        const v = asNumber(appliedOffer.discountValue);
        if (v != null && v >= 0) effectiveUnitPrice = Math.max(0, baseUnitPrice - v);
      }
    } else if (type === 'flat' || type === 'flatperunit' || type === 'perunit' || type === 'discount') {
      const v = asNumber(appliedOffer.discountValue);
      // flat discountValue is assumed to be per-unit discount.
      if (v != null && v >= 0) effectiveUnitPrice = Math.max(0, baseUnitPrice - v);
    } else if (type === 'percent') {
      const v = asNumber(appliedOffer.discountValue);
      if (v != null && v >= 0) effectiveUnitPrice = Math.max(0, baseUnitPrice - (baseUnitPrice * v) / 100);
    } else {
      // If discountType is missing/unknown but discountValue exists, treat it as a per-unit flat discount.
      const v = asNumber(appliedOffer.discountValue);
      if (v != null && v >= 0) effectiveUnitPrice = Math.max(0, baseUnitPrice - v);
    }
  }

  const totalPrice = Math.round(effectiveUnitPrice * quantity * 100) / 100;
  const fullPrice = Math.round(baseUnitPrice * quantity * 100) / 100;
  const savings = Math.max(0, Math.round((fullPrice - totalPrice) * 100) / 100);

  return {
    baseUnitPrice,
    quantity,
    appliedOffer,
    effectiveUnitPrice,
    totalPrice,
    savings,
  };
};
