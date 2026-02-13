import { getTrackingConfiguration } from './trackingConfigManager';

export type BookingType = 'electrician' | 'plumber' | 'cleaning' | 'health' | 'dailywages' | 'carwash';

export type BookingStatus = 
  | "confirmed" 
  | "assigned" 
  | "on_the_way" 
  | "arrived" 
  | "in_progress" 
  | "completed" 
  | "cancelled";

export interface TrackingConfig {
  estimatedDuration: number; // in minutes
  statusUpdateInterval: number; // in seconds
  showETA: boolean;
  allowCancellation: boolean;
  technicianCallEnabled: boolean;
  customSteps?: string[];
}

export const TRACKING_CONFIGS: Record<BookingType, TrackingConfig> = {
  electrician: {
    estimatedDuration: 120, // 2 hours
    statusUpdateInterval: 10,
    showETA: true,
    allowCancellation: true,
    technicianCallEnabled: true,
  },
  plumber: {
    estimatedDuration: 90, // 1.5 hours
    statusUpdateInterval: 10,
    showETA: true,
    allowCancellation: true,
    technicianCallEnabled: true,
  },
  cleaning: {
    estimatedDuration: 180, // 3 hours
    statusUpdateInterval: 15,
    showETA: true,
    allowCancellation: true,
    technicianCallEnabled: true,
  },
  health: {
    estimatedDuration: 60, // 1 hour
    statusUpdateInterval: 5,
    showETA: true,
    allowCancellation: false, // Health services shouldn't be cancelled easily
    technicianCallEnabled: true,
  },
  dailywages: {
    estimatedDuration: 480, // 8 hours
    statusUpdateInterval: 30,
    showETA: false, // Daily wages are longer duration
    allowCancellation: true,
    technicianCallEnabled: true,
  },
  carwash: {
    estimatedDuration: 45, // 45 minutes
    statusUpdateInterval: 5,
    showETA: true,
    allowCancellation: true,
    technicianCallEnabled: true,
  },
};

export const getTrackingConfig = (bookingType: BookingType): TrackingConfig => {
  return TRACKING_CONFIGS[bookingType] || TRACKING_CONFIGS.electrician;
};

export const getEstimatedCompletionTime = (
  startTime: Date, 
  bookingType: BookingType
): Date => {
  const config = getTrackingConfig(bookingType);
  const completionTime = new Date(startTime);
  completionTime.setMinutes(completionTime.getMinutes() + config.estimatedDuration);
  return completionTime;
};

export const parseTimeSlot = (timeSlot: string): { startTime: Date; endTime: Date } => {
  // Parse time slots like "2:00 PM - 4:00 PM" or "9:00 AM - 11:00 AM"
  const today = new Date();
  const [startStr, endStr] = timeSlot.split(' - ');
  
  const parseTime = (timeStr: string): Date => {
    const [time, period] = timeStr.trim().split(' ');
    const [hours, minutes] = time.split(':').map(Number);
    
    let hour24 = hours;
    if (period === 'PM' && hours !== 12) hour24 += 12;
    if (period === 'AM' && hours === 12) hour24 = 0;
    
    const date = new Date(today);
    date.setHours(hour24, minutes || 0, 0, 0);
    return date;
  };
  
  return {
    startTime: parseTime(startStr),
    endTime: parseTime(endStr)
  };
};

export const parseBookingDate = (dateStr: string): Date => {
  const today = new Date();
  
  if (dateStr === "Today") {
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
  } 
  
  if (dateStr === "Tomorrow") {
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
  }
  
  // Handle ISO format dates like "2024-01-29"
  if (dateStr && dateStr.includes("-")) {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1; // Month is 0-indexed
      const day = parseInt(parts[2]);
      return new Date(year, month, day);
    }
  }
  
  // Handle other date formats
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }
  
  // Fallback to today
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
};

