import { useRef, useState } from "react";
import { ChevronDown, Pause, Play, Lock } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import Disc from "./Disc";

// Full-screen "now playing" that expands from the transport bar. A lock mode
// dims the screen and freezes all animation (battery), shows static content, and
// ignores gestures except a double-tap or press-and-hold on the lock to exit.
export default function NowPlaying({ onClose }: { onClose: () => void }) {
  const plan = useAppStore((s) => s.currentPlan);
  const isPlaying = useAppStore((s) => s.isPlaying);
  const playToggle = useAppStore((s) => s.playToggle);
  const [locked, setLocked] = useState(false);
  const holdTimer = useRef<number | null>(null);
  const lastTap = useRef(0);

  function guardTap() {
    const now = Date.now();
    if (now - lastTap.current < 350) { setLocked(false); lastTap.current = 0; } else { lastTap.current = now; }
  }
  const holdStart = () => { holdTimer.current = window.setTimeout(() => setLocked(false), 600); };
  const holdEnd = () => { if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; } };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center" }} className="afm-rise">
      <div style={{ width: "100%", maxWidth: 520, padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button type="button" onClick={onClose} aria-label="Collapse" style={roundBtn}><ChevronDown size={20} /></button>
        <span style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase", color: "var(--text-faint)", fontWeight: 600 }}>Now playing</span>
        <button type="button" onClick={() => setLocked(true)} aria-label="Lock" style={roundBtn}><Lock size={18} /></button>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 26, padding: 24 }}>
        <Disc size={260} spinning={isPlaying && !locked} mood={plan?.globalMood} inserting={false} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: "var(--text-h)", letterSpacing: -0.5 }}>{plan?.key ?? "Tray empty"}</div>
          <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4, textTransform: "capitalize" }}>{plan ? `${plan.globalMood} · ${plan.bpm} bpm` : "Burn a track to load a disc"}</div>
        </div>
        <button type="button" onClick={() => playToggle?.()} disabled={!playToggle} aria-label={isPlaying ? "Stop" : "Play"}
          style={{ width: 64, height: 64, borderRadius: "50%", border: "none", background: "var(--accent)", color: "#fff", cursor: playToggle ? "pointer" : "not-allowed", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--shadow)" }}>
          {isPlaying ? <Pause size={26} /> : <Play size={26} />}
        </button>
      </div>

      {locked ? (
        <div onClick={guardTap} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, touchAction: "none" }}>
          <Disc size={210} spinning={false} mood={plan?.globalMood} inserting={false} style={{ opacity: 0.45 }} />
          <div style={{ textAlign: "center", opacity: 0.6 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>{plan?.key ?? "—"}</div>
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
