export interface CompositionSection {
  start: number;
  duration: number;
  mood: "calm" | "focused" | "tense" | "ambient" | "energised";
  intensity: number;
}

export interface CompositionPlan {
  key: string;
  bpm: number;
  globalMood: string;
  sections: CompositionSection[];
  texture: {
    density: number;
    brightness: number;
    reverbAmount: number;
  };
  layers: {
    drone: number;
    pad: number;
    texture: number;
    pulse: number;
  };
}
