// src/utils/dateUtils.ts

export const formatDateToDDMMYYYY = (dateString: string): string => {
  try {
    // Handle different date formats that might be stored
    let date: Date;
    
    // If it's already in dd-mm-yyyy format, return as is
    if (/^\d{2}-\d{2}-\d{4}$/.test(dateString)) {
      return dateString;
    }
    
    // Try parsing as ISO date or other common formats
    date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return dateString; // Return original if can't parse
    }
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}-${month}-${year}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString; // Return original string if formatting fails
  }
};

export const getCurrentWeekRange = (): { start: Date; end: Date } => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // Sunday - Saturday : 0 - 6
  
    // Calculate how many days to subtract to get to Wednesday
    const daysSinceWednesday = (dayOfWeek + 4) % 7; // Wednesday is 3
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - daysSinceWednesday);
    startOfWeek.setHours(0, 0, 0, 0); // Start at midnight
  
    // End of week is next Tuesday
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999); // End at 11:59:59 PM
  
    return { start: startOfWeek, end: endOfWeek };
  };
  