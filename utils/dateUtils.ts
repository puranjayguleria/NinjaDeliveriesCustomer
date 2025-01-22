// src/utils/dateUtils.ts

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
  