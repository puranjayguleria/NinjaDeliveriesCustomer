# Test Plan for Navigation Fix

## Quick Verification Steps

### Step 1: Check if the app starts without crashes
```bash
# Clear cache and restart
npm start -- --clear
# or
npx expo start -c
```

### Step 2: Test with Grocery Enabled Location

1. **Open the app**
2. **Select a location where grocery is enabled**
3. **Test these actions:**
   - ✅ Tap on a banner → Should navigate to home/products
   - ✅ Tap "Shop Grocery" from empty cart → Should navigate to products
   - ✅ Tap Home tab → Should show ProductsHome
   - ✅ Navigate back and forth between tabs

**Expected Result:** No crashes, smooth navigation

### Step 3: Test with Grocery Disabled Location

1. **Change to a location where grocery is disabled**
   - You can test this by temporarily setting `grocery: false` in your location document in Firestore
   - Or select a location that has grocery disabled

2. **Test these actions:**
   - ✅ Tap on a banner → Should navigate to ServicesHome (not crash)
   - ✅ Try to navigate "home" → Should go to ServicesHome
   - ✅ Check that HomeTab is not visible in bottom tabs
   - ✅ Cart should still work for services

**Expected Result:** No crashes, graceful fallback to ServicesHome

### Step 4: Test Location Switching

1. **Start with grocery-enabled location**
2. **Switch to grocery-disabled location**
3. **Try navigating home**

**Expected Result:** App adapts automatically, no crashes

### Step 5: Test Edge Cases

1. **Login flow:**
   - Log out
   - Try to access a protected screen
   - Tap "Continue" in login prompt
   - ✅ Should navigate appropriately based on location flags

2. **Banner navigation:**
   - Test different banner types (sale items, general)
   - ✅ Should handle all cases gracefully

3. **Empty cart:**
   - Clear all items from cart
   - View empty cart screen
   - Tap "Shop Grocery" or "Browse Services"
   - ✅ Should navigate correctly

## Common Issues and Solutions

### Issue 1: Still seeing "HomeTab not handled" error

**Solution:**
- Check which screen is causing the error (look at the stack trace)
- Find that file in `NAVIGATION_FIX_GUIDE.md`
- Apply the fix pattern to that specific file

### Issue 2: Navigation goes to wrong screen

**Solution:**
- Verify location flags are set correctly in Firestore
- Check that `location?.grocery` is being read properly
- Add console.log to see which path is being taken:
```typescript
console.log('Navigating home, HomeTab available:', isRouteAvailable('HomeTab'));
```

### Issue 3: App crashes on startup

**Solution:**
- Clear cache: `npx expo start -c`
- Check for syntax errors: `npm run tsc` (if using TypeScript)
- Check the error message - it might be unrelated to navigation

## Debug Mode

To see navigation decisions in action, add this to your code temporarily:

```typescript
// In utils/navigationHelpers.ts
export function safeNavigateToHome(navigation: any, params?: any) {
  const available = isRouteAvailable('HomeTab');
  console.log('🧭 [Navigation] HomeTab available:', available);
  
  if (available) {
    console.log('🧭 [Navigation] Navigating to HomeTab');
    try {
      navigation.navigate('HomeTab', params);
    } catch (error) {
      console.warn('🧭 [Navigation] Failed to navigate to HomeTab:', error);
      navigation.navigate('CartFlow', { screen: 'ServicesHome' });
    }
  } else {
    console.log('🧭 [Navigation] Falling back to ServicesHome');
    navigation.navigate('CartFlow', { screen: 'ServicesHome' });
  }
}
```

## Success Criteria

✅ App starts without crashes
✅ Navigation works with grocery enabled
✅ Navigation works with grocery disabled  
✅ No "HomeTab not handled" errors
✅ Smooth transitions between locations
✅ All tabs and screens accessible
✅ Cart functionality works in both modes

## If Tests Fail

1. Check the console for error messages
2. Identify which screen is causing the issue
3. Refer to `NAVIGATION_FIX_GUIDE.md` for that specific file
4. Apply the fix pattern
5. Re-test

## Performance Check

The navigation helpers add minimal overhead:
- Simple route name checking (O(n) where n = number of routes)
- Only runs when navigation is triggered
- No impact on render performance

## Monitoring in Production

Add analytics to track navigation patterns:

```typescript
// Track when fallback is used
if (!isRouteAvailable('HomeTab')) {
  analytics.logEvent('navigation_fallback_used', {
    intended_destination: 'HomeTab',
    actual_destination: 'ServicesHome',
    location_id: location?.storeId
  });
}
```

This helps you understand how often users encounter grocery-disabled locations.
