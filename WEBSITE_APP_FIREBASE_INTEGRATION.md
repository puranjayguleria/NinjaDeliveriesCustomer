# Website-App Firebase Integration - Complete Guide

## ✅ Integration Complete!

Your app now perfectly matches your website's `service_bookings` collection structure and workflow.

## 🔥 Firebase Collection Structure (Matches Website)

### Collection: `service_bookings`

```typescript
interface ServiceBooking {
  id?: string;
  companyId: string;              // Matches company user ID from website
  customerName: string;           // Customer name
  serviceName: string;            // Service type
  date: string;                   // "YYYY-MM-DD" format
  time: string;                   // "H:MM AM/PM" format
  status: 'pending' | 'assigned' | 'started' | 'completed' | 'rejected' | 'expired';
  phone?: string;                 // Customer phone
  address?: string;               // Service address
  totalPrice?: number;            // Total booking amount
  addOns?: Array<{               // Additional services
    name: string;
    price: number;
  }>;
  startOtp?: string;             // OTP for work verification
  otpVerified?: boolean;         // OTP verification status
  technicianName?: string;       // Assigned technician
  createdAt: Date;               // Booking creation time
  startedAt?: Date;              // Work start time
  completedAt?: Date;            // Work completion time
  expiredAt?: Date;              // Expiration time
}
```

## 🚀 Booking Workflow (Matches Website)

### 1. **App Creates Booking** → Status: `pending`
```typescript
const bookingData = {
  companyId: "PLbLmI2YMOSLBuLa2wOPHkgbkkI",
  customerName: "Customer Name",
  serviceName: "Car Cleaning",
  date: "2026-01-30",
  time: "1:00 PM - 3:00 PM",
  status: "pending",
  phone: "9876543210",
  address: "Customer Address",
  totalPrice: 10000,
  addOns: []
};
```

### 2. **Website Assigns Technician** → Status: `assigned`
```typescript
await FirestoreService.assignTechnicianToBooking(bookingId, "John Doe");
```

### 3. **Website Starts Work** → Status: `started`
```typescript
const otp = await FirestoreService.startWorkOnBooking(bookingId);
// Returns 6-digit OTP: "123456"
```

### 4. **Website Completes Work** → Status: `completed`
```typescript
await FirestoreService.completeWorkOnBooking(bookingId, "123456");
```

## 📱 App Methods Available

### Create Booking (App Side)
```typescript
const bookingId = await FirestoreService.createServiceBooking({
  companyId: "company-id",
  customerName: "Customer",
  serviceName: "Cleaning",
  date: "2026-02-15",
  time: "10:00 AM",
  status: "pending",
  phone: "9876543210",
  address: "Service Address",
  totalPrice: 500,
  addOns: [{ name: "Extra service", price: 100 }]
});
```

### Get All Bookings
```typescript
const bookings = await FirestoreService.getServiceBookings(20);
```

### Get Company Bookings (Website Side)
```typescript
const companyBookings = await FirestoreService.getBookingsByCompanyId("company-id");
```

### Update Booking Status
```typescript
await FirestoreService.updateServiceBooking(bookingId, {
  status: "assigned",
  technicianName: "John Doe"
});
```

## 🌐 Website Integration Points

### Your Website Code Matches:
- ✅ **Collection Name**: `service_bookings`
- ✅ **Status Flow**: pending → assigned → started → completed
- ✅ **OTP Workflow**: Generate OTP on start, verify on complete
- ✅ **Auto-Expiry**: Bookings expire if date < today
- ✅ **Company Filtering**: `where("companyId", "==", user.uid)`

### Status Mapping:
```javascript
// Website Status Config (matches app)
const statusConfig = {
  pending: { label: "Pending", color: "booking-status-pending", icon: "⏱️" },
  assigned: { label: "Assigned", color: "booking-status-confirmed", icon: "👤" },
  started: { label: "Started", color: "booking-status-confirmed", icon: "🔧" },
  completed: { label: "Completed", color: "booking-status-completed", icon: "✅" },
  rejected: { label: "Rejected", color: "booking-status-expired", icon: "❌" },
  expired: { label: "Expired", color: "booking-status-expired", icon: "⏰" },
};
```

## 🔧 Test the Integration

### 1. **Test App Booking Creation**
- Open app → Services → Select service → Checkout
- Tap "Proceed to Payment"
- **Expected**: Booking created with status "pending"

### 2. **Verify in Website Dashboard**
- Login to your website dashboard
- Go to Bookings section
- **Expected**: See new booking from app with all details

### 3. **Test Website Workflow**
- Assign technician → Status becomes "assigned"
- Start work → Status becomes "started" + OTP generated
- Complete work → Status becomes "completed"

## 📊 Firebase Console Structure

Your Firebase documents will look like:
```json
{
  "companyId": "PLbLmI2YMOSLBuLa2wOPHkgbkkI",
  "customerName": "Customer",
  "serviceName": "Car Cleaning",
  "date": "2026-01-30",
  "time": "1:00 PM - 3:00 PM",
  "status": "pending",
  "phone": "9876543210",
  "address": "Service Address",
  "totalPrice": 10000,
  "addOns": [],
  "startOtp": null,
  "otpVerified": false,
  "technicianName": null,
  "createdAt": "2026-01-29T12:00:00.000Z"
}
```

## 🎯 Key Features

### ✅ **Perfect Website Compatibility**
- Same collection structure
- Same status workflow
- Same field names and types
- Same auto-expiry logic

### ✅ **Enhanced App Features**
- Real Firebase booking creation
- Status tracking and updates
- OTP workflow support
- Company-specific booking filtering

### ✅ **Backward Compatibility**
- Maintains existing app functionality
- Supports both old and new field structures
- Graceful handling of missing fields

## 🚀 Production Deployment

### App Side:
1. Remove test button from production
2. Add user authentication for customer details
3. Implement real-time status updates
4. Add push notifications for booking updates

### Website Side:
1. Your existing code works without changes
2. All booking operations will sync with app
3. Real-time updates between app and website
4. Unified booking management system

## 🔍 Console Logs to Monitor

### Successful Integration:
```
🔥 Creating service booking in Firebase: [booking-data]
📝 Booking document to create: [document-with-all-fields]
✅ Service booking created successfully with ID: [firebase-id]
✅ Fetched X bookings for company [company-id]
```

### Website Operations:
```
✅ Technician John Doe assigned to booking [booking-id]
✅ Work started on booking [booking-id], OTP: 123456
✅ Work completed on booking [booking-id]
```

Your app and website now share the same Firebase collection with perfect compatibility! 🔥