import { useEffect, useRef, useState } from "react";
import { X, Pause, Play, Sparkles, Save } from "lucide-react";
import { useSession } from "../session/SessionProvider";
import { useAppStore } from "../store/useAppStore";
import Disc from "../components/Disc";
import { buildSoundscape, describeMood } from "../sounds/previewPlan";
import { getScale } from "../music/harmony";
import {
  DEFAULT_KEY, DEFAULT_PROGRESSION, DEFAULT_LAYERS, TONICS,
  type Sound, type SoundMood, type SoundLayers,
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
    melody: sound.melody ?? [],
  }));
  const [previewing, setPreviewing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const previewingRef = useRef(false);
  previewingRef.current = previewing;

  const patch = (p: Partial<Sound>) => { setDraft((d) => ({ ...d, ...p })); setDirty(true); };

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
          <span style={sectionLabel}>Melody — tap to compose</span>
          <div style={{ ...card, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, minHeight: 30 }}>
              {draft.melody!.length === 0 ? <span style={mutedNote}>Tap the notes below to lay a simple melody.</span> : (
                <>
                  {draft.melody!.map((deg, i) => <span key={i} style={{ ...chip, padding: "6px 10px", background: "var(--surface-muted)" }}>{scale[((deg % 7) + 7) % 7]}</span>)}
                  <button type="button" onClick={() => patch({ melody: [] })} style={{ ...chip, padding: "6px 10px", color: "var(--text-muted)" }}>clear</button>
                </>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
              {scale.map((note, deg) => (
                <button key={deg} type="button" onClick={() => draft.melody!.length < 16 && patch({ melody: [...draft.melody!, deg] })}
                  style={{ padding: "16px 0", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-h)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                  {note}
                </button>
              ))}
            </div>
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
