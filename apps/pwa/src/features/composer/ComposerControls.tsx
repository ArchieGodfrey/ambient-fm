import { useCallback, useState } from "react";
import { useAppStore } from "../../store/useAppStore";
import type { ComposerSettings, LayerId, KeyMode } from "./types";
import { previewVocal } from "../../audio/vocal/previewVocal";
import { getVocalSynth } from "../../audio/vocal/vocalSynth";

const SLIDER_LABELS: Record<string, string> = {
  complexity: "Complexity",
  motifDensity: "Motif Density",
  harmonicMovement: "Harmonic Movement",
};

const LAYER_LABELS: Record<LayerId, string> = {
  drone: "Drone",
  pad: "Pad",
  texture: "Texture",
  pulse: "Pulse",
};

const LAYER_DESCRIPTIONS: Record<LayerId, string> = {
  drone: "Continuous low bass tone",
  pad: "Harmonic chord synth",
  texture: "FM shimmer & atmosphere",
  pulse: "Rhythmic square-wave accent",
};

const VOICE_OPTIONS = [
  { id: "ai",         label: "AI chooses" },
  { id: "af_sky",     label: "Sky (US Female, soft)" },
  { id: "af_bella",   label: "Bella (US Female, warm)" },
  { id: "af_sarah",   label: "Sarah (US Female, clear)" },
  { id: "am_adam",    label: "Adam (US Male)" },
  { id: "am_echo",    label: "Echo (US Male, deep)" },
  { id: "bf_emma",    label: "Emma (UK Female)" },
  { id: "bm_george",  label: "George (UK Male)" },
];

const KEY_MODE_OPTIONS: { value: KeyMode; label: string }[] = [
  { value: "any",   label: "Any (AI chooses)" },
  { value: "major", label: "Major (bright)" },
  { value: "minor", label: "Minor (dark)" },
];

const row: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "6px 0",
  borderBottom: "1px solid var(--border)",
};

const label: React.CSSProperties = {
  fontSize: 13,
  color: "var(--text)",
};

const muted: React.CSSProperties = {
  fontSize: 11,
  color: "var(--text-muted)",
  marginTop: 1,
};

const section: React.CSSProperties = {
  marginTop: 16,
  paddingTop: 14,
  borderTop: "1px solid var(--border)",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  color: "var(--text-muted)",
  marginBottom: 10,
};

