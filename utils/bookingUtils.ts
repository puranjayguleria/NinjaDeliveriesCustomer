import { ServiceBooking } from '../services/firestoreService';

/**
 * Utility functions for managing service bookings
 * Matches website status flow: pending → assigned → started → completed
 */
export class BookingUtils {
  
  /**
   * Get status color for booking status (matches website)
   */
  static getStatusColor(status: ServiceBooking['status']): string {
    switch (status) {
      case 'pending':
        return '#F59E0B'; // Orange - waiting for assignment
      case 'assigned':
        return '#3B82F6'; // Blue - technician assigned
      case 'started':
        return '#8B5CF6'; // Purple - work in progress
      case 'completed':
        return '#10B981'; // Green - work finished
      case 'rejected':
      case 'expired':
        return '#EF4444'; // Red - admin rejected/expired
      case 'cancelled':
        return '#F97316'; // Orange - user cancelled
      default:
        return '#6B7280'; // Gray
    }
  }

  /**
   * Get status display text (matches website)
   */
  static getStatusText(status: ServiceBooking['status']): string {
    switch (status) {
      case 'pending':
        return 'Assigning Worker';
      case 'assigned':
        return 'Assigned';
      case 'started':
        return 'Started';
      case 'completed':
        return 'Completed';
      case 'rejected':
        return 'Rejected';
      case 'cancelled':
        return 'Cancelled';
      case 'expired':
        return 'Expired';
      default:
        return 'Unknown';
    }
  }

  /**
   * Check if booking can be cancelled
   */
  static canCancelBooking(status: ServiceBooking['status']): boolean {
    return status === 'pending' || status === 'assigned';
  }

  /**
   * Check if booking is active (not completed, rejected, cancelled, or expired)
   */
  static isActiveBooking(status: ServiceBooking['status']): boolean {
    return !['completed', 'rejected', 'cancelled', 'expired'].includes(status);
  }

  /**
   * Get next possible status transitions (matches website workflow)
   */
  static getNextStatus(currentStatus: ServiceBooking['status']): ServiceBooking['status'][] {
    switch (currentStatus) {
      case 'pending':
        return ['assigned', 'rejected', 'cancelled', 'expired'];
      case 'assigned':
        return ['started', 'rejected', 'cancelled'];
      case 'started':
        return ['completed'];
      case 'completed':
      case 'rejected':
      case 'cancelled':
      case 'expired':
        return []; // Terminal states
      default:
        return [];
    }
  }

  /**
   * Format booking date for display
   */
  static formatBookingDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
  }

  /**
   * Format booking time for display
   */
  static formatBookingTime(timeString: string): string {
    // If already formatted (contains AM/PM), return as is
    if (timeString.includes('AM') || timeString.includes('PM')) {
      return timeString;
    }
    
    // If in 24-hour format, convert to 12-hour
    try {
      const [hours, minutes] = timeString.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    } catch (error) {
      return timeString;
    }
  }

  /**
   * Calculate booking progress percentage based on status
   */
  static getProgressPercentage(status: ServiceBooking['status']): number {
    switch (status) {
      case 'pending':
        return 10;
      case 'assigned':
        return 25;
      case 'started':
        return 75;
      case 'completed':
        return 100;
      case 'rejected':
      case 'cancelled':
      case 'expired':
        return 0;
      default:
        return 0;
    }
  }

  /**
   * Get status message for display
   */
  static getStatusMessage(booking: ServiceBooking): string {
    switch (booking.status) {
      case 'pending':
        return `Your ${booking.serviceName} booking is confirmed. We're finding the best technician for your service.`;
      case 'assigned':
        return booking.technicianName 
          ? `Great news! ${booking.technicianName} has been assigned to your ${booking.serviceName} service.`
          : 'A technician has been assigned to your booking and will contact you soon.';
      case 'started':
        const technicianInfo = booking.technicianName ? ` ${booking.technicianName} is` : ' Your technician is';
        const otpMessage = booking.completionOtp 
          ? ` Completion OTP: ${booking.completionOtp}` 
          : '';
        return `${technicianInfo} currently working on your service.${otpMessage}`;
      case 'completed':
        const completedBy = booking.technicianName ? ` by ${booking.technicianName}` : '';
        return `Your service has been completed successfully${completedBy}. Thank you for choosing our service!`;
      case 'rejected':
        return 'This booking has been rejected by the admin. Please contact support for assistance or find alternative service providers.';
      case 'cancelled':
        return 'You have cancelled this booking. You can create a new booking if you still need the service.';
      case 'expired':
        return 'This booking has expired. Please create a new booking if you still need the service.';
      default:
        return 'Booking status unknown. Please contact support.';
    }
  }

  /**
   * Check if service is overdue (past estimated completion time)
   */
  static isServiceOverdue(booking: ServiceBooking): boolean {
    if (booking.status !== 'started' || !booking.startedAt) {
      return false;
    }

    try {
      const startTime = booking.startedAt.toDate ? booking.startedAt.toDate() : new Date(booking.startedAt);
      const duration = booking.estimatedDuration || 2; // Default 2 hours
      const estimatedCompletion = new Date(startTime.getTime() + (duration * 60 * 60 * 1000));
      
      return new Date() > estimatedCompletion;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get technician assignment status message
   */
  static getTechnicianStatusMessage(booking: ServiceBooking): string {
    if (booking.technicianName) {
      switch (booking.status) {
        case 'assigned':
          return `${booking.technicianName} has been assigned and will contact you soon`;
        case 'started':
          return `${booking.technicianName} is currently working on your service`;
        case 'completed':
          return `Service completed by ${booking.technicianName}`;
        default:
          return `Technician: ${booking.technicianName}`;
      }
    } else {
      switch (booking.status) {
        case 'pending':
          return 'We\'re finding the best technician for your service';
        case 'assigned':
          return 'A technician has been assigned and will contact you soon';
        default:
          return 'Technician information not available';
      }
    }
  }

  /**
   * Check if technician information should be prominently displayed
   */
  static shouldHighlightTechnician(booking: ServiceBooking): boolean {
    return booking.status === 'assigned' || booking.status === 'started';
  }

  /**
   * Get time remaining for service completion
   */
  static getTimeRemaining(booking: ServiceBooking): string | null {
    if (booking.status !== 'started' || !booking.startedAt) {
      return null;
    }

    try {
      const startTime = booking.startedAt.toDate ? booking.startedAt.toDate() : new Date(booking.startedAt);
      const duration = booking.estimatedDuration || 2; // Default 2 hours
      const estimatedCompletion = new Date(startTime.getTime() + (duration * 60 * 60 * 1000));
      const now = new Date();
      
      if (now > estimatedCompletion) {
        const overdue = Math.floor((now.getTime() - estimatedCompletion.getTime()) / (1000 * 60));
        return `Overdue by ${overdue} min`;
      }
      
      const remaining = Math.floor((estimatedCompletion.getTime() - now.getTime()) / (1000 * 60));
      const hours = Math.floor(remaining / 60);
      const minutes = remaining % 60;
      
      if (hours > 0) {
        return `${hours}h ${minutes}m remaining`;
      } else {
        return `${minutes}m remaining`;
      }
    } catch (error) {
      return null;
    }
  }
}