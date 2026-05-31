import type { Motif, Phrase } from "../ai/types";

export function resolvePhrase(phrase: Phrase, motifs: Motif[]) {
  return phrase.motifs
    .map((id) => motifs.find((m) => m.id === id))
    .filter((motif): motif is Motif => Boolean(motif));
}
