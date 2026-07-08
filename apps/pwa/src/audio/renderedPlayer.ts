// Plays a pre-rendered track (a WAV Blob from renderTrack) through a hidden
// <audio> element. Because this is real media-element playback of an audible file,
// iOS keeps it going when the screen is locked — unlike the live Web Audio context.
//
// iOS only allows media-element playback that traces back to a recent user gesture.
// A track isn't rendered until ~15s after the tune-in tap (model load + compose +
// render), by which point a fresh element's play() is blocked. So we create ONE
// persistent element and unlock it inside the tune-in tap (unlockRenderedPlayer),
// then reuse that same unlocked element for every track — only swapping its src.

let el: HTMLAudioElement | null = null;
let url: string | null = null;

// A tiny (near-)silent WAV data URI, played once inside the tap to unlock the
// element for the session.
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=";

function ensureEl(): HTMLAudioElement {
  if (!el) {
    el = document.createElement("audio");
    el.setAttribute("playsinline", "");
    el.loop = true; // loop the rendered track until the radio advances
    el.style.display = "none";
    document.body.appendChild(el);
  }
  return el;
}

// MUST be called inside a user gesture (the tune-in tap): create + unlock the
// element by playing a silent clip, so later programmatic play() calls (once a
// track has rendered) are allowed by iOS.
export function unlockRenderedPlayer() {
  const a = ensureEl();
  try {
    a.src = SILENT_WAV;
    a.volume = 1;
    void a.play().catch(() => { /* best effort */ });
  } catch { /* ignore */ }
}

export function playRenderedBlob(blob: Blob) {
  const a = ensureEl();
  if (url) { URL.revokeObjectURL(url); url = null; }
  url = URL.createObjectURL(blob);
  a.volume = 1;
  a.src = url;
  try { a.currentTime = 0; } catch { /* not seekable yet */ }
  void a.play().catch(() => { /* blocked without a prior gesture unlock */ });
}

export function stopRenderedBlob() {
  // Pause and detach the source but KEEP the element mounted — it stays unlocked
  // for the session so the next track can play without another gesture.
  if (el) { el.pause(); el.removeAttribute("src"); el.load(); }
  if (url) { URL.revokeObjectURL(url); url = null; }
}

export function isRenderedPlaying(): boolean {
  return !!el && !el.paused;
}

// Lower the rendered track under the DJ voice (and restore it after). The voice
// plays on the live context, so this is the only way to duck the music now that
// it comes from a media element rather than the Tone master.
export function duckRendered(ducked: boolean) {
  if (el) el.volume = ducked ? 0.25 : 1;
}
