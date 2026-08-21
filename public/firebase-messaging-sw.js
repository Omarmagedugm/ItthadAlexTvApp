// Firebase Cloud Messaging Service Worker for Ittihad Club PWA
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Ensure immediate activation
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

firebase.initializeApp({
  apiKey: "AIzaSyAjn3P2UUYwSiPtCP-UQUQ-rm5c9y4ymFU",
  authDomain: "gen-lang-client-0026252792.firebaseapp.com",
  projectId: "gen-lang-client-0026252792",
  storageBucket: "gen-lang-client-0026252792.firebasestorage.app",
  messagingSenderId: "430937320759",
  appId: "1:430937320759:web:3c99a7f3cdec3db9477eb2"
});

const messaging = firebase.messaging();

// Helper to determine if notification is related to live matches
function isMatchNotification(title = '', body = '', data = {}) {
  if (data?.type === 'match' || data?.category === 'match' || String(data?.isMatch) === 'true') {
    return true;
  }
  if (data?.url && typeof data.url === 'string' && data.url.includes('/live')) {
    return true;
  }
  const text = `${title} ${body}`.toLowerCase();
  const matchKeywords = ['⚽', '🟢', '🟨', '🟥', '🏁', 'هدف', 'بداية المباراة', 'بطاقة', 'طرد', 'نهاية المباراة', 'مباشر', 'مباراة', 'شوط', 'live'];
  return matchKeywords.some(keyword => text.includes(keyword));
}

// Background FCM Message Handler - Dedicated handler for Firebase Cloud Messaging
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Background message received:', payload);
  
  const title = payload.notification?.title || payload.data?.title || 'قناة الاتحاد السكندري';
  const body = payload.notification?.body || payload.data?.body || '';
  const data = payload.data || {};

  // For match notifications, default target is /live
  const isMatch = isMatchNotification(title, body, data);
  const targetUrl = (data && data.url && typeof data.url === 'string') ? data.url : (isMatch ? '/live' : '/');

  const notificationOptions = {
    body: body,
    icon: '/icon.png',
    badge: '/icon.png',
    tag: data.tag || (isMatch ? 'match-alert' : 'ittihad-notification'),
    renotify: true,
    data: {
      ...data,
      url: targetUrl,
      isMatch: isMatch
    }
  };

  return self.registration.showNotification(title, notificationOptions);
});

// Handle Notification Click (when app is in background or closed)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const isMatch = data.isMatch || isMatchNotification(event.notification.title, event.notification.body, data);
  const targetUrl = (data && data.url && typeof data.url === 'string') ? data.url : (isMatch ? '/live' : '/');

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If a window/PWA is already open, focus it and navigate
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if ('focus' in client) {
            client.postMessage({
              type: 'NOTIFICATION_CLICK',
              url: targetUrl,
              data: data
            });

            return client.focus().then(() => {
              if (client.url && !client.url.includes(targetUrl)) {
                return client.navigate(targetUrl);
              }
            });
          }
        }

        // If app/PWA is closed, open target URL in new window/app instance
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});
