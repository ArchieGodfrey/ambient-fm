import { useEffect, useRef, useState } from "react";
import { Pause, Play, Plus, Copy, Trash2 } from "lucide-react";
import useSounds from "../hooks/useSounds";
import { useSession } from "../session/SessionProvider";
import { useAppStore } from "../store/useAppStore";
import { buildPreviewPlan } from "../sounds/previewPlan";
import { DEFAULT_MOOD, DEFAULT_COMPOSER_SETTINGS, type SoundMood } from "../sounds/types";
import type { ComposerSettings } from "../features/composer/types";
import { screen, screenEyebrow, screenTitle, card, sectionLabel, chip, primaryButton, ghostButton, mutedNote } from "../ui/styles";

const MOOD_DIMS: Array<{ key: keyof SoundMood; label: string }> = [
  { key: "energy", label: "Energy" },
  { key: "calmness", label: "Calm" },
  { key: "tension", label: "Tension" },
  { key: "brightness", label: "Brightness" },
];
const CHARACTER: Array<{ key: keyof ComposerSettings; label: string }> = [
  { key: "complexity", label: "Complexity" },
  { key: "motifDensity", label: "Motif density" },
  { key: "harmonicMovement", label: "Harmonic movement" },
];

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
        <span style={{ color: "var(--text-h)", fontWeight: 500 }}>{label}</span>
        <span style={{ color: "var(--text-muted)" }}>{Math.round(value * 100)}%</span>
      </div>
      <input type="range" min={0} max={1} step={0.01} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--accent)" }} />
    </label>
  );
}

export default function YourSound() {
  const { sounds, activeSound, activeSoundId, setActiveSound, createSound, updateSound, deleteSound } = useSounds();
  const { audio } = useSession();
  const setComposerSettings = useAppStore((s) => s.setComposerSettings);

  const [name, setName] = useState("");
  const [mood, setMood] = useState<SoundMood>(DEFAULT_MOOD);
  const [settings, setSettings] = useState<ComposerSettings>(DEFAULT_COMPOSER_SETTINGS);
  const [previewing, setPreviewing] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Load the selected sound into the editor when it changes, and make it the
  // active sonic character for burns.
  useEffect(() => {
    if (!activeSound) return;
    setName(activeSound.name);
    setMood({ ...activeSound.mood });
    setSettings({ ...activeSound.composerSettings });
    setDirty(false);
    setComposerSettings(activeSound.composerSettings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSoundId]);

  // Live refine: while previewing, rebuild + replay a beat after the mood changes.
  const previewingRef = useRef(previewing);
  previewingRef.current = previewing;
  useEffect(() => {
    if (!previewingRef.current) return;
    const t = setTimeout(() => void audio.loadSessionPlan(buildPreviewPlan(mood, settings)), 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood, settings]);

  const editMood = (k: keyof SoundMood, v: number) => { setMood((m) => ({ ...m, [k]: v })); setDirty(true); };
  const editSetting = (k: keyof ComposerSettings, v: number) => { setSettings((s) => ({ ...s, [k]: v })); setDirty(true); };

  function startPreview() { setPreviewing(true); void audio.loadSessionPlan(buildPreviewPlan(mood, settings)); }
  function stopPreview() { setPreviewing(false); if (audio.isPlaying) void audio.handlePlayToggle(); }

  async function save() {
    if (!activeSound) return;
    await updateSound(activeSound.id, { name: name.trim() || activeSound.name, mood, composerSettings: settings });
    setDirty(false);
  }
  async function duplicate() {
    await createSound(`${(name.trim() || "Sound")} variant`, mood, settings, activeSound?.id);
  }

  return (
    <div style={screen} className="afm-rise">
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={screenEyebrow}>Your sound</span>
        <h1 style={screenTitle}>Shape the mood</h1>
        <p style={mutedNote}>Tune how it feels, listen, and save it as a sound you can return to and remix.</p>
      </div>

      {/* Gallery of saved sounds */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {sounds.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActiveSound(s.id)}
            style={{ ...chip, ...(s.id === activeSoundId ? { borderColor: "var(--accent)", background: "var(--accent-soft)", color: "var(--accent)", fontWeight: 600 } : {}) }}
          >
            {s.name}
          </button>
        ))}
        <button type="button" onClick={() => void createSound("New sound", DEFAULT_MOOD, DEFAULT_COMPOSER_SETTINGS)} style={{ ...chip, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Plus size={14} /> New
        </button>
      </div>

      {/* Name */}
      <input
        type="text" value={name} placeholder="Name this sound"
        onChange={(e) => { setName(e.target.value); setDirty(true); }}
        style={{ padding: "12px 16px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-h)", fontSize: 16, fontWeight: 600 }}
      />

      {/* Mood */}
      <div style={{ ...card, display: "flex", flexDirection: "column", gap: 18 }}>
        {MOOD_DIMS.map(({ key, label }) => <Slider key={key} label={label} value={mood[key]} onChange={(v) => editMood(key, v)} />)}
      </div>

      {/* Sonic character */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={sectionLabel}>Sonic character</span>
        <div style={{ ...card, display: "flex", flexDirection: "column", gap: 18 }}>
          {CHARACTER.map(({ key, label }) => <Slider key={key} label={label} value={settings[key]} onChange={(v) => editSetting(key, v)} />)}
        </div>
      </div>

      {/* Preview + refine */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button type="button" style={primaryButton} onClick={() => (previewing ? stopPreview() : startPreview())}>
          {previewing ? <Pause size={16} /> : <Play size={16} />}
          {previewing ? "Stop" : "Listen"}
        </button>
        {previewing ? <span style={mutedNote}>Adjust the sliders — it updates as you go.</span> : null}
      </div>

      {/* Save / duplicate / delete */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button type="button" style={{ ...primaryButton, opacity: dirty ? 1 : 0.55 }} disabled={!dirty || !activeSound} onClick={() => void save()}>
          Save
        </button>
        <button type="button" style={{ ...ghostButton, display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => void duplicate()}>
          <Copy size={15} /> Duplicate
        </button>
        {activeSound && sounds.length > 1 ? (
          <button type="button" style={{ ...ghostButton, display: "inline-flex", alignItems: "center", gap: 6, marginLeft: "auto", color: "var(--text-muted)" }} onClick={() => void deleteSound(activeSound.id)}>
            <Trash2 size={15} /> Delete
          </button>
        ) : null}
      </div>
    </div>
  );
}
