// Plays the DJ backing bed (a looping ambient blob) through its own hidden media
// element — separate from the track element so the bed can play under the DJ and
// crossfade out as the track comes in. Same iOS gesture-unlock pattern as
// renderedPlayer: one persistent element, unlocked in the tune-in tap.

let el: HTMLAudioElement | null = null;
let url: string | null = null;
let fadeTimer: number | null = null;

const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=";

function ensureEl(): HTMLAudioElement {
  if (!el) {
    el = document.createElement("audio");
    el.setAttribute("playsinline", "");
    el.loop = true;
    el.style.display = "none";
    el.volume = 0;
    document.body.appendChild(el);
  }
  return el;
}

function ramp(target: number, ms: number, onDone?: () => void) {
  if (!el) return;
  if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; }
  const start = el.volume;
  const t0 = Date.now();
  fadeTimer = window.setInterval(() => {
    if (!el) { if (fadeTimer) clearInterval(fadeTimer); fadeTimer = null; return; }
    const k = Math.min(1, (Date.now() - t0) / ms);
    el.volume = Math.max(0, Math.min(1, start + (target - start) * k));
    if (k >= 1) { if (fadeTimer) clearInterval(fadeTimer); fadeTimer = null; onDone?.(); }
  }, 50);
}

// MUST run inside the tune-in tap so later play() is allowed by iOS.
export function unlockBedPlayer() {
  const a = ensureEl();
  try { a.src = SILENT_WAV; a.volume = 0; void a.play().catch(() => {}); } catch { /* ignore */ }
}

// Start the bed and fade it in to `volume`.
export function playBed(blob: Blob, volume = 0.4) {
  const a = ensureEl();
  if (url) { URL.revokeObjectURL(url); url = null; }
  url = URL.createObjectURL(blob);
  a.src = url;
  a.volume = 0;
  try { a.currentTime = 0; } catch { /* not seekable yet */ }
  void a.play().catch(() => {});
  ramp(volume, 700);
}

// Fade the bed out (as the track comes in) and stop it.
export function fadeOutBed(ms = 1500) {
  if (!el || el.paused) return;
  ramp(0, ms, () => { if (el) el.pause(); });
}

export function stopBed() {
  if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; }
  if (el) { el.pause(); el.removeAttribute("src"); el.load(); }
  if (url) { URL.revokeObjectURL(url); url = null; }
}
