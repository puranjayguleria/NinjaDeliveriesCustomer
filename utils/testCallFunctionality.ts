/**
 * Test utility for phone call functionality
 */

import { Linking, Alert } from 'react-native';

export class CallFunctionalityTest {
  /**
   * Test if the device can make phone calls
   */
  static async testPhoneCallCapability() {
    console.log('📞 Testing phone call capability...');
    
    try {
      const canCall = await Linking.canOpenURL('tel:+911234567890');
      console.log(`📞 Device can make calls: ${canCall}`);
      return canCall;
    } catch (error) {
      console.error('📞 Error testing call capability:', error);
      return false;
    }
  }

  /**
   * Test making a phone call (will actually attempt to call)
   */
  static async testMakeCall(phoneNumber: string, contactName: string = 'Test Contact') {
    console.log(`📞 Testing call to ${contactName} at ${phoneNumber}...`);
    
    try {
      const canCall = await this.testPhoneCallCapability();
      
      if (!canCall) {
        Alert.alert('Cannot Make Calls', 'This device cannot make phone calls');
        return false;
      }

      Alert.alert(
        'Test Call',
        `This will attempt to call ${contactName} at ${phoneNumber}. Continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Call',
            onPress: () => {
              Linking.openURL(`tel:${phoneNumber}`).catch((error) => {
                console.error('📞 Error making test call:', error);
                Alert.alert('Call Failed', 'Unable to make phone call');
              });
            }
          }
        ]
      );
      
      return true;
    } catch (error) {
      console.error('📞 Error in test call:', error);
      return false;
    }
  }

  /**
   * Validate phone number format
   */
  static validatePhoneNumber(phoneNumber: string): boolean {
    if (!phoneNumber || phoneNumber.trim() === '') {
      return false;
    }

    // Basic phone number validation (supports various formats)
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    const cleanNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');
    
    return phoneRegex.test(cleanNumber);
  }

  /**
   * Format phone number for display
   */
  static formatPhoneNumber(phoneNumber: string): string {
    if (!phoneNumber) return '';
    
    // Remove all non-digit characters except +
    const cleaned = phoneNumber.replace(/[^\d\+]/g, '');
    
    // If it's an Indian number, format it nicely
    if (cleaned.startsWith('+91') && cleaned.length === 13) {
      return `+91 ${cleaned.slice(3, 8)} ${cleaned.slice(8)}`;
    }
    
    return cleaned;
  }

  /**
   * Test the complete call flow for a booking
   */
  static async testBookingCallFlow(workerId: string, workerName: string) {
    console.log(`📞 Testing call flow for worker ${workerId}, name ${workerName}...`);
    
    try {
      // Simulate fetching worker phone from service_workers collection
      const mockWorkerPhone = '+911234567890'; // Replace with actual fetch logic
      
      if (!this.validatePhoneNumber(mockWorkerPhone)) {
        console.log('📞 Invalid phone number format');
        Alert.alert('Invalid Phone', 'The phone number format is invalid');
        return false;
      }

      const formattedPhone = this.formatPhoneNumber(mockWorkerPhone);
      console.log(`📞 Formatted phone: ${formattedPhone}`);

      await this.testMakeCall(mockWorkerPhone, workerName);
      return true;
      
    } catch (error) {
      console.error('📞 Error in booking call flow test:', error);
      return false;
    }
  }
}

// Usage examples:
//
// Test if device can make calls:
// await CallFunctionalityTest.testPhoneCallCapability();
//
// Test making a call:
// await CallFunctionalityTest.testMakeCall('+911234567890', 'John Smith');
//
// Validate phone number:
// const isValid = CallFunctionalityTest.validatePhoneNumber('+911234567890');
//
// Test complete booking call flow:
// await CallFunctionalityTest.testBookingCallFlow('worker123', 'John Smith');