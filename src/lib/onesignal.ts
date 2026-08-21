import OneSignal from 'react-onesignal';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';
import toast from 'react-hot-toast';

// Official OneSignal App ID
export const ONESIGNAL_APP_ID = 
  (import.meta.env.VITE_ONESIGNAL_APP_ID && import.meta.env.VITE_ONESIGNAL_APP_ID !== 'YOUR_ONESIGNAL_APP_ID')
    ? import.meta.env.VITE_ONESIGNAL_APP_ID
    : 'd16c5bf7-0e69-4e78-9e5b-b9d9dfce76f9';

let isOneSignalInitialized = false;
let initializationPromise: Promise<boolean> | null = null;

/**
 * Diagnostic helper: checks standalone mode for PWA (Desktop, Android, iOS Safari)
 */
export function checkIsStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

/**
 * Diagnostic helper: prints full diagnostic status
 */
export async function logOneSignalDiagnosticStatus(stage: string = 'Current State'): Promise<void> {
  if (typeof window === 'undefined') return;

  const isStandalone = checkIsStandalone();
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const permission = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
  
  let swList: any[] = [];
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      swList = registrations.map(reg => ({
        scope: reg.scope,
        scriptURL: reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || 'none',
        state: reg.active?.state || 'unknown',
      }));
    } catch (e) {
      swList = ['error reading service workers: ' + String(e)];
    }
  }

  const userId = typeof OneSignal !== 'undefined' ? OneSignal.User?.onesignalId : undefined;
  const pushId = typeof OneSignal !== 'undefined' ? OneSignal.User?.PushSubscription?.id : undefined;
  const pushToken = typeof OneSignal !== 'undefined' ? OneSignal.User?.PushSubscription?.token : undefined;
  const optedIn = typeof OneSignal !== 'undefined' ? OneSignal.User?.PushSubscription?.optedIn : undefined;

  console.log(`%c[OneSignal Diagnostic - ${stage}]`, 'color: #00e676; font-weight: bold; font-size: 13px;', {
    '1. Notification.permission': permission,
    '2. standalone mode': isStandalone,
    '3. isIOS': isIOS,
    '4. OneSignal App ID': ONESIGNAL_APP_ID,
    '5. OneSignal User ID': userId || '(pending/none)',
    '6. OneSignal Push Subscription ID': pushId || pushToken || '(pending/none)',
    '7. subscription optedIn': optedIn,
    '8. Service Worker registration': swList,
    '9. current Domain / Origin': window.location.origin,
    '10. userAgent': navigator.userAgent
  });
}

/**
 * Clean up legacy Firebase Cloud Messaging Service Workers to prevent any push event conflicts.
 */
