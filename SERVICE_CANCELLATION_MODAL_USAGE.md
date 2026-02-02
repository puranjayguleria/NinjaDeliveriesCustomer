# Service Cancellation Modal Usage

## Overview
The `ServiceCancellationModal` component provides a user-friendly interface for service cancellation with automatic deduction calculation and clear messaging about cancellation fees.

## Features
- Shows 25% deduction message (configurable)
- Calculates and displays refund amount
- Professional UI with warning indicators
- Animated modal with gradient background
- Clear breakdown of charges

## Implementation

### 1. Import the Component
```tsx
import ServiceCancellationModal from "../components/ServiceCancellationModal";
```

### 2. Add State Management
```tsx
const [showCancellationModal, setShowCancellationModal] = useState(false);
const [bookingToCancel, setBookingToCancel] = useState<{
  id: string, 
  serviceName: string, 
  totalPrice?: number
} | null>(null);
```

### 3. Handle Cancellation Trigger
```tsx
const handleCancelBooking = (bookingId: string, serviceName: string, totalPrice: number) => {
  setBookingToCancel({ id: bookingId, serviceName, totalPrice });
  setShowCancellationModal(true);
};
```

### 4. Handle Confirmation
```tsx
const handleConfirmCancellation = async () => {
  if (!bookingToCancel) return;

  try {
    setShowCancellationModal(false);
    // Your cancellation logic here
    await FirestoreService.updateBookingStatus(bookingToCancel.id, 'rejected');
    Alert.alert("Booking Cancelled", "Your booking has been cancelled successfully.");
  } catch (error) {
    Alert.alert("Error", "Failed to cancel booking. Please try again.");
  } finally {
    setBookingToCancel(null);
  }
};
```

### 5. Add Modal to JSX
```tsx
<ServiceCancellationModal
  visible={showCancellationModal}
  onClose={() => {
    setShowCancellationModal(false);
    setBookingToCancel(null);
  }}
  onConfirmCancel={handleConfirmCancellation}
  totalAmount={bookingToCancel?.totalPrice || 0}
  deductionPercentage={25} // Optional, defaults to 25%
/>
```

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `visible` | boolean | Yes | - | Controls modal visibility |
| `onClose` | function | Yes | - | Called when modal is dismissed |
| `onConfirmCancel` | function | Yes | - | Called when user confirms cancellation |
| `totalAmount` | number | Yes | - | Total booking amount |
| `deductionPercentage` | number | No | 25 | Percentage to deduct as cancellation fee |

## Current Implementation

The modal is currently implemented in:
- `TrackBookingScreen.tsx` - For active booking cancellation
- `BookingHistoryScreen.tsx` - For pending/assigned booking cancellation

## Customization

You can customize the deduction percentage by passing a different value:
```tsx
<ServiceCancellationModal
  // ... other props
  deductionPercentage={30} // 30% deduction instead of 25%
/>
```

## UI Features

- **Warning Icon**: Clear visual indicator of destructive action
- **Amount Breakdown**: Shows total, deduction, and refund amounts
- **Warning Box**: Highlights the deduction policy
- **Action Buttons**: "Keep Booking" (safe) and "Cancel Service" (destructive)
- **Animations**: Smooth scale and fade animations
- **Gradient Background**: Professional appearance with subtle gradients