// screens/TermsAndConditionsScreen.tsx

import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  ScrollView, 
  ActivityIndicator 
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import Markdown from 'react-native-markdown-display';
import { CommonActions, useNavigation } from '@react-navigation/native';

const TermsAndConditionsScreen: React.FC = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const navigation = useNavigation();

  useEffect(() => {
    // Check if the user has already accepted the terms
    const checkAcceptance = async () => {
      try {
        const user = auth().currentUser;

        // === Minimal Change: if there's no user at all, skip T&C and go to AppTabs ===
        if (!user) {
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'AppTabs' }],
            })
          );
          return;
        }
        // === End minimal change ===

        const userDoc = await firestore().collection('users').doc(user.uid).get();
        if (userDoc.exists) {
          const data = userDoc.data();
          if (data?.hasAcceptedTerms) {
            // User has already accepted; navigate to main app flow.
            navigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: 'AppTabs' }],
              })
            );
          } else {
            // User hasn't accepted, so show the T&C.
            setIsLoading(false);
          }
        } else {
          // If user document doesn't exist, create it with hasAcceptedTerms: false.
          await firestore().collection('users').doc(user.uid).set({
            phoneNumber: user.phoneNumber,
            expoPushToken: null, // Handle expoPushToken appropriately
            hasAcceptedTerms: false,
          });
          setIsLoading(false);
        }
      } catch (error: any) {
        console.error('Error checking terms acceptance:', error);
        Alert.alert('Error', 'Failed to verify terms acceptance. Please try again.');
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          })
        );
      }
    };

    checkAcceptance();
  }, [navigation]);

  const handleAccept = async () => {
    setIsProcessing(true); // Start loader
    try {
      const user = auth().currentUser;
      if (user) {
        // Update hasAcceptedTerms to true in Firestore
        await firestore().collection('users').doc(user.uid).update({
          hasAcceptedTerms: true,
        });
        Alert.alert('Success', 'You have successfully accepted the Terms and Conditions!');
        
        // Reset navigation to the main app flow.
        // "AppTabs" is registered in your root navigator.
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'AppTabs' }],
          })
        );
      } else {
        Alert.alert('Error', 'User not authenticated.');
      }
    } catch (error: any) {
      console.error('Error accepting terms:', error);
      Alert.alert('Error', 'Failed to accept terms. Please try again.');
    } finally {
      setIsProcessing(false); // Stop loader
    }
  };
  
  const handleDecline = async () => {
    setIsProcessing(true); // Start loader
    try {
      Alert.alert('Notice', 'You must accept the Terms and Conditions to proceed.');
      
      // Sign the user out
      await auth().signOut();
      
      // Navigate to Login screen and reset navigation stack
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        })
      );
    } catch (error: any) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out.');
    } finally {
      setIsProcessing(false); // Stop loader
    }
  };

  // Updated markdown content with the new privacy policy text
  const markdownContent = `
________________________________________
### 1. Introduction
#### 1.1 About Us
Welcome to “Ninja Deliveries Private Limited” (“Company,” “we,” or “us”). We operate an online platform (“Platform”) and associated services enabling customers (“you,” “user,” or “customer”) to purchase groceries and related products, which we store in our cold storage facilities and deliver within a defined geographic radius.

#### 1.2 Acceptance
By accessing or using our Platform or any related services, you agree to these Terms and Conditions (“Terms”). If you do not agree, you must not use our Platform. You should read these Terms carefully before using our services.
________________________________________
### 2. Eligibility
#### 2.1 Legal Age
To use our Platform, you must be at least 18 years old or have reached the age of majority in your jurisdiction. By using our services, you warrant that you meet this age requirement.

#### 2.2 Compliance
You agree to use our Platform in compliance with these Terms and all applicable local, state/provincial, national, and international laws, rules, and regulations.
________________________________________
### 3. User Accounts
#### 3.1 Registration
To place orders, you may be required to register for an account. You agree to provide accurate, current, and complete information during registration.

#### 3.2 Account Security
You are responsible for maintaining the confidentiality of your login credentials and are fully responsible for all activities under your account. You agree to notify us immediately of any unauthorized use of your account or any other security breach.

#### 3.3 Account Termination
We reserve the right to suspend, deactivate, or terminate your account at any time if we suspect fraudulent activity, breach of these Terms, or for any other legitimate business reason.
________________________________________
### 4. Ordering & Payment
#### 4.1 Product Selection
Our Platform displays available products, including groceries and other goods. Prices and availability are subject to change without notice, and we reserve the right to limit quantities.

#### 4.2 Order Confirmation
When you place an order, you will receive an email or in-app confirmation summarizing the products ordered and the total price. The confirmation does not constitute acceptance of the order; we reserve the right to cancel orders for any reason, including stock unavailability or errors in product information.

#### 4.3 Pricing & Fees
All prices listed are in [Rupees]. You agree to pay all applicable fees, including taxes and delivery charges. We make reasonable efforts to ensure accurate pricing but are not liable for typographical or pricing errors.

#### 4.4 Payment Methods
We accept payment through the methods listed on our Platform (e.g., credit cards, debit cards, digital wallets). By submitting payment information, you represent and warrant that you are authorized to use the designated payment method.
________________________________________
### 5. Delivery & Order Fulfilment
#### 5.1 Delivery Radius
We currently deliver within a [10 km] radius of our cold storage facility (or as otherwise indicated on our Platform).

#### 5.2 Delivery Schedule
We strive to deliver orders within the estimated time frames; however, delivery times are not guaranteed and may vary due to factors beyond our control (e.g., weather, traffic, product availability).

#### 5.3 Acceptance of Delivery
You (or your authorized representative) must be present at the delivery address to receive the order. In the event of a missed delivery, additional delivery charges may apply.

#### 5.4 Risk of Loss
All products purchased from us are made pursuant to a shipment contract. Risk of loss and title for purchased products pass to you upon delivery.
________________________________________
### 6. Returns & Refunds
#### 6.1 Perishable Goods
Due to the perishable nature of groceries, all sales of perishable items are final. We do not accept returns or provide refunds for fresh produce, dairy, or other perishable goods unless the product delivered is defective, damaged, or incorrect at the time of delivery.

#### 6.2 Non-Perishable Goods
For non-perishable goods, you may request a return within 2 days of delivery, provided the item is unused and in its original packaging. Shipping or pick-up fees for returns may apply.

#### 6.3 Refund Process
If your return or refund request is approved, we will process the refund to your original payment method within a reasonable time frame.
________________________________________
### 7. User Conduct
#### 7.1 Lawful Use
You agree to use the Platform only for lawful purposes. You must not use the Platform in a manner that violates any applicable local, state/provincial, national, or international law or regulation.

#### 7.2 Prohibited Activities
You agree not to:
- Harass, threaten, or defraud other users, employees, or partners of the Company.
- Disrupt the normal flow of dialogue, or otherwise act in a manner that negatively affects other users’ ability to use the Platform.
- Upload or transmit any viruses or other harmful code.
- Attempt to gain unauthorized access to other users’ accounts or the Company’s systems.
________________________________________
### 8. Intellectual Property
#### 8.1 Ownership
All content on the Platform, including but not limited to text, graphics, logos, and images (“Content”), is the property of the Company or its content suppliers and is protected by intellectual property laws.

#### 8.2 License to Use
Subject to these Terms, we grant you a limited, non-exclusive, non-transferable license to access and use the Platform for personal, non-commercial purposes.

#### 8.3 Restrictions
You must not reproduce, distribute, modify, or create derivative works of any Content without our prior written consent.
________________________________________
### 9. Privacy
#### 9.1 Data Collection
We collect, use, and store your personal information in accordance with our Privacy Policy. By using the Platform, you consent to such processing and you warrant that all data provided by you is accurate.

#### 9.2 Security Measures
We implement reasonable security measures to protect your information; however, no online platform can guarantee complete data security. You agree that you use our Platform at your own risk.
________________________________________
### 10. Disclaimer of Warranties
#### 10.1 As-Is Basis
Except as expressly stated, the Platform and all products/services provided via the Platform are offered on an “as-is” and “as-available” basis without warranties of any kind, whether express or implied.

#### 10.2 No Guarantee
We do not guarantee that the Platform will be uninterrupted, error-free, or free of viruses or other harmful components. We are not responsible for any losses or damages caused by interruptions or errors in our services.
________________________________________
### 11. Limitation of Liability
#### 11.1 Maximum Liability
To the fullest extent permitted by law, in no event will the Company, its affiliates, directors, officers, employees, agents, suppliers, or licensors be liable for any indirect, consequential, incidental, special, or punitive damages arising out of or related to your use of the Platform, even if advised of the possibility of such damages.

#### 11.2 Aggregate Damages
In no event will our total liability to you for all damages exceed the amount paid by you to us in the [last 6 months] for the specific product or service from which the liability arose.
________________________________________
### 12. Indemnification
You agree to indemnify, defend, and hold the Company, its affiliates, and their respective directors, officers, employees, and agents harmless from any claims, liabilities, damages, judgments, awards, losses, costs, expenses, or fees (including reasonable attorneys’ fees) arising out of or relating to your violation of these Terms or your use of the Platform.
________________________________________
### 13. Modifications & Termination
#### 13.1 Changes to Terms
We may modify these Terms at any time. Changes will be effective upon posting on our Platform. Your continued use of the Platform after changes are posted constitutes your acceptance of the modified Terms.

#### 13.2 Termination
We reserve the right to discontinue, suspend, or terminate any part of the Platform or these Terms at any time, without notice or liability.
________________________________________
### 14. Governing Law & Dispute Resolution
#### 14.1 Governing Law
These Terms are governed by and construed in accordance with the laws of India, (Himachal Pradesh) without regard to its conflict of law principles.

#### 14.2 Dispute Resolution
Any dispute arising out of or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts located in Himachal Pradesh, India. We encourage you to first contact us to seek an amicable resolution.
________________________________________
### 15. Miscellaneous
#### 15.1 Severability
If any provision of these Terms is held to be invalid or unenforceable, such provision shall be struck and the remaining provisions shall be enforced to the fullest extent under law.

#### 15.2 Entire Agreement
These Terms, together with our Privacy Policy and any other policies referenced herein, constitute the entire agreement between you and the Company concerning the subject matter herein and supersede all prior or contemporaneous communications.

#### 15.3 No Waiver
Our failure to enforce any right or provision of these Terms shall not be deemed a waiver of such right or provision.

#### 15.4 Assignment
You may not assign or transfer these Terms or any rights or obligations herein without our prior written consent. We may assign these Terms at any time without notice.
________________________________________
### 16. Contact Us
If you have any questions or concerns about these Terms or our services, please contact us at:
- Email: ninjadeliveries9@gmail.com 
- Phone: +91 82191 05753
________________________________________

**Last Updated:** 08-01-2025
`;

  return (
    <View style={styles.container}>
      {/* Loader during initial check */}
      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#00C853" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : (
        // If not loading and not processing, show content
        <>
          {isProcessing ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color="#00C853" />
              <Text style={styles.loadingText}>Processing...</Text>
            </View>
          ) : (
            <>
              <ScrollView style={styles.content}>
                <Markdown>{markdownContent}</Markdown>
              </ScrollView>
              <TouchableOpacity onPress={handleAccept} style={styles.acceptButton}>
                <Text style={styles.buttonText}>I Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDecline} style={styles.declineButton}>
                <Text style={styles.buttonText}>I Do Not Accept</Text>
              </TouchableOpacity>
            </>
          )}
        </>
      )}
    </View>
  );
};

export default TermsAndConditionsScreen;

/****************************************
 *                STYLES
 ****************************************/
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    marginBottom: 20,
  },
  acceptButton: {
    backgroundColor: '#4A90E2',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  declineButton: {
    backgroundColor: '#c62828',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#555',
  },
});