async function cleanLegacyServiceWorkers() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const reg of registrations) {
      const script = reg.active?.scriptURL || '';
      if (script.includes('firebase-messaging-sw.js')) {
        console.log('[OneSignal] 🧹 Cleaning up legacy Firebase FCM service worker:', script);
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

      const appId = ONESIGNAL_APP_ID;
      console.log('[OneSignal] 🚀 Initializing OneSignal Web SDK with App ID:', appId);

      await OneSignal.init({
        appId: appId,
        allowLocalhostAsSecureOrigin: true,
        notifyButton: {
          enable: false,
        } as any,
        serviceWorkerParam: { scope: '/' },
        serviceWorkerPath: 'OneSignalSDKWorker.js',
      });

      isOneSignalInitialized = true;
      console.log('[OneSignal] ✅ OneSignal Web SDK initialized successfully.');

      // 3. Register Event Listeners for Subscription & Permissions
      try {
        if (OneSignal.User?.PushSubscription) {
          OneSignal.User.PushSubscription.addEventListener('change', async (event: any) => {
            console.log('[OneSignal Diagnostic] 🔄 PushSubscription changed event:', {
              currentId: event?.current?.id,
              currentToken: event?.current?.token,
              optedIn: event?.current?.optedIn,
              previousId: event?.previous?.id,
            });

            const subscriptionId = event?.current?.id || event?.current?.token;
            if (subscriptionId && event?.current?.optedIn) {
              await saveCurrentSubscriptionToFirestore(subscriptionId);
            }
          });
        }
      } catch (subErr) {
        console.warn('[OneSignal] Subscription change listener notice:', subErr);
      }

      try {
        if (OneSignal.Notifications) {
          OneSignal.Notifications.addEventListener('permissionChange', (permission: boolean) => {
            console.log('[OneSignal Diagnostic] 🔔 Notifications permissionChange:', permission, 'Notification.permission:', Notification.permission);
          });

          // Route notification clicks to /live for match alerts
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
        }
      } catch (clickErr) {
        console.warn('[OneSignal] Notifications event listeners warning:', clickErr);
      }

      // If browser already granted permission, opt-in immediately to ensure subscription is generated
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          if (OneSignal.User?.PushSubscription) {
            await OneSignal.User.PushSubscription.optIn();
            const subId = OneSignal.User.PushSubscription.id || OneSignal.User.PushSubscription.token;
            if (subId) {
              await saveCurrentSubscriptionToFirestore(subId);
            }
          }
        } catch (optErr) {
          console.warn('[OneSignal] Background optIn error:', optErr);
        }
      }

      // Log full status after initialization
      await logOneSignalDiagnosticStatus('Post Initialization');

      return true;
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (errMsg.includes('Can only be used on')) {
        console.warn(`[OneSignal] ℹ️ Domain mismatch note: This OneSignal App ID is configured for production (${errMsg.replace('Can only be used on: ', '')}). Push notifications will activate on that domain, or you can add this preview domain in your OneSignal Dashboard Settings.`);
      } else {
        console.warn('[OneSignal Diagnostic] ❌ OneSignal initialization error:', errMsg);
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
    const isPWA = checkIsStandalone();

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
 * Request Notification Permission using OneSignal and native browser prompt
 */
export const requestNotificationPermission = async (): Promise<string | null> => {
  if (typeof window === 'undefined') return null;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const isStandalone = checkIsStandalone();

  if (isIOS && !isStandalone) {
    toast('يرجى تثبيت التطبيق أولاً (إضافة إلى الشاشة الرئيسية) لتفعيل الإشعارات على هواتف آيفون 📲', { duration: 6000 });
  }

  if (!('Notification' in window)) {
    toast.error('المتصفح الحالي لا يدعم إشعارات الويب');
    return null;
  }

  // Check current permission
  let currentPerm = Notification.permission as string;

  if (currentPerm === 'denied') {
    toast.error('تم حظر الإشعارات في المتصفح. اضغط على أيقونة القفل 🔒 بجانب الرابط وفعل الإشعارات.', { duration: 6000 });
    return null;
  }

  try {
    // 1. Initialize OneSignal
    await initOneSignal();

    // 2. Request permission via OneSignal's SDK
    try {
      if (typeof OneSignal !== 'undefined' && OneSignal.Notifications?.requestPermission) {
        await OneSignal.Notifications.requestPermission();
      }
    } catch (sdkErr) {
      console.warn('[OneSignal] SDK requestPermission note:', sdkErr);
    }

    // 3. Native prompt fallback if state is still default
    if ((Notification.permission as string) === 'default') {
      try {
        await Notification.requestPermission();
      } catch (natErr) {
        console.warn('[OneSignal] Native requestPermission exception:', natErr);
      }
    }

    currentPerm = Notification.permission as string;
    console.log('[OneSignal] 🔔 Current permission after request:', currentPerm);

    if (currentPerm === 'granted') {
      // Opt-in to Push subscription explicitly in OneSignal
      try {
        if (typeof OneSignal !== 'undefined' && OneSignal.User?.PushSubscription) {
          await OneSignal.User.PushSubscription.optIn();
        }
      } catch (optErr) {
        console.warn('[OneSignal] Opt-in exception:', optErr);
      }

      // Wait up to 3 seconds for Push Subscription ID generation
      let subscriptionId = OneSignal.User?.PushSubscription?.id || OneSignal.User?.PushSubscription?.token;
      if (!subscriptionId) {
        for (let i = 0; i < 6; i++) {
          await new Promise(r => setTimeout(r, 500));
          subscriptionId = OneSignal.User?.PushSubscription?.id || OneSignal.User?.PushSubscription?.token;
          if (subscriptionId) break;
        }
      }

      if (subscriptionId) {
        await saveCurrentSubscriptionToFirestore(subscriptionId);
      }

      await logOneSignalDiagnosticStatus('Permission Granted Complete');
      return subscriptionId || 'granted';
    } else if (currentPerm === 'denied') {
      toast.error('تم رفض إذن الإشعارات.');
      return null;
    }

    return null;
  } catch (err: any) {
    console.error('[OneSignal] ❌ Permission request exception:', err);
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
