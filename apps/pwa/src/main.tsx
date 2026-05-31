import './polyfills.ts'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { createMonitor, startSampler, startCrashDetector } from './utils/monitor'

const monitor = createMonitor();
const monitorState: Record<string, string | number> = {};

startSampler((state) => {
  Object.assign(monitorState, state);
  monitor.update(monitorState);
});

startCrashDetector((state) => {
  Object.assign(monitorState, state);
  monitor.update(monitorState);
});

window.addEventListener('worker-status', (event) => {
  const detail = (event as CustomEvent<Record<string, unknown>>).detail;
  if (!detail) return;
  Object.assign(monitorState, detail as Record<string, string | number>);
  monitor.update(monitorState);
});

window.addEventListener('toggle-monitor', () => {
  monitor.toggle();
});

console.log('gpu main:', !!navigator.gpu);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
