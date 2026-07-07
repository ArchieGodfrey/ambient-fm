import { useCallback, useEffect, useState } from "react";
import { getFeedback, summarize, explicitFor, recordFeedback, FEEDBACK_CHANGED, type TrackRef, type FeedbackSummary } from "../feedback/feedback";
import type { Feedback, FeedbackSignal } from "../feedback/types";

// Read + record feedback for the UI. Recording is a thin passthrough to the
// module fn (which persists + emits FEEDBACK_CHANGED so all instances refresh).
export default function useFeedback() {
  const [feedback, setFeedback] = useState<Feedback[]>([]);

  const load = useCallback(async () => setFeedback(await getFeedback()), []);

  useEffect(() => {
    void load();
    const h = () => void load();
    window.addEventListener(FEEDBACK_CHANGED, h);
    return () => window.removeEventListener(FEEDBACK_CHANGED, h);
  }, [load]);

  const record = useCallback((signal: FeedbackSignal, track: TrackRef) => recordFeedback(signal, track), []);
  const summary: FeedbackSummary = summarize(feedback);
  const opinionFor = useCallback((id?: string) => explicitFor(feedback, id), [feedback]);

  return { feedback, record, summary, opinionFor };
}
