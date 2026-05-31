export type StimulusSource = "manual";

export interface StimulusEvent {
  id: string;
  timestamp: number;
  source: StimulusSource;
  label: string;
}
