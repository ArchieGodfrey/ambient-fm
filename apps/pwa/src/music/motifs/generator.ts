import type { Chord } from "../types";
import { field } from "../random/randomField";

export function generateMotif(
  chord: Chord,
  density: number,
  seed: number,
  tick = 0,
) {
  const rng = field(seed, tick, "motif");
  const count = Math.max(2, Math.floor(density * 8));
  const notes = chord.notes.length > 0 ? chord.notes : ["C"];

  return Array.from({ length: count }, () => {
    return `${notes[Math.floor(rng() * notes.length)]}4`;
  });
}
