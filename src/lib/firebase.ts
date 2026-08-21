import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDoc, getDocFromServer, setDoc, serverTimestamp, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import firebaseConfigJson from '../../firebase-applet-config.json';
import { requestNotificationPermission as requestOneSignalPermission } from './onesignal';

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

async function testConnection() {
  try {
    await getDoc(doc(db, 'settings', 'app_settings'));
    console.info('Firestore connection established successfully.');
  } catch (error: any) {
    console.debug('Firestore running in offline/cached mode:', error?.message || error?.code || error);
  }
}
testConnection();

// Push Notifications are powered by OneSignal for 100% Web Push reliability across Chrome, Android, and iOS
export const messaging = null;

export const requestNotificationPermission = async (): Promise<string | null> => {
  const res = await requestOneSignalPermission();
  return res.subscriptionId || (res.success ? 'granted' : null);
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
