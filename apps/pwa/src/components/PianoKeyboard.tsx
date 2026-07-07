const WHITE = ["C", "D", "E", "F", "G", "A", "B"];
const BLACK_AFTER: Record<string, string> = { C: "C#", D: "D#", F: "F#", G: "G#", A: "A#" };

interface PianoKeyboardProps {
  octaves?: number[];
  scale?: string[]; // pitch classes to highlight (e.g. from the current key)
  onPlay: (note: string) => void;
}

export default function PianoKeyboard({ octaves = [4, 5], scale = [], onPlay }: PianoKeyboardProps) {
  const whites = octaves.flatMap((o) => WHITE.map((pc) => ({ note: `${pc}${o}`, pc, octave: o })));
  const n = whites.length;
  const whiteW = 100 / n;
  const blackW = whiteW * 0.62;
  const inScale = (pc: string) => scale.length === 0 || scale.includes(pc);

  return (
    <div style={{ position: "relative", height: 128, display: "flex", userSelect: "none", touchAction: "none" }}>
      {whites.map((w) => (
        <button
          key={w.note}
          type="button"
          onPointerDown={(e) => { e.preventDefault(); onPlay(w.note); }}
          style={{
            flex: 1, minWidth: 0, height: "100%",
            border: "1px solid var(--border)", borderRadius: "0 0 7px 7px",
            background: inScale(w.pc) ? "var(--surface-strong)" : "var(--surface-muted)",
            color: "var(--text-faint)", cursor: "pointer",
            display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 6, fontSize: 9,
          }}
        >
          {w.pc === "C" ? `C${w.octave}` : ""}
        </button>
      ))}
      {whites.map((w, i) => {
        const bpc = BLACK_AFTER[w.pc];
        if (!bpc) return null;
        const bnote = `${bpc}${w.octave}`;
        const leftPct = (i + 1) * whiteW - blackW / 2;
        return (
          <button
            key={bnote}
            type="button"
            onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onPlay(bnote); }}
            style={{
              position: "absolute", top: 0, left: `${leftPct}%`, width: `${blackW}%`, height: "62%",
              border: "1px solid #000", borderRadius: "0 0 5px 5px", zIndex: 1, cursor: "pointer",
              background: inScale(bpc) ? "linear-gradient(#3b3550, #1c1a24)" : "linear-gradient(#2a2833, #171620)",
            }}
          />
        );
      })}
    </div>
  );
}
