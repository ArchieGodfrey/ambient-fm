import { field } from "../music/random/randomField";
import type { CompositionPlan } from "./types";

// Evocative two-word track names, generated deterministically from the plan's
// seed and tinted by its mood — so every burn lands on the day's disc with a
// name, and the same plan always names the same. (Deterministic, offline; no
// extra LLM round-trip, in keeping with "AI gives direction, algorithms make it".)

const ADJECTIVES: Record<string, string[]> = {
  calm: ["Quiet", "Still", "Soft", "Pale", "Drifting", "Slow", "Hushed", "Gentle"],
  focused: ["Clear", "Steady", "Deep", "Inner", "Distant", "Even", "Patient"],
  tense: ["Restless", "Fractured", "Shadowed", "Uneasy", "Sharp", "Coiled", "Dim"],
  energised: ["Bright", "Electric", "Rising", "Golden", "Vivid", "Lit", "Racing"],
  ambient: ["Floating", "Weightless", "Endless", "Dreamt", "Suspended", "Faint", "Woven"],
};

const NOUNS = [
  "Ember", "Tide", "Current", "Signal", "Horizon", "Meridian", "Static", "Halo",
  "Drift", "Aurora", "Lantern", "Passage", "Thread", "Echo", "Field", "Glow",
  "Mirage", "Vapour", "Pulse", "Undertow", "Prism", "Wake", "Hollow", "Dawn",
];

function moodBucket(mood?: string): keyof typeof ADJECTIVES {
  const m = (mood ?? "").toLowerCase();
  if (/calm|still|slow/.test(m)) return "calm";
  if (/focus/.test(m)) return "focused";
  if (/tense|tension|anx|dark/.test(m)) return "tense";
  if (/energ|bright|upbeat|lively/.test(m)) return "energised";
  return "ambient";
}

export function generateTrackName(plan: Pick<CompositionPlan, "seed" | "globalMood">): string {
  const rng = field(plan.seed ?? 1, 0, "track-name");
  const adjs = ADJECTIVES[moodBucket(plan.globalMood)];
  const adj = adjs[Math.floor(rng() * adjs.length) % adjs.length];
  const noun = NOUNS[Math.floor(rng() * NOUNS.length) % NOUNS.length];
  return `${adj} ${noun}`;
}
