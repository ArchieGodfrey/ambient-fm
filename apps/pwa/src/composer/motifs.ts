import { field } from "../music/random/randomField";

export interface ComposerMotif {
  id: string;
  notes: string[];
  rhythm: number[];
  instrument: string;
}

export function generateMotifNotes(chord: { notes: string[] }, seed: number, tick: number) {
  const rng = field(seed, tick, "composerMotif");
  const notes = chord.notes.length > 0 ? chord.notes : ["C"];
  return Array.from({ length: 4 }, () => {
    const note = notes[Math.floor(rng() * notes.length)];
    return `${note}4`;
  });
}

export function createMotif(chord: { notes: string[] }, instrument: string, seed: number, tick: number) {
  return {
    id: `motif_${crypto.randomUUID().slice(0, 8)}`,
    notes: generateMotifNotes(chord, seed, tick),
    rhythm: [1, 1, 0.5, 1],
    instrument,
  } as ComposerMotif;
}
