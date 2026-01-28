export type BookingType = 'electrician' | 'plumber' | 'cleaning' | 'health' | 'dailywages' | 'carwash';

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