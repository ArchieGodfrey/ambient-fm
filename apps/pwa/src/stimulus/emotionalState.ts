import type { EmotionalState, StimulusEvent } from "./types";

function clamp(value: number, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max);
}

function normalize(state: EmotionalState): EmotionalState {
  const maxValue = Math.max(state.energy, state.calmness, state.tension, state.brightness, 1);
  return {
    energy: clamp(state.energy / maxValue),
    calmness: clamp(state.calmness / maxValue),
    tension: clamp(state.tension / maxValue),
    brightness: clamp(state.brightness / maxValue),
  };
}

export function computeEmotionalState(events: StimulusEvent[]): EmotionalState {
  let energy = 0;
  let calmness = 0;
  let tension = 0;
  let brightness = 0;

  for (const event of events) {
    const strength = typeof event.strength === "number" ? event.strength : 0.5;

    if (event.source === "manual" && event.metadata) {
      const energyValue = typeof event.metadata.energy === "number" ? event.metadata.energy : 0;
      const calmnessValue = typeof event.metadata.calmness === "number" ? event.metadata.calmness : 0;
      const tensionValue = typeof event.metadata.tension === "number" ? event.metadata.tension : 0;
      const brightnessValue = typeof event.metadata.brightness === "number" ? event.metadata.brightness : 0;

      energy += energyValue * strength;
      calmness += calmnessValue * strength;
      tension += tensionValue * strength;
      brightness += brightnessValue * strength;
      continue;
    }

    const label = event.label.toLowerCase();

    if (label.includes("rain") || label.includes("storm") || label.includes("drizzle")) {
      calmness += strength * 0.8;
      tension += strength * 0.1;
    }

    if (label.includes("work") || label.includes("focus") || label.includes("focused")) {
      energy += strength * 0.9;
      tension += strength * 0.5;
    }

    if (label.includes("sun") || label.includes("bright") || label.includes("clear")) {
      brightness += strength * 0.9;
      energy += strength * 0.2;
    }

    if (label.includes("calm") || label.includes("night") || label.includes("ease")) {
      calmness += strength * 0.9;
      energy += strength * 0.1;
    }

    if (label.includes("storm") || label.includes("tense") || label.includes("urgent")) {
      tension += strength * 0.8;
    }

    if (label.includes("cool") || label.includes("cold")) {
      calmness += strength * 0.2;
      brightness += strength * 0.1;
    }

    if (label.includes("warm") || label.includes("hot")) {
      energy += strength * 0.3;
      brightness += strength * 0.4;
    }
  }

  return normalize({ energy, calmness, tension, brightness });
}

// A single-word mood descriptor from the emotional state — shared by the DJ host
// lines (deterministic + LLM) so they stay in step.
export function moodWord(events: StimulusEvent[]): string {
  const s = computeEmotionalState(events);
  if (s.tension > 0.55) return "restless";
  if (s.energy > 0.55) return "lively";
  if (s.brightness > 0.6) return "bright";
  if (s.calmness > 0.55) return "calm";
  return "easy";
}
