import { Radio as RadioIcon, Power, Mic, Square, Play } from "lucide-react";
import { useSession } from "../session/SessionProvider";
import useCapture from "../hooks/useCapture";
import { screen, screenEyebrow, screenTitle, mutedNote } from "../ui/styles";

// The station front door. Tune in → the composer runs an ongoing set, the DJ
// host bridging each change and choosing what to compose from (a fresh capture,
// else a random saved Sound). Bespoke/manual generation lives in the Studio now.
// The disc + tracklist are one tap deeper, in the expanded now-playing view.
export default function Radio() {
  const { radio, startRadio, displayStatus } = useSession();
  const { recording, start, stop } = useCapture();

  const on = radio.isOn;
  const busy = radio.state === "generating";
  const isError = /fail|error|not available|unavailable/i.test(displayStatus ?? "");

  const statusLine =
    radio.state === "generating" ? "composing the next track…"
    : radio.state === "announcing" ? "on air"
    : radio.state === "playing" ? "on air — now playing"
    : "off air";

  return (
    <div style={screen} className="afm-rise">
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={screenEyebrow}>Radio</span>
        <h1 style={screenTitle}>Your station</h1>
        <p style={mutedNote}>Tune in for an endless set. The DJ picks from your sounds — or the room around you, when you're capturing.</p>
      </div>

      {/* On-air indicator + tune-in control */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, padding: "40px 0 10px" }}>
        <div
          className={on ? "afm-onair" : undefined}
          style={{
            width: 136, height: 136, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid " + (on ? "var(--accent)" : "var(--border)"),
            background: on ? "var(--accent-soft)" : "var(--surface)",
            color: on ? "var(--accent)" : "var(--text-muted)",
            transition: "all 0.3s ease",
          }}
        >
          <RadioIcon size={56} strokeWidth={1.6} />
        </div>

        <div style={{ textAlign: "center", minHeight: 56 }}>
          <div style={{ fontSize: 13, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700, color: on ? "var(--accent)" : "var(--text-faint)" }}>
            {statusLine}
          </div>
          {radio.hostText ? (
            <p style={{ fontSize: 14, color: "var(--text-h)", marginTop: 6, maxWidth: 320, lineHeight: 1.45, fontStyle: "italic" }}>
              “{radio.hostText}”
            </p>
          ) : radio.nowPlaying ? (
            <p style={{ fontSize: 15, color: "var(--text-h)", marginTop: 6, fontWeight: 600 }}>
              {radio.nowPlaying.title} <span style={{ color: "var(--text-muted)", fontWeight: 500, textTransform: "capitalize" }}>· {radio.nowPlaying.mood}</span>
            </p>
          ) : null}
        </div>

        {on ? (
          <button
            type="button"
            onClick={() => radio.tuneOut()}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "11px 22px", borderRadius: "var(--radius-pill)", cursor: "pointer",
              border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)",
              fontSize: 14, fontWeight: 600,
            }}
          >
            <Power size={15} />
            Tune out
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void startRadio()}
            disabled={busy}
            style={{
              display: "inline-flex", alignItems: "center", gap: 9,
              padding: "14px 30px", borderRadius: "var(--radius-pill)", cursor: busy ? "default" : "pointer",
              border: "none", background: "var(--accent)", color: "#fff",
              fontSize: 15, fontWeight: 700, boxShadow: "var(--shadow)", opacity: busy ? 0.7 : 1,
            }}
          >
            <Play size={17} />
            {busy ? "Tuning in…" : "Tune in"}
          </button>
        )}

        {!radio.ttsAvailable ? (
          <p style={{ ...mutedNote, fontSize: 11.5, textAlign: "center" }}>Voice host unavailable here — captions still show between tracks.</p>
        ) : null}
        {displayStatus && isError ? (
          <p style={{ textAlign: "center", fontSize: 13, color: "#c2506f", maxWidth: 320 }}>{displayStatus}</p>
        ) : null}
      </div>

      {/* Passive capture — colours what the station composes next */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginTop: "auto" }}>
        <button type="button" onClick={() => (recording ? stop() : void start())}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: "var(--radius-pill)", cursor: "pointer", fontSize: 13, fontWeight: 500,
            border: "1px solid " + (recording ? "#c2506f" : "var(--border)"),
            background: recording ? "#c2506f" : "var(--surface)", color: recording ? "#fff" : "var(--text-muted)",
          }}>
          {recording ? <Square size={14} /> : <Mic size={14} />}
          {recording ? "Listening… tap to stop" : "Capture the room"}
        </button>
        <p style={{ ...mutedNote, textAlign: "center", fontSize: 12 }}>When you capture, the next track is composed from that moment.</p>
      </div>
    </div>
  );
}
