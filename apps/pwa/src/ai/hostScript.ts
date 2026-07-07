import type { StimulusEvent } from "../types";
import type { CompositionPlan } from "./types";

// The DJ host's lines. Deterministic (assembled from the time/weather stimulus +
// the track's own name/mood/key) so no extra inference is needed — an extra
// infer() would mean an extra audio-context suspension per transition. An
// LLM-authored variant can layer on later as polish.

const article = (word: string) => (/^[aeiou]/i.test(word) ? "an" : "a");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function partOfDay(hour: number): string {
  if (hour < 5) return "late night";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
}

function timeBits(events: StimulusEvent[]): { part: string } {
  const t = events.find((e) => e.source === "time");
  const hour = typeof t?.metadata?.hour === "number" ? t.metadata.hour : new Date().getHours();
  return { part: partOfDay(hour) };
}

function weatherBits(events: StimulusEvent[]): string {
  const w = events.find((e) => e.source === "weather");
  if (!w) return "";
  const temp = typeof w.metadata?.temperature === "number" ? Math.round(w.metadata.temperature) : undefined;
  const label = (w.label ?? "").toLowerCase();
  if (!label) return "";
  return `${label} skies${temp != null ? `, ${temp} degrees` : ""}`;
}

export function hostWelcome(events: StimulusEvent[]): string {
  const { part } = timeBits(events);
  const wx = weatherBits(events);
  return `You're tuned in. ${cap(article(part))} ${part}${wx ? ` under ${wx}` : ""} — let's begin.`;
}

export function hostGreeting(events: StimulusEvent[]): string {
  const { part } = timeBits(events);
  const wx = weatherBits(events);
  const lines = [
    `Still with me, this ${part}.`,
    wx ? `${wx.charAt(0).toUpperCase() + wx.slice(1)} outside.` : `Keeping it going.`,
  ];
  return lines.join(" ");
}

// A short filler for transitions where the full greeting isn't due — still
// enough speech to cover the generation gap.
export function hostFiller(events: StimulusEvent[]): string {
  const { part } = timeBits(events);
  const options = ["And we roll on.", `Easing through the ${part}.`, "Here comes the next one.", "Let's keep the mood going."];
  // Vary by a cheap rotating index (no RNG needed; length changes each call site).
  return options[events.length % options.length];
}

export function hostIntro(title: string, plan: Pick<CompositionPlan, "globalMood" | "key">, opts?: { soundName?: string; yours?: boolean }): string {
  const mood = String(plan.globalMood ?? "ambient");
  const from = opts?.yours ? " drawn from your own sound" : opts?.soundName ? ` from your ${opts.soundName} sound` : "";
  return `Coming up, ${article(mood)} ${mood} piece${plan.key ? ` in ${plan.key}` : ""}${from} — this one's called ${title}.`;
}
