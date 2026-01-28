import { parseBookingDate, getBookingStatus, BookingType } from './trackingConfig';

// Test utility to verify date parsing and status logic
export const testDateLogic = () => {
  const now = new Date();
  console.log("=== Date Logic Test ===");
  console.log("Current time:", now.toString());
  
  // Test different date formats
  const testCases = [
    { date: "Today", time: "2:00 PM - 4:00 PM" },
    { date: "Tomorrow", time: "10:00 AM - 12:00 PM" },
    { date: "2024-01-30", time: "3:00 PM - 5:00 PM" },
    { date: "2024-01-25", time: "11:00 AM - 1:00 PM" }, // Past date
  ];
  
  testCases.forEach((testCase, index) => {
    console.log(`\n--- Test Case ${index + 1} ---`);
    console.log("Input:", testCase);
    
    const parsedDate = parseBookingDate(testCase.date);
    console.log("Parsed date:", parsedDate.toDateString());
    
    const status = getBookingStatus(testCase.date, testCase.time, "electrician" as BookingType);
    console.log("Status result:", status);
  });
  
  console.log("=== End Test ===");
};

// Manual test function you can call from the app
export const runDateTest = () => {
  testDateLogic();
};

// Get human-readable status for debugging
export const getStatusDescription = (
  bookingDate: string, 
  timeSlot: string, 
  bookingType: BookingType = "electrician"
) => {
  const status = getBookingStatus(bookingDate, timeSlot, bookingType);
  const parsedDate = parseBookingDate(bookingDate);
  
  return {
    input: { bookingDate, timeSlot, bookingType },
    parsedDate: parsedDate.toDateString(),
    result: status,
    description: `Status: ${status.status} (${status.progressPercentage}%) - ${status.daysDifference} days difference`
  };
};