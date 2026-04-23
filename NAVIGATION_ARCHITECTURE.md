# Navigation Architecture - HomeTab Conditional Rendering

## Visual Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         App.tsx                              │
│                      (Root Navigator)                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │    AppTabs      │
                    │ (Tab Navigator) │
                    └─────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   HomeTab     │    │ CategoriesTab │    │   CartFlow    │
│ (Conditional) │    │ (Conditional) │    │   (Always)    │
└───────────────┘    └───────────────┘    └───────────────┘
        │                     │                     │
        ▼                     ▼                     ▼
  ProductsHome          CategoriesHome         CartHome
  ServicesHome          AllServicesScreen      GroceryCart
  FoodComingSoon                               ServiceCart
                                               ServicesHome
```

## Conditional Rendering Logic

### In App.tsx (lines ~1134-1159)

```typescript
{showGrocery && (
  <Tab.Screen
    name="HomeTab"
    component={HomeStack}
    options={{ title: "Home" }}
  />
)}
```

**Key Point:** `showGrocery = location?.grocery !== false`

### Scenarios

#### Scenario 1: Grocery Enabled (showGrocery = true)
```
Navigation Tree:
├── AppTabs
│   ├── HomeTab ✅ (EXISTS)
│   ├── CategoriesTab ✅
│   ├── BuyAgainTab ✅
│   └── CartFlow ✅

User navigates to "HomeTab" → SUCCESS ✅
```

#### Scenario 2: Grocery Disabled (showGrocery = false)
```
Navigation Tree:
├── AppTabs
│   ├── HomeTab ❌ (DOES NOT EXIST)
│   └── CartFlow ✅
│       └── ServicesHome ✅

User navigates to "HomeTab" → ERROR ❌
"The action 'NAVIGATE' with payload {"name":"HomeTab"} 
was not handled by any navigator"
```

## The Fix: Safe Navigation Pattern

### Before (Unsafe)
```typescript
// Direct navigation - crashes if HomeTab doesn't exist
navigation.navigate("HomeTab", params);
```

### After (Safe)
```typescript
// Safe navigation with automatic fallback
import { safeNavigateToHome } from '../utils/navigationHelpers';
safeNavigateToHome(navigation, params);
```

### How It Works

```
┌─────────────────────────────────────────────────────────┐
│         User Action (e.g., tap banner)                  │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│     safeNavigateToHome(navigation, params)              │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│         isRouteAvailable('HomeTab')?                    │
└─────────────────────────────────────────────────────────┘
                        │
            ┌───────────┴───────────┐
            ▼                       ▼
        ┌───────┐              ┌────────┐
        │  YES  │              │   NO   │
        └───────┘              └────────┘
            │                       │
            ▼                       ▼
┌──────────────────────┐  ┌──────────────────────┐
│ Navigate to HomeTab  │  │ Navigate to          │
│ (Grocery Home)       │  │ ServicesHome         │
│ ✅ Success           │  │ ✅ Fallback Success  │
└──────────────────────┘  └──────────────────────┘
```

## Navigation Helper Functions

### 1. isRouteAvailable(routeName)
**Purpose:** Check if a route exists in the navigation tree

```typescript
const exists = isRouteAvailable('HomeTab');
// Returns: true or false
```

**How it works:**
1. Get current navigation state
2. Recursively collect all route names
3. Check if target route is in the list

### 2. safeNavigateToHome(navigation, params)
**Purpose:** Navigate to home with automatic fallback

```typescript
safeNavigateToHome(navigation, { screen: 'ProductsHome' });
```

**Logic:**
```
IF HomeTab exists:
  → Navigate to HomeTab
ELSE:
  → Navigate to CartFlow > ServicesHome
```

### 3. safeNavigateToHomeRoot(params)
**Purpose:** Same as above but uses root navigation ref

```typescript
safeNavigateToHomeRoot({ screen: 'ProductsHome' });
```

**Use when:** Navigating from outside a screen component (e.g., global modals)

### 4. safeNavigateToAppTabsHome(navigation, params)
**Purpose:** Navigate to AppTabs > HomeTab with fallback

```typescript
safeNavigateToAppTabsHome(navigation, { screen: 'ProductsHome' });
```

**Use when:** Need to explicitly navigate through AppTabs

## Location Flags Flow

```
┌─────────────────────────────────────────────────────────┐
│              Firestore: locations collection            │
│  {                                                       │
│    storeId: "store123",                                 │
│    grocery: true/false,  ← Controls HomeTab             │
│    services: true/false,                                │
│    food: true/false                                     │
│  }                                                       │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│         LocationContext (context/LocationContext)       │
│         Stores location flags in state                  │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              App.tsx - AppTabs Component                │
│  const showGrocery = location?.grocery !== false;       │
│                                                          │
│  {showGrocery && (                                      │
│    <Tab.Screen name="HomeTab" ... />                   │
│  )}                                                      │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│         HomeTab rendered or not rendered                │
│         Based on showGrocery flag                       │
└─────────────────────────────────────────────────────────┘
```

## Real-Time Updates

The app listens for real-time changes to location flags:

```typescript
// In App.tsx - AppTabs component
useEffect(() => {
  const unsubscribe = firestore()
    .collection('locations')
    .where('storeId', '==', location.storeId)
    .onSnapshot((snapshot) => {
      // Update flags in real-time
      updateLocation({
        grocery: data?.grocery ?? true,
        services: data?.services ?? true,
        food: data?.food ?? true,
      });
    });
  
  return () => unsubscribe();
}, [location?.storeId]);
```

**Result:** When admin changes location flags in Firestore, the app automatically:
1. Updates location context
2. Re-renders AppTabs
3. Adds/removes HomeTab from navigation tree
4. Safe navigation helpers adapt automatically

## Migration Path for Existing Code

### Pattern 1: Simple Navigation
```typescript
// OLD
navigation.navigate("HomeTab");

