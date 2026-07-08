import * as Tone from "tone";
import { SAMPLE_INSTRUMENTS } from "./palettes";

// Decoded sample buffers, cached across renders. A Tone.Sampler built from URLs
// loads asynchronously and registers with Tone.loaded() — but inside Tone.Offline
// that load never resolves, so sampled palettes rendered SILENT. Decoding the
// buffers once here (on the live context, before rendering) lets the offline
// render build the Sampler from ready AudioBuffers with no async load at all.
// (Bonus: the 5 renders in a batch no longer each re-fetch the same samples.)

const cache = new Map<string, AudioBuffer>(); // key: `${inst}/${note}`

function liveCtx(): AudioContext {
  return Tone.getContext().rawContext as unknown as AudioContext;
}

// Fetch + decode every note of an instrument (once). Safe to call repeatedly.
export async function preloadInstrument(inst: string): Promise<void> {
  const map = SAMPLE_INSTRUMENTS[inst];
  if (!map) return;
  const base = `${import.meta.env.BASE_URL}samples/${inst}/`;
  await Promise.all(
    Object.entries(map).map(async ([note, file]) => {
      const key = `${inst}/${note}`;
      if (cache.has(key)) return;
      try {
        const res = await fetch(base + file);
        cache.set(key, await liveCtx().decodeAudioData(await res.arrayBuffer()));
      } catch (e) {
        console.error(`Sample load failed: ${key}`, e);
      }
    }),
  );
}

// The decoded buffers for an instrument as a note→AudioBuffer map for Tone.Sampler,
// or null if any note is missing (caller falls back to URL loading).
export function samplerBuffers(inst: string): Record<string, AudioBuffer> | null {
  const map = SAMPLE_INSTRUMENTS[inst];
  if (!map) return null;
  const out: Record<string, AudioBuffer> = {};
  for (const note of Object.keys(map)) {
    const buf = cache.get(`${inst}/${note}`);
    if (!buf) return null;
    out[note] = buf;
  }
  return out;
}
