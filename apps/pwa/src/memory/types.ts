import type { CompositionPlan } from "../ai/types";

export interface SessionSummary {
  id: string;
  timestamp: number;

  title?: string; // evocative track name shown on the day's disc

  dominantMood: string;

  avgBpm: number;
  avgEnergy: number;

  key: string;
  plan?: CompositionPlan;

  layerProfile: {
    drone: number;
    pad: number;
    texture: number;
    pulse: number;
  };

  motifCount: number;
  dominantMotifLayer: "pad" | "pulse" | "texture" | "none";
  dominantPhraseType: "build" | "release" | "static" | "transition" | "none";
  phraseTransitionFrequency: number;
}
