import { useEffect, useRef, useState, type CSSProperties } from "react";
import { X, Pause, Play, Sparkles, Save, Square, Trash2 } from "lucide-react";
import { useSession } from "../session/SessionProvider";
import { useAppStore } from "../store/useAppStore";
import Disc from "../components/Disc";
import PianoKeyboard from "../components/PianoKeyboard";
import MelodyRoll from "../components/MelodyRoll";
import { buildSoundscape, describeMood } from "../sounds/previewPlan";
import { describeVibe } from "../sounds/vibe";
import type { CompositionDirection } from "../ai/prompt";
import { auditionAttack, auditionRelease, setAuditionInstrument } from "../audio/audition";
import { MELODY_INSTRUMENTS, DEFAULT_MELODY_INSTRUMENT } from "../audio/melodyInstruments";
import { getScale } from "../music/harmony";
import {
  DEFAULT_KEY, DEFAULT_PROGRESSION, DEFAULT_LAYERS, TONICS,
  type Sound, type SoundMood, type SoundLayers, type MelodyNote, type MelodyTake,
} from "../sounds/types";
import type { ComposerSettings } from "../features/composer/types";

const MOOD_DIMS: Array<{ key: keyof SoundMood; label: string }> = [
  { key: "energy", label: "Energy" }, { key: "calmness", label: "Calm" }, { key: "tension", label: "Tension" }, { key: "brightness", label: "Brightness" },
];
const CHARACTER: Array<{ key: keyof ComposerSettings; label: string }> = [
  { key: "complexity", label: "Complexity" }, { key: "motifDensity", label: "Density" }, { key: "harmonicMovement", label: "Movement" },
];
const LAYER_KEYS: Array<{ key: keyof SoundLayers; label: string }> = [
  { key: "drone", label: "Drone" }, { key: "pad", label: "Pad" }, { key: "pulse", label: "Pulse" }, { key: "texture", label: "Texture" },
];
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];
const TABS = [
  { id: "melody", label: "Melody" },
  { id: "chords", label: "Chords" },
  { id: "layers", label: "Layers" },
  { id: "feel", label: "Feel" },
  { id: "vibe", label: "Vibe" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function Slider({ label, value, min = 0, max = 1, step = 0.01, display, onChange }: { label: string; value: number; min?: number; max?: number; step?: number; display?: string; onChange: (v: number) => void }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
        <span style={{ color: "var(--text-h)", fontWeight: 500 }}>{label}</span>
        <span style={{ color: "var(--text-muted)" }}>{display ?? `${Math.round(value * 100)}%`}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--accent)" }} />
    </label>
  );
}

interface StudioProps {
  sound: Sound;
  onClose: () => void;
  onSave: (patch: Partial<Sound>) => Promise<void>;
}

