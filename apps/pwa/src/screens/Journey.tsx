import { useMemo, useState } from "react";
import { Play, Trash2 } from "lucide-react";
import useSessionHistory from "../hooks/useSessionHistory";
import { useSession } from "../session/SessionProvider";
import Disc from "../components/Disc";
import { screen, screenEyebrow, screenTitle, card, mutedNote } from "../ui/styles";
import type { SessionSummary } from "../memory/types";

interface DayDisc {
  key: string;
  date: Date;
  tracks: SessionSummary[];
}

function dayKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function trackTime(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function Journey() {
  const { sessions, deleteSession } = useSessionHistory();
  const { audio } = useSession();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const discs = useMemo<DayDisc[]>(() => {
    const map = new Map<string, DayDisc>();
    for (const s of sessions) {
      const k = dayKey(s.timestamp);
      if (!map.has(k)) map.set(k, { key: k, date: new Date(s.timestamp), tracks: [] });
      map.get(k)!.tracks.push(s);
    }
    return Array.from(map.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [sessions]);

  const selected = discs.find((d) => d.key === selectedKey) ?? discs[0] ?? null;

  return (
    <div style={screen} className="afm-rise">
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={screenEyebrow}>Your library</span>
        <h1 style={screenTitle}>Disc library</h1>
      </div>

      {discs.length === 0 ? (
        <div style={{ ...card, textAlign: "center", padding: "40px 18px" }}>
          <p style={mutedNote}>No discs yet. Burn a track on Today and each day's disc will appear here — flip through them like a rack of CDs.</p>
        </div>
      ) : (
        <>
          {/* The rack — flip through day discs */}
          <div style={{ display: "flex", gap: 18, overflowX: "auto", padding: "6px 2px 14px", scrollbarWidth: "none" }}>
            {discs.map((d) => {
              const on = selected?.key === d.key;
              return (
                <div key={d.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <Disc
                    size={128}
                    spinning={on && audio.isPlaying}
                    mood={d.tracks[0]?.dominantMood}
                    label={d.date.toLocaleDateString(undefined, { day: "numeric" })}
                    sublabel={d.date.toLocaleDateString(undefined, { month: "short" })}
                    onClick={() => setSelectedKey(d.key)}
                    style={{ opacity: on ? 1 : 0.55, transition: "opacity 0.2s ease", outline: on ? "2px solid var(--accent-border)" : "none", outlineOffset: 6 }}
                  />
                  <span style={{ fontSize: 12, color: on ? "var(--text-h)" : "var(--text-faint)", fontWeight: on ? 600 : 500 }}>
                    {d.tracks.length} track{d.tracks.length > 1 ? "s" : ""}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Selected disc's tracklist */}
          {selected ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>
                {selected.date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
              </span>
              {selected.tracks.map((t, i) => (
                <div key={t.id} style={{ ...card, display: "flex", alignItems: "center", gap: 14, padding: 14 }}>
                  <button
                    type="button"
                    disabled={!t.plan}
                    onClick={() => t.plan && void audio.loadSessionPlan(t.plan)}
                    aria-label="Play track"
                    style={{
                      flexShrink: 0, width: 40, height: 40, borderRadius: "50%",
                      border: "1px solid var(--accent-border)", background: "var(--accent-soft)", color: "var(--accent)",
                      cursor: t.plan ? "pointer" : "not-allowed", display: "inline-flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <Play size={15} />
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-h)" }}>
                      Track {i + 1} · <span style={{ textTransform: "capitalize", fontWeight: 500 }}>{t.dominantMood}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                      {t.key} · {Math.round(t.avgBpm)} bpm · {trackTime(t.timestamp)}
                    </div>
                  </div>
                  <button type="button" onClick={() => void deleteSession(t.id)} aria-label="Delete track" style={{ border: "none", background: "transparent", color: "var(--text-faint)", cursor: "pointer", padding: 6 }}>
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
