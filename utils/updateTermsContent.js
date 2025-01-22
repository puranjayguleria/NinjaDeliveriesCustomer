// updateTermsContent.js

import firestore from '@react-native-firebase/firestore';

const updateTermsContent = async () => {
  const markdownContent = `
### **Terms and Conditions for Ninja Deliveries Private Limited**  **Last Updated: [04-12-2024]**

This document is an electronic record under the Information Technology Act, 2000, and does not require physical or digital signatures.

---

### **1. Introduction**

**1.1. Platform**: These Terms and Conditions (“Terms”) govern the use of the mobile application "Ninja Deliveries App" (“App”), operated by Ninja Deliveries (“Company”, “We”, “Us”, or “Our”). The App facilitates parcel pick-up and delivery services within designated areas, allowing users to request deliveries of personal parcels.

**1.2. User Agreement**: By using the App, you (“User” or “You”) agree to these Terms. If you do not agree, please discontinue use of the App.

---

### **2. Scope of Services**

**2.1. Services Offered**: The App enables Users to request parcel pick-up and delivery from one location to another within a specified service area.

**2.2. No Liability for Parcel Contents**: We do not inspect or verify parcel contents and bear no responsibility for the type, value, legality, or safety of the contents. Users agree to not ship items that are illegal, hazardous, or restricted under applicable laws.

**2.3. Prohibited Items**: Users are prohibited from shipping the following items:
- Hazardous materials, including explosives and flammable substances
- Prohibited or controlled substances
- Perishable items requiring special handling
- Valuable items such as jewelry or cash
- Any other items restricted by local or national law

**2.4. Right to Refuse**: We reserve the right to refuse delivery requests at our sole discretion if we suspect that a parcel contains prohibited items or violates these Terms.

---

<!-- Continue with the rest of your markdown content -->
`;

  try {
    await firestore().collection('customerTerms').doc('latest').set({
      content: markdownContent.trim(),
    });
    console.log('Terms and Conditions content successfully updated!');
  } catch (error) {
    console.error('Error writing Terms and Conditions content: ', error);
  }
};

updateTermsContent();
