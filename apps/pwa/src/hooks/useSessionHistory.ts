import { useEffect, useState } from "react";
import { getSessionHistory, deleteSessionSummary } from "../memory/getMemoryContext";
import type { SessionSummary } from "../memory/types";

export default function useSessionHistory() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);

  async function loadSessions() {
    try {
      const history = await getSessionHistory();
      setSessions(history);
    } catch (error) {
      console.error("Failed to load session history", error);
    }
  }

  async function deleteSession(id: string) {
    try {
      await deleteSessionSummary(id);
      await loadSessions();
      // Notify other useSessionHistory instances (Today tracklist, eject-on-empty).
      window.dispatchEvent(new Event("session-saved"));
    } catch (error) {
      console.error("Failed to delete session", error);
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
