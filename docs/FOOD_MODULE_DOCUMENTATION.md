# Food Module Documentation

## Purpose

Yeh document `NinjaDeliveriesCustomer` app ke food module ka focused walkthrough hai. Iska purpose demo, knowledge transfer, aur quick explaining support dena hai. Documentation sirf food-related files aur unke direct supporting flow par based hai.

## Scanned Food Module Files

### Primary screens

- `screens/food/FoodScreen.tsx`
- `screens/food/FoodCategoriesScreen.tsx`
- `screens/food/FoodSearchScreen.tsx`
- `screens/food/RestaurantDetailScreen.tsx`
- `screens/food/FoodCartScreen.tsx`
- `screens/food/FoodCheckoutScreen.tsx`
- `screens/food/FoodOrdersScreen.tsx`
- `screens/food/FoodTrackingScreen.tsx`
- `screens/food/FoodOrderSuccessScreen.tsx`

### Food-specific component

- `components/food/DishModal.tsx`

### Food data and state

- `context/FoodCartContext.tsx`
- `firebase/foodFirebase.ts`

### Food-related assets

- `assets/ninjafoodVeg.png`
- `assets/ninjafoodNonVeg.png`
- `assets/foodScreenbg.png`
- `assets/foodBG.png`
- `assets/rider-icon.png`
- `assets/rider-icon-1.png`
- `assets/dropoff-marker.png`

### Food module wiring inside app

- `App.tsx`

## Folder Structure View

```text
screens/
  food/
    FoodScreen.tsx
    FoodCategoriesScreen.tsx
    FoodSearchScreen.tsx
    RestaurantDetailScreen.tsx
    FoodCartScreen.tsx
    FoodCheckoutScreen.tsx
    FoodOrdersScreen.tsx
    FoodTrackingScreen.tsx
    FoodOrderSuccessScreen.tsx

components/
  food/
    DishModal.tsx

context/
  FoodCartContext.tsx

firebase/
  foodFirebase.ts

assets/
  ninjafoodVeg.png
  ninjafoodNonVeg.png
  foodScreenbg.png
  foodBG.png
  rider-icon.png
  rider-icon-1.png
  dropoff-marker.png
```

## High-Level Module Summary

Food module ek Swiggy-style customer ordering flow implement karta hai:

1. User food home screen par restaurants aur categories browse karta hai.
2. Search ya category ke through dishes discover karta hai.
3. `DishModal` se variants aur add-ons select karke cart me items add karta hai.
4. Cart screen bill breakdown dikhati hai.
5. Checkout screen address aur payment method collect karke Firestore me order create karti hai.
6. Success screen se user tracking par jata hai.
7. Tracking screen live order status, rider info, map path, aur delivery ke baad review flow handle karti hai.
8. Orders screen order history aur reorder flow provide karti hai.

## File-by-File Explanation

### `screens/food/FoodScreen.tsx`

Food landing screen hai.

- Active restaurants ko real-time me `listenActiveRestaurants()` se fetch karti hai.
- Food categories ko `listenFoodCategoriesWithItems()` se load karti hai.
- Location context ka short delivery address top par show karti hai.
- Search bar user ko `FoodSearch` par bhejta hai.
- Veg / non-veg visual toggle UI level par theme change karta hai.
- Category tap ya restaurant tap par `DishModal` open hota hai.
- Yeh screen direct restaurant cards ke through ordering start karne ka primary entry point hai.

### `screens/food/FoodCategoriesScreen.tsx`

Dedicated category browsing screen.

- Categories grid me dikhati hai.
- Search input se category filtering karti hai.
- Category select karne par mapped restaurant ke liye `DishModal` open karti hai.
- Useful for menu-first browsing demo.

### `screens/food/FoodSearchScreen.tsx`

Unified food search screen.

- Restaurants, categories, aur all menu items load karti hai.
- Query 2 characters se kam ho to popular categories show karti hai.
- Query 2+ ho to restaurant aur dish results merge karke show karti hai.
- Dish click par selected dish ke category context ke sath `DishModal` open hota hai.
- Restaurant click par full dish modal open hota hai.

### `screens/food/RestaurantDetailScreen.tsx`

Restaurant-specific detailed menu page.

- `getMenuByRestaurant()` aur `getAddonsByRestaurant()` se data load karti hai.
- Menu items ko category sections me split karti hai.
- Top category tabs se section scroll hota hai.
- Cart quantity controls inline available hain.
- Bottom cart bar active cart hone par visible hota hai.

