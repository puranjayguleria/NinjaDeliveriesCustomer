# Package Booking Implementation

## Overview
Added package tracking to `service_bookings` collection to identify whether a booking is for a package (monthly/weekly service packages).

## Changes Made

### 1. Updated ServiceBooking Interface (`services/firestoreService.ts`)

Added the following fields to track package information:

```typescript
// Package information (for monthly/weekly service packages)
isPackage?: boolean; // Whether this booking is for a package
packageId?: string; // Package ID from service_services
packageName?: string; // Package name (e.g., "Monthly Package", "Weekly Package")
packageType?: 'monthly' | 'weekly' | 'custom'; // Package frequency type
packagePrice?: number; // Package price
packageDuration?: string; // Package duration description
packageDescription?: string; // Package description
```

### 2. Updated Booking Creation (`screens/ServiceCheckoutScreen.tsx`)

Modified the booking creation logic to automatically include package information when available:

```typescript
// Package information (if this is a package booking)
...(service.additionalInfo?.package && {
  isPackage: true,
  packageId: service.additionalInfo.package.id || "",
  packageName: service.additionalInfo.package.name || "",
  packageType: (service.additionalInfo.package.name?.toLowerCase().includes('monthly') ? 'monthly' : 
               service.additionalInfo.package.name?.toLowerCase().includes('weekly') ? 'weekly' : 
               'custom') as 'monthly' | 'weekly' | 'custom',
  packagePrice: service.additionalInfo.package.price || service.totalPrice || 0,
  packageDuration: service.additionalInfo.package.duration || "",
  packageDescription: service.additionalInfo.package.description || "",
}),
```

## How It Works

1. **Package Selection**: When a user selects a package in `CompanySelectionScreen`, the package info is stored in `service.additionalInfo.package` with all available fields including:
   - `id`: Package ID
   - `name`: Package name
   - `price`: Package price
   - `description`: Package description
   - `duration`: Package duration (e.g., "1-2 hours", "4 visits per month")
   - `unit`: Package unit (month, week, year, day)
   - `frequency`: Package frequency (monthly, weekly, etc.)
   - `type`: Package type

2. **Cart Storage**: The complete package information is preserved in the service cart item's `additionalInfo` field

3. **Booking Creation**: When creating a booking in `ServiceCheckoutScreen`, the system:
   - Checks if `service.additionalInfo.package` exists
   - If yes, sets `isPackage: true` and populates all package fields
   - Automatically determines `packageType` using:
     - First priority: `unit` or `frequency` fields (month → monthly, week → weekly)
     - Fallback: Package name detection (contains "monthly"/"month" → monthly, "weekly"/"week" → weekly)
     - Default: "custom" for other types

4. **Database Storage**: All package fields are saved to the `service_bookings` collection in Firestore

## Package Type Detection

The system automatically detects package type with improved accuracy:

**Priority 1 - Explicit Fields:**
- **monthly**: If `package.unit === 'month'` OR `package.frequency === 'monthly'`
- **weekly**: If `package.unit === 'week'` OR `package.frequency === 'weekly'`

**Priority 2 - Name-based Detection (Fallback):**
- **monthly**: If package name contains "monthly" or "month"
- **weekly**: If package name contains "weekly" or "week"
- **custom**: For any other package types

This two-tier detection ensures accurate classification even if the package name doesn't explicitly mention the frequency.

## Fields in Database

When a booking is created with a package, these fields will appear in `service_bookings`:

- `isPackage`: `true`
- `packageId`: The package ID
- `packageName`: e.g., "Monthly Package", "Weekly Package"
- `packageType`: `"monthly"`, `"weekly"`, or `"custom"`
- `packagePrice`: The package price
- `packageDuration`: Package duration description (if available)
- `packageDescription`: Package description (if available)

## Example Booking Document

```json
{
  "id": "booking_123",
  "serviceName": "Home Cleaning",
  "isPackage": true,
  "packageId": "pkg_456",
  "packageName": "Monthly Cleaning Package",
  "packageType": "monthly",
  "packagePrice": 2000,
  "packageDuration": "4 visits per month",
  "packageDescription": "Complete home cleaning service",
  "status": "pending",
  "date": "2026-02-10",
  "time": "10:00 AM",
  ...
}
```

## Benefits

1. **Easy Filtering**: Can now filter bookings by package type (monthly/weekly)
2. **Analytics**: Track package vs regular bookings
3. **Website Integration**: Website can display package information
4. **Reporting**: Generate reports on package bookings
5. **Worker Assignment**: Workers can see if a booking is part of a package

## Testing

To test the implementation:
1. Select a service with packages in the app
2. Choose a monthly or weekly package
3. Complete the booking
4. Check the `service_bookings` collection in Firestore
5. Verify that `isPackage: true` and all package fields are present
