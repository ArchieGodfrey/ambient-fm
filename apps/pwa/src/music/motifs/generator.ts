import { field } from "../random/randomField";

export interface GeneratedMotif {
  notes: string[];
  rhythm: number[]; // per-note duration in beats (quarter = 1)
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

type Strategy = "sparse" | "arp" | "wave" | "call" | "stepwise";

// Rhythm: continuous variation (not 3 fixed pools). Sparse = long sustains; arp =
// even units; otherwise durations weighted by "busyness" (energy+density) with
// occasional complexity-driven syncopation.
function buildRhythm(n: number, strategy: Strategy, energy: number, density: number, complexity: number, rng: () => number): number[] {
  if (strategy === "sparse") {
    const longs = [2, 3, 4, 2, 3];
    return Array.from({ length: n }, () => longs[Math.floor(rng() * longs.length)]);
  }
  if (strategy === "arp") {
    const unit = energy > 0.6 ? 0.5 : 1;
    return Array.from({ length: n }, () => (rng() < 0.15 ? unit * 2 : unit));
  }
  const busy = clamp01(energy * 0.6 + density * 0.4);
  const durs = busy > 0.6 ? [0.25, 0.5, 0.5, 1] : busy < 0.35 ? [1, 2, 1, 1.5] : [0.5, 1, 1, 0.5, 2];
  return Array.from({ length: n }, () => {
    const d = durs[Math.floor(rng() * durs.length)];
    return rng() < complexity * 0.3 ? d * 0.5 : d; // occasional syncopation
  });
}

// Generate a melodic motif using one of several contour strategies, chosen from
// the seed (so it varies per-motif and per-track) and shaped by energy/density/
// complexity. Far more melodic variety than the old single stepwise-walk.
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
  const stratRng = field(seed, tick, "strat");
  let count = Math.min(12, Math.max(3, Math.round(3 + density * 7)));

  const octaves = [3, 4, 5];
  const ladder: string[] = [];
  octaves.forEach((o) => scale.forEach((pc) => ladder.push(`${pc}${o}`)));
  const pcOf = (entry: string) => entry.replace(/\d/g, "");
  const chordSet = new Set(chordNotes);
  const chordIdxs = ladder.map((e, i) => (chordSet.has(pcOf(e)) ? i : -1)).filter((i) => i >= 0);
  const clampIdx = (i: number) => Math.min(ladder.length - 1, Math.max(0, i));
  const nearestChordIdx = (from: number) =>
    chordIdxs.reduce((best, i) => (Math.abs(i - from) < Math.abs(best - from) ? i : best), chordIdxs[0] ?? from);
  const mid = Math.floor(ladder.length / 2);

  const s = stratRng();
  const strategy: Strategy =
    density < 0.32 || energy < 0.3 ? "sparse"
    : s < 0.26 ? "arp"
    : s < 0.48 ? "wave"
    : s < 0.66 && count >= 6 ? "call"
    : "stepwise";

  const notes: string[] = [];

  if (strategy === "sparse") {
    count = Math.min(count, 5);
    let i = nearestChordIdx(mid);
    for (let k = 0; k < count; k++) {
      notes.push(ladder[clampIdx(i)]);
      const dir = rng() < 0.5 ? -1 : 1;
      i = nearestChordIdx(i + dir * (2 + Math.floor(rng() * scale.length)));
    }
  } else if (strategy === "arp") {
    const up = rng() < 0.6;
    let ci = chordIdxs.findIndex((x) => x >= mid);
    if (ci < 0) ci = 0;
    for (let k = 0; k < count; k++) {
      const j = (((ci + (up ? k : -k)) % chordIdxs.length) + chordIdxs.length) % chordIdxs.length;
      notes.push(ladder[clampIdx(chordIdxs[j] ?? mid)]);
    }
  } else if (strategy === "wave") {
    const amp = 3 + Math.round(complexity * 4);
    const period = 3 + Math.round(rng() * 3);
    const base = nearestChordIdx(mid);
    for (let k = 0; k < count; k++) {
      const off = Math.round(Math.sin((k / period) * Math.PI * 2) * amp);
      notes.push(ladder[k % 4 === 0 ? nearestChordIdx(base + off) : clampIdx(base + off)]);
    }
  } else if (strategy === "call") {
    const cell = Math.max(2, Math.floor(count / 2));
    const first: string[] = [];
    let i = nearestChordIdx(mid);
    for (let k = 0; k < cell; k++) { first.push(ladder[clampIdx(i)]); i = clampIdx(i + (rng() < 0.5 ? -1 : 1)); }
    notes.push(...first);
    const shift = rng() < 0.5 ? -2 : 2; // the "response" answers the "call"
    for (let k = 0; k < count - cell; k++) {
      const srcIdx = ladder.indexOf(first[k % first.length]);
      notes.push(ladder[k === 0 ? nearestChordIdx(srcIdx + shift) : clampIdx(srcIdx + shift)]);
    }
  } else {
    let idx = nearestChordIdx(mid);
    const leapChance = 0.12 + complexity * 0.25;
    for (let i = 0; i < count; i++) {
      if (i === 0 || i % 4 === 0) idx = nearestChordIdx(idx);
      notes.push(ladder[clampIdx(idx)]);
      const r = rng();
      if (r < leapChance) idx = nearestChordIdx(idx + (rng() < 0.5 ? -3 : 4));
      else if (r < leapChance + 0.15) idx += 0;
      else { const step = rng() < 0.7 ? 1 : 2; idx += rng() < 0.5 ? -step : step; }
      idx = clampIdx(idx);
    }
  }

  return { notes, rhythm: buildRhythm(notes.length, strategy, energy, density, complexity, rng) };
}
