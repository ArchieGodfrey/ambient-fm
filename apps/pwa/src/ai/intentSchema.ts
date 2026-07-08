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

  // Optional creative nudges (hybrid): the model MAY steer the instrument palette,
  // arrangement arc, and vocal presence. Each is validated and falls back to the
  // deterministic mood-driven choice if absent/invalid — so the model adds
  // creativity without ever breaking the composition.
  palette?: string; // glass | warm | strings | bells | reed | synth | piano | harp | cello
  arc?: string;     // steady | build | ebb | swell | wavy
  vocals?: number;  // 0..1 desired choir presence
}
