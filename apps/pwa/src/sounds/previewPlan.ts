import type { CompositionIntent } from "../ai/intentSchema";
import type { CompositionPlan } from "../ai/types";
import { buildCompositionPlanFromIntent } from "../ai/intentToPlan";
import { createSeed } from "../utils/randomField";
import type { SoundMood } from "./types";
import type { ComposerSettings } from "../features/composer/types";

const TONICS = ["A", "C", "D", "E", "G"];
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

// Deterministically map a mood + sonic settings to a composition intent, so the
// user can hear their sound instantly without invoking the LLM.
export function moodToIntent(mood: SoundMood, settings: ComposerSettings): CompositionIntent {
  const energy = clamp01(mood.energy);
  const tension = clamp01(mood.tension);
  const brightness = clamp01(mood.brightness);
  const mode: "major" | "minor" = tension > 0.5 || mood.calmness < 0.4 ? "minor" : "major";
  const tonic = TONICS[Math.min(TONICS.length - 1, Math.floor(brightness * TONICS.length))];
  return {
    key: { tonic, mode },
    bpm: Math.round(60 + energy * 60),
    progression: mode === "minor" ? [0, 5, 3, 6] : [0, 3, 4, 5],
    motifDensity: clamp01(settings.motifDensity),
    complexity: clamp01(settings.complexity),
    energy,
  };
}

export function describeMood(mood: SoundMood): string {
  if (mood.tension > 0.6) return "tense";
  if (mood.energy > 0.6) return "energised";
  if (mood.calmness > 0.6) return "calm";
  if (mood.brightness > 0.6) return "bright";
  return "ambient";
}

export function buildPreviewPlan(mood: SoundMood, settings: ComposerSettings): CompositionPlan {
  const intent = moodToIntent(mood, settings);
  const plan = buildCompositionPlanFromIntent(intent, settings, createSeed());
  plan.intent = intent;
  plan.globalMood = describeMood(mood);
  return plan;
}