Note:
Current food home flow mostly `DishModal` driven hai, lekin yeh screen deeper restaurant browsing ke liye ready hai aur app navigator me registered hai.

### `components/food/DishModal.tsx`

Food ordering ka central reusable component.

- Restaurant ke menu aur add-ons ke liye real-time Firestore listeners use karta hai.
- Do modes me kaam karta hai:
  - Dish list mode
  - Selected item detail mode
- Variants radio selection aur add-ons checkbox selection support karta hai.
- Simple item ho to direct cart add kar deta hai.
- Cart active hone par footer me `View Cart` CTA show karta hai.

Yeh component food module ka most important interaction layer hai.

### `context/FoodCartContext.tsx`

Food cart ka in-memory state manager.

- Cart items array maintain karta hai.
- `addItem`, `removeItem`, `getItemQty`, `clearCart` expose karta hai.
- Total quantity aur total price compute karta hai.
- Add-ons ko total price me include karta hai.
- Single-restaurant cart rule implement karta hai:
  - Agar user dusre restaurant ka item add kare, purana cart replace ho jata hai.

### `screens/food/FoodCartScreen.tsx`

Cart review screen.

- Empty state aur populated state dono support karti hai.
- Item quantity controls available hain.
- Add-ons per item visible hote hain.
- Delivery fee rule:
  - `subtotal >= 199` par free delivery
  - warna `30`
- Taxes 5% calculate kiye gaye hain.
- Grand total calculate karke checkout par pass kiya jata hai.

### `screens/food/FoodCheckoutScreen.tsx`

Order placement screen.

- Location context se delivery address leti hai.
- Address na ho to user ko location selector par redirect karti hai.
- Payment method selection UI provide karti hai:
  - Cash on Delivery
  - UPI
  - Card
- Firestore collection `restaurant_Orders` me order document create karti hai.
- Order place hone ke baad cart clear karti hai aur success screen par reset navigation karti hai.

### `screens/food/FoodOrderSuccessScreen.tsx`

Simple confirmation screen.

- Success message show karti hai.
- Order total aur restaurant name display karti hai.
- `Track Order` CTA directly tracking screen kholta hai.
- `Back to Restaurants` CTA food home par le jata hai.

### `screens/food/FoodTrackingScreen.tsx`

Live post-order experience.

- `restaurant_Orders/{orderId}` ko real-time track karti hai.
- Order status normalize karke stepper me show karti hai.
- Rider assignment hone par `riderDetails/{riderId}` se rider info fetch karti hai.
- MapView me rider aur destination markers show hote hain.
- ETA haversine calculation se estimate hoti hai.
- Bill collapse/expand section available hai.
- Delivery ke baad review modal open hota hai.
- Review Firestore me `restaurant_Reviews` collection me save hota hai.

Supported status states:

- `pending`
- `preparing`
- `ready`
- `delivered`
- `cancelled`

### `screens/food/FoodOrdersScreen.tsx`

Order history aur reorder screen.

- Current user ke orders `restaurant_Orders` se fetch karti hai.
- `mode="history"` me sab orders.
- `mode="reorder"` me sirf delivered orders.
- Delivered orders par reorder CTA available hai.
- Reorder old items ko cart me dubara inject karta hai.
- Active / non-cancelled order card tap par tracking open hoti hai.

### `firebase/foodFirebase.ts`

Central food Firebase service file.

Collections:

- `registerRestaurant`
- `restaurant_categories`
- `restaurant_menu`
- `restaurant_menuAddons`

Key responsibilities:

- Active restaurants fetch/listen
- Categories fetch/listen
- Menu fetch/listen
- Add-ons fetch
- All menu items search support

Important note:
Is file me menu and addon `price` types strings ke form me define hain, lekin UI me kai jagah numeric math ho rahi hai. Current code `Number(...)` conversions use karta hai jahaan needed hai.

### `App.tsx`

Food module ka navigation registration yahan hota hai.

Main food stacks:

- `FoodHomeStack`
- `FoodCartStack`
- `FoodMenuStack`
- `FoodHistoryTabStack`

Bottom food tabs:

- `FoodRestaurants`
- `FoodMenu`
- `FoodCartTab`
- `FoodHistoryTab`

Provider integration:

- `FoodCartProvider` app ke provider tree me wrap kiya gaya hai.

Mode switching:

- App level par `activeMode === "food"` hone par food experience visible hota hai.

## End-to-End User Flow

### Browse to order

