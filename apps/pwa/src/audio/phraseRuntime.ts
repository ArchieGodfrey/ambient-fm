import { resolvePhrase } from "./phraseEngine";
import { createMotifPlayer } from "./motifEngine";
import type { Motif, Phrase } from "../ai/types";

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

function mutateMotif(motif: Motif, variation: number): Motif {
  const noteCount = motif.notes.length;
  const rhythm = motif.rhythm.map((duration) => Math.max(0.25, duration * (1 + (Math.random() - 0.5) * variation * 0.4)));
  const notes = [...motif.notes];

  if (variation > 0 && noteCount > 1 && Math.random() < variation * 0.5) {
    const shift = Math.floor(Math.random() * noteCount);
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

export function activatePhrase(phrase: Phrase, motifs: Motif[], intensity = 0.5) {
  const resolved = resolvePhrase(phrase, motifs).map((motif) => mutateMotif({ ...motif }, phrase.variation));

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
