import { updateAudio } from "./toneEngine";
import type { CompositionPlan } from "../ai/types";

export function applyComposition(plan: CompositionPlan) {
  updateAudio({
    bpm: plan.bpm,
    filterCutoff: 400 + plan.texture.brightness * 2000,
    reverbMix: plan.texture.reverbAmount,
  });
}
