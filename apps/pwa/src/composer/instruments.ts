import { composerState } from "./composerState";
import { field } from "../music/random/randomField";

const families = ["pad", "bell", "bass"] as const;

export function assignInstrument(motif: { instrument?: string }, seed: number, tick: number) {
  const rng = field(seed, tick, "assignInstrument");
  motif.instrument = families[Math.floor(rng() * families.length)];
  return motif.instrument;
}

export function activateInstrument(instrumentId: string) {
  if (!composerState.activeInstruments.includes(instrumentId)) {
    composerState.activeInstruments.push(instrumentId);
  }
}

export function deactivateInstrument(instrumentId: string) {
  composerState.activeInstruments = composerState.activeInstruments.filter(
    (id) => id !== instrumentId,
  );
}
