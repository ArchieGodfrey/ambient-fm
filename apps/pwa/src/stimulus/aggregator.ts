import type { StimulusEvent } from "./types";
import { getPluginWeight } from "./registry";
import type { StimulusRegistry } from "./registry";

export function applyStimulusWeights(
  events: StimulusEvent[],
  registry: StimulusRegistry,
) {
  return events.map((event) => {
    const baseStrength = typeof event.strength === "number" ? event.strength : 0.5;
    return {
      ...event,
      strength: baseStrength * getPluginWeight(registry, event.source),
    };
  });
}