1. User food mode open karta hai.
2. `FoodScreen` restaurants aur categories load karti hai.
3. User search, category, ya restaurant card select karta hai.
4. `DishModal` dish details, variants, aur add-ons dikhata hai.
5. Item cart me add hota hai.
6. User cart footer ya cart tab open karta hai.
7. `FoodCartScreen` bill review karata hai.
8. User checkout proceed karta hai.
9. `FoodCheckoutScreen` address and payment confirm karti hai.
10. Firestore me order save hota hai.
11. Success screen se tracking start hoti hai.

### Post-order flow

1. `FoodTrackingScreen` order status show karti hai.
2. Rider assigned hone par map aur call button show hota hai.
3. Delivered hone par review modal open hota hai.
4. Review save hone ke baad user food home par redirect hota hai.

### Reorder flow

1. User history tab open karta hai.
2. Delivered order par `Reorder` press karta hai.
3. Cart purane items se refill hota hai.
4. User checkout dubara complete kar sakta hai.

## Firebase Data Model Summary

### `registerRestaurant`

Restaurant master data.

- `restaurantName`
- `ownerName`
- `phone`
- `address`
- `isActive`
- `accountEnabled`
- `profileImage`
- `type`

### `restaurant_categories`

Food categories with restaurant mapping.

- `name`
- `image`
- `isActive`
- `companyIds`

### `restaurant_menu`

Menu items.

- `name`
- `description`
- `price`
- `category`
- `categoryId`
- `restaurantId`
- `available`
- `variants`
- `image` or `imageUrl`

### `restaurant_menuAddons`

Optional add-ons.

- `name`
- `description`
- `price`
- `menuItemId`
- `menuItemName`
- `restaurantId`
- `available`
- `image` or `imageUrl`

### `restaurant_Orders`

Placed customer orders.

- `userId`
- `restaurantId`
- `restaurantName`
- `items`
- `subtotal`
- `deliveryFee`
- `taxes`
- `grandTotal`
- `paymentMethod`
- `deliveryAddress`
- `deliveryLat`
- `deliveryLng`
- `status`
- `orderId`
- `createdAt`

### `restaurant_Reviews`

Post-delivery customer reviews.

- `orderId`
- `restaurantId`
- `restaurantName`
- `userId`
- `rating`
- `review`
- `createdAt`

## Demo Script

### Demo goal

Show that app me complete food ordering lifecycle already implemented hai.

### Suggested demo sequence

1. Food home open karo.
2. Top hero area me location + veg/non-veg theme toggle dikhayo.
3. Horizontal categories aur restaurant cards explain karo.
4. Search screen kholo aur dish + restaurant combined search dikhayo.
5. Kisi category ya restaurant se `DishModal` kholo.
6. Variant aur add-on selection dikhayo.
7. Item cart me add karo.
8. Cart screen par bill breakdown explain karo.
9. Checkout screen par address + payment options dikhayo.
10. Order place flow explain karo.
11. Success se tracking screen kholo.
12. Tracking map, rider assignment, status stepper, bill toggle dikhayo.
13. History tab me jaake previous orders aur reorder CTA explain karo.

## Demo Talking Points

- Food module real-time Firebase listeners use karta hai.
- Search, category discovery, aur restaurant browsing tino paths available hain.
- Cart single-restaurant logic follow karta hai, jo food delivery apps me common rule hai.
- Variants aur add-ons supported hain.
- Order placement ke baad live tracking + rider contact available hai.
- Delivered order ke baad review capture bhi built-in hai.
- History aur reorder flow retention ke liye useful hai.

## Key Strengths

- End-to-end customer flow complete hai.
- Realtime data architecture already in place hai.
- UI dedicated food app jaisa feel deti hai.
- Shared food cart state consistent hai.
- Tracking aur review experience module ko production-like banata hai.

## Current Gaps / Observations

- `FoodScreen` se main interaction `DishModal` based hai; restaurant detail page less prominent hai.
- `FoodCartContext` item uniqueness mostly `id` par depend karti hai; add-on combinations same base id ke case me merge behavior ko future me aur granular banana pad sakta hai.
- `firebase/foodFirebase.ts` me `price` type string defined hai, jabki UI calculations numbers expect karti hain.
- Tracking status normalization UI level par ho raha hai; backend status values consistent rehna important hai.
- Payment UI multiple options dikhati hai, lekin order placement currently direct Firestore write hai; real payment gateway flow yahan integrated nahi hai.

## Best One-Line Summary

Food module is project me discovery se delivery tracking tak ka complete customer ordering system provide karta hai, jisme browsing, search, variants, add-ons, cart, checkout, live tracking, review, aur reorder sab included hain.
