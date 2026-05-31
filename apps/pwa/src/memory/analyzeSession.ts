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

  return {
    id,
    timestamp: Date.now(),

    dominantMood,
    avgBpm: plan.bpm,
    avgEnergy: plan.layers.drone + plan.layers.pad,
    key: plan.key,
    layerProfile: plan.layers,
  };
}
