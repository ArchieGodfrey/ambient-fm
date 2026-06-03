import * as Tone from "tone";
import { createDrone } from "./layers/drone";
import { createPad } from "./layers/pad";
import { createTexture } from "./layers/texture";
import { createPulse } from "./layers/pulse";
import type { CompositionPlan } from "../ai/types";

let drone: ReturnType<typeof createDrone> | null = null;
let pad: ReturnType<typeof createPad> | null = null;
let texture: ReturnType<typeof createTexture> | null = null;
let pulse: ReturnType<typeof createPulse> | null = null;

function clampNumber(value: unknown, fallback: number, min = -Infinity, max = Infinity) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
}

function normalizeCompositionPlan(plan: CompositionPlan): CompositionPlan {
  const normalizedSections = Array.isArray(plan.sections)
    ? plan.sections.map((section) => ({
        start: clampNumber(section.start, 0, 0),
        duration: clampNumber(section.duration, 0, 0),
        mood: section.mood,
        intensity: clampNumber(section.intensity, 0.5, 0, 1),
        phraseIds: Array.isArray(section.phraseIds) ? section.phraseIds : [],
        ...(section.layers
          ? {
              layers: {
                drone: clampNumber(section.layers.drone, 0, 0, 1),
                pad: clampNumber(section.layers.pad, 0, 0, 1),
                texture: clampNumber(section.layers.texture, 0, 0, 1),
                pulse: clampNumber(section.layers.pulse, 0, 0, 1),
              },
            }
          : {}),
        ...(section.lyricLine ? { lyricLine: section.lyricLine } : {}),
        ...(section.melodyInstruments ? { melodyInstruments: section.melodyInstruments } : {}),
      }))
    : [];

  const computedDuration = normalizedSections.reduce((max, section) => {
    return Math.max(max, section.start + section.duration);
  }, 0);

  return {
    key: typeof plan.key === "string" && plan.key.trim() ? plan.key : "Unknown",
    bpm: clampNumber(plan.bpm, 70, 20, 240),
    duration: clampNumber(plan.duration, computedDuration || 30, 1, 600),
    globalMood: typeof plan.globalMood === "string" ? plan.globalMood : "ambient",
    sections: normalizedSections,
    seed: clampNumber(plan.seed, 0, 0, 0xffffffff),
    evolutionProfile: plan.evolutionProfile,
    texture: {
      density: clampNumber(plan.texture?.density, 0, 0, 1),
      brightness: clampNumber(plan.texture?.brightness, 0, 0, 1),
      reverbAmount: clampNumber(plan.texture?.reverbAmount, 0.2, 0, 1),
    },
    layers: {
      drone: clampNumber(plan.layers?.drone, 0, 0, 1),
      pad: clampNumber(plan.layers?.pad, 0, 0, 1),
      texture: clampNumber(plan.layers?.texture, 0, 0, 1),
      pulse: clampNumber(plan.layers?.pulse, 0, 0, 1),
    },
    motifs: Array.isArray(plan.motifs) ? plan.motifs : [],
    phrases: Array.isArray(plan.phrases) ? plan.phrases : [],
    melodyInstrument: plan.melodyInstrument,
    bassType: plan.bassType,
  };
}

export function initAudioGraph() {
  if (drone && pad && texture && pulse) return;

  drone = createDrone();
  pad = createPad();
  texture = createTexture();
  pulse = createPulse();

  pulse.start();
}

export function applyComposition(plan: CompositionPlan) {
  if (!drone || !pad || !texture || !pulse) {
    initAudioGraph();
  }

  const safePlan = normalizeCompositionPlan(plan);

  Tone.Transport.bpm.value = safePlan.bpm;
  drone?.setIntensity(safePlan.layers.drone);
  pad?.setIntensity(safePlan.layers.pad);
  texture?.setIntensity(
    safePlan.layers.texture * safePlan.texture.density,
    safePlan.texture.brightness,
  );
  pulse?.setIntensity(safePlan.layers.pulse);
}
