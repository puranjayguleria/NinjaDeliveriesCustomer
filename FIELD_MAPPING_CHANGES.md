# Field Name Consistency Changes

## Overview
Updated the rating system to use consistent field names between `service_bookings` and `serviceRatings` collections.

## Field Name Changes

### Before (Inconsistent)
- **service_bookings**: `workerId`, `workerName`
- **serviceRatings**: `technicianId`, `technicianName`

### After (Consistent)
- **service_bookings**: `workerId`, `workerName` (primary) + `technicianId`, `technicianName` (legacy support)
- **serviceRatings**: `workerId`, `workerName` (matches service_bookings)

## Database Structure

### service_bookings Collection
```json
{
  "bookingId": "abc123",
  "workerId": "ovAdx5uUQRnqq2Y6a7M7",
  "workerName": "LAKSHAY SAINI",
  "technicianId": "ovAdx5uUQRnqq2Y6a7M7",  // Legacy support
  "technicianName": "LAKSHAY SAINI",        // Legacy support
  "serviceName": "Electrical",
  "status": "completed"
}
```

### serviceRatings Collection (Updated)
```json
{
  "bookingId": "abc123",
  "workerId": "ovAdx5uUQRnqq2Y6a7M7",      // Now matches service_bookings
  "workerName": "LAKSHAY SAINI",            // Now matches service_bookings
  "rating": 5,
  "feedback": "Excellent service!",
  "customerId": "customer123",
  "serviceName": "Electrical"
}
```

## Code Changes Made

### 1. FirestoreService.ts
- Updated `submitBookingRating()` to use `workerId` and `workerName` in rating documents
- Enhanced field extraction to prioritize `workerId`/`workerName` over legacy fields
- Added backward compatibility for existing `technicianId`/`technicianName` fields
- Updated logging to reflect new field names

### 2. TrackBookingScreen.tsx
- Updated UI to display `workerName` with fallback to `technicianName`
- Enhanced rating display to show worker information consistently

### 3. ServiceBooking Interface
- Added `workerName` and `workerId` as primary fields
- Kept `technicianName` and `technicianId` for backward compatibility

### 4. Debug Utilities
- Updated `debugRatingTechnician.ts` to check both new and legacy fields
- Enhanced logging to show field mapping and fallback logic
- Added methods to fix missing worker information

## Fallback Logic

The system now uses this priority order for worker information:

1. **Primary**: `workerId` and `workerName` (actual database fields)
2. **Legacy**: `technicianId` and `technicianName` (backward compatibility)
3. **Company Fallback**: Company name from `companyId`
4. **Service Fallback**: "[Service Name] Provider"

## Benefits

1. **Consistency**: Both collections now use the same field names
2. **Backward Compatibility**: Existing code using `technicianId`/`technicianName` still works
3. **Data Integrity**: Worker information is now properly captured and displayed
4. **Future-Proof**: New ratings will use the correct field names

## Migration Notes

- Existing ratings with `technicianId`/`technicianName` will continue to work
- New ratings will be created with `workerId`/`workerName`
- The system handles both field name formats seamlessly
- No data migration required - the system adapts automatically

## Testing

Use the debug utilities to verify the changes:

```typescript
// Debug worker info extraction
await RatingTechnicianDebug.debugTechnicianRating('booking-id');

// Test rating submission with new field names
await RatingTechnicianDebug.testRatingWithTechnician('booking-id', 5, 'Great work!');

// Fix missing worker info in bookings
await RatingTechnicianDebug.fixBookingWorkerInfo('booking-id', 'worker123', 'John Smith');
```