import OneSignal from 'react-onesignal';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';
import toast from 'react-hot-toast';

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
 * Used directly by the notification bell button
 */
export const requestNotificationPermission = async (): Promise<string | null> => {
  if (typeof window === 'undefined') return null;

  // iOS Safari check: Web Push on iOS requires adding to Home Screen (PWA)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
  
  if (isIOS && !isStandalone) {
    toast('يرجى تثبيت التطبيق أولاً (إضافة إلى الشاشة الرئيسية) لتفعيل الإشعارات على أجهزة آيفون 📲', { duration: 5000 });
  }

  if (!('Notification' in window)) {
    toast.error('المتصفح الحالي لا يدعم إشعارات الويب');
    return null;
  }

  // If already granted
  if (Notification.permission === 'granted') {
    try {
      await initOneSignal();
      if (typeof OneSignal !== 'undefined' && OneSignal.User?.PushSubscription) {
        await OneSignal.User.PushSubscription.optIn();
        const id = OneSignal.User.PushSubscription.id;
        if (id) await saveCurrentSubscriptionToFirestore(id);
      }
    } catch (e) {}
    return 'granted';
  }

  // If explicitly denied by user in browser
  if (Notification.permission === 'denied') {
    toast.error('تم حظر الإشعارات في المتصفح. اضغط على أيقونة القفل 🔒 بجانب الرابط وفعل الإشعارات.', { duration: 6000 });
    return null;
  }

  try {
    // 1. Try OneSignal initialization
    await initOneSignal();

    console.log('[OneSignal] 📱 Requesting push notification permission...');

    // 2. Request permission via OneSignal Web SDK
    try {
      if (typeof OneSignal !== 'undefined' && OneSignal.Notifications?.requestPermission) {
        await OneSignal.Notifications.requestPermission();
      }
    } catch (sdkErr) {
      console.warn('[OneSignal] SDK permission request note:', sdkErr);
    }

    // 3. Fallback to native browser permission request if still default
    if ((Notification.permission as string) === 'default') {
      try {
        await Notification.requestPermission();
      } catch (natErr) {
        console.warn('Native requestPermission error:', natErr);
      }
    }

    const currentPermissionStatus = Notification.permission as string;
    const isGranted = currentPermissionStatus === 'granted';
    console.log('[OneSignal] 🔔 Permission status after request:', currentPermissionStatus);

    if (isGranted) {
      // 4. Opt-in to Push notifications
      try {
        if (typeof OneSignal !== 'undefined' && OneSignal.User?.PushSubscription) {
          await OneSignal.User.PushSubscription.optIn();
        }
      } catch (optErr) {
        console.warn('[OneSignal] Opt-in note:', optErr);
      }

      // 5. Retrieve Subscription ID
      const subscriptionId = (typeof OneSignal !== 'undefined' && OneSignal.User?.PushSubscription?.id) || 
                             (typeof OneSignal !== 'undefined' && OneSignal.User?.PushSubscription?.token);
      
      console.log('[OneSignal] ✅ Subscription ID:', subscriptionId);

      // 6. Save to Firestore
      if (subscriptionId) {
        await saveCurrentSubscriptionToFirestore(subscriptionId);
      }

      return subscriptionId || 'granted';
    } else if (currentPermissionStatus === 'denied') {
      toast.error('تم رفض إذن الإشعارات. يمكنك السماح بها من إعدادات المتصفح.');
      return null;
    }

    return null;
  } catch (err: any) {
    console.error('[OneSignal] ❌ Permission request error:', err?.message || err);
    
    // Emergency native request
    if ((Notification.permission as string) === 'default') {
      try {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') return 'granted';
      } catch (e) {}
    }
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
