# Services Tab Location Restriction

## Overview
This feature allows you to show the Services tab in specific locations (like Tanda) but prevent users from accessing it by showing an alert modal when they click on it.

## Implementation
The restriction is implemented in `App.tsx` in the Services tab listener. When a user clicks the Services tab, the app checks if their current `storeId` is in the restricted list.

## Configuration

### Current Configuration
- **Tanda Store ID**: `i0h9WGnOlkhk0mD4Lfv3` (identified from console logs)
- **Restriction**: Active for Tanda location

### How to Add More Restricted Locations
In `App.tsx`, find this line (around line 712):
```javascript
const restrictedStoreIds = ["i0h9WGnOlkhk0mD4Lfv3"]; // Tanda storeId
```

Add more storeIds to restrict additional locations:
```javascript
const restrictedStoreIds = ["i0h9WGnOlkhk0mD4Lfv3", "another_store_id"];
```

### Customize Alert Message (Optional)
You can customize the alert message by modifying these lines in `App.tsx`:
```javascript
Alert.alert(
  "Services Not Available", // Title
  "Services are currently not available in your location. Please try again later.", // Message
  [{ text: "OK", style: "default" }] // Button
);
```

## How It Works
1. **Tab Visibility**: The Services tab remains visible in all locations including Tanda
2. **Click Behavior**: 
   - In Tanda (`i0h9WGnOlkhk0mD4Lfv3`): Shows alert modal, prevents navigation to Services screen
   - In other locations: Normal behavior - shows loader then navigates to Services screen
3. **Location Detection**: Uses `location.storeId` from LocationContext to identify current location

## Testing Results
✅ **Tanda Store ID Identified**: `i0h9WGnOlkhk0mD4Lfv3`
✅ **Console Logging**: Working correctly
✅ **Implementation**: Ready for testing

## Next Steps
1. Test clicking Services tab in Tanda location - should show alert
2. Test clicking Services tab in other locations - should work normally
3. Remove debug console.log if desired (line with `console.log("[Services Tab] Current storeId:")`)

## Troubleshooting
- If alert doesn't show in Tanda, verify the storeId `i0h9WGnOlkhk0mD4Lfv3` is correct
- If Services tab doesn't work in other locations, ensure those storeIds are NOT in the `restrictedStoreIds` array
- Check console logs for debugging information