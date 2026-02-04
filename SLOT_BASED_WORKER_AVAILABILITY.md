# Slot-Based Worker Availability System

## Overview

This document describes the implementation of a slot-based worker availability system that shows workers according to time slots with the following business logic:

1. **Slot-based worker display** - Show workers according to time slots
2. **Hide unavailable companies** - Companies with no workers or all workers busy are completely hidden
3. **Show only available companies** - Only companies with available workers are displayed

## Key Features

### 1. Enhanced Availability Checking
- **Real-time slot availability**: Checks actual worker bookings for specific time slots
- **Service-specific filtering**: Only shows companies that have workers for the requested service
- **Worker capacity management**: Supports multiple bookings per worker per slot
- **Working hours validation**: Respects worker schedules and working days

### 2. Smart Company Filtering
- **Available**: Shows only companies with available workers
- **All Workers Busy**: Companies are hidden (not shown)
- **Service Disabled**: Companies are hidden (not shown)
- **No Workers**: Companies are hidden (not shown)

### 3. Visual Status Indicators
- **Green badge**: Workers available
- **Red badge**: All workers busy
- **Worker count**: Shows "X of Y workers available"
- **Status messages**: Clear availability messaging

## Implementation Files

### Core Files
- `services/firestoreService.ts` - Enhanced availability checking methods
- `utils/workerAvailabilityUtils.ts` - Worker schedule and availability utilities
- `screens/CompanySelectionScreen.tsx` - Updated UI with availability status
- `components/SlotAvailabilityTester.tsx` - Testing component

### Test Files
- `utils/testSlotBasedAvailability.ts` - Comprehensive test suite

## Database Schema

### service_workers Collection
```javascript
{
  id: "worker_id",
  name: "राम कुमार",
  companyId: "company_id",
  services: ["electrician", "plumber"], // Services this worker can handle
  isActive: true,
  phone: "+91-9876543210",
  workingHours: {
    start: "09:00", // 24-hour format
    end: "18:00"
  },
  workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"],
  maxBookingsPerSlot: 1, // How many bookings per time slot
  createdAt: Date,
  updatedAt: Date
}
```

### service_bookings Collection
```javascript
{
  id: "booking_id",
  workerId: "worker_id",
  workerName: "राम कुमार",
  companyId: "company_id",
  date: "2026-02-05", // YYYY-MM-DD format
  time: "1:00 PM - 3:00 PM", // Time slot
  status: "assigned" | "started" | "completed" | "cancelled",
  // ... other booking fields
}
```

## API Methods

### FirestoreService.checkCompanyWorkerAvailability()
```typescript
static async checkCompanyWorkerAvailability(
  companyId: string, 
  date: string, 
  time: string, 
  serviceType?: string
): Promise<{
  available: boolean;
  status: 'available' | 'all_busy' | 'no_workers' | 'service_disabled';
  availableWorkers: number;
  totalWorkers: number;
  busyWorkers: string[];
}>
```

### FirestoreService.getCompaniesWithSlotAvailability()
```typescript
static async getCompaniesWithSlotAvailability(
  categoryId: string,
  selectedIssueIds: string[],
  date: string,
  time: string,
  serviceType?: string
): Promise<ServiceCompany[]>
```

### WorkerAvailabilityUtils.getCompanyAvailabilitySummary()
```typescript
static async getCompanyAvailabilitySummary(
  companyId: string,
  serviceType: string,
  date: string,
  timeSlot: string
): Promise<{
  status: 'available' | 'all_busy' | 'no_workers' | 'service_disabled';
  message: string;
  availableCount: number;
  totalCount: number;
  details: string[];
}>
```

## Usage Examples

### 1. Basic Availability Check
```typescript
const availability = await FirestoreService.checkCompanyWorkerAvailability(
  'company_123',
  '2026-02-05',
  '1:00 PM - 3:00 PM',
  'electrician'
);

console.log(availability);
// Output: { available: true, status: 'available', availableWorkers: 2, totalWorkers: 3, busyWorkers: ['worker_1'] }
```

