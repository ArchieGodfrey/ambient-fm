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
  return {
    key: typeof plan.key === "string" && plan.key.trim() ? plan.key : "Unknown",
    bpm: clampNumber(plan.bpm, 70, 20, 240),
    globalMood: typeof plan.globalMood === "string" ? plan.globalMood : "ambient",
    sections: Array.isArray(plan.sections)
      ? plan.sections.map((section) => ({
          start: clampNumber(section.start, 0, 0),
          duration: clampNumber(section.duration, 0, 0),
          mood: section.mood,
          intensity: clampNumber(section.intensity, 0.5, 0, 1),
        }))
      : [],
    texture: {
      density: clampNumber(plan.texture?.density, 0.5, 0, 1),
      brightness: clampNumber(plan.texture?.brightness, 0.5, 0, 1),
      reverbAmount: clampNumber(plan.texture?.reverbAmount, 0.5, 0, 1),
    },
    layers: {
      drone: clampNumber(plan.layers?.drone, 0.5, 0, 1),
      pad: clampNumber(plan.layers?.pad, 0.5, 0, 1),
      texture: clampNumber(plan.layers?.texture, 0.5, 0, 1),
      pulse: clampNumber(plan.layers?.pulse, 0.5, 0, 1),
    },
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
  texture?.setIntensity(safePlan.layers.texture);
  pulse?.setIntensity(safePlan.layers.pulse);
}
