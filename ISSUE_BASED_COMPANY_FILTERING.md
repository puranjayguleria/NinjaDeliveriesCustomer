# Issue-Based Company Filtering

This document explains how companies are now filtered based on the specific service issues selected by users.

## How It Works

### 1. Service Issue Selection
- User selects service category (e.g., "Electrician")
- User selects specific issues (e.g., "Fan Not Working", "Wiring & Short Circuit")
- Selected issue IDs are passed to the company selection screen

### 2. Company Filtering Logic
The system uses a multi-step approach to find relevant companies:

```
User Selects Issues → Find Companies That Provide Those Services → Display Filtered Companies
```

### 3. Firestore Data Relationship
```
service_services collection:
{
  id: "issue_id",
  name: "Fan Not Working",
  categoryMasterId: "electrician_category_id",
  companyId: "company_that_provides_this_service",  // KEY LINK
  isActive: true
}

service_company collection:
{
  id: "company_id",
  companyName: "Ninja Electric Service",
  ownerName: "John Doe",
  isActive: true
}
```

## Implementation Details

### 1. Enhanced FirestoreService Methods

#### `getCompaniesByServiceIssues(issueIds: string[])`
- Takes array of selected issue IDs
- Finds all service issues with those IDs
- Extracts unique company IDs from those issues
- Fetches companies that provide those specific services
- Handles Firestore's 10-item limit for 'in' queries with batching

#### `getCompaniesByCategory(categoryId: string)`
- Fallback method when no specific issues are selected
- Finds all issues in a category
- Returns companies that provide any service in that category

### 2. Updated CompanySelectionScreen
- Receives `selectedIssueIds` parameter
- Calls appropriate filtering method based on available data
- Shows filtered company count in subtitle
- Displays empty state if no companies found
- Includes retry functionality

### 3. Updated ServiceCategoryScreen
- Passes both issue titles and issue IDs to company selection
- Enables precise company filtering based on user selections

## User Experience Flow

1. **Service Selection**: User picks "Electrician" category
2. **Issue Selection**: User selects "Fan Not Working" and "Wiring Issues"
3. **Company Filtering**: System finds companies that provide these specific services
4. **Company Display**: Shows only relevant companies with count
5. **Fallback Handling**: If no companies found, shows helpful message

## Benefits

### ✅ **Precise Matching**
- Shows only companies that actually provide the selected services
- Eliminates irrelevant service providers
- Improves user experience with targeted results

### ✅ **Real-time Updates**
- When new companies are added to specific services in Firestore, they appear automatically
- When companies are removed from services, they're filtered out immediately

### ✅ **Scalable Architecture**
- Handles large numbers of companies and services efficiently
- Batches Firestore queries to respect limits
- Optimized for performance with minimal queries

### ✅ **Fallback System**
- Shows category-based companies if no issue-specific companies found
- Shows all companies if no category-specific companies found
- Always provides options to users

## Configuration in Firestore

### To Add a Company to Specific Services:
1. Create/update documents in `service_services` collection
2. Set the `companyId` field to link the service to the company
3. Ensure `isActive: true` for both service and company

### Example Service Issue Document:
```javascript
{
  name: "Fan Not Working",
  categoryMasterId: "electrician_category_id",
  companyId: "ninja_electric_company_id",  // Links to specific company
  isActive: true,
  serviceType: "admin",
  price: 200
}
```

## Error Handling

- **No Companies Found**: Shows empty state with retry option
- **Firestore Errors**: Falls back to broader company search
- **Network Issues**: Provides retry functionality
- **Invalid Data**: Gracefully handles missing company IDs

## Testing Scenarios

1. **Select Single Issue**: Verify only companies providing that service appear
2. **Select Multiple Issues**: Verify companies providing any of those services appear
3. **No Companies for Issues**: Verify fallback to category-based companies
4. **Add New Company**: Add company to service in Firestore, verify it appears
5. **Remove Company**: Set company `isActive: false`, verify it disappears

## Future Enhancements

- **Service Pricing**: Show prices for specific services from each company
- **Service Availability**: Check if company is currently available for selected services
- **Service Ratings**: Show ratings specific to the selected service types
- **Geographic Filtering**: Combine with location-based filtering
- **Service Packages**: Show bundled service offerings from companies

This implementation ensures users see only the most relevant service providers for their specific needs, creating a more targeted and efficient service booking experience.