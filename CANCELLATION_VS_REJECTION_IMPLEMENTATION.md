# Cancellation vs Rejection Implementation

## Overview
This implementation distinguishes between user cancellation and admin rejection of service bookings in Firebase, providing clear separation and appropriate UI behavior for each scenario.

## Key Changes

### 1. Firebase Status Values
- **User Cancellation**: `status: "cancelled"`
- **Admin Rejection**: `status: "rejected"`

### 2. New Firebase Functions

#### `FirestoreService.cancelBookingByUser(bookingId, additionalData?)`
- Sets status to `"cancelled"`
- Adds `cancelledAt` timestamp
- Adds `cancelledBy: "user"` field
- Used when users cancel their own bookings

#### `FirestoreService.rejectBookingByAdmin(bookingId, additionalData?)`
- Sets status to `"rejected"`
- Adds `rejectedAt` timestamp  
- Adds `rejectedBy: "admin"` field
- Used when admins reject bookings

### 3. Updated Interface
```typescript
export interface ServiceBooking {
  // ... existing fields
  status: 'pending' | 'assigned' | 'started' | 'completed' | 'rejected' | 'cancelled' | 'expired' | 'reject';
  cancelledAt?: any;        // New field for user cancellation timestamp
  cancelledBy?: 'user' | 'admin';  // New field to track who cancelled
  rejectedBy?: 'user' | 'admin';   // New field to track who rejected
  // ... rest of fields
}
```

### 4. UI Behavior Changes

#### TrackBookingScreen
- **Cancelled bookings**: Show "Booking Cancelled by You" with orange remove-circle icon
- **Rejected bookings**: Show "Booking Rejected by Admin" with red close-circle icon
- **Alternative companies modal**: Only shows for admin rejections, not user cancellations

#### BookingHistoryScreen
- **New filter**: "Cancel" filter to show only user-cancelled bookings
- **Existing filter**: "Reject" filter now shows only admin-rejected bookings
- **Color coding**: Cancelled (orange), Rejected (red)

### 5. Updated Utility Functions

#### BookingUtils
- `getStatusColor()`: Returns orange for cancelled, red for rejected
- `getStatusText()`: Returns "Cancelled" vs "Rejected"
- `getStatusMessage()`: Different messages for each status
- `isActiveBooking()`: Excludes both cancelled and rejected
- `getNextStatus()`: Allows cancellation from pending/assigned states

### 6. Filtering Logic
```typescript
// Get only user-cancelled bookings
const cancelledBookings = await FirestoreService.getUserBookingsByStatus('cancelled');

// Get only admin-rejected bookings  
const rejectedBookings = await FirestoreService.getUserBookingsByStatus('rejected');
```

### 7. Legacy Status Handling
- `'reject'` → `'rejected'` (admin rejection)
- `'canceled'` (typo) → `'cancelled'` (user cancellation)
- Existing `'cancelled'` status is preserved (no longer converted to rejected)

## Usage Examples

### User Cancels Booking
```typescript
// In TrackBookingScreen or BookingHistoryScreen
await FirestoreService.cancelBookingByUser(booking.id);
// Result: status = "cancelled", cancelledBy = "user", cancelledAt = timestamp
```

### Admin Rejects Booking
```typescript
// In admin panel or backend
await FirestoreService.rejectBookingByAdmin(booking.id);
// Result: status = "rejected", rejectedBy = "admin", rejectedAt = timestamp
```

### Check Status in UI
```typescript
if (booking.status === 'cancelled') {
  // Show user cancellation UI (no alternative companies)
} else if (booking.status === 'rejected') {
  // Show admin rejection UI (with alternative companies modal)
}
```

## Benefits

1. **Clear Distinction**: Firebase clearly shows whether user cancelled or admin rejected
2. **Better UX**: Users see appropriate messages and options for each scenario
3. **Proper Workflow**: Alternative companies only offered for admin rejections
4. **Analytics**: Can track cancellation vs rejection rates separately
5. **Backward Compatible**: Handles legacy statuses gracefully

## Testing

Use the test utility to verify implementation:
```typescript
import CancellationVsRejectionTest from './utils/testCancellationVsRejection';

// Run all tests
await CancellationVsRejectionTest.runAllTests();

// Verify implementation
CancellationVsRejectionTest.verifyImplementation();
```

## Firebase Database Structure

### User Cancelled Booking
```json
{
  "id": "booking_123",
  "status": "cancelled",
  "cancelledAt": "2024-01-15T10:30:00Z",
  "cancelledBy": "user",
  "customerId": "user_456",
  "serviceName": "Electrical",
  // ... other fields
}
```

### Admin Rejected Booking  
```json
{
  "id": "booking_789", 
  "status": "rejected",
  "rejectedAt": "2024-01-15T11:45:00Z",
  "rejectedBy": "admin",
  "customerId": "user_456",
  "serviceName": "Plumbing",
  // ... other fields
}
```

This implementation provides a complete solution for distinguishing between user cancellation and admin rejection while maintaining backward compatibility and providing appropriate user experiences for each scenario.