// Plays a pre-rendered track (a WAV Blob from renderTrack) through a hidden
// <audio> element. Because this is real media-element playback of an audible file,
// iOS keeps it going when the screen is locked — unlike the live Web Audio context.
// This is the playback path pre-rendered background audio will use.

let el: HTMLAudioElement | null = null;
let url: string | null = null;

export function playRenderedBlob(blob: Blob) {
  stopRenderedBlob();
  url = URL.createObjectURL(blob);
  el = document.createElement("audio");
  el.setAttribute("playsinline", "");
  el.loop = true; // loop the rendered track
  el.src = url;
  el.style.display = "none";
  document.body.appendChild(el);
  void el.play().catch(() => { /* must be called within a user gesture */ });
}

export function stopRenderedBlob() {
  if (el) { el.pause(); el.removeAttribute("src"); el.load(); el.remove(); el = null; }
  if (url) { URL.revokeObjectURL(url); url = null; }
}

export function isRenderedPlaying(): boolean {
  return !!el && !el.paused;
}
