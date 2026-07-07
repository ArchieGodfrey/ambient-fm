import type { MouseEvent } from "react";
import { Heart, X } from "lucide-react";
import { recordFeedback, type TrackRef } from "../feedback/feedback";
import type { FeedbackSignal } from "../feedback/types";

// Per-track like/dislike indicator + control. Presentational: the parent computes
// `opinion` (via useFeedback's opinionFor) so we don't spin up a hook per row.
// Recording emits FEEDBACK_CHANGED, which refreshes the parent.
export default function TrackFeedback({ track, opinion, size = 15 }: { track: TrackRef; opinion: FeedbackSignal | null; size?: number }) {
  const liked = opinion === "like";
  const disliked = opinion === "dislike";
  const tap = (e: MouseEvent, signal: FeedbackSignal) => { e.stopPropagation(); void recordFeedback(signal, track); };
  const base = { border: "none", background: "transparent", cursor: "pointer", padding: 4, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 } as const;

  return (
    <span style={{ display: "inline-flex", gap: 2 }}>
      <button type="button" aria-label="Like" onClick={(e) => tap(e, "like")} style={{ ...base, color: liked ? "var(--accent)" : "var(--text-faint)" }}>
        <Heart size={size} fill={liked ? "currentColor" : "none"} />
      </button>
      <button type="button" aria-label="Not for me" onClick={(e) => tap(e, "dislike")} style={{ ...base, color: disliked ? "#c2506f" : "var(--text-faint)" }}>
        <X size={size} />
      </button>
    </span>
  );
}
