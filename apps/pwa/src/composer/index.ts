import { composerState } from "./composerState";
import { buildHarmony } from "./harmony";
import { decideNextAction } from "./decideNextAction";
import { activateInstrument } from "./instruments";
import type { CompositionIntent } from "../ai/intentSchema";
import type { RNG } from "../music/random/randomField";

export async function initializeComposer(context: { intent: CompositionIntent; emotion?: string | null }) {
  const intent = context.intent;
  const harmony = buildHarmony(intent);

  composerState.compositionId = crypto.randomUUID();
  composerState.intent = intent;
  composerState.harmony = harmony;
  composerState.currentSection = 0;
  composerState.currentChordDuration = 16;
  composerState.currentDensity = intent.motifDensity;
  composerState.emotion = context.emotion ?? null;
  composerState.activeMotifs = [];
  composerState.activeInstruments = [];
  composerState.lastStimulusHash = null;
  composerState.startedAt = Date.now();
}

function clampDensity(value: number) {
  return Math.max(0, Math.min(1, value));
}

function clampChordDuration(value: number) {
  return Math.max(8, Math.min(32, value));
}

export async function updateComposer(rng: RNG) {
  const action = decideNextAction(rng);

  switch (action) {
    case "advanceChord":
      composerState.currentChordIndex =
        (composerState.currentChordIndex + 1) %
        (composerState.harmony?.progression.length ?? 1);
      break;

    case "evolveDensity":
      composerState.currentDensity = clampDensity(composerState.currentDensity + 0.05);
      break;

    case "adjustChordTiming":
      composerState.currentChordDuration = clampChordDuration(
        composerState.currentChordDuration - 1,
      );
      break;

    case "addInstrument":
      activateInstrument("pad");
      break;

    case "nothing":
      break;
  }
}

export function getComposerState() {
  return composerState;
}
