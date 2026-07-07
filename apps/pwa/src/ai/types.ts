import type { CompositionIntent } from "./intentSchema";

export interface CompositionSection {
  start: number;
  duration: number;
  mood: "calm" | "focused" | "tense" | "ambient" | "energised";
  intensity: number;
  phraseIds: string[];
}

export interface Motif {
  id: string;
  layer: "pad" | "pulse" | "texture";
  notes: string[];
  rhythm: number[];
}

export interface Phrase {
  id: string;
  motifs: string[];
  length: number;
  variation: number;
  role: "build" | "release" | "static" | "transition";
}

export interface EvolutionProfile {
  motifMutationChance: number;
  chordChangeChance: number;
  instrumentChangeChance: number;
  densityDrift: number;
  rhythmVariation: number;
}

export interface CompositionPlan {
  key: string;
  bpm: number;
  duration: number;
  seed: number;
  globalMood: string;
  sections: CompositionSection[];
  evolutionProfile: EvolutionProfile;
  texture: {
    density: number;
    brightness: number;
    reverbAmount: number;
  };
  layers: {
    drone: number;
    pad: number;
    texture: number;
    pulse: number;
  };
  motifs: Motif[];
  phrases: Phrase[];
  intent?: CompositionIntent;
  // Optional user-recorded melody, scheduled as a timed track over the soundscape.
  melodyNotes?: { note: string; start: number; duration: number }[];
  melodyInstrument?: string;
  // Harmonic bed voiced over the section timeline (seconds): block chords + bass.
  chordEvents?: { notes: string[]; start: number; duration: number }[];
  bassEvents?: { note: string; start: number; duration: number }[];
}

export type { CompositionIntent };
