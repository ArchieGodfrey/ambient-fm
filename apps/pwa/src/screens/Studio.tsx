import { useEffect, useRef, useState, type CSSProperties } from "react";
import { X, Pause, Play, Sparkles, Save, Square, Trash2 } from "lucide-react";
import { useSession } from "../session/SessionProvider";
import { useAppStore } from "../store/useAppStore";
import Disc from "../components/Disc";
import PianoKeyboard from "../components/PianoKeyboard";
import MelodyRoll from "../components/MelodyRoll";
import { buildSoundscape, describeMood } from "../sounds/previewPlan";
import { auditionAttack, auditionRelease, setAuditionInstrument } from "../audio/audition";
import { MELODY_INSTRUMENTS, DEFAULT_MELODY_INSTRUMENT } from "../audio/melodyInstruments";
import { getScale } from "../music/harmony";
import {
  DEFAULT_KEY, DEFAULT_PROGRESSION, DEFAULT_LAYERS, TONICS,
  type Sound, type SoundMood, type SoundLayers, type MelodyNote, type MelodyTake,
} from "../sounds/types";
import type { ComposerSettings } from "../features/composer/types";
import { card, sectionLabel, mutedNote, chip } from "../ui/styles";

const MOOD_DIMS: Array<{ key: keyof SoundMood; label: string }> = [
  { key: "energy", label: "Energy" }, { key: "calmness", label: "Calm" }, { key: "tension", label: "Tension" }, { key: "brightness", label: "Brightness" },
];
const CHARACTER: Array<{ key: keyof ComposerSettings; label: string }> = [
  { key: "complexity", label: "Complexity" }, { key: "motifDensity", label: "Motif density" }, { key: "harmonicMovement", label: "Harmonic movement" },
];
const LAYER_KEYS: Array<{ key: keyof SoundLayers; label: string }> = [
  { key: "drone", label: "Drone" }, { key: "pad", label: "Pad" }, { key: "pulse", label: "Pulse" }, { key: "texture", label: "Texture" },
];
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];

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
  const { audio, handleGenerate, isGenerating } = useSession();
  const setComposerSettings = useAppStore((s) => s.setComposerSettings);

  const [draft, setDraft] = useState<Sound>(() => ({
    ...sound,
    tempo: sound.tempo ?? 90,
    key: sound.key ?? DEFAULT_KEY,
    progression: sound.progression?.length ? sound.progression : DEFAULT_PROGRESSION,
    layers: sound.layers ?? DEFAULT_LAYERS,
    melody: Array.isArray(sound.melody) ? (sound.melody as MelodyTake[]).filter((t) => t && Array.isArray(t.notes)) : [],
    melodyInstrument: sound.melodyInstrument ?? DEFAULT_MELODY_INSTRUMENT,
  }));
  const [previewing, setPreviewing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const previewingRef = useRef(false);
  previewingRef.current = previewing;

  // Melody recorder — recording auto-starts on the first note; only stopping is manual.
  const [recording, setRecording] = useState(false);
  const recordingRef = useRef(false);
  const recStart = useRef(0);
  const activeNotes = useRef<Map<string, number>>(new Map());
  const [currentTake, setCurrentTake] = useState<MelodyNote[]>([]);
  const nowSec = () => performance.now() / 1000;

  const patch = (p: Partial<Sound>) => { setDraft((d) => ({ ...d, ...p })); setDirty(true); };

  useEffect(() => { setAuditionInstrument(draft.melodyInstrument ?? DEFAULT_MELODY_INSTRUMENT); }, [draft.melodyInstrument]);

  useEffect(() => {
    if (!previewingRef.current) return;
    const t = setTimeout(() => void audio.loadSessionPlan(buildSoundscape(draft)), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  function keyDown(note: string) {
    void auditionAttack(note);
    if (!recordingRef.current) { // auto-start recording on first press
      recStart.current = nowSec();
      recordingRef.current = true;
      setRecording(true);
      setCurrentTake([]);
    }
    activeNotes.current.set(note, nowSec() - recStart.current);
  }
  function keyUp(note: string) {
    auditionRelease(note);
    if (recordingRef.current && activeNotes.current.has(note)) {
      const start = activeNotes.current.get(note)!;
      const duration = Math.max(0.12, nowSec() - recStart.current - start);
      setCurrentTake((t) => [...t, { note, start, duration }]);
      activeNotes.current.delete(note);
    }
  }
  function stopRecording() {
    recordingRef.current = false;
    setRecording(false);
    activeNotes.current.clear();
    const notes = [...currentTake].sort((a, b) => a.start - b.start);
    if (notes.length) patch({ melody: [...(draft.melody ?? []), { id: crypto.randomUUID(), notes }] });
    setCurrentTake([]);
  }
  function removeTake(id: string) { patch({ melody: (draft.melody ?? []).filter((t) => t.id !== id) }); }

  function togglePreview() {
    if (previewing) { setPreviewing(false); if (audio.isPlaying) void audio.handlePlayToggle(); }
    else { setPreviewing(true); void audio.loadSessionPlan(buildSoundscape(draft)); }
  }
  async function save() {
    await onSave({ name: draft.name, mood: draft.mood, composerSettings: draft.composerSettings, tempo: draft.tempo, key: draft.key, progression: draft.progression, layers: draft.layers, melody: draft.melody, melodyInstrument: draft.melodyInstrument });
    setDirty(false);
  }
  async function elevate() { setComposerSettings(draft.composerSettings); await save(); await handleGenerate(); }

  const scale = getScale(draft.key!.tonic, draft.key!.mode);

  // Flatten takes (+ the live take) for the track view.
  const rollNotes: { note: string; start: number; duration: number; live?: boolean }[] = [];
  let offset = 0;
  for (const take of (draft.melody ?? [])) {
    let len = 0;
    for (const n of take.notes) { rollNotes.push({ note: n.note, start: offset + n.start, duration: n.duration }); len = Math.max(len, n.start + n.duration); }
    offset += len + 0.4;
  }
  for (const n of currentTake) rollNotes.push({ note: n.note, start: offset + n.start, duration: n.duration, live: true });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "var(--bg)", overflowY: "auto" }} className="afm-rise">
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "14px 16px 48px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <button type="button" onClick={onClose} aria-label="Close studio" style={iconBtn}><X size={18} /></button>
          <input value={draft.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Name this sound" style={{ flex: 1, textAlign: "center", border: "none", background: "transparent", color: "var(--text-h)", fontSize: 17, fontWeight: 700 }} />
          <button type="button" onClick={() => void save()} disabled={!dirty} aria-label="Save" style={{ ...iconBtn, background: dirty ? "var(--accent-soft)" : "var(--surface)", color: dirty ? "var(--accent)" : "var(--text-faint)" }}><Save size={17} /></button>
        </div>

        {/* Transport */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
          <Disc size={72} spinning={audio.isPlaying} burning={isGenerating} mood={describeMood(draft.mood)} inserting={false} />
          <button type="button" onClick={togglePreview} style={{ ...pill, background: "var(--accent)", color: "#fff", border: "none" }}>
            {previewing ? <Pause size={16} /> : <Play size={16} />}{previewing ? "Stop" : "Listen"}
          </button>
          <button type="button" onClick={() => void elevate()} disabled={isGenerating} style={{ ...pill, background: "var(--surface)", color: "var(--accent)", border: "1px solid var(--accent-border)" }}>
            <Sparkles size={16} />{isGenerating ? "Elevating…" : "Elevate with AI"}
          </button>
        </div>

        {/* ── Foreground: your part ── */}
        <span style={sectionLabel}>Your part — play the melody</span>
        <div style={{ ...card, display: "flex", flexDirection: "column", gap: 12 }}>
          {/* instrument + tempo */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-muted)" }}>
              Instrument
              <select value={draft.melodyInstrument} onChange={(e) => patch({ melodyInstrument: e.target.value })} style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-h)", fontSize: 13 }}>
                {MELODY_INSTRUMENTS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </label>
            <div style={{ flex: 1, minWidth: 160 }}>
              <Slider label="Tempo" value={draft.tempo!} min={40} max={160} step={1} display={`${draft.tempo} bpm`} onChange={(v) => patch({ tempo: v })} />
            </div>
          </div>

          {/* track view */}
          <MelodyRoll notes={rollNotes} />

          {/* record status + takes */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 22 }}>
            {recording ? (
              <button type="button" onClick={stopRecording} style={{ ...pill, padding: "8px 14px", background: "#c2506f", color: "#fff", border: "none" }}>
                <Square size={13} /> Stop recording
              </button>
            ) : (
              <span style={mutedNote}>Play the keys to start recording — press Stop when done.</span>
            )}
            {recording ? <span style={{ ...mutedNote, color: "#c2506f" }}>● recording</span> : null}
          </div>

          {(draft.melody ?? []).length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(draft.melody ?? []).map((take, i) => (
                <div key={take.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 12px", borderRadius: 9, background: "var(--surface-muted)", border: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-h)" }}>Take {i + 1}</span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>{take.notes.length} note{take.notes.length !== 1 ? "s" : ""}</span>
                  <button type="button" onClick={() => removeTake(take.id)} aria-label="Delete take" style={{ border: "none", background: "transparent", color: "var(--text-faint)", cursor: "pointer", padding: 2 }}><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          ) : null}

          {/* piano — the focus */}
          <PianoKeyboard scale={scale} onDown={keyDown} onUp={keyUp} />
        </div>

        {/* ── Background: the bed ── */}
        <span style={{ ...sectionLabel, marginTop: 6 }}>The bed — the algorithm fills around your part</span>

        <div style={{ ...card, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {TONICS.map((t) => { const on = draft.key!.tonic === t; return <button key={t} type="button" onClick={() => patch({ key: { ...draft.key!, tonic: t } })} style={{ ...chip, minWidth: 40, ...(on ? activeChip : {}) }}>{t}</button>; })}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["major", "minor"] as const).map((m) => { const on = draft.key!.mode === m; return <button key={m} type="button" onClick={() => patch({ key: { ...draft.key!, mode: m } })} style={{ ...chip, flex: 1, textTransform: "capitalize", ...(on ? activeChip : {}) }}>{m}</button>; })}
          </div>
          {/* chords */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, minHeight: 34, alignItems: "center" }}>
            {draft.progression!.length === 0 ? <span style={mutedNote}>Tap degrees to build a progression.</span> : draft.progression!.map((deg, i) => (
              <button key={i} type="button" onClick={() => patch({ progression: draft.progression!.filter((_, j) => j !== i) })} style={{ ...chip, ...activeChip }}>{ROMAN[deg] ?? deg + 1} ✕</button>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {ROMAN.map((r, deg) => <button key={r} type="button" onClick={() => draft.progression!.length < 8 && patch({ progression: [...draft.progression!, deg] })} style={{ ...chip, minWidth: 44 }}>{r}</button>)}
          </div>
        </div>

        <div style={{ ...card, display: "flex", flexDirection: "column", gap: 16 }}>
          {LAYER_KEYS.map(({ key, label }) => <Slider key={key} label={label} value={draft.layers![key]} onChange={(v) => patch({ layers: { ...draft.layers!, [key]: v } })} />)}
        </div>

        <div style={{ ...card, display: "flex", flexDirection: "column", gap: 16 }}>
          {MOOD_DIMS.map(({ key, label }) => <Slider key={key} label={label} value={draft.mood[key]} onChange={(v) => patch({ mood: { ...draft.mood, [key]: v } })} />)}
        </div>

        <div style={{ ...card, display: "flex", flexDirection: "column", gap: 16 }}>
          {CHARACTER.map(({ key, label }) => <Slider key={key} label={label} value={draft.composerSettings[key]} onChange={(v) => patch({ composerSettings: { ...draft.composerSettings, [key]: v } })} />)}
        </div>
      </div>
    </div>
  );
}

const iconBtn: CSSProperties = { border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", borderRadius: "50%", width: 40, height: 40, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 };
const pill: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 20px", borderRadius: "var(--radius-pill)", fontWeight: 600, cursor: "pointer" };
const activeChip: CSSProperties = { borderColor: "var(--accent)", background: "var(--accent-soft)", color: "var(--accent)", fontWeight: 700 };
