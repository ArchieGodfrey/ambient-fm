import type { CompositionPlan } from "../ai/types";
import type { Motif } from "../ai/types";
import { createMotifPlayer } from "./motifEngine";

let players: Array<ReturnType<typeof createMotifPlayer>> = [];

function clamp(value: number, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max);
}

function noteNameToMidi(noteName: string) {
  const match = noteName.match(/^([A-Ga-g])(#|b)?(\d+)$/);
  if (!match) return null;

  const note = match[1].toUpperCase();
  const accidental = match[2] || "";
  const octave = Number(match[3]);
  const base = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"].indexOf(`${note}${accidental}`);
  if (base === -1 || Number.isNaN(octave)) return null;

  return base + (octave + 1) * 12;
}

function midiToNoteName(midi: number) {
  const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const octave = Math.floor(midi / 12) - 1;
  const note = notes[midi % 12];
  return `${note}${octave}`;
}

function randomNearbyNote(notes: string[]) {
  const seed = notes[notes.length - 1] || notes[0] || "C4";
  const midi = noteNameToMidi(seed);
  if (midi === null) {
    const fallbackNotes = ["C4", "D4", "E4", "G4", "A4"];
    return fallbackNotes[Math.floor(Math.random() * fallbackNotes.length)];
  }

  const offset = Math.floor(Math.random() * 5) - 2;
  const nextMidi = clamp(midi + offset, 36, 84);
  return midiToNoteName(Math.round(nextMidi));
}

export function clearMotifs() {
  players.forEach((player) => {
    if (typeof player.stop === "function") {
      player.stop();
    }
  });
  players = [];
}

export function initMotifs(motifs: Motif[]) {
  clearMotifs();
  players = motifs.map(createMotifPlayer);
  players.forEach((player) => player.start());
}

export function updateMotifs(layers: CompositionPlan["layers"]) {
  const intensity = clamp(layers?.pad ?? 0.5, 0, 1);
  players.forEach((player) => {
    if (typeof player.setIntensity === "function") {
      player.setIntensity(intensity);
    }
  });
}

export function evolveMotifs(motifs: Motif[]) {
  motifs.forEach((motif) => {
    if (Math.random() < 0.01 && motif.notes.length > 0) {
      motif.notes.push(randomNearbyNote(motif.notes));
      motif.notes.shift();
    }
  });
}
