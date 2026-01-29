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
        return '#EF4444'; // Red - cancelled/expired
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
        return 'Pending';
      case 'assigned':
        return 'Assigned';
      case 'started':
        return 'Started';
      case 'completed':
        return 'Completed';
      case 'rejected':
        return 'Rejected';
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
   * Check if booking is active (not completed, rejected, or expired)
   */
  static isActiveBooking(status: ServiceBooking['status']): boolean {
    return !['completed', 'rejected', 'expired'].includes(status);
  }

  /**
   * Get next possible status transitions (matches website workflow)
   */
  static getNextStatus(currentStatus: ServiceBooking['status']): ServiceBooking['status'][] {
    switch (currentStatus) {
      case 'pending':
        return ['assigned', 'rejected', 'expired'];
      case 'assigned':
        return ['started', 'rejected'];
      case 'started':
        return ['completed'];
      case 'completed':
      case 'rejected':
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
        return `Your ${booking.serviceName} booking is confirmed. We're looking for a technician.`;
      case 'assigned':
        return `${booking.technicianName || 'A technician'} has been assigned to your booking.`;
      case 'started':
        return `Service work is currently in progress. ${booking.technicianName || 'The technician'} is working on your issues.`;
      case 'completed':
        return 'Your service has been completed successfully. Thank you for choosing our service!';
      case 'rejected':
        return 'This booking has been rejected. Please contact support for assistance.';
      case 'expired':
        return 'This booking has expired. Please create a new booking if you still need the service.';
      default:
        return 'Booking status unknown. Please contact support.';
    }
  }
}