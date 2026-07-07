import { Play, Pause, Power } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { useSession } from "../session/SessionProvider";
import Disc from "./Disc";

export default function CurrentSessionBar({ onExpand }: { onExpand?: () => void }) {
  const plan = useAppStore((state) => state.currentPlan);
  const title = useAppStore((state) => state.currentTitle);
  const isPlaying = useAppStore((state) => state.isPlaying);
  const playToggle = useAppStore((state) => state.playToggle);
  const { radio } = useSession();

  const onAir = radio.isOn;
  const heading = onAir && radio.nowPlaying ? radio.nowPlaying.title : title ?? (plan ? plan.key : "Tray empty");

  // While the station is on, reflect its state: the DJ line in the intermission,
  // "composing…" while it works, else the track's mood; otherwise normal transport.
  const sub = onAir
    ? radio.hostText
      ? `“${radio.hostText}”`
      : radio.state === "generating"
        ? "composing the next track…"
        : radio.nowPlaying
          ? `on air · ${radio.nowPlaying.mood}`
          : "on air"
    : plan
      ? (isPlaying ? "Now spinning" : "Ready to spin")
      : "Tune in to start the station";

  const spinning = onAir ? radio.state === "playing" : isPlaying;
  const canToggle = onAir || !!playToggle;

  return (
    <div
      className="afm-transport"
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14,
        padding: "8px 18px", minHeight: 60,
        background: "color-mix(in srgb, var(--surface-strong) 92%, transparent)",
        backdropFilter: "blur(14px)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)",
      }}
    >
      <button type="button" onClick={() => onExpand?.()} aria-label="Expand now playing"
        style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1, border: "none", background: "transparent", padding: 0, cursor: onExpand ? "pointer" : "default", textAlign: "left" }}>
        <Disc size={40} spinning={spinning} burning={onAir && radio.state === "generating"} mood={plan?.globalMood} inserting={false} />
        <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-h)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {heading}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {sub}
          </div>
        </div>
      </button>

      <button
        type="button"
        onClick={() => (onAir ? radio.tuneOut() : playToggle?.())}
        disabled={!canToggle}
        aria-label={onAir ? "Tune out" : isPlaying ? "Stop" : "Play"}
        style={{
          flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 8,
          padding: "9px 16px", borderRadius: "var(--radius-pill)",
          border: "1px solid var(--accent-border)",
          background: (onAir || isPlaying) ? "var(--accent-soft)" : "var(--surface)",
          color: canToggle ? "var(--accent)" : "var(--text-faint)",
          cursor: canToggle ? "pointer" : "not-allowed", fontSize: 13, fontWeight: 600,
        }}
      >
        {onAir ? <Power size={16} /> : isPlaying ? <Pause size={16} /> : <Play size={16} />}
        {onAir ? "Tune out" : isPlaying ? "Stop" : "Play"}
      </button>
    </div>
  );
}
