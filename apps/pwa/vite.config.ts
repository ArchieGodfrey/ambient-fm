import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import mkcert from 'vite-plugin-mkcert'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/',
  plugins: [
    mkcert(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'manifest.webmanifest'],
      devOptions: {
        // Dev service worker relies on the HMR socket (disabled behind the
        // proxy) and crashes on it; keep the SW to production builds only.
        enabled: false,
        type: 'module',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,ico,png,txt,webmanifest}'],
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/huggingface\.co\/.*$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'model-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/raw\.githubusercontent\.com\/mlc-ai\/binary-mlc-llm-libs\/.*$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'model-lib-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/api\.open-meteo\.com\/.*$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'weather-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [new RegExp('^\/api\/')],
      },
      manifest: {
        name: 'Ambient FM',
        short_name: 'AmbientFM',
        description: 'A minimal ambient audio PWA.',
        start_url: '.',
        scope: '/',
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml'
          }
        ]
      }
    })
  ],
  server: {
    https: true,
    host: '0.0.0.0',
    port: 5173,
    // The dev server runs behind a Caddy TLS proxy (HTTP/2), which HMR
    // websockets can't traverse cleanly — the client fails to connect and the
    // dev service worker crashes on the dead socket. Disable HMR in this
    // proxied setup; a full refresh loads the latest modules. (Production
    // builds are static and unaffected.)
    hmr: false,
  },
  preview: {
    https: true,
    host: '0.0.0.0',
    port: 4173,
  }
})
