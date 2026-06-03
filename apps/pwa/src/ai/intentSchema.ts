export interface SectionIntent {
  duration: number;
  mood: "calm" | "focused" | "tense" | "ambient" | "energised";
  intensity: number;
  lyricLine?: string;
  melodyInstruments?: string[];
  layers: {
    drone: number;
    pad: number;
    texture: number;
    pulse: number;
  };
}

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

  sections: SectionIntent[];
  vocalVoice?: string;
  melodyInstrument?: string;
  bassType?: 'sparse' | 'walking' | 'pulse' | 'none';
}
