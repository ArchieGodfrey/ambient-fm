import type { Instrument } from "./types";

export class InstrumentRegistry {
  private instruments = new Map<string, Instrument>();

  register(instrument: Instrument) {
    this.instruments.set(instrument.id, instrument);
  }

  get(id: string) {
    return this.instruments.get(id);
  }

  getAll() {
    return Array.from(this.instruments.values());
  }
}
