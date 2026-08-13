import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Handle service worker updates
const updateSW = registerSW({
  onNeedRefresh() {
    console.log('New app version available, updating SW...');
    updateSW(true);
  },
  onOfflineReady() {
    console.log('App is ready for offline use');
  },
});

// CRITICAL: Handle chunk loading errors which cause white screens
const handleChunkError = (event: any) => {
  const error = event?.error || event?.reason || event;
  const message = String(error?.message || error || '').toLowerCase();
  
  // Stricter check for chunk mapping errors from Vite/Rollup
  const isChunkError = 
    message.includes('importing a module script failed') ||
    message.includes('dynamically imported module') ||
    message.includes('failed to fetch dynamically imported module') ||
    (message.includes('failed to fetch') && message.includes('module')) ||
    (message.includes('loading chunk') && message.includes('failed'));

  // Check if we already reloaded recently to avoid infinite loops
  const lastReload = sessionStorage.getItem('last_chunk_error_reload');
  const now = Date.now();
  if (lastReload && now - parseInt(lastReload) < 10000) {
    console.error('Detected multiple chunk errors in short time, stopping auto-reload.');
    return;
  }

  if (isChunkError) {
    console.warn('Detected chunk loading error, forcing reload to get latest version...', message);
    sessionStorage.setItem('last_chunk_error_reload', now.toString());
    if ('caches' in window) {
      caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {});
    }
    setTimeout(() => {
      window.location.reload();
    }, 500);
  }
};

window.addEventListener('error', (event) => handleChunkError(event), true);
window.addEventListener('unhandledrejection', (event) => handleChunkError(event));

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
