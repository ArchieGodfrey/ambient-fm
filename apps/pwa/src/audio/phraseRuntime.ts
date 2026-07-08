import { resolvePhrase } from "./phraseEngine";
import { createMotifPlayer } from "./motifEngine";
import type { Motif, Phrase } from "../ai/types";
import type { RNG } from "../music/random/randomField";

let activePlayers: Array<ReturnType<typeof createMotifPlayer>> = [];
let currentPhraseId: string | null = null;

function stopActivePlayers() {
  activePlayers.forEach((player) => {
    if (typeof player.stop === "function") {
      player.stop();
    }
  });
  activePlayers = [];
}

function mutateMotif(motif: Motif, variation: number, rng: RNG): Motif {
  const noteCount = motif.notes.length;
  const rhythm = motif.rhythm.map((duration) => Math.max(0.25, duration * (1 + (rng() - 0.5) * variation * 0.4)));
  const notes = [...motif.notes];

  if (variation > 0 && noteCount > 1 && rng() < variation * 0.5) {
    const shift = Math.floor(rng() * noteCount);
    for (let i = 0; i < shift; i++) {
      notes.push(notes.shift()!);
    }
  }

  return {
    ...motif,
    notes,
    rhythm,
  };
}

export function activatePhrase(
  phrase: Phrase,
  motifs: Motif[],
  intensity = 0.5,
  density = 0.5,
  rng: RNG,
) {
  const densityFactor = Math.min(1, Math.max(0, density));
  const resolved = resolvePhrase(phrase, motifs).map((motif) => {
    const evolved = mutateMotif({ ...motif }, phrase.variation, rng);
    const tempoFactor = 1 + (densityFactor - 0.5) * 0.8;
    const notes = [...evolved.notes];

    if (densityFactor > 0.75 && notes.length > 0) {
      notes.push(notes[0]);
    }

    const rhythm = evolved.rhythm.map((duration) => Math.max(0.15, duration / tempoFactor));
    return { ...evolved, notes, rhythm };
  });

  if (phrase.id === currentPhraseId) {
    updatePhraseIntensity(intensity);
    return;
  }

  stopActivePlayers();
  currentPhraseId = phrase.id;

  for (const motif of resolved) {
    const player = createMotifPlayer(motif);
    player.start();
    player.setIntensity(intensity);
    activePlayers.push(player);
  }
}

export function updatePhraseIntensity(intensity: number) {
  activePlayers.forEach((player) => {
    if (typeof player.setIntensity === "function") {
      player.setIntensity(intensity);
    }
  });
}

export function stopPhrase() {
  stopActivePlayers();
  currentPhraseId = null;
}

// Clear the active phrase + its motif players and reset the cached phrase id, so
// the next activatePhrase() actually rebuilds players (a matching cached id would
// otherwise early-out). Defensive against players whose Tone context was disposed
// (e.g. after an offline render). Used when switching Tone contexts.
export function resetPhraseRuntime() {
  activePlayers.forEach((player) => {
    try { player.stop(); } catch { /* loop from a disposed context */ }
  });
  activePlayers = [];
  currentPhraseId = null;
}
