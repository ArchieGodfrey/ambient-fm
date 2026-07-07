import { field } from "../random/randomField";

export interface GeneratedMotif {
  notes: string[];
  rhythm: number[]; // per-note duration in beats (quarter = 1)
}

// Generate a real melodic motif: it walks the scale (mostly stepwise, with the
// occasional leap back to a chord tone and octave shift) rather than picking
// random chord tones at a single octave, and gives each note a varied duration.
export function generateMotif(
  scale: string[],
  chordNotes: string[],
  density: number,
  seed: number,
  tick = 0,
  energy = 0.5,
  complexity = 0.4,
): GeneratedMotif {
  const rng = field(seed, tick, "motif");
  const count = Math.min(12, Math.max(3, Math.round(3 + density * 7)));

  // A pitch ladder across octaves 3–5 so the line has vertical room to move.
  const octaves = [3, 4, 5];
  const ladder: string[] = [];
  octaves.forEach((o) => scale.forEach((pc) => ladder.push(`${pc}${o}`)));
  const pcOf = (entry: string) => entry.replace(/\d/g, "");
  const chordSet = new Set(chordNotes);
  const chordIdxs = ladder.map((e, i) => (chordSet.has(pcOf(e)) ? i : -1)).filter((i) => i >= 0);

  const nearestChordIdx = (from: number) =>
    chordIdxs.reduce((best, i) => (Math.abs(i - from) < Math.abs(best - from) ? i : best), chordIdxs[0] ?? from);

  // Start on a chord tone around the middle octave.
  let idx = nearestChordIdx(Math.floor(ladder.length / 2));
  const notes: string[] = [];
  const leapChance = 0.12 + complexity * 0.25;

  for (let i = 0; i < count; i++) {
    // Land on a chord tone at the start and roughly every 4th note.
    if (i === 0 || i % 4 === 0) idx = nearestChordIdx(idx);
    notes.push(ladder[Math.min(ladder.length - 1, Math.max(0, idx))]);

    const r = rng();
    if (r < leapChance) {
      idx = nearestChordIdx(idx + (rng() < 0.5 ? -3 : 4)); // leap toward a chord tone
    } else if (r < leapChance + 0.15) {
      idx += 0; // repeat
    } else {
      const step = rng() < 0.7 ? 1 : 2; // step, occasional skip
      idx += rng() < 0.5 ? -step : step;
    }
    idx = Math.min(ladder.length - 1, Math.max(0, idx));
  }

  // Rhythm: energy shapes note lengths and busyness; quarter = 1 beat.
  const pool = energy > 0.62 ? [0.5, 0.5, 1, 0.25, 0.5, 1] : energy < 0.35 ? [2, 1, 1, 2, 1] : [1, 0.5, 1, 1, 0.5, 2];
  const rhythm = notes.map(() => pool[Math.floor(rng() * pool.length)]);

  return { notes, rhythm };
}
