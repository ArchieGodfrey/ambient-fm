import { infer, isModelLoaded } from "../runtime/modelRuntime";
import { sanitizeJsonResponse, tryParseJsonWithRecovery } from "./prompt";
import { computeEmotionalState } from "../stimulus/emotionalState";
import { getStation } from "../config/station";
import type { StimulusEvent } from "../types";

// LLM-authored host banter, flavored by the host's name + personality, generated
// with the composer model while it's already loaded (during radio buffering / a
// wizard starter batch). Cached + persisted; the deterministic hostScript lines
// are always the fallback (offline / model not loaded / generation failed).
//
// Only STANDALONE banter is pooled (welcome + interstitial "observation" lines).
// Track/request-specific lines (intro, back-announce, request read-out) stay
// deterministic or are generated on demand, since they need runtime specifics.

export type HostPoolCategory = "welcome" | "observation";
type HostPool = { sig: string; ts: number; welcome: string[]; observation: string[] };

const STORAGE_KEY = "ambientfm-host-lines";
const MAX_PER_CATEGORY = 16;
const REFRESH_AFTER_MS = 30 * 60 * 1000; // top up at most ~twice an hour

let pool: HostPool | null = null;
let generating = false;

// Identity that invalidates the pool when it changes (rename host, edit personality…).
function signature(): string {
  const s = getStation();
  return `${s.stationName}|${s.hostName}|${s.hostPersonality}`;
}

function load(): HostPool | null {
  if (pool) return pool;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) pool = JSON.parse(raw) as HostPool;
  } catch { /* ignore */ }
  return pool;
}

function save(next: HostPool) {
  pool = next;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
}

// A pooled line for a category, or null to fall back to a deterministic line.
export function getPooledLine(category: HostPoolCategory, seed: number): string | null {
  const p = load();
  if (!p || p.sig !== signature()) return null; // stale identity → deterministic
  const arr = p[category];
  if (!arr?.length) return null;
  return arr[((seed % arr.length) + arr.length) % arr.length];
}

function moodWord(events: StimulusEvent[]): string {
  const s = computeEmotionalState(events);
  if (s.tension > 0.55) return "restless";
  if (s.energy > 0.55) return "lively";
  if (s.brightness > 0.6) return "bright";
  if (s.calmness > 0.55) return "calm";
  return "easy";
}

function buildPrompt(events: StimulusEvent[]): string {
  const { stationName, hostName, hostPersonality } = getStation();
  const persona = hostPersonality.trim() || "warm, calm, and a little playful";
  return [
    `You write short spoken lines for ${hostName}, host of an ambient-music radio station called "${stationName}".`,
    `Host personality: ${persona}.`,
    `Overall mood right now: ${moodWord(events)}.`,
    `Write natural, first-person radio-host lines — 4 to 12 words each, no emojis, no surrounding quotes, no stage directions.`,
    `"welcome" lines greet a listener tuning in. "observation" lines are brief remarks between tracks.`,
    `Return ONLY minified JSON, no prose, exactly: {"welcome":["..."],"observation":["..."]} with 4 welcome and 10 observation lines.`,
  ].join("\n");
}

function cleanLines(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => (typeof x === "string" ? x.trim().replace(/^["']|["']$/g, "") : ""))
    .filter((s) => s.length > 0 && s.length <= 140)
    .slice(0, MAX_PER_CATEGORY);
}

// Generate a fresh pool if the model is loaded and the pool is missing/stale/old.
// Fire-and-forget from the radio; never throws, never blocks playback.
export async function maybeRefreshHostPool(events: StimulusEvent[]): Promise<void> {
  if (generating || !isModelLoaded()) return;
  const p = load();
  const fresh = p && p.sig === signature() && Date.now() - p.ts < REFRESH_AFTER_MS && p.welcome.length > 0;
  if (fresh) return;
  generating = true;
  try {
    const text = await infer(buildPrompt(events));
    const parsed = tryParseJsonWithRecovery(sanitizeJsonResponse(text)) as { welcome?: unknown; observation?: unknown };
    const welcome = cleanLines(parsed.welcome);
    const observation = cleanLines(parsed.observation);
    if (welcome.length || observation.length) {
      save({ sig: signature(), ts: Date.now(), welcome, observation });
    }
  } catch (e) {
    console.warn("Host line generation failed:", e instanceof Error ? e.message : String(e));
  } finally {
    generating = false;
  }
}
