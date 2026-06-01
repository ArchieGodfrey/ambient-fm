import type { StimulusEvent } from "../types";

export function deriveAudioState(events: StimulusEvent[]) {
  let energy = 0;
  let count = 0;

  for (const e of events) {
    if (typeof e.value === "number") {
      energy += e.value;
      count += 1;
    }
  }

  energy = energy / Math.max(count, 1);

  return {
    bpm: 60 + energy * 60,
    filterCutoff: 400 + energy * 2000,
    reverbMix: 0.2 + (1 - energy) * 0.6,
  };
}
