import type { StimulusEvent } from "../types";
import type { SessionSummary } from "./types";
import type { CompositionPlan } from "../ai/types";

export function analyzeSession(
  id: string,
  events: StimulusEvent[],
  plan: CompositionPlan,
): SessionSummary {
  const moodCounts: Record<string, number> = {};

  for (const event of events) {
    moodCounts[event.label] = (moodCounts[event.label] || 0) + 1;
  }

  const dominantMood =
    Object.entries(moodCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? "neutral";

  const motifCount = Array.isArray(plan.motifs) ? plan.motifs.length : 0;
  const motifLayerCounts = {
    pad: 0,
    pulse: 0,
    texture: 0,
  };

  if (Array.isArray(plan.motifs)) {
    for (const motif of plan.motifs) {
      if (motif.layer in motifLayerCounts) {
        motifLayerCounts[motif.layer] += 1;
      }
    }
  }

  const dominantMotifLayer = Object.entries(motifLayerCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] as "pad" | "pulse" | "texture" | undefined;

  return {
    id,
    timestamp: Date.now(),

    dominantMood,
    avgBpm: plan.bpm,
    avgEnergy: plan.layers.drone + plan.layers.pad,
    key: plan.key,
    layerProfile: plan.layers,
    motifCount,
    dominantMotifLayer: dominantMotifLayer ?? "none",
  };
}
