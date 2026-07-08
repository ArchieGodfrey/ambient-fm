import * as Tone from "tone";
import { setMasterSink } from "./toneEngine";

// Background / locked-screen playback + lock-screen controls.
//
// iOS suspends a bare Web Audio context on lock, but keeps an actively-playing
// <audio> element alive. So we route the ENTIRE music mix through a
// MediaStreamAudioDestinationNode played by a hidden <audio> element (and sever
// the master's direct hardware path so it doesn't double). While the radio is on
// the element is the sole audible sink; on tune-out we route the master back to
// hardware for normal (manual) playback. MediaSession gives lock-screen controls.
//
// NOTE: iOS background behaviour is version-dependent — verify on a real device
// that (a) music continues when locked, (b) there's no doubling/echo in the
// foreground, (c) playback isn't broken. The routing is guarded; on failure it
// falls back to the default output.

let el: HTMLAudioElement | null = null;
let osc: OscillatorNode | null = null;
let streamDest: MediaStreamAudioDestinationNode | null = null;
let started = false;

// iOS may pause the element (interruptions, coming back from lock). Re-assert
// playback whenever it's paused or we regain foreground.
function keepPlaying() {
  if (started && el && el.paused) void el.play().catch(() => { /* needs a gesture */ });
}
const onVisibility = () => { if (typeof document !== "undefined" && !document.hidden) keepPlaying(); };

// Route the music mix through the element. MUST be called inside a user gesture
// (the Tune-in click) so the <audio> element is allowed to play.
export function startBackgroundKeepAlive() {
  if (started) return;
  try {
    const raw = Tone.getContext().rawContext as unknown as AudioContext;
    streamDest = raw.createMediaStreamDestination();

    // A continuous, inaudible tone into the SAME stream so it's never fully
    // silent. iOS only registers/keeps a media element that's actually producing
    // audio (this is what makes the lock-screen "now playing" appear and keeps
    // playback alive when locked); the real music is routed in alongside it.
    const g = raw.createGain();
    g.gain.value = 0.0001;
    osc = raw.createOscillator();
    osc.frequency.value = 40;
    osc.connect(g).connect(streamDest);
    osc.start();

    el = document.createElement("audio");
    el.setAttribute("playsinline", "");
    el.srcObject = streamDest.stream;
    el.style.display = "none";
    el.addEventListener("pause", keepPlaying);
    document.addEventListener("visibilitychange", onVisibility);
    document.body.appendChild(el);
    void el.play().catch(() => { /* no gesture yet — caller runs this within one */ });

    setMasterSink(streamDest); // the whole mix now plays through the element
    started = true;
  } catch {
    // Web Audio / MediaStream unavailable — degrade silently (no background support).
    streamDest = null; el = null;
  }
}

export function stopBackgroundKeepAlive() {
  if (!started) return;
  started = false; // set first so keepPlaying() won't re-play during teardown
  if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibility);
  setMasterSink(null); // back to the hardware output for manual playback
  try { osc?.stop(); } catch { /* already stopped */ }
  osc = null;
  if (el) {
    el.removeEventListener("pause", keepPlaying);
    el.pause();
    el.srcObject = null;
    el.remove();
    el = null;
  }
  streamDest = null;
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

// Wire the lock-screen transport buttons to app actions.
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
