import { computeQuantityOfferPricing } from './serviceQuantityOffers';

describe('serviceQuantityOffers', () => {
  it('applies percentage discountType', () => {
    const pricing = computeQuantityOfferPricing({
      baseUnitPrice: 100,
      quantity: 2,
      offers: [
        {
          isActive: true,
          minQuantity: 2,
          discountType: 'percentage',
          discountValue: 10,
        },
      ],
    });

    // percentage now applies on the FINAL total
    expect(pricing.totalPrice).toBe(180);
    expect(pricing.savings).toBe(20);
  });

  it('applies absolute discountType on final total', () => {
    const pricing = computeQuantityOfferPricing({
      baseUnitPrice: 200,
      quantity: 3,
      offers: [
        {
          isActive: true,
          minQuantity: 3,
          discountType: 'absolute',
          discountValue: 50,
        },
      ],
    });

    expect(pricing.totalPrice).toBe(550);
    expect(pricing.savings).toBe(50);
  });

  it('prefers highest eligible minQuantity tier', () => {
    const pricing = computeQuantityOfferPricing({
      baseUnitPrice: 100,
      quantity: 5,
      offers: [
        { isActive: true, minQuantity: 2, discountType: 'flat', discountValue: 5 },
        { isActive: true, minQuantity: 5, discountType: 'percent', discountValue: 20 },
      ],
    });

    expect(pricing.totalPrice).toBe(400);
  });

  it('normalizes backend offer key aliases', () => {
    const pricing = computeQuantityOfferPricing({
      baseUnitPrice: 100,
      quantity: 4,
      offers: [
        {
          isActive: true,
          minQty: 4,
          type: 'newPrice',
          value: 25,
          // would imply new unit price 75
          message: 'Save ₹25 per unit',
        },
      ],
    });

    expect(pricing.totalPrice).toBe(300);
    expect(pricing.savings).toBe(100);
    expect(pricing.appliedOffer?.minQuantity).toBe(4);
  });
});
