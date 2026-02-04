/**
 * Utility functions for managing worker availability and slot-based scheduling
 */

export interface WorkerSchedule {
  workerId: string;
  workerName: string;
  companyId: string;
  services: string[]; // Services this worker can handle
  isActive: boolean;
  workingHours: {
    start: string; // "09:00"
    end: string;   // "21:00"
  };
  workingDays: string[]; // ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
  maxBookingsPerSlot: number; // How many bookings this worker can handle per time slot
}

export interface TimeSlot {
  slot: string; // "9:00 AM - 11:00 AM"
  startTime: string; // "09:00"
  endTime: string;   // "11:00"
}

export class WorkerAvailabilityUtils {
  
  /**
   * Parse time slot string to get start and end times
   */
  static parseTimeSlot(timeSlot: string): TimeSlot | null {
    try {
      // Handle formats like "9:00 AM - 11:00 AM" or "1:00 PM - 3:00 PM"
      const parts = timeSlot.split(' - ');
      if (parts.length !== 2) return null;
      
      const startTime = this.convertTo24Hour(parts[0].trim());
      const endTime = this.convertTo24Hour(parts[1].trim());
      
      if (!startTime || !endTime) return null;
      
      return {
        slot: timeSlot,
        startTime,
        endTime
      };
    } catch (error) {
      console.error('Error parsing time slot:', error);
      return null;
    }
  }
  
  /**
   * Convert 12-hour format to 24-hour format
   */
  static convertTo24Hour(time12h: string): string | null {
    try {
      const [time, modifier] = time12h.split(' ');
      let [hours, minutes] = time.split(':');
      
      if (hours === '12') {
        hours = '00';
      }
      
      if (modifier === 'PM') {
        hours = (parseInt(hours, 10) + 12).toString();
      }
      
      return `${hours.padStart(2, '0')}:${minutes}`;
    } catch (error) {
      console.error('Error converting time format:', error);
      return null;
    }
  }
  
