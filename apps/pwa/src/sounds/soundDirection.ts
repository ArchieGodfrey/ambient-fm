import type { Sound } from "./types";
import type { CompositionPlan } from "../ai/types";
import type { CompositionDirection } from "../ai/prompt";
import { describeMood } from "./previewPlan";

// Turn the active Sound into the direction the LLM composes toward, and inject
// the parts of a Sound the intent→plan path can't produce (the user's recorded
// melody, explicit layer levels, tempo). Shared by Today (burn from your sound)
// and the Studio's "elevate" so a burn actually sounds like the loaded Sound.

// Flatten recorded takes into one timed melody, concatenating takes with a gap.
export function flattenMelody(sound: Partial<Sound>) {
  const takes = sound.melody ?? [];
  const melodyNotes: { note: string; start: number; duration: number }[] = [];
  let offset = 0;
  for (const take of takes) {
    let takeLen = 0;
    for (const n of take.notes) {
      melodyNotes.push({ note: n.note, start: offset + n.start, duration: n.duration });
      takeLen = Math.max(takeLen, n.start + n.duration);
    }
    offset += takeLen + 0.4;
  }
  return melodyNotes;
}

export function soundToDirection(sound: Partial<Sound>): CompositionDirection {
  return {
    key: sound.key,
    progression: sound.progression,
    tempo: sound.tempo,
    moodWords: sound.mood ? describeMood(sound.mood) : undefined,
    hasMelody: (sound.melody ?? []).length > 0,
    instruction: sound.fillInstruction?.trim() || undefined,
    vibe: sound.vibe?.trim() || undefined,
  };
}

export function applySoundToPlan(plan: CompositionPlan, sound: Partial<Sound>): void {
  if (sound.tempo) plan.bpm = sound.tempo;
  if (sound.layers) plan.layers = { ...plan.layers, ...sound.layers };
  const melodyNotes = flattenMelody(sound);
  if (melodyNotes.length) {
    plan.melodyNotes = melodyNotes;
    plan.melodyInstrument = sound.melodyInstrument;
  }
}
