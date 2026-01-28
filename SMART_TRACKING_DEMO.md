# Smart Tracking System Demo

## How the Configurable Tracking Works

The track booking system is now intelligent and configures itself based on the selected date and time slot. Here's how it works:

### 1. **Time-Based Status Calculation**

The system automatically determines the booking status based on:
- **Current time** vs **Booking time slot**
- **Booking date** (Today, Tomorrow, or specific date)
- **Service type** configuration

### 2. **Status Progression Timeline**

For a booking at **2:00 PM - 4:00 PM Today**:

| Time | Status | Description |
|------|--------|-------------|
| Before 12:00 PM | **Confirmed** | Booking confirmed, waiting for assignment |
| 12:00 PM - 1:30 PM | **Assigned** | Technician assigned, preparing for departure |
| 1:30 PM - 1:55 PM | **On the Way** | Technician traveling to location |
| 1:55 PM - 2:00 PM | **Arrived** | Technician at location, ready to start |
| 2:00 PM - 4:00 PM | **In Progress** | Service work being performed |
| After 4:00 PM | **Completed** | Service finished |

### 3. **Dynamic Timestamps**

All timestamps are calculated based on the actual booking slot:
- **Assignment**: 1.5 hours before start time
- **Departure**: 30 minutes before start time  
- **Arrival**: 5 minutes before start time
- **Start**: At booking start time
- **Completion**: At booking end time

### 4. **Smart Status Messages**

Messages change based on the time slot:
- "Your booking is confirmed for Today at 2:00 PM"
- "Raj Kumar will arrive at 2:00 PM"
- "Expected arrival: 2:00 PM"

### 5. **Progress Tracking**

Visual progress bar shows completion percentage:
- **Confirmed**: 10%
- **Assigned**: 25%
- **On the Way**: 50%
- **Arrived**: 70%
- **In Progress**: 85%
- **Completed**: 100%

### 6. **Real-Time Updates**

The system updates every minute to reflect real-time status changes based on the current time vs booking time.

## Example Scenarios

### Scenario 1: Morning Booking (9:00 AM - 11:00 AM)
- **7:30 AM**: Status = Assigned
- **8:30 AM**: Status = On the Way
- **8:55 AM**: Status = Arrived
- **9:00 AM**: Status = In Progress
- **11:00 AM**: Status = Completed

### Scenario 2: Evening Booking (6:00 PM - 8:00 PM)
- **4:30 PM**: Status = Assigned
- **5:30 PM**: Status = On the Way
- **5:55 PM**: Status = Arrived
- **6:00 PM**: Status = In Progress
- **8:00 PM**: Status = Completed

### Scenario 3: Tomorrow's Booking
- **Today**: Status = Confirmed (until assignment time tomorrow)
- **Tomorrow morning**: Status progression begins

## Configuration Options

Each service type has different behavior:
- **Electrician**: 2-hour duration, 10s updates, ETA shown
- **Plumber**: 1.5-hour duration, 10s updates, ETA shown
- **Cleaning**: 3-hour duration, 15s updates, ETA shown
- **Health**: 1-hour duration, 5s updates, NO cancellation
- **Car Wash**: 45-minute duration, 5s updates, ETA shown

## Testing Different Time Slots

To test the system:
1. Book a service for different time slots
2. Navigate to Track Booking
3. Observe how status changes based on current time vs booking time
4. Try booking for "Today", "Tomorrow", or specific dates
5. Notice how timestamps adjust automatically

The system provides a realistic tracking experience that matches real-world service delivery timelines.