import * as Tone from "tone";

// Background / locked-screen playback + lock-screen controls.
//
// iOS suspends the live Web Audio CONTEXT on lock (symptom: music stops when
// locked, resuming only when the audible DJ voice calls ctx.resume()). A standalone
// media element, however, keeps its media playback going in the background and
// keeps firing `timeupdate` — even when locked. So we loop a hidden near-silent
// element and, on every timeupdate tick, resume the audio context — reviving the
// music continuously while locked. (We deliberately do NOT route the element into
// the graph via createMediaElementSource — that couples the element's playback to
// the context's suspension, defeating the purpose.) Must start in the tune-in tap.

let el: HTMLAudioElement | null = null;
let url: string | null = null;
let started = false;

function ctxRaw(): AudioContext | null {
  try { return Tone.getContext().rawContext as unknown as AudioContext; } catch { return null; }
}
function resumeCtx() {
  const c = ctxRaw();
  if (c && c.state === "suspended") void c.resume?.().catch(() => { /* needs a gesture */ });
}

// A 2s mono WAV of an inaudible 40Hz tone (like the old keep-alive oscillator) —
// non-silent so iOS treats the element as genuinely playing, but far below
// hearing. Built at runtime so there's no giant base64 blob in the bundle.
function silentToneWavUrl(): string {
  const rate = 8000, seconds = 2, n = rate * seconds, bytes = n * 2;
  const buf = new ArrayBuffer(44 + bytes);
  const dv = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); dv.setUint32(4, 36 + bytes, true); str(8, "WAVE");
  str(12, "fmt "); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, rate, true); dv.setUint32(28, rate * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  str(36, "data"); dv.setUint32(40, bytes, true);
  for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, Math.round(4 * Math.sin((2 * Math.PI * 40 * i) / rate)), true);
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}

// iOS may pause the element / suspend the context (interruptions, returning from
// lock). Re-assert playback and revive the context.
function keepPlaying() {
  if (!started) return;
  if (el && el.paused) void el.play().catch(() => { /* needs a gesture */ });
  resumeCtx();
}
const onVisibility = () => { if (typeof document !== "undefined" && !document.hidden) keepPlaying(); };

// MUST be called inside a user gesture (the Tune-in tap) so iOS allows playback.
export function startBackgroundKeepAlive() {
  if (started) return;
  try {
    url = silentToneWavUrl();
    el = document.createElement("audio");
    el.setAttribute("playsinline", "");
    el.loop = true;
    el.preload = "auto";
    el.src = url;
    el.style.display = "none";
    document.body.appendChild(el);
    // The engine: every media tick (fires ~4x/sec, even when locked) revives the
    // suspended music context.
    el.addEventListener("timeupdate", resumeCtx);
    el.addEventListener("pause", keepPlaying);
    document.addEventListener("visibilitychange", onVisibility);
    void el.play().catch(() => { /* outside a gesture — will retry via keepPlaying */ });
    started = true;
  } catch {
    el = null;
    if (url) { URL.revokeObjectURL(url); url = null; }
  }
}

export function stopBackgroundKeepAlive() {
  if (!started) return;
  started = false; // set first so keepPlaying() won't re-play during teardown
  if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibility);
  if (el) {
    el.removeEventListener("timeupdate", resumeCtx);
    el.removeEventListener("pause", keepPlaying);
    el.pause();
    el.removeAttribute("src");
    el.load();
    el.remove();
    el = null;
  }
  if (url) { URL.revokeObjectURL(url); url = null; }
}

// ── MediaSession: lock-screen transport ──

export function setMediaSessionPlaying(playing: boolean) {
  if (!("mediaSession" in navigator)) return;
  try { navigator.mediaSession.playbackState = playing ? "playing" : "paused"; } catch { /* unsupported */ }
}

export function setMediaSessionTrack(title: string, artist = "Ambient FM") {
  if (!("mediaSession" in navigator) || typeof MediaMetadata === "undefined") return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({ title, artist, album: "Ambient FM" });
  } catch { /* unsupported */ }
}

export function setMediaSessionHandlers(handlers: { onPlay: () => void; onPause: () => void; onNext?: () => void; onPrev?: () => void }) {
  if (!("mediaSession" in navigator)) return;
  try {
    navigator.mediaSession.setActionHandler("play", () => handlers.onPlay());
    navigator.mediaSession.setActionHandler("pause", () => handlers.onPause());
    navigator.mediaSession.setActionHandler("nexttrack", handlers.onNext ? () => handlers.onNext!() : null);
    navigator.mediaSession.setActionHandler("previoustrack", handlers.onPrev ? () => handlers.onPrev!() : null);
  } catch { /* unsupported */ }
}

export function clearMediaSession() {
  if (!("mediaSession" in navigator)) return;
  try {
    navigator.mediaSession.setActionHandler("play", null);
    navigator.mediaSession.setActionHandler("pause", null);
    navigator.mediaSession.setActionHandler("nexttrack", null);
    navigator.mediaSession.setActionHandler("previoustrack", null);
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = "none";
  } catch { /* unsupported */ }
}