// NEW
import { safeNavigateToHome } from '../utils/navigationHelpers';
safeNavigateToHome(navigation);
```

### Pattern 2: Navigation with Params
```typescript
// OLD
navigation.navigate("HomeTab", { screen: "ProductsHome" });

// NEW
import { safeNavigateToHome } from '../utils/navigationHelpers';
safeNavigateToHome(navigation, { screen: "ProductsHome" });
```

### Pattern 3: Root Navigation
```typescript
// OLD
navigationRef.navigate("HomeTab" as never);

// NEW
import { safeNavigateToHomeRoot } from '../utils/navigationHelpers';
safeNavigateToHomeRoot();
```

### Pattern 4: AppTabs Navigation
```typescript
// OLD
navigation.navigate("AppTabs", { screen: "HomeTab" });

// NEW
import { safeNavigateToAppTabsHome } from '../utils/navigationHelpers';
safeNavigateToAppTabsHome(navigation);
```

### Pattern 5: Try-Catch (Not Recommended)
```typescript
// OLD (works but verbose)
try {
  navigation.navigate("HomeTab");
} catch {
  navigation.navigate("CartFlow", { screen: "ServicesHome" });
}

// NEW (cleaner)
import { safeNavigateToHome } from '../utils/navigationHelpers';
safeNavigateToHome(navigation);
```

## Benefits of This Architecture

✅ **Graceful Degradation:** App works even when features are disabled
✅ **Real-Time Adaptation:** Responds to location flag changes instantly
✅ **No Crashes:** Safe navigation prevents "route not found" errors
✅ **Maintainable:** Centralized navigation logic in helper functions
✅ **Flexible:** Easy to add more conditional screens in the future
✅ **User-Friendly:** Seamless experience regardless of location capabilities

## Future Enhancements

### 1. Add Similar Checks for Other Conditional Tabs
```typescript
// CategoriesTab is also conditional
{showGrocery && (
  <Tab.Screen name="CategoriesTab" ... />
)}

// Create helper:
export function safeNavigateToCategories(navigation, params) {
  if (isRouteAvailable('CategoriesTab')) {
    navigation.navigate('CategoriesTab', params);
  } else {
    // Fallback logic
  }
}
```

### 2. Add Analytics
```typescript
export function safeNavigateToHome(navigation, params) {
  const available = isRouteAvailable('HomeTab');
  
  if (!available) {
    // Track fallback usage
    analytics.logEvent('navigation_fallback', {
      intended: 'HomeTab',
      actual: 'ServicesHome'
    });
  }
  
  // ... rest of navigation logic
}
```

### 3. Add User Feedback
```typescript
if (!isRouteAvailable('HomeTab')) {
  Toast.show({
    type: 'info',
    text1: 'Grocery not available',
    text2: 'Showing services instead'
  });
}
```

## Troubleshooting Guide

### Problem: Still getting "HomeTab not handled" error

**Check:**
1. Which file is causing the error? (check stack trace)
2. Is that file using safe navigation helpers?
3. Is the import path correct?

**Solution:**
Apply the migration pattern to that specific file

### Problem: Navigation goes to wrong screen

**Check:**
1. Location flags in Firestore
2. LocationContext state
3. Console logs for navigation decisions

**Solution:**
```typescript
// Add debug logging
console.log('Location flags:', {
  grocery: location?.grocery,
  services: location?.services,
  showGrocery: location?.grocery !== false
});
```

### Problem: HomeTab appears/disappears unexpectedly

**Check:**
1. Real-time listener in AppTabs
2. Location document in Firestore
3. Network connectivity

**Solution:**
Verify Firestore rules allow reading location documents

## Summary

This architecture provides:
- **Conditional rendering** of tabs based on location capabilities
- **Safe navigation** that adapts to available routes
- **Real-time updates** when location flags change
- **Graceful fallbacks** when features are unavailable
- **Maintainable code** with centralized navigation logic

The key insight: **Never assume a screen exists - always check first!**
