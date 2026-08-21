import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDoc, getDocFromServer, setDoc, serverTimestamp, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import firebaseConfigJson from '../../firebase-applet-config.json';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
  UPLOAD = 'upload',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: any, operationType: OperationType, path: string | null) {
  const errCode = error?.code || '';
  const errStr = error?.message || errCode || String(error);
  const isRead = operationType === OperationType.LIST || operationType === OperationType.GET;
  const isUnavailable = errCode === 'unavailable' || errCode === 'deadline-exceeded';
  
  const isQuotaExceeded = errCode === 'resource-exhausted' || 
                          errCode === 'RESOURCE_EXHAUSTED' || 
                          errStr.toLowerCase().includes('quota') || 
                          errStr.toLowerCase().includes('resource-exhausted') || 
                          errStr.toLowerCase().includes('resource_exhausted');

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('firestore-error', { 
      detail: { code: errCode, message: errStr, path, operationType } 
    }));
  }

  const errInfo: FirestoreErrorInfo = {
    error: errStr,
    authInfo: {
      userId: getAuth().currentUser?.uid,
      email: getAuth().currentUser?.email,
      emailVerified: getAuth().currentUser?.emailVerified,
      isAnonymous: getAuth().currentUser?.isAnonymous,
    },
    operationType,
    path
  };

  if (isQuotaExceeded || isUnavailable || isRead) {
    console.warn(`Firestore [${path}] operating in offline/cached fallback mode (Code: ${errCode || 'quota_limit'})`);
    return;
  }

  console.error(`Firestore Error [${path}]: `, JSON.stringify(errInfo));
  if (isQuotaExceeded) {
     console.warn("Quota Exceeded. Application operating with cached/default data.");
     return;
  }
  throw new Error(JSON.stringify(errInfo));
}

export function handleStorageError(error: any, path: string) {
  const errInfo = {
    error: error?.message || error?.code || String(error),
    authInfo: {
      userId: getAuth().currentUser?.uid,
    },
    operationType: 'UPLOAD',
    path
  };
  console.error(`Storage Error [${path}]: `, JSON.stringify(errInfo));
  throw new Error(`STORAGE_ERROR: ${errInfo.error}`);
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigJson.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigJson.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigJson.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigJson.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigJson.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || firebaseConfigJson.measurementId,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || firebaseConfigJson.firestoreDatabaseId
};

console.log('Firebase Configuration Check:', {
  projectId: firebaseConfig.projectId,
  databaseId: firebaseConfig.firestoreDatabaseId,
  hasApiKey: !!firebaseConfig.apiKey
});

const app = initializeApp(firebaseConfig);

// Using initializeFirestore with persistent local cache to drastically reduce read quota
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
}, firebaseConfig.firestoreDatabaseId || '(default)');

export const auth = getAuth(app);
export const storage = getStorage(app);

let messagingInstance: any = null;

const initializeMessaging = async () => {
  if (typeof window === 'undefined') return null;
  try {
    const supported = await isSupported();
    if (supported) {
      messagingInstance = getMessaging(app);
      onMessage(messagingInstance, async (payload) => {
        const title = payload.notification?.title || payload.data?.title || 'قناة الاتحاد السكندري';
        const body = payload.notification?.body || payload.data?.body || '';
        const data = payload.data || {};
        
        const isMatch = (data?.type === 'match') || 
                        (data?.category === 'match') || 
                        (String(data?.isMatch) === 'true') ||
                        (typeof data?.url === 'string' && data.url.includes('/live')) ||
                        /⚽|🟢|🟨|🟥|🏁|هدف|بداية المباراة|بطاقة|طرد|نهاية المباراة|مباشر|مباراة|شوط/i.test(`${title} ${body}`);
        const targetUrl = (typeof data?.url === 'string' && data.url) ? data.url : (isMatch ? '/live' : '/');

        // Always display Native Web Push Notification in OS / mobile notification shade
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          try {
            if ('serviceWorker' in navigator) {
              const reg = await navigator.serviceWorker.ready || await navigator.serviceWorker.getRegistration('/');
              if (reg) {
                await reg.showNotification(title, {
                  body,
                  icon: '/icon.png',
                  badge: '/icon.png',
                  tag: data?.tag || (isMatch ? 'match-alert' : 'ittihad-notification'),
                  renotify: true,
                  data: {
                    ...data,
                    url: targetUrl,
                    isMatch
                  }
                } as NotificationOptions & { vibrate?: number[] });
                return;
              }
            }
          } catch (notifErr) {
            console.warn('Native notification display error:', notifErr);
          }
        }
      });
      return messagingInstance;
    }
  } catch (e) {
    console.warn("Firebase Messaging initialization failed (expected in some environments):", e);
  }
  return null;
};

initializeMessaging();

