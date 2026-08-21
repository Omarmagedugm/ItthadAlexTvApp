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
    '4. OneSignal User ID': userId || '(pending/none)',
    '5. OneSignal Push Subscription ID': pushId || pushToken || '(pending/none)',
    '6. subscription optedIn': optedIn,
    '7. Service Worker registration': swList,
    '8. userAgent': navigator.userAgent
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

      // 2. Validate App ID
      const appId = ONESIGNAL_APP_ID;
      if (!appId || appId === 'YOUR_ONESIGNAL_APP_ID') {
        console.warn('[OneSignal] ⚠️ VITE_ONESIGNAL_APP_ID is not configured yet. Set VITE_ONESIGNAL_APP_ID in your environment variables.');
      }

      console.log('[OneSignal] 🚀 Initializing OneSignal Web SDK...');

      await OneSignal.init({
        appId: appId || 'd16c5bf7-0e69-4e78-9e5b-b9d9dfce76f9',
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

      // Log full status after initialization
      await logOneSignalDiagnosticStatus('Post Initialization');

      // 4. If user is already subscribed, save subscription to Firestore
      saveCurrentSubscriptionToFirestore().catch(() => {});

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
 * Request Notification Permission using OneSignal and native browser fallback
 * Handles Desktop, Android, and iOS Safari PWA
 */
export const requestNotificationPermission = async (): Promise<string | null> => {
  if (typeof window === 'undefined') return null;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const isStandalone = checkIsStandalone();

  await logOneSignalDiagnosticStatus('Permission Request Started');

  if (isIOS && !isStandalone) {
    toast('يرجى تثبيت التطبيق أولاً (إضافة إلى الشاشة الرئيسية) لتفعيل الإشعارات على هواتف آيفون 📲', { duration: 6000 });
  }

  if (!('Notification' in window)) {
    toast.error('المتصفح الحالي لا يدعم إشعارات الويب');
    return null;
  }

  // If already granted in browser, ensure OneSignal is opted-in and registered
  if (Notification.permission === 'granted') {
    try {
      await initOneSignal();
      if (typeof OneSignal !== 'undefined' && OneSignal.User?.PushSubscription) {
        await OneSignal.User.PushSubscription.optIn();
      }
      
      let id = OneSignal.User?.PushSubscription?.id || OneSignal.User?.PushSubscription?.token;
      if (!id) {
        // Give APNs/OneSignal up to 2 seconds if generating token in background
        for (let i = 0; i < 4; i++) {
          await new Promise(r => setTimeout(r, 500));
          id = OneSignal.User?.PushSubscription?.id || OneSignal.User?.PushSubscription?.token;
          if (id) break;
        }
      }

      await logOneSignalDiagnosticStatus('Already Granted Flow');
      if (id) await saveCurrentSubscriptionToFirestore(id);
    } catch (e) {
      console.warn('[OneSignal Diagnostic] Error opting-in existing granted permission:', e);
    }
    return 'granted';
  }

  if (Notification.permission === 'denied') {
    toast.error('تم حظر الإشعارات في المتصفح. اضغط على أيقونة القفل 🔒 بجانب الرابط وفعل الإشعارات.', { duration: 6000 });
    return null;
  }

  try {
    // 1. Ensure OneSignal is initialized
    await initOneSignal();

    console.log('[OneSignal Diagnostic] 📱 Prompting permission...');

    // 2. Request permission via OneSignal
    try {
      if (typeof OneSignal !== 'undefined' && OneSignal.Notifications?.requestPermission) {
        await OneSignal.Notifications.requestPermission();
      }
    } catch (sdkErr) {
      console.warn('[OneSignal Diagnostic] SDK requestPermission notice:', sdkErr);
    }

    // 3. Native prompt fallback if state is still default
    if ((Notification.permission as string) === 'default') {
      try {
        await Notification.requestPermission();
      } catch (natErr) {
        console.warn('[OneSignal Diagnostic] Native requestPermission exception:', natErr);
      }
    }

    const currentPermissionStatus = (Notification.permission as string);
    console.log('[OneSignal Diagnostic] 🔔 Permission status after prompt:', currentPermissionStatus);

    if (currentPermissionStatus === 'granted') {
      // 4. Opt-in to Push notifications
      try {
        if (typeof OneSignal !== 'undefined' && OneSignal.User?.PushSubscription) {
          await OneSignal.User.PushSubscription.optIn();
        }
      } catch (optErr) {
        console.warn('[OneSignal Diagnostic] Opt-in exception:', optErr);
      }

      // 5. Poll up to 3 seconds for Apple APNs / FCM token generation
      let subscriptionId = OneSignal.User?.PushSubscription?.id || OneSignal.User?.PushSubscription?.token;
      if (!subscriptionId) {
        for (let i = 0; i < 6; i++) {
          await new Promise(r => setTimeout(r, 500));
          subscriptionId = OneSignal.User?.PushSubscription?.id || OneSignal.User?.PushSubscription?.token;
          if (subscriptionId) break;
        }
      }

      await logOneSignalDiagnosticStatus('Permission Granted Flow Complete');

      if (subscriptionId) {
        await saveCurrentSubscriptionToFirestore(subscriptionId);
      }

      return subscriptionId || 'granted';
    } else if (currentPermissionStatus === 'denied') {
      toast.error('تم رفض إذن الإشعارات.');
      await logOneSignalDiagnosticStatus('Permission Denied');
      return null;
    }

    return null;
  } catch (err: any) {
    console.error('[OneSignal Diagnostic] ❌ Permission request error:', err?.message || err);
    await logOneSignalDiagnosticStatus('Permission Request Threw Error');
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
