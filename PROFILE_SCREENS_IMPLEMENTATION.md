# Different Profile Screens for Ninja Eats and Grocery

## Overview
Implemented separate profile screens for the two main app modes:
- **Grocery Profile** - For the grocery shopping experience (AppTabs)
- **Ninja Eats Profile** - For the restaurant ordering experience (NinjaEatsTabs)

## Changes Made

### 1. Created GroceryProfileScreen.tsx
- **Theme**: Green color scheme (#4CAF50) to match grocery branding
- **Features**:
  - Shopping Lists management
  - Favorite Products
  - Scheduled Deliveries
  - Grocery-specific order filtering (orderType: "grocery")
  - Enhanced empty state with grocery basket icon

### 2. Enhanced NinjaEatsProfileScreen.tsx
- **Theme**: Orange color scheme (#FF6B35) to match restaurant branding
- **Features**:
  - Favorite Restaurants
  - Order History
  - Saved Addresses
  - Payment Methods
  - Restaurant-specific order filtering (restaurantOrders collection)
  - Animated rewards section
  - Enhanced empty state with restaurant icon

### 3. Updated App.tsx Navigation
- **ProfileStack** (for AppTabs/Grocery mode) now uses `GroceryProfileScreen`
- **NinjaEatsTabs** continues to use the enhanced `NinjaEatsProfileScreen`

## Key Differences

| Feature | Grocery Profile | Ninja Eats Profile |
|---------|----------------|-------------------|
| **Color Theme** | Green (#4CAF50) | Orange (#FF6B35) |
| **Header Title** | "Grocery Profile" | "Ninja Eats Profile" |
| **Icon** | Shopping Cart | Restaurant |
| **Orders Source** | orders collection (orderType: "grocery") | restaurantOrders collection |
| **Special Features** | Shopping Lists, Scheduled Deliveries | Favorite Restaurants, Saved Addresses |
| **Empty State** | Shopping basket icon | Restaurant icon |
| **Order Actions** | "Go To Order" | "Track Order" |

## Benefits

1. **Better User Experience**: Each mode has features relevant to its use case
2. **Visual Distinction**: Different color schemes help users understand which mode they're in
3. **Targeted Functionality**: Grocery users see grocery-specific features, restaurant users see restaurant-specific features
4. **Improved Order Management**: Orders are filtered by type, reducing confusion
5. **Enhanced Branding**: Each mode maintains its own visual identity

## Technical Implementation

- Both screens share similar base functionality (profile management, authentication)
- Order filtering is implemented at the Firestore query level for performance
- Separate collections for different order types prevent data mixing
- Consistent UI patterns with mode-specific customizations
- Proper navigation handling for each app mode

## Future Enhancements

- Implement the placeholder features (Shopping Lists, Favorite Restaurants, etc.)
- Add mode-specific analytics tracking
- Consider adding mode-specific notification preferences
- Implement cross-mode data synchronization where appropriate