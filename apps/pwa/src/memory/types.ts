import type { CompositionPlan } from "../ai/types";

export interface SessionSummary {
  id: string;
  timestamp: number;

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
}
