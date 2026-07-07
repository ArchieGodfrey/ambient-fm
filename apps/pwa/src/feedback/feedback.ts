import { db } from "../db/db";
import { SIGNAL_WEIGHTS, EXPLICIT, type Feedback, type FeedbackSignal } from "./types";

const CHANGED = "feedback-changed";
const emit = () => { if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGED)); };
export const FEEDBACK_CHANGED = CHANGED;

export type TrackRef = { sessionId: string; mood?: string; key?: string; bpm?: number };

// Record a feedback signal about a track. Explicit opinions (like/dislike) are
// unique per track — a new one replaces the old (so ❤ then ✕ flips it). Implicit
// signals dedupe within a short window to avoid double-fires.
export async function recordFeedback(signal: FeedbackSignal, track: TrackRef): Promise<void> {
  if (!track.sessionId) return;
  try {
    if (EXPLICIT.includes(signal)) {
      // Append-only history so opinions are durably stored (undoable later). Skip
      // only if it's already your current opinion. Weighting uses latest-per-track
      // (see effectiveFeedback), so extra history rows don't inflate scores.
      const prior = await db.feedback.where("sessionId").equals(track.sessionId).toArray();
      const latestExplicit = prior.filter((f) => EXPLICIT.includes(f.signal)).sort((a, b) => b.ts - a.ts)[0];
      if (latestExplicit?.signal === signal) return;
    } else {
      // Dedupe the same implicit signal for the same track within 4s.
      const recent = await db.feedback
        .where("sessionId").equals(track.sessionId)
        .and((f) => f.signal === signal && Date.now() - f.ts < 4000)
        .count();
      if (recent > 0) return;
    }
    const entry: Feedback = {
      id: crypto.randomUUID(),
      ts: Date.now(),
      sessionId: track.sessionId,
      signal,
      weight: SIGNAL_WEIGHTS[signal],
      mood: track.mood,
      key: track.key,
      bpm: track.bpm,
    };
    await db.feedback.add(entry);
    emit();
  } catch (e) {
    console.warn("Failed to record feedback", e);
  }
}

export async function getFeedback(): Promise<Feedback[]> {
  try { return await db.feedback.orderBy("ts").reverse().toArray(); } catch { return []; }
}

// The current explicit opinion for a track (latest wins), if any.
export function explicitFor(feedback: Feedback[], sessionId?: string): FeedbackSignal | null {
  if (!sessionId) return null;
  const rows = feedback.filter((x) => x.sessionId === sessionId && EXPLICIT.includes(x.signal)).sort((a, b) => b.ts - a.ts);
  return rows[0]?.signal ?? null;
}

// Collapse append-only history to what should COUNT: all implicit signals, plus
// only the latest explicit opinion per track (so re-taps/switches don't inflate).
export function effectiveFeedback(feedback: Feedback[]): Feedback[] {
  const latestExplicit = new Map<string, Feedback>();
  const out: Feedback[] = [];
  for (const f of feedback) {
    if (EXPLICIT.includes(f.signal)) {
      const cur = latestExplicit.get(f.sessionId);
      if (!cur || f.ts > cur.ts) latestExplicit.set(f.sessionId, f);
    } else {
      out.push(f);
    }
  }
  return [...out, ...latestExplicit.values()];
}

export type FeedbackSummary = {
  total: number;
  liked: number;
  disliked: number;
  topMoods: { label: string; score: number }[];
  topKeys: { label: string; score: number }[];
};

// A simple "what you like" rollup: net weighted score per mood / key.
export function summarize(all: Feedback[]): FeedbackSummary {
  const feedback = effectiveFeedback(all);
  const moods = new Map<string, number>();
  const keys = new Map<string, number>();
  let liked = 0;
  let disliked = 0;
  for (const f of feedback) {
    if (f.signal === "like") liked += 1;
    if (f.signal === "dislike" || f.signal === "delete") disliked += 1;
    if (f.mood) moods.set(f.mood, (moods.get(f.mood) ?? 0) + f.weight);
    if (f.key) keys.set(f.key, (keys.get(f.key) ?? 0) + f.weight);
  }
  const rank = (m: Map<string, number>) =>
    [...m.entries()].map(([label, score]) => ({ label, score })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
  return { total: feedback.length, liked, disliked, topMoods: rank(moods), topKeys: rank(keys) };
}
