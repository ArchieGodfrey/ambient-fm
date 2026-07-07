import { Pause, Play, Sparkles } from "lucide-react";
import { useSession } from "../session/SessionProvider";
import { screen, screenEyebrow, screenTitle, primaryButton, mutedNote } from "../ui/styles";

const dayLabel = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

export default function Today() {
  const { audio, isGenerating, handleGenerate, displayStatus } = useSession();
  const plan = audio.plan;
  const energy = plan ? Math.min(1, Math.max(0, (plan.bpm - 50) / 90)) : 0.4;

  return (
    <div style={screen} className="afm-rise">
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={screenEyebrow}>{dayLabel}</span>
        <h1 style={screenTitle}>{plan ? "Your sound is ready" : "A quiet canvas"}</h1>
      </div>

      {/* Breathing mood orb — the living focal point */}
      <div style={{ display: "flex", justifyContent: "center", padding: "24px 0 8px" }}>
        <div
          style={{
            width: 200,
            height: 200,
            borderRadius: "50%",
            background: `radial-gradient(circle at 35% 30%, var(--accent), transparent 72%), radial-gradient(circle at 70% 75%, var(--accent-soft), transparent 60%)`,
            border: "1px solid var(--accent-border)",
            boxShadow: "var(--shadow)",
            animation: `afm-breathe ${(7 - energy * 3).toFixed(1)}s ease-in-out infinite`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ textAlign: "center", color: "var(--text-h)" }}>
            <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: -0.5 }}>{plan?.key ?? "—"}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
              {plan ? `${plan.globalMood} · ${plan.bpm} bpm` : "no composition yet"}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <button type="button" style={{ ...primaryButton, opacity: isGenerating ? 0.7 : 1 }} disabled={isGenerating} onClick={() => void handleGenerate()}>
          <Sparkles size={17} />
          {isGenerating ? "Composing…" : plan ? "Compose again" : "Compose from this moment"}
        </button>

        {plan ? (
          <button
            type="button"
            onClick={() => void audio.handlePlayToggle()}
            style={{
              border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)",
              borderRadius: "var(--radius-pill)", padding: "10px 18px", cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14,
            }}
          >
            {audio.isPlaying ? <Pause size={16} /> : <Play size={16} />}
            {audio.isPlaying ? "Pause" : "Listen"}
          </button>
        ) : null}

        <p style={{ ...mutedNote, textAlign: "center", minHeight: 20 }}>{displayStatus}</p>
      </div>

      <p style={{ ...mutedNote, textAlign: "center", marginTop: "auto" }}>
        Soon you'll be able to capture a moment of your day and weave it into your sound.
      </p>
    </div>
  );
}
