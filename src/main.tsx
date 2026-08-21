import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Handle service worker registration safely without auto-reloading the page
registerSW({
  onNeedRefresh() {
    console.log('[PWA] New version detected in background.');
  },
  onOfflineReady() {
    console.log('[PWA] App is ready for offline use');
  },
});

// CRITICAL: Handle chunk loading errors safely only on true missing chunks
const handleChunkError = (event: any) => {
  const error = event?.error || event?.reason || event;
  const message = String(error?.message || error || '').toLowerCase();
  
  // Stricter check for chunk mapping errors from Vite/Rollup
  const isChunkError = 
    message.includes('failed to fetch dynamically imported module') ||
    message.includes('importing a module script failed');

  if (isChunkError) {
    const lastReload = sessionStorage.getItem('last_chunk_error_reload');
    const now = Date.now();
    // Only reload once every 60 seconds at most to prevent any refresh loops
    if (!lastReload || now - parseInt(lastReload, 10) > 60000) {
      console.warn('Detected chunk loading error, refreshing cache once...', message);
      sessionStorage.setItem('last_chunk_error_reload', now.toString());
      if ('caches' in window) {
        caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {});
      }
      setTimeout(() => {
        window.location.reload();
      }, 300);
    }
  }
};

window.addEventListener('error', (event) => handleChunkError(event), true);

try {
  console.log('Application initialization started');
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch (e) {
  console.error('CRITICAL BOOT ERROR:', e);
  document.body.innerHTML = `<div style="padding: 20px; color: red;">فشل تشغيل التطبيق. يرجى إعادة المحاولة أو التواصل مع الدعم.</div>`;
}
