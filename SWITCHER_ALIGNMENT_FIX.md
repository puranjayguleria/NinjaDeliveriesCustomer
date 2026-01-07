# VerticalSwitcher Alignment Fix

## Issue
The VerticalSwitcher component had different positioning behavior between the grocery screen and eats screen:

- **Grocery Screen (ProductsHomeScreen)**: Switcher was positioned **statically** in the layout flow
- **Eats Screen (NinjaEatsHomeScreen)**: Switcher was positioned **absolutely** with fixed coordinates

This inconsistency made the user experience different between the two modes.

## Root Cause
The NinjaEatsHomeScreen was using absolute positioning for the VerticalSwitcher:

```typescript
// OLD - Absolute positioning (inconsistent)
verticalSwitcherRow: {
  position: "absolute",
  top: Platform.OS === "ios" ? 104 : 92,
  left: 12,
  zIndex: 1000,
},
```

While ProductsHomeScreen used static positioning:

```typescript
// GOOD - Static positioning (consistent)
verticalSwitcherRow: {
  marginTop: 8,
  alignSelf: "flex-start",
},
```

## Solution Applied

### 1. **Fixed Layout Structure**
Changed the NinjaEatsHomeScreen layout to match ProductsHomeScreen:

```typescript
// NEW Layout Order (consistent with grocery)
<View style={styles.topBg}>
  {/* Location row */}
  <Header />

  {/* Search */}
  <View style={styles.searchContainer}>
    <RotatingRestaurantSearchBar />
  </View>

  {/* Vertical switcher BELOW search */}
  <View style={styles.verticalSwitcherRow}>
    <VerticalSwitcher
      active="restaurants"
      onChange={handleModeChange}
    />
  </View>
</View>
```

### 2. **Updated Styles**
Changed from absolute to static positioning:

```typescript
// NEW - Static positioning (consistent)
verticalSwitcherRow: {
  marginTop: 8,          // space below search bar
  alignSelf: "flex-start", // consistent with grocery screen
},
```

### 3. **Adjusted Header Heights**
Increased header heights to accommodate the static switcher:

```typescript
// Increased heights to fit static switcher
const INITIAL_HEADER_HEIGHT = 220; // was 180
const COLLAPSED_HEADER_HEIGHT = 140; // was 120
```

## Files Modified

### `screens/NinjaEatsHomeScreen.tsx`
- ✅ Moved VerticalSwitcher to static position below search
- ✅ Updated `verticalSwitcherRow` styles to match grocery screen
- ✅ Increased header heights to accommodate layout changes
- ✅ Reordered layout components for consistency

## Benefits

### 1. **Consistent User Experience**
- Both grocery and eats screens now have identical switcher behavior
- Switcher follows the same layout flow in both modes
- No more floating/overlapping switcher issues

### 2. **Better Layout Stability**
- Static positioning prevents switcher from overlapping other content
- More predictable layout behavior across different screen sizes
- Proper spacing maintained in all scenarios

### 3. **Improved Maintainability**
- Consistent code patterns between grocery and eats screens
- Easier to maintain and update switcher behavior
- Reduced complexity from absolute positioning

## Visual Changes

### Before:
- Eats screen had floating switcher at fixed position
- Switcher could overlap with other content
- Different behavior between grocery and eats modes

### After:
- ✅ Eats screen switcher positioned statically like grocery
- ✅ Proper spacing and layout flow maintained
- ✅ Consistent behavior across both modes
- ✅ No overlapping or floating issues

## Testing

To verify the fix:

1. **Switch between modes**: Grocery ↔ Eats should have identical switcher behavior
2. **Scroll testing**: Switcher should maintain proper position during scroll
3. **Screen sizes**: Test on different device sizes to ensure consistent layout
4. **Orientation**: Verify behavior in both portrait and landscape modes

The VerticalSwitcher now behaves consistently across both grocery and eats screens, providing a unified user experience.