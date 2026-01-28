# Track Booking Feature Guide

## Overview
The Track Booking feature provides real-time tracking of service bookings with configurable behavior based on booking type. Users can monitor their booking status, see estimated arrival times, and interact with technicians.

## Features
- **Real-time Status Updates**: Live tracking of booking progress through multiple stages
- **Configurable Behavior**: Different settings for different service types
- **Interactive Timeline**: Visual progress indicator with timestamps
- **Technician Communication**: Call functionality and contact details
- **Cancellation Management**: Configurable cancellation policies
- **ETA Display**: Estimated arrival times for applicable services

## Navigation Flow
1. **BookingDetailsScreen** → "Track Booking" button → **TrackBookingScreen**
2. **BookingHistoryScreen** → Click any booking card → **TrackBookingScreen**

## Booking Status Progression
1. **Confirmed** - Booking has been confirmed
2. **Assigned** - Technician has been assigned
3. **On the Way** - Technician is traveling to location
4. **Arrived** - Technician has reached the location
5. **In Progress** - Service work has started
6. **Completed** - Service has been finished
7. **Cancelled** - Booking was cancelled

## Configuration System

### Booking Types
- `electrician` - Electrical repair services
- `plumber` - Plumbing services
- `cleaning` - Cleaning services
- `health` - Health and wellness services
- `dailywages` - Daily wage worker services
- `carwash` - Car washing services

### Configuration Options
Each booking type can be configured with:

```typescript
interface TrackingConfig {
  estimatedDuration: number;     // Service duration in minutes
  statusUpdateInterval: number;  // Update frequency in seconds
  showETA: boolean;             // Show estimated arrival time
  allowCancellation: boolean;   // Allow booking cancellation
  technicianCallEnabled: boolean; // Enable call technician feature
}
```

### Default Configurations
- **Electrician**: 2 hours, 10s updates, ETA shown, cancellable, call enabled
- **Plumber**: 1.5 hours, 10s updates, ETA shown, cancellable, call enabled
- **Cleaning**: 3 hours, 15s updates, ETA shown, cancellable, call enabled
- **Health**: 1 hour, 5s updates, ETA shown, NOT cancellable, call enabled
- **Daily Wages**: 8 hours, 30s updates, NO ETA, cancellable, call enabled
- **Car Wash**: 45 minutes, 5s updates, ETA shown, cancellable, call enabled

## Customization

### Adding New Booking Types
1. Update the `BookingType` union in `utils/trackingConfig.ts`
2. Add configuration in `TRACKING_CONFIGS` object
3. Update service selection screens to pass the correct `bookingType`

### Modifying Configurations
Edit the `TRACKING_CONFIGS` object in `utils/trackingConfig.ts`:

```typescript
export const TRACKING_CONFIGS: Record<BookingType, TrackingConfig> = {
  electrician: {
    estimatedDuration: 120,
    statusUpdateInterval: 10,
    showETA: true,
    allowCancellation: true,
    technicianCallEnabled: true,
  },
  // ... other configurations
};
```

### Custom Status Messages
Modify the `getStatusMessage()` function in `TrackBookingScreen.tsx` to customize status descriptions.

## Integration Points

### Required Parameters
When navigating to TrackBookingScreen, pass these parameters:
```typescript
navigation.navigate("TrackBooking", {
  bookingId: string,
  serviceTitle: string,
  selectedDate: string,
  selectedTime: string,
  company?: { name: string },
  agency?: { name: string },
  issues?: string[],
  totalPrice?: number,
  bookingType: BookingType,
  paymentMethod?: string,
  notes?: string,
});
```

### API Integration
For production use, replace the simulated status updates with real API calls:
1. Remove the `useEffect` with `setInterval` in `TrackBookingScreen.tsx`
2. Add API polling or WebSocket connection for real-time updates
3. Update `currentStatus`, `estimatedArrival`, `technicianName`, and `technicianPhone` from API responses

### Database Schema
Ensure your booking database includes:
- `booking_id` (string)
- `status` (enum: confirmed, assigned, on_the_way, arrived, in_progress, completed, cancelled)
- `technician_name` (string)
- `technician_phone` (string)
- `estimated_arrival` (datetime)
- `booking_type` (enum matching BookingType)

## UI Customization

### Colors and Styling
Modify the `styles` object in `TrackBookingScreen.tsx` to match your app's design system.

### Icons
Update the `TrackingStep.icon` values to use different Ionicons or custom icons.

### Timeline Steps
Customize the `generateTrackingSteps()` function to add/remove/modify tracking stages.

## Testing
1. Navigate to any booking from BookingDetailsScreen or BookingHistoryScreen
2. Observe automatic status progression (every 10-30 seconds based on booking type)
3. Test call technician functionality
4. Test cancellation (varies by booking type)
5. Verify ETA display for applicable booking types

## Future Enhancements
- GPS tracking integration
- Push notifications for status updates
- Photo/video updates from technicians
- Rating and feedback system
- Multi-language support
- Offline mode support