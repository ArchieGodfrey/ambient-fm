import * as Tone from "tone";
import { bufferToWav } from "./renderTrack";
import { runRender } from "./renderGate";

// A short, soft ambient bed rendered once and cached. Played (looped, quiet) under
// the DJ to cover the silence while the first track generates. Deliberately simple
// and self-contained — a couple of slow low chords through a lowpass — so it renders
// in ~1s and has no async buffer loads. Independent of the track engine's singletons.

const BED_SECONDS = 16;

let cached: Blob | null = null;
let inflight: Promise<Blob> | null = null;

export async function getBed(): Promise<Blob> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = runRender(async () => {
    const buf = await Tone.Offline(async () => {
      const lp = new Tone.Filter({ type: "lowpass", frequency: 700, Q: 0.5 }).toDestination();
      const delay = new Tone.FeedbackDelay({ delayTime: 0.5, feedback: 0.35, wet: 0.25 }).connect(lp);
      const pad = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 3.5, decay: 2, sustain: 0.85, release: 7 },
        volume: -20,
      }).connect(delay);
      // Two overlapping soft chords spanning the loop, so the seam is gentle.
      pad.triggerAttackRelease(["C3", "G3", "E4"], 12, 0.5);
      pad.triggerAttackRelease(["A2", "E3", "C4"], 10, 8);
      Tone.getTransport().start(0);
    }, BED_SECONDS, 2);
    const audio = buf.get();
    if (!audio) throw new Error("djBed: offline render produced no buffer");
    cached = bufferToWav(audio);
    return cached;
  });
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}
