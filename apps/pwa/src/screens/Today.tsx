import { Flame, Pause, Play, Mic, Square } from "lucide-react";
import { useSession } from "../session/SessionProvider";
import useSessionHistory from "../hooks/useSessionHistory";
import useCapture from "../hooks/useCapture";
import Disc from "../components/Disc";
import { screen, screenEyebrow, screenTitle, primaryButton, mutedNote } from "../ui/styles";

const dayLabel = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

function isToday(ts: number) {
  const d = new Date(ts);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

export default function Today() {
  const { audio, model, isGenerating, handleGenerate, displayStatus } = useSession();
  const { sessions } = useSessionHistory();
  const { recording, recordings, start, stop } = useCapture();
  const plan = audio.plan;
  const capturesToday = recordings.filter((r) => isToday(r.ts)).length;
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
          key={isGenerating ? "burning" : plan?.key ?? "empty"}
          size={230}
          spinning={audio.isPlaying}
          burning={isGenerating}
          progress={model.modelProgress}
          mood={plan?.globalMood}
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
            {audio.isPlaying ? "Stop" : "Play track"}
          </button>
        ) : null}

        {displayStatus && isError ? (
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

      {/* Passive capture — records the room in the background to colour your next burn */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginTop: "auto" }}>
        <button
          type="button"
          onClick={() => (recording ? stop() : void start())}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: "var(--radius-pill)", cursor: "pointer", fontSize: 13, fontWeight: 500,
            border: "1px solid " + (recording ? "#c2506f" : "var(--border)"),
            background: recording ? "#c2506f" : "var(--surface)", color: recording ? "#fff" : "var(--text-muted)",
          }}
        >
          {recording ? <Square size={14} /> : <Mic size={14} />}
          {recording ? "Listening… tap to stop" : "Capture the room"}
        </button>
        <p style={{ ...mutedNote, textAlign: "center", fontSize: 12 }}>
          {capturesToday > 0 ? `${capturesToday} moment${capturesToday > 1 ? "s" : ""} captured today — they colour your next burn.` : "Capture a moment and it colours your next composition."}
        </p>
      </div>
    </div>
  );
}
