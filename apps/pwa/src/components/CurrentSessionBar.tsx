import { Play, Pause } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import Disc from "./Disc";

export default function CurrentSessionBar({ onExpand }: { onExpand?: () => void }) {
  const plan = useAppStore((state) => state.currentPlan);
  const isPlaying = useAppStore((state) => state.isPlaying);
  const playToggle = useAppStore((state) => state.playToggle);

  return (
    <div
      className="afm-transport"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14,
        padding: "8px 18px",
        minHeight: 60,
        background: "color-mix(in srgb, var(--surface-strong) 92%, transparent)",
        backdropFilter: "blur(14px)",
        borderTop: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <button type="button" onClick={() => onExpand?.()} aria-label="Expand now playing"
        style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1, border: "none", background: "transparent", padding: 0, cursor: onExpand ? "pointer" : "default", textAlign: "left" }}>
        <Disc size={40} spinning={isPlaying} mood={plan?.globalMood} inserting={false} />
        <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-h)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {plan ? `${plan.key} · ${plan.globalMood}` : "Tray empty"}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {plan ? (isPlaying ? "Now spinning" : "Ready to spin") : "Burn a track to load a disc"}
          </div>
        </div>
      </button>

      <button
        type="button"
        onClick={() => playToggle?.()}
        disabled={!playToggle}
        style={{
          flexShrink: 0,
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "9px 16px", borderRadius: "var(--radius-pill)",
          border: "1px solid var(--accent-border)",
          background: isPlaying ? "var(--accent-soft)" : "var(--surface)",
          color: playToggle ? "var(--accent)" : "var(--text-faint)",
          cursor: playToggle ? "pointer" : "not-allowed",
          fontSize: 13, fontWeight: 600,
        }}
      >
        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        {isPlaying ? "Stop" : "Play"}
      </button>
    </div>
  );
}
