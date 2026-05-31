export type StimulusSource = "manual" | "time" | "weather";

export interface StimulusEvent {
  id: string;
  timestamp: number;
  source: StimulusSource;
  label: string;
  value?: number;
}
