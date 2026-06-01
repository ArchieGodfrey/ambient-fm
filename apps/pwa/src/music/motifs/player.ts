import type { Instrument } from "../instruments/types";

export class MotifPlayer {
  private instrument: Instrument;

  constructor(instrument: Instrument) {
    this.instrument = instrument;
  }

  play(notes: string[], startTime: number) {
    notes.forEach((note, index) => {
      this.instrument.play(note + "4", startTime + index * 0.5);
    });
  }
}
