import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, Trash2, Mic } from "lucide-react";
import useCapture from "../hooks/useCapture";
import { card, mutedNote } from "../ui/styles";
import type { Recording } from "../capture/types";

function dayKey(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
const dayHeading = (ts: number) => new Date(ts).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
const clock = (ts: number) => new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const secs = (ms: number) => `${Math.max(1, Math.round(ms / 1000))}s`;

// See / listen to / group the passively captured moments. Playback is a plain
// audio element (separate from the Tone graph) so it's a quick preview.
export default function CapturesSection() {
  const { recordings, remove } = useCapture();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  const cleanup = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
  };
  useEffect(() => cleanup, []);

  function toggle(rec: Recording) {
    if (playingId === rec.id) { cleanup(); setPlayingId(null); return; }
    cleanup();
    const url = URL.createObjectURL(rec.blob);
    urlRef.current = url;
    const a = new Audio(url);
    a.onended = () => { cleanup(); setPlayingId(null); };
    void a.play().catch(() => { cleanup(); setPlayingId(null); });
    audioRef.current = a;
    setPlayingId(rec.id);
  }

  const groups = useMemo(() => {
    const map = new Map<string, Recording[]>();
    for (const r of recordings) {
      const k = dayKey(r.ts);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return Array.from(map.entries()).map(([k, recs]) => ({ k, ts: recs[0].ts, recs }));
  }, [recordings]);

  if (recordings.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: 7 }}>
        <Mic size={14} /> Captured moments
      </span>
      {groups.map((g) => (
        <div key={g.k} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ ...mutedNote, fontSize: 12 }}>{dayHeading(g.ts)}</span>
          {g.recs.map((r) => {
            const on = playingId === r.id;
            return (
              <div key={r.id} style={{ ...card, display: "flex", alignItems: "center", gap: 14, padding: 12 }}>
                <button
                  type="button"
                  onClick={() => toggle(r)}
                  aria-label={on ? "Pause" : "Play capture"}
                  style={{
                    flexShrink: 0, width: 38, height: 38, borderRadius: "50%",
                    border: "1px solid var(--accent-border)", background: "var(--accent-soft)", color: "var(--accent)",
                    cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  {on ? <Pause size={15} /> : <Play size={15} />}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-h)" }}>{clock(r.ts)}</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                    {secs(r.durationMs)} · energy {Math.round((r.features?.energy ?? 0) * 100)}% · brightness {Math.round((r.features?.brightness ?? 0) * 100)}%
                  </div>
                </div>
                <button type="button" onClick={() => void remove(r.id)} aria-label="Delete capture" style={{ border: "none", background: "transparent", color: "var(--text-faint)", cursor: "pointer", padding: 6 }}>
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
