import { Play, Trash2 } from "lucide-react";
import useSessionHistory from "../hooks/useSessionHistory";
import { useSession } from "../session/SessionProvider";
import { screen, screenEyebrow, screenTitle, card, mutedNote } from "../ui/styles";

function relativeTime(ts: number) {
  const diff = Date.now() - ts;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

export default function Journey() {
  const { sessions, deleteSession } = useSessionHistory();
  const { audio } = useSession();

  return (
    <div style={screen} className="afm-rise">
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={screenEyebrow}>Your journey</span>
        <h1 style={screenTitle}>Sound memories</h1>
      </div>

      {sessions.length === 0 ? (
        <div style={{ ...card, textAlign: "center", padding: "40px 18px" }}>
          <p style={mutedNote}>No memories yet. Compose a sound and it will live here — a diary of your days, in music.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sessions.map((session) => (
            <div key={session.id} style={{ ...card, display: "flex", alignItems: "center", gap: 14 }}>
              <button
                type="button"
                disabled={!session.plan}
                onClick={() => session.plan && void audio.loadSessionPlan(session.plan)}
                aria-label="Play memory"
                style={{
                  flexShrink: 0, width: 44, height: 44, borderRadius: "50%",
                  border: "1px solid var(--accent-border)", background: "var(--accent-soft)",
                  color: "var(--accent)", cursor: session.plan ? "pointer" : "not-allowed",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <Play size={16} />
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-h)", textTransform: "capitalize" }}>
                  {session.dominantMood}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  {session.key} · {Math.round(session.avgBpm)} bpm · {relativeTime(session.timestamp)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void deleteSession(session.id)}
                aria-label="Delete memory"
                style={{ border: "none", background: "transparent", color: "var(--text-faint)", cursor: "pointer", padding: 6 }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
