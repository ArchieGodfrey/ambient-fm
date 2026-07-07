import { useEffect, useRef, useState } from "react";
import { X, Pause, Play, Sparkles, Save, Circle, Square, Trash2 } from "lucide-react";
import { useSession } from "../session/SessionProvider";
import { useAppStore } from "../store/useAppStore";
import Disc from "../components/Disc";
import PianoKeyboard from "../components/PianoKeyboard";
import { buildSoundscape, describeMood } from "../sounds/previewPlan";
import { auditionAttack, auditionRelease } from "../audio/audition";
import { getScale } from "../music/harmony";
import {
  DEFAULT_KEY, DEFAULT_PROGRESSION, DEFAULT_LAYERS, TONICS,
  type Sound, type SoundMood, type SoundLayers, type MelodyNote, type MelodyTake,
} from "../sounds/types";
import type { ComposerSettings } from "../features/composer/types";
import { card, sectionLabel, mutedNote, chip } from "../ui/styles";

const MOOD_DIMS: Array<{ key: keyof SoundMood; label: string }> = [
  { key: "energy", label: "Energy" }, { key: "calmness", label: "Calm" },
  { key: "tension", label: "Tension" }, { key: "brightness", label: "Brightness" },
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
  }));
  const [previewing, setPreviewing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const previewingRef = useRef(false);
  previewingRef.current = previewing;

  // Melody recorder — captures timing (gaps between presses) and hold duration.
  const [recording, setRecording] = useState(false);
  const recStart = useRef(0);
  const takeNotes = useRef<MelodyNote[]>([]);
  const activeNotes = useRef<Map<string, number>>(new Map());
  const nowSec = () => performance.now() / 1000;

  const patch = (p: Partial<Sound>) => { setDraft((d) => ({ ...d, ...p })); setDirty(true); };

  function keyDown(note: string) {
    void auditionAttack(note);
    if (recording) activeNotes.current.set(note, nowSec() - recStart.current);
  }
  function keyUp(note: string) {
    auditionRelease(note);
    if (recording && activeNotes.current.has(note)) {
      const start = activeNotes.current.get(note)!;
      const duration = Math.max(0.12, nowSec() - recStart.current - start);
      takeNotes.current.push({ note, start, duration });
      activeNotes.current.delete(note);
    }
  }
  function toggleRecord() {
    if (recording) {
      setRecording(false);
      const notes = [...takeNotes.current].sort((a, b) => a.start - b.start);
      if (notes.length) patch({ melody: [...(draft.melody ?? []), { id: crypto.randomUUID(), notes }] });
      takeNotes.current = [];
      activeNotes.current.clear();
    } else {
      recStart.current = nowSec();
      takeNotes.current = [];
      activeNotes.current.clear();
      setRecording(true);
    }
  }
  function removeTake(id: string) {
    patch({ melody: (draft.melody ?? []).filter((t) => t.id !== id) });
  }

  // Live refine while previewing.
  useEffect(() => {
    if (!previewingRef.current) return;
    const t = setTimeout(() => void audio.loadSessionPlan(buildSoundscape(draft)), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  function togglePreview() {
    if (previewing) { setPreviewing(false); if (audio.isPlaying) void audio.handlePlayToggle(); }
    else { setPreviewing(true); void audio.loadSessionPlan(buildSoundscape(draft)); }
  }

  async function save() {
    await onSave({
      name: draft.name, mood: draft.mood, composerSettings: draft.composerSettings,
      tempo: draft.tempo, key: draft.key, progression: draft.progression, layers: draft.layers, melody: draft.melody,
    });
    setDirty(false);
  }

  async function elevate() {
    setComposerSettings(draft.composerSettings);
    await save();
    await handleGenerate();
  }

  const scale = getScale(draft.key!.tonic, draft.key!.mode);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "var(--bg)", overflowY: "auto" }} className="afm-rise">
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px 18px 48px", display: "flex", flexDirection: "column", gap: 18 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <button type="button" onClick={onClose} aria-label="Close studio" style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", borderRadius: "50%", width: 40, height: 40, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={18} />
          </button>
          <input value={draft.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Name this sound"
            style={{ flex: 1, textAlign: "center", border: "none", background: "transparent", color: "var(--text-h)", fontSize: 18, fontWeight: 700 }} />
          <button type="button" onClick={() => void save()} disabled={!dirty} aria-label="Save" style={{ border: "1px solid var(--border)", background: dirty ? "var(--accent-soft)" : "var(--surface)", color: dirty ? "var(--accent)" : "var(--text-faint)", borderRadius: "50%", width: 40, height: 40, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: dirty ? "pointer" : "default" }}>
            <Save size={17} />
          </button>
        </div>

        {/* Disc + transport */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <Disc size={168} spinning={audio.isPlaying} burning={isGenerating} mood={describeMood(draft.mood)} inserting={false} />
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={togglePreview} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 22px", borderRadius: "var(--radius-pill)", border: "none", background: "var(--accent)", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
              {previewing ? <Pause size={16} /> : <Play size={16} />}{previewing ? "Stop" : "Listen"}
            </button>
            <button type="button" onClick={() => void elevate()} disabled={isGenerating} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 18px", borderRadius: "var(--radius-pill)", border: "1px solid var(--accent-border)", background: "var(--surface)", color: "var(--accent)", fontWeight: 600, cursor: "pointer" }}>
              <Sparkles size={16} />{isGenerating ? "Elevating…" : "Elevate with AI"}
            </button>
          </div>
          {previewing ? <span style={mutedNote}>Adjust anything below — it refines as you listen.</span> : null}
        </div>

        {/* Tempo */}
        <div style={card}>
          <Slider label="Tempo" value={draft.tempo!} min={40} max={160} step={1} display={`${draft.tempo} bpm`} onChange={(v) => patch({ tempo: v })} />
        </div>

        {/* Key */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={sectionLabel}>Key</span>
          <div style={{ ...card, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {TONICS.map((t) => {
                const on = draft.key!.tonic === t;
                return <button key={t} type="button" onClick={() => patch({ key: { ...draft.key!, tonic: t } })} style={{ ...chip, minWidth: 40, ...(on ? { borderColor: "var(--accent)", background: "var(--accent-soft)", color: "var(--accent)", fontWeight: 700 } : {}) }}>{t}</button>;
              })}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {(["major", "minor"] as const).map((m) => {
                const on = draft.key!.mode === m;
                return <button key={m} type="button" onClick={() => patch({ key: { ...draft.key!, mode: m } })} style={{ ...chip, flex: 1, textTransform: "capitalize", ...(on ? { borderColor: "var(--accent)", background: "var(--accent-soft)", color: "var(--accent)", fontWeight: 700 } : {}) }}>{m}</button>;
              })}
            </div>
          </div>
        </div>

        {/* Chords */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={sectionLabel}>Chords</span>
          <div style={{ ...card, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, minHeight: 34 }}>
              {draft.progression!.length === 0 ? <span style={mutedNote}>Tap degrees below to build a progression.</span> : draft.progression!.map((deg, i) => (
                <button key={i} type="button" onClick={() => patch({ progression: draft.progression!.filter((_, j) => j !== i) })} title="Remove" style={{ ...chip, background: "var(--accent-soft)", borderColor: "var(--accent-border)", color: "var(--accent)", fontWeight: 700 }}>{ROMAN[deg] ?? deg + 1} ✕</button>
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {ROMAN.map((r, deg) => (
                <button key={r} type="button" onClick={() => draft.progression!.length < 8 && patch({ progression: [...draft.progression!, deg] })} style={{ ...chip, minWidth: 44 }}>{r}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Melody */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={sectionLabel}>Melody — record &amp; play in</span>
          <div style={{ ...card, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <button type="button" onClick={toggleRecord}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: "var(--radius-pill)", border: "1px solid", cursor: "pointer", fontWeight: 600,
                  ...(recording ? { borderColor: "#c2506f", background: "#c2506f", color: "#fff" } : { borderColor: "var(--border)", background: "var(--surface)", color: "var(--text)" }) }}>
                {recording ? <Square size={14} /> : <Circle size={14} fill="#c2506f" color="#c2506f" />}
                {recording ? "Stop recording" : "Record"}
              </button>
              <span style={mutedNote}>{recording ? "Play the keys — timing and hold are captured." : "Record a phrase; each take stacks and plays in the soundscape."}</span>
            </div>

            {(draft.melody ?? []).length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(draft.melody ?? []).map((take, i) => (
                  <div key={take.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 12px", borderRadius: 10, background: "var(--surface-muted)", border: "1px solid var(--border)" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-h)" }}>Take {i + 1}</span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>{take.notes.length} note{take.notes.length !== 1 ? "s" : ""}</span>
                    <button type="button" onClick={() => removeTake(take.id)} aria-label="Delete take" style={{ border: "none", background: "transparent", color: "var(--text-faint)", cursor: "pointer", padding: 2 }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <PianoKeyboard scale={scale} onDown={keyDown} onUp={keyUp} />
          </div>
        </div>

        {/* Layers */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={sectionLabel}>Layers</span>
          <div style={{ ...card, display: "flex", flexDirection: "column", gap: 16 }}>
            {LAYER_KEYS.map(({ key, label }) => (
              <Slider key={key} label={label} value={draft.layers![key]} onChange={(v) => patch({ layers: { ...draft.layers!, [key]: v } })} />
            ))}
          </div>
        </div>

        {/* Mood */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={sectionLabel}>Mood</span>
          <div style={{ ...card, display: "flex", flexDirection: "column", gap: 16 }}>
            {MOOD_DIMS.map(({ key, label }) => (
              <Slider key={key} label={label} value={draft.mood[key]} onChange={(v) => patch({ mood: { ...draft.mood, [key]: v } })} />
            ))}
          </div>
        </div>

        {/* Sonic character */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={sectionLabel}>Sonic character</span>
          <div style={{ ...card, display: "flex", flexDirection: "column", gap: 16 }}>
            {CHARACTER.map(({ key, label }) => (
              <Slider key={key} label={label} value={draft.composerSettings[key]} onChange={(v) => patch({ composerSettings: { ...draft.composerSettings, [key]: v } })} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
