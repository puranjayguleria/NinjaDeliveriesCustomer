# Connect Category Shortcuts to Firebase

I have found that the code already has a listener for a `category_shortcuts` collection in Firestore, but the UI is still using a hardcoded list. I will update the code to display the shortcuts from Firebase when they are available.

## **Technical Implementation**

### **1. Update UI to use Dynamic Data**
In [ProductsHomeScreen.tsx](file:///c:/app/NinjaDeliveriesCustomer/screens/ProductsHomeScreen.tsx), I will replace the hardcoded array in the `listHeader` with the `categoryShortcuts` state variable.

### **2. Implement Fallback Logic**
To ensure the app always looks good, I will:
- Use the shortcuts from Firebase if they exist.
- Fall back to the hardcoded list if the Firebase collection is empty or still loading.

### **3. Support Remote Images**
I will update the `Image` component to handle both local assets (using `require`) and remote URLs from Firebase.

### **4. Verification of Firebase Data**
For the shortcuts to show up from Firebase, please ensure your documents in the `category_shortcuts` collection have:
- `storeId`: Matching your current store ID.
- `enabled`: Set to `true` (boolean).
- `name`: The display name (e.g., "Offers").
- `image`: A remote URL (string) or local asset path.
- `bg`: A hex color string for the background (e.g., `"#963556ff"`).
- `priority`: A number for sorting order.

## **Next Steps**
I will now apply the changes to [ProductsHomeScreen.tsx](file:///c:/app/NinjaDeliveriesCustomer/screens/ProductsHomeScreen.tsx) to make the shortcuts dynamic.

**Do you want me to proceed with these changes?**
