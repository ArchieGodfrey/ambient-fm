import type { SessionSummary } from "../memory/types";

type SessionHistoryProps = {
  sessions: SessionSummary[];
};

export default function SessionHistory({ sessions }: SessionHistoryProps) {
  return (
    <section style={{ marginTop: 24 }}>
      <h2>Session History</h2>
      {sessions.length === 0 ? (
        <p>No session memory available yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {sessions.map((session) => (
            <div
              key={session.id}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: 12,
                background: "var(--surface-strong)",
                display: "grid",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 700 }}>{session.dominantMood}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {new Date(session.timestamp).toLocaleString()}
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 13 }}>
                <div>BPM: {session.avgBpm ?? 0}</div>
                <div>Energy: {session.avgEnergy != null ? session.avgEnergy.toFixed(2) : "N/A"}</div>
                <div>Key: {session.key ?? "Unknown"}</div>
                <div>Motifs: {session.motifCount ?? 0}</div>
                <div>Dominant motif: {session.dominantMotifLayer ?? "none"}</div>
                <div>Dominant phrase: {session.dominantPhraseType ?? "none"}</div>
                <div>Transitions: {session.phraseTransitionFrequency != null ? session.phraseTransitionFrequency.toFixed(2) : "0.00"}</div>
              </div>
              <div style={{ fontSize: 13, color: "var(--text)" }}>
                Layers: drone {session.layerProfile?.drone?.toFixed(2) ?? "0.00"}, pad {session.layerProfile?.pad?.toFixed(2) ?? "0.00"}, texture {session.layerProfile?.texture?.toFixed(2) ?? "0.00"}, pulse {session.layerProfile?.pulse?.toFixed(2) ?? "0.00"}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
