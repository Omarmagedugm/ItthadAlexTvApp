importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAjn3P2UUYwSiPtCP-UQUQ-rm5c9y4ymFU",
  authDomain: "gen-lang-client-0026252792.firebaseapp.com",
  projectId: "gen-lang-client-0026252792",
  storageBucket: "gen-lang-client-0026252792.firebasestorage.app",
  messagingSenderId: "430937320759",
  appId: "1:430937320759:web:3c99a7f3cdec3db9477eb2"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || 'إشعار جديد';
  const notificationOptions = {
    body: payload.notification?.body,
    icon: '/icon.png',
    data: payload.data, // Attach data for the click handler
    badge: '/icon.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  // Default target URL
  const targetUrl = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If a window is already open, focus it and navigate
        if (clientList.length > 0) {
          let client = clientList[0];
          for (let i = 0; i < clientList.length; i++) {
            if (clientList[i].focused) {
              client = clientList[i];
              break;
            }
          }
          return client.focus().then(() => client.navigate(targetUrl));
        }
        // Otherwise, open a new window
        return clients.openWindow(targetUrl);
      })
  );
});
