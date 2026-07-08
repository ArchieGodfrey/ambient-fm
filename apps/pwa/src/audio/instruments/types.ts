export interface Instrument {
  id: string;
  play(note: string, time: number, velocity?: number): void;
  setIntensity(v: number): void;
  // Free the underlying Tone node(s). Used when rebuilding the registry in a
  // different Tone context (e.g. an offline render).
  dispose?(): void;
}
