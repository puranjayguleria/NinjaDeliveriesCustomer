import { FirestoreService } from '../services/firestoreService';

/**
 * Fix existing bookings to make them visible on website
 * This function adds missing fields that the website expects
 */
export async function fixExistingBookingsForWebsite(): Promise<void> {
  try {
    console.log('🔧 Starting to fix existing bookings for website visibility...');
    
    const { firestore } = require('../firebase.native');
    
    // Get all bookings that might be missing website-required fields
    const bookingsSnapshot = await firestore()
      .collection('service_bookings')
      .where('status', 'in', ['pending', 'assigned', 'started'])
      .get();
    
    console.log(`📋 Found ${bookingsSnapshot.size} bookings to potentially fix`);
    
    const updatePromises: Promise<void>[] = [];
    
    for (const doc of bookingsSnapshot.docs) {
      const booking = doc.data();
      const bookingId = doc.id;
      
      console.log(`🔍 Checking booking ${bookingId}:`, {
        hasCompanyName: !!booking.companyName,
        hasLocation: !!booking.location,
        hasServiceAddress: !!booking.serviceAddress,
        companyId: booking.companyId,
        serviceName: booking.serviceName
      });
      
      let needsUpdate = false;
      const updates: any = {};
      
      // Add company name if missing
      if (!booking.companyName && booking.companyId) {
        console.log(`📝 Adding company name for booking ${bookingId}`);
        try {
          const companyName = await FirestoreService.getActualCompanyName(booking.companyId);
          updates.companyName = companyName;
          needsUpdate = true;
        } catch (error) {
          console.error(`❌ Error getting company name for ${booking.companyId}:`, error);
          updates.companyName = `Company ${booking.companyId}`;
          needsUpdate = true;
        }
      }
      
      // Add location field if missing but customerAddress exists
      if (!booking.location && booking.customerAddress) {
        console.log(`📍 Adding location field for booking ${bookingId}`);
        updates.location = {
          lat: null,
          lng: null,
          address: booking.customerAddress,
          houseNo: "",
          placeLabel: "Home"
        };
        needsUpdate = true;
      }
      
      // Add serviceAddress field if missing
      if (!booking.serviceAddress && booking.customerAddress) {
        console.log(`🏠 Adding serviceAddress field for booking ${bookingId}`);
        updates.serviceAddress = {
          id: `addr_${Date.now()}`,
          fullAddress: booking.customerAddress,
          houseNo: "",
          landmark: "",
          addressType: "Home",
          lat: null,
          lng: null
        };
        needsUpdate = true;
      }
      
      // Add category and subcategory if missing
      if (!booking.category && booking.serviceName) {
        updates.category = booking.serviceName;
        needsUpdate = true;
      }
      
      if (!booking.subcategory && booking.workName) {
        updates.subcategory = booking.workName;
        needsUpdate = true;
      }
      
      // Add bookingType if missing
      if (!booking.bookingType) {
        updates.bookingType = 'service';
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        console.log(`✏️ Updating booking ${bookingId} with:`, updates);
        
        const updatePromise = firestore()
          .collection('service_bookings')
          .doc(bookingId)
          .update({
            ...updates,
            updatedAt: new Date()
          });
        
        updatePromises.push(updatePromise);
      } else {
        console.log(`✅ Booking ${bookingId} already has all required fields`);
      }
    }
    
    if (updatePromises.length > 0) {
      console.log(`🔄 Updating ${updatePromises.length} bookings...`);
      await Promise.all(updatePromises);
      console.log(`✅ Successfully updated ${updatePromises.length} bookings for website visibility`);
    } else {
      console.log(`✅ All bookings already have required fields for website visibility`);
    }
    
  } catch (error) {
    console.error('❌ Error fixing existing bookings:', error);
    throw error;
  }
}

/**
 * Fix a specific booking by ID
 */
export async function fixSpecificBooking(bookingId: string): Promise<void> {
  try {
    console.log(`🔧 Fixing specific booking: ${bookingId}`);
    
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
    const updates: any = {};
    let needsUpdate = false;
    
    // Add company name if missing
    if (!booking.companyName && booking.companyId) {
      try {
        const companyName = await FirestoreService.getActualCompanyName(booking.companyId);
        updates.companyName = companyName;
        needsUpdate = true;
      } catch (error) {
        updates.companyName = `Company ${booking.companyId}`;
        needsUpdate = true;
      }
    }
    
    // Add location field if missing
    if (!booking.location && booking.customerAddress) {
      updates.location = {
        lat: null,
        lng: null,
        address: booking.customerAddress,
        houseNo: "",
        placeLabel: "Home"
      };
      needsUpdate = true;
    }
    
    // Add serviceAddress field if missing
    if (!booking.serviceAddress && booking.customerAddress) {
      updates.serviceAddress = {
        id: `addr_${Date.now()}`,
        fullAddress: booking.customerAddress,
        houseNo: "",
        landmark: "",
        addressType: "Home",
        lat: null,
        lng: null
      };
      needsUpdate = true;
    }
    
    if (needsUpdate) {
      await firestore()
        .collection('service_bookings')
        .doc(bookingId)
        .update({
          ...updates,
          updatedAt: new Date()
        });
      
      console.log(`✅ Fixed booking ${bookingId} for website visibility`);
    } else {
      console.log(`✅ Booking ${bookingId} already has all required fields`);
    }
    
  } catch (error) {
    console.error(`❌ Error fixing booking ${bookingId}:`, error);
    throw error;
  }
}