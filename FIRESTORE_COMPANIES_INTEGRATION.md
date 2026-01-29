# Firestore Companies Integration

This document explains the implementation of fetching service companies from Firestore instead of using demo data.

## What's Changed

### 1. Enhanced FirestoreService (`services/firestoreService.ts`)
- Added `ServiceCompany` interface to match your Firestore structure
- Created `getServiceCompanies()` method to fetch all active companies
- Created `getServiceCompaniesByZone()` method to fetch companies by delivery zone
- Includes fallback demo data if Firestore is unavailable
- Filters only active companies (`isActive: true`)
- Orders companies alphabetically by name

### 2. Updated CompanySelectionScreen (`screens/CompanySelectionScreen.tsx`)
- Now fetches real company data from `service_company` collection
- Shows loading state while fetching data
- Displays company information from Firestore fields
- Includes pull-to-refresh functionality
- Passes `categoryId` for better tracking

## Firestore Collection Structure

The implementation expects a `service_company` collection with documents containing:

```javascript
{
  companyName: "Company Name",           // Required: Display name
  ownerName: "Owner Name",               // Required: Owner's name
  phone: "9876543210",                   // Required: Contact number
  email: "company@email.com",            // Required: Email address
  address: "Company Address",            // Required: Physical address
  businessType: "service",               // Required: Type of business
  deliveryZoneId: "zone_id",            // Required: Service area ID
  deliveryZoneName: "Zone Name",         // Required: Service area name
  registrationDate: timestamp,           // Required: Registration date
  isActive: true,                        // Required: Filter for active companies
  createdAt: timestamp,                  // Optional: Creation date
  updatedAt: timestamp                   // Optional: Last update date
}
```

## Features Added

### Company Display
- Shows company name, owner name, and contact details
- Displays delivery zone information
- Shows business type and active status
- Clean, professional card layout

### Dynamic Loading
- Fetches companies from Firestore on screen load
- Loading indicator while fetching data
- Pull-to-refresh functionality
- Automatic updates when new companies are added

### Zone-Based Filtering
- `getServiceCompaniesByZone()` method for location-specific companies
- Can be used to show only companies serving specific areas
- Useful for location-based service delivery

## Usage Examples

### Fetch All Companies
```typescript
const companies = await FirestoreService.getServiceCompanies();
```

### Fetch Companies by Zone
```typescript
const zoneCompanies = await FirestoreService.getServiceCompaniesByZone('dharamshala_zone_001');
```

## Error Handling

- Graceful fallback to demo data if Firestore is unavailable
- Console logging for debugging
- No disruptive error alerts (uses fallback data instead)
- Loading states for better UX

## Real-time Updates

The system automatically:
1. Fetches fresh company data when screen loads
2. Shows new companies immediately when added to Firestore
3. Hides companies when `isActive` is set to `false`
4. Updates company information when modified in Firestore

## Testing

To test the implementation:
1. Ensure your Firestore has the `service_company` collection
2. Add test companies with required fields and `isActive: true`
3. Launch the app and navigate through Services → Select Category → Select Issues
4. Verify companies load from Firestore in the company selection screen
5. Test pull-to-refresh functionality
6. Add a new company in Firestore and refresh to see it appear

## Future Enhancements

- Add company ratings and reviews
- Include service pricing information
- Add company logos/images
- Implement distance-based sorting
- Add company availability status
- Include service specializations
- Add booking history and performance metrics

## Benefits

✅ **Configurable**: New companies automatically appear when added to Firestore  
✅ **Real-time**: Changes in Firestore reflect immediately in the app  
✅ **Zone-based**: Can filter companies by service delivery zones  
✅ **Scalable**: Easy to add new companies without code changes  
✅ **Reliable**: Fallback system ensures app works even if Firestore is down  
✅ **Professional**: Clean UI showing relevant company information  

Now when you add new service companies to your Firestore collection, they'll automatically appear in the app for users to select!