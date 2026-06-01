import { Pause, Play } from "lucide-react";
import { useAppStore } from "../store/useAppStore";

export default function CurrentSessionBar() {
  const plan = useAppStore((state) => state.currentPlan);
  const isPlaying = useAppStore((state) => state.isPlaying);
  const playToggle = useAppStore((state) => state.playToggle);

  return (
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
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, textAlign: "left" }}>
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
  );
}
