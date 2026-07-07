import type { CSSProperties } from "react";

interface DiscProps {
  size?: number;
  spinning?: boolean;
  burning?: boolean;
  label?: string;
  sublabel?: string;
  onClick?: () => void;
  style?: CSSProperties;
}

// Iridescent CD sheen — subtle, not garish, so it reads well in light & dark.
const iridescent =
  "conic-gradient(from 210deg, rgba(255,107,107,0.5), rgba(254,202,87,0.5), rgba(72,219,251,0.5), rgba(29,209,161,0.5), rgba(95,39,205,0.5), rgba(255,159,243,0.5), rgba(255,107,107,0.5))";
const grooves =
  "repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,0.05) 0 1px, rgba(0,0,0,0.06) 1px 3px)";
const sheen =
  "radial-gradient(circle at 34% 28%, rgba(255,255,255,0.35), transparent 42%)";

export default function Disc({ size = 220, spinning = false, burning = false, label, sublabel, onClick, style }: DiscProps) {
  const labelSize = size * 0.46;

  return (
    <div
      onClick={onClick}
      style={{
        position: "relative",
        width: size,
        height: size,
        borderRadius: "50%",
        cursor: onClick ? "pointer" : "default",
        boxShadow: "var(--shadow)",
        flexShrink: 0,
        ...style,
      }}
    >
      {/* Spinning iridescent disc */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: `${sheen}, ${grooves}, ${iridescent}, #14121b`,
          backgroundBlendMode: "screen, overlay, normal, normal",
          border: "1px solid rgba(0,0,0,0.25)",
          animation: spinning ? "afm-spin 3.2s linear infinite" : undefined,
        }}
      />

      {/* Laser burn sweep */}
      {burning ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: "conic-gradient(from 0deg, transparent 0deg, rgba(255,255,255,0.85) 8deg, transparent 24deg)",
            mixBlendMode: "screen",
            animation: "afm-burn-sweep 1.4s linear infinite",
          }}
        />
      ) : null}

      {/* Fixed center label */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: labelSize,
          height: labelSize,
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          background: "color-mix(in srgb, var(--surface) 88%, transparent)",
          border: "1px solid var(--border)",
          boxShadow: "inset 0 0 0 6px color-mix(in srgb, var(--surface-muted) 60%, transparent)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: 8,
        }}
      >
        {/* center hole */}
        <div style={{ position: "absolute", width: size * 0.06, height: size * 0.06, borderRadius: "50%", background: "var(--bg)", border: "1px solid var(--border)", opacity: 0.9 }} />
        {label ? <div style={{ fontSize: size * 0.11, fontWeight: 700, color: "var(--text-h)", letterSpacing: -0.5, zIndex: 1 }}>{label}</div> : null}
        {sublabel ? <div style={{ fontSize: size * 0.055, color: "var(--text-muted)", marginTop: 2, zIndex: 1 }}>{sublabel}</div> : null}
      </div>
    </div>
  );
}
