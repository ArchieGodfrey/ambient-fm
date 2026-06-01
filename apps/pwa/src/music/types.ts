export interface MusicalKey {
  tonic: string;
  mode: "major" | "minor";
}

export interface Chord {
  symbol: string;
  notes: string[];
}

export interface ChordRegion {
  start: number;
  duration: number;
  chord: string;
}

export interface CompositionIntent {
  key: MusicalKey;
  bpm: number;
  progression: number[];
  complexity: number;
  motifDensity: number;
}
