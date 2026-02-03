# Booking Rejection Modal Feature

## Overview
This feature automatically shows a modal when a service booking is rejected by the admin, displaying alternative service providers that can fulfill the same service request.

## How It Works

### 1. Real-time Status Monitoring
- The `TrackBookingScreen` listens to real-time booking status changes using Firebase listeners
- When a booking status changes from any status to 'rejected', the system detects this change
- An alert is shown to inform the user about the rejection
- The `BookingRejectionModal` is displayed with alternative companies

### 2. Company Filtering Logic
The modal finds alternative companies using this priority order:

1. **By Selected Issue IDs** (if available)
   - Uses `FirestoreService.getCompaniesWithDetailedPackages(selectedIssueIds)`
   - Most accurate matching based on specific service issues

2. **By Category ID** (if available)
   - Uses `FirestoreService.getCompaniesByCategory(categoryId)`
   - Matches companies that provide services in the same category

3. **By Service Name** (fallback)
   - Filters all companies by service name matching
   - Uses fuzzy matching for common service types (electric, plumb, clean, repair)

### 3. Availability Filtering
For each company found, the system checks:
- **Active Workers**: Company must have active workers (`isActive: true`)
- **Time Slot Availability**: Workers must be available for the specific date/time
- Uses `FirestoreService.checkCompanyWorkerAvailability(companyId, date, time)`

### 4. User Experience Flow
1. User receives alert: "Booking Rejected"
2. User can choose "Find Alternatives" or "Cancel"
3. Modal shows available companies with:
   - Company name and verification status
   - Service details and pricing
   - Availability confirmation for the time slot
   - Rating and reviews (if available)
4. User selects a company and proceeds to rebooking

## Files Modified

### New Files
- `components/BookingRejectionModal.tsx` - Main modal component

### Modified Files
- `screens/TrackBookingScreen.tsx` - Added rejection detection and modal integration

## Key Features

### Modal Features
- **Animated Appearance**: Smooth scale and fade animations
- **Company Cards**: Clean, selectable company cards with all relevant info
- **Real-time Filtering**: Only shows companies with active workers and availability
- **Empty States**: Helpful messages when no companies are available
- **Responsive Design**: Works on different screen sizes

### Integration Features
- **Real-time Detection**: Automatically triggers when status changes to 'rejected'
- **Fallback Navigation**: Handles cases where original booking parameters aren't available
- **Manual Trigger**: "Find Alternative Companies" button for rejected bookings
- **Graceful Degradation**: Works even without categoryId or selectedIssueIds

## Usage

### For Users
1. When a booking is rejected, an alert appears automatically
2. Click "Find Alternatives" to see available companies
3. Select a company from the list
4. Proceed with rebooking using the selected company

### For Developers
The modal can be triggered manually:
```typescript
setShowRejectionModal(true);
```

Or it triggers automatically when booking status changes to 'rejected'.

## Configuration

### Required Props
- `visible`: Boolean to show/hide modal
- `onClose`: Function to close modal
- `onSelectCompany`: Function called when user selects a company
- `rejectedBooking`: Object with booking details

### Booking Object Structure
```typescript
{
  id: string;
  serviceName: string;
  categoryId?: string;        // Optional - used for better matching
  selectedIssueIds?: string[]; // Optional - used for precise matching
  issues?: string[];          // Optional - displayed to user
  date: string;              // Required for availability check
  time: string;              // Required for availability check
  customerAddress?: string;   // Optional - shown to user
}
```

## Error Handling
- Graceful fallback when Firebase queries fail
- Loading states during company fetching
- Empty states when no companies are available
- Error alerts for navigation failures

## Performance Considerations
- Companies are fetched only when modal opens
- Availability checks are done in parallel
- Results are cached during modal session
- Modal animations use native driver for smooth performance

## Future Enhancements
1. **Smart Recommendations**: Prioritize companies by rating, distance, or price
2. **Batch Rebooking**: Allow rebooking multiple rejected services at once
3. **Notification Integration**: Send push notifications when alternatives are found
4. **Price Comparison**: Show price differences between original and alternative companies
5. **Availability Slots**: Show multiple available time slots per company