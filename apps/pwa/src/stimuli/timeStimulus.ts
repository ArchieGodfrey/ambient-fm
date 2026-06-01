import { nanoid } from "nanoid";
import type { StimulusEvent } from "../types";

export function getTimeStimulus(): StimulusEvent {
  const hour = new Date().getHours();

  let label = "Neutral";
  let value = 0.5;

  if (hour >= 6 && hour < 12) {
    label = "Morning Energy";
    value = 0.8;
  } else if (hour >= 12 && hour < 18) {
    label = "Focused Daytime";
    value = 0.6;
  } else if (hour >= 18 && hour < 22) {
    label = "Winding Down";
    value = 0.3;
  } else {
    label = "Night Calm";
    value = 0.1;
  }

  return {
    id: nanoid(),
    timestamp: Date.now(),
    source: "time",
    label,
    value,
    strength: Math.min(1, Math.max(0, value)),
  };
}
