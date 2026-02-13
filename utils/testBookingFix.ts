import { fixSpecificBooking, fixExistingBookingsForWebsite } from './fixExistingBookings';

/**
 * Test function to fix the current booking that's not showing on website
 */
export async function testFixCurrentBooking() {
  try {
    console.log('🧪 Testing booking fix for current booking...');
    
    // Fix the specific booking ID from the logs
    const currentBookingId = '9POTb1E5lWjz2BjBYfYj';
    
    console.log(`🔧 Fixing booking: ${currentBookingId}`);
    await fixSpecificBooking(currentBookingId);
    
    console.log(`✅ Fixed current booking. It should now be visible on website.`);
    
    // Also fix all other bookings
    console.log(`🔧 Fixing all existing bookings...`);
    await fixExistingBookingsForWebsite();
    
    console.log(`✅ All bookings should now be visible on website!`);
    
  } catch (error) {
    console.error('❌ Error in test booking fix:', error);
  }
}

/**
 * Quick test to check if booking exists and what fields it has
 */
export async function checkBookingFields(bookingId: string) {
  try {
    const { firestore } = require('../firebase.native');
    
    const bookingDoc = await firestore()
      .collection('service_bookings')
      .doc(bookingId)
      .get();
    
    if (!bookingDoc.exists) {
      console.log(`❌ Booking ${bookingId} not found`);
      return;
    }
    
    const booking = bookingDoc.data();
    
    console.log(`📋 Booking ${bookingId} fields:`, {
      serviceName: booking.serviceName,
      companyId: booking.companyId,
      companyName: booking.companyName,
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      customerAddress: booking.customerAddress,
      date: booking.date,
      time: booking.time,
      status: booking.status,
      hasLocation: !!booking.location,
      hasServiceAddress: !!booking.serviceAddress,
      location: booking.location,
      serviceAddress: booking.serviceAddress,
      totalPrice: booking.totalPrice,
      paymentMethod: booking.paymentMethod,
      paymentStatus: booking.paymentStatus,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt
    });
    
  } catch (error) {
    console.error(`❌ Error checking booking ${bookingId}:`, error);
  }
}