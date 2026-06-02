import { useState } from "react";
import { Pause, Play, ChevronUp } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import NowPlayingOverlay from "./NowPlayingOverlay";

export default function CurrentSessionBar() {
  const plan = useAppStore((state) => state.currentPlan);
  const isPlaying = useAppStore((state) => state.isPlaying);
  const playToggle = useAppStore((state) => state.playToggle);
  const [overlayOpen, setOverlayOpen] = useState(false);

  return (
    <>
      {overlayOpen && <NowPlayingOverlay onClose={() => setOverlayOpen(false)} />}
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 55,
          zIndex: 20,
          display: "flex",
          justifyContent: "center",
          padding: "8px 12px",
          background: "var(--surface-strong)",
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 720,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            minHeight: 48,
          }}
        >
          <button
            type="button"
            onClick={() => setOverlayOpen(true)}
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "none",
              border: "none",
              padding: 0,
              cursor: plan ? "pointer" : "default",
              textAlign: "left",
              color: "inherit",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {plan?.key ?? "No session loaded"}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                {plan ? (
                  <>
                    <span>BPM {plan.bpm}</span>
                    <span>{plan.globalMood}</span>
                  </>
                ) : null}
              </div>
            </div>
            {plan && (
              <ChevronUp
                size={14}
                style={{ flexShrink: 0, color: "var(--text-muted)", opacity: 0.6 }}
              />
            )}
          </button>

          <button
            type="button"
            onClick={() => playToggle?.()}
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              border: "1px solid var(--border)",
              background: "var(--surface-strong)",
              color: "var(--text)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: playToggle ? "pointer" : "not-allowed",
            }}
            disabled={!playToggle}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>
        </div>
      </div>
    </>
  );
}
