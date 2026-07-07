import { field } from "../music/random/randomField";
import { infer, isModelLoaded } from "../runtime/modelRuntime";
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

// Pull a clean 2–4 word title out of a raw model completion, or null if it
// looks like a refusal / prose / junk (so the caller falls back).
function sanitizeName(raw: string): string | null {
  const first = raw.split("\n").map((s) => s.trim()).find(Boolean) ?? "";
  const name = first
    .replace(/^(title|name)\s*[:\-]\s*/i, "")
    .replace(/^["'`*]+|["'`*.]+$/g, "")
    .trim();
  const words = name.split(/\s+/).filter(Boolean);
  if (!name || words.length > 4 || name.length > 32 || !/[a-z]/i.test(name)) return null;
  return name;
}

// Name the track with the model — a short evocative title from its feel —
// falling back to the deterministic name if the model is absent or misbehaves.
export async function generateTrackNameLLM(
  plan: Pick<CompositionPlan, "seed" | "globalMood" | "key">,
  opts?: { vibe?: string; moodWords?: string },
): Promise<string> {
  const fallback = generateTrackName(plan);
  if (!isModelLoaded()) return fallback;
  const feel = [
    `mood: ${opts?.moodWords ?? plan.globalMood ?? "ambient"}`,
    plan.key ? `key: ${plan.key}` : "",
    opts?.vibe ? `vibe: ${opts.vibe}` : "",
  ].filter(Boolean).join("; ");
  const prompt = `Invent a short, evocative title (2 to 4 words) for an instrumental ambient music track.\nTrack feel — ${feel}.\nReply with ONLY the title. No quotes, no explanation, no trailing punctuation.`;
  try {
    return sanitizeName(await infer(prompt)) ?? fallback;
  } catch {
    return fallback;
  }
}
