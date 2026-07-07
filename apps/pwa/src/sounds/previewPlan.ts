import type { CompositionIntent } from "../ai/intentSchema";
import type { CompositionPlan } from "../ai/types";
import { buildCompositionPlanFromIntent } from "../ai/intentToPlan";
import { createSeed } from "../utils/randomField";
import { DEFAULT_COMPOSER_SETTINGS, DEFAULT_MOOD, type Sound, type SoundMood } from "./types";
import type { ComposerSettings } from "../features/composer/types";

const TONIC_BY_BRIGHTNESS = ["A", "C", "D", "E", "G"];
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

// Deterministically map a mood + sonic settings to a composition intent, so the
// user hears their sound instantly without invoking the LLM.
export function moodToIntent(mood: SoundMood, settings: ComposerSettings): CompositionIntent {
  const energy = clamp01(mood.energy);
  const tension = clamp01(mood.tension);
  const brightness = clamp01(mood.brightness);
  const mode: "major" | "minor" = tension > 0.5 || mood.calmness < 0.4 ? "minor" : "major";
  const tonic = TONIC_BY_BRIGHTNESS[Math.min(TONIC_BY_BRIGHTNESS.length - 1, Math.floor(brightness * TONIC_BY_BRIGHTNESS.length))];
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

// Turn a full Sound (mood + any musical direction the user set in the Studio)
// into a playable plan, extrapolating anything the user didn't specify.
export function buildSoundscape(sound: Partial<Sound>): CompositionPlan {
  const mood = sound.mood ?? DEFAULT_MOOD;
  const settings = sound.composerSettings ?? DEFAULT_COMPOSER_SETTINGS;

  const intent = moodToIntent(mood, settings);
  if (sound.key) intent.key = sound.key;
  if (sound.progression?.length) intent.progression = sound.progression;

  const plan = buildCompositionPlanFromIntent(intent, settings, createSeed());

  if (sound.tempo) plan.bpm = sound.tempo;
  if (sound.layers) plan.layers = { ...plan.layers, ...sound.layers };

  // A tapped melody (note names) replaces the pad motif's notes so it actually
  // plays through the existing motif engine (which references motifs by id).
  const melody = (sound.melody ?? []).filter((n): n is string => typeof n === "string");
  if (melody.length) {
    const rhythm = melody.map(() => 0.5);
    const pad = plan.motifs.find((m) => m.layer === "pad");
    if (pad) {
      pad.notes = melody;
      pad.rhythm = rhythm;
    } else {
      plan.motifs.push({ id: "melody", layer: "pad", notes: melody, rhythm });
    }
  }

  plan.intent = intent;
  plan.globalMood = describeMood(mood);
  return plan;
}

// Back-compat alias used by the earlier Your Sound screen.
export function buildPreviewPlan(mood: SoundMood, settings: ComposerSettings): CompositionPlan {
  return buildSoundscape({ mood, composerSettings: settings });
}
