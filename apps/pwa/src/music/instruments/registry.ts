import type { Instrument } from "./types";

const instruments = new Map<string, Instrument>();

export function registerInstrument(instrument: Instrument) {
  instruments.set(instrument.id, instrument);
}

export function getInstrument(id: string) {
  return instruments.get(id);
}

export function getAllInstruments() {
  return Array.from(instruments.values());
}
