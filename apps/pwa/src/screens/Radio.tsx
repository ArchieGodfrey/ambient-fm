import { useMemo, useState } from "react";
import { Radio as RadioIcon, Mic, Square, Sparkles, Send } from "lucide-react";
import { useSession } from "../session/SessionProvider";
import useCapture from "../hooks/useCapture";
import useSounds from "../hooks/useSounds";
import usePreference from "../hooks/usePreference";
import { useAppStore } from "../store/useAppStore";
import { unlockAudio } from "../audio/toneEngine";
import { unlockVoice, maybeAutoLoadVoice } from "../audio/host";
import { unlockRenderedPlayer } from "../audio/renderedPlayer";
import { unlockBedPlayer } from "../audio/bedPlayer";
import { buildRadioBubbles, type LeanTarget } from "../themes/presets";
import { screen, screenEyebrow, screenTitle, mutedNote } from "../ui/styles";

const FRESH_CAPTURE_MS = 15 * 60 * 1000;
const ORBIT = 300; // px — the square the bubbles orbit within
const RADIUS = 120;

// The station front door. A central tap-to-tune control with mood/sound "bubbles"
// orbiting it — seed genres, your saved Sounds, and time-of-day suggestions — so
// exploring what plays next is one tap and the page never needs to scroll.
export default function Radio() {
  const { radio, startRadio, displayStatus, model } = useSession();
  const { recording, start, stop } = useCapture();
  const { sounds } = useSounds();
  const { preference, yourSound } = usePreference();
  const events = useAppStore((s) => s.events);
  const leanIn = useAppStore((s) => s.leanIn);
  const setLeanIn = useAppStore((s) => s.setLeanIn);
  const [preparing, setPreparing] = useState(false);
  const [request, setRequest] = useState("");

  const sendRequest = () => {
    const t = request.trim();
    if (!t) return;
    radio.writeIn(t);
    setRequest("");
  };

  const on = radio.isOn;
  const needsDownload = !model.modelDownloaded && !model.modelLoaded;
  const busy = preparing || radio.state === "generating";
  const isError = /fail|error|not available|unavailable/i.test(displayStatus ?? "");

  const bubbles = useMemo(
    () => buildRadioBubbles({ sounds, yourSound, confidence: preference.confidence, hour: new Date().getHours() }),
    [sounds, yourSound, preference.confidence],
  );

  const captures = useMemo(
    () => events.filter((e) => e.source === "audio" && Date.now() - e.timestamp < FRESH_CAPTURE_MS),
    [events],
  );

  const tuneIn = async () => {
    // Within the tap: unlockAudio() (Tone.start) unlocks Web Audio for the DJ voice,
    // and unlockRenderedPlayer() unlocks the media element that plays the rendered
    // tracks — otherwise iOS blocks its play() ~15s later once a track has rendered.
    unlockAudio(); unlockVoice(); maybeAutoLoadVoice();
    unlockRenderedPlayer();
    unlockBedPlayer();
    setPreparing(true);
    try { await startRadio(); } finally { setPreparing(false); }
  };
  const toggleTune = () => { if (on) radio.tuneOut(); else if (!busy) void tuneIn(); };
  const pickBubble = (t: LeanTarget) => setLeanIn(leanIn?.id === t.id ? null : t);

  const ringR = 62;
  const ringC = 2 * Math.PI * ringR;
  const prog = model.modelProgress ?? 0;
  const determinate = prog > 0.001;

  return (
    <div style={screen} className="afm-rise">
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={screenEyebrow}>Radio</span>
        <h1 style={screenTitle}>Your station</h1>
        <p style={{ ...mutedNote, fontSize: 13 }}>Tap to tune in. Lean into a mood, a sound you made, or a suggestion — it stays until you clear it.</p>
      </div>

      {/* Orbit: central tune control + bubbles */}
      <div style={{ position: "relative", width: "100%", maxWidth: ORBIT, height: ORBIT, margin: "6px auto 0" }}>
        {/* Central tune in/out button */}
        <button
          type="button"
          onClick={toggleTune}
          aria-label={on ? "Tune out" : "Tune in"}
          className={on && !busy ? "afm-onair" : undefined}
          style={{
            position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)",
            width: 108, height: 108, borderRadius: "50%", cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
            border: "2px solid " + (on || busy ? "var(--accent)" : "var(--border)"),
            background: on ? "var(--accent-soft)" : "var(--surface)",
            color: on || busy ? "var(--accent)" : "var(--text-muted)", transition: "all 0.3s ease",
          }}
        >
          <RadioIcon size={38} strokeWidth={1.7} />
          <span style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700 }}>
            {on ? "Tune out" : needsDownload ? "Get started" : "Tune in"}
          </span>
        </button>
        {busy ? (
          // Wrapper does the centering (translate); the inner SVG does the spin
          // (rotate) — so the spin animation can't clobber the centering transform.
          <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 132, height: 132, pointerEvents: "none" }}>
            <svg width={132} height={132} viewBox="0 0 132 132" className={determinate ? undefined : "afm-spin"} style={{ display: "block" }}>
              <circle cx="66" cy="66" r={ringR} fill="none" stroke="var(--border)" strokeWidth="3" />
              <circle cx="66" cy="66" r={ringR} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round"
                strokeDasharray={ringC} strokeDashoffset={determinate ? ringC * (1 - prog) : ringC * 0.72}
                transform="rotate(-90 66 66)" style={{ transition: determinate ? "stroke-dashoffset 0.3s ease" : undefined }} />
            </svg>
          </div>
        ) : null}

        {/* Bubbles */}
        {bubbles.map((b, i) => {
          const ang = (-90 + i * (360 / bubbles.length)) * (Math.PI / 180);
          const x = ORBIT / 2 + Math.cos(ang) * RADIUS;
          const y = ORBIT / 2 + Math.sin(ang) * RADIUS;
          const active = leanIn?.id === b.target.id;
          return (
            <button
              key={b.target.id}
              type="button"
              onClick={() => pickBubble(b.target)}
              title={b.target.name}
              style={{
                position: "absolute", left: x, top: y, transform: "translate(-50%,-50%)",
                display: "inline-flex", alignItems: "center", gap: 5, maxWidth: 104,
                padding: "6px 10px", borderRadius: "var(--radius-pill)", cursor: "pointer",
                fontSize: 11.5, fontWeight: 600, boxShadow: "var(--shadow-soft)",
                border: "1px solid " + (active ? "var(--accent-border)" : "var(--border)"),
                background: active ? "var(--accent-soft)" : "var(--surface)",
                color: active ? "var(--accent)" : "var(--text-muted)", transition: "all 0.15s ease",
              }}
            >
              {b.kind === "suggested"
                ? <Sparkles size={11} style={{ flexShrink: 0, color: `hsl(${b.target.hue} 62% 62%)` }} />
                : <span style={{ width: 8, height: 8, borderRadius: "50%", background: `hsl(${b.target.hue} 62% 62%)`, flexShrink: 0 }} />}
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.target.name}</span>
            </button>
          );
        })}
      </div>

      {/* The host's spoken line (the track title/status live in the now-playing bar). */}
      <div style={{ textAlign: "center", minHeight: 44 }}>
        {radio.hostText ? (
          <p style={{ fontSize: 14, color: "var(--text-h)", maxWidth: 320, marginInline: "auto", lineHeight: 1.45, fontStyle: "italic" }}>“{radio.hostText}”</p>
        ) : leanIn ? (
          <p style={{ ...mutedNote, fontSize: 12.5 }}>
            Leaning into <b style={{ color: "var(--text-h)" }}>{leanIn.name}</b> ·{" "}
            <button type="button" onClick={() => setLeanIn(null)} style={{ border: "none", background: "none", color: "var(--accent)", fontWeight: 600, cursor: "pointer", padding: 0, fontSize: 12.5 }}>clear</button>
          </p>
        ) : null}
      </div>

      {needsDownload && !on && !busy ? (
        <p style={{ ...mutedNote, fontSize: 12, textAlign: "center", maxWidth: 320, marginInline: "auto" }}>
          First tune-in downloads the composer + voice (one time). The music eases in when it's ready.
        </p>
      ) : null}
      {!radio.voiceAudible ? (
        <p style={{ ...mutedNote, fontSize: 11.5, textAlign: "center" }}>Download the DJ voice in Settings to hear the host — captions show either way.</p>
      ) : null}
      {displayStatus && isError ? (
        <p style={{ textAlign: "center", fontSize: 13, color: "#c2506f", maxWidth: 320, marginInline: "auto" }}>{displayStatus}</p>
      ) : null}

      {/* Capture — what the room is feeding the station */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginTop: "auto" }}>
        {captures.length ? (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: "var(--radius-pill)", background: "var(--accent-soft)", color: "var(--accent)", fontSize: 12, fontWeight: 600 }}>
            <Mic size={13} />
            {captures.length} capture{captures.length > 1 ? "s" : ""} · {leanIn ? "paused while leaning in" : "shaping the next track"}
          </div>
        ) : null}
        <button type="button" onClick={() => (recording ? stop() : void start())}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: "var(--radius-pill)", cursor: "pointer", fontSize: 13, fontWeight: 500,
            border: "1px solid " + (recording ? "#c2506f" : "var(--border)"),
            background: recording ? "#c2506f" : "var(--surface)", color: recording ? "#fff" : "var(--text-muted)",
          }}>
          {recording ? <Square size={14} /> : <Mic size={14} />}
          {recording ? "Listening… tap to stop" : "Capture the room"}
        </button>

        {/* Write in — send the host a request; they read it out and spin one for you */}
        {on ? (
          <form onSubmit={(e) => { e.preventDefault(); sendRequest(); }} style={{ display: "flex", gap: 8, width: "100%", maxWidth: 360, marginTop: 2 }}>
            <input
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              placeholder="Write in a request for the host…"
              maxLength={120}
              // 16px: iOS Safari auto-zooms the page when focusing an input under 16px.
              style={{ flex: 1, minWidth: 0, padding: "8px 14px", borderRadius: "var(--radius-pill)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-h)", fontSize: 16, fontFamily: "inherit" }}
            />
            <button type="submit" aria-label="Send request" disabled={!request.trim() || busy}
              style={{ ...reactBtn, width: 40, height: 40, opacity: (!request.trim() || busy) ? 0.4 : 1, cursor: (!request.trim() || busy) ? "default" : "pointer" }}>
              <Send size={15} />
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

const reactBtn = { border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-muted)", borderRadius: "50%", width: 44, height: 44, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s ease" } as const;
