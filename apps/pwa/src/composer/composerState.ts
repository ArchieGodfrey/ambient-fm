import type { CompositionIntent } from "../ai/intentSchema";

export interface ComposerHarmonyState {
  key: CompositionIntent["key"];
  progression: string[];
}

export const composerState = {
  compositionId: null as string | null,
  emotion: null as string | null,
  currentSection: null as number | null,
  currentChordIndex: 0,
  currentChordDuration: 16,
  currentDensity: 0.4,
  activeMotifs: [] as string[],
  activeInstruments: [] as string[],
  lastStimulusHash: null as string | null,
  startedAt: Date.now(),
  intent: null as CompositionIntent | null,
  harmony: null as ComposerHarmonyState | null,
};
