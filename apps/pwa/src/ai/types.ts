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
}

export type { CompositionIntent };
