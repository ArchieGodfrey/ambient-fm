export interface Instrument {
  id: string;

  play(note: string, time: number, velocity?: number): void;

  setVolume(v: number): void;
}
