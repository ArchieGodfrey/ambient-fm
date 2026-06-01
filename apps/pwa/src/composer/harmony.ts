import { composerState } from "./composerState";
import { resolveProgression } from "../music/harmony/index";
import type { CompositionIntent } from "../ai/intentSchema";

export function buildHarmony(intent: CompositionIntent) {
  const chords = resolveProgression(intent.key, intent.progression);
  return {
    key: intent.key,
    progression: chords.map((chord) => chord.symbol),
  };
}

export function getCurrentChord() {
  const harmony = composerState.harmony;
  if (!harmony) {
    return null;
  }

  return harmony.progression[composerState.currentChordIndex] ?? null;
}

export function advanceChord() {
  const harmony = composerState.harmony;
  if (!harmony) {
    return;
  }

  composerState.currentChordIndex =
    (composerState.currentChordIndex + 1) % harmony.progression.length;
}
