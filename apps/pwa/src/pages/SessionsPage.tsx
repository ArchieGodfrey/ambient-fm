import { useEffect, useState } from "react";
import { getSessionHistory } from "../memory/getMemoryContext";
import type { SessionSummary } from "../memory/types";
import SessionHistory from "../components/SessionHistory";
import { postToast } from "../utils/toast";

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);

  async function loadSessions() {
    try {
      const history = await getSessionHistory();
      setSessions(history);
    } catch (error) {
      console.error("Failed to load session history", error);
      const message = error instanceof Error ? error.message : String(error);
      postToast(`Failed to load session history: ${message}`, "error");
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

  return (
    <div style={{ padding: 20, fontFamily: "system-ui, sans-serif", color: "#111", paddingBottom: 110 }}>
      <h1>Session Memory</h1>
      <p style={{ margin: "0 0 16px" }}>
        Browse the full history of past session fingerprints and how the system is remembering mood and audio shape.
      </p>
      <SessionHistory sessions={sessions} />
    </div>
  );
}
