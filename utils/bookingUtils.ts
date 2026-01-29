import { ServiceBooking } from '../services/firestoreService';

/**
 * Utility functions for managing service bookings
 */
export class BookingUtils {
  
  /**
   * Get status color for booking status
   */
  static getStatusColor(status: ServiceBooking['status']): string {
    switch (status) {
      case 'pending':
        return '#F59E0B'; // Orange
      case 'confirmed':
        return '#3B82F6'; // Blue
      case 'in-progress':
        return '#8B5CF6'; // Purple
      case 'completed':
        return '#10B981'; // Green
      case 'cancelled':
        return '#EF4444'; // Red
      default:
        return '#6B7280'; // Gray
    }
  }

  /**
   * Get status display text
   */
  static getStatusText(status: ServiceBooking['status']): string {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'confirmed':
        return 'Confirmed';
      case 'in-progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return 'Unknown';
    }
  }

  /**
   * Check if booking can be cancelled
   */
  static canCancelBooking(status: ServiceBooking['status']): boolean {
    return status === 'pending' || status === 'confirmed';
  }

  /**
   * Check if booking is active (not completed or cancelled)
   */
  static isActiveBooking(status: ServiceBooking['status']): boolean {
    return status !== 'completed' && status !== 'cancelled';
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
}