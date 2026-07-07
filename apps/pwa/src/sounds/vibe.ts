import type { SoundKey, SoundMood } from "./types";

// Deterministically turn a sound's mood/key/tempo into a short poetic "vibe" —
// a starting point the user can edit, and direction the AI can compose toward.
export function describeVibe(mood: SoundMood, key?: SoundKey, tempo?: number): string {
  const pace = mood.energy > 0.66 ? "restless" : mood.energy < 0.33 ? "still" : "unhurried";
  const light = mood.brightness > 0.6 ? "sunlit" : mood.brightness < 0.35 ? "dim and nocturnal" : "half-lit";
  const air = mood.tension > 0.6 ? "with a taut undercurrent" : mood.calmness > 0.6 ? "and softly settled" : "quietly drifting";
  const tonal = key ? `${key.tonic} ${key.mode}` : "open";
  const speed = tempo ? ` around ${tempo} bpm` : "";
  return `A ${pace}, ${light} ${tonal} soundscape${speed}, ${air}.`;
}
