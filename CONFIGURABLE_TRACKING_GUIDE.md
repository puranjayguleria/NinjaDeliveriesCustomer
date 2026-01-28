# Configurable Tracking System Guide

## Overview

The tracking system is now fully configurable and date-aware. It automatically adjusts status based on booking date/time and allows extensive customization for different service types.

## Key Features

### 1. **Date-Aware Status Logic**
- **Future bookings**: Show "Confirmed" status until the service day
- **Today's bookings**: Real-time progression based on time
- **Past bookings**: Show "Completed" status

### 2. **Service-Specific Configuration**
Each service type has different timing and behavior:

| Service | Assignment | Departure | Arrival | ETA | Cancellation |
|---------|------------|-----------|---------|-----|--------------|
| **Electrician** | 90 min before | 30 min before | 5 min before | ✅ | ✅ |
| **Plumber** | 60 min before | 20 min before | 5 min before | ✅ | ✅ |
| **Cleaning** | 120 min before | 45 min before | 10 min before | ✅ | ✅ |
| **Health** | 60 min before | 15 min before | 2 min before | ✅ | ❌ |
| **Daily Wages** | 180 min before | 60 min before | 15 min before | ❌ | ✅ |
| **Car Wash** | 30 min before | 10 min before | 2 min before | ✅ | ✅ |

### 3. **Configurable Progress Percentages**
- **Confirmed**: 10%
- **Assigned**: 25%
- **On the Way**: 50%
- **Arrived**: 70%
- **In Progress**: 85%
- **Completed**: 100%

## How to Test Different Scenarios

### Test Case 1: Tomorrow's Booking
```
Date: "Tomorrow"
Time: "10:00 AM - 12:00 PM"
Expected: Status = "Confirmed", Progress = 10%, Shows countdown
```

### Test Case 2: Today's Future Booking
```
Date: "Today"
Time: "6:00 PM - 8:00 PM" (if current time is 2:00 PM)
Expected: Status = "Confirmed", Progress = 10%
```

### Test Case 3: Today's Active Booking
```
Date: "Today"
Time: "2:00 PM - 4:00 PM" (if current time is 1:30 PM)
Expected: Status = "On the Way", Progress = 50%, Shows ETA
```

### Test Case 4: Past Booking
```
Date: "2024-01-25"
Time: "11:00 AM - 1:00 PM"
Expected: Status = "Completed", Progress = 100%
```

## Configuration Options

### 1. **Basic Configuration** (`utils/trackingConfig.ts`)
```typescript
export const TRACKING_CONFIGS: Record<BookingType, TrackingConfig> = {
  electrician: {
    estimatedDuration: 120,    // 2 hours
    statusUpdateInterval: 10,  // 10 seconds
    showETA: true,
    allowCancellation: true,
    technicianCallEnabled: true,
  },
  // ... other services
};
```

### 2. **Advanced Configuration** (`utils/trackingConfigManager.ts`)
```typescript
export const SERVICE_CONFIGS: Record<BookingType, Partial<TrackingConfiguration>> = {
  electrician: {
    assignmentOffset: 90,      // 1.5 hours before booking
    departureOffset: 30,       // 30 minutes before booking
    arrivalOffset: 5,          // 5 minutes before booking
    showETA: true,
    allowCancellation: true,
    updateInterval: 60000,     // 1 minute updates
  },
};
```

### 3. **Preset Configurations**
```typescript
// For testing - very fast progression
DEMO_FAST: {
  assignmentOffset: 5,       // 5 minutes before
  departureOffset: 3,        // 3 minutes before
  arrivalOffset: 1,          // 1 minute before
  updateInterval: 10000,     // 10 seconds
}

// For emergency services
EMERGENCY: {
  assignmentOffset: 15,      // 15 minutes before
  departureOffset: 5,        // 5 minutes before
  arrivalOffset: 1,          // 1 minute before
  updateInterval: 15000,     // 15 seconds
  allowCancellation: false,
}
```

## Customization Examples

### Example 1: Create Custom Service Type
```typescript
// Add to SERVICE_CONFIGS
pest_control: {
  assignmentOffset: 120,     // 2 hours before
  departureOffset: 45,       // 45 minutes before
  arrivalOffset: 10,         // 10 minutes before
  showETA: true,
  allowCancellation: true,
  updateInterval: 120000,    // 2 minutes
}
```

### Example 2: Apply Emergency Preset
```typescript
const emergencyConfig = applyPreset('electrician', 'EMERGENCY');
// Results in very fast response times and no cancellation
```

### Example 3: Custom Configuration
```typescript
const customConfig = createCustomConfig('plumber', {
  assignmentOffset: 45,      // Custom timing
  showETA: false,           // Disable ETA
  customMessages: {
    confirmed: (data) => `Custom message for ${data.serviceTitle}`
  }
});
```

## Debug Features

### 1. **Debug Button**
- Tap the bug icon in the header to see current status details
- Shows parsed date, current status, progress percentage, and days difference

### 2. **Console Logging**
- All status calculations are logged to console
- Shows date parsing, time calculations, and configuration used

### 3. **Test Utilities**
```typescript
import { getStatusDescription } from '../utils/dateTestUtils';

const debug = getStatusDescription("Tomorrow", "10:00 AM - 12:00 PM", "electrician");
console.log(debug);
```

## Real-World Usage

### Morning of Service Day
1. **6:00 AM**: Status = "Confirmed" (waiting for assignment)
2. **8:30 AM**: Status = "Assigned" (for 10:00 AM booking)
3. **9:30 AM**: Status = "On the Way" (technician departing)
4. **9:55 AM**: Status = "Arrived" (technician at location)
5. **10:00 AM**: Status = "In Progress" (service started)
6. **12:00 PM**: Status = "Completed" (service finished)

### Future Booking Behavior
- **Tomorrow's booking**: Shows countdown and "Confirmed" status
- **Next week's booking**: Shows "Confirmed" with days remaining
- **Updates**: Status only progresses on the actual service day

## Troubleshooting

### Issue: Status showing "Completed" for future booking
**Solution**: Check date parsing in console logs. Ensure date format is correct.

### Issue: Status not updating in real-time
**Solution**: Check `updateInterval` configuration and console logs for errors.

### Issue: Wrong timing progression
**Solution**: Verify `assignmentOffset`, `departureOffset`, and `arrivalOffset` values.

### Issue: ETA not showing
**Solution**: Ensure both `config.showETA` and `trackingConfig.showETA` are true.

The system now provides accurate, configurable tracking that adapts to different service types and booking scenarios!