export default function Studio({ sound, onClose, onSave }: StudioProps) {
  const { audio, handleGenerate, isGenerating, generateVibe } = useSession();
  const setComposerSettings = useAppStore((s) => s.setComposerSettings);
  const [writingVibe, setWritingVibe] = useState(false);

  const [draft, setDraft] = useState<Sound>(() => ({
    ...sound,
    tempo: sound.tempo ?? 90,
    key: sound.key ?? DEFAULT_KEY,
    progression: sound.progression?.length ? sound.progression : DEFAULT_PROGRESSION,
    layers: sound.layers ?? DEFAULT_LAYERS,
    melody: Array.isArray(sound.melody) ? (sound.melody as MelodyTake[]).filter((t) => t && Array.isArray(t.notes)) : [],
    melodyInstrument: sound.melodyInstrument ?? DEFAULT_MELODY_INSTRUMENT,
    vibe: sound.vibe ?? "",
    fillInstruction: sound.fillInstruction ?? "",
  }));
  const [tab, setTab] = useState<TabId>("melody");
  const [previewing, setPreviewing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const previewingRef = useRef(false);
  previewingRef.current = previewing;

  // Recorder — auto-starts on first note; held notes draw live in the roll.
  const [recording, setRecording] = useState(false);
  const recordingRef = useRef(false);
  const recStart = useRef(0);
  const [currentTake, setCurrentTake] = useState<MelodyNote[]>([]);
  const [held, setHeld] = useState<{ note: string; start: number }[]>([]);
  const [playhead, setPlayhead] = useState(0);
  const nowSec = () => performance.now() / 1000;

  const patch = (p: Partial<Sound>) => { setDraft((d) => ({ ...d, ...p })); setDirty(true); };

  useEffect(() => { setAuditionInstrument(draft.melodyInstrument ?? DEFAULT_MELODY_INSTRUMENT); }, [draft.melodyInstrument]);

  // Grow held notes in real time.
  useEffect(() => {
    if (held.length === 0) return;
    let id = 0;
    const loop = () => { setPlayhead(nowSec() - recStart.current); id = requestAnimationFrame(loop); };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [held.length]);

  useEffect(() => {
    if (!previewingRef.current) return;
    const t = setTimeout(() => void audio.loadSessionPlan(buildSoundscape(draft)), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  function keyDown(note: string) {
    void auditionAttack(note);
    if (!recordingRef.current) { recStart.current = nowSec(); recordingRef.current = true; setRecording(true); setCurrentTake([]); }
    setHeld((h) => [...h, { note, start: nowSec() - recStart.current }]);
  }
  function keyUp(note: string) {
    auditionRelease(note);
    if (!recordingRef.current) return;
    setHeld((h) => {
      const idx = h.findIndex((x) => x.note === note);
      if (idx === -1) return h;
      const hn = h[idx];
      const duration = Math.max(0.12, nowSec() - recStart.current - hn.start);
      setCurrentTake((t) => [...t, { note, start: hn.start, duration }]);
      return h.filter((_, j) => j !== idx);
    });
  }
  function stopRecording() {
    recordingRef.current = false;
    setRecording(false);
    const nowOff = nowSec() - recStart.current;
    const finalized = held.map((h) => ({ note: h.note, start: h.start, duration: Math.max(0.12, nowOff - h.start) }));
    const notes = [...currentTake, ...finalized].sort((a, b) => a.start - b.start);
    setHeld([]);
    setCurrentTake([]);
    if (notes.length) patch({ melody: [...(draft.melody ?? []), { id: crypto.randomUUID(), notes }] });
  }
  function removeTake(id: string) { patch({ melody: (draft.melody ?? []).filter((t) => t.id !== id) }); }

  function togglePreview() {
    if (previewing) { setPreviewing(false); if (audio.isPlaying) void audio.handlePlayToggle(); }
    else { setPreviewing(true); void audio.loadSessionPlan(buildSoundscape(draft)); }
  }
  async function save() {
    await onSave({ name: draft.name, mood: draft.mood, composerSettings: draft.composerSettings, tempo: draft.tempo, key: draft.key, progression: draft.progression, layers: draft.layers, melody: draft.melody, melodyInstrument: draft.melodyInstrument, vibe: draft.vibe, fillInstruction: draft.fillInstruction });
    setDirty(false);
  }
  async function writeVibe() {
    setWritingVibe(true);
    try {
      const text = await generateVibe({ moodWords: describeMood(draft.mood), key: `${draft.key!.tonic} ${draft.key!.mode}`, tempo: draft.tempo, instruction: draft.fillInstruction?.trim() || undefined });
      if (text) patch({ vibe: text });
    } catch {
      /* fall back to the deterministic Suggest */
    } finally {
      setWritingVibe(false);
    }
  }
  async function elevate() {
    setComposerSettings(draft.composerSettings);
    await save();
    const direction: CompositionDirection = {
      key: draft.key,
      progression: draft.progression,
      tempo: draft.tempo,
      moodWords: describeMood(draft.mood),
      hasMelody: (draft.melody ?? []).length > 0,
      instruction: draft.fillInstruction?.trim() || undefined,
      vibe: draft.vibe?.trim() || undefined,
    };
    await handleGenerate(direction);
  }

  const scale = getScale(draft.key!.tonic, draft.key!.mode);

  // Flatten saved takes + the in-progress take (finalized notes + growing held notes).
  const rollNotes: { note: string; start: number; duration: number; live?: boolean }[] = [];
  let offset = 0;
  for (const take of (draft.melody ?? [])) {
    let len = 0;
    for (const n of take.notes) { rollNotes.push({ note: n.note, start: offset + n.start, duration: n.duration }); len = Math.max(len, n.start + n.duration); }
    offset += len + 0.4;
  }
  for (const n of currentTake) rollNotes.push({ note: n.note, start: offset + n.start, duration: n.duration, live: true });
  for (const h of held) rollNotes.push({ note: h.note, start: offset + h.start, duration: Math.max(0.05, playhead - h.start), live: true });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "var(--bg)", display: "flex", flexDirection: "column" }} className="afm-rise">
      {/* Scrollable settings (the "bed" + melody settings) */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "14px 16px 10px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <button type="button" onClick={onClose} aria-label="Close" style={iconBtn}><X size={18} /></button>
            <input value={draft.name} onChange={(e) => patch({ name: e.target.value })} style={{ flex: 1, textAlign: "center", border: "none", background: "transparent", color: "var(--text-h)", fontSize: 17, fontWeight: 700 }} />
            <button type="button" onClick={() => void save()} disabled={!dirty} aria-label="Save" style={{ ...iconBtn, background: dirty ? "var(--accent-soft)" : "var(--surface)", color: dirty ? "var(--accent)" : "var(--text-faint)" }}><Save size={17} /></button>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
            <Disc size={64} spinning={audio.isPlaying} burning={isGenerating} mood={describeMood(draft.mood)} inserting={false} />
            <button type="button" onClick={togglePreview} style={{ ...pill, background: "var(--accent)", color: "#fff", border: "none" }}>
              {previewing ? <Pause size={16} /> : <Play size={16} />}{previewing ? "Stop" : "Listen"}
            </button>
            <button type="button" onClick={() => void elevate()} disabled={isGenerating} style={{ ...pill, background: "var(--surface)", color: "var(--accent)", border: "1px solid var(--accent-border)" }}>
              <Sparkles size={16} />{isGenerating ? "Elevating…" : "Elevate"}
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, background: "var(--surface-muted)", borderRadius: "var(--radius-pill)", padding: 4 }}>
            {TABS.map((t) => (
              <button key={t.id} type="button" onClick={() => setTab(t.id)}
                style={{ flex: 1, border: "none", borderRadius: "var(--radius-pill)", padding: "9px 6px", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                  background: tab === t.id ? "var(--surface-strong)" : "transparent", color: tab === t.id ? "var(--text-h)" : "var(--text-muted)", boxShadow: tab === t.id ? "var(--shadow-soft)" : "none" }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Panel */}
          <div style={panel}>
            {tab === "melody" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-muted)" }}>
                    Instrument
                    <select value={draft.melodyInstrument} onChange={(e) => patch({ melodyInstrument: e.target.value })} style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-h)", fontSize: 13 }}>
                      {MELODY_INSTRUMENTS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                    </select>
                  </label>
                  <div style={{ flex: 1, minWidth: 150 }}>
                    <Slider label="Tempo" value={draft.tempo!} min={40} max={160} step={1} display={`${draft.tempo} bpm`} onChange={(v) => patch({ tempo: v })} />
                  </div>
                </div>
                {(draft.melody ?? []).map((take, i) => (
                  <div key={take.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 12px", borderRadius: 9, background: "var(--surface-muted)", border: "1px solid var(--border)" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-h)" }}>Take {i + 1}</span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>{take.notes.length} notes</span>
                    <button type="button" onClick={() => removeTake(take.id)} aria-label="Delete take" style={{ border: "none", background: "transparent", color: "var(--text-faint)", cursor: "pointer", padding: 2 }}><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
            ) : null}

            {tab === "chords" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {TONICS.map((t) => { const on = draft.key!.tonic === t; return <button key={t} type="button" onClick={() => patch({ key: { ...draft.key!, tonic: t } })} style={{ ...chip, minWidth: 40, ...(on ? activeChip : {}) }}>{t}</button>; })}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {(["major", "minor"] as const).map((m) => { const on = draft.key!.mode === m; return <button key={m} type="button" onClick={() => patch({ key: { ...draft.key!, mode: m } })} style={{ ...chip, flex: 1, textTransform: "capitalize", ...(on ? activeChip : {}) }}>{m}</button>; })}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, minHeight: 32, alignItems: "center" }}>
                  {draft.progression!.map((deg, i) => (
                    <button key={i} type="button" onClick={() => patch({ progression: draft.progression!.filter((_, j) => j !== i) })} style={{ ...chip, ...activeChip }}>{ROMAN[deg] ?? deg + 1} ✕</button>
                  ))}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {ROMAN.map((r, deg) => <button key={r} type="button" onClick={() => draft.progression!.length < 8 && patch({ progression: [...draft.progression!, deg] })} style={{ ...chip, minWidth: 44 }}>{r}</button>)}
                </div>
              </div>
            ) : null}

            {tab === "layers" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {LAYER_KEYS.map(({ key, label }) => <Slider key={key} label={label} value={draft.layers![key]} onChange={(v) => patch({ layers: { ...draft.layers!, [key]: v } })} />)}
              </div>
            ) : null}

            {tab === "feel" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {MOOD_DIMS.map(({ key, label }) => <Slider key={key} label={label} value={draft.mood[key]} onChange={(v) => patch({ mood: { ...draft.mood, [key]: v } })} />)}
                <div style={{ height: 1, background: "var(--border)" }} />
                {CHARACTER.map(({ key, label }) => <Slider key={key} label={label} value={draft.composerSettings[key]} onChange={(v) => patch({ composerSettings: { ...draft.composerSettings, [key]: v } })} />)}
              </div>
            ) : null}

            {tab === "vibe" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-h)" }}>Vibe</span>
                    <span style={{ display: "flex", gap: 6 }}>
                      <button type="button" onClick={() => patch({ vibe: describeVibe(draft.mood, draft.key, draft.tempo) })} style={{ ...chip, padding: "5px 10px", fontSize: 12 }}>Suggest</button>
                      <button type="button" onClick={() => void writeVibe()} disabled={writingVibe} style={{ ...chip, padding: "5px 10px", fontSize: 12, borderColor: "var(--accent-border)", color: "var(--accent)" }}>{writingVibe ? "Writing…" : "✨ AI"}</button>
                    </span>
                  </div>
                  <textarea value={draft.vibe ?? ""} onChange={(e) => patch({ vibe: e.target.value })} rows={3} placeholder="A calm, dim drift…"
                    style={{ width: "100%", resize: "vertical", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-h)", fontSize: 13, fontFamily: "inherit" }} />
                </div>
                <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-h)" }}>How the AI fills the song</span>
                  <input value={draft.fillInstruction ?? ""} onChange={(e) => patch({ fillInstruction: e.target.value })} placeholder="e.g. build slowly, keep it sparse"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-h)", fontSize: 13 }} />
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Listen = deterministic from your blocks · Elevate = the AI fills honouring this.</span>
                </label>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Pinned foreground: the track view + piano (never moves) */}
      <div style={{ borderTop: "1px solid var(--border)", background: "var(--surface)", boxShadow: "0 -10px 30px -16px rgba(0,0,0,0.35)" }}>
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "10px 12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          {recording ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button type="button" onClick={stopRecording} style={{ ...pill, padding: "7px 14px", background: "#c2506f", color: "#fff", border: "none" }}><Square size={13} /> Stop</button>
              <span style={{ fontSize: 12, color: "#c2506f", fontWeight: 600 }}>● recording</span>
            </div>
          ) : null}
          <MelodyRoll notes={rollNotes} />
          <PianoKeyboard scale={scale} onDown={keyDown} onUp={keyUp} />
        </div>
      </div>
    </div>
  );
}

const iconBtn: CSSProperties = { border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", borderRadius: "50%", width: 40, height: 40, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 };
const pill: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: "var(--radius-pill)", fontWeight: 600, cursor: "pointer" };
const panel: CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16, minHeight: 150 };
const chip: CSSProperties = { border: "1px solid var(--border)", borderRadius: "var(--radius-pill)", background: "var(--surface)", color: "var(--text)", fontSize: 13, padding: "8px 14px", cursor: "pointer" };
const activeChip: CSSProperties = { borderColor: "var(--accent)", background: "var(--accent-soft)", color: "var(--accent)", fontWeight: 700 };
