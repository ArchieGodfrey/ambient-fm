import { nanoid } from "nanoid";
import type { StimulusEvent, StimulusPlugin } from "../types";

export class TimeStimulusPlugin implements StimulusPlugin {
  id = "time";
  label = "Time of Day";
  enabled = true;
  weight = 1;

  async generate(): Promise<StimulusEvent[]> {
    const hour = new Date().getHours();
    let label = "Neutral Time";
    let strength = 0.5;

    if (hour >= 6 && hour < 12) {
      label = "Morning Energy";
      strength = 0.75;
    } else if (hour >= 12 && hour < 18) {
      label = "Focused Daytime";
      strength = 0.65;
    } else if (hour >= 18 && hour < 22) {
      label = "Winding Down";
      strength = 0.35;
    } else {
      label = "Night Calm";
      strength = 0.2;
    }

    return [
      {
        id: nanoid(),
        source: this.id,
        label,
        timestamp: Date.now(),
        strength,
        metadata: { hour },
      },
    ];
  }
}
