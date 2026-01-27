# Razorpay Setup Guide

## Current Issue
The error `Cannot read property 'open' of null` indicates that the Razorpay package is not properly installed or configured.

## Solution

### 1. Install Razorpay Package
```bash
npm install react-native-razorpay
# or
yarn add react-native-razorpay
```

### 2. For React Native 0.60+ (Auto-linking)
```bash
cd ios && pod install && cd ..
```

### 3. For React Native < 0.60 (Manual linking)
```bash
react-native link react-native-razorpay
```

### 4. Android Configuration
Add to `android/app/build.gradle`:
```gradle
implementation 'com.razorpay:checkout:1.6.4'
```

### 5. iOS Configuration
Add to `ios/Podfile`:
```ruby
pod 'razorpay-pod', '1.3.2'
```

### 6. Rebuild the App
```bash
# Clean and rebuild
npx react-native run-android
# or
npx react-native run-ios
```

## Temporary Workaround

The app now includes a **mock payment flow** for testing:

1. Select "Pay Online" 
2. Click "Confirm"
3. You'll see a mock payment dialog with options:
   - **Simulate Success**: Proceeds as if payment was successful
   - **Use Cash Payment**: Switches to cash payment
   - **Cancel**: Goes back

## Testing Flow

### With Mock Payment:
1. Service Checkout → Pay Online → Payment Screen
2. Debug info shows "Razorpay Available: No"
3. Click "Confirm" → Mock payment dialog appears
4. Click "Simulate Success" → Proceeds to BookingDetails

### With Cash Payment:
1. Service Checkout → Cash on Service → Payment Screen  
2. Click "Confirm" → Directly proceeds to BookingDetails

## Production Setup

For production, you'll need:
1. Razorpay merchant account
2. API keys configured in environment variables
3. Server-side order creation and verification endpoints
4. Proper error handling and webhook setup

The current implementation includes server-side integration but requires the Razorpay package to be properly installed.