import { useState, useCallback, useMemo, useEffect } from "react";
import useMoodPage from "../hooks/useMoodPage";
import { useAppStore } from "../store/useAppStore";
import { previewVocal } from "../audio/vocal/previewVocal";
import { getVocalSynth } from "../audio/vocal/vocalSynth";
import { getPiperSynth } from "../audio/vocal/piperSynth";
import useVocalManager from "../hooks/useVocalManager";
import { postToast } from "../utils/toast";
import type { ComposerSettings, LayerId, KeyMode } from "../features/composer/types";
import type { ManualMoodValues } from "../types";

// ─── helpers ─────────────────────────────────────────────────────────────────

type SectionProps = { title: string; summary?: string; open: boolean; onToggle: () => void; children: React.ReactNode };
function Section({ title, summary, open, onToggle, children }: SectionProps) {
  return (
    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
      <button type="button" onClick={onToggle} style={{
        width: "100%", background: "none", border: "none", padding: "0 0 10px",
        cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{title}</span>
        {!open && summary && <span style={{ fontSize: 12, color: "var(--text-muted)", flex: 1, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{summary}</span>}
        <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && <div style={{ paddingBottom: 16 }}>{children}</div>}
    </div>
  );
}

const MOOD_KEYS: (keyof ManualMoodValues)[] = ["energy", "calmness", "tension", "brightness"];
const MOOD_LABELS: Record<keyof ManualMoodValues, string> = {
  energy: "Energy", calmness: "Calmness", tension: "Tension", brightness: "Brightness",
};
const MOOD_HINTS: Record<keyof ManualMoodValues, string> = {
  energy: "drive and motion", calmness: "stillness and space",
  tension: "edge and anticipation", brightness: "warmth and openness",
};

const LAYER_INFO: { id: LayerId; label: string; hint: string }[] = [
  { id: "drone",   label: "Drone",   hint: "low bass tone" },
  { id: "pad",     label: "Pad",     hint: "harmonic chords" },
  { id: "texture", label: "Texture", hint: "FM shimmer" },
  { id: "pulse",   label: "Pulse",   hint: "rhythmic accent" },
];
const KEY_MODES: { value: KeyMode; label: string }[] = [
  { value: "any", label: "AI chooses" },
  { value: "major", label: "Major (bright)" },
  { value: "minor", label: "Minor (dark)" },
];
const VOICES = [
  { id: "browser",      label: "Browser Voice (instant)" },
  { id: "ai",           label: "AI chooses (Kokoro)" },
  { id: "piper_lessac", label: "Lessac · Piper (fast)" },
  { id: "piper_ryan",   label: "Ryan · Piper (fast)" },
  { id: "piper_amy",    label: "Amy · Piper (fast)" },
  { id: "af_sky",       label: "Sky · Kokoro US Female" },
  { id: "af_bella", label: "Bella · US Female" },
  { id: "af_sarah", label: "Sarah · US Female" },
  { id: "am_adam", label: "Adam · US Male" },
  { id: "am_echo", label: "Echo · US Male" },
  { id: "bf_emma", label: "Emma · UK Female" },
  { id: "bm_george", label: "George · UK Male" },
];

const SOURCE_ICONS: Record<string, string> = { time: "◐", weather: "⛅" };

// ─── main ─────────────────────────────────────────────────────────────────────

export default function MoodPage() {
  const {
    allMoodPresets, configs, customMoodName,
    handleMoodValueChange, handleToggleEnabled, handleUpdateWeight,
    applyMoodPreset, isReady, isSavingCustomMood,
    moodValues, saveCustomMood, setCustomMoodName,
  } = useMoodPage();

  const composerSettings = useAppStore(s => s.composerSettings);
  const setComposerSettings = useAppStore(s => s.setComposerSettings);
  const vocalsEnabled = useAppStore(s => s.vocalsEnabled);
  const setVocalsEnabled = useAppStore(s => s.setVocalsEnabled);

  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [savingPreset, setSavingPreset] = useState(false);
  const { stage: vocalStage } = useVocalManager();
  const [previewStatus, setPreviewStatus] = useState<"idle" | "loading" | "playing">("idle");
  const [elapsed, setElapsed] = useState(0);

  // Tick elapsed seconds while synthesising so user knows it's working
  useEffect(() => {
    if (previewStatus === "loading") {
      setElapsed(0);
      const t = setInterval(() => setElapsed(n => n + 1), 1000);
      return () => clearInterval(t);
    }
  }, [previewStatus]);

  const toggleSection = (s: string) =>
    setOpenSections(prev => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });

  // Detect if current moodValues match any preset
  const activePreset = useMemo(() =>
    allMoodPresets.find(p =>
      Math.abs(p.moodValues.energy - moodValues.energy) < 0.01 &&
      Math.abs(p.moodValues.calmness - moodValues.calmness) < 0.01 &&
      Math.abs(p.moodValues.tension - moodValues.tension) < 0.01 &&
      Math.abs(p.moodValues.brightness - moodValues.brightness) < 0.01
    ) ?? null, [allMoodPresets, moodValues]);

  const isModified = activePreset === null;

  // Daily stimulus configs (time, weather — not manual)
  const dailyConfigs = configs.filter(c => c.id !== "manual");

  const set = useCallback(<K extends keyof ComposerSettings>(key: K, val: ComposerSettings[K]) => {
    setComposerSettings({ ...composerSettings, [key]: val });
  }, [composerSettings, setComposerSettings]);

  const toggleInstrument = useCallback((id: LayerId) => {
    const cur = composerSettings.allowedInstruments;
    const next = cur.includes(id) ? cur.filter(i => i !== id) : [...cur, id];
    if (next.length > 0) set("allowedInstruments", next);
  }, [composerSettings.allowedInstruments, set]);

  const handlePreview = useCallback(async () => {
    if (previewStatus !== "idle" || vocalStage === "synthesizing" || vocalStage === "loading") return;
    setPreviewStatus("loading");
    try {
      const voice = composerSettings.vocalVoice;
      if (voice.startsWith("piper_")) {
        if (!getPiperSynth().isReady) await getPiperSynth().load();
      } else if (voice !== "browser" && voice !== "ai") {
        if (!getVocalSynth().isReady) await getVocalSynth().load();
      }
      const ms = await previewVocal(voice);
      setPreviewStatus("playing");
      setTimeout(() => setPreviewStatus("idle"), ms + 300);
    } catch (err) { setPreviewStatus("idle"); postToast(`Preview failed: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`, "error"); }
  }, [previewStatus, composerSettings.vocalVoice]);

  const snd = composerSettings.allowedInstruments.length === 4 ? "all" : composerSettings.allowedInstruments.join(", ");
  const str = `${composerSettings.minSections}–${composerSettings.maxSections} · ${composerSettings.keyMode === "any" ? "any key" : composerSettings.keyMode} · ≤${composerSettings.maxBpm}`;
  const voc = vocalsEnabled ? VOICES.find(v => v.id === composerSettings.vocalVoice)?.label ?? composerSettings.vocalVoice : "off";

  const sl: React.CSSProperties = { width: "100%", accentColor: "var(--accent)" };
  const row: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", gap: 12 };
  const sel: React.CSSProperties = { fontSize: 13, padding: "5px 8px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-strong)", color: "var(--text)" };

  return (
    <div style={{ padding: "20px 20px 180px", maxWidth: 720, margin: "0 auto" }}>

      {/* ── YOUR SOUND ────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12 }}>
          Your sound
        </div>

        {/* Preset chips */}
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 18 }}>
          {allMoodPresets.map(preset => {
            const active = preset === activePreset;
            return (
              <button key={preset.label} type="button" onClick={() => void applyMoodPreset(preset)}
                style={{
                  padding: "6px 14px", borderRadius: 20, fontSize: 13, cursor: "pointer",
                  border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                  background: active ? "var(--accent-bg)" : "var(--surface-strong)",
                  color: active ? "var(--accent)" : "var(--text)",
                  fontWeight: active ? 600 : 400,
                  transition: "all 0.15s",
                }}>
                {preset.label}
              </button>
            );
          })}
        </div>

        {/* Mood sliders */}
        {isReady && (
          <div style={{ display: "grid", gap: 14, padding: "2px 0" }}>
            {MOOD_KEYS.map(key => (
              <div key={key}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{MOOD_LABELS[key]}</span>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 6 }}>{MOOD_HINTS[key]}</span>
                  </div>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", flexShrink: 0 }}>{Math.round(moodValues[key] * 100)}%</span>
                </div>
                <input type="range" min={0} max={1} step={0.01} value={moodValues[key]} style={sl}
                  onChange={e => void handleMoodValueChange(key, Number(e.target.value))} />
              </div>
            ))}
          </div>
        )}

        {/* Save as preset — only shows when values differ from all presets */}
        {isModified && (
          <div style={{ marginTop: 14 }}>
            {!savingPreset ? (
              <button type="button" onClick={() => setSavingPreset(true)}
                style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, cursor: "pointer", border: "1px solid var(--border)", background: "none", color: "var(--text-muted)" }}>
                + Save as preset
              </button>
            ) : (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="text" placeholder="Preset name…" value={customMoodName}
                  onChange={e => setCustomMoodName(e.target.value)}
                  autoFocus
                  style={{ ...sel, flex: 1, padding: "6px 10px" }}
                />
                <button type="button"
                  disabled={!customMoodName.trim() || isSavingCustomMood}
                  onClick={async () => { await saveCustomMood(); setSavingPreset(false); }}
                  style={{ padding: "6px 14px", borderRadius: 8, fontSize: 13, cursor: "pointer", border: "1px solid var(--accent)", background: "var(--accent-bg)", color: "var(--accent)", fontWeight: 600 }}>
                  {isSavingCustomMood ? "Saving…" : "Save"}
                </button>
                <button type="button" onClick={() => { setSavingPreset(false); setCustomMoodName(""); }}
                  style={{ padding: "6px 10px", borderRadius: 8, fontSize: 13, cursor: "pointer", border: "1px solid var(--border)", background: "none", color: "var(--text-muted)" }}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── TODAY ─────────────────────────────────────── */}
      {dailyConfigs.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12 }}>
            Today
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {dailyConfigs.map(config => (
              <div key={config.id} style={{
                padding: "12px 14px", borderRadius: 12,
                background: "var(--surface)", border: "1px solid var(--border)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16 }}>{SOURCE_ICONS[config.id] ?? "●"}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{config.label}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {config.id === "time" ? "Shapes mood and tempo" : "Influences energy and tone"}
                      </div>
                    </div>
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)", cursor: "pointer" }}>
                    <input type="checkbox" checked={config.enabled}
                      onChange={e => void handleToggleEnabled(config.id, e.target.checked)} />
                    Active
                  </label>
                </div>
                {config.enabled && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 44 }}>Influence</span>
                    <input type="range" min={0} max={1} step={0.01} value={config.userWeight} style={{ ...sl }}
                      onChange={e => void handleUpdateWeight(config.id, Number(e.target.value))} />
                    <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 28, textAlign: "right" }}>
                      {Math.round(config.userWeight * 100)}%
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── COMPOSITION SHAPE ─────────────────────────── */}
      <div style={{ display: "grid", gap: 0 }}>
        <Section title="Sound" summary={snd} open={openSections.has("snd")} onToggle={() => toggleSection("snd")}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {LAYER_INFO.map(({ id, label, hint }) => {
              const active = composerSettings.allowedInstruments.includes(id);
              return (
                <button key={id} type="button" onClick={() => toggleInstrument(id)} style={{
                  padding: "9px 12px", borderRadius: 10, cursor: "pointer", textAlign: "left",
                  border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                  background: active ? "var(--accent-bg)" : "var(--surface-strong)",
                  opacity: active ? 1 : 0.5, transition: "all 0.15s",
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: active ? "var(--accent)" : "var(--text)" }}>{label}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{hint}</div>
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="Structure" summary={str} open={openSections.has("str")} onToggle={() => toggleSection("str")}>
          <div style={row}>
            <span style={{ fontSize: 13, color: "var(--text)" }}>Sections</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="number" min={1} max={composerSettings.maxSections} value={composerSettings.minSections}
                onChange={e => set("minSections", Math.min(Number(e.target.value), composerSettings.maxSections))}
                style={{ width: 46, ...sel, textAlign: "center" }} />
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>to</span>
              <input type="number" min={composerSettings.minSections} max={8} value={composerSettings.maxSections}
                onChange={e => set("maxSections", Math.max(Number(e.target.value), composerSettings.minSections))}
                style={{ width: 46, ...sel, textAlign: "center" }} />
            </div>
          </div>
          <div style={row}>
            <span style={{ fontSize: 13, color: "var(--text)" }}>Key</span>
            <select value={composerSettings.keyMode} onChange={e => set("keyMode", e.target.value as KeyMode)} style={sel}>
              {KEY_MODES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{ ...row, marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: "var(--text)" }}>Max BPM</span>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{composerSettings.maxBpm}</span>
            </div>
            <input type="range" min={40} max={180} step={5} value={composerSettings.maxBpm} style={sl}
              onChange={e => set("maxBpm", Number(e.target.value))} />
          </div>
          <div style={{ ...row, marginTop: 8 }}>
            <span style={{ fontSize: 13, color: "var(--text)" }}>Character</span>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {Math.round(composerSettings.complexity * 100)}% complex · {Math.round(composerSettings.motifDensity * 100)}% dense
            </span>
          </div>
          {(["complexity", "motifDensity", "harmonicMovement"] as const).map(key => {
            const l = { complexity: "Complexity", motifDensity: "Motif density", harmonicMovement: "Harmonic movement" };
            return (
              <div key={key} style={{ marginTop: 10 }}>
                <div style={{ ...row, marginBottom: 3 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{l[key]}</span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{Math.round(composerSettings[key] * 100)}%</span>
                </div>
                <input type="range" min={0} max={1} step={0.01} value={composerSettings[key]} style={sl}
                  onChange={e => set(key, Number(e.target.value))} />
              </div>
            );
          })}
        </Section>

        <Section title="Voice" summary={voc} open={openSections.has("voc")} onToggle={() => toggleSection("voc")}>
          <div style={row}>
            <span style={{ fontSize: 13, color: "var(--text)" }}>Vocals</span>
            <button type="button" onClick={() => setVocalsEnabled(!vocalsEnabled)} style={{
              padding: "5px 16px", borderRadius: 20, cursor: "pointer", fontSize: 13, fontWeight: 600,
              border: `1px solid ${vocalsEnabled ? "var(--accent)" : "var(--border)"}`,
              background: vocalsEnabled ? "var(--accent-bg)" : "var(--surface-strong)",
              color: vocalsEnabled ? "var(--accent)" : "var(--text-muted)",
            }}>{vocalsEnabled ? "On" : "Off"}</button>
          </div>
          {/* Melody instrument */}
          <div style={row}>
            <span style={{ fontSize: 13, color: "var(--text)" }}>Melody instrument</span>
            <select value={composerSettings.melodyInstrument ?? "ai"} onChange={e => set("melodyInstrument", e.target.value)} style={sel}>
              <option value="ai">AI chooses</option>
              <option value="piano">Piano</option>
              <option value="marimba">Marimba</option>
              <option value="strings">Strings</option>
              <option value="electric_piano">Electric piano</option>
              <option value="glass">Glass</option>
            </select>
          </div>
          {/* Bass */}
          <div style={row}>
            <span style={{ fontSize: 13, color: "var(--text)" }}>Bass</span>
            <select value={composerSettings.bassType ?? "ai"} onChange={e => set("bassType", e.target.value)} style={sel}>
              <option value="ai">AI chooses</option>
              <option value="sparse">Sparse</option>
              <option value="walking">Walking</option>
              <option value="pulse">Pulse</option>
              <option value="none">None</option>
            </select>
          </div>
          {vocalsEnabled && (
            <>
              <div style={{ ...row, marginTop: 8 }}>
                <span style={{ fontSize: 13, color: "var(--text)" }}>Voice</span>
                <select value={composerSettings.vocalVoice} onChange={e => set("vocalVoice", e.target.value)} style={{ ...sel, maxWidth: 180 }}>
                  {VOICES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                </select>
              </div>
              {composerSettings.vocalVoice !== "ai" && (
                <div style={{ marginTop: 10 }}>
                  <button type="button" disabled={previewStatus !== "idle" || vocalStage === "synthesizing" || vocalStage === "loading"} onClick={() => void handlePreview()} style={{
                    padding: "6px 16px", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: (previewStatus === "idle" && vocalStage !== "synthesizing" && vocalStage !== "loading") ? "pointer" : "default",
                    border: "1px solid var(--border)",
                    background: previewStatus === "playing" ? "var(--accent-bg)" : "var(--surface-strong)",
                    color: previewStatus === "playing" ? "var(--accent)" : "var(--text-muted)",
                  }}>
                    {vocalStage === "synthesizing" ? "Synthesising…"
                    : vocalStage === "loading" ? "Loading…"
                    : previewStatus === "idle" ? "▶ Preview voice"
                      : previewStatus === "loading" && composerSettings.vocalVoice.startsWith("piper_") && !getPiperSynth().isReady ? `Loading Piper… ${elapsed}s`
                    : previewStatus === "loading" && !composerSettings.vocalVoice.startsWith("piper_") && !getVocalSynth().isReady ? `Loading Kokoro… ${elapsed}s`
                      : previewStatus === "loading" ? `Synthesising… ${elapsed}s`
                      : "♪ Playing"}
                  </button>
                </div>
              )}
            </>
          )}
        </Section>
      </div>
    </div>
  );
}
