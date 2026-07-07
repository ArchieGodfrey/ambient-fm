import { Flame, Pause, Play } from "lucide-react";
import { useSession } from "../session/SessionProvider";
import useSessionHistory from "../hooks/useSessionHistory";
import Disc from "../components/Disc";
import { screen, screenEyebrow, screenTitle, primaryButton, mutedNote } from "../ui/styles";

const dayLabel = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

function isToday(ts: number) {
  const d = new Date(ts);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

export default function Today() {
  const { audio, isGenerating, handleGenerate, displayStatus } = useSession();
  const { sessions } = useSessionHistory();
  const plan = audio.plan;
  const tracksToday = sessions.filter((s) => isToday(s.timestamp)).length;
  const isError = /fail|error|too low|not available|unavailable/i.test(displayStatus ?? "");

  const trackLine = isGenerating
    ? "burning a track…"
    : tracksToday > 0
      ? `${tracksToday} track${tracksToday > 1 ? "s" : ""} burnt today`
      : "blank disc — nothing burnt yet";

  return (
    <div style={screen} className="afm-rise">
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={screenEyebrow}>{dayLabel}</span>
        <h1 style={screenTitle}>Today's disc</h1>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "18px 0 4px" }}>
        <Disc
          size={230}
          spinning={audio.isPlaying}
          burning={isGenerating}
          label={plan?.key ?? "—"}
          sublabel={plan ? plan.globalMood : "empty"}
          onClick={plan ? () => void audio.handlePlayToggle() : undefined}
        />
        <p style={{ ...mutedNote, marginTop: 8 }}>{trackLine}</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <button type="button" style={{ ...primaryButton, opacity: isGenerating ? 0.7 : 1 }} disabled={isGenerating} onClick={() => void handleGenerate()}>
          <Flame size={17} />
          {isGenerating ? "Burning…" : "Burn a track"}
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
            {audio.isPlaying ? "Stop the disc" : "Spin it up"}
          </button>
        ) : null}

        {displayStatus ? (
          <p
            style={{
              textAlign: "center", minHeight: 20, fontSize: 13, lineHeight: 1.5, maxWidth: 340,
              color: isError ? "#c2506f" : "var(--text-muted)",
            }}
          >
            {displayStatus}
          </p>
        ) : null}
      </div>

      <p style={{ ...mutedNote, textAlign: "center", marginTop: "auto" }}>
        Each day is a disc. Burn a track whenever the mood moves you — soon you'll capture a moment of your day and press it into the music.
      </p>
    </div>
  );
}
