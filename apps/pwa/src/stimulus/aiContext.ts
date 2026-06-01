import type { EmotionalState, StimulusEvent } from "./types";

export function buildAIContext(
  emotionalState: EmotionalState,
  memorySummary: string,
  stimuli: StimulusEvent[],
) {
  return {
    emotionalState,
    memorySummary,
    stimulusSummary: stimuli.map((stimulus) => ({
      label: stimulus.label,
      strength: typeof stimulus.strength === "number" ? stimulus.strength : 0.5,
    })),
  };
}
