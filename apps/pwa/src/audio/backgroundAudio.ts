import * as Tone from "tone";

// Keep the audio session alive in the background + expose lock-screen controls.
//
// iOS suspends a page's Web Audio context on screen-lock / backgrounding unless
// the page has an actively-playing media element. We play a near-silent
// MediaStream (sourced from the same audio context) through a hidden <audio>
// element to hold the session open. The music itself is untouched — these are
// separate nodes, so there's no rerouting and no doubling of the mix. MediaSession
// gives play/pause on the lock screen (skip/artwork are deliberately deferred).
//
// NOTE: iOS background-audio behaviour is version-dependent and must be verified
// on a real device. This is the safe first layer (it can never double or break the
// foreground mix). If lock-screen persistence proves unreliable on device, the
// follow-up is routing the actual master mix through the element.

let el: HTMLAudioElement | null = null;
let osc: OscillatorNode | null = null;
let streamDest: MediaStreamAudioDestinationNode | null = null;
let started = false;

// Start the keep-alive stream. MUST be called inside a user gesture (e.g. the
// Tune-in click) so the <audio> element is allowed to play.
export function startBackgroundKeepAlive() {
  if (started) return;
  try {
    const raw = Tone.getContext().rawContext as unknown as AudioContext;
    streamDest = raw.createMediaStreamDestination();
    const gain = raw.createGain();
    gain.gain.value = 0.0001; // imperceptible, but a non-silent stream reads as "active"
    osc = raw.createOscillator();
    osc.frequency.value = 40;
    osc.connect(gain).connect(streamDest);
    osc.start();

    el = document.createElement("audio");
    el.setAttribute("playsinline", "");
    el.loop = true;
    el.srcObject = streamDest.stream;
    el.style.display = "none";
    document.body.appendChild(el);
    void el.play().catch(() => { /* no gesture yet — caller runs this within one */ });
    started = true;
  } catch {
    // Web Audio / MediaStream unavailable — degrade silently (no background support).
  }
}

export function stopBackgroundKeepAlive() {
  try { osc?.stop(); } catch { /* already stopped */ }
  osc = null;
  if (el) {
    el.pause();
    el.srcObject = null;
    el.remove();
    el = null;
  }
  streamDest = null;
  started = false;
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

// Wire the lock-screen play/pause buttons to app actions.
export function setMediaSessionHandlers(handlers: { onPlay: () => void; onPause: () => void }) {
  if (!("mediaSession" in navigator)) return;
  try {
    navigator.mediaSession.setActionHandler("play", () => handlers.onPlay());
    navigator.mediaSession.setActionHandler("pause", () => handlers.onPause());
  } catch { /* unsupported */ }
}

export function clearMediaSession() {
  if (!("mediaSession" in navigator)) return;
  try {
    navigator.mediaSession.setActionHandler("play", null);
    navigator.mediaSession.setActionHandler("pause", null);
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = "none";
  } catch { /* unsupported */ }
}
