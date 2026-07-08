import type { StimulusEvent } from "../types";
import type { CompositionPlan } from "./types";
import { computeEmotionalState } from "../stimulus/emotionalState";
import { getStation } from "../config/station";
import { getPooledLine } from "./hostLines";

// The DJ host's lines. Deterministic (assembled from the same stimulus the music
// uses — time, weather, scene, mood) so no inference is needed per transition.
// Style: informational — the current time, the weather, the mood of what's playing
// — with a small playful tone. An LLM-authored variant can sprinkle in on top.

const article = (word: string) => (/^[aeiou]/i.test(word) ? "an" : "a");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
// Pick a deterministic-but-varied option from a pool, seeded by a rotating index.
const pick = (pool: string[], seed: number) => pool[((seed % pool.length) + pool.length) % pool.length];

// The host speaks the LIVE clock time. (The `time` stimulus captures the hour when
// it's generated, which goes stale during a session — so don't read it here.)
function hourOf(): number {
  return new Date().getHours();
}

function partOfDay(hour: number): string {
  if (hour < 5) return "late night";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
}

// A friendly clock phrase: "9 in the morning", "5 in the evening" — kept loose.
function clockPhrase(hour: number): string {
  const h12 = ((hour + 11) % 12) + 1;
  const ampm = hour < 12 ? "in the morning" : hour < 17 ? "in the afternoon" : hour < 21 ? "in the evening" : "at night";
  return `${h12} ${ampm}`;
}

function weatherBits(events: StimulusEvent[]): { label: string; temp?: number } | null {
  const w = events.find((e) => e.source === "weather");
  if (!w) return null;
  const label = (w.label ?? "").toLowerCase();
  if (!label) return null;
  const temp = typeof w.metadata?.temperature === "number" ? Math.round(w.metadata.temperature) : undefined;
  return { label, temp };
}

// A scene from a photo/audio capture, if any (e.g. "café", "rain", "quiet room").
function sceneLabel(events: StimulusEvent[]): string | null {
  const s = [...events].reverse().find((e) => (e.source === "photo" || e.source === "audio") && e.label);
  return s ? s.label.toLowerCase() : null;
}

// A one-word mood descriptor from the same emotional state the music is built on.
function moodWord(events: StimulusEvent[]): string {
  const s = computeEmotionalState(events);
  if (s.tension > 0.55) return "restless";
  if (s.energy > 0.55) return "lively";
  if (s.brightness > 0.6) return "bright";
  if (s.calmness > 0.55) return "calm";
  return "easy";
}

function weatherLine(events: StimulusEvent[]): string | null {
  const w = weatherBits(events);
  if (!w) return null;
  const t = w.temp != null ? `, ${w.temp} degrees` : "";
  return `${cap(w.label)} out there${t}.`;
}

function timeLine(): string {
  const hour = hourOf();
  return pick([
    `It's ${clockPhrase(hour)}.`,
    `We're into the ${partOfDay(hour)}.`,
    `${cap(clockPhrase(hour))}, and you're tuned in.`,
  ], hour);
}

// ── Tune-in: a paced multi-line segment that covers the first-track wait ──

export function hostWelcome(): string {
  const hour = hourOf();
  const { stationName, hostName } = getStation();
  return pick([
    `You're tuned in to ${stationName} — ${clockPhrase(hour)}.`,
    `${hostName} with you on ${stationName}. ${cap(clockPhrase(hour))}.`,
    `Welcome to ${stationName}, I'm ${hostName} — it's ${clockPhrase(hour)}.`,
  ], hour);
}

// The opening run of lines while the first track is being made. The radio keeps
// speaking through these (and hostExtraLine after) until the track is ready.
export function hostIntroSegment(events: StimulusEvent[]): string[] {
  const lines: string[] = [hostWelcome()];
  const wx = weatherLine(events);
  if (wx) lines.push(wx);
  const scene = sceneLabel(events);
  if (scene) lines.push(`Looks like ${article(scene)} ${scene} kind of moment.`);
  // A personality-flavored pooled line (LLM), if one's ready — adds character.
  const pooled = getPooledLine("welcome", events.length) ?? getPooledLine("observation", events.length);
  if (pooled) lines.push(pooled);
  lines.push(pick([
    `Let me line something up for you.`,
    `Give me a second — finding the right one.`,
    `Cooking up something ${moodWord(events)} for you.`,
  ], events.length));
  return lines;
}

// Extra observations to keep talking if the track still isn't ready (rotates).
// Prefers a personality-flavored pooled line, falling back to deterministic.
export function hostExtraLine(events: StimulusEvent[], i: number): string {
  const hour = hourOf();
  return getPooledLine("observation", i) ?? pick([
    `Nearly there.`,
    `Something ${moodWord(events)} coming together.`,
    timeLine(),
    `Stay with me.`,
    `Just shaping the last of it.`,
    weatherLine(events) ?? `Settle in.`,
    `${cap(partOfDay(hour))} sounds, just for you.`,
  ], i);
}

// A shorter filler for mid-session transitions where the buffer briefly runs dry.
export function hostFiller(events: StimulusEvent[]): string {
  return getPooledLine("observation", events.length) ?? pick([
    `And we roll on.`,
    `Here comes the next one.`,
    `Keeping the ${moodWord(events)} going.`,
    `Let's stay in it.`,
  ], events.length);
}

// Back-announce the track that just finished (station-host presence).
export function hostBackAnnounce(prevTitle?: string | null): string | null {
  if (!prevTitle) return null;
  return pick([
    `That was ${prevTitle}.`,
    `${prevTitle}, there.`,
    `That one was ${prevTitle}.`,
  ], prevTitle.length);
}

// Read out a listener's write-in request (over the bed, while it generates).
export function hostRequestAck(text: string, events: StimulusEvent[]): string[] {
  const seed = text.length + events.length;
  return [
    pick([`Ooh — a request just came in.`, `We've got a request.`, `Someone's written in.`], seed),
    `They're after: ${text}.`,
    pick([`Let me put that together.`, `Say no more — making it now.`, `Love it. Give me a moment.`], seed),
  ];
}

// Name and frame the track that's about to play.
export function hostIntro(
  title: string,
  plan: Pick<CompositionPlan, "globalMood" | "key">,
  opts?: { soundName?: string; yours?: boolean; events?: StimulusEvent[] },
): string {
  const mood = String(plan.globalMood ?? "ambient");
  const from = opts?.yours ? " drawn from your own sound" : opts?.soundName ? ` from your ${opts.soundName} sound` : "";
  const seed = title.length + mood.length;
  return pick([
    `Coming up, ${article(mood)} ${mood} piece${plan.key ? ` in ${plan.key}` : ""}${from} — this one's called ${title}.`,
    `Here's ${title}${from} — ${mood}${plan.key ? `, in ${plan.key}` : ""}.`,
    `Next up: ${title}. Something ${mood}${from}.`,
  ], seed);
}
