import { Radio as RadioIcon, Square, Mic, Check, Play } from "lucide-react";
import { useSession } from "../session/SessionProvider";
import useSounds from "../hooks/useSounds";
import useCapture from "../hooks/useCapture";
import { screen, screenEyebrow, screenTitle, mutedNote } from "../ui/styles";

// The station front door. Tune in → the composer runs an ongoing set, the DJ
// host bridging each track change. The disc + tracklist live one tap deeper in
// the expanded now-playing view (tap the bottom bar).
export default function Radio() {
  const { radio, startRadio, displayStatus } = useSession();
  const { sounds, activeSound, setActiveSound } = useSounds();
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
      </div>

      {/* Which sound the station composes from */}
      {sounds.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ ...mutedNote, fontSize: 12 }}>Building from your sound</span>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
            {sounds.map((s) => {
              const sel = s.id === activeSound?.id;
              return (
                <button key={s.id} type="button" onClick={() => setActiveSound(s.id)}
                  style={{
                    flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "7px 13px", borderRadius: "var(--radius-pill)", cursor: "pointer", fontSize: 13, fontWeight: 600,
                    border: "1px solid " + (sel ? "var(--accent)" : "var(--border)"),
                    background: sel ? "var(--accent)" : "var(--surface)", color: sel ? "#fff" : "var(--text-muted)",
                  }}>
                  {sel ? <Check size={13} /> : null}{s.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* On-air indicator + tune-in control */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, padding: "26px 0 10px" }}>
        <div
          className={on ? "afm-onair" : undefined}
          style={{
            width: 132, height: 132, borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid " + (on ? "var(--accent)" : "var(--border)"),
            background: on ? "var(--accent-soft)" : "var(--surface)",
            color: on ? "var(--accent)" : "var(--text-muted)",
            transition: "all 0.3s ease",
          }}
        >
          <RadioIcon size={54} strokeWidth={1.6} />
        </div>

        <div style={{ textAlign: "center", minHeight: 46 }}>
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

        <button
          type="button"
          onClick={() => (on ? radio.tuneOut() : void startRadio())}
          disabled={busy}
          style={{
            display: "inline-flex", alignItems: "center", gap: 9,
            padding: "13px 26px", borderRadius: "var(--radius-pill)", cursor: busy ? "default" : "pointer",
            border: "none", fontSize: 15, fontWeight: 700,
            background: on ? "var(--surface)" : "var(--accent)",
            color: on ? "var(--text)" : "#fff",
            boxShadow: on ? "none" : "var(--shadow)",
            outline: on ? "1px solid var(--border)" : "none",
            opacity: busy ? 0.7 : 1,
          }}
        >
          {on ? <Square size={17} /> : <Play size={17} />}
          {on ? "Stop the station" : busy ? "Tuning in…" : "Tune in"}
        </button>

        {!radio.ttsAvailable ? (
          <p style={{ ...mutedNote, fontSize: 11.5, textAlign: "center" }}>
            Voice host unavailable on this device — captions still show between tracks.
          </p>
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
        <p style={{ ...mutedNote, textAlign: "center", fontSize: 12 }}>Captured moments colour what the station composes next.</p>
      </div>
    </div>
  );
}
