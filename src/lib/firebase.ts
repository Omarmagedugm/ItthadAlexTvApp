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
      onMessage(messagingInstance, (payload) => {
        const title = payload.notification?.title || 'إشعار جديد';
        const body = payload.notification?.body || '';
        const event = new CustomEvent('fcm-message', { detail: { title, body, payload } });
        window.dispatchEvent(event);
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

export const requestNotificationPermission = async () => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.warn('Notifications not supported in this browser');
    return;
  }
  
  try {
    // Request permission first to ensure it's linked to the user gesture
    // (especially important for iOS/Safari)
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
       console.log('Notification permission dynamic status:', permission);
       return;
    }
    
    // Once permission is granted, initialize messaging if not already done
    const activeMessaging = messagingInstance || await initializeMessaging();
    if (!activeMessaging) {
      console.warn('Messaging initialization failed after permission grant');
      return;
    }
    
    // Get service worker registration
    let registration;
    if ('serviceWorker' in navigator) {
      // Try to get existing registration first
      registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
      
      if (!registration) {
        console.log('Registering new firebase-messaging-sw.js...');
        registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
          scope: '/'
        });
      }
      
      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;
    }

    const currentToken = await getToken(activeMessaging, { 
      vapidKey: 'BLpfNtPFcOkDCoXJ0F_vmM3RmtPtWy24cGby0tw-XL2EeZz3xxa_2DXYjS8uw_dRSsZIrcq-05Rv68nTJbJgrzg',
      serviceWorkerRegistration: registration 
    });
    
    if (currentToken) {
      console.log('FCM Token generated:', currentToken);
      const user = getAuth().currentUser;
      
      // Save token with more metadata
      await setDoc(doc(db, 'fcm_tokens', currentToken), {
        token: currentToken,
        userId: user ? user.uid : 'anonymous',
        lastSeen: serverTimestamp(),
        platform: navigator.platform,
        userAgent: navigator.userAgent,
        isPWA: window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true,
        status: 'active'
      }, { merge: true });

      return currentToken;
    }
  } catch (err) {
    console.warn('FCM Permission/Token error:', err);
  }
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
