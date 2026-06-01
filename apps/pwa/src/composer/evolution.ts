import type { ComposerMotif } from "./motifs";
import { field } from "../music/random/randomField";

function mutateNote(note: string) {
  const base = note.replace(/\d$/, "");
  const octave = Number(note.slice(-1)) || 4;
  const letters = ["A", "B", "C", "D", "E", "F", "G"];
  const next = letters[(letters.indexOf(base[0]) + 1) % letters.length] ?? base;
  return `${next}${octave}`;
}

export function evolveMotif(motif: ComposerMotif, seed: number, tick: number): ComposerMotif {
  const next = structuredClone(motif) as ComposerMotif;
  if (next.notes.length === 0) return next;
  const rng = field(seed, tick, "composerEvolveMotif");
  const index = Math.floor(rng() * next.notes.length);
  next.notes[index] = mutateNote(next.notes[index] ?? "C4");
  return next;
}
