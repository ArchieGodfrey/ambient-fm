// PWA install detection, install-prompt capture, and storage persistence —
// the plumbing behind the first-run onboarding (install soft-wall + setup wizard).

export type Platform = "ios" | "android" | "desktop";

const ONBOARDED_KEY = "afm-onboarded";  // install gate dismissed (or app installed)
const SETUP_KEY = "afm-setup-done";     // first-run setup wizard completed/skipped

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const displayMode = window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return displayMode || iosStandalone;
}

export function getPlatform(): Platform {
  const ua = navigator.userAgent || "";
  // iPadOS 13+ masquerades as Macintosh but is touch-capable.
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && "ontouchend" in document)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

// ── beforeinstallprompt (Android / Chromium): capture for a manual Install button ──

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: InstallPromptEvent | null = null;
const availabilityListeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // stop Chrome's mini-infobar; we present our own UI
    deferredPrompt = e as InstallPromptEvent;
    availabilityListeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    setOnboarded(true);
    availabilityListeners.forEach((l) => l());
  });
}

export function canPromptInstall(): boolean {
  return deferredPrompt !== null;
}

export function onInstallAvailabilityChange(cb: () => void): () => void {
  availabilityListeners.add(cb);
  return () => availabilityListeners.delete(cb);
}

export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  await deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  availabilityListeners.forEach((l) => l());
  return choice.outcome === "accepted";
}

// ── First-run flags ──

export function isOnboarded(): boolean {
  try { return localStorage.getItem(ONBOARDED_KEY) === "1"; } catch { return false; }
}
export function setOnboarded(v: boolean): void {
  try { v ? localStorage.setItem(ONBOARDED_KEY, "1") : localStorage.removeItem(ONBOARDED_KEY); } catch { /* ignore */ }
}
export function isSetupDone(): boolean {
  try { return localStorage.getItem(SETUP_KEY) === "1"; } catch { return false; }
}
export function setSetupDone(v: boolean): void {
  try { v ? localStorage.setItem(SETUP_KEY, "1") : localStorage.removeItem(SETUP_KEY); } catch { /* ignore */ }
}

// ── Storage persistence: protect the multi-GB model/voice caches from eviction ──

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch { /* ignore */ }
  return false;
}

// Open the setup wizard on demand (e.g. from Settings "Run setup again").
export function openSetupWizard(): void {
  window.dispatchEvent(new CustomEvent("afm-open-setup"));
}
