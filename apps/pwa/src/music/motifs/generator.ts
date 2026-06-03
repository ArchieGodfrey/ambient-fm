import type { Chord } from "../types";
import { field } from "../random/randomField";

export function generateMotif(
  chord: Chord,
  density: number,
  seed: number,
  tick = 0,
): string[] {
  const rng = field(seed, tick, "motif");
  // Generate 6-10 notes using the chord notes as waypoints, moving stepwise
  const count = Math.max(6, Math.floor(density * 10));
  const notes = chord.notes.length > 0 ? chord.notes : ["C", "E", "G"];

  // Build a small melodic vocabulary: chord tones + implied neighbours
  const vocab: string[] = [];
  for (const n of notes) {
    vocab.push(n);
  }

  const octaves = [3, 4, 4, 4, 5]; // weighted towards octave 4
  const result: string[] = [];
  let lastIdx = Math.floor(rng() * vocab.length);

  for (let i = 0; i < count; i++) {
    const r = rng();
    if (r < 0.4) lastIdx = Math.max(0, lastIdx - 1);
    else if (r < 0.75) lastIdx = Math.min(vocab.length - 1, lastIdx + 1);
    else if (r < 0.88) lastIdx = Math.max(0, lastIdx - 2);
    else lastIdx = Math.min(vocab.length - 1, lastIdx + 2);

    const oct = octaves[Math.floor(rng() * octaves.length)];
    result.push(`${vocab[lastIdx]}${oct}`);
  }
  return result;
}
