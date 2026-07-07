import './polyfills.ts'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { installDebugCapture } from './utils/debugCapture'

installDebugCapture()

// A production build's autoUpdate service worker can linger on this origin and
// keep CONTROLLING dev loads — serving a stale precached bundle (e.g. an old db
// schema, causing "db.recordings undefined"). Unregistering alone doesn't help:
// the already-controlled page still runs the old modules. So in dev we also drop
// the stale precache (KEEPING the model caches — multi-GB, expensive to refetch)
// and, if a stale SW was controlling us, reload ONCE onto fresh network code.
if (import.meta.env.DEV) {
  const nav = navigator
  if ('serviceWorker' in nav) {
    const wasControlled = !!nav.serviceWorker.controller
    Promise.all([
      nav.serviceWorker.getRegistrations().then((rs) => Promise.all(rs.map((r) => r.unregister()))),
      'caches' in window
        ? caches.keys().then((ks) => Promise.all(ks.filter((k) => !k.includes('model')).map((k) => caches.delete(k))))
        : Promise.resolve(),
    ])
      .then(() => {
        if (wasControlled && !sessionStorage.getItem('afm-sw-reloaded')) {
          sessionStorage.setItem('afm-sw-reloaded', '1')
          location.reload()
        }
      })
      .catch(() => {})
  }
} else {
  // Production: register the SW as normal.
  const updateSW = registerSW({
    onNeedRefresh() {
      if (confirm('New version available. Reload?')) updateSW(true)
    },
    onOfflineReady() {
      console.log('App ready offline')
    },
  })
}

console.log('gpu main:', !!navigator.gpu);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
