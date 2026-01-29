# Empty Cart Location Change Enhancement

## Objective
When a user changes location and the cart is empty, skip the delivery details collection (flat number, house details) and navigate directly to the home screen instead of staying on the cart screen.

## Changes Made

### 1. **CartScreen.tsx Modifications**

#### Added Helper Function
```typescript
/**
 * Check if all carts are empty
 */
const isAllCartsEmpty = () => {
  const groceryItemsCount = Object.keys(cart).length;
  const serviceItemsCount = serviceCart.totalItems;
  const restaurantItemsCount = restaurantCart.totalItems;
  return groceryItemsCount === 0 && serviceItemsCount === 0 && restaurantItemsCount === 0;
};
```

#### Modified Store Change Detection Logic
- **Before**: Always cleared all carts and showed notification when location changed
- **After**: 
  - If carts are empty: Navigate directly to LocationSelector without clearing or showing notification
  - If carts have items: Clear carts and show notification as before

#### Updated Location Change Points
1. **Store ID Change Detection**: Only clears carts if they have items, navigates to LocationSelector if empty
2. **Route Params Selection**: Only clears carts if they have items when location comes from navigation
3. **Saved Location Selection**: Only clears carts if they have items when selecting saved addresses

#### Removed Automatic Cart Redirect
- **Before**: Empty cart automatically redirected to LocationSelector
- **After**: Removed automatic redirect to allow manual location selection

### 2. **LocationSelectorScreen.tsx Modifications**

#### Added Cart Context Imports
- Imported `useCart`, `useRestaurantCart`, `useServiceCart` contexts
- Added `isAllCartsEmpty()` helper function

#### Modified Confirm Location Logic
- **Before**: Always showed delivery details form when coming from Cart
- **After**:
  - If carts are empty: Navigate directly to Home screen
  - If carts have items: Show delivery details form, then return to Cart

## User Experience Flow

### Empty Cart Scenario
1. User is on Cart screen with empty cart
2. User changes location (via store change or location selection)
3. System detects empty cart
4. Navigates directly to LocationSelector
5. User selects location on map
6. System skips delivery details collection
7. **Navigates to Home screen** (not back to Cart)
8. No notification shown, no cart clearing needed

### Cart with Items Scenario
1. User is on Cart screen with items
2. User changes location
3. System detects cart has items
4. Clears all carts and shows notification
5. Navigates to LocationSelector
6. User selects location
7. System shows delivery details form (house number, place label)
8. User fills details and saves
9. Navigates back to Cart with new location

## Benefits
- **Improved UX**: Empty cart users go to Home to start shopping
- **Faster Navigation**: Direct to Home screen for empty carts
- **Logical Flow**: Empty cart → Select location → Start shopping
- **Consistent Behavior**: Still maintains cart clearing for users with items
- **No Breaking Changes**: Existing functionality preserved for carts with items

## Files Modified
- `screens/CartScreen.tsx` - Main cart logic and location change handling
- `screens/LocationSelectorScreen.tsx` - Location selection and navigation logic

## Testing Checklist
- [ ] Empty cart + location change → Direct navigation to LocationSelector
- [ ] Empty cart + location selection → Navigate to Home screen (not Cart)
- [ ] Cart with items + location change → Clear carts, show notification
- [ ] Cart with items + location selection → Show delivery details form, return to Cart
- [ ] Saved location selection with empty cart → Skip clearing, navigate to Home
- [ ] Saved location selection with items → Clear carts, show notification, return to Cart