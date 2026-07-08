export interface CompositionIntent {
  key: {
    tonic: string;
    mode: "major" | "minor";
  };

  bpm: number;

  progression: number[];

  motifDensity: number;

  complexity: number;

  energy: number;

  // A short evocative track title, generated in the same pass (saves a second
  // inference). Optional — falls back to a deterministic name if absent/invalid.
  title?: string;
}
