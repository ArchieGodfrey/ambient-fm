/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { precache, matchPrecache } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope;

// Take control immediately on update — don't wait for old tabs to close
self.addEventListener('install', () => self.skipWaiting());
clientsClaim();

// Populate the precache (no fetch handlers registered — we do it ourselves below)
precache(self.__WB_MANIFEST as any);

// Single fetch handler: precache-first + COEP/COOP header injection for ALL responses.
// This is why we use injectManifest instead of generateSW — we need to stamp headers
// on every response so iOS Safari PWA sees them and enables SharedArrayBuffer.
self.addEventListener('fetch', (event: FetchEvent) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    (async () => {
      try {
        // Try our precached assets first (HTML, JS, CSS, WASM, etc.)
        const precached = await matchPrecache(event.request);
        const response = precached ?? await fetch(event.request);

        // Stamp cross-origin isolation headers on every response
        const headers = new Headers(response.headers);
        headers.set('Cross-Origin-Opener-Policy', 'same-origin');
        headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
        headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      } catch {
        // Offline navigation fallback
        if (event.request.mode === 'navigate') {
          const fallback = await matchPrecache('./index.html');
          if (fallback) return fallback;
        }
        return new Response('', { status: 503 });
      }
    })()
  );
});