  /**
   * Check if a worker is available for a specific time slot
   */
  static isWorkerAvailableForSlot(
    worker: WorkerSchedule, 
    date: string, 
    timeSlot: string
  ): boolean {
    try {
      // Check if worker is active
      if (!worker.isActive) return false;
      
      // Parse the time slot
      const slot = this.parseTimeSlot(timeSlot);
      if (!slot) return false;
      
      // Check if worker works during these hours
      const workerStart = worker.workingHours.start;
      const workerEnd = worker.workingHours.end;
      
      if (slot.startTime < workerStart || slot.endTime > workerEnd) {
        return false;
      }
      
      // Check if worker works on this day
      const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      if (!worker.workingDays.includes(dayOfWeek)) {
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error checking worker availability:', error);
      return false;
    }
  }
  
  /**
   * Get available workers for a company, service, date, and time slot
   */
  static async getAvailableWorkers(
    companyId: string,
    serviceType: string,
    date: string,
    timeSlot: string
  ): Promise<{
    availableWorkers: WorkerSchedule[];
    busyWorkers: WorkerSchedule[];
    totalWorkers: WorkerSchedule[];
  }> {
    try {
      const { firestore } = require('../firebase.native');
      
      // Get all active workers for this company
      const workersQuery = await firestore()
        .collection('service_workers')
        .where('companyId', '==', companyId)
        .where('isActive', '==', true)
        .get();
      
      const allWorkers: WorkerSchedule[] = [];
      
      // Convert Firestore documents to WorkerSchedule objects
      workersQuery.docs.forEach(doc => {
        const data = doc.data();
        
        // Default schedule if not specified
        const defaultSchedule: WorkerSchedule = {
          workerId: doc.id,
          workerName: data.name || data.workerName || 'Unknown Worker',
          companyId: data.companyId,
          services: data.services || [serviceType], // Default to requested service
          isActive: data.isActive || false,
          workingHours: data.workingHours || { start: "09:00", end: "21:00" },
          workingDays: data.workingDays || ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"],
          maxBookingsPerSlot: data.maxBookingsPerSlot || 1
        };
        
        allWorkers.push(defaultSchedule);
      });
      
      // Filter workers who can handle this service type
      const serviceWorkers = allWorkers.filter(worker => 
        worker.services.includes(serviceType) || worker.services.includes('all')
      );
      
      // Check which workers are available for this time slot
      const availableWorkers: WorkerSchedule[] = [];
      const busyWorkers: WorkerSchedule[] = [];
      
      for (const worker of serviceWorkers) {
        // Check schedule availability
        const isScheduleAvailable = this.isWorkerAvailableForSlot(worker, date, timeSlot);
        
        if (!isScheduleAvailable) {
          busyWorkers.push(worker);
          continue;
        }
        
        // Check existing bookings
        const isBookingAvailable = await this.checkWorkerBookingAvailability(
          worker.workerId, 
          date, 
          timeSlot, 
          worker.maxBookingsPerSlot
        );
        
        if (isBookingAvailable) {
          availableWorkers.push(worker);
        } else {
          busyWorkers.push(worker);
        }
      }
      
      return {
        availableWorkers,
        busyWorkers,
        totalWorkers: serviceWorkers
      };
      
    } catch (error) {
      console.error('Error getting available workers:', error);
      return {
        availableWorkers: [],
        busyWorkers: [],
        totalWorkers: []
      };
    }
  }
  
  /**
   * Check if worker has booking capacity for a specific time slot
   */
  static async checkWorkerBookingAvailability(
    workerId: string,
    date: string,
    timeSlot: string,
    maxBookingsPerSlot: number = 1
  ): Promise<boolean> {
    try {
      const { firestore } = require('../firebase.native');
      
      // Count existing bookings for this worker at this time
      const bookingsQuery = await firestore()
        .collection('service_bookings')
        .where('workerId', '==', workerId)
        .where('date', '==', date)
        .where('time', '==', timeSlot)
        .where('status', 'in', ['assigned', 'started']) // Active bookings only
        .get();
      
      const currentBookings = bookingsQuery.docs.length;
      
      console.log(`👷 Worker ${workerId} has ${currentBookings}/${maxBookingsPerSlot} bookings for ${date} ${timeSlot}`);
      
      return currentBookings < maxBookingsPerSlot;
      
    } catch (error) {
      console.error('Error checking worker booking availability:', error);
      return false;
    }
  }
  
  /**
   * Get company availability summary for a time slot
   */
  static async getCompanyAvailabilitySummary(
    companyId: string,
    serviceType: string,
    date: string,
    timeSlot: string
  ): Promise<{
    status: 'available' | 'all_busy' | 'no_workers' | 'service_disabled';
    message: string;
    availableCount: number;
    totalCount: number;
    details: string[];
  }> {
    try {
      const { availableWorkers, busyWorkers, totalWorkers } = await this.getAvailableWorkers(
        companyId,
        serviceType,
        date,
        timeSlot
      );
      
      const availableCount = availableWorkers.length;
      const totalCount = totalWorkers.length;
      
      if (totalCount === 0) {
        return {
          status: 'service_disabled',
          message: 'Service not offered',
          availableCount: 0,
          totalCount: 0,
          details: ['No workers available for this service']
        };
      }
      
      if (availableCount === 0) {
        return {
          status: 'all_busy',
          message: `All ${totalCount} workers busy`,
          availableCount: 0,
          totalCount,
          details: busyWorkers.map(w => `${w.workerName}: Busy/Unavailable`)
        };
      }
      
      return {
        status: 'available',
        message: `${availableCount} worker${availableCount > 1 ? 's' : ''} available`,
        availableCount,
        totalCount,
        details: [
          ...availableWorkers.map(w => `${w.workerName}: Available`),
          ...busyWorkers.map(w => `${w.workerName}: Busy`)
        ]
      };
      
    } catch (error) {
      console.error('Error getting company availability summary:', error);
      return {
        status: 'no_workers',
        message: 'Unable to check availability',
        availableCount: 0,
        totalCount: 0,
        details: ['Error checking worker availability']
      };
    }
  }
}