export default function ComposerControls() {
  const composerSettings = useAppStore((state) => state.composerSettings);
  const setComposerSettings = useAppStore((state) => state.setComposerSettings);
  const vocalsEnabled = useAppStore((state) => state.vocalsEnabled);
  const setVocalsEnabled = useAppStore((state) => state.setVocalsEnabled);
  const [previewStatus, setPreviewStatus] = useState<'idle' | 'loading' | 'playing'>('idle');

  const handlePreview = useCallback(async () => {
    if (previewStatus !== 'idle') return;
    setPreviewStatus('loading');
    try {
      if (!getVocalSynth().isReady) {
        await getVocalSynth().load();
      }
      const durationMs = await previewVocal(composerSettings.vocalVoice);
      setPreviewStatus('playing');
      setTimeout(() => setPreviewStatus('idle'), durationMs + 300);
    } catch (err) {
      console.error('Voice preview failed:', err);
      setPreviewStatus('idle');
    }
  }, [previewStatus, composerSettings.vocalVoice]);

  const set = useCallback(
    <K extends keyof ComposerSettings>(key: K, value: ComposerSettings[K]) => {
      setComposerSettings({ ...composerSettings, [key]: value });
    },
    [composerSettings, setComposerSettings],
  );

  const toggleInstrument = useCallback(
    (id: LayerId) => {
      const current = composerSettings.allowedInstruments;
      const next = current.includes(id)
        ? current.filter((i) => i !== id)
        : [...current, id];
      if (next.length === 0) return;
      set("allowedInstruments", next);
    },
    [composerSettings.allowedInstruments, set],
  );

  return (
    <div style={{ padding: "0 2px" }}>
      {/* Sliders */}
      <div style={sectionTitle}>Character</div>
      <div className="mood-page__strength-grid">
        {(Object.keys(SLIDER_LABELS) as Array<keyof typeof SLIDER_LABELS>).map((key) => (
          <div key={key} className="mood-page__range-row">
            <div className="mood-page__range-heading">
              <span>{SLIDER_LABELS[key]}</span>
              <span>{Math.round(composerSettings[key as keyof ComposerSettings] as number * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={composerSettings[key as keyof ComposerSettings] as number}
              onChange={(e) => set(key as keyof ComposerSettings, Number(e.target.value) as any)}
            />
          </div>
        ))}
      </div>

      {/* Instruments */}
      <div style={section}>
        <div style={sectionTitle}>Instruments</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {(["drone", "pad", "texture", "pulse"] as LayerId[]).map((id) => {
            const active = composerSettings.allowedInstruments.includes(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggleInstrument(id)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                  background: active ? "var(--accent-bg)" : "var(--surface-strong)",
                  cursor: "pointer",
                  textAlign: "left",
                  opacity: active ? 1 : 0.55,
                  transition: "all 0.15s",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: active ? "var(--accent)" : "var(--text)" }}>
                  {LAYER_LABELS[id]}
                </span>
                <span style={{ ...muted, marginTop: 2 }}>{LAYER_DESCRIPTIONS[id]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sections */}
      <div style={section}>
        <div style={sectionTitle}>Sections</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {(["minSections", "maxSections"] as const).map((key) => (
            <label key={key} style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
              <span style={label}>{key === "minSections" ? "Minimum" : "Maximum"}</span>
              <input
                type="number"
                min={key === "minSections" ? 1 : composerSettings.minSections}
                max={key === "maxSections" ? 8 : composerSettings.maxSections}
                value={composerSettings[key]}
                onChange={(e) => {
                  const v = Math.max(1, Math.min(8, Number(e.target.value)));
                  if (key === "minSections") {
                    set("minSections", Math.min(v, composerSettings.maxSections));
                  } else {
                    set("maxSections", Math.max(v, composerSettings.minSections));
                  }
                }}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--surface-strong)",
                  color: "var(--text)",
                  fontSize: 14,
                  width: "100%",
                }}
              />
            </label>
          ))}
        </div>
      </div>

      {/* Key mode & BPM */}
      <div style={section}>
        <div style={sectionTitle}>Key & Tempo</div>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={row}>
            <div>
              <div style={label}>Key mode</div>
            </div>
            <select
              value={composerSettings.keyMode}
              onChange={(e) => set("keyMode", e.target.value as KeyMode)}
              style={{
                fontSize: 13,
                padding: "5px 8px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--surface-strong)",
                color: "var(--text)",
              }}
            >
              {KEY_MODE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="mood-page__range-heading">
              <span style={{ fontSize: 13 }}>Max BPM</span>
              <span style={{ fontSize: 13 }}>{composerSettings.maxBpm}</span>
            </div>
            <input
              type="range"
              min={40}
              max={180}
              step={5}
              value={composerSettings.maxBpm}
              onChange={(e) => set("maxBpm", Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      {/* Vocals */}
      <div style={section}>
        <div style={sectionTitle}>Vocals</div>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={row}>
            <div>
              <div style={label}>Enable vocals</div>
              <div style={muted}>Spoken lyric lines per section</div>
            </div>
            <button
              type="button"
              onClick={() => setVocalsEnabled(!vocalsEnabled)}
              style={{
                padding: "5px 14px",
                borderRadius: 20,
                border: `1px solid ${vocalsEnabled ? "var(--accent)" : "var(--border)"}`,
                background: vocalsEnabled ? "var(--accent-bg)" : "var(--surface-strong)",
                color: vocalsEnabled ? "var(--accent)" : "var(--text-muted)",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {vocalsEnabled ? "On" : "Off"}
            </button>
          </div>
          {vocalsEnabled && (
            <div style={{ ...row, alignItems: "flex-start", paddingTop: 8 }}>
              <div>
                <div style={label}>Voice</div>
                <div style={muted}>Kokoro TTS voice</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                <select
                  value={composerSettings.vocalVoice}
                  onChange={(e) => set("vocalVoice", e.target.value)}
                  style={{
                    fontSize: 13,
                    padding: "5px 8px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--surface-strong)",
                    color: "var(--text)",
                    maxWidth: 180,
                  }}
                >
                  {VOICE_OPTIONS.map((v) => (
                    <option key={v.id} value={v.id}>{v.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void handlePreview()}
                  disabled={previewStatus !== 'idle' || composerSettings.vocalVoice === 'ai'}
                  style={{
                    fontSize: 12,
                    padding: "4px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: previewStatus === 'playing' ? "var(--accent-bg)" : "var(--surface-strong)",
                    color: previewStatus === 'playing' ? "var(--accent)" : "var(--text-muted)",
                    cursor: previewStatus === 'idle' ? "pointer" : "default",
                    transition: "all 0.15s",
                    minWidth: 72,
                  }}
                >
                  {previewStatus === 'idle' ? '▶ Preview'
                  : previewStatus === 'loading' && !getVocalSynth().isReady ? 'Loading Kokoro…'
                  : previewStatus === 'loading' ? 'Synthesising…'
                  : '♪ Playing'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
