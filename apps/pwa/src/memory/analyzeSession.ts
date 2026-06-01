import type { StimulusEvent } from "../types";
import type { SessionSummary } from "./types";
import type { CompositionPlan, Phrase } from "../ai/types";

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

  const phraseRoleCounts: Record<string, number> = {
    build: 0,
    release: 0,
    static: 0,
    transition: 0,
  };

  const sectionPhraseRoles = plan.sections
    .flatMap((section) => section.phraseIds ?? [])
    .map((phraseId) => plan.phrases.find((phrase) => phrase.id === phraseId))
    .filter((phrase): phrase is Phrase => Boolean(phrase));

  for (const phrase of sectionPhraseRoles) {
    if (phraseRoleCounts[phrase.role] !== undefined) {
      phraseRoleCounts[phrase.role] += 1;
    }
  }

  const dominantPhraseType =
    (Object.entries(phraseRoleCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as
      | "build"
      | "release"
      | "static"
      | "transition"
      | undefined) ?? "none";

  const phraseTransitionFrequency = Math.max(0, plan.sections.length - 1) / Math.max(1, plan.duration);

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
    dominantPhraseType,
    phraseTransitionFrequency,
  };
}
