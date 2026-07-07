const PC: Record<string, number> = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };
const MIN_MIDI = 60; // C4
const MAX_MIDI = 83; // B5
const SPAN = MAX_MIDI - MIN_MIDI;

function noteToMidi(n: string): number {
  const m = n.match(/^([A-G]#?)(\d)$/);
  if (!m) return MIN_MIDI;
  return PC[m[1]] + (parseInt(m[2], 10) + 1) * 12;
}

interface RollNote { note: string; start: number; duration: number; live?: boolean }

export default function MelodyRoll({ notes, pxPerSec = 64, height = 132 }: { notes: RollNote[]; pxPerSec?: number; height?: number }) {
  const rowH = height / (SPAN + 1);
  const end = notes.length ? Math.max(...notes.map((n) => n.start + n.duration)) : 0;
  const width = Math.max(end * pxPerSec + 24, 100);

  return (
    <div style={{ position: "relative", height, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-muted)", overflowX: "auto", overflowY: "hidden" }}>
      <div style={{ position: "relative", height: "100%", width }}>
        {/* second grid lines */}
        {Array.from({ length: Math.ceil(end) + 1 }, (_, s) => (
          <div key={s} style={{ position: "absolute", top: 0, bottom: 0, left: s * pxPerSec, width: 1, background: "color-mix(in srgb, var(--border) 55%, transparent)" }} />
        ))}
        {notes.length === 0 ? (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-faint)", fontSize: 12 }}>
            Play the piano to lay a melody — it appears here.
          </div>
        ) : (
          notes.map((n, i) => {
            const midi = Math.min(MAX_MIDI, Math.max(MIN_MIDI, noteToMidi(n.note)));
            const top = (MAX_MIDI - midi) * rowH;
            return (
              <div key={i} title={n.note}
                style={{
                  position: "absolute", left: n.start * pxPerSec, top: top + 1, width: Math.max(5, n.duration * pxPerSec - 2), height: Math.max(4, rowH - 2),
                  borderRadius: 3, background: n.live ? "var(--accent)" : "hsl(248 70% 62%)", opacity: n.live ? 0.7 : 0.92,
                }}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
