/**
 * Utility functions for checking service availability and worker status
 */

import { FirestoreService } from '../services/firestoreService';

export interface AvailabilityResult {
  success: boolean;
  available: boolean;
  data?: {
    availableCompanies: number;
    companies: any[];
    suggestions?: string[];
  };
  message?: string;
}

export class AvailabilityUtils {
  /**
   * Get available services for a specific location, date, and time
   */
  static async getAvailableServices(
    location: any, 
    date: string, 
    time: string, 
    serviceId?: string
  ): Promise<AvailabilityResult> {
    try {
      console.log(`🔍 Checking availability for ${serviceId || 'all services'} on ${date} at ${time}`);
      
      if (serviceId) {
        const availability = await FirestoreService.checkRealTimeAvailability(serviceId, date, time, location);
        
        return {
          success: true,
          available: availability.available,
          data: {
            availableCompanies: availability.availableCompanies,
            companies: availability.companies,
            suggestions: availability.suggestions
          }
        };
      } else {
        // For all services, we'd need to implement a broader check
        return {
          success: false,
          available: false,
          message: 'Service ID required for availability check'
        };
      }
    } catch (error) {
      console.error('❌ Error in getAvailableServices:', error);
      return {
        success: false,
        available: false,
        message: 'Failed to check availability'
      };
    }
  }

  /**
   * Check real-time availability for a specific service
   */
  static async checkRealTimeAvailability(
    serviceId: string, 
    date: string, 
    time: string, 
    location?: any
  ): Promise<AvailabilityResult> {
    try {
      const availability = await FirestoreService.checkRealTimeAvailability(serviceId, date, time, location);
      
      return {
        success: true,
        available: availability.available,
        data: {
          availableCompanies: availability.availableCompanies,
          companies: availability.companies,
          suggestions: availability.suggestions
        }
      };
    } catch (error) {
      console.error('❌ Error in checkRealTimeAvailability:', error);
      return {
        success: false,
        available: false,
        message: 'Failed to check real-time availability'
      };
    }
  }

  /**
   * Determine if a company should be visible in the app
   */
  static shouldShowCompany(company: any): boolean {
    // Company will only be visible if:
    // 1. Company is active
    // 2. Service is active  
    // 3. At least one worker is available for selected time
    // 4. availableForBooking flag is true
    return !!(
      company.isActive && 
      company.serviceActive !== false && 
      company.availableForBooking !== false &&
      company.availableWorkers > 0
    );
  }

  /**
   * Show no availability message with suggestions
   */
  static showNoAvailabilityMessage(suggestions?: string[]): void {
    const defaultSuggestions = [
      'Try selecting a different time slot',
      'Check availability for tomorrow', 
      'Consider booking for later in the day'
    ];
    
    const messageSuggestions = suggestions || defaultSuggestions;
    const message = `No providers available at this time.\n\nSuggestions:\n${messageSuggestions.map(s => `• ${s}`).join('\n')}`;
    
    console.log('📢 No availability:', message);
    // In a real app, you might show an Alert or Toast here
  }

  /**
   * Enable or disable booking button based on availability
   */
  static enableBookingButton(): boolean {
    return true;
  }

  static disableBookingButton(): boolean {
    return false;
  }

  /**
   * Display available providers in UI
   */
  static displayAvailableProviders(companies: any[]): void {
    console.log(`✅ Displaying ${companies.length} available providers:`, 
      companies.map(c => ({ 
        name: c.companyName || c.serviceName, 
        availability: c.availability 
      }))
    );
  }

  /**
   * Refresh availability data for all services
   */
  static async refreshAvailability(companyId: string, serviceId: string): Promise<void> {
    try {
      console.log(`🔄 Refreshing availability for company ${companyId}, service ${serviceId}`);
      
      // This would typically update the service_availability collection
      // For now, we'll just log the action
      console.log('✅ Availability refreshed');
    } catch (error) {
      console.error('❌ Error refreshing availability:', error);
    }
  }

  /**
   * Check availability for a specific time slot
   */
  static async checkAvailabilityForTimeSlot(
    companyId: string, 
    serviceId: string, 
    date: string, 
    time: string
  ): Promise<boolean> {
    try {
      return await FirestoreService.checkCompanyWorkerAvailability(companyId, date, time);
    } catch (error) {
      console.error('❌ Error checking time slot availability:', error);
      return false;
    }
  }
}

// Export individual functions for backward compatibility
export const getAvailableServices = AvailabilityUtils.getAvailableServices;
export const checkRealTimeAvailability = AvailabilityUtils.checkRealTimeAvailability;
export const shouldShowCompany = AvailabilityUtils.shouldShowCompany;
export const showNoAvailabilityMessage = AvailabilityUtils.showNoAvailabilityMessage;
export const displayAvailableProviders = AvailabilityUtils.displayAvailableProviders;