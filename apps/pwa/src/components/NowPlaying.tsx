import { useRef, useState } from "react";
import { ChevronDown, Pause, Play, Lock, Heart, X } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { useSession } from "../session/SessionProvider";
import useSessionHistory from "../hooks/useSessionHistory";
import useFeedback from "../hooks/useFeedback";
import { recordFeedback } from "../feedback/feedback";
import Disc from "./Disc";

function isToday(ts: number) {
  const d = new Date(ts);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}
const clock = (ts: number) => new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

// Full-screen "now playing" that expands from the transport bar. One big disc,
// the day's tracklist as a plain text list, and (when the radio is on) the DJ
// host caption. A lock mode dims the screen and freezes animation.
export default function NowPlaying({ onClose }: { onClose: () => void }) {
  const plan = useAppStore((s) => s.currentPlan);
  const title = useAppStore((s) => s.currentTitle);
  const sessionId = useAppStore((s) => s.currentSessionId);
  const isPlaying = useAppStore((s) => s.isPlaying);
  const playToggle = useAppStore((s) => s.playToggle);
  const { audio, radio } = useSession();
  const { sessions } = useSessionHistory();
  const { opinionFor } = useFeedback();
  const opinion = opinionFor(sessionId ?? undefined);
  const trackRef = () => ({ sessionId: sessionId ?? "", mood: plan?.globalMood, key: plan?.key, bpm: plan?.bpm });
  const [locked, setLocked] = useState(false);
  const holdTimer = useRef<number | null>(null);
  const lastTap = useRef(0);

  const tracksToday = sessions.filter((s) => isToday(s.timestamp)).sort((a, b) => a.timestamp - b.timestamp);
  const heading = title ?? plan?.key ?? "Tray empty";
  const sub = plan ? `${plan.globalMood} · ${plan.key} · ${plan.bpm} bpm` : "Tune in to start the station";

  function guardTap() {
    const now = Date.now();
    if (now - lastTap.current < 350) { setLocked(false); lastTap.current = 0; } else { lastTap.current = now; }
  }
  const holdStart = () => { holdTimer.current = window.setTimeout(() => setLocked(false), 600); };
  const holdEnd = () => { if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; } };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", overflowY: "auto" }} className="afm-rise">
      <div style={{ width: "100%", maxWidth: 520, padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <button type="button" onClick={onClose} aria-label="Collapse" style={roundBtn}><ChevronDown size={20} /></button>
        <span style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase", color: "var(--text-faint)", fontWeight: 600 }}>{radio.isOn ? "On air" : "Now playing"}</span>
        <button type="button" onClick={() => setLocked(true)} aria-label="Lock" style={roundBtn}><Lock size={18} /></button>
      </div>

      <div style={{ width: "100%", maxWidth: 520, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 22, padding: "10px 24px 20px" }}>
        <Disc size={248} spinning={isPlaying && !locked} mood={plan?.globalMood} inserting={false} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-h)", letterSpacing: -0.5 }}>{heading}</div>
          <div style={{ fontSize: 13.5, color: "var(--text-muted)", marginTop: 4, textTransform: "capitalize" }}>{sub}</div>
        </div>

        {/* Like / dislike — shapes what the station leans toward over time */}
        {sessionId ? (
          <div style={{ display: "flex", gap: 12 }}>
            <button type="button" aria-label="Like" onClick={() => recordFeedback("like", trackRef())}
              style={{ ...reactBtn, ...(opinion === "like" ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" } : {}) }}>
              <Heart size={18} fill={opinion === "like" ? "#fff" : "none"} />
            </button>
            <button type="button" aria-label="Not for me" onClick={() => recordFeedback("dislike", trackRef())}
              style={{ ...reactBtn, ...(opinion === "dislike" ? { background: "#c2506f", color: "#fff", borderColor: "#c2506f" } : {}) }}>
              <X size={18} />
            </button>
          </div>
        ) : null}

        {/* Host caption while the station bridges tracks */}
        {radio.isOn && radio.hostText ? (
          <p style={{ fontSize: 14, color: "var(--text)", maxWidth: 360, textAlign: "center", lineHeight: 1.5, fontStyle: "italic" }}>“{radio.hostText}”</p>
        ) : null}

        {/* Manual transport only when the station is off (the radio owns playback while on air) */}
        {!radio.isOn ? (
          <button type="button" onClick={() => playToggle?.()} disabled={!playToggle} aria-label={isPlaying ? "Stop" : "Play"}
            style={{ width: 62, height: 62, borderRadius: "50%", border: "none", background: "var(--accent)", color: "#fff", cursor: playToggle ? "pointer" : "not-allowed", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--shadow)" }}>
            {isPlaying ? <Pause size={25} /> : <Play size={25} />}
          </button>
        ) : null}
      </div>

      {/* Today's disc as a plain text tracklist — tap a row to play it */}
      {tracksToday.length > 0 ? (
        <div style={{ width: "100%", maxWidth: 520, padding: "0 20px 32px", display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "var(--text-faint)", fontWeight: 600, padding: "6px 8px" }}>
            Today's disc · {tracksToday.length} track{tracksToday.length > 1 ? "s" : ""}
          </span>
          {tracksToday.map((t, i) => {
            const loaded = plan?.seed != null && t.plan?.seed === plan.seed;
            return (
              <button key={t.id} type="button" disabled={!t.plan}
                onClick={() => { if (!t.plan) return; void audio.loadSessionPlan(t.plan, t.title, t.id); void recordFeedback("replay", { sessionId: t.id, mood: t.dominantMood, key: t.key, bpm: t.avgBpm }); }}
                style={{
                  display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
                  padding: "11px 8px", border: "none", borderRadius: 10, cursor: t.plan ? "pointer" : "default",
                  background: loaded ? "var(--accent-soft)" : "transparent", color: "var(--text)",
                }}>
                <span style={{ width: 20, fontSize: 12, color: "var(--text-faint)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{i + 1}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 600, color: loaded ? "var(--accent)" : "var(--text-h)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {t.title ?? `Track ${i + 1}`}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-muted)", flexShrink: 0, textTransform: "capitalize" }}>{t.dominantMood}</span>
                <span style={{ fontSize: 12, color: "var(--text-faint)", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{clock(t.timestamp)}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {locked ? (
        <div onClick={guardTap} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, touchAction: "none" }}>
          <Disc size={210} spinning={false} mood={plan?.globalMood} inserting={false} style={{ opacity: 0.45 }} />
          <div style={{ textAlign: "center", opacity: 0.6 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>{heading}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", textTransform: "capitalize" }}>{plan?.globalMood ?? ""}</div>
          </div>
          <button type="button" onClick={(e) => e.stopPropagation()} onPointerDown={holdStart} onPointerUp={holdEnd} onPointerLeave={holdEnd} onPointerCancel={holdEnd} aria-label="Hold to unlock"
            style={{ width: 56, height: 56, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.85)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <Lock size={20} />
          </button>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>Double-tap anywhere, or hold the lock, to unlock</span>
        </div>
      ) : null}
    </div>
  );
}

const roundBtn = { border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", borderRadius: "50%", width: 40, height: 40, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" } as const;
const reactBtn = { border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-muted)", borderRadius: "50%", width: 44, height: 44, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s ease" } as const;
