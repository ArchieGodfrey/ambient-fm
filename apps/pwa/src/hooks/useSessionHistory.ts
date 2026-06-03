import { useEffect, useState } from "react";
import { getSessionHistory, deleteSessionSummary } from "../memory/getMemoryContext";
import { db } from "../db/db";
import { getSingingParams } from "../audio/vocal/musicTheory";
import { useAppStore } from "../store/useAppStore";
import { stopAudio } from "../audio/toneEngine";
import { stopRuntimeLoop } from "../audio/compositionRuntime";
import { stopComposer } from "../composer/runtime";
import type { SessionSummary } from "../memory/types";
import { postToast } from "../utils/toast";

export default function useSessionHistory() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);

  async function loadSessions() {
    try {
      const history = await getSessionHistory();
      setSessions(history);
      return history;
    } catch (error) {
      console.error("Failed to load session history", error);
      const message = error instanceof Error ? error.message : String(error);
      postToast(`Failed to load session history: ${message}`, "error");
    }
  }

  async function deleteSession(id: string) {
    try {
      await deleteSessionSummary(id);
      // Fetch session first — we need it for both plan matching and vocalAudio cleanup
      const session = await db.sessions.get(id);
      const state = useAppStore.getState();

      // Match by explicit session ID OR by plan seed (handles loadStaticPlan which
      // doesn't set currentSessionId, e.g. the plan loaded on app init)
      const isCurrentSession =
        state.currentSessionId === id ||
        (session?.plan?.seed !== undefined && state.currentPlan?.seed === session.plan.seed);

      if (isCurrentSession) {
        stopAudio();
        stopRuntimeLoop();
        stopComposer();
        state.setCurrentPlan(null);
        state.setCurrentSessionId(null);
      }

      // Clean up vocalAudio cache entries for this session's lyric lines
      try {
        const plan = session?.plan;
        if (plan?.vocalVoice && plan.sections) {
          const keysToDelete = plan.sections
            .filter(s => s.lyricLine)
            .map(s => {
              const rootHz = Math.round(getSingingParams(plan, s).rootHz);
              return `${plan.vocalVoice}:${rootHz}hz:${s.lyricLine}`;
            });
          if (keysToDelete.length) await db.vocalAudio.bulkDelete(keysToDelete);
        }
      } catch { /* non-critical cleanup */ }
      const remaining = await loadSessions();
      // If no sessions remain, clear loaded plan AND the entire vocal audio cache
      if (!remaining || remaining.length === 0) {
        const st = useAppStore.getState();
        st.setCurrentPlan(null);
        st.setCurrentSessionId(null);
        try { await db.vocalAudio.clear(); } catch { /* non-critical */ }
      }

    } catch (error) {
      console.error("Failed to delete session", error);
      const message = error instanceof Error ? error.message : String(error);
      postToast(`Delete failed: ${message}`, "error");
    }
  }

  useEffect(() => {
    loadSessions();

    const handleSessionSaved = () => {
      loadSessions();
    };

    window.addEventListener("session-saved", handleSessionSaved);
    return () => {
      window.removeEventListener("session-saved", handleSessionSaved);
    };
  }, []);

  return { sessions, loadSessions, deleteSession };
}
