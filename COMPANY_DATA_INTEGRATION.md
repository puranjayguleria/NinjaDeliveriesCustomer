# Company Data Integration - Firebase Only

## Overview
This document explains how company data is fetched and displayed in the app based on the service issues selected by users. **All data is fetched from Firebase Firestore - no demo data is used.**

## Company Data Structure
The company collection (`service_company`) contains the following fields:

```typescript
interface ServiceCompany {
  id: string;
  companyName: string;    // e.g., "Pokemon"
  name: string;           // Owner name, e.g., "Levi"
  phone: string;          // e.g., "9882238237"
  email: string;          // e.g., "levi7590@gmail.com"
  deliveryZoneId: string; // e.g., "0oS7Zig2gxj2MJesvIC2"
  deliveryZoneName: string; // e.g., "Dharamshala"
  type: string;           // e.g., "service"
  isActive: boolean;      // true/false
  createdAt: any;         // Firestore timestamp
}
```

## How Company Filtering Works

### 1. By Service Issues (Recommended)
When users select specific service issues, the app fetches companies that provide those exact services:

```typescript
// Get companies that provide specific services
const companies = await FirestoreService.getCompaniesByServiceIssues(selectedIssueIds);
```

**Process:**
1. Query `service_services` collection for selected issue IDs
2. Extract `companyId` from each service document
3. Query `service_company` collection for those company IDs
4. Return filtered companies

### 2. By Service Category
When no specific issues are selected, fetch companies that provide any service in the category:

```typescript
// Get companies that provide services in a category
const companies = await FirestoreService.getCompaniesByCategory(categoryId);
```

**Process:**
1. Query `service_services` collection for all services in the category
2. Extract unique `companyId` values
3. Query `service_company` collection for those company IDs
4. Return filtered companies

### 3. By Delivery Zone
Filter companies by their service area:

```typescript
// Get companies in a specific zone
const companies = await FirestoreService.getServiceCompaniesByZone(zoneId);
```

### 4. All Companies (Fallback)
If no filtering criteria are available:

```typescript
// Get all active companies
const companies = await FirestoreService.getServiceCompanies();
```

## Implementation Details

### Firestore Collections Used
- `service_company` - Company information
- `service_services` - Service issues/problems
- `service_categories_master` - Service categories

### Key Features
- **Firebase Only**: All data comes from Firestore - no demo/fallback data
- **Caching**: Service categories are cached for 5 minutes to improve performance
- **Batching**: Company queries are batched (max 10 per query) due to Firestore limitations
- **Error Handling**: Proper error messages when Firebase is unavailable
- **Empty States**: Graceful handling when no data is available

### Usage in Screens

#### CompanySelectionScreen
- Displays filtered companies based on selected service issues
- Shows company details: name, owner, phone, zone, service type
- Allows user to select a company for booking
- Shows empty state if no companies are available

#### Integration Flow
1. User selects service category (e.g., "Electrician")
2. User selects specific issues (e.g., "Fan Not Working", "Wiring")
3. App fetches companies that provide those specific services from Firebase
4. User selects a company
5. Booking process continues with selected company

## Error Handling
- **Network errors**: Show proper error messages to user
- **Empty results**: Show appropriate "No data available" messages
- **Retry functionality**: Allow users to retry failed requests
- **Loading states**: Show loading indicators during data fetch

## Performance Optimizations
- **Caching**: Service categories cached for 5 minutes
- **Client-side sorting**: Avoid Firestore index requirements
- **Batched queries**: Handle large datasets efficiently
- **Query limits**: Prevent excessive data fetching

## Important Notes
- **No Demo Data**: The app will show empty states if Firebase has no data
- **Internet Required**: App requires internet connection to fetch data
- **Active Only**: Only fetches active companies and services (`isActive: true`)
- **Real-time**: Data is fetched fresh on each screen load (except cached categories)