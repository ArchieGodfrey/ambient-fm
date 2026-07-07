import { Flame, Pause, Play, Mic, Square, Check } from "lucide-react";
import { useSession } from "../session/SessionProvider";
import useSessionHistory from "../hooks/useSessionHistory";
import useCapture from "../hooks/useCapture";
import useSounds from "../hooks/useSounds";
import Disc from "../components/Disc";
import { soundToDirection } from "../sounds/soundDirection";
import { screen, screenEyebrow, screenTitle, primaryButton, mutedNote } from "../ui/styles";

const dayLabel = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

function isToday(ts: number) {
  const d = new Date(ts);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

const timeLabel = (ts: number) => new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

export default function Today() {
  const { audio, model, isGenerating, handleGenerate, displayStatus } = useSession();
  const { sessions } = useSessionHistory();
  const { recording, recordings, start, stop } = useCapture();
  const { sounds, activeSound, setActiveSound } = useSounds();
  const plan = audio.plan;

  const capturesToday = recordings.filter((r) => isToday(r.ts)).length;
  // The day's disc = today's burnt tracks, in the order they were burnt.
  const tracksToday = sessions.filter((s) => isToday(s.timestamp)).sort((a, b) => a.timestamp - b.timestamp);
  const isError = /fail|error|too low|not available|unavailable/i.test(displayStatus ?? "");

  const trackLine = isGenerating
    ? "burning a track…"
    : tracksToday.length > 0
      ? `${tracksToday.length} track${tracksToday.length > 1 ? "s" : ""} on today's disc`
      : "blank disc — nothing burnt yet";

  const burn = () =>
    void handleGenerate(activeSound ? soundToDirection(activeSound) : undefined, activeSound ?? undefined);

  return (
    <div style={screen} className="afm-rise">
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={screenEyebrow}>{dayLabel}</span>
        <h1 style={screenTitle}>Today's disc</h1>
      </div>

      {/* Which sound is loaded — burns build from it. Tap to switch. */}
      {sounds.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ ...mutedNote, fontSize: 12 }}>Building from your sound</span>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
            {sounds.map((s) => {
              const on = s.id === activeSound?.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveSound(s.id)}
                  style={{
                    flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "7px 13px", borderRadius: "var(--radius-pill)", cursor: "pointer", fontSize: 13, fontWeight: 600,
                    border: "1px solid " + (on ? "var(--accent)" : "var(--border)"),
                    background: on ? "var(--accent)" : "var(--surface)",
                    color: on ? "#fff" : "var(--text-muted)",
                  }}
                >
                  {on ? <Check size={13} /> : null}
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "10px 0 4px" }}>
        <Disc
          key={isGenerating ? "burning" : plan?.seed ?? plan?.key ?? "empty"}
          size={220}
          spinning={audio.isPlaying}
          burning={isGenerating}
          progress={model.modelProgress}
          mood={plan?.globalMood}
          onClick={plan ? () => void audio.handlePlayToggle() : undefined}
        />
        <p style={{ ...mutedNote, marginTop: 8 }}>{trackLine}</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <button type="button" style={{ ...primaryButton, opacity: isGenerating ? 0.7 : 1 }} disabled={isGenerating} onClick={burn}>
          <Flame size={17} />
          {isGenerating ? "Burning…" : tracksToday.length > 0 ? "Burn another track" : "Burn a track"}
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
          <p style={{ textAlign: "center", minHeight: 20, fontSize: 13, lineHeight: 1.5, maxWidth: 340, color: "#c2506f" }}>
            {displayStatus}
          </p>
        ) : null}
      </div>

      {/* The day's tracklist — each burn is a track on the disc. Tap to play it. */}
      {tracksToday.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ ...mutedNote, fontSize: 12 }}>Tracks on today's disc</span>
          <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 4 }}>
            {tracksToday.map((t, i) => {
              const loaded = plan?.seed != null && t.plan?.seed === plan.seed;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => t.plan && void audio.loadSessionPlan(t.plan)}
                  disabled={!t.plan}
                  style={{
                    flex: "0 0 auto", width: 92, border: "none", background: "transparent", padding: 0,
                    cursor: t.plan ? "pointer" : "default", display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                    opacity: t.plan ? 1 : 0.5,
                  }}
                >
                  <Disc size={72} spinning={loaded && audio.isPlaying} mood={t.plan?.globalMood ?? t.dominantMood} inserting={false} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: loaded ? "var(--accent)" : "var(--text-h)", textAlign: "center", lineHeight: 1.25 }}>
                    {t.title ?? `Track ${i + 1}`}
                  </span>
                  <span style={{ ...mutedNote, fontSize: 11 }}>{timeLabel(t.timestamp)}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Passive capture — records the room in the background to colour your next burn.
          Runs alongside burning, so you can sample and compose in the same session. */}
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
