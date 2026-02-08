# Why the error happens
The error occurs because [ProfileScreen.tsx](file:///c:/app/NinjaDeliveriesCustomer/screens/ProfileScreen.tsx#L436-L491) is rendered under `RootStack -> Profile`, but `HomeTab` is **not** a route in that navigator. `HomeTab` exists inside `RootStack -> AppTabs` ([App.tsx](file:///c:/app/NinjaDeliveriesCustomer/App.tsx#L788-L814) and [App.tsx](file:///c:/app/NinjaDeliveriesCustomer/App.tsx#L538-L606)).

So this call fails:
- `navigation.navigate("HomeTab", { screen: "RatingScreen", params: { orderId } })`

# Fix (minimal, no other behavior changes)
## 1) Update only ProfileScreen navigation
In [ProfileScreen.tsx](file:///c:/app/NinjaDeliveriesCustomer/screens/ProfileScreen.tsx#L456-L487), change each `navigation.navigate("HomeTab", …)` to navigate through the root route `AppTabs`:
- `navigation.navigate("AppTabs", { screen: "HomeTab", params: { screen: "RatingScreen", params: { orderId } } })`

Apply the same wrapper for the other order-status routes in that function (`OrderAllocating`, `OrderCancelled`, `OrderTracking`) so “Go To Order” works for all statuses.

## 2) Verify
- Tap “Go To Order” for a `tripEnded` order → opens `RatingScreen`.
- Tap “Go To Order” for pending/cancelled/active orders → opens the correct screens.

After you confirm, I will implement this as a small change only in [ProfileScreen.tsx](file:///c:/app/NinjaDeliveriesCustomer/screens/ProfileScreen.tsx).