import OneSignal from 'react-onesignal';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';

// Fallback App ID or from environment variable
export const ONESIGNAL_APP_ID = 
  import.meta.env.VITE_ONESIGNAL_APP_ID || 
  'YOUR_ONESIGNAL_APP_ID';

let isOneSignalInitialized = false;
let initializationPromise: Promise<boolean> | null = null;

/**
 * Clean up legacy Firebase Cloud Messaging Service Workers to prevent any push event conflicts.
 */
async function cleanLegacyServiceWorkers() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const reg of registrations) {
      if (reg.active?.scriptURL.includes('firebase-messaging-sw.js')) {
        console.log('[OneSignal] 🧹 Cleaning up legacy Firebase FCM service worker:', reg.active.scriptURL);
        await reg.unregister();
      }
    }
  } catch (err) {
    console.warn('[OneSignal] Non-fatal error cleaning legacy service workers:', err);
  }
}

/**
 * Initialize OneSignal Web SDK v16
 */
export async function initOneSignal(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (isOneSignalInitialized) return true;
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    try {
      // 1. Clean legacy FCM workers to guarantee zero conflict
      await cleanLegacyServiceWorkers();

      // 2. Validate App ID
      const appId = ONESIGNAL_APP_ID;
      if (!appId || appId === 'YOUR_ONESIGNAL_APP_ID') {
        console.warn('[OneSignal] ⚠️ VITE_ONESIGNAL_APP_ID is not configured yet. Set VITE_ONESIGNAL_APP_ID in your environment variables.');
      }

      console.log('[OneSignal] 🚀 Initializing OneSignal Web SDK...');

      await OneSignal.init({
        appId: appId || 'd16c5bf7-0e69-4e78-9e5b-b9d9dfce76f9', // Default placeholder if not set
        allowLocalhostAsSecureOrigin: true,
        notifyButton: {
          enable: false,
        } as any,
        serviceWorkerParam: { scope: '/' },
        serviceWorkerPath: 'OneSignalSDKWorker.js',
      });

      isOneSignalInitialized = true;
      console.log('[OneSignal] ✅ OneSignal Web SDK initialized successfully.');

      // 3. Listen for notification click events to route to /live for match alerts
      try {
        OneSignal.Notifications.addEventListener('click', (event: any) => {
          console.log('[OneSignal] 🔔 Notification clicked:', event);
          const additionalData = event?.notification?.additionalData || {};
          const isMatch = additionalData.isMatch || 
            additionalData.type === 'match' || 
            (additionalData.url && additionalData.url.includes('/live')) ||
            /⚽|🟢|🟨|🟥|🔄|🏁|هدف|مباراة|طرد/i.test(`${event?.notification?.title || ''} ${event?.notification?.body || ''}`);

          const targetUrl = additionalData.url || (isMatch ? '/live' : '/');

          if (typeof window !== 'undefined' && targetUrl) {
            if (window.location.pathname !== targetUrl) {
              window.location.href = targetUrl;
            }
          }
        });
      } catch (clickErr) {
        console.warn('[OneSignal] Click listener registration warning:', clickErr);
      }

      // 4. If user is already subscribed, save subscription to Firestore
      saveCurrentSubscriptionToFirestore().catch(() => {});

      return true;
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (errMsg.includes('Can only be used on')) {
        console.warn(`[OneSignal] ℹ️ Domain mismatch note: This OneSignal App ID is configured for production (${errMsg.replace('Can only be used on: ', '')}). Push notifications will activate on that domain, or you can add this preview domain in your OneSignal Dashboard Settings.`);
      } else {
        console.warn('[OneSignal] ⚠️ OneSignal initialization note:', errMsg);
      }
      return false;
    }
  })();

  return initializationPromise;
}

/**
 * Save current OneSignal subscription ID and device details to Firestore
 */
export async function saveCurrentSubscriptionToFirestore(subscriptionId?: string): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const id = subscriptionId || OneSignal.User?.PushSubscription?.id;
    const token = OneSignal.User?.PushSubscription?.token;

    if (!id && !token) return;

    const subKey = id || token || 'sub_' + Date.now();
    const isPWA = window.matchMedia('(display-mode: standalone)').matches || 
                  (window.navigator as any).standalone === true;

    const subscriptionData = {
      subscriptionId: id || null,
      token: token || null,
      provider: 'onesignal',
      status: 'active',
      platform: navigator.platform || 'unknown',
      userAgent: navigator.userAgent || 'unknown',
      isPWA: isPWA,
      updatedAt: serverTimestamp(),
      lastSeen: serverTimestamp()
    };

    // Save in Firestore collection `onesignal_subscriptions`
    await setDoc(doc(db, 'onesignal_subscriptions', subKey), subscriptionData, { merge: true });

    // Also link to currentUser profile if signed in
    const currentUser = auth.currentUser;
    if (currentUser?.uid) {
      await setDoc(doc(db, 'users', currentUser.uid), {
        onesignalSubscriptionId: id || null,
        notificationsEnabled: true,
        updatedAt: serverTimestamp()
      }, { merge: true });
    }

    console.log('[OneSignal] 💾 Subscription successfully saved to Firestore:', subKey);
  } catch (err) {
    console.warn('[OneSignal] Non-fatal error saving subscription to Firestore:', err);
  }
}

/**
 * Request Notification Permission using OneSignal
 * Used directly by the existing notification bell buttons in TopHeader and Profile
 */
export const requestNotificationPermission = async (): Promise<string | null> => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.warn('[OneSignal] ⚠️ Notifications API is not supported in this browser.');
    return null;
  }

  try {
    // 1. Initialize OneSignal first
    await initOneSignal();

    console.log('[OneSignal] 📱 Requesting push notification permission...');

    // 2. Request permission via OneSignal
    await OneSignal.Notifications.requestPermission();

    const isGranted = Notification.permission === 'granted';
    console.log('[OneSignal] 🔔 Permission status:', Notification.permission);

    if (!isGranted) {
      console.warn('[OneSignal] 🚫 Notification permission was not granted:', Notification.permission);
      return null;
    }

    // 3. Opt-in to Push notifications
    try {
      await OneSignal.User.PushSubscription.optIn();
    } catch (optErr) {
      console.warn('[OneSignal] Opt-in note:', optErr);
    }

    // 4. Retrieve Subscription ID
    const subscriptionId = OneSignal.User?.PushSubscription?.id || OneSignal.User?.PushSubscription?.token;
    console.log('[OneSignal] ✅ Subscription generated successfully:', subscriptionId);

    // 5. Save to Firestore
    if (subscriptionId) {
      await saveCurrentSubscriptionToFirestore(subscriptionId);
    }

    return subscriptionId || 'granted';
  } catch (err: any) {
    console.error('[OneSignal] ❌ Permission request error:', err?.message || err);
    return null;
  }
};

/**
 * Helper to check if notifications are enabled
 */
export function isNotificationPermissionGranted(): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  return Notification.permission === 'granted';
}
