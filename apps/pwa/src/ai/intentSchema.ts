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
}
