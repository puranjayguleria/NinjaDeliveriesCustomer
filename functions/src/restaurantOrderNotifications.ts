import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import * as Expo from 'expo-server-sdk';

const expo = new Expo.Expo();

/**
 * Status map — matches restaurant app tabs exactly:
 * preparing | ready | out_for_delivery | completed
 * accepted | accepted_scheduled | rejected
 */
const STATUS_MAP: Record<string, { title: string; body: (r: string, g: number) => string }> = {
  accepted: {
    title: 'Order Accepted! 👨‍🍳',
    body: (r) => `${r} has accepted your order and is preparing it.`,
  },
  preparing: {
    title: 'Preparing Your Food 🍳',
    body: (r) => `${r} is now preparing your order.`,
  },
  ready: {
    title: 'Order Ready! 📦',
    body: (r) => `Your order from ${r} is ready and waiting for a delivery partner.`,
  },
  out_for_delivery: {
    title: 'Out for Delivery! 🛵',
    body: (r, g) => `Your order (₹${g}) from ${r} is on the way!`,
  },
  completed: {
    title: 'Order Delivered! ✅',
    body: (r) => `Enjoy your meal from ${r}. Thank you for ordering!`,
  },
  accepted_scheduled: {
    title: 'Scheduled Order Accepted! 👨‍🍳',
    body: (r) => `${r} has accepted your scheduled order. It will be prepared on the scheduled date.`,
  },
  rejected: {
    title: 'Order Cancelled ❌',
    body: (r) => `Your order from ${r} has been cancelled.`,
  },
};

// ─── Helper: get & validate Expo push token ──────────────────────────────────

async function getValidToken(userId: string): Promise<string | null> {
  const userDoc = await admin.firestore().collection('users').doc(userId).get();
  if (!userDoc.exists) return null;

  const token: string | undefined = userDoc.data()?.expoPushToken;
  if (!token || !Expo.Expo.isExpoPushToken(token)) {
    console.log('Invalid or missing token for user:', userId);
    return null;
  }
  return token;
}

// ─── Helper: send notification & handle DeviceNotRegistered ─────────────────

async function sendNotification(
  message: Expo.ExpoPushMessage,
  userId: string,
): Promise<void> {
  const chunks = expo.chunkPushNotifications([message]);
  for (const chunk of chunks) {
    const receipts = await expo.sendPushNotificationsAsync(chunk);
    for (const receipt of receipts) {
      if (receipt.status === 'error') {
        console.error('Receipt error:', receipt.message);
        if (receipt.details?.error === 'DeviceNotRegistered') {
          // Token is stale — remove it so we don't keep sending to dead token
          await admin.firestore().collection('users').doc(userId).update({
            expoPushToken: admin.firestore.FieldValue.delete(),
          });
        }
      }
    }
  }
}

// ─── New Order Created ────────────────────────────────────────────────────────

export const onNewRestaurantOrder = functions.firestore
  .document('restaurant_Orders/{orderId}')
  .onCreate(async (snap, context) => {
    try {
      const order = snap.data();
      if (!order) return;

      const { userId, restaurantName, grandTotal, items } = order;
      if (!userId || !restaurantName) return;

      const token = await getValidToken(userId);
      if (!token) return;

      const itemCount: number = items?.length ?? 0;

      const message: Expo.ExpoPushMessage = {
        to: token,
        sound: 'default',
        title: 'Order Placed Successfully! 🎉',
        body: `Your order from ${restaurantName} with ${itemCount} item(s) worth ₹${grandTotal} has been placed.`,
        data: {
          orderId: context.params.orderId,
          type: 'ORDER_PLACED',
          screen: 'OrderTracking',
        },
      };

      await sendNotification(message, userId);
      console.log('✅ Order placed notification sent to:', userId);
    } catch (error) {
      console.error('❌ onNewRestaurantOrder error:', error);
    }
  });

// ─── Order Status Updated ─────────────────────────────────────────────────────

export const onRestaurantOrderStatusUpdate = functions.firestore
  .document('restaurant_Orders/{orderId}')
  .onUpdate(async (change, context) => {
    try {
      const beforeData = change.before.data();
      const afterData = change.after.data();
      if (!beforeData || !afterData) return;

      const newStatus: string = afterData.status;

      // No change — skip
      if (beforeData.status === newStatus) return;

      const { userId, restaurantName, grandTotal } = afterData;
      if (!userId || !restaurantName) return;

      const statusInfo = STATUS_MAP[newStatus];
      if (!statusInfo) {
        console.log(`No notification configured for status: "${newStatus}"`);
        return;
      }

      const token = await getValidToken(userId);
      if (!token) return;

      const message: Expo.ExpoPushMessage = {
        to: token,
        sound: 'default',
        title: statusInfo.title,
        body: statusInfo.body(restaurantName, grandTotal),
        data: {
          orderId: context.params.orderId,
          status: newStatus,
          type: 'ORDER_STATUS_UPDATE',
          screen: 'OrderTracking',
        },
      };

      await sendNotification(message, userId);
      console.log(`✅ Status "${newStatus}" notification sent to:`, userId);
    } catch (error) {
      console.error('❌ onRestaurantOrderStatusUpdate error:', error);
    }
  });
