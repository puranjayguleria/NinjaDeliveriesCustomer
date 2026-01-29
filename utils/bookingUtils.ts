import { ServiceBooking } from '../services/firestoreService';

/**
 * Utility functions for managing service bookings
 */
export class BookingUtils {
  
  /**
   * Get status color for booking status (matches website)
   */
  static getStatusColor(status: ServiceBooking['status']): string {
    switch (status) {
      case 'pending':
        return '#F59E0B'; // Orange
      case 'assigned':
        return '#3B82F6'; // Blue
      case 'started':
        return '#8B5CF6'; // Purple
      case 'completed':
        return '#10B981'; // Green
      case 'rejected':
        return '#EF4444'; // Red
      case 'expired':
        return '#6B7280'; // Gray
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
   * Get status icon (matches website)
   */
  static getStatusIcon(status: ServiceBooking['status']): string {
    switch (status) {
      case 'pending':
        return '⏱️';
      case 'assigned':
        return '👤';
      case 'started':
        return '🔧';
      case 'completed':
        return '✅';
      case 'rejected':
        return '❌';
      case 'expired':
        return '⏰';
      default:
        return '❓';
    }
  }

  /**
   * Check if booking can be cancelled (matches website logic)
   */
  static canCancelBooking(status: ServiceBooking['status']): boolean {
    return status === 'pending' || status === 'assigned';
  }

  /**
   * Check if booking is active (matches website logic)
   */
  static isActiveBooking(status: ServiceBooking['status']): boolean {
    return !['completed', 'rejected', 'expired'].includes(status);
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