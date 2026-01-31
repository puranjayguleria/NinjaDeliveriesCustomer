# Payment History Integration

## Overview
This document explains the payment history integration with Firebase's `service_payments` collection. Every payment transaction is now tracked and stored for audit and user history purposes.

## Features Added

### 1. ServicePayment Interface
- **File**: `services/firestoreService.ts`
- **New Interface**: `ServicePayment`
- **Fields**:
  - `id`: Unique payment record ID
  - `bookingId`: Associated booking ID
  - `customerId`: User who made the payment
  - `amount`: Payment amount
  - `paymentMethod`: 'cash' | 'online'
  - `paymentStatus`: 'pending' | 'paid' | 'failed' | 'refunded'
  - `transactionId`: Razorpay payment ID
  - `razorpayOrderId`: Razorpay order ID
  - `razorpaySignature`: Razorpay signature for verification
  - `serviceName`: Name of the service
  - `companyName`: Service provider name
  - `companyId`: Service provider ID
  - `paymentGateway`: 'razorpay' | 'upi' | 'cash'
  - `paymentDetails`: Additional payment method details
  - `createdAt`, `updatedAt`, `paidAt`: Timestamps

### 2. Payment Management Functions

#### `createServicePayment(paymentData)`
- Creates a new payment record in `service_payments` collection
- Automatically sets `customerId` to logged-in user
- Sets timestamps (`createdAt`, `updatedAt`, `paidAt`)
- Returns payment record ID

#### `updateServicePayment(paymentId, updates)`
- Updates existing payment record
- Automatically sets `paidAt` when status changes to 'paid'
- Updates `updatedAt` timestamp

#### `getPaymentByBookingId(bookingId)`
- Retrieves payment record for a specific booking
- Returns `ServicePayment` object or `null`

#### `getUserPaymentHistory(limit)`
- Gets all payment records for current user
- Sorted by creation date (newest first)
- Default limit: 50 records

#### `updatePaymentAfterRazorpaySuccess(bookingId, razorpayResponse)`
- Updates payment record with Razorpay transaction details
- Sets status to 'paid' and adds transaction IDs

### 3. Integration with Booking Flow

#### ServiceCheckoutScreen Updates
- **Enhanced `createBookings()` function**:
  - Creates payment record for each booking
  - Stores Razorpay details when payment is successful
  - Links payment to booking via `bookingId`

#### Payment Flow Integration
1. **Cash Payment**:
   - Creates payment record with status 'pending'
   - Gateway set to 'cash'

2. **Online Payment**:
   - Creates payment record with status 'paid' after successful Razorpay payment
   - Stores Razorpay transaction details
   - Gateway set to 'razorpay'

## Database Structure

### service_payments Collection
```javascript
{
  id: "auto-generated",
  bookingId: "booking-123",
  customerId: "user-456",
  amount: 500,
  paymentMethod: "online",
  paymentStatus: "paid",
  transactionId: "pay_razorpay123",
  razorpayOrderId: "order_razorpay456",
  razorpaySignature: "signature_hash",
  serviceName: "AC Repair",
  companyName: "Cool Air Services",
  companyId: "company-789",
  paymentGateway: "razorpay",
  paymentDetails: {
    method: "upi",
    upiId: "user@paytm"
  },
  createdAt: Timestamp,
  updatedAt: Timestamp,
  paidAt: Timestamp
}
```

## Usage Examples

### Creating a Payment Record
```typescript
const paymentData = {
  bookingId: "booking-123",
  amount: 500,
  paymentMethod: "online" as const,
  paymentStatus: "paid" as const,
  serviceName: "AC Repair",
  companyName: "Cool Air Services",
  companyId: "company-789",
  paymentGateway: "razorpay" as const,
  transactionId: "pay_razorpay123",
  razorpayOrderId: "order_razorpay456",
  razorpaySignature: "signature_hash"
};

const paymentId = await FirestoreService.createServicePayment(paymentData);
```

### Retrieving Payment History
```typescript
const paymentHistory = await FirestoreService.getUserPaymentHistory(20);
console.log(`Found ${paymentHistory.length} payment records`);
```

### Getting Payment for Specific Booking
```typescript
const payment = await FirestoreService.getPaymentByBookingId("booking-123");
if (payment) {
  console.log(`Payment status: ${payment.paymentStatus}`);
  console.log(`Amount: ₹${payment.amount}`);
}
```

## Security Features

### User Isolation
- All payment queries filtered by `customerId`
- Users can only access their own payment records
- Automatic user ID assignment from Firebase Auth

### Data Integrity
- Required fields validation
- Automatic timestamp management
- Payment status tracking with audit trail

### Transaction Tracking
- Complete Razorpay transaction details stored
- Payment verification signatures preserved
- Gateway and method tracking for analytics

## Benefits

### For Users
- Complete payment history visibility
- Transaction details for support/disputes
- Payment status tracking

### For Business
- Complete audit trail of all payments
- Payment method analytics
- Revenue tracking and reporting
- Support for refunds and disputes

### For Developers
- Centralized payment data management
- Easy integration with existing booking system
- Extensible for future payment methods
- Comprehensive logging and debugging

## Future Enhancements

### Planned Features
- Payment refund tracking
- Partial payment support
- Payment retry mechanism
- Payment analytics dashboard
- Export payment history
- Payment notifications

### Integration Opportunities
- Connect with accounting systems
- Payment reconciliation tools
- Revenue reporting dashboards
- Customer payment insights