import { applyComposition } from "./audioGraph";
import type { CompositionPlan, CompositionSection } from "../ai/types";

export function applySectionToAudio(
  section: CompositionSection | null,
  layers: CompositionPlan["layers"],
  plan: CompositionPlan,
  drift = 0,
) {
  const intensity = section?.intensity ?? 0.5;
  const driftMultiplier = 1 + drift;

  applyComposition({
    ...plan,
    layers: {
      drone: Math.min(1, layers.drone * intensity * driftMultiplier),
      pad: Math.min(1, layers.pad * intensity * driftMultiplier),
      texture: Math.min(1, layers.texture * intensity * driftMultiplier),
      pulse: Math.min(1, layers.pulse * intensity * driftMultiplier),
    },
  });
}
