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
                border: "1px solid #ddd",
                borderRadius: 12,
                padding: 12,
                background: "#fafafa",
                display: "grid",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 700 }}>{session.dominantMood}</div>
                <div style={{ fontSize: 12, color: "#555" }}>
                  {new Date(session.timestamp).toLocaleString()}
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 13 }}>
                <div>BPM: {Math.round(session.avgBpm)}</div>
                <div>Energy: {session.avgEnergy.toFixed(2)}</div>
                <div>Key: {session.key}</div>
                <div>Motifs: {session.motifCount}</div>
                <div>Dominant motif: {session.dominantMotifLayer}</div>
              </div>
              <div style={{ fontSize: 13, color: "#333" }}>
                Layers: drone {session.layerProfile.drone.toFixed(2)}, pad {session.layerProfile.pad.toFixed(2)}, texture {session.layerProfile.texture.toFixed(2)}, pulse {session.layerProfile.pulse.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
