# Cart Clearing on Location Change - Implementation Summary

## Objective
When a user changes the delivery location in the cart, both the grocery cart and services cart should be emptied to ensure items are from the new location.

## Changes Made

### 1. **Added Imports** (CartScreen.tsx)
- Added `useRestaurantCart` hook from `RestaurantCartContext`
- Added `useServiceCart` hook from `ServiceCartContext`

### 2. **Created Helper Function** (CartScreen.tsx - Line ~1355)
```typescript
const clearAllCarts = () => {
  clearCart(); // Clear grocery cart
  restaurantCart.clearCart(); // Clear restaurant cart
  serviceCart.clearCart(); // Clear services cart
};
```

### 3. **Implemented Cart Clearing at All Location Change Points**

#### Location Change Point #1: Store ID Change Detection (Line ~344)
**When:** User changes store location globally
**Action:** Clear all carts when `location.storeId` changes
```typescript
if (currentStore && currentStore !== prevStoreIdRef.current) {
  clearAllCarts(); // NEW
  setSelectedLocation(null);
  setShowLocationSheet(false);
  ...
}
```

#### Location Change Point #2: Route Params Selection (Line ~440)
**When:** User navigates from LocationSelector screen with a selected location
**Action:** Clear all carts when location is passed via navigation params
```typescript
} else {
  clearAllCarts(); // NEW - Clear when location selected from navigation
  setSelectedLocation(route.params.selectedLocation);
}
```

#### Location Change Point #3: Saved Location Selection (Line ~1410)
**When:** User selects from saved delivery locations in cart
**Action:** Clear all carts when selecting a saved location
```typescript
const fullLocation = {
  ...item,
  lat: item.lat,
  lng: item.lng,
  storeId: nearest.id,
};

clearAllCarts(); // NEW - Clear when location changes
setSelectedLocation(fullLocation);
updateLocation(fullLocation);
```

#### Location Change Point #4: After Order Completion (Line ~1067)
**When:** Order is successfully placed
**Action:** Clear all carts along with other cleanup
```typescript
const { orderId, pickupCoords } = result;
clearAllCarts(); // NEW - Clear all carts after successful order
setSelectedLocation(null);
```

## Carts Affected
1. **Grocery Cart** (`CartContext`) - From grocery/products
2. **Restaurant Cart** (`RestaurantCartContext`) - From restaurants/delivery food
3. **Services Cart** (`ServiceCartContext`) - From services (electrician, plumber, cleaning, etc.)

## User Experience
- When a user changes delivery location, they see a notification: "Looks like you've switched to another store. Your cart has been emptied—please add items again."
- All three cart types are cleared together to maintain consistency
- The user can then add items from the new location

## Testing Checklist
- [ ] Change location in cart sheet → All items removed ✓
- [ ] Select from saved addresses → All items removed ✓
- [ ] Global store location change → All items removed ✓
- [ ] Navigate from LocationSelector → All items removed ✓
- [ ] Complete order → All items removed ✓
- [ ] Verify notification appears for store changes
- [ ] Verify no errors in console

## Files Modified
- `screens/CartScreen.tsx` - Main implementation file
