import { BookingType, BookingStatus } from './trackingConfig';

// Configuration interface for easy customization
export interface TrackingConfiguration {
  // Time offsets (in minutes before booking start time)
  assignmentOffset: number;      // When technician gets assigned
  departureOffset: number;       // When technician starts traveling
  arrivalOffset: number;         // When technician arrives at location
  
  // Progress percentages for each status
  progressMapping: {
    confirmed: number;
    assigned: number;
    on_the_way: number;
    arrived: number;
    in_progress: number;
    completed: number;
  };
  
  // UI Configuration
  showETA: boolean;
  allowCancellation: boolean;
  technicianCallEnabled: boolean;
  updateInterval: number; // in milliseconds
  
  // Status messages customization
  customMessages?: {
    [key in BookingStatus]?: (data: any) => string;
  };
}

// Default configuration
export const DEFAULT_TRACKING_CONFIG: TrackingConfiguration = {
  assignmentOffset: 90,      // 1.5 hours before
  departureOffset: 30,       // 30 minutes before
  arrivalOffset: 5,          // 5 minutes before
  
  progressMapping: {
    confirmed: 10,
    assigned: 25,
    on_the_way: 50,
    arrived: 70,
    in_progress: 85,
    completed: 100,
  },
  
  showETA: true,
  allowCancellation: true,
  technicianCallEnabled: true,
  updateInterval: 60000, // 1 minute
};

// Service-specific configurations
export const SERVICE_CONFIGS: Record<BookingType, Partial<TrackingConfiguration>> = {
  electrician: {
    assignmentOffset: 90,
    departureOffset: 30,
    arrivalOffset: 5,
    showETA: true,
    allowCancellation: true,
  },
  
  plumber: {
    assignmentOffset: 60,      // 1 hour before (faster response)
    departureOffset: 20,       // 20 minutes before
    arrivalOffset: 5,
    showETA: true,
    allowCancellation: true,
  },
  
  cleaning: {
    assignmentOffset: 120,     // 2 hours before (more preparation time)
    departureOffset: 45,       // 45 minutes before
    arrivalOffset: 10,         // 10 minutes before
    showETA: true,
    allowCancellation: true,
    updateInterval: 120000,    // 2 minutes (less frequent updates)
  },
  
  health: {
    assignmentOffset: 60,
    departureOffset: 15,       // 15 minutes before (quick response)
    arrivalOffset: 2,          // 2 minutes before (very precise)
    showETA: true,
    allowCancellation: false,  // Health services shouldn't be cancelled easily
    updateInterval: 30000,     // 30 seconds (more frequent updates)
  },
  
  dailywages: {
    assignmentOffset: 180,     // 3 hours before (longer preparation)
    departureOffset: 60,       // 1 hour before
    arrivalOffset: 15,         // 15 minutes before
    showETA: false,            // Daily wages don't need precise ETA
    allowCancellation: true,
    updateInterval: 300000,    // 5 minutes (less frequent updates)
  },
  
  carwash: {
    assignmentOffset: 30,      // 30 minutes before (quick service)
    departureOffset: 10,       // 10 minutes before
    arrivalOffset: 2,          // 2 minutes before
    showETA: true,
    allowCancellation: true,
    updateInterval: 30000,     // 30 seconds (frequent updates for quick service)
  },
};

// Get merged configuration for a booking type
export const getTrackingConfiguration = (bookingType: BookingType): TrackingConfiguration => {
  const serviceConfig = SERVICE_CONFIGS[bookingType] || {};
  return { ...DEFAULT_TRACKING_CONFIG, ...serviceConfig };
};

// Configuration presets for different scenarios
export const TRACKING_PRESETS = {
  // For testing - very fast progression
  DEMO_FAST: {
    assignmentOffset: 5,       // 5 minutes before
    departureOffset: 3,        // 3 minutes before
    arrivalOffset: 1,          // 1 minute before
    updateInterval: 10000,     // 10 seconds
  },
  
  // For emergency services
  EMERGENCY: {
    assignmentOffset: 15,      // 15 minutes before
    departureOffset: 5,        // 5 minutes before
    arrivalOffset: 1,          // 1 minute before
    updateInterval: 15000,     // 15 seconds
    allowCancellation: false,
  },
  
  // For scheduled maintenance
  MAINTENANCE: {
    assignmentOffset: 240,     // 4 hours before
    departureOffset: 60,       // 1 hour before
    arrivalOffset: 15,         // 15 minutes before
    updateInterval: 300000,    // 5 minutes
    showETA: false,
  },
};

// Apply a preset to a booking type
export const applyPreset = (
  bookingType: BookingType, 
  preset: keyof typeof TRACKING_PRESETS
): TrackingConfiguration => {
  const baseConfig = getTrackingConfiguration(bookingType);
  const presetConfig = TRACKING_PRESETS[preset];
  return { ...baseConfig, ...presetConfig };
};

// Utility to create custom configuration
export const createCustomConfig = (
  baseType: BookingType,
  overrides: Partial<TrackingConfiguration>
): TrackingConfiguration => {
  const baseConfig = getTrackingConfiguration(baseType);
  return { ...baseConfig, ...overrides };
};