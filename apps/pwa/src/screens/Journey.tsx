import { useMemo, useState } from "react";
import { Trash2, Plus } from "lucide-react";
import useSessionHistory from "../hooks/useSessionHistory";
import useSounds from "../hooks/useSounds";
import { useSession } from "../session/SessionProvider";
import { postToast } from "../utils/toast";
import Disc from "../components/Disc";
import CapturesSection from "../components/CapturesSection";
import TrackFeedback from "../components/TrackFeedback";
import useFeedback from "../hooks/useFeedback";
import { recordFeedback } from "../feedback/feedback";
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

export default function Journey() {
  const { sessions, deleteSession } = useSessionHistory();
  const { audio, radio } = useSession();
  const { createFromSound } = useSounds();
  const { opinionFor } = useFeedback();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Save a track you like as a reusable, editable Sound (its key/tempo/mood/layers).
  async function saveAsSound(t: SessionSummary) {
    const [tonic, mode] = (t.key ?? "C major").split(/\s+/);
    const minor = /minor/i.test(mode || t.key || "");
    const energy = t.avgEnergy ?? 0.5;
    await createFromSound({
      mood: { energy, calmness: 1 - energy, tension: minor ? 0.5 : 0.3, brightness: minor ? 0.4 : 0.6 },
      composerSettings: { complexity: t.plan?.intent?.complexity ?? 0.4, motifDensity: t.plan?.intent?.motifDensity ?? 0.4, harmonicMovement: 0.4 },
      key: { tonic: tonic || "C", mode: minor ? "minor" : "major" },
      tempo: Math.round(t.avgBpm),
      progression: t.plan?.intent?.progression,
      layers: t.plan?.layers ?? t.layerProfile,
    }, t.title ?? "Saved track");
    postToast(`Saved “${t.title ?? "track"}” as a sound.`, "success");
  }

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
          <div style={{ display: "flex", gap: 18, overflowX: "auto", padding: "14px 12px 16px", scrollbarWidth: "none" }}>
            {discs.map((d) => {
              const on = selected?.key === d.key;
              return (
                <div key={d.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <Disc
                    size={128}
                    spinning={on && audio.isPlaying && !radio.isOn}
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
              {selected.tracks.map((t, i) => {
                const play = () => { if (!t.plan) return; void audio.loadSessionPlan(t.plan, t.title, t.id); void recordFeedback("replay", { sessionId: t.id, mood: t.dominantMood, key: t.key, bpm: t.avgBpm }); };
                return (
                  <div key={t.id} onClick={play} style={{ ...card, display: "flex", alignItems: "center", gap: 12, padding: 12, cursor: t.plan ? "pointer" : "default" }}>
                    <Disc size={40} mood={t.plan?.globalMood ?? t.dominantMood} inserting={false} style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-h)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {i + 1}. {t.title ?? "Untitled"}
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--text-muted)", textTransform: "capitalize" }}>
                        {t.dominantMood} · {t.key} · {Math.round(t.avgBpm)} bpm
                      </div>
                    </div>
                    <TrackFeedback track={{ sessionId: t.id, mood: t.dominantMood, key: t.key, bpm: t.avgBpm }} opinion={opinionFor(t.id)} />
                    <button type="button" onClick={(e) => { e.stopPropagation(); void saveAsSound(t); }} aria-label="Save as a sound" title="Save as a sound" style={{ border: "none", background: "transparent", color: "var(--accent)", cursor: "pointer", padding: 6 }}>
                      <Plus size={16} />
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); void recordFeedback("delete", { sessionId: t.id, mood: t.dominantMood, key: t.key, bpm: t.avgBpm }); void deleteSession(t.id); }} aria-label="Delete track" style={{ border: "none", background: "transparent", color: "var(--text-faint)", cursor: "pointer", padding: 6 }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}
        </>
      )}

      <CapturesSection />
    </div>
  );
}
