import type { Chord, MusicalKey } from "../types";

// Full 12-tone support so any key/mode the AI returns resolves (previously only
// D/A minor were hardcoded, so e.g. "C major" threw and every real composition
// fell back).
const CHROMATIC = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// Normalise flats and odd spellings to the sharp names used in CHROMATIC.
const ENHARMONIC: Record<string, string> = {
  Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#",
  "E#": "F", "B#": "C", Cb: "B", Fb: "E",
};

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10]; // natural minor

function tonicIndex(tonic: string): number {
  const raw = (tonic ?? "C").trim();
  const norm = ENHARMONIC[raw] ?? raw;
  const idx = CHROMATIC.indexOf(norm);
  return idx >= 0 ? idx : 0; // default to C rather than throwing
}

export function getScale(tonic: string, mode: "major" | "minor" | string): string[] {
  const steps = mode === "minor" ? MINOR_STEPS : MAJOR_STEPS;
  const root = tonicIndex(tonic);
  return steps.map((s) => CHROMATIC[(root + s) % 12]);
}

export function getTriad(scale: string[], degree: number): string[] {
  return getChord(scale, degree, false);
}

// Build a diatonic chord: root/3rd/5th, optionally adding the diatonic 7th for
// richer, less "primary-colour" harmony.
export function getChord(scale: string[], degree: number, seventh = false): string[] {
  const n = scale.length;
  const d = ((degree % n) + n) % n; // wrap negatives / out-of-range degrees
  const notes = [scale[d], scale[(d + 2) % n], scale[(d + 4) % n]];
  if (seventh) notes.push(scale[(d + 6) % n]);
  return notes;
}

export function resolveProgression(key: MusicalKey, progression: number[], seventh = false): Chord[] {
  const scale = getScale(key.tonic, key.mode);
  return progression.map((degree) => ({
    degree,
    symbol: `${key.tonic}${key.mode === "minor" ? "m" : ""}${(((degree % 7) + 7) % 7) + 1}${seventh ? "7" : ""}`,
    notes: getChord(scale, degree, seventh),
  })) as Chord[];
}