export const getBookingStatus = (
  bookingDate: string, 
  timeSlot: string, 
  bookingType: BookingType
): { status: BookingStatus; estimatedArrival?: string; progressPercentage: number; daysDifference: number } => {
  const now = new Date();
  const trackingConfig = getTrackingConfiguration(bookingType);
  
  // Parse booking date (date only, no time)
  const bookingDateObj = parseBookingDate(bookingDate);
  
  // Parse time slot
  const { startTime, endTime } = parseTimeSlot(timeSlot);
  
  // Create full booking datetime by combining date and time
  const bookingStartTime = new Date(
    bookingDateObj.getFullYear(),
    bookingDateObj.getMonth(),
    bookingDateObj.getDate(),
    startTime.getHours(),
    startTime.getMinutes(),
    0,
    0
  );
  
  const bookingEndTime = new Date(
    bookingDateObj.getFullYear(),
    bookingDateObj.getMonth(),
    bookingDateObj.getDate(),
    endTime.getHours(),
    endTime.getMinutes(),
    0,
    0
  );
  
  // Calculate days difference
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysDifference = Math.floor((bookingDateObj.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
  
  console.log("Booking Status Debug:", {
    bookingDate,
    timeSlot,
    bookingDateObj: bookingDateObj.toDateString(),
    bookingStartTime: bookingStartTime.toString(),
    now: now.toString(),
    daysDifference,
    trackingConfig
  });
  
  // Future date (more than today)
  if (daysDifference > 0) {
    return { 
      status: "confirmed", 
      progressPercentage: trackingConfig.progressMapping.confirmed,
      daysDifference
    };
  }
  
  // Past date (before today)
  if (daysDifference < 0) {
    return { 
      status: "completed", 
      progressPercentage: trackingConfig.progressMapping.completed,
      daysDifference
    };
  }
  
  // Today's booking - check time progression using configurable offsets
  const assignmentTime = new Date(bookingStartTime.getTime() - trackingConfig.assignmentOffset * 60 * 1000);
  const departureTime = new Date(bookingStartTime.getTime() - trackingConfig.departureOffset * 60 * 1000);
  const arrivalTime = new Date(bookingStartTime.getTime() - trackingConfig.arrivalOffset * 60 * 1000);
  
  if (now < assignmentTime) {
    return { 
      status: "confirmed", 
      progressPercentage: trackingConfig.progressMapping.confirmed,
      daysDifference
    };
  } else if (now < departureTime) {
    return { 
      status: "assigned", 
      progressPercentage: trackingConfig.progressMapping.assigned,
      daysDifference
    };
  } else if (now < arrivalTime) {
    const estimatedArrival = bookingStartTime.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
    return { 
      status: "on_the_way", 
      estimatedArrival: trackingConfig.showETA ? estimatedArrival : undefined,
      progressPercentage: trackingConfig.progressMapping.on_the_way,
      daysDifference
    };
  } else if (now < bookingStartTime) {
    return { 
      status: "arrived", 
      progressPercentage: trackingConfig.progressMapping.arrived,
      daysDifference
    };
  } else if (now < bookingEndTime) {
    return { 
      status: "in_progress", 
      progressPercentage: trackingConfig.progressMapping.in_progress,
      daysDifference
    };
  } else {
    return { 
      status: "completed", 
      progressPercentage: trackingConfig.progressMapping.completed,
      daysDifference
    };
  }
};

export type BookingStatus = 
  | "confirmed" 
  | "assigned" 
  | "on_the_way" 
  | "arrived" 
  | "in_progress" 
  | "completed" 
  | "cancelled";

export const formatTimeSlot = (dateStr: string, timeSlot: string): { date: string; time: string } => {
  // Parse date string (e.g., "2024-01-28" or "Today")
  let formattedDate = dateStr;
  if (dateStr === "Today") {
    formattedDate = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } else if (dateStr === "Tomorrow") {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    formattedDate = tomorrow.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } else if (dateStr.includes("-")) {
    // ISO date format
    const date = new Date(dateStr);
    formattedDate = date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  return {
    date: formattedDate,
    time: timeSlot,
  };
};