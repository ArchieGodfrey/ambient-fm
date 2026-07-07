import './polyfills.ts'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { installDebugCapture } from './utils/debugCapture'
import { applyTheme, getTheme } from './utils/theme'

installDebugCapture()
applyTheme(getTheme()) // apply the saved theme before first paint

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

// If something throws before the app is up (e.g. a stale PWA bundle serving a
// removed function → "undefined is not a function"), show a recoverable overlay
// with the error + a Reset button — otherwise iOS users are stuck with no way to
// reach Settings. Only fires for BOOT errors; later runtime errors just log.
let booted = false;
window.addEventListener('error', (e) => {
  if (booted) return;
  booted = true;
  const root = document.getElementById('root');
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#111;color:#eee;font:14px system-ui,-apple-system;padding:28px 22px;display:flex;flex-direction:column;gap:14px;overflow:auto';
  const msg = `${e.message || 'Unknown error'}${e.filename ? `\n${e.filename}:${e.lineno}` : ''}`;
  box.innerHTML = `<div style="font-weight:700;font-size:16px">Couldn't start</div><div style="opacity:.75;white-space:pre-wrap;font-family:ui-monospace,monospace;font-size:12px">${msg.replace(/</g, '&lt;')}</div><div style="opacity:.7">This is usually an out-of-date copy. Reset to load the latest.</div>`;
  const btn = document.createElement('button');
  btn.textContent = 'Reset & reload';
  btn.style.cssText = 'align-self:flex-start;padding:11px 18px;border-radius:22px;border:1px solid #555;background:#2a2a2a;color:#fff;font-weight:600';
  btn.onclick = () => import('./utils/resetApp').then((m) => m.resetApp()).catch(() => location.reload());
  box.appendChild(btn);
  (root ?? document.body).appendChild(box);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Mark boot complete on the next frame — after this, errors are runtime (logged), not boot.
requestAnimationFrame(() => { requestAnimationFrame(() => { booted = true; }); })