async function testConnection() {
  try {
    await getDoc(doc(db, 'settings', 'app_settings'));
    console.info('Firestore connection established successfully.');
  } catch (error: any) {
    console.debug('Firestore running in offline/cached mode:', error?.message || error?.code || error);
  }
}
testConnection();

export const messaging = messagingInstance;

export const requestNotificationPermission = async (): Promise<string | null> => {
  const isPWA = typeof window !== 'undefined' && (
    window.matchMedia('(display-mode: standalone)').matches || 
    (window.navigator as any).standalone === true
  );

  console.log(`[FCM] 📱 Requesting permission. Environment: isPWA=${isPWA}, Notification=${typeof window !== 'undefined' && 'Notification' in window}, PushManager=${typeof window !== 'undefined' && 'PushManager' in window}`);

  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.warn('[FCM] ⚠️ Notifications API is not supported in this browser environment.');
    return null;
  }
  
  try {
    // 1. Request permission linked directly to user action
    const permission = await Notification.requestPermission();
    console.log('[FCM] 🔔 Notification.requestPermission() result:', permission);

    if (permission !== 'granted') {
      console.warn('[FCM] 🚫 Notification permission was not granted:', permission);
      return null;
    }
    
    // 2. Ensure Service Worker is registered with scope '/' and fully active
    let registration: ServiceWorkerRegistration | undefined;
    if ('serviceWorker' in navigator) {
      try {
        registration = await navigator.serviceWorker.getRegistration('/') || 
                       await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
        if (!registration) {
          console.log('[FCM] ⚙️ Registering service worker /firebase-messaging-sw.js with scope / ...');
          registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
        }
        
        // Await active state to ensure iOS Safari WebKit does not abort getToken
        registration = await navigator.serviceWorker.ready;
        console.log('[FCM] ⚙️ Service Worker ready with scope:', registration.scope);
      } catch (swErr) {
        console.error('[FCM] ❌ Service Worker registration error:', swErr);
      }
    }

    // 3. Initialize Firebase Messaging
    const activeMessaging = messagingInstance || await initializeMessaging();
    if (!activeMessaging) {
      console.error('[FCM] ❌ Firebase Messaging could not be initialized (isSupported check failed or not available).');
      return null;
    }

    // 4. Request FCM Token with the official VAPID Key
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || 'BLpfNtPFcOkDCoXJ0F_vmM3RmtPtWy24cGby0tw-XL2EeZz3xxa_2DXYjS8uw_dRSsZIrcq-05Rv68nTJbJgrzg';
    console.log('[FCM] 🔑 Requesting getToken() with VAPID Key:', `${vapidKey.slice(0, 8)}...${vapidKey.slice(-8)}`);

    const currentToken = await getToken(activeMessaging, { 
      vapidKey,
      serviceWorkerRegistration: registration 
    });
    
    if (currentToken) {
      console.log('[FCM] ✅ FCM Token generated successfully:', currentToken);
      const user = getAuth().currentUser;
      
      // Save FCM Token with complete metadata in Firestore
      try {
        await setDoc(doc(db, 'fcm_tokens', currentToken), {
          token: currentToken,
          userId: user ? user.uid : 'anonymous',
          userEmail: user?.email || null,
          matchAlerts: true,
          status: 'active',
          platform: navigator.platform || 'unknown',
          userAgent: navigator.userAgent || 'unknown',
          isPWA: isPWA,
          lastSeen: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });

        console.log('[FCM] 💾 Token successfully saved to Firestore (fcm_tokens).');

        // If user is logged in, link token directly to their user profile
        if (user?.uid) {
          await setDoc(doc(db, 'users', user.uid), {
            fcmToken: currentToken,
            lastActive: new Date().toISOString()
          }, { merge: true });
        }
      } catch (dbErr) {
        console.warn('[FCM] ⚠️ Failed to save FCM token to Firestore:', dbErr);
      }

      return currentToken;
    } else {
      console.warn('[FCM] ⚠️ No FCM registration token available. Request permission to generate one.');
    }
  } catch (err: any) {
    console.error('[FCM] ❌ Firebase FCM Permission / getToken error:', err?.message || err?.code || err);
  }
  return null;
};

export const uploadImage = async (file: File, folder: string): Promise<string> => {
  const path = `${folder}/${Date.now()}_${file.name}`;
  try {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  } catch (error) {
    handleStorageError(error, path);
    return '';
  }
};

/**
 * Removes any undefined properties recursively to prevent Firestore SDK errors
 */
export function cleanFirestoreData<T = any>(obj: T): T {
  if (obj === null || obj === undefined) return null as any;
  if (typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj.toISOString() as any;
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => cleanFirestoreData(item)) as any;
  }
  const result: any = {};
  for (const [key, value] of Object.entries(obj as Record<string, any>)) {
    if (value !== undefined) {
      result[key] = cleanFirestoreData(value);
    }
  }
  return result;
}
