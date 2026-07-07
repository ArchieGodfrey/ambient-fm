import { Mic, Square, Trash2 } from "lucide-react";
import useCapture from "../hooks/useCapture";
import { screen, screenEyebrow, screenTitle, card, mutedNote } from "../ui/styles";

function secs(ms: number) { return `${Math.max(1, Math.round(ms / 1000))}s`; }

export default function Capture() {
  const { recording, recordings, error, start, stop, remove } = useCapture();

  return (
    <div style={screen} className="afm-rise">
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={screenEyebrow}>Capture</span>
        <h1 style={screenTitle}>Capture a moment</h1>
        <p style={mutedNote}>Record the sound of where you are — your commute, the rain, a room. It colours your next composition.</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "16px 0" }}>
        <button
          type="button"
          onClick={() => (recording ? stop() : void start())}
          aria-label={recording ? "Stop recording" : "Start recording"}
          style={{
            width: 96, height: 96, borderRadius: "50%", cursor: "pointer",
            border: "1px solid " + (recording ? "#c2506f" : "var(--accent-border)"),
            background: recording ? "#c2506f" : "var(--accent-soft)",
            color: recording ? "#fff" : "var(--accent)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            animation: recording ? "afm-breathe 1.6s ease-in-out infinite" : undefined,
          }}
        >
          {recording ? <Square size={30} /> : <Mic size={34} />}
        </button>
        <span style={mutedNote}>{recording ? "Listening… tap to stop" : "Tap to capture"}</span>
        {error ? <span style={{ fontSize: 13, color: "#c2506f" }}>{error}</span> : null}
      </div>

      {recordings.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {recordings.map((r) => (
            <div key={r.id} style={{ ...card, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-h)" }}>{r.label}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{secs(r.durationMs)} · energy {Math.round(r.features.energy * 100)}% · brightness {Math.round(r.features.brightness * 100)}%</div>
                </div>
                <button type="button" onClick={() => void remove(r.id)} aria-label="Delete" style={{ border: "none", background: "transparent", color: "var(--text-faint)", cursor: "pointer", padding: 4 }}><Trash2 size={16} /></button>
              </div>
              <audio controls preload="none" src={URL.createObjectURL(r.blob)} style={{ width: "100%", height: 34 }} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
