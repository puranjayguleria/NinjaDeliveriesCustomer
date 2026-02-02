# Worker Availability System

This document describes the implementation of the real-time worker availability system for service bookings.

## Overview

The system ensures that only companies with available workers are shown to users, and provides real-time availability checking for specific time slots.

## Key Features

### 1. Real-time Availability Checking
- Checks worker availability for specific date and time slots
- Filters out companies where all workers are busy
- Updates availability status automatically

### 2. Company Visibility Logic
Companies are only visible in the app if:
- Company is active (`isActive: true`)
- Service is active (`serviceActive: true`)
- At least one worker is available for selected time
- Available for booking flag is true (`availableForBooking: true`)

### 3. Database Collections

#### `service_availability` Collection
```javascript
{
  companyId: "company123",
  serviceId: "service456", 
  date: "2026-02-04",
  time: "10:00 AM - 12:00 PM",
  available: true,
  availableWorkers: 2,
  totalWorkers: 3,
  utilizationRate: "33.3",
  lastUpdated: timestamp,
  reason: "WORKERS_AVAILABLE"
}
```

#### Updated `service_services` Collection
```javascript
{
  // ... existing fields
  availableForBooking: true,  // NEW FIELD
  lastAvailabilityCheck: timestamp,
  availabilityReason: "WORKERS_AVAILABLE"
}
```

## Implementation Files

### Core Services
- `services/firestoreService.ts` - Main availability checking functions
- `utils/availabilityUtils.ts` - Utility functions for availability operations
- `utils/testAvailabilitySystem.ts` - Testing utilities

### UI Components
- `components/AvailabilityIndicator.tsx` - Shows availability status
- `components/TimeSlotPicker.tsx` - Time slot selection with availability
- `components/ServiceCard.tsx` - Service card with availability info

### Updated Screens
- `screens/CompanySelectionScreen.tsx` - Real-time availability filtering
- `screens/SelectDateTimeScreen.tsx` - Availability checking mode
- `screens/ServicesScreen.tsx` - Category availability display

## Key Functions

### `checkRealTimeAvailability(serviceId, date, time, location)`
Checks real-time availability for a service at specific date/time.

**Returns:**
```javascript
{
  available: boolean,
  availableCompanies: number,
  companies: ServiceCompany[],
  suggestions?: string[]
}
```

### `checkCompanyWorkerAvailability(companyId, date, time)`
Checks if a company has available workers for specific time slot.

### `getBusyWorkersCount(companyId, date, time)`
Returns count of workers busy at specific time by checking active bookings.

### `updateServiceAvailability(companyId, serviceId, date, time)`
Updates availability record in `service_availability` collection.

## Usage Examples

### 1. Check Service Availability
```javascript
import { AvailabilityUtils } from './utils/availabilityUtils';

const availability = await AvailabilityUtils.checkRealTimeAvailability(
  'service123',
  '2026-02-04', 
  '10:00 AM - 12:00 PM'
);

if (availability.available) {
  // Show available companies
  console.log(`${availability.availableCompanies} companies available`);
} else {
  // Show no availability message
  AvailabilityUtils.showNoAvailabilityMessage(availability.data?.suggestions);
}
```

### 2. Filter Companies by Availability
```javascript
// In CompanySelectionScreen
const availableCompanies = await filterCompaniesWithAvailability(
  allCompanies, 
  true // Check specific time slot
);
```

### 3. Time Slot Selection with Availability
```javascript
// In TimeSlotPicker component
const handleTimeSelect = async (time) => {
  const availability = await AvailabilityUtils.checkRealTimeAvailability(
    selectedService.id,
    selectedDate, 
    time
  );
  
  if (availability.available) {
    onTimeSelect(time);
  } else {
    showUnavailableMessage(availability.suggestions);
  }
};
```

## Testing

### Automated Tests
Run availability system tests:
```javascript
import { runAvailabilityTests } from './utils/testAvailabilitySystem';

const results = await runAvailabilityTests();
```

### Manual Testing Scenarios

#### Test 1: All Workers Busy
- Expected: Company should not appear in app
- Check: `checkCompanyWorkerAvailability()` returns `false`

#### Test 2: Some Workers Available  
- Expected: Company appears with availability count
- Check: `checkCompanyWorkerAvailability()` returns `true`

#### Test 3: Worker Gets Assigned
- Expected: Availability updates automatically
- Check: Availability changes after booking creation

#### Test 4: Booking Completed
- Expected: Worker becomes available again
- Check: Availability updates after booking completion

### API Testing Commands
```javascript
// Force refresh availability
POST /api/refresh-availability
{
  "companyId": "company123",
  "serviceId": "service456"
}

// Check specific time slot
POST /api/check-availability  
{
  "companyId": "company123",
  "serviceId": "service456",
  "date": "2026-02-04",
  "time": "10:00 AM - 12:00 PM"
}
```

## UI Changes

### Service Cards
- Show availability indicator (✅ Available / ❌ Not Available)
- Display number of available providers
- Disable booking button when no providers available

### Time Slot Selection
- Real-time availability check when selecting time
- Show "All Busy" status for unavailable slots
- Provide suggestions for alternative times

### Company Selection
- Filter companies by worker availability
- Show availability status for selected date/time
- Option to check availability for specific time slots

## Error Handling

The system gracefully handles errors by:
- Assuming no availability if checks fail (safe default)
- Providing fallback suggestions when no providers available
- Logging detailed error information for debugging
- Continuing operation even if availability data is unavailable

## Performance Considerations

- Availability checks are cached where possible
- Batch operations for multiple companies
- Efficient Firestore queries with proper indexing
- Real-time updates only when necessary

## Future Enhancements

1. **Push Notifications**: Notify users when availability changes
2. **Predictive Availability**: Use ML to predict busy periods
3. **Dynamic Pricing**: Adjust prices based on availability
4. **Waitlist System**: Allow users to join waitlist for busy slots
5. **Worker Scheduling**: Advanced scheduling system for workers