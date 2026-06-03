import type { Chord, MusicalKey } from "../types";

const CHROMATIC = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const FLAT_NAMES = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
const PREFER_FLAT = new Set(['F','Bb','Eb','Ab','Db','Gb']);
const MAJOR_STEPS = [0,2,4,5,7,9,11];
const MINOR_STEPS = [0,2,3,5,7,8,10];

export function getScale(tonic: string, mode: 'major' | 'minor'): string[] {
  const source = PREFER_FLAT.has(tonic) ? FLAT_NAMES : CHROMATIC;
  const idx = source.indexOf(tonic);
  if (idx === -1) return MINOR_STEPS.map(s => CHROMATIC[s]); // fallback C minor
  const steps = mode === 'major' ? MAJOR_STEPS : MINOR_STEPS;
  return steps.map(s => source[(idx + s) % 12]);
}

export function getTriad(scale: string[], degree: number) {
  const root = scale[degree];

  return [
    root,
    scale[(degree + 2) % 7],
    scale[(degree + 4) % 7],
  ];
}

export function resolveProgression(key: MusicalKey, progression: number[]) {
  const scale = getScale(key.tonic, key.mode);

  return progression.map((degree) => ({
    degree,
    symbol: `${key.tonic}${key.mode === "minor" ? "m" : ""}${degree + 1}`,
    notes: getTriad(scale, degree),
  })) as Chord[];
}
