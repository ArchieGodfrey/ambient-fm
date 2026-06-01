import type { Chord, MusicalKey } from "../types";

const MINOR_SCALES: Record<string, string[]> = {
  D: ["D", "E", "F", "G", "A", "Bb", "C"],
  A: ["A", "B", "C", "D", "E", "F", "G"],
};

export function getScale(tonic: string, mode: "major" | "minor") {
  if (mode !== "minor") {
    throw new Error("not implemented");
  }

  const scale = MINOR_SCALES[tonic];
  if (!scale) {
    throw new Error(`Unsupported tonic: ${tonic}`);
  }

  return scale;
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
