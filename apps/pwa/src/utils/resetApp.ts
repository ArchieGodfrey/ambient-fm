// Force the app onto fresh code/assets — for when an installed PWA (esp. on
// iOS) keeps serving a stale bundle after an update. Unregisters service
// workers and clears code/asset caches, then reloads. KEEPS the model caches
// (multi-GB) and all IndexedDB data (sounds, sessions, feedback, Kokoro weights).
export async function resetApp(): Promise<void> {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !k.includes("model")).map((k) => caches.delete(k)));
    }
  } catch { /* best effort */ }
  location.reload();
}
