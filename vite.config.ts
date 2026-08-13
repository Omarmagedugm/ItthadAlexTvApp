import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        injectRegister: 'auto',
        workbox: {
          cleanupOutdatedCaches: true,
          skipWaiting: true,
          clientsClaim: true,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff2,webmanifest}'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // Increase to 5MB
          navigateFallback: 'index.html',
          // Optimize for Vercel
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /\.(?:png|jpg|jpeg|svg|gif|ico)$/,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'images',
                expiration: {
                  maxEntries: 50,
                },
              },
            },
          ],
        },
        manifest: {
          name: 'قناة الاتحاد',
          short_name: 'قناة الاتحاد',
          description: 'تطبيق قناة الاتحاد الرسمي',
          theme_color: '#072418',
          background_color: '#072418',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/icon.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: '/icon.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: '/icon.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
      }),
    ],
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      emptyOutDir: true,
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('firebase')) {
                return 'vendor-firebase';
              }
              if (id.includes('framer-motion') || id.includes('motion')) {
                return 'vendor-motion';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
              if (id.includes('recharts') || id.includes('d3')) {
                return 'vendor-charts';
              }
              return 'vendor-core';
            }
          },
        },
      },
    },
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY || env.GEMINI_API_KEY || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
