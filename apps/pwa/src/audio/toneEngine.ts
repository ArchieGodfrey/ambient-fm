import * as Tone from "tone";
import { initAudioGraph } from "./audioGraph";

let started = false;
let playing = false;
let suspended = false;
let transportWasPlayingBeforeSuspend = false;

// Resume the AudioContext within a user gesture (e.g. the Burn button) so that
// nodes created while preparing a composition don't trip the browser autoplay
// policy ("AudioContext was not allowed to start"). Does not start playback.
export async function resumeAudioContext() {
  try {
    await Tone.start();
  } catch {
    // No gesture yet / already running — audio will start on the next play.
  }
}

// Duck the whole mix down to a quiet "bed" (dB) and back — used by the radio so
// the DJ host can talk over a low soundscape without the music cutting out.
// There's no master gain bus, so we ramp the shared destination volume.
export function duckTo(db = -16, seconds = 0.4) {
  try { Tone.getDestination().volume.rampTo(db, seconds); } catch { /* no context yet */ }
}
export function unduck(seconds = 0.8) {
  try { Tone.getDestination().volume.rampTo(0, seconds); } catch { /* no context yet */ }
}

export async function startAudio() {
  if (!started) {
    await Tone.start();
    started = true;
    initAudioGraph();
  }

  Tone.Destination.mute = false;

  if (!playing) {
    if (Tone.Transport.state !== "started") {
      Tone.Transport.start();
    }
    playing = true;
  }
}

export function stopAudio() {
  if (Tone.Transport.state === "started") {
    Tone.Transport.stop();
  }

  Tone.Destination.mute = true;
  playing = false;
  suspended = false;
  transportWasPlayingBeforeSuspend = false;
}

export async function suspendAudio() {
  if (suspended) {
    return;
  }

  transportWasPlayingBeforeSuspend = Tone.Transport.state === "started";
  if (transportWasPlayingBeforeSuspend) {
    Tone.Transport.pause();
  }

  const ctx = Tone.context as unknown as { suspend?: () => Promise<void> };
  if (ctx && typeof ctx.suspend === "function") {
    await ctx.suspend();
  }

  suspended = true;
}

export async function resumeAudio() {
  if (!suspended) {
    return;
  }

  const ctx = Tone.context as unknown as { resume?: () => Promise<void> };
  if (ctx && typeof ctx.resume === "function") {
    await ctx.resume();
  }

  if (transportWasPlayingBeforeSuspend) {
    Tone.Transport.start();
  }

  suspended = false;
  transportWasPlayingBeforeSuspend = false;
}