### 2. Get Companies with Slot Availability
```typescript
const companies = await FirestoreService.getCompaniesWithSlotAvailability(
  'electrician_category',
  ['issue_1', 'issue_2'],
  '2026-02-05',
  '1:00 PM - 3:00 PM',
  'electrician'
);

companies.forEach(company => {
  console.log(`${company.companyName}: ${company.availabilityInfo.statusMessage}`);
});
```

### 3. Enhanced Availability Summary
```typescript
const summary = await WorkerAvailabilityUtils.getCompanyAvailabilitySummary(
  'company_123',
  'electrician',
  '2026-02-05',
  '1:00 PM - 3:00 PM'
);

console.log(summary.message); // "2 workers available"
```

## Time Slot Configuration

### Supported Time Slots
```javascript
const timeSlots = [
  "9:00 AM - 11:00 AM",
  "11:00 AM - 1:00 PM", 
  "1:00 PM - 3:00 PM",
  "3:00 PM - 5:00 PM",
  "5:00 PM - 7:00 PM",
  "7:00 PM - 9:00 PM"
];
```

### Time Format Conversion
- Input: "1:00 PM - 3:00 PM"
- Parsed: { startTime: "13:00", endTime: "15:00" }

## Business Logic Flow

### 1. Company Selection Screen
```
User selects date/time → 
System checks worker availability → 
Filter companies based on availability → 
Display with status indicators
```

### 2. Availability Status Logic
```
if (no workers for service) → Hide company
else if (all workers busy) → Hide company  
else if (workers available) → Show company with "X workers available"
```

### 3. Worker Assignment Logic
```
Check worker schedule → 
Check existing bookings → 
Check worker capacity → 
Determine availability
```

## Testing

### Run Tests
```typescript
import SlotAvailabilityTester from './utils/testSlotBasedAvailability';

// Run all tests
await SlotAvailabilityTester.runAllTests();

// Run specific test
await SlotAvailabilityTester.testBasicAvailability();
```

### Test Component
Add the `SlotAvailabilityTesterComponent` to any screen for interactive testing:

```typescript
import SlotAvailabilityTesterComponent from '../components/SlotAvailabilityTester';

// In your screen render method
<SlotAvailabilityTesterComponent />
```

## Configuration

### Worker Schedule Setup
1. Add workers to `service_workers` collection
2. Set `services` array with service types they can handle
3. Configure `workingHours` and `workingDays`
4. Set `maxBookingsPerSlot` for capacity management

### Company Service Setup
1. Ensure companies have workers in `service_workers`
2. Workers must have matching `companyId`
3. Workers must have required service in `services` array
4. Workers must be `isActive: true`

## Migration Guide

### Existing Data
- No changes required to existing booking data
- Add new fields to `service_workers` collection:
  - `services: string[]`
  - `workingHours: { start: string, end: string }`
  - `workingDays: string[]`
  - `maxBookingsPerSlot: number`

### Backward Compatibility
- System falls back to basic availability checking if enhanced data is missing
- Existing booking flow continues to work
- New features are additive, not breaking

## Performance Considerations

### Optimization
- Batch worker queries by company
- Cache availability results for short periods
- Use Firestore compound indexes for booking queries
- Limit concurrent availability checks

### Firestore Indexes Required
```
Collection: service_bookings
Fields: date, time, status
```

```
Collection: service_workers  
Fields: companyId, isActive, services
```

## Future Enhancements

### Planned Features
1. **Worker preferences**: Allow workers to set preferred time slots
2. **Dynamic pricing**: Adjust prices based on availability
3. **Advance booking**: Support booking weeks in advance
4. **Worker notifications**: Real-time availability updates
5. **Analytics**: Track availability patterns and optimize scheduling

### Scalability
- Consider Redis caching for high-traffic scenarios
- Implement worker availability webhooks
- Add real-time availability updates via WebSocket
- Support for multiple time zones

## Troubleshooting

### Common Issues
1. **No companies shown**: Check if workers exist and are active
2. **All workers busy**: Verify booking status and time slots
3. **Service not offered**: Ensure workers have correct service types
4. **Time parsing errors**: Verify time slot format consistency

### Debug Tools
- Use `SlotAvailabilityTester` for comprehensive testing
- Check console logs for detailed availability checking
- Verify Firestore data structure matches schema
- Test with sample data using provided utilities