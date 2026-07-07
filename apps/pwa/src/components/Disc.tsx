import type { CSSProperties } from "react";

interface DiscProps {
  size?: number;
  spinning?: boolean;
  burning?: boolean;
  /** 0..1 burn progress; when set (and burning) a ring fills around the disc. */
  progress?: number | null;
  /** Mood label used to tint the disc; falls back to the app accent. */
  mood?: string;
  label?: string;
  sublabel?: string;
  onClick?: () => void;
  /** Play the insert animation on mount (remount via `key` to replay). */
  inserting?: boolean;
  style?: CSSProperties;
}

// Map a mood word to a hue so each disc is tinted by how it feels.
export function moodHue(mood?: string): number {
  const m = (mood ?? "").toLowerCase();
  if (/calm|still|slow/.test(m)) return 200;
  if (/focus/.test(m)) return 250;
  if (/tense|tension|anx|dark/.test(m)) return 8;
  if (/energ|bright|upbeat|lively/.test(m)) return 330;
  if (/ambient|dream|float/.test(m)) return 282;
  if (/warm|golden/.test(m)) return 42;
  return 248; // periwinkle, ~app accent
}

const grooves =
  "repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,0.05) 0 1px, rgba(0,0,0,0.06) 1px 3px)";
const sheen =
  "radial-gradient(circle at 34% 28%, rgba(255,255,255,0.35), transparent 42%)";

export default function Disc({
  size = 220, spinning = false, burning = false, progress = null, mood,
  label, sublabel, onClick, inserting = true, style,
}: DiscProps) {
  const labelSize = size * 0.46;
  const hue = moodHue(mood);
  // Iridescence kept in a band around the mood hue (not a full spectrum) so each
  // disc reads as its mood's colour rather than the same rainbow.
  const iridescent = `conic-gradient(from 210deg,
    hsla(${hue}, 80%, 68%, 0.6), hsla(${(hue + 40) % 360}, 80%, 66%, 0.5),
    hsla(${(hue + 12) % 360}, 80%, 66%, 0.5), hsla(${(hue + 52) % 360}, 80%, 66%, 0.5),
    hsla(${(hue + 22) % 360}, 80%, 66%, 0.5), hsla(${hue}, 80%, 68%, 0.6))`;

  // Progress ring geometry
  const stroke = Math.max(4, size * 0.03);
  const r = size / 2 - stroke / 2 - 1;
  const circ = 2 * Math.PI * r;
  const frac = progress == null ? 0 : Math.min(1, Math.max(0, progress));

  return (
    <div
      onClick={onClick}
      style={{
        // No outer box-shadow/glow: it extends past the round box and gets clipped
        // to a square by scroll containers (the library rack, etc.). The disc keeps
        // its depth from the iridescence + label inset.
        position: "relative", width: size, height: size, borderRadius: "50%",
        cursor: onClick ? "pointer" : "default",
        flexShrink: 0, animation: inserting ? "afm-insert 0.55s cubic-bezier(0.22, 1, 0.36, 1) both" : undefined,
        ...style,
      }}
    >
      {/* Spinning iridescent disc + mood tint */}
      <div
        style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: `radial-gradient(circle at 50% 50%, hsla(${hue},70%,60%,0.28), transparent 66%), ${sheen}, ${grooves}, ${iridescent}, #14121b`,
          backgroundBlendMode: "screen, screen, overlay, normal, normal",
          border: "1px solid rgba(0,0,0,0.25)",
          // Keep the animation mounted and just toggle play-state, so pausing
          // freezes the disc at its current angle and resuming continues from there.
          animation: "afm-spin 3.2s linear infinite",
          animationPlayState: spinning ? "running" : "paused",
        }}
      />

      {/* Laser burn sweep */}
      {burning ? (
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: "conic-gradient(from 0deg, transparent 0deg, rgba(255,255,255,0.85) 8deg, transparent 24deg)",
          mixBlendMode: "screen", animation: "afm-burn-sweep 1.4s linear infinite",
        }} />
      ) : null}

      {/* Burn-progress ring */}
      {burning && progress != null ? (
        <svg width={size} height={size} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth={stroke} />
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`hsl(${hue}, 85%, 66%)`} strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - frac)}
            style={{ transition: "stroke-dashoffset 0.35s ease" }}
          />
        </svg>
      ) : null}

      {/* Fixed center label */}
      <div style={{
        position: "absolute", top: "50%", left: "50%", width: labelSize, height: labelSize,
        transform: "translate(-50%, -50%)", borderRadius: "50%",
        background: "color-mix(in srgb, var(--surface) 88%, transparent)", border: "1px solid var(--border)",
        boxShadow: "inset 0 0 0 6px color-mix(in srgb, var(--surface-muted) 60%, transparent)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 8,
      }}>
        <div style={{ position: "absolute", width: size * 0.06, height: size * 0.06, borderRadius: "50%", background: "var(--bg)", border: "1px solid var(--border)", opacity: 0.9 }} />
        {label ? <div style={{ fontSize: size * 0.11, fontWeight: 700, color: "var(--text-h)", letterSpacing: -0.5, zIndex: 1 }}>{label}</div> : null}
        {sublabel ? <div style={{ fontSize: size * 0.055, color: "var(--text-muted)", marginTop: 2, zIndex: 1 }}>{sublabel}</div> : null}
      </div>
    </div>
  );
}
