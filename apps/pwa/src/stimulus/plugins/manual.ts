import { nanoid } from "nanoid";
import type { ManualMoodValues, StimulusEvent, StimulusPlugin } from "../types";

const DEFAULT_MANUAL_VALUES: ManualMoodValues = {
  energy: 0.5,
  calmness: 0.5,
  tension: 0.5,
  brightness: 0.5,
};

export class ManualMoodStimulusPlugin implements StimulusPlugin {
  id = "manual";
  label = "Mood";
  enabled = true;
  weight = 1;

  private values: ManualMoodValues = { ...DEFAULT_MANUAL_VALUES };

  setValues(values: Partial<ManualMoodValues>) {
    this.values = {
      ...this.values,
      ...values,
    };
  }

  getValues() {
    return { ...this.values };
  }

  async generate(): Promise<StimulusEvent[]> {
    const strength = (this.values.energy + this.values.calmness + this.values.tension + this.values.brightness) / 4;
    const event: StimulusEvent = {
      id: nanoid(),
      source: this.id,
      label: "Mood",
      timestamp: Date.now(),
      strength,
      metadata: {
        ...this.values,
      },
    };

    return [event];
  }
}
