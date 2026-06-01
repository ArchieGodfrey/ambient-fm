export type StimulusSource = "manual" | "time" | "weather" | "photo" | "audio" | "other";

export interface StimulusEvent {
  id: string;
  source: StimulusSource | string;
  label: string;
  timestamp: number;
  strength: number;
  value?: number;
  metadata?: Record<string, any>;
}

export interface StimulusPlugin {
  id: string;
  label: string;
  enabled: boolean;
  weight: number;
  generate(): Promise<StimulusEvent[]>;
}

export interface ManualMoodValues {
  energy: number;
  calmness: number;
  tension: number;
  brightness: number;
}

export interface StimulusConfig {
  id: string;
  label: string;
  userWeight: number;
  aiWeight: number;
  enabled: boolean;
  manualValues?: ManualMoodValues;
}

export interface EmotionalState {
  energy: number;
  calmness: number;
  tension: number;
  brightness: number;
}
