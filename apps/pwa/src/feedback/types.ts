// Phase 6a — feedback signals. We capture explicit reactions (like/dislike) and
// implicit ones (played to the end, replayed, deleted) about tracks, so a later
// preference model (6b) can learn what you like. Each entry snapshots the
// track's key features so it stays useful even if the session is deleted.

export type FeedbackSignal =
  | "like"
  | "dislike"
  | "complete" // played to the end (radio advanced naturally)
  | "skip"     // tuned out / abandoned early
  | "replay"   // re-loaded a past track
  | "delete";  // removed from the library

export interface Feedback {
  id: string;
  ts: number;
  sessionId: string; // the track (SessionSummary id), or a plan-seed key as fallback
  signal: FeedbackSignal;
  weight: number;
  // Feature snapshot (so summaries survive session deletion):
  mood?: string;
  key?: string;
  bpm?: number;
}

// Signed weights — positive = liked, negative = disliked. Tuned later in 6b.
export const SIGNAL_WEIGHTS: Record<FeedbackSignal, number> = {
  like: 1,
  dislike: -1,
  complete: 0.4,
  skip: -0.4,
  replay: 0.6,
  delete: -0.8,
};

export const EXPLICIT: FeedbackSignal[] = ["like", "dislike"